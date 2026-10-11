import React, { useState, useEffect, useRef, useReducer } from 'react';
import { View, Text, Image, Platform, Modal, TouchableOpacity, Linking, AppState } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, type, radius } from '../theme.js';
import { Card } from './ui/Card.js';
import { Button } from './ui/Button.js';
import { Chip } from './ui/Chip.js';
import { Notice } from './ui/Notice.js';
import { IconCircle } from './ui/IconCircle.js';
import * as Location from 'expo-location';
import { 
  checkinLocation, 
  getOriginFix, 
  radiusByCategory,
  takeProofPhoto,
  checkPendingCameraResult,
  savePendingProof,
  clearPendingProof,
  readPendingProof,
  sanitizeProofId
} from '../location/checkin.js';
import { haversineMeters, calculateBearing } from '../utils/geo.js';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { useStore } from '../store/useStore.js';
import { CONFIG, FEATURES } from '../config.js';
import { describeTags, CATEGORY_LABELS } from '../missions/describe.js';
import { generateFactText } from '../missions/flavor.js';
import { isGrounded, clampSentences } from '../llm/grounding.js';
import { isVeryDark } from '../utils/photo.js';
import { logEvent } from '../utils/eventLog.js';
import { recheckUnavailableMissions } from '../missions/controller.js';
import { proofFlowReducer, PROOF_STATES, PROOF_EVENTS, initialProofState } from '../missions/proofFlow.js';

export function MissionCard({ mission, onComplete, recoveredProof, onClearRecoveredProof }) {
  const [loading, setLoading] = useState(false);
  const [loadingText, setLoadingText] = useState('');
  const [error, setError] = useState(null);
  
  const [flow, dispatchFlow] = useReducer(proofFlowReducer, initialProofState());
  const [isReplaceMode, setIsReplaceMode] = useState(false);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [isReviewDark, setIsReviewDark] = useState(false);
  
  const [displayDistance, setDisplayDistance] = useState(mission.element?.distanceMeters);
  const [distanceRefreshedAt, setDistanceRefreshedAt] = useState(null);
  const [bearing, setBearing] = useState(null);
  const [cameraWatchdogTriggered, setCameraWatchdogTriggered] = useState(false);

  useEffect(() => {
    if (mission.element?.lat !== undefined && mission.element?.lon !== undefined) {
      const area = useStore.getState().area;
      const refPoint = area?.origin || area?.center;
      if (refPoint?.lat !== undefined && refPoint?.lon !== undefined) {
        const b = calculateBearing(refPoint.lat, refPoint.lon, mission.element.lat, mission.element.lon);
        if (b) setBearing(b);
      }
    }
  }, [mission.element?.lat, mission.element?.lon]);

  const watchdogTimerRef = useRef(null);
  const isCameraPendingRef = useRef(false);

  const addLedgerEntry = useStore(state => state.addLedgerEntry);
  const completeMission = useStore(state => state.completeMission);
  const lastMissionDate = useStore(state => state.lastMissionDate);

  const isDone = mission.status === 'done';
  const isUnavailable = mission.status === 'unavailable';
  
  const isToday = lastMissionDate === mission.date;
  
  let typeColor = colors.go;
  let typeSoft = colors.goSoft;
  let glyph = 'walk';
  let buttonLabel = 'Check in here';
  let buttonIcon = 'walk';
  
  if (mission.type === 'LOOK') {
    typeColor = colors.look;
    typeSoft = colors.lookSoft;
    glyph = 'camera';
    buttonLabel = 'Take proof photo';
    buttonIcon = 'camera';
  } else if (mission.type === 'LEARN') {
    typeColor = colors.learn;
    typeSoft = colors.learnSoft;
    glyph = 'book';
    buttonLabel = 'Check in here';
    buttonIcon = 'book';
  }
  
  if (isDone) {
    typeColor = colors.success;
    typeSoft = colors.successSoft;
    glyph = 'checkmark-circle';
  }
  
  const rewardTokens = CONFIG.REWARDS[mission.type] || 500;

  // Handle proof recovered at screen level
  useEffect(() => {
    if (recoveredProof && recoveredProof.asset) {
      if (recoveredProof.mode === 'replace') setIsReplaceMode(true);
      handlePhotoTaken(recoveredProof.asset);
      if (onClearRecoveredProof) onClearRecoveredProof();
    }
  }, [recoveredProof]);

  // Pending proof recovery on Android (mount check)
  useEffect(() => {
    if (Platform.OS === 'android' && (mission.type === 'LOOK' || isReplaceMode) && !isDone) {
      const recover = async () => {
        try {
          const proofData = await readPendingProof(mission.id);
          if (!proofData) return;
          const pending = await checkPendingCameraResult();
          if (pending && !pending.canceled && pending.assets && pending.assets.length > 0) {
            if (proofData.mode === 'replace') setIsReplaceMode(true);
            await clearPendingProof(mission.id);
            setCameraWatchdogTriggered(false);
            if (watchdogTimerRef.current) {
              clearTimeout(watchdogTimerRef.current);
              watchdogTimerRef.current = null;
            }
            await handlePhotoTaken(pending.assets[0]);
          }
        } catch (e) {
          logEvent('camera', 'mount pending recovery failed', { error: e.message });
        }
      };
      recover();
    }
  }, [isDone, mission.type, mission.id]);

  // AppState recovery when camera request is pending
  useEffect(() => {
    const sub = AppState.addEventListener('change', async (nextState) => {
      if (nextState === 'active' && isCameraPendingRef.current) {
        logEvent('camera', 'AppState active while camera pending, waiting 1.5s');
        await new Promise(r => setTimeout(r, 1500));
        try {
          const pending = await checkPendingCameraResult();
          if (pending && !pending.canceled && pending.assets && pending.assets.length > 0) {
            const proofData = await readPendingProof(mission.id);
            if (proofData?.mode === 'replace') setIsReplaceMode(true);
            await clearPendingProof(mission.id);
            setCameraWatchdogTriggered(false);
            if (watchdogTimerRef.current) {
              clearTimeout(watchdogTimerRef.current);
              watchdogTimerRef.current = null;
            }
            await handlePhotoTaken(pending.assets[0]);
          }
        } catch (e) {
          logEvent('camera', 'AppState active recovery failed', { error: e.message });
        }
      }
    });
    return () => sub.remove();
  }, [mission.id]);
  
  const handlePhotoTaken = async (asset) => {
    // Photo age rule
    if (asset.exif && asset.exif.DateTimeOriginal) {
       const parts = asset.exif.DateTimeOriginal.split(/[: ]/);
       if (parts.length === 6) {
         const d = new Date(parts[0], parts[1]-1, parts[2], parts[3], parts[4], parts[5]);
         if (Date.now() - d.getTime() > CONFIG.CHECKIN.photoMaxAgeMs) {
           dispatchFlow({ type: PROOF_EVENTS.STAGE_FAIL, error: 'Photo is too old. Must take a live photo.' });
           setLoading(false);
           return;
         }
       }
    }
    
    // Save to debug store
    useStore.getState().setLastPhotoInfo({
      size: asset.fileSize,
      width: asset.width,
      height: asset.height,
      exif: asset.exif || {},
      isVeryDark: isVeryDark(asset.exif)
    });
    
    setIsReviewDark(isVeryDark(asset.exif));
    dispatchFlow({ type: PROOF_EVENTS.TAKEN, photo: asset });
    setLoading(false);
  };

  const handleCheckForPhoto = async () => {
    try {
      setLoading(true);
      setLoadingText('Checking for photo...');
      logEvent('camera', 'manual Check for photo tapped');
      const res = await checkPendingCameraResult();
      if (res && !res.canceled && res.assets && res.assets.length > 0) {
        const proofData = await readPendingProof(mission.id);
        if (proofData?.mode === 'replace') setIsReplaceMode(true);
        await clearPendingProof(mission.id);
        setCameraWatchdogTriggered(false);
        if (watchdogTimerRef.current) {
          clearTimeout(watchdogTimerRef.current);
          watchdogTimerRef.current = null;
        }
        await handlePhotoTaken(res.assets[0]);
      } else {
        setError('No photo was returned from the camera.');
        setCameraWatchdogTriggered(false);
        await clearPendingProof(mission.id);
      }
    } catch (e) {
      logEvent('camera', 'handleCheckForPhoto error', { error: e.message });
      setError(`Error checking photo: ${e.message}`);
    } finally {
      setLoading(false);
      isCameraPendingRef.current = false;
    }
  };

  const handleCancelCamera = async () => {
    logEvent('camera', 'watchdog Cancel tapped');
    if (watchdogTimerRef.current) {
      clearTimeout(watchdogTimerRef.current);
      watchdogTimerRef.current = null;
    }
    setCameraWatchdogTriggered(false);
    setLoading(false);
    isCameraPendingRef.current = false;
    await clearPendingProof(mission.id);
    dispatchFlow({ type: PROOF_EVENTS.CANCEL });
  };

  const finalizeProof = async ({ mission: m, photo, mode = 'complete', acceptDark = false, fromStage = null }) => {
    const currentMode = mode || (isReplaceMode ? 'replace' : 'complete');
    let currentStage = fromStage || flow.failedStage || 'saving';
    let currentSavedUri = flow.savedUri;

    setLoading(true);

    // 1. Stage: saving
    if (currentStage === 'saving') {
      setLoadingText('Saving photo...');
      logEvent('proof', 'stage: saving', { missionId: m.id, mode: currentMode, acceptDark });
      try {
        if (!currentSavedUri) {
          const dir = `${FileSystem.documentDirectory}proofs/`;
          const info = await FileSystem.getInfoAsync(dir);
          if (!info.exists) {
            await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
          }
          const safeId = sanitizeProofId(m.id);
          const filename = `proof_${safeId}_${Date.now()}.jpg`;
          const newUri = dir + filename;
          const sourceUri = photo?.uri || photo;

          await FileSystem.copyAsync({ from: sourceUri, to: newUri });
          const fInfo = await FileSystem.getInfoAsync(newUri);
          logEvent('camera', 'copy result', {
            from: sourceUri,
            to: newUri,
            size: fInfo.size,
            exists: fInfo.exists
          });

          if (!fInfo.exists || fInfo.size < (CONFIG.PHOTO.minBytes || 8000)) {
            dispatchFlow({ type: PROOF_EVENTS.STAGE_FAIL, error: 'That photo looks corrupt or empty. Retake it.' });
            setLoading(false);
            return;
          }
          currentSavedUri = newUri;
        }
        dispatchFlow({ type: PROOF_EVENTS.STAGE_OK, savedUri: currentSavedUri });
        currentStage = 'locating';
      } catch (e) {
        logEvent('proof', 'saving error', { error: e.message });
        dispatchFlow({ type: PROOF_EVENTS.STAGE_FAIL, error: `Could not save photo: ${e.message}` });
        setLoading(false);
        return;
      }
    }

    // 2. Stage: locating
    if (currentStage === 'locating') {
      setLoadingText('Checking location...');
      logEvent('proof', 'stage: locating', { missionId: m.id, mode: currentMode });
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          dispatchFlow({ type: PROOF_EVENTS.STAGE_FAIL, error: 'Location permission denied.' });
          setLoading(false);
          return;
        }

        const servicesEnabled = await Location.hasServicesEnabledAsync();
        if (!servicesEnabled) {
          dispatchFlow({ type: PROOF_EVENTS.STAGE_FAIL, error: 'Turn on location.' });
          setLoading(false);
          return;
        }

        let location;
        try {
          location = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
        } catch (locErr) {
          dispatchFlow({ type: PROOF_EVENTS.STAGE_FAIL, error: `Failed to get location: ${locErr.message}` });
          setLoading(false);
          return;
        }

        if (location.mocked) {
          dispatchFlow({ type: PROOF_EVENTS.STAGE_FAIL, error: 'Mocked locations are not allowed.' });
          setLoading(false);
          return;
        }

        const maxAcc = CONFIG.CHECKIN.maxAccuracyMeters || 50;
        if (location.coords.accuracy > maxAcc) {
          const acc = Math.round(location.coords.accuracy);
          const msg = `GPS accuracy is ${acc} m (needs ${maxAcc} m or better). Move near a window or outside and tap Try again. Your photo is kept.`;
          dispatchFlow({ type: PROOF_EVENTS.STAGE_FAIL, error: msg });
          setLoading(false);
          return;
        }

        if (m.type === 'LEARN' && currentMode !== 'replace') {
          if (m.element?.lat !== undefined && m.element?.lon !== undefined) {
            const dist = haversineMeters(m.element.lat, m.element.lon, location.coords.latitude, location.coords.longitude);
            const radius = radiusByCategory(m.element.category);
            if (dist > radius) {
              const msg = `You are ${Math.round(dist)} m away. Get within ${radius} m of the place.`;
              dispatchFlow({ type: PROOF_EVENTS.STAGE_FAIL, error: msg });
              setLoading(false);
              return;
            }
          }
        }

        dispatchFlow({ type: PROOF_EVENTS.STAGE_OK });
        currentStage = 'completing';
      } catch (e) {
        logEvent('proof', 'locating error', { error: e.message });
        dispatchFlow({ type: PROOF_EVENTS.STAGE_FAIL, error: `Location check failed: ${e.message}` });
        setLoading(false);
        return;
      }
    }

    // 3. Stage: completing
    if (currentStage === 'completing') {
      setLoadingText('Completing...');
      logEvent('proof', 'stage: completing', { missionId: m.id, mode: currentMode });
      try {
        if (currentMode === 'replace') {
          const oldUri = m.photoUri;
          completeMission(m.id, { photoUri: currentSavedUri, proofReplacedAt: Date.now() });
          addLedgerEntry(0, `Proof photo replaced: ${title}`);
          if (oldUri && oldUri !== currentSavedUri) {
            await FileSystem.deleteAsync(oldUri, { idempotent: true });
          }
          dispatchFlow({ type: PROOF_EVENTS.STAGE_OK });
          setIsReplaceMode(false);
        } else {
          let fact = null;
          let factSource = null;
          if (m.type === 'LEARN') {
            setLoadingText('Generating summary...');
            const tagLines = describeTags(m.element?.tags);
            const aiText = await generateFactText(m, tagLines);
            if (aiText) {
              const clamped = clampSentences(aiText, 3);
              if (isGrounded(clamped, tagLines)) {
                fact = clamped;
                factSource = 'ai';
              } else {
                factSource = 'tags';
              }
            } else {
              factSource = 'tags';
            }
          }

          const updates = { photoUri: currentSavedUri, fact, factSource, reward: rewardTokens };
          completeMission(m.id, updates);
          useStore.getState().addTokens(rewardTokens);
          addLedgerEntry(rewardTokens, `Mission completed: ${title}`);
          if (onComplete) {
            await onComplete(m.id, rewardTokens, updates);
          }
          dispatchFlow({ type: PROOF_EVENTS.STAGE_OK });
        }
      } catch (e) {
        logEvent('proof', 'completing error', { error: e.message });
        dispatchFlow({ type: PROOF_EVENTS.STAGE_FAIL, error: `Could not complete mission: ${e.message}` });
      } finally {
        setLoading(false);
      }
    }
  };

  const handleAction = async (replace = false) => {
    setError(null);
    if (flow.state === PROOF_STATES.ERROR) {
      dispatchFlow({ type: PROOF_EVENTS.CANCEL });
    }
    
    if (mission.type === 'GO') {
      setLoadingText('Getting a GPS fix...');
      setLoading(true);
      try {
        const res = await checkinLocation(mission.element.lat, mission.element.lon, mission.element.category);
        if (!res.success) {
          if (res.errorType === 'LOCATION_OFF') {
            setError({
              text: 'Turn on location to check in.',
              action: {
                label: 'Turn on location',
                onPress: () => Linking.sendIntent('android.settings.LOCATION_SOURCE_SETTINGS').catch(() => Linking.openSettings())
              }
            });
          } else if (res.errorType === 'PERMISSION_DENIED') {
            setError({
              text: 'Location permission denied permanently.',
              action: {
                label: 'Open app settings',
                onPress: () => Linking.openSettings()
              }
            });
          } else {
            setError(res.reason);
          }
          return;
        }

        completeMission(mission.id, { reward: rewardTokens });
        useStore.getState().addTokens(rewardTokens);
        addLedgerEntry(rewardTokens, `Mission completed: ${title}`);
        if (onComplete) {
          await onComplete(mission.id, rewardTokens, {});
        }
      } catch (e) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
      return;
    }
    
    // LOOK, LEARN, or Replace photo
    setLoadingText('Opening camera...');
    setLoading(true);
    setIsReplaceMode(replace);
    dispatchFlow({ type: PROOF_EVENTS.START_CAMERA });
    setCameraWatchdogTriggered(false);
    isCameraPendingRef.current = true;

    try {
      await savePendingProof(mission.id, {
        missionId: mission.id,
        mode: replace ? 'replace' : 'complete',
        timestamp: Date.now()
      });

      if (watchdogTimerRef.current) {
        clearTimeout(watchdogTimerRef.current);
      }
      watchdogTimerRef.current = setTimeout(() => {
        if (isCameraPendingRef.current) {
          logEvent('camera', 'watchdog triggered after 20s');
          setCameraWatchdogTriggered(true);
        }
      }, 20000);

      const photoRes = await takeProofPhoto();
      if (!photoRes.success) {
        if (photoRes.errorType === 'PERMISSION_DENIED') {
          setError({
            text: 'Camera permission denied.',
            action: {
              label: 'Open app settings',
              onPress: () => Linking.openSettings()
            }
          });
        } else if (photoRes.permResponse && photoRes.permResponse.canAskAgain) {
          setError('Camera permission denied');
        }
        await clearPendingProof(mission.id);
        dispatchFlow({ type: PROOF_EVENTS.CANCEL });
        return;
      }

      const result = photoRes.result;
      if (result.canceled) {
        setIsReplaceMode(false);
        await clearPendingProof(mission.id);
        dispatchFlow({ type: PROOF_EVENTS.CANCEL });
        return;
      }

      await clearPendingProof(mission.id);
      await handlePhotoTaken(result.assets[0]);
    } catch (err) {
      logEvent('camera', 'launchCamera error', { error: err.message });
      setError(`Camera error: ${err.message}`);
      dispatchFlow({ type: PROOF_EVENTS.CANCEL });
    } finally {
      if (watchdogTimerRef.current) {
        clearTimeout(watchdogTimerRef.current);
        watchdogTimerRef.current = null;
      }
      isCameraPendingRef.current = false;
      setLoading(false);
    }
  };
  
  const refreshDistance = async () => {
    try {
      const fix = await getOriginFix();
      if (fix && mission.element?.lat !== undefined && mission.element?.lon !== undefined) {
        const d = haversineMeters(fix.lat, fix.lon, mission.element.lat, mission.element.lon);
        setDisplayDistance(d);
        const b = calculateBearing(fix.lat, fix.lon, mission.element.lat, mission.element.lon);
        if (b) setBearing(b);
        setDistanceRefreshedAt(Date.now());
      }
    } catch(e) {}
  };
  
  const navigateToPlace = () => {
    if (!mission.element?.lat || !mission.element?.lon) return;
    const { lat, lon } = mission.element;
    const cleanTitle = encodeURIComponent(title || 'Mission Spot');
    const url = Platform.select({
      ios: `maps:0,0?q=${cleanTitle}&ll=${lat},${lon}`,
      android: `geo:${lat},${lon}?q=${lat},${lon}(${cleanTitle})`,
      default: `https://www.google.com/maps/search/?api=1&query=${lat},${lon}`
    });
    Linking.canOpenURL(url).then(supported => {
      if (supported) {
        return Linking.openURL(url);
      } else {
        return Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${lat},${lon}`);
      }
    }).catch(() => {
      Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${lat},${lon}`).catch(() => {
        setError("Could not open maps navigation");
      });
    });
  };

  let title = mission.title;
  if (isUnavailable) {
    if (mission.type === 'GO') {
      title = 'No place available';
    } else if (mission.type === 'LEARN') {
      title = 'Nothing to learn nearby';
    } else {
      title = 'No mission available';
    }
  } else if (!title) {
    if (mission.type === 'LOOK') {
      title = `Find: ${mission.prompt || 'something outdoors'}`;
    } else if (mission.type === 'LEARN') {
      const name = mission.element?.name || mission.element?.tags?.name;
      const species = mission.element?.tags?.species;
      title = name || (species ? `${species} tree` : CATEGORY_LABELS[mission.element?.category]) || 'A place';
    } else if (mission.type === 'GO') {
      const name = mission.element?.name || mission.element?.tags?.name;
      title = name ? `Walk to ${name}` : (CATEGORY_LABELS[mission.element?.category] || 'A park');
    } else {
      title = 'A place';
    }
  }

  let description = mission.description;
  if (FEATURES.missionFlavor && mission.flavor) description = description || mission.flavor;
  if (!description) {
    if (mission.type === 'LOOK') {
      description = "Take a photo of it as proof. Any place outdoors works.";
    } else if (mission.element) {
      const label = CATEGORY_LABELS[mission.element.category] || 'A place';
      const n = Math.round(mission.element.distanceMeters || 0);
      const r = radiusByCategory(mission.element.category);
      if (mission.type === 'GO') {
        description = `${label}, about ${n} m away. Check in within ${r} m.`;
      } else if (mission.type === 'LEARN') {
        description = `${label}, about ${n} m away. Check in, take a photo, then read what the map says.`;
      }
    }
  }

  const opacity = isUnavailable ? 0.6 : 1;
  
  return (
    <Card
      style={{
        marginBottom: spacing[16],
        opacity,
        borderColor: isDone ? colors.successBorder : colors.borderSubtle
      }}
      variant={isDone ? 'flat' : 'default'}
    >
      {/* Card Header */}
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', marginBottom: spacing[12] }}>
        <IconCircle
          name={glyph}
          color={typeColor}
          bgColor={typeSoft}
          size={44}
          style={{ marginRight: spacing[12] }}
        />
        <View style={{ flex: 1, minWidth: 0 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
            <Chip
              label={isDone ? 'DONE' : mission.type}
              bgColor={typeSoft}
              textColor={typeColor}
              size="small"
            />
            {isDone ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: colors.successSoft, paddingHorizontal: spacing[8], paddingVertical: 2, borderRadius: radius.pill }}>
                <Ionicons name="checkmark" size={12} color={colors.success} style={{ marginRight: 3 }} />
                <Text style={[type.label, { color: colors.success, fontSize: 10 }]}>+{rewardTokens} TOKENS</Text>
              </View>
            ) : (
              <Chip
                label={`+${rewardTokens}`}
                bgColor={colors.tokenBg}
                textColor={colors.tokenText}
                icon={<Ionicons name="flash" size={12} color={colors.tokenText} />}
                size="small"
              />
            )}
          </View>
          <Text
            style={[
              type.h2,
              { color: colors.text, marginTop: 2, flexShrink: 1, flexWrap: 'wrap' }
            ]}
            numberOfLines={2}
          >
            {title}
          </Text>
        </View>
      </View>
      
      {/* Description */}
      <Text style={[type.body, { color: colors.textMuted, fontSize: 14, lineHeight: 21, marginBottom: spacing[12] }]}>
        {description}
      </Text>
      
      {/* Distance, Grass Compass, and Proximity Radar Info */}
      {!isDone && !isUnavailable && (
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing[14], flexWrap: 'wrap', gap: spacing[8] }}>
          {(mission.type === 'GO' || mission.type === 'LEARN') && displayDistance !== undefined && (() => {
            const radiusThreshold = mission.element ? radiusByCategory(mission.element.category) : 60;
            const inRange = displayDistance <= radiusThreshold;
            const isNear = displayDistance <= 300;

            const radarBg = inRange ? colors.successSoft : isNear ? colors.warnSoft : colors.surfaceAlt;
            const radarColor = inRange ? colors.success : isNear ? colors.warnText : colors.textSecondary;
            const radarBorder = inRange ? colors.successBorder : isNear ? colors.warnBorder : colors.borderSubtle;
            const radarIcon = inRange ? 'radio-button-on' : isNear ? 'walk-outline' : 'compass-outline';
            const radarText = inRange
              ? 'In check-in range! 🎯'
              : isNear
              ? `Getting closer (${Math.round(displayDistance)}m) ⚡`
              : `Far (${Math.round(displayDistance)}m) 🧭`;

            return (
              <>
                <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: colors.primarySoft, paddingHorizontal: spacing[10], paddingVertical: 4, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.primarySoftBorder }}>
                  <Ionicons name="navigate" size={12} color={colors.primary} style={{ marginRight: 4 }} />
                  <Text style={[type.captionBold, { color: colors.primary, fontSize: 11 }]}>
                    {bearing ? `${bearing.cardinal} ${bearing.arrow} · ` : ''}{Math.round(displayDistance)} m away
                  </Text>
                  {distanceRefreshedAt ? (
                    <Text style={[type.caption, { color: colors.primary, fontSize: 10, marginLeft: 3 }]}>
                      (live)
                    </Text>
                  ) : null}
                </View>

                <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: radarBg, paddingHorizontal: spacing[10], paddingVertical: 4, borderRadius: radius.pill, borderWidth: 1, borderColor: radarBorder }}>
                  <Ionicons name={radarIcon} size={12} color={radarColor} style={{ marginRight: 4 }} />
                  <Text style={[type.captionBold, { color: radarColor, fontSize: 11 }]}>
                    {radarText}
                  </Text>
                </View>
              </>
            );
          })()}
        </View>
      )}
      
      {/* Secondary Actions for GO / LEARN */}
      {!isDone && (mission.type === 'GO' || mission.type === 'LEARN') && !isUnavailable && (
        <View style={{ flexDirection: 'row', marginBottom: spacing[16], flexWrap: 'wrap', gap: spacing[8] }}>
          <Button
            variant="secondary"
            size="small"
            label="Navigate"
            icon={<Ionicons name="navigate-outline" size={14} color={colors.text} />}
            onPress={navigateToPlace}
          />
          <Button
            variant="ghost"
            size="small"
            label="Refresh distance"
            icon={<Ionicons name="sync-outline" size={14} color={colors.textMuted} />}
            onPress={refreshDistance}
          />
        </View>
      )}

      {/* Unavailable State */}
      {isUnavailable && (
        <View style={{ marginTop: spacing[8] }}>
          <Notice variant="warn" text={mission.reason || "No suitable places found nearby."} />
          <Button 
            variant="secondary" 
            size="small" 
            label="Try again" 
            loading={loading}
            onPress={async () => {
              setLoading(true);
              setLoadingText('Checking places...');
              try {
                await recheckUnavailableMissions();
              } finally {
                setLoading(false);
              }
            }} 
            style={{ marginTop: spacing[12] }} 
          />
        </View>
      )}
      
      {/* Action Button & Proof Watchdogs */}
      {!isDone && !isUnavailable && (
        <View>
          <Button 
            label={(loading || ['saving', 'locating', 'completing'].includes(flow.state)) ? loadingText : buttonLabel} 
            icon={!(loading || ['saving', 'locating', 'completing'].includes(flow.state)) && <Ionicons name={buttonIcon} size={18} color={colors.onPrimary} />}
            onPress={() => handleAction(false)} 
            loading={loading || ['saving', 'locating', 'completing'].includes(flow.state)}
          />
          {cameraWatchdogTriggered && (
            <View style={{ marginTop: spacing[8] }}>
              <Notice 
                variant="warn" 
                text="The camera did not return. If you took a photo, tap Check for photo." 
              />
              <View style={{ flexDirection: 'row', marginTop: spacing[8], flexWrap: 'wrap', gap: spacing[8] }}>
                <Button 
                  size="small" 
                  label="Check for photo" 
                  onPress={handleCheckForPhoto} 
                />
                <Button 
                  variant="ghost" 
                  size="small" 
                  label="Cancel" 
                  onPress={handleCancelCamera} 
                />
              </View>
            </View>
          )}
          {flow.state === PROOF_STATES.ERROR && (
            <View style={{ marginTop: spacing[8] }}>
              <Notice 
                variant="error" 
                text={typeof flow.error === 'string' ? flow.error : flow.error?.text || 'Error occurred'} 
                action={flow.error?.action} 
              />
              <View style={{ flexDirection: 'row', marginTop: spacing[8], flexWrap: 'wrap', gap: spacing[8] }}>
                <Button 
                  size="small" 
                  label="Try again" 
                  onPress={() => finalizeProof({ 
                    mission, 
                    photo: flow.photo, 
                    mode: isReplaceMode ? 'replace' : 'complete', 
                    acceptDark: flow.acceptDark, 
                    fromStage: flow.failedStage 
                  })} 
                />
                <Button 
                  variant="ghost" 
                  size="small" 
                  label="Retake" 
                  onPress={() => {
                    dispatchFlow({ type: PROOF_EVENTS.RETAKE });
                    handleAction(isReplaceMode);
                  }} 
                />
              </View>
            </View>
          )}
          {error && flow.state !== PROOF_STATES.ERROR && (
            <View style={{ marginTop: spacing[8] }}>
              <Notice 
                variant="error" 
                text={typeof error === 'string' ? error : error.text} 
                action={error.action} 
              />
            </View>
          )}
        </View>
      )}
      
      {/* Done State Proof Thumbnail */}
      {isDone && (mission.type === 'LOOK' || mission.type === 'LEARN') && mission.photoUri && (
        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: spacing[12], padding: spacing[10], backgroundColor: colors.surfaceAlt, borderRadius: radius[14] }}>
          <TouchableOpacity onPress={() => setViewerOpen(true)} activeOpacity={0.85}>
            <View style={{ position: 'relative' }}>
              <Image source={{ uri: mission.photoUri }} style={{ width: 56, height: 56, borderRadius: radius[10] }} />
              <View style={{ position: 'absolute', bottom: 3, right: 3, backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 10, width: 20, height: 20, alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name="expand" size={12} color="#FFF" />
              </View>
            </View>
          </TouchableOpacity>
          <View style={{ flex: 1, flexShrink: 1, minWidth: 0, marginLeft: spacing[12] }}>
            <Text style={[type.captionBold, { color: colors.text }]}>Verified photo proof</Text>
            <Text style={[type.caption, { color: colors.textMuted, fontSize: 11 }]}>Stored locally on device</Text>
            {isToday && (
              <Button variant="ghost" size="small" label="Replace photo" onPress={() => handleAction(true)} style={{ alignSelf: 'flex-start', minHeight: 28, paddingVertical: 2, paddingHorizontal: 0, marginTop: 2 }} />
            )}
          </View>
        </View>
      )}
      
      {/* Learn Fact Box */}
      {isDone && mission.type === 'LEARN' && (
        <View style={{ marginTop: spacing[12], backgroundColor: colors.surfaceAlt, borderRadius: radius[14], padding: spacing[12], borderWidth: 1, borderColor: colors.borderSubtle }}>
          {mission.fact ? (
            <View style={{ marginBottom: spacing[8] }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
                <Ionicons name="sparkles" size={14} color={colors.learn} style={{ marginRight: 6 }} />
                <Text style={[type.label, { color: colors.learn, fontSize: 10 }]}>ON-DEVICE AI SUMMARY</Text>
              </View>
              <Text style={[type.body, { color: colors.text, fontSize: 14, lineHeight: 20 }]}>{mission.fact}</Text>
            </View>
          ) : null}
          <Text style={[type.label, { color: colors.textMuted, fontSize: 10, marginBottom: 4 }]}>OPENSTREETMAP FACTS</Text>
          {describeTags(mission.element.tags).map((line, i) => (
            <Text key={i} style={[type.caption, { color: colors.textSecondary, marginBottom: 2 }]}>• {line}</Text>
          ))}
        </View>
      )}

      {/* Review Modal */}
      <Modal visible={flow.state === PROOF_STATES.REVIEW} transparent={false} animationType="fade">
        <View style={{ flex: 1, backgroundColor: '#000' }}>
          <Image source={{ uri: flow.photo?.uri || flow.photo }} style={{ flex: 1, resizeMode: 'contain' }} />
          <View style={{ position: 'absolute', bottom: 40, left: 20, right: 20, flexDirection: 'column', gap: 12 }}>
            {isReviewDark ? (
              <View style={{ backgroundColor: colors.surface, padding: spacing[16], borderRadius: radius[20] }}>
                <Notice variant="warn" text="This photo looks very dark. Retake it?" />
                <Button label="Retake" onPress={() => {
                  dispatchFlow({ type: PROOF_EVENTS.RETAKE });
                  handleAction(isReplaceMode);
                }} style={{ marginTop: spacing[12] }} />
                <Button variant="ghost" label="Use anyway" onPress={() => {
                  dispatchFlow({ type: PROOF_EVENTS.USE_ANYWAY });
                  finalizeProof({ mission, photo: flow.photo, mode: isReplaceMode ? 'replace' : 'complete', acceptDark: true, fromStage: 'saving' });
                }} style={{ marginTop: spacing[8] }} />
              </View>
            ) : (
              <View style={{ backgroundColor: 'rgba(23, 34, 28, 0.85)', padding: spacing[16], borderRadius: radius[24], borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' }}>
                <Text style={[type.label, { color: '#FFF', textAlign: 'center', marginBottom: spacing[12], letterSpacing: 1 }]}>PROOF PHOTO PREVIEW</Text>
                <Button label="Use this photo" onPress={() => {
                  dispatchFlow({ type: PROOF_EVENTS.USE });
                  finalizeProof({ mission, photo: flow.photo, mode: isReplaceMode ? 'replace' : 'complete', acceptDark: false, fromStage: 'saving' });
                }} />
                <Button variant="secondary" label="Retake" onPress={() => {
                  dispatchFlow({ type: PROOF_EVENTS.RETAKE });
                  handleAction(isReplaceMode);
                }} style={{ marginTop: spacing[8] }} />
                <Button variant="ghost" label="Cancel" onPress={() => {
                  dispatchFlow({ type: PROOF_EVENTS.CANCEL });
                  setIsReplaceMode(false);
                }} style={{ marginTop: spacing[8] }} />
              </View>
            )}
          </View>
        </View>
      </Modal>

      {/* Viewer Modal */}
      <Modal visible={viewerOpen} transparent={false} animationType="fade">
        <View style={{ flex: 1, backgroundColor: '#000' }}>
          <Image source={{ uri: mission.photoUri }} style={{ flex: 1, resizeMode: 'contain' }} />
          <TouchableOpacity onPress={() => setViewerOpen(false)} style={{ position: 'absolute', top: 50, right: 20, width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="close" size={24} color="#FFF" />
          </TouchableOpacity>
        </View>
      </Modal>

    </Card>
  );
}

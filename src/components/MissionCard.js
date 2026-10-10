import React, { useState, useEffect } from 'react';
import { View, Text, Image, Platform, Modal, TouchableOpacity, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, type, radius } from '../theme.js';
import { Card } from './ui/Card.js';
import { Button } from './ui/Button.js';
import { Chip } from './ui/Chip.js';
import { Notice } from './ui/Notice.js';
import { IconCircle } from './ui/IconCircle.js';
import { checkinLocation, getOriginFix, radiusByCategory } from '../location/checkin.js';
import { haversineMeters } from '../utils/geo.js';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { useStore } from '../store/useStore.js';
import { CONFIG, FEATURES } from '../config.js';
import { describeTags, CATEGORY_LABELS } from '../missions/describe.js';
import { generateFactText } from '../missions/flavor.js';
import { isGrounded, clampSentences } from '../llm/grounding.js';

const pendingProofPath = (id) => `${FileSystem.documentDirectory}pendingProof_${id.replace(/[^a-zA-Z0-9]/g, '_')}.json`;

const savePendingProofMode = async (id, mode) => {
  try {
    await FileSystem.writeAsStringAsync(pendingProofPath(id), JSON.stringify({ mode }));
  } catch (e) {}
};

const popPendingProofMode = async (id) => {
  try {
    const path = pendingProofPath(id);
    const info = await FileSystem.getInfoAsync(path);
    if (info.exists) {
      const data = JSON.parse(await FileSystem.readAsStringAsync(path));
      await FileSystem.deleteAsync(path, { idempotent: true });
      return data?.mode || 'complete';
    }
  } catch (e) {}
  return null;
};

export function MissionCard({ mission, onComplete }) {
  const [loading, setLoading] = useState(false);
  const [loadingText, setLoadingText] = useState('');
  const [error, setError] = useState(null);
  
  const [reviewPhotoUri, setReviewPhotoUri] = useState(null);
  const [isReplaceMode, setIsReplaceMode] = useState(false);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [isReviewDark, setIsReviewDark] = useState(false);
  
  const [displayDistance, setDisplayDistance] = useState(mission.element?.distanceMeters);
  const [distanceRefreshedAt, setDistanceRefreshedAt] = useState(null);

  const addLedgerEntry = useStore(state => state.addLedgerEntry);
  const completeMission = useStore(state => state.completeMission);
  const lastMissionDate = useStore(state => state.lastMissionDate);

  const isDone = mission.status === 'done';
  const isUnavailable = mission.status === 'unavailable';
  
  const isToday = lastMissionDate === mission.date;
  
  let typeColor = colors.go;
  let typeSoft = colors.primarySoft;
  let glyph = 'walk';
  let buttonLabel = 'Check in here';
  
  if (mission.type === 'LOOK') {
    typeColor = colors.look;
    typeSoft = '#D6E4F0';
    glyph = 'eye';
    buttonLabel = 'Take proof photo';
  } else if (mission.type === 'LEARN') {
    typeColor = colors.learn;
    typeSoft = '#E8DAF4';
    glyph = 'book';
    buttonLabel = 'Check in here';
  }
  
  if (isDone) {
    typeColor = colors.success;
    typeSoft = colors.successSoft;
    glyph = 'checkmark-circle';
  }
  
  const rewardTokens = CONFIG.REWARDS[mission.type] || 500;

  // Pending proof recovery on Android
  useEffect(() => {
    if (Platform.OS === 'android' && mission.type === 'LOOK' && (!isDone || isReplaceMode)) {
      const recover = async () => {
        try {
          const pending = await ImagePicker.getPendingResultAsync();
          if (pending && pending.length > 0) {
             const res = pending[0];
             if (!res.canceled && res.assets && res.assets.length > 0) {
               const storedMode = await popPendingProofMode(mission.id);
               if (storedMode === 'replace') setIsReplaceMode(true);
               await handlePhotoTaken(res.assets[0]);
             }
          }
        } catch (e) {
          console.warn("Pending result recovery failed", e);
        }
      };
      recover();
    }
  }, [isDone, mission.type]);
  
    const handlePhotoTaken = async (asset) => {
    // Photo age rule
    if (asset.exif && asset.exif.DateTimeOriginal) {
       const parts = asset.exif.DateTimeOriginal.split(/[: ]/);
       if (parts.length === 6) {
         const d = new Date(parts[0], parts[1]-1, parts[2], parts[3], parts[4], parts[5]);
         if (Date.now() - d.getTime() > CONFIG.CHECKIN.photoMaxAgeMs) {
           setError('Photo is too old. Must take a live photo.');
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
    setReviewPhotoUri(asset.uri);
    setLoading(false);
  };

  const processPhoto = async (tempUri) => {
    try {
      const dir = `${FileSystem.documentDirectory}proofs/`;
      const info = await FileSystem.getInfoAsync(dir);
      if (!info.exists) {
        await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
      }
      const safeId = mission.id.replace(/[^a-zA-Z0-9]/g, '_');
      const filename = `proof_${safeId}_${Date.now()}.jpg`;
      const newUri = dir + filename;
      
      await FileSystem.copyAsync({ from: tempUri, to: newUri });
      const fInfo = await FileSystem.getInfoAsync(newUri);
      if (!fInfo.exists || fInfo.size < (CONFIG.PHOTO.minBytes || 40000)) {
        setError("That photo looks corrupt or empty. Retake it.");
        setReviewPhotoUri(null);
        setIsReplaceMode(false);
        return;
      }
      
      if (isReplaceMode) {
        const oldUri = mission.photoUri;
        completeMission(mission.id, { photoUri: newUri, proofReplacedAt: Date.now() });
        addLedgerEntry(0, `Proof photo replaced: ${title}`);
        if (oldUri) await FileSystem.deleteAsync(oldUri, { idempotent: true });
      } else {
        onComplete(mission.id, rewardTokens, { photoUri: newUri });
      }
      setReviewPhotoUri(null);
      setIsReplaceMode(false);
    } catch (e) {
      console.error(e);
      setError(`Could not save photo: ${e.message}`);
      setReviewPhotoUri(null);
      setIsReplaceMode(false);
    }
  };

  const handleAction = async (replace = false) => {
    setError(null);
    let fact = null;
    let factSource = null;
    
    if (mission.type === 'GO' || (mission.type === 'LEARN' && !replace)) {
      setLoadingText('Getting a GPS fix...');
      setLoading(true);
      const res = await checkinLocation(mission.element.lat, mission.element.lon, mission.element.category);
      if (!res.success) {
        setLoading(false);
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
    }
    
    if (mission.type === 'LOOK' || (mission.type === 'LEARN' && replace)) {
      setLoadingText('Opening camera...');
      setLoading(true);
      setIsReplaceMode(replace);
      const { status, canAskAgain } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        if (!canAskAgain) {
          setError({
            text: 'Camera permission denied.',
            action: {
              label: 'Open app settings',
              onPress: () => Linking.openSettings()
            }
          });
        } else {
          setError('Camera permission denied');
        }
        setLoading(false);
        return;
      }
      
      if (Platform.OS === 'android') {
        await savePendingProofMode(mission.id, replace ? 'replace' : 'complete');
      }
      
      let result;
      try {
        result = await ImagePicker.launchCameraAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          allowsEditing: false,
          quality: 0.5,
          exif: true
        });
      } catch (e) {
        setLoading(false);
        return;
      }
      
      if (result.canceled) {
        setLoading(false);
        setIsReplaceMode(false);
        return;
      }
      
      await handlePhotoTaken(result.assets[0]);
      return;
    }

    if (mission.type === 'LEARN' && !replace) {
      setLoadingText('Generating summary...');
      const tagLines = describeTags(mission.element.tags);
      const aiText = await generateFactText(mission, tagLines);
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
    
    setLoading(false);
    onComplete(mission.id, rewardTokens, { fact, factSource });
  };
  
  const refreshDistance = async () => {
    try {
      const fix = await getOriginFix();
      if (fix && mission.element) {
        const d = haversineMeters(fix.lat, fix.lon, mission.element.lat, mission.element.lon);
        setDisplayDistance(d);
        setDistanceRefreshedAt(Date.now());
      }
    } catch(e) {}
  };
  
  const navigateToPlace = () => {
    const { lat, lon } = mission.element;
    const url = `geo:${lat},${lon}?q=${lat},${lon}(${encodeURIComponent(title)})`;
    Linking.openURL(url).catch(() => setError("No navigation app installed"));
  };

  let title = mission.title;
  if (!title) {
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
    <Card style={{ marginBottom: spacing[16], opacity }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing[12] }}>
        <IconCircle name={glyph} color={typeColor} bgColor={typeSoft} />
        <View style={{ marginLeft: spacing[12], flex: 1 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Chip label={isDone ? 'DONE' : mission.type} bgColor={typeSoft} textColor={typeColor} />
            {isDone && <Text style={[type.label, { color: colors.success }]}>+{rewardTokens} tokens earned</Text>}
          </View>
          <Text style={[type.h2, { color: colors.text, marginTop: spacing[4] }]} numberOfLines={1}>
            {title}
          </Text>
        </View>
      </View>
      
      <Text style={[type.body, { color: colors.textMuted, marginBottom: spacing[12] }]}>
        {description}
      </Text>
      
      {!isDone && (
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing[16] }}>
          <Chip label={`+${rewardTokens} tokens`} bgColor={colors.tokenBg} textColor={colors.tokenText} icon={<Ionicons name="flash" size={14} color={colors.tokenText} />} />
          {(mission.type === 'GO' || mission.type === 'LEARN') && displayDistance !== undefined && (
            <Text style={[type.caption, { color: colors.textMuted, marginLeft: spacing[12], flexShrink: 1, flexWrap: 'wrap' }]}>
              about {Math.round(displayDistance)} m away{distanceRefreshedAt ? ' (updated just now)' : ''}
            </Text>
          )}
        </View>
      )}
      
      {!isDone && (mission.type === 'GO' || mission.type === 'LEARN') && !isUnavailable && (
         <View style={{ flexDirection: 'row', marginBottom: spacing[16] }}>
           <Button variant="secondary" size="small" label="Navigate" onPress={navigateToPlace} style={{ marginRight: spacing[8] }} />
           <Button variant="ghost" size="small" label="Refresh distance" onPress={refreshDistance} />
         </View>
      )}

      {isUnavailable && mission.reason && (
        <Notice variant="warn" text={mission.reason} />
      )}
      
      {!isDone && !isUnavailable && (
        <View>
          <Button 
            label={loading ? loadingText : buttonLabel} 
            onPress={() => handleAction(false)} 
            loading={loading}
          />
          {error && (
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
      
      {isDone && (mission.type === 'LOOK' || mission.type === 'LEARN') && mission.photoUri && (
        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: spacing[8] }}>
          <TouchableOpacity onPress={() => setViewerOpen(true)}>
            <Image source={{ uri: mission.photoUri }} style={{ width: 56, height: 56, borderRadius: radius[12], marginRight: spacing[12] }} />
          </TouchableOpacity>
          <View>
            <Text style={[type.caption, { color: colors.textMuted }]}>Proof photo (not image-checked)</Text>
            {isToday && (
              <Button variant="ghost" size="small" label="Replace photo" onPress={() => handleAction(true)} style={{ marginTop: spacing[4] }} />
            )}
          </View>
        </View>
      )}
      
      {isDone && mission.type === 'LEARN' && (
        <View style={{ marginTop: spacing[12], backgroundColor: colors.surfaceAlt, borderRadius: radius[12], padding: spacing[12] }}>
          {mission.fact ? (
            <>
              <Text style={[type.body, { color: colors.text, marginBottom: spacing[8] }]}>{mission.fact}</Text>
              <Text style={[type.caption, { color: colors.textMuted, marginBottom: spacing[8] }]}>AI summary from OpenStreetMap tags, written on-device</Text>
            </>
          ) : null}
          <Text style={[type.label, { color: colors.textMuted, marginBottom: spacing[4] }]}>Source: OpenStreetMap</Text>
          {describeTags(mission.element.tags).map((line, i) => (
            <Text key={i} style={[type.caption, { color: colors.textMuted }]}>{line}</Text>
          ))}
        </View>
      )}

            {/* Review Modal */}
      <Modal visible={!!reviewPhotoUri} transparent={false} animationType="fade">
        <View style={{ flex: 1, backgroundColor: '#000' }}>
          <Image source={{ uri: reviewPhotoUri }} style={{ flex: 1, resizeMode: 'contain' }} />
          <View style={{ position: 'absolute', bottom: 40, left: 20, right: 20, flexDirection: 'column', gap: 12 }}>
            {isReviewDark ? (
              <View style={{ backgroundColor: colors.surface, padding: spacing[16], borderRadius: radius[12] }}>
                <Notice variant="warn" text="This photo looks very dark. Retake it?" />
                <Button label="Retake" onPress={() => handleAction(isReplaceMode)} style={{ marginTop: spacing[12] }} />
                <Button variant="ghost" label="Use anyway" onPress={() => processPhoto(reviewPhotoUri)} style={{ marginTop: spacing[8] }} />
              </View>
            ) : (
              <View>
                <Text style={[type.label, { color: '#FFF', textAlign: 'center', marginBottom: spacing[12], textShadowColor: 'rgba(0,0,0,0.8)', textShadowOffset: {width: 0, height: 1}, textShadowRadius: 3 }]}>Proof photo (not image-checked)</Text>
                <Button label="Use this photo" onPress={() => processPhoto(reviewPhotoUri)} />
                <Button variant="secondary" label="Retake" onPress={() => handleAction(isReplaceMode)} style={{ marginTop: spacing[8] }} />
                <Button variant="ghost" label="Cancel" onPress={() => {
                  setReviewPhotoUri(null);
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
          <TouchableOpacity onPress={() => setViewerOpen(false)} style={{ position: 'absolute', top: 50, right: 20, padding: 10 }}>
            <Ionicons name="close" size={32} color="#FFF" />
          </TouchableOpacity>
        </View>
      </Modal>

    </Card>
  );
}

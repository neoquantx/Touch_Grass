import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Alert, Linking, TouchableOpacity } from 'react-native';
import * as Location from 'expo-location';
import * as FileSystem from 'expo-file-system/legacy';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useStore, selectIsSetupComplete } from '../../src/store/useStore.js';
import { CONFIG } from '../../src/config.js';
import { normalizeElements } from '../../src/osm/overpass.js';
import { fetchOverpass, OverpassError } from '../../src/osm/overpassClient.js';
import { saveAreaCache, loadAreaCache, clearAreaCache } from '../../src/osm/cache.js';
import { buildSampleArea } from '../../src/osm/sample.js';
import areaSeed from '../../src/data/area_seed.json';
import { recheckUnavailableMissions } from '../../src/missions/controller.js';

import { confirmTwice } from '../../src/utils/confirm.js';
import { Screen } from '../../src/components/ui/Screen.js';
import { Card } from '../../src/components/ui/Card.js';
import { Button } from '../../src/components/ui/Button.js';
import { Chip } from '../../src/components/ui/Chip.js';
import { Notice } from '../../src/components/ui/Notice.js';
import { ProgressBar } from '../../src/components/ui/ProgressBar.js';
import { IconCircle } from '../../src/components/ui/IconCircle.js';
import { colors, spacing, type, radius } from '../../src/theme.js';

export default function SetupScreen() {
  const router = useRouter();
  const hasHydrated = useStore((state) => state.hasHydrated);
  const corruptStateWarning = useStore((state) => state.corruptStateWarning);

  const modelReady = useStore((state) => state.modelReady);
  const setModelReady = useStore((state) => state.setModelReady);
  const area = useStore((state) => state.area);
  const setArea = useStore((state) => state.setArea);
  const resetProgress = useStore((state) => state.resetProgress);
  const resetEverything = useStore((state) => state.resetEverything);
  const clearArea = useStore((state) => state.clearArea);
  const tokens = useStore((state) => state.tokens);
  const lastTps = useStore((state) => state.lastTps);
  const isSetupComplete = useStore(selectIsSetupComplete);

  const [locStatus, setLocStatus] = useState('Not started');
  const [locGranted, setLocGranted] = useState(false);

  const [modelStatus, setModelStatus] = useState('Not started');
  const [modelProgress, setModelProgress] = useState(null);
  const downloadResumableRef = useRef(null);

  const [areaStatus, setAreaStatus] = useState('Not started');
  const [areaProgressText, setAreaProgressText] = useState('');
  const [areaFailures, setAreaFailures] = useState(null);
  const [manageStep, setManageStep] = useState(null);
  const [areaDetailsOpen, setAreaDetailsOpen] = useState(false);
  const [areaElapsed, setAreaElapsed] = useState(0);
  const areaTimerRef = useRef(null);

  const [modelFileSize, setModelFileSize] = useState(0);

  useEffect(() => {
    if (!hasHydrated) return;
    checkLocationPermission();
    verifyModelFile();
    verifyAreaCache();
  }, [hasHydrated]);

  const checkLocationPermission = async () => {
    const { status } = await Location.getForegroundPermissionsAsync();
    if (status === 'granted') {
      setLocGranted(true);
      setLocStatus('Done');
    }
  };

  const verifyModelFile = async () => {
    const finalUri = `${FileSystem.documentDirectory}${CONFIG.MODEL.fileName}`;
    try {
      const info = await FileSystem.getInfoAsync(finalUri);
      if (info.exists && info.size >= CONFIG.MODEL.minBytes) {
        setModelReady(true);
        setModelStatus('Done');
        setModelFileSize((info.size / 1024 / 1024).toFixed(1));
      } else {
        setModelReady(false);
        setModelStatus('Not started');
        setModelFileSize(0);
      }
    } catch (e) {
      setModelReady(false);
      setModelStatus('Not started');
      setModelFileSize(0);
    }
  };

  const verifyAreaCache = async () => {
    const cached = await loadAreaCache();
    if (cached) {
      setArea({ ...cached.meta, elements: cached.elements || [] });
      setAreaStatus('Done');
    } else {
      clearArea();
      setAreaStatus('Not started');
    }
  };

  const requestLocation = async () => {
    setLocStatus('In progress');
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status === 'granted') {
      setLocGranted(true);
      setLocStatus('Done');
    } else {
      setLocGranted(false);
      setLocStatus('Failed: Permission denied');
    }
  };

  const downloadModel = async () => {
    setModelStatus('In progress');
    setModelProgress({ percent: 0, mb: 0 });
    const tempUri = `${FileSystem.documentDirectory}${CONFIG.MODEL.fileName}.part`;
    const finalUri = `${FileSystem.documentDirectory}${CONFIG.MODEL.fileName}`;

    downloadResumableRef.current = FileSystem.createDownloadResumable(
      CONFIG.MODEL.url,
      tempUri,
      {},
      (dp) => {
        const percent = dp.totalBytesWritten / dp.totalBytesExpectedToWrite;
        const mb = (dp.totalBytesWritten / 1024 / 1024).toFixed(1);
        setModelProgress({ percent: Math.max(0, percent), mb });
      }
    );

    try {
      const { uri } = await downloadResumableRef.current.downloadAsync();
      const info = await FileSystem.getInfoAsync(uri);

      if (info.exists && info.size >= CONFIG.MODEL.minBytes) {
        await FileSystem.moveAsync({ from: uri, to: finalUri });
        setModelReady(true);
        setModelStatus('Done');
        setModelFileSize((info.size / 1024 / 1024).toFixed(1));
      } else {
        await FileSystem.deleteAsync(uri, { idempotent: true });
        setModelStatus('Failed: Truncated file');
        setModelReady(false);
      }
    } catch (e) {
      setModelStatus(`Failed: ${e.message}`);
      await FileSystem.deleteAsync(tempUri, { idempotent: true });
      setModelReady(false);
    } finally {
      downloadResumableRef.current = null;
      setModelProgress(null);
    }
  };

  const cancelDownload = async () => {
    if (downloadResumableRef.current) {
      try { await downloadResumableRef.current.cancelAsync(); } catch (e) {}
      downloadResumableRef.current = null;
      setModelStatus('Failed: Cancelled');
      setModelProgress(null);
      const tempUri = `${FileSystem.documentDirectory}${CONFIG.MODEL.fileName}.part`;
      await FileSystem.deleteAsync(tempUri, { idempotent: true });
    }
  };

  const deleteModel = async () => {
    const finalUri = `${FileSystem.documentDirectory}${CONFIG.MODEL.fileName}`;
    await FileSystem.deleteAsync(finalUri, { idempotent: true });
    setModelReady(false);
    setModelStatus('Not started');
    setModelFileSize(0);
  };

  const fetchLocationWithTimeout = async () => {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Location request timed out (15s)')), 15000);
      Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced })
        .then((loc) => { clearTimeout(timer); resolve(loc); })
        .catch((e) => { clearTimeout(timer); reject(e); });
    });
  };

  const cacheArea = async () => {
    if (!locGranted) return setAreaStatus('Failed: Need location permission');
    setAreaStatus('In progress');
    setAreaFailures(null);
    setAreaProgressText('Finding GPS location...');
    setAreaElapsed(0);

    areaTimerRef.current = setInterval(() => {
      setAreaElapsed(prev => prev + 1);
    }, 1000);

    try {
      const loc = await fetchLocationWithTimeout();
      const lat = loc.coords.latitude;
      const lon = loc.coords.longitude;

      const rawElements = await fetchOverpass(lat, lon, CONFIG.AREA.radiusMeters, (msg) => {
        setAreaProgressText(msg);
      });

      const normalized = normalizeElements(rawElements, lat, lon);

      const breakdown = {};
      normalized.forEach(el => { breakdown[el.category] = (breakdown[el.category] || 0) + 1; });

      const meta = { center: { lat, lon }, radius: CONFIG.AREA.radiusMeters, fetchedAt: Date.now(), count: normalized.length, breakdown, source: 'overpass' };
      await saveAreaCache(meta, normalized);
      setArea({ ...meta, elements: normalized });
      setAreaStatus('Done');
      await recheckUnavailableMissions();
    } catch (e) {
      setAreaStatus(area ? 'Done' : `Failed: ${e.message}`);
      if (area) Alert.alert('Cache failed', e.message);
      if (e instanceof OverpassError) {
        setAreaFailures(e.failures);
      }
    } finally {
      clearInterval(areaTimerRef.current);
      areaTimerRef.current = null;
    }
  };

  const useSampleData = async () => {
    if (!locGranted) return setAreaStatus('Failed: Need location permission');
    setAreaStatus('In progress');
    try {
      const loc = await fetchLocationWithTimeout();
      const lat = loc.coords.latitude;
      const lon = loc.coords.longitude;

      const normalized = buildSampleArea(lat, lon);
      const breakdown = {};
      normalized.forEach(el => { breakdown[el.category] = (breakdown[el.category] || 0) + 1; });

      const meta = { center: { lat, lon }, radius: CONFIG.AREA.radiusMeters, fetchedAt: Date.now(), count: normalized.length, breakdown, source: 'sample' };
      await saveAreaCache(meta, normalized);
      setArea({ ...meta, elements: normalized });
      setAreaStatus('Done');
      await recheckUnavailableMissions();
    } catch (e) {
      setAreaStatus(`Failed: ${e.message}`);
    }
  };

  const useBundledData = async () => {
    setAreaStatus('In progress');
    try {
      if (!areaSeed || !areaSeed.meta || areaSeed.elements.length === 0) {
        throw new Error('Bundled area is empty');
      }
      await saveAreaCache(areaSeed.meta, areaSeed.elements);
      setArea({ ...areaSeed.meta, elements: areaSeed.elements });
      setAreaStatus('Done');
      await recheckUnavailableMissions();
    } catch (e) {
      setAreaStatus(`Failed: ${e.message}`);
    }
  };

  const clearMyArea = async () => {
    await clearAreaCache();
    clearArea();
    setAreaStatus('Not started');
  };

  const getStatusChipProps = (status) => {
    if (status === 'Done') return { label: 'Done', bgColor: colors.successSoft, textColor: colors.success, icon: 'checkmark-circle' };
    if (status === 'In progress') return { label: 'Working...', bgColor: colors.primarySoft, textColor: colors.primary, icon: 'sync' };
    if (status.startsWith('Failed')) return { label: 'Action needed', bgColor: colors.dangerSoft, textColor: colors.danger, icon: 'alert-circle' };
    return { label: 'Not started', bgColor: colors.surfaceAlt, textColor: colors.textMuted, icon: 'time-outline' };
  };

  if (!hasHydrated) return null;

  let offlineReadiness = "Ready for airplane mode";
  let isOfflineReady = true;
  if (!corruptStateWarning && !locGranted) {
    offlineReadiness = "Needs location permission";
    isOfflineReady = false;
  } else if (corruptStateWarning) {
    offlineReadiness = "Corrupted state recovered";
    isOfflineReady = false;
  } else if (!modelReady) {
    offlineReadiness = "AI model not downloaded";
    isOfflineReady = false;
  } else if (!area) {
    offlineReadiness = "Map area not cached";
    isOfflineReady = false;
  }

  const renderStepNumber = (stepNum, isDone) => (
    <View
      style={[
        styles.stepBadge,
        {
          backgroundColor: isDone ? colors.successSoft : colors.primarySoft,
          borderColor: isDone ? colors.success : colors.primary,
        }
      ]}
    >
      <Text
        style={[
          styles.stepBadgeText,
          { color: isDone ? colors.success : colors.primary }
        ]}
      >
        {isDone ? '✓' : String(stepNum)}
      </Text>
    </View>
  );

  return (
    <Screen scroll title="Setup" subtitle="Device setup & offline readiness">
      <View style={styles.container}>

        {/* Safety Card */}
        <Card style={styles.safetyCard}>
          <View style={styles.safetyHeader}>
            <IconCircle name="shield-checkmark" size={28} color={colors.primary} bgColor={colors.primarySoft} />
            <View style={{ flex: 1, marginLeft: spacing[12] }}>
              <Text style={type.h2}>Safety Guidelines</Text>
              <Text style={[type.caption, { color: colors.textMuted }]}>Outdoor walk safety rules</Text>
            </View>
          </View>
          <View style={styles.safetyItem}>
            <Ionicons name="checkmark-circle" size={16} color={colors.primary} style={{ marginTop: 2, marginRight: spacing[8] }} />
            <Text style={[type.body, styles.safetyText]}>Public mapped places only</Text>
          </View>
          <View style={styles.safetyItem}>
            <Ionicons name="checkmark-circle" size={16} color={colors.primary} style={{ marginTop: 2, marginRight: spacing[8] }} />
            <Text style={[type.body, styles.safetyText]}>Watch traffic and stay aware of your surroundings</Text>
          </View>
          <View style={styles.safetyItem}>
            <Ionicons name="checkmark-circle" size={16} color={colors.primary} style={{ marginTop: 2, marginRight: spacing[8] }} />
            <Text style={[type.body, styles.safetyText]}>Do not use your phone while crossing roads</Text>
          </View>
          <View style={styles.safetyItem}>
            <Ionicons name="checkmark-circle" size={16} color={colors.primary} style={{ marginTop: 2, marginRight: spacing[8] }} />
            <Text style={[type.body, styles.safetyText]}>Daylight walking recommended</Text>
          </View>
        </Card>

        {corruptStateWarning && (
          <Notice
            variant="error"
            title="Storage Warning"
            message="Your saved state was corrupted. We had to reset it to defaults."
            style={{ marginBottom: spacing[16] }}
          />
        )}

        {area?.source === 'sample' && (
          <View style={{ marginBottom: spacing[16] }}>
            <Notice
              variant="warn"
              title="Using Sample Data"
              message="Using simulated sample map places. Cache your real area below for genuine outdoor walks."
              action={{ label: 'Cache now', onPress: cacheArea }}
            />
          </View>
        )}

        {/* How It Works Card */}
        <Card style={styles.howItWorksCard}>
          <Text style={[type.h2, { marginBottom: spacing[16] }]}>How Touch Grass Works</Text>
          <View style={styles.howStep}>
            <IconCircle name="walk" size={24} color={colors.primary} bgColor={colors.primarySoft} />
            <View style={{ flex: 1, marginLeft: spacing[12] }}>
              <Text style={type.bodyBold}>1. Walk to real places</Text>
              <Text style={[type.caption, { color: colors.textMuted }]}>Explore outdoor landmarks and green spaces in your neighborhood.</Text>
            </View>
          </View>
          <View style={styles.howStep}>
            <IconCircle name="camera" size={24} color={colors.info} bgColor={colors.infoSoft} />
            <View style={{ flex: 1, marginLeft: spacing[12] }}>
              <Text style={type.bodyBold}>2. Prove with GPS & photo</Text>
              <Text style={[type.caption, { color: colors.textMuted }]}>Check in within range and take an on-site photo for instant verification.</Text>
            </View>
          </View>
          <View style={[styles.howStep, { marginBottom: spacing[14] }]}>
            <IconCircle name="sparkles" size={24} color={colors.learn} bgColor={colors.learnSoft} />
            <View style={{ flex: 1, marginLeft: spacing[12] }}>
              <Text style={type.bodyBold}>3. Chat with on-device AI</Text>
              <Text style={[type.caption, { color: colors.textMuted }]}>Earn tokens to consult your companion running 100% locally on your phone.</Text>
            </View>
          </View>
          <View style={styles.privacyNote}>
            <Ionicons name="lock-closed" size={14} color={colors.primary} style={{ marginRight: 6 }} />
            <Text style={[type.caption, { color: colors.textMuted, flex: 1 }]}>
              Photos, GPS coordinates, and chats never leave this phone. Internet is used strictly for the one-time downloads on this screen.
            </Text>
          </View>
        </Card>

        {/* Section Header */}
        <View style={styles.setupSectionHeader}>
          <Text style={type.label}>DEVICE CONFIGURATION</Text>
        </View>

        {/* Step 1: Location */}
        <Card
          style={[
            styles.stepCard,
            locStatus === 'Done' && styles.stepCardDone
          ]}
        >
          <View style={styles.stepHeader}>
            <View style={styles.stepHeaderLeft}>
              {renderStepNumber(1, locStatus === 'Done')}
              <View style={{ marginLeft: spacing[10], flex: 1 }}>
                <Text style={type.h2}>Location Access</Text>
                <Text style={[type.caption, { color: colors.textMuted }]}>GPS permission for missions</Text>
              </View>
            </View>
            <Chip {...getStatusChipProps(locStatus)} />
          </View>

          <Text style={[type.body, { color: colors.textMuted, marginBottom: spacing[12] }]}>
            We need foreground location permission to detect nearby outdoor landmarks and track your walking distance.
          </Text>

          {locStatus.startsWith('Failed') && (
            <Notice variant="error" message={locStatus} style={{ marginBottom: spacing[12] }} />
          )}

          {!locGranted && (
            <Button
              label="Grant Location Permission"
              icon="navigate"
              onPress={requestLocation}
              style={{ marginTop: spacing[4] }}
            />
          )}

          {locStatus.startsWith('Failed') && !locGranted && (
            <Button
              label="Open System Settings"
              icon="settings-outline"
              onPress={() => Linking.openSettings()}
              variant="secondary"
              style={{ marginTop: spacing[8] }}
            />
          )}

          {locStatus === 'Done' && (
            <View style={styles.manageContainer}>
              <TouchableOpacity
                onPress={() => setManageStep(manageStep === 1 ? null : 1)}
                style={styles.manageToggle}
                activeOpacity={0.7}
              >
                <Text style={styles.manageToggleText}>
                  {manageStep === 1 ? 'Hide Settings' : 'Manage Permissions'}
                </Text>
                <Ionicons
                  name={manageStep === 1 ? 'chevron-up' : 'chevron-down'}
                  size={16}
                  color={colors.primary}
                />
              </TouchableOpacity>
              {manageStep === 1 && (
                <View style={{ marginTop: spacing[10] }}>
                  <Button
                    label="Open System Settings"
                    icon="settings-outline"
                    onPress={() => Linking.openSettings()}
                    variant="secondary"
                  />
                </View>
              )}
            </View>
          )}
        </Card>

        {/* Step 2: AI Model */}
        <Card
          style={[
            styles.stepCard,
            modelStatus === 'Done' && styles.stepCardDone
          ]}
        >
          <View style={styles.stepHeader}>
            <View style={styles.stepHeaderLeft}>
              {renderStepNumber(2, modelStatus === 'Done')}
              <View style={{ marginLeft: spacing[10], flex: 1 }}>
                <Text style={type.h2}>On-Device AI Model</Text>
                <Text style={[type.caption, { color: colors.textMuted }]}>Qwen2.5 0.5B (~{CONFIG.MODEL.approxMB} MB)</Text>
              </View>
            </View>
            <Chip {...getStatusChipProps(modelStatus)} />
          </View>

          <Text style={[type.body, { color: colors.textMuted, marginBottom: spacing[12] }]}>
            Download the quantized language model to chat completely offline without sending any conversational data to servers.
          </Text>

          {modelStatus.startsWith('Failed') && (
            <Notice variant="error" message={modelStatus} style={{ marginBottom: spacing[12] }} />
          )}

          {modelStatus === 'In progress' && (
            <View style={styles.progressContainer}>
              <ProgressBar progress={modelProgress?.percent || 0} height={8} />
              <View style={styles.progressLabelRow}>
                <Text style={[type.captionBold, { color: colors.primary }]}>
                  {((modelProgress?.percent || 0) * 100).toFixed(1)}% completed
                </Text>
                <Text style={[type.caption, { color: colors.textMuted }]}>
                  {modelProgress?.mb || '0'} MB downloaded
                </Text>
              </View>
              <Button
                label="Cancel Download"
                icon="close"
                onPress={cancelDownload}
                variant="danger"
                style={{ marginTop: spacing[12] }}
              />
            </View>
          )}

          {!modelReady && modelStatus !== 'In progress' && (
            <Button
              label={`Download AI Model (~${CONFIG.MODEL.approxMB} MB)`}
              icon="cloud-download-outline"
              onPress={downloadModel}
              style={{ marginTop: spacing[4] }}
            />
          )}

          {modelStatus === 'Done' && (
            <View style={styles.manageContainer}>
              <TouchableOpacity
                onPress={() => setManageStep(manageStep === 2 ? null : 2)}
                style={styles.manageToggle}
                activeOpacity={0.7}
              >
                <Text style={styles.manageToggleText}>
                  {manageStep === 2 ? 'Hide Options' : `Manage Model (${modelFileSize} MB)`}
                </Text>
                <Ionicons
                  name={manageStep === 2 ? 'chevron-up' : 'chevron-down'}
                  size={16}
                  color={colors.primary}
                />
              </TouchableOpacity>
              {manageStep === 2 && (
                <View style={{ marginTop: spacing[10], gap: spacing[8] }}>
                  <Button
                    label="Re-download model"
                    icon="refresh"
                    onPress={async () => {
                      const ok = await confirmTwice({
                        title: 'Re-download model',
                        firstMessage: 'This will download the AI model again.',
                        secondMessage: 'Are you sure?',
                        confirmLabel: 'Re-download'
                      });
                      if (ok) downloadModel();
                    }}
                    variant="secondary"
                  />
                  <Button
                    label="Delete model from device"
                    icon="trash-outline"
                    onPress={async () => {
                      const ok = await confirmTwice({
                        title: 'Delete model',
                        firstMessage: 'This will remove the model file from your device.',
                        secondMessage: 'Are you sure? You will need to download it again.',
                        confirmLabel: 'Delete'
                      });
                      if (ok) deleteModel();
                    }}
                    variant="danger"
                  />
                </View>
              )}
            </View>
          )}
        </Card>

        {/* Step 3: Map Area */}
        <Card
          style={[
            styles.stepCard,
            (areaStatus === 'Done' || area) && styles.stepCardDone
          ]}
        >
          <View style={styles.stepHeader}>
            <View style={styles.stepHeaderLeft}>
              {renderStepNumber(3, areaStatus === 'Done' || !!area)}
              <View style={{ marginLeft: spacing[10], flex: 1 }}>
                <Text style={type.h2}>Map Area Cache</Text>
                <Text style={[type.caption, { color: colors.textMuted }]}>
                  {CONFIG.AREA.radiusMeters >= 1000 ? CONFIG.AREA.radiusMeters / 1000 : CONFIG.AREA.radiusMeters} {CONFIG.AREA.radiusMeters >= 1000 ? 'km' : 'm'} local exploration radius
                </Text>
              </View>
            </View>
            <Chip {...getStatusChipProps(areaStatus)} />
          </View>

          <Text style={[type.body, { color: colors.textMuted, marginBottom: spacing[12] }]}>
            Download landmark and open space data from OpenStreetMap for offline exploration and GPS mission validation.
          </Text>

          {areaStatus.startsWith('Failed') && (
            <View style={{ marginBottom: spacing[12] }}>
              <Notice variant="error" message={areaStatus} />
              {areaFailures && areaFailures.length > 0 && (
                <View style={{ marginTop: spacing[8] }}>
                  <TouchableOpacity onPress={() => setAreaDetailsOpen(!areaDetailsOpen)} style={styles.manageToggle}>
                    <Text style={styles.manageToggleText}>
                      {areaDetailsOpen ? 'Hide Failure Details' : 'Show Failure Details'}
                    </Text>
                    <Ionicons name={areaDetailsOpen ? 'chevron-up' : 'chevron-down'} size={14} color={colors.primary} />
                  </TouchableOpacity>
                  {areaDetailsOpen && (
                    <View style={styles.failureDetailBox}>
                      {areaFailures.map((f, i) => (
                        <Text key={i} style={[type.caption, { color: colors.danger, marginBottom: 4 }]}>
                          • {f.host}: [{f.status}] {f.error}
                        </Text>
                      ))}
                    </View>
                  )}
                </View>
              )}
            </View>
          )}

          {areaStatus === 'In progress' && (
            <View style={styles.progressContainer}>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing[6] }}>
                <Ionicons name="sync" size={16} color={colors.primary} style={{ marginRight: 6 }} />
                <Text style={[type.bodyBold, { color: colors.text, flex: 1 }]}>{areaProgressText}</Text>
              </View>
              <Text style={[type.caption, { color: colors.textMuted }]}>
                Time elapsed: {areaElapsed} seconds
              </Text>
            </View>
          )}

          {!area && areaStatus !== 'In progress' && (
            <View style={{ marginTop: spacing[4], gap: spacing[8] }}>
              <Button
                label={areaStatus.startsWith('Failed') ? 'Retry caching my area' : 'Cache my area from OpenStreetMap'}
                icon="cloud-download-outline"
                onPress={cacheArea}
              />
              <Button
                label="Use sample data instead"
                icon="layers-outline"
                onPress={useSampleData}
                variant="secondary"
              />
              {areaSeed && areaSeed.elements && areaSeed.elements.length >= 5 && (
                <Button
                  label="Use bundled area (offline seed)"
                  icon="archive-outline"
                  onPress={useBundledData}
                  variant="secondary"
                />
              )}
            </View>
          )}

          {(areaStatus === 'Done' || area) && (
            <View style={styles.manageContainer}>
              <TouchableOpacity
                onPress={() => setManageStep(manageStep === 3 ? null : 3)}
                style={styles.manageToggle}
                activeOpacity={0.7}
              >
                <Text style={styles.manageToggleText}>
                  {manageStep === 3 ? 'Hide Map Details' : `Manage Map (${area?.count || 0} places)`}
                </Text>
                <Ionicons
                  name={manageStep === 3 ? 'chevron-up' : 'chevron-down'}
                  size={16}
                  color={colors.primary}
                />
              </TouchableOpacity>
              {manageStep === 3 && (
                <View style={{ marginTop: spacing[12] }}>
                  <View style={styles.areaInfoBox}>
                    <View style={styles.areaInfoRow}>
                      <Text style={[type.captionBold, { color: colors.textMuted }]}>SOURCE</Text>
                      <Text style={[type.captionBold, { color: colors.primary }]}>{area?.source?.toUpperCase() || 'UNKNOWN'}</Text>
                    </View>
                    <View style={styles.areaInfoRow}>
                      <Text style={[type.captionBold, { color: colors.textMuted }]}>PLACES</Text>
                      <Text style={[type.captionBold, { color: colors.text }]}>{area?.count || 0} mapped</Text>
                    </View>
                    {area?.center && (
                      <View style={styles.areaInfoRow}>
                        <Text style={[type.captionBold, { color: colors.textMuted }]}>COORDINATES</Text>
                        <Text style={[type.caption, { color: colors.text }]}>{area.center.lat.toFixed(4)}, {area.center.lon.toFixed(4)}</Text>
                      </View>
                    )}
                    {area?.fetchedAt && (
                      <View style={[styles.areaInfoRow, { borderBottomWidth: 0 }]}>
                        <Text style={[type.captionBold, { color: colors.textMuted }]}>CACHED</Text>
                        <Text style={[type.caption, { color: colors.textMuted }]}>
                          {Math.round((Date.now() - area.fetchedAt) / 3600000)} hours ago
                        </Text>
                      </View>
                    )}
                  </View>

                  <View style={{ marginTop: spacing[12], gap: spacing[8] }}>
                    <Button
                      label="Re-cache my area"
                      icon="refresh"
                      onPress={cacheArea}
                    />
                    {areaSeed && areaSeed.elements && areaSeed.elements.length >= 5 && (
                      <Button
                        label="Use bundled area"
                        icon="archive-outline"
                        onPress={useBundledData}
                        variant="secondary"
                      />
                    )}
                    <Button
                      label="Use sample data"
                      icon="layers-outline"
                      onPress={useSampleData}
                      variant="secondary"
                    />
                    <Notice
                      variant="warn"
                      message="Sample places are simulated for testing. Real outdoor exploration requires genuine OSM cache."
                      style={{ marginTop: spacing[4] }}
                    />
                    <Button
                      label="Clear area cache"
                      icon="trash-outline"
                      onPress={async () => {
                        const ok = await confirmTwice({
                          title: 'Clear area cache',
                          firstMessage: 'This will remove the saved map area.',
                          secondMessage: 'Are you sure?',
                          confirmLabel: 'Clear'
                        });
                        if (ok) clearMyArea();
                      }}
                      variant="danger"
                      style={{ marginTop: spacing[4] }}
                    />
                  </View>
                </View>
              )}
            </View>
          )}
        </Card>

        {/* Offline Readiness & Completion */}
        {isSetupComplete && (
          <View style={{ marginTop: spacing[8] }}>
            {/* Readiness Banner */}
            <Card style={styles.readyCard}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <IconCircle name="airplane" size={32} color={colors.success} bgColor="#FFFFFF" />
                <View style={{ flex: 1, marginLeft: spacing[12] }}>
                  <Text style={[type.h3, { color: colors.success }]}>Ready for Offline Walking</Text>
                  <Text style={[type.caption, { color: colors.textMuted }]}>
                    All maps, models, and algorithms run completely locally without network.
                  </Text>
                </View>
              </View>
            </Card>

            <View style={{ marginTop: spacing[16], gap: spacing[8], marginBottom: spacing[24] }}>
              <Button
                label="See Today's Missions"
                icon="compass"
                onPress={() => router.navigate('/')}
              />
              <Button
                label="Run Speed Test & Diagnostics"
                icon="hardware-chip-outline"
                onPress={() => router.push('/debug')}
                variant="secondary"
              />
            </View>

            {/* Diagnostics Card */}
            <Card style={{ marginBottom: spacing[24] }}>
              <View style={styles.diagnosticsHeader}>
                <Ionicons name="hardware-chip" size={20} color={colors.primary} />
                <Text style={[type.h2, { marginLeft: spacing[8] }]}>System Diagnostics</Text>
              </View>

              <View style={styles.diagList}>
                <View style={styles.diagRow}>
                  <Text style={[type.captionBold, { color: colors.textMuted }]}>AIRPLANE MODE</Text>
                  <Chip
                    label={isOfflineReady ? 'Ready' : 'Not Ready'}
                    bgColor={isOfflineReady ? colors.successSoft : colors.dangerSoft}
                    textColor={isOfflineReady ? colors.success : colors.danger}
                    size="small"
                  />
                </View>
                <View style={styles.diagRow}>
                  <Text style={[type.captionBold, { color: colors.textMuted }]}>MODEL FILE</Text>
                  <Text style={[type.bodyBold, { color: colors.text }]}>{modelFileSize} MB</Text>
                </View>
                <View style={styles.diagRow}>
                  <Text style={[type.captionBold, { color: colors.textMuted }]}>MODEL IN MEMORY</Text>
                  <Text style={[type.bodyBold, { color: modelReady ? colors.success : colors.textMuted }]}>
                    {modelReady ? 'Loaded' : 'Unloaded'}
                  </Text>
                </View>
                <View style={styles.diagRow}>
                  <Text style={[type.captionBold, { color: colors.textMuted }]}>INFERENCE SPEED</Text>
                  <Text style={[type.bodyBold, { color: lastTps ? colors.primary : colors.textMuted }]}>
                    {lastTps ? `${lastTps.toFixed(2)} tps` : 'Untested'}
                  </Text>
                </View>
                <View style={styles.diagRow}>
                  <Text style={[type.captionBold, { color: colors.textMuted }]}>MAP AREA SOURCE</Text>
                  <Text style={[type.bodyBold, { color: colors.text }]}>{area?.source || 'None'}</Text>
                </View>
                {area?.source === 'bundled' && (
                  <Text style={[type.caption, { color: colors.textMuted, fontStyle: 'italic', marginBottom: 8 }]}>
                    Using bundled map data (downloaded in advance with Overpass)
                  </Text>
                )}
                <View style={styles.diagRow}>
                  <Text style={[type.captionBold, { color: colors.textMuted }]}>MAPPED PLACES</Text>
                  <Text style={[type.bodyBold, { color: colors.text }]}>{area?.count || 0} elements</Text>
                </View>
                {area?.breakdown && (
                  <View style={[styles.diagRow, { flexDirection: 'column', alignItems: 'flex-start' }]}>
                    <Text style={[type.captionBold, { color: colors.textMuted, marginBottom: 4 }]}>CATEGORY BREAKDOWN</Text>
                    <Text style={[type.caption, { color: colors.textMuted }]}>
                      {Object.entries(area.breakdown).map(([k, v]) => `${k}: ${v}`).join('  •  ')}
                    </Text>
                  </View>
                )}
                <View style={styles.diagRow}>
                  <Text style={[type.captionBold, { color: colors.textMuted }]}>TOKEN BALANCE</Text>
                  <Text style={[type.bodyBold, { color: colors.tokenGoldText }]}>{tokens} tokens</Text>
                </View>
                <View style={[styles.diagRow, { borderBottomWidth: 0 }]}>
                  <Text style={[type.captionBold, { color: colors.textMuted }]}>APP VERSION</Text>
                  <Text style={[type.caption, { color: colors.textMuted }]}>1.0.0 (Offline-first)</Text>
                </View>
              </View>
            </Card>

            {/* Reset & Data Card */}
            <Card style={styles.dangerCard}>
              <View style={styles.dangerHeader}>
                <Ionicons name="warning" size={20} color={colors.danger} />
                <Text style={[type.h2, { color: colors.danger, marginLeft: spacing[8] }]}>Reset and Data</Text>
              </View>
              <Text style={[type.caption, { color: colors.textMuted, marginBottom: spacing[16] }]}>
                Destructive operations. Progress reset clears walks, places, and tokens. Full reset also erases downloaded model files and cached maps.
              </Text>

              <View style={{ gap: spacing[8] }}>
                <Button
                  label="Reset progress"
                  icon="refresh"
                  onPress={async () => {
                    const ok = await confirmTwice({
                      title: 'Reset progress',
                      firstMessage: 'This will clear tokens, visited places, and mission history.',
                      secondMessage: 'Are you sure? This cannot be undone.',
                      confirmLabel: 'Reset'
                    });
                    if (ok) {
                      await resetProgress();
                    }
                  }}
                  variant="secondary"
                />
                <Button
                  label="Delete everything"
                  icon="trash-outline"
                  onPress={async () => {
                    const ok = await confirmTwice({
                      title: 'Delete everything',
                      firstMessage: 'This will clear progress AND delete the AI model and map cache.',
                      secondMessage: 'Are you ABSOLUTELY sure? You will lose all data and need to download everything again.',
                      confirmLabel: 'Delete All'
                    });
                    if (ok) {
                      await resetEverything();
                    }
                  }}
                  variant="danger"
                />
              </View>
            </Card>
          </View>
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: spacing[16],
    paddingBottom: spacing[40],
  },
  safetyCard: {
    marginBottom: spacing[16],
    backgroundColor: colors.surface,
  },
  safetyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing[12],
  },
  safetyItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: spacing[6],
  },
  safetyText: {
    color: colors.textMuted,
    flex: 1,
  },
  howItWorksCard: {
    marginBottom: spacing[24],
    backgroundColor: colors.surface,
  },
  howStep: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: spacing[14],
  },
  privacyNote: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceAlt,
    padding: spacing[10],
    borderRadius: radius[8],
  },
  setupSectionHeader: {
    marginBottom: spacing[12],
    paddingHorizontal: spacing[4],
  },
  stepCard: {
    marginBottom: spacing[16],
    borderColor: colors.border,
    borderWidth: 1,
  },
  stepCardDone: {
    borderColor: colors.successBorder,
  },
  stepHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing[12],
  },
  stepHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: spacing[8],
  },
  stepBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepBadgeText: {
    fontSize: 13,
    fontWeight: '700',
  },
  manageContainer: {
    marginTop: spacing[14],
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
    paddingTop: spacing[12],
  },
  manageToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing[4],
  },
  manageToggleText: {
    color: colors.primary,
    fontWeight: '700',
    fontSize: 14,
  },
  progressContainer: {
    marginTop: spacing[8],
    marginBottom: spacing[8],
    backgroundColor: colors.surfaceAlt,
    padding: spacing[12],
    borderRadius: radius[8],
  },
  progressLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing[8],
  },
  failureDetailBox: {
    marginTop: spacing[8],
    backgroundColor: colors.dangerSoft,
    padding: spacing[10],
    borderRadius: radius[6],
  },
  areaInfoBox: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius[8],
    padding: spacing[12],
  },
  areaInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing[6],
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  readyCard: {
    backgroundColor: colors.successSoft,
    borderColor: colors.successBorder,
    borderWidth: 1,
  },
  diagnosticsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing[12],
  },
  diagList: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius[8],
    padding: spacing[12],
  },
  diagRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing[8],
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  dangerCard: {
    marginBottom: spacing[32],
    borderColor: colors.dangerBorder,
    borderWidth: 1,
    backgroundColor: colors.surface,
  },
  dangerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing[8],
  },
});

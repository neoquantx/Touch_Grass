import React, { useState, useEffect, useRef } from 'react';
import { View, Text, Alert, Linking, ScrollView, TouchableOpacity } from 'react-native';
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

import { confirmTwice } from '../../src/utils/confirm.js';
import { Screen } from '../../src/components/ui/Screen.js';
import { Card } from '../../src/components/ui/Card.js';
import { Button } from '../../src/components/ui/Button.js';
import { Chip } from '../../src/components/ui/Chip.js';
import { Notice } from '../../src/components/ui/Notice.js';
import { ProgressBar } from '../../src/components/ui/ProgressBar.js';
import { IconCircle } from '../../src/components/ui/IconCircle.js';
import { colors, spacing, type } from '../../src/theme.js';

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
      setArea(cached.meta);
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
    setAreaProgressText('Finding location...');
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
      setArea(meta);
      setAreaStatus('Done');
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
      setArea(meta);
      setAreaStatus('Done');
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
      setArea(areaSeed.meta);
      setAreaStatus('Done');
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
    if (status === 'Done') return { label: 'Done', bgColor: colors.successSoft, textColor: colors.success };
    if (status === 'In progress') return { label: 'Working...', bgColor: colors.primarySoft, textColor: colors.primary };
    if (status.startsWith('Failed')) return { label: 'Failed', bgColor: colors.dangerSoft, textColor: colors.danger };
    return { label: 'Not started', bgColor: colors.surfaceAlt, textColor: colors.textMuted };
  };

  if (!hasHydrated) return null;

  let offlineReadiness = "Yes";
  if (!corruptStateWarning && !locGranted) offlineReadiness = "No: Location permission";
  else if (corruptStateWarning) offlineReadiness = "No: Corrupt state file";
  else if (!modelReady) offlineReadiness = "No: Model missing";
  else if (!area) offlineReadiness = "No: Map area missing";

  return (
    <Screen scroll title="Setup">
      <View style={{ padding: spacing[16] }}>

        <Card style={{ marginBottom: spacing[16] }}>
          <Text style={[type.h2, { marginBottom: spacing[8] }]}>Safety</Text>
          <Text style={[type.body, { color: colors.textMuted, marginBottom: spacing[4] }]}>• Public mapped places only</Text>
          <Text style={[type.body, { color: colors.textMuted, marginBottom: spacing[4] }]}>• Watch traffic</Text>
          <Text style={[type.body, { color: colors.textMuted, marginBottom: spacing[4] }]}>• Do not use the phone while crossing roads</Text>
          <Text style={[type.body, { color: colors.textMuted }]}>• Daylight recommended</Text>
        </Card>

        
        {corruptStateWarning && (
           <Notice variant="error" title="Warning" message="Your saved state was corrupted. We had to reset it to defaults." style={{ marginBottom: spacing[16] }} />
        )}
        
        {area?.source === 'sample' && (
          <View style={{ marginBottom: spacing[16] }}>
            <Notice variant="warn" text="Using SAMPLE map data. Cache your real area in Setup." action={{ label: 'Cache now', onPress: cacheArea }} />
          </View>
        )}

        <Card style={{ marginBottom: spacing[24] }}>
          <Text style={[type.h2, { color: colors.text, marginBottom: spacing[16] }]}>How it works</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing[12] }}>
            <Ionicons name="walk" size={24} color={colors.primary} style={{ marginRight: spacing[12] }} />
            <Text style={[type.body, { color: colors.text, flex: 1 }]}>Walk to real places near you</Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing[12] }}>
            <Ionicons name="location" size={24} color={colors.primary} style={{ marginRight: spacing[12] }} />
            <Text style={[type.body, { color: colors.text, flex: 1 }]}>Prove it with GPS and a photo</Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing[16] }}>
            <Ionicons name="flash" size={24} color={colors.primary} style={{ marginRight: spacing[12] }} />
            <Text style={[type.body, { color: colors.text, flex: 1 }]}>Earn tokens to chat with an AI that lives entirely on this phone</Text>
          </View>
          <Text style={[type.caption, { color: colors.textMuted }]}>
            Photos, location and chats never leave this phone. Internet is used only for the downloads on this screen.
          </Text>
        </Card>

        {/* Step 1 */}
        <Card style={{ marginBottom: spacing[16], borderColor: locStatus === 'Done' ? colors.success : 'transparent', borderWidth: 1 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing[12] }}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <IconCircle name="location" color={colors.surface} bgColor={colors.text} size={28} />
              <Text style={[type.h2, { color: colors.text, marginLeft: spacing[12] }]}>Step 1: Location</Text>
            </View>
            <Chip {...getStatusChipProps(locStatus)} />
          </View>
          <Text style={[type.body, { color: colors.textMuted, marginBottom: spacing[16] }]}>We need your location to find nearby places.</Text>
          {locStatus.startsWith('Failed') && <Notice variant="error" text={locStatus} />}
          {!locGranted && (
            <Button label="Grant Location Permission" onPress={requestLocation} style={{ marginTop: spacing[12] }} />
          )}
          {locStatus.startsWith('Failed') && !locGranted && (
            <Button label="Open Settings" onPress={() => Linking.openSettings()} variant="secondary" style={{ marginTop: spacing[8] }} />
          )}

          {locStatus === 'Done' && (
            <View style={{ marginTop: spacing[12], borderTopWidth: 1, borderTopColor: colors.border, paddingTop: spacing[12] }}>
              <TouchableOpacity onPress={() => setManageStep(manageStep === 1 ? null : 1)}>
                <Text style={{ color: colors.primary, fontWeight: 'bold' }}>{manageStep === 1 ? 'Hide Manage' : 'Manage'}</Text>
              </TouchableOpacity>
              {manageStep === 1 && (
                <View style={{ marginTop: spacing[8] }}>
                  <Button label="Open app settings" onPress={() => Linking.openSettings()} variant="secondary" />
                </View>
              )}
            </View>
          )}
        </Card>

        {/* Step 2 */}
        <Card style={{ marginBottom: spacing[16], borderColor: modelStatus === 'Done' ? colors.success : 'transparent', borderWidth: 1 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing[12] }}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <IconCircle name="cloud-download" color={colors.surface} bgColor={colors.text} size={28} />
              <Text style={[type.h2, { color: colors.text, marginLeft: spacing[12] }]}>Step 2: AI Model</Text>
            </View>
            <Chip {...getStatusChipProps(modelStatus)} />
          </View>
          <Text style={[type.body, { color: colors.textMuted, marginBottom: spacing[16] }]}>Download the AI model (about {CONFIG.MODEL.approxMB} MB, use Wi-Fi).</Text>
          {modelStatus.startsWith('Failed') && <Notice variant="error" text={modelStatus} />}
          {modelStatus === 'In progress' && (
             <View style={{ marginTop: spacing[12] }}>
               <ProgressBar progress={modelProgress?.percent || 0} />
               <Text style={[type.caption, { color: colors.textMuted, textAlign: 'center', marginTop: spacing[8], marginBottom: spacing[16] }]}>
                 {((modelProgress?.percent || 0) * 100).toFixed(1)}% ({modelProgress?.mb} MB)
               </Text>
               <Button label="Cancel Download" onPress={cancelDownload} variant="danger" />
             </View>
          )}
          {!modelReady && modelStatus !== 'In progress' && (
            <Button label="Download AI Model" onPress={downloadModel} style={{ marginTop: spacing[12] }} />
          )}

          {modelStatus === 'Done' && (
            <View style={{ marginTop: spacing[12], borderTopWidth: 1, borderTopColor: colors.border, paddingTop: spacing[12] }}>
              <TouchableOpacity onPress={() => setManageStep(manageStep === 2 ? null : 2)}>
                <Text style={{ color: colors.primary, fontWeight: 'bold' }}>{manageStep === 2 ? 'Hide Manage' : 'Manage'}</Text>
              </TouchableOpacity>
              {manageStep === 2 && (
                <View style={{ marginTop: spacing[8] }}>
                  <Button label="Re-download model" onPress={async () => {
                    const ok = await confirmTwice({
                      title: 'Re-download model',
                      firstMessage: 'This will download the AI model again.',
                      secondMessage: 'Are you sure?',
                      confirmLabel: 'Re-download'
                    });
                    if (ok) downloadModel();
                  }} variant="secondary" style={{ marginBottom: spacing[8] }} />
                  <Button label="Delete model" onPress={async () => {
                    const ok = await confirmTwice({
                      title: 'Delete model',
                      firstMessage: 'This will remove the model file from your device.',
                      secondMessage: 'Are you sure? You will need to download it again.',
                      confirmLabel: 'Delete'
                    });
                    if (ok) deleteModel();
                  }} variant="danger" />
                </View>
              )}
            </View>
          )}
        </Card>

        {/* Step 3 */}
        <Card style={{ marginBottom: spacing[24], borderColor: areaStatus === 'Done' ? colors.success : 'transparent', borderWidth: 1 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing[12] }}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <IconCircle name="compass" color={colors.surface} bgColor={colors.text} size={28} />
              <Text style={[type.h2, { color: colors.text, marginLeft: spacing[12] }]}>Step 3: Map Area</Text>
            </View>
            <Chip {...getStatusChipProps(areaStatus)} />
          </View>
          <Text style={[type.body, { color: colors.textMuted, marginBottom: spacing[16] }]}>Save a {CONFIG.AREA.radiusMeters >= 1000 ? CONFIG.AREA.radiusMeters / 1000 : CONFIG.AREA.radiusMeters} {CONFIG.AREA.radiusMeters >= 1000 ? 'km' : 'm'} radius around you.</Text>
          
          {areaStatus.startsWith('Failed') && (
            <View>
              <Notice variant="error" text={areaStatus} />
              {areaFailures && areaFailures.length > 0 && (
                <View style={{ marginTop: spacing[8] }}>
                  <TouchableOpacity onPress={() => setAreaDetailsOpen(!areaDetailsOpen)}>
                    <Text style={{ color: colors.primary, fontWeight: 'bold' }}>
                      {areaDetailsOpen ? 'Hide Details' : 'Show Details'}
                    </Text>
                  </TouchableOpacity>
                  {areaDetailsOpen && (
                    <View style={{ marginTop: spacing[8], backgroundColor: colors.surfaceAlt, padding: spacing[8], borderRadius: 4 }}>
                      {areaFailures.map((f, i) => (
                        <Text key={i} style={{ color: colors.text, fontSize: 12, marginBottom: 4 }}>
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
            <View style={{ marginTop: spacing[12] }}>
              <Text style={{ color: colors.text }}>{areaProgressText}</Text>
              <Text style={{ color: colors.textMuted, fontSize: 12 }}>Elapsed: {areaElapsed}s</Text>
            </View>
          )}
          
          {!area && areaStatus !== 'In progress' && (
             <View style={{ marginTop: spacing[12] }}>
               <Button label={areaStatus.startsWith('Failed') ? 'Retry caching' : 'Cache my area'} onPress={cacheArea} />
               <Button label="Use sample data instead" onPress={useSampleData} variant="secondary" style={{ marginTop: spacing[8] }} />
               {areaSeed && areaSeed.elements && areaSeed.elements.length >= 5 && (
                 <Button label="Use bundled area (pre-downloaded)" onPress={useBundledData} variant="secondary" style={{ marginTop: spacing[8] }} />
               )}
             </View>
          )}

          {(areaStatus === 'Done' || area) && (
            <View style={{ marginTop: spacing[12], borderTopWidth: 1, borderTopColor: colors.border, paddingTop: spacing[12] }}>
              <TouchableOpacity onPress={() => setManageStep(manageStep === 3 ? null : 3)}>
                <Text style={{ color: colors.primary, fontWeight: 'bold' }}>{manageStep === 3 ? 'Hide Manage' : 'Manage'}</Text>
              </TouchableOpacity>
              {manageStep === 3 && (
                <View style={{ marginTop: spacing[8] }}>
                  <Text style={{ color: colors.text, marginBottom: spacing[4] }}>Source: {area?.source}</Text>
                  <Text style={{ color: colors.text, marginBottom: spacing[4] }}>Elements: {area?.count}</Text>
                  {area?.center && <Text style={{ color: colors.text, marginBottom: spacing[4] }}>Center: {area.center.lat.toFixed(4)}, {area.center.lon.toFixed(4)}</Text>}
                  <Text style={{ color: colors.text, marginBottom: spacing[12] }}>{area?.fetchedAt ? `Cached ${Math.round((Date.now() - area.fetchedAt) / 3600000)} hours ago` : ''}</Text>
                  
                  <Button label="Re-cache my area" onPress={cacheArea} style={{ marginBottom: spacing[8] }} />
                  {areaSeed && areaSeed.elements && areaSeed.elements.length >= 5 && (
                    <Button label="Use bundled area" onPress={useBundledData} variant="secondary" style={{ marginBottom: spacing[8] }} />
                  )}
                  <Button label="Use sample data" onPress={useSampleData} variant="secondary" style={{ marginBottom: spacing[8] }} />
                  <Notice variant="warn" text="Sample places are fake. Do not use for a real walk." />
                  <View style={{ marginTop: spacing[8] }}>
                    <Button label="Clear area cache" onPress={async () => {
                      const ok = await confirmTwice({
                        title: 'Clear area cache',
                        firstMessage: 'This will remove the saved map area.',
                        secondMessage: 'Are you sure?',
                        confirmLabel: 'Clear'
                      });
                      if (ok) clearMyArea();
                    }} variant="danger" />
                  </View>
                </View>
              )}
            </View>
          )}
        </Card>

        {isSetupComplete && (
          <View>
            <Notice variant="success" text="Ready. You can go offline now." />
            <Button label="See today's missions" onPress={() => router.navigate('/')} style={{ marginTop: spacing[16] }} />
            <Button label="Run speed test" onPress={() => router.push('/debug')} variant="secondary" style={{ marginTop: spacing[8], marginBottom: spacing[24] }} />
            
            <Card style={{ marginBottom: spacing[24] }}>
              <Text style={[type.h2, { color: colors.text, marginBottom: spacing[12] }]}>Diagnostics</Text>
              <Text style={[type.body, { color: colors.text }]}>Ready for airplane mode: {offlineReadiness}</Text>
              <Text style={[type.body, { color: colors.text }]}>Model file size: {modelFileSize} MB</Text>
              <Text style={[type.body, { color: colors.text }]}>Model loaded: {modelReady ? 'yes' : 'no'}</Text>
              <Text style={[type.body, { color: colors.text }]}>Last generation speed: {lastTps ? `${lastTps.toFixed(2)} tps` : 'N/A'}</Text>
              <Text style={[type.body, { color: colors.text }]}>Area source: {area?.source}</Text>
              {area?.source === 'bundled' && (
                <Text style={[type.caption, { color: colors.textMuted, fontStyle: 'italic' }]}>
                  Using bundled map data (downloaded in advance with Overpass)
                </Text>
              )}
              <Text style={[type.body, { color: colors.text }]}>Area element count: {area?.count}</Text>
              {area?.breakdown && (
                <Text style={[type.caption, { color: colors.textMuted }]}>
                  {Object.entries(area.breakdown).map(([k, v]) => `${k} ${v}`).join(', ')}
                </Text>
              )}
              <Text style={[type.body, { color: colors.text }]}>Tokens balance: {tokens}</Text>
              <Text style={[type.body, { color: colors.text }]}>App version: 1.0.0</Text>
            </Card>

            

            <Card style={{ marginBottom: spacing[32], borderColor: colors.danger, borderWidth: 1 }}>
              <Text style={[type.h2, { color: colors.text, marginBottom: spacing[12] }]}>Reset and data</Text>
              <Button label="Reset progress" onPress={async () => {
                const ok = await confirmTwice({
                  title: 'Reset progress',
                  firstMessage: 'This will clear tokens, visited places, and mission history.',
                  secondMessage: 'Are you sure? This cannot be undone.',
                  confirmLabel: 'Reset'
                });
                if (ok) {
                  await resetProgress();
                }
              }} variant="secondary" style={{ marginBottom: spacing[8] }} />
              <Button label="Delete everything" onPress={async () => {
                const ok = await confirmTwice({
                  title: 'Delete everything',
                  firstMessage: 'This will clear progress AND delete the AI model and map cache.',
                  secondMessage: 'Are you ABSOLUTELY sure? You will lose all data and need to download everything again.',
                  confirmLabel: 'Delete All'
                });
                if (ok) {
                  await resetEverything();
                }
              }} variant="danger" />
            </Card>
          </View>
        )}
      </View>
    </Screen>
  );
}

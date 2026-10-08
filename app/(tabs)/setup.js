import React, { useState, useEffect, useRef } from 'react';
import { View, Text, Button, StyleSheet, ScrollView, Alert, Linking, ActivityIndicator } from 'react-native';
import * as Location from 'expo-location';
import * as FileSystem from 'expo-file-system/legacy';
import { useRouter } from 'expo-router';
import { useStore, selectIsSetupComplete } from '../../src/store/useStore';
import { CONFIG } from '../../src/config';
import { fetchOverpass, normalizeElements } from '../../src/osm/overpass';
import { saveAreaCache, loadAreaCache, clearAreaCache } from '../../src/osm/cache';
import { buildSampleArea } from '../../src/osm/sample';

export default function SetupScreen() {
  const router = useRouter();
  const hasHydrated = useStore((state) => state.hasHydrated);
  const modelReady = useStore((state) => state.modelReady);
  const setModelReady = useStore((state) => state.setModelReady);
  const area = useStore((state) => state.area);
  const setArea = useStore((state) => state.setArea);
  const clearArea = useStore((state) => state.clearArea);
  const isSetupComplete = useStore(selectIsSetupComplete);

  // Step 1: Location
  const [locStatus, setLocStatus] = useState('Not started');
  const [locGranted, setLocGranted] = useState(false);

  // Step 2: Model
  const [modelStatus, setModelStatus] = useState('Not started');
  const [modelProgress, setModelProgress] = useState(null); // { percent, mb }
  const downloadResumableRef = useRef(null);

  // Step 3: Area
  const [areaStatus, setAreaStatus] = useState('Not started');

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
      } else {
        setModelReady(false);
        setModelStatus('Not started');
      }
    } catch (e) {
      setModelReady(false);
      setModelStatus('Not started');
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

  // NETWORK: setup only
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
      try {
        await downloadResumableRef.current.cancelAsync();
      } catch (e) {}
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
  };

  const fetchLocationWithTimeout = async () => {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error('Location request timed out (15s)'));
      }, 15000);
      Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced })
        .then((loc) => {
          clearTimeout(timer);
          resolve(loc);
        })
        .catch((e) => {
          clearTimeout(timer);
          reject(e);
        });
    });
  };

  // NETWORK: setup only
  const cacheArea = async () => {
    if (!locGranted) {
      setAreaStatus('Failed: Need location permission');
      return;
    }
    setAreaStatus('In progress');
    try {
      const loc = await fetchLocationWithTimeout();
      const lat = loc.coords.latitude;
      const lon = loc.coords.longitude;

      const rawElements = await fetchOverpass(lat, lon, CONFIG.AREA.radiusMeters);
      const normalized = normalizeElements(rawElements, lat, lon);
      
      const breakdown = {};
      normalized.forEach(el => {
        breakdown[el.category] = (breakdown[el.category] || 0) + 1;
      });

      const meta = {
        center: { lat, lon },
        radius: CONFIG.AREA.radiusMeters,
        fetchedAt: Date.now(),
        count: normalized.length,
        breakdown,
        source: 'overpass'
      };

      await saveAreaCache(meta, normalized);
      setArea(meta);
      setAreaStatus('Done');
    } catch (e) {
      setAreaStatus(`Failed: ${e.message}`);
    }
  };

  const useSampleData = async () => {
    if (!locGranted) {
      setAreaStatus('Failed: Need location permission');
      return;
    }
    setAreaStatus('In progress');
    try {
      const loc = await fetchLocationWithTimeout();
      const lat = loc.coords.latitude;
      const lon = loc.coords.longitude;

      const normalized = buildSampleArea(lat, lon);
      const breakdown = {};
      normalized.forEach(el => {
        breakdown[el.category] = (breakdown[el.category] || 0) + 1;
      });

      const meta = {
        center: { lat, lon },
        radius: CONFIG.AREA.radiusMeters,
        fetchedAt: Date.now(),
        count: normalized.length,
        breakdown,
        source: 'sample'
      };

      await saveAreaCache(meta, normalized);
      setArea(meta);
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

  if (!hasHydrated) return null;

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.card}>
        <Text style={styles.stepTitle}>Step 1: Location</Text>
        <Text style={styles.statusLine}>Status: {locStatus}</Text>
        {!locGranted ? (
          <>
            <Button title="Grant Location Permission" onPress={requestLocation} />
            {locStatus.startsWith('Failed') && (
              <Button title="Open Settings" onPress={() => Linking.openSettings()} color="#d9534f" />
            )}
          </>
        ) : null}
      </View>

      <View style={styles.card}>
        <Text style={styles.stepTitle}>Step 2: AI Model</Text>
        <Text style={styles.statusLine}>Status: {modelStatus}</Text>
        
        {!modelReady && modelStatus !== 'In progress' && (
          <Button title="Download AI model (about 350 MB, use Wi-Fi)" onPress={downloadModel} />
        )}
        
        {modelStatus === 'In progress' && (
          <View style={{ marginVertical: 10 }}>
            {modelProgress && (
              <Text style={{ textAlign: 'center', marginBottom: 5 }}>
                {(modelProgress.percent * 100).toFixed(1)}% ({modelProgress.mb} MB)
              </Text>
            )}
            <Button title="Cancel Download" onPress={cancelDownload} color="#d9534f" />
          </View>
        )}

        {modelReady && (
          <View style={{ marginTop: 10 }}>
            <Button title="Open inference test" onPress={() => router.push('/debug')} color="#5bc0de" />
            <View style={{ height: 10 }} />
            <Button title="Delete model" onPress={deleteModel} color="#d9534f" />
          </View>
        )}
      </View>

      <View style={styles.card}>
        <Text style={styles.stepTitle}>Step 3: Map Area</Text>
        <Text style={styles.statusLine}>Status: {areaStatus}</Text>
        
        {area ? (
          <View style={{ marginTop: 10 }}>
            <Text>Elements found: {area.count}</Text>
            {area.breakdown && (
              <Text style={{ fontSize: 12, color: '#666', marginTop: 5 }}>
                {Object.entries(area.breakdown).map(([k, v]) => `${k} ${v}`).join(', ')}
              </Text>
            )}
            {area.count < 5 && area.source !== 'sample' && (
              <View style={{ marginVertical: 10 }}>
                <Text style={{ color: '#d9534f', fontWeight: 'bold' }}>Warning: Too few elements found. Missions may be limited.</Text>
                <View style={{ height: 10 }} />
                <Button title="Use sample data instead" onPress={useSampleData} color="#f0ad4e" />
              </View>
            )}
            {area.source === 'sample' && (
              <Text style={styles.sampleLabel}>Using SAMPLE data</Text>
            )}
            <View style={{ height: 10 }} />
            <Button title="Clear area cache" onPress={clearMyArea} color="#d9534f" />
          </View>
        ) : (
          <View>
            <Button title="Cache my area (1.5 km)" onPress={cacheArea} disabled={modelStatus === 'In progress'} />
            <View style={{ height: 10 }} />
            <Button title="Use sample data instead" onPress={useSampleData} color="#f0ad4e" disabled={modelStatus === 'In progress'} />
          </View>
        )}
      </View>

      {isSetupComplete && (
        <View style={styles.readyFooter}>
          <Text style={styles.readyText}>Ready to Touch Grass!</Text>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20 },
  card: {
    backgroundColor: '#ffffff',
    padding: 15,
    borderRadius: 8,
    marginBottom: 20,
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: 1 }
  },
  stepTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 5 },
  statusLine: { fontSize: 14, color: '#555', marginBottom: 15 },
  sampleLabel: { color: '#d9534f', fontWeight: 'bold', marginTop: 5 },
  readyFooter: { alignItems: 'center', marginVertical: 30 },
  readyText: { fontSize: 24, fontWeight: 'bold', color: '#5cb85c' }
});

import { Platform } from 'react-native';
import * as Location from 'expo-location';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { haversineMeters } from '../utils/geo.js';
import { CONFIG } from '../config.js';
import { radiusByCategory } from '../missions/describe.js';
import { useStore } from '../store/useStore.js';
import { logEvent } from '../utils/eventLog.js';

export { radiusByCategory };

export async function getOriginFix() {
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') return null;
    const location = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
    return { lat: location.coords.latitude, lon: location.coords.longitude };
  } catch(e) {
    return null;
  }
}

export async function checkinLocation(targetLat, targetLon, category) {
  const { status, canAskAgain } = await Location.requestForegroundPermissionsAsync();
  if (status !== 'granted') {
    return { success: false, reason: 'Location permission denied', errorType: canAskAgain ? 'PERMISSION_DENIED_TEMP' : 'PERMISSION_DENIED' };
  }
  
  const servicesEnabled = await Location.hasServicesEnabledAsync();
  if (!servicesEnabled) {
    return { success: false, reason: 'Turn on location', errorType: 'LOCATION_OFF' };
  }
  
  let location;
  try {
    location = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.High
    });
  } catch(e) {
    return { success: false, reason: 'Failed to get location' };
  }
  
  if (location.mocked) {
    return { success: false, reason: 'Mocked locations are not allowed' };
  }
  
  if (location.coords.accuracy > CONFIG.CHECKIN.maxAccuracyMeters) {
    return { success: false, reason: `GPS accuracy too low (${Math.round(location.coords.accuracy)}m > ${CONFIG.CHECKIN.maxAccuracyMeters}m)` };
  }
  
  const dist = haversineMeters(targetLat, targetLon, location.coords.latitude, location.coords.longitude);
  const radius = radiusByCategory(category);
  
  if (dist <= radius) {
    return { success: true, distance: dist };
  } else {
    return { success: false, reason: `You are ${Math.round(dist)} m away. Get within ${radius} m of the place.`, distance: dist };
  }
}

// ---------------- Pending Proof File & Id Helpers ----------------
export function sanitizeProofId(id) {
  return String(id || '').replace(/[^a-zA-Z0-9_-]/g, '_');
}

export function getPendingProofPath(id) {
  return `${FileSystem.documentDirectory}pendingProof_${sanitizeProofId(id)}.json`;
}

export async function savePendingProof(id, data) {
  try {
    const path = getPendingProofPath(id);
    await FileSystem.writeAsStringAsync(path, JSON.stringify(data));
    logEvent('camera', 'pendingProof write ok', { id, path, data });
    return true;
  } catch (e) {
    logEvent('camera', 'pendingProof write failed', { id, error: e.message });
    return false;
  }
}

export async function readPendingProof(id) {
  try {
    const path = getPendingProofPath(id);
    const info = await FileSystem.getInfoAsync(path);
    if (info.exists) {
      const content = await FileSystem.readAsStringAsync(path);
      return JSON.parse(content);
    }
  } catch (e) {
    logEvent('camera', 'readPendingProof error', { id, error: e.message });
  }
  return null;
}

export async function clearPendingProof(id) {
  try {
    const path = getPendingProofPath(id);
    await FileSystem.deleteAsync(path, { idempotent: true });
    logEvent('camera', 'pendingProof cleared', { id });
  } catch (e) {
    logEvent('camera', 'clearPendingProof error', { id, error: e.message });
  }
}

export async function getAllPendingProofFiles() {
  try {
    const docDir = FileSystem.documentDirectory;
    const files = await FileSystem.readDirectoryAsync(docDir);
    const matching = files.filter(f => f.startsWith('pendingProof_') && f.endsWith('.json'));
    const results = [];
    for (const f of matching) {
      try {
        const fullPath = `${docDir}${f}`;
        const content = await FileSystem.readAsStringAsync(fullPath);
        const parsed = JSON.parse(content);
        const rawId = f.replace(/^pendingProof_/, '').replace(/\.json$/, '');
        results.push({ id: parsed.missionId || rawId, path: fullPath, data: parsed });
      } catch (err) {}
    }
    return results;
  } catch (e) {
    return [];
  }
}

// ---------------- Camera Launch & Pending Result Check ----------------
export async function takeProofPhoto(customOptions = {}) {
  logEvent('camera', 'permission request start');
  const permResponse = await ImagePicker.requestCameraPermissionsAsync();
  logEvent('camera', 'permission result', {
    status: permResponse.status,
    granted: permResponse.granted,
    canAskAgain: permResponse.canAskAgain
  });
  
  if (permResponse.status !== 'granted') {
    return {
      success: false,
      errorType: permResponse.canAskAgain ? 'PERMISSION_DENIED_TEMP' : 'PERMISSION_DENIED',
      reason: 'Camera permission denied',
      permResponse
    };
  }

  const cameraExif = customOptions.exif !== undefined ? customOptions.exif : (useStore.getState().cameraExif ?? true);
  const options = {
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    allowsEditing: false,
    quality: 0.5,
    exif: cameraExif,
    ...customOptions
  };

  logEvent('camera', 'launchCameraAsync called', {
    quality: options.quality,
    allowsEditing: options.allowsEditing,
    exif: options.exif
  });

  const result = await ImagePicker.launchCameraAsync(options);

  logEvent('camera', 'launchCameraAsync returned', {
    canceled: result.canceled,
    assetCount: result.assets ? result.assets.length : 0,
    uri: result.assets?.[0]?.uri,
    size: result.assets?.[0]?.fileSize,
    exifKeys: result.assets?.[0]?.exif ? Object.keys(result.assets[0].exif) : []
  });

  return { success: !result.canceled, result };
}

export async function checkPendingCameraResult() {
  if (Platform.OS !== 'android') return null;
  logEvent('camera', 'getPendingResultAsync start');
  try {
    const res = await ImagePicker.getPendingResultAsync();
    logEvent('camera', 'getPendingResultAsync result', {
      isNull: res === null,
      isError: res && 'code' in res,
      canceled: res?.canceled,
      assetCount: res?.assets?.length
    });
    return res;
  } catch (e) {
    logEvent('camera', 'getPendingResultAsync error', { error: e.message });
    return null;
  }
}

import * as FileSystem from 'expo-file-system/legacy';

const CACHE_FILE = 'osm_area.json';

export const getCacheUri = () => `${FileSystem.documentDirectory}${CACHE_FILE}`;

export async function saveAreaCache(meta, elements) {
  const uri = getCacheUri();
  const data = JSON.stringify({ meta, elements });
  await FileSystem.writeAsStringAsync(uri, data);
}

export async function loadAreaCache() {
  const uri = getCacheUri();
  try {
    const info = await FileSystem.getInfoAsync(uri);
    if (!info.exists) return null;
    
    const data = await FileSystem.readAsStringAsync(uri);
    const parsed = JSON.parse(data);
    
    if (!parsed.meta || !parsed.elements) {
      await FileSystem.deleteAsync(uri, { idempotent: true });
      return null;
    }
    return parsed;
  } catch (e) {
    console.warn('loadAreaCache error, deleting file', e);
    await FileSystem.deleteAsync(uri, { idempotent: true });
    return null;
  }
}

export async function clearAreaCache() {
  const uri = getCacheUri();
  await FileSystem.deleteAsync(uri, { idempotent: true });
}

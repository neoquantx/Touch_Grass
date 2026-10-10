import * as Location from 'expo-location';
import { haversineMeters } from '../utils/geo.js';
import { CONFIG } from '../config.js';


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

import { radiusByCategory } from '../missions/describe.js';
export { radiusByCategory };

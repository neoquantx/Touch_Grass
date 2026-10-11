export function haversineMeters(lat1, lon1, lat2, lon2) {
  const R = 6371e3; // metres
  const φ1 = lat1 * Math.PI / 180;
  const φ2 = lat2 * Math.PI / 180;
  const Δφ = (lat2 - lat1) * Math.PI / 180;
  const Δλ = (lon2 - lon1) * Math.PI / 180;

  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

export function offsetLatLon(lat, lon, dxMeters, dyMeters) {
  const mPerDegLat = 111320;
  const mPerDegLon = 111320 * Math.cos(lat * Math.PI / 180);

  const newLat = lat + dyMeters / mPerDegLat;
  const newLon = lon + dxMeters / mPerDegLon;

  return { lat: newLat, lon: newLon };
}

export function calculateBearing(lat1, lon1, lat2, lon2) {
  if (lat1 === undefined || lon1 === undefined || lat2 === undefined || lon2 === undefined) {
    return null;
  }
  const φ1 = lat1 * Math.PI / 180;
  const φ2 = lat2 * Math.PI / 180;
  const Δλ = (lon2 - lon1) * Math.PI / 180;

  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  const θ = Math.atan2(y, x);
  const degrees = (θ * 180 / Math.PI + 360) % 360;

  const directions = [
    { label: 'N', arrow: '↑' },
    { label: 'NE', arrow: '↗' },
    { label: 'E', arrow: '→' },
    { label: 'SE', arrow: '↘' },
    { label: 'S', arrow: '↓' },
    { label: 'SW', arrow: '↙' },
    { label: 'W', arrow: '←' },
    { label: 'NW', arrow: '↖' }
  ];
  const index = Math.round(degrees / 45) % 8;
  const dir = directions[index];

  return {
    degrees: Math.round(degrees),
    cardinal: dir.label,
    arrow: dir.arrow,
    text: `${dir.label} ${dir.arrow}`
  };
}

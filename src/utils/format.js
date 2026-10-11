export function formatDistance(m) {
  if (m === null || m === undefined || isNaN(m)) return '0 m';
  const val = Math.max(0, Number(m));
  if (val < 1000) {
    return `${Math.round(val)} m`;
  }
  const km = val / 1000;
  // If integer km, e.g. 3000 m -> "3 km", otherwise "1.2 km"
  const formatted = km >= 100 ? Math.round(km).toString() : Number(km.toFixed(1)).toString();
  return `${formatted} km`;
}

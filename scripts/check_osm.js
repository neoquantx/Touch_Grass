import { haversineMeters, offsetLatLon } from '../src/utils/geo.js';
import { normalizeElements } from '../src/osm/overpass.js';

console.log('--- Testing haversineMeters ---');
// New York to London
const d = haversineMeters(40.7128, -74.0060, 51.5074, -0.1278);
console.log(`NY to London: ${d.toFixed(0)} meters. Expected: ~5570000 m.`);

console.log('\n--- Testing offsetLatLon ---');
const center = { lat: 48.8566, lon: 2.3522 }; // Paris
const dx = 500;
const dy = -300;
const offset = offsetLatLon(center.lat, center.lon, dx, dy);
const dist = haversineMeters(center.lat, center.lon, offset.lat, offset.lon);
const expectedDist = Math.sqrt(dx * dx + dy * dy);
const error = Math.abs(dist - expectedDist) / expectedDist;
console.log(`Offset dx=${dx}, dy=${dy} from Paris. Distance is ${dist.toFixed(2)} m. Expected: ~${expectedDist.toFixed(2)} m.`);
console.log(`Error is ${(error * 100).toFixed(4)}%. (Must be < 1%)`);

console.log('\n--- Testing normalizeElements ---');
const rawElements = [
  { type: 'way', id: '1', center: { lat: 48.857, lon: 2.353 }, tags: { leisure: 'park', name: 'Valid Park' } },
  { type: 'node', id: '2', lat: 48.858, lon: 2.354, tags: { historic: 'monument', name: 'Old statue' } },
  { type: 'way', id: '3', center: { lat: 48.859, lon: 2.355 }, tags: { leisure: 'park' } }, // unnamed, must drop
  { type: 'way', id: '1', center: { lat: 48.857, lon: 2.353 }, tags: { leisure: 'park', name: 'Valid Park' } }, // duplicate, must drop
];

const normalized = normalizeElements(rawElements, center.lat, center.lon);
console.log(`Normalized elements: ${normalized.length}. Expected: 2.`);
normalized.forEach(el => {
  console.log(`- [${el.category}] ${el.name || 'unnamed'} (ID: ${el.id}) at distance ${el.distanceMeters.toFixed(1)}m`);
});

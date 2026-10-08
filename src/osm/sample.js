import sampleData from '../data/sample_osm.json';
import { offsetLatLon } from '../utils/geo.js';
import { normalizeElements } from './overpass.js';

export function buildSampleArea(centerLat, centerLon) {
  const rawElements = sampleData.map(item => {
    const { lat, lon } = offsetLatLon(centerLat, centerLon, item.dxMeters, item.dyMeters);
    const parts = item.id.split('/');
    const type = parts[0];
    const id = parts[1];
    
    if (type === 'node') {
      return { type, id, lat, lon, tags: item.tags };
    } else {
      return { type, id, center: { lat, lon }, tags: item.tags };
    }
  });

  return normalizeElements(rawElements, centerLat, centerLon);
}

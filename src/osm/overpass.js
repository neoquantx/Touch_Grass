import { CONFIG } from '../config.js';
import { haversineMeters } from '../utils/geo.js';

export function buildQuery(lat, lon, radius) {
  return `[out:json][timeout:25];
(
  nwr["leisure"~"^(park|garden)$"](around:${radius},${lat},${lon});
  nwr["landuse"~"^(forest|grass)$"](around:${radius},${lat},${lon});
  nwr["natural"~"^(wood|water)$"](around:${radius},${lat},${lon});
  node["natural"="tree"]["name"](around:${radius},${lat},${lon});
  node["natural"="tree"]["species"](around:${radius},${lat},${lon});
  nwr["historic"](around:${radius},${lat},${lon});
  nwr["tourism"~"^(viewpoint|artwork)$"](around:${radius},${lat},${lon});
  node["amenity"="drinking_water"](around:${radius},${lat},${lon});
);
out center tags;`;
}

// NETWORK: setup only
export async function fetchOverpass(lat, lon, radius) {
  const query = buildQuery(lat, lon, radius);
  const body = `data=${encodeURIComponent(query)}`;
  
  let lastError = null;
  
  for (const endpoint of CONFIG.AREA.overpassEndpoints) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), CONFIG.AREA.timeoutMs);
    
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body,
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      
      const json = await response.json();
      if (!json.elements) {
        throw new Error('Invalid JSON: missing elements array');
      }
      
      return json.elements;
    } catch (e) {
      clearTimeout(timeoutId);
      lastError = `${endpoint} failed: ${e.message}`;
      // Continue to next endpoint
    }
  }
  
  throw new Error(`All Overpass endpoints failed. Last error: ${lastError}`);
}

export function normalizeElements(rawElements, centerLat, centerLon) {
  const categoriesMap = {
    park: 'park',
    garden: 'garden',
    forest: 'forest',
    grass: 'grass',
    wood: 'wood',
    water: 'water',
    historic: 'historic',
    viewpoint: 'viewpoint',
    artwork: 'artwork',
    tree: 'tree',
    drinking_water: 'drinking_water'
  };

  const areaCategories = new Set(['park', 'garden', 'forest', 'grass', 'wood', 'water']);

  const seen = new Set();
  const normalized = [];

  for (const el of rawElements) {
    const id = `${el.type}/${el.id}`;
    if (seen.has(id)) continue;
    
    let lat, lon;
    if (el.type === 'node') {
      lat = el.lat;
      lon = el.lon;
    } else {
      lat = el.center?.lat;
      lon = el.center?.lon;
    }

    if (lat == null || lon == null) continue;

    const tags = el.tags || {};
    const name = tags.name || tags['name:en'] || null;

    let category = null;
    if (tags.leisure && categoriesMap[tags.leisure]) category = categoriesMap[tags.leisure];
    else if (tags.landuse && categoriesMap[tags.landuse]) category = categoriesMap[tags.landuse];
    else if (tags.natural && categoriesMap[tags.natural]) category = categoriesMap[tags.natural];
    else if (tags.historic) category = 'historic';
    else if (tags.tourism && categoriesMap[tags.tourism]) category = categoriesMap[tags.tourism];
    else if (tags.amenity === 'drinking_water') category = 'drinking_water';

    if (!category) continue;

    // Area categories REQUIRE a name
    if (areaCategories.has(category) && !name) continue;

    seen.add(id);

    const distanceMeters = haversineMeters(centerLat, centerLon, lat, lon);

    normalized.push({
      id,
      lat,
      lon,
      name,
      category,
      tags,
      distanceMeters
    });
  }

  normalized.sort((a, b) => a.distanceMeters - b.distanceMeters);
  return normalized.slice(0, CONFIG.AREA.maxElements);
}

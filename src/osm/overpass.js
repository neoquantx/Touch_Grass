import { CONFIG } from '../config.js';
import { haversineMeters } from '../utils/geo.js';

export function buildQuery(lat, lon, radius, level = 'full') {
  if (level === 'light') {
    const r = 700;
    return `[out:json][timeout:25][maxsize:33554432];
(
  nw["leisure"~"^(park|garden)$"]["name"](around:${r},${lat},${lon});
  nw["natural"="water"]["name"](around:${r},${lat},${lon});
  nw["historic"]["name"](around:${r},${lat},${lon});
  nw["tourism"~"^(viewpoint|artwork)$"](around:${r},${lat},${lon});
  node["amenity"="drinking_water"](around:${r},${lat},${lon});
);
out center tags qt;`;
  }

  // full
  return `[out:json][timeout:25][maxsize:33554432];
(
  nw["leisure"~"^(park|garden)$"]["name"](around:${radius},${lat},${lon});
  nw["landuse"="forest"]["name"](around:${radius},${lat},${lon});
  nw["natural"~"^(wood|water)$"]["name"](around:${radius},${lat},${lon});
  node["natural"="tree"]["name"](around:${radius},${lat},${lon});
  node["natural"="tree"]["species"](around:${radius},${lat},${lon});
  nw["historic"]["name"](around:${radius},${lat},${lon});
  nw["tourism"~"^(viewpoint|artwork)$"](around:${radius},${lat},${lon});
  node["amenity"="drinking_water"](around:${radius},${lat},${lon});
);
out center tags qt;`;
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

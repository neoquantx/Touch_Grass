import { CONFIG } from '../config.js';

export function describeTags(tags) {
  if (!tags) return [];
  const skip = ['name', 'name:en'];
  const lines = [];
  for (const [k, v] of Object.entries(tags)) {
    if (!skip.includes(k)) {
      lines.push(`${k}: ${v}`);
    }
  }
  return lines;
}

export const CATEGORY_LABELS = {
  park: 'A park',
  garden: 'A garden',
  forest: 'A forest',
  grass: 'A grassy area',
  wood: 'A wood',
  water: 'Water',
  historic: 'An old landmark',
  viewpoint: 'A viewpoint',
  artwork: 'A public artwork',
  tree: 'A tree',
  drinking_water: 'Drinking water'
};

export function radiusByCategory(category) {
  if (['park', 'garden', 'forest', 'wood'].includes(category)) {
    return 150; // larger areas
  }
  if (['water'].includes(category)) {
    return 100;
  }
  return CONFIG.CHECKIN.radiusMeters;
}

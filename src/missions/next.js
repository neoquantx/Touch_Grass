import { CATEGORY_LABELS, radiusByCategory } from './describe.js';
import { LOOK_PROMPTS, shuffleArray, selectGoElement, selectLearnElement } from './generate.js';
import { haversineMeters } from '../utils/geo.js';
import { normalizeDateStr } from '../utils/date.js';

export function nextMission({ dateStr, type, seq, origin, elements, visitedIds, activeTargetIds, skippedIds, usedLookPrompts, doneCounts, cfg }) {
  const normDateStr = normalizeDateStr(dateStr);
  const id = `${normDateStr}:${type}:${seq}`;
  
  if (doneCounts && doneCounts[type] >= cfg.dailyCap[type]) {
    return {
      id, type, status: 'unavailable',
      reason: `Daily limit reached for ${type} missions. Come back tomorrow.`
    };
  }
  
  let seed = 0;
  for (let i = 0; i < id.length; i++) {
    seed = (seed << 5) - seed + id.charCodeAt(i);
    seed |= 0;
  }
  
  if (type === 'LOOK') {
    let availablePrompts = (LOOK_PROMPTS || []).filter(p => !usedLookPrompts.includes(p));
    if (availablePrompts.length === 0) {
      availablePrompts = LOOK_PROMPTS; // reset
    }
    const prompt = availablePrompts[Math.abs(seed) % availablePrompts.length];
    const description = "Take a photo of it as proof. Any place outdoors works.";
    return {
      id, type, prompt, elementId: null, element: null, target: null,
      status: 'available', date: normDateStr, title: `Find: ${prompt}`,
      description, flavor: description
    };
  }
  
  const excludeIds = [...(visitedIds || []), ...(activeTargetIds || []), ...(skippedIds || [])];
  
  // Update distances from origin if available
  const elementsWithDist = (elements || []).map(e => {
    if (origin && e.lat !== undefined && e.lon !== undefined) {
      return { ...e, distanceMeters: haversineMeters(origin.lat, origin.lon, e.lat, e.lon) };
    }
    return e;
  });
  
  const pool = elementsWithDist.filter(e => !excludeIds.includes(e.id));
  
  if (pool.length === 0) {
    return { id, type, status: 'unavailable', reason: "No new places nearby. Re-cache your area in Setup." };
  }
  
  const shuffled = shuffleArray(pool, seed);
  let el = null;
  
  if (type === 'GO') {
    el = selectGoElement(shuffled);
    if (!el) {
      return { id, type, status: 'unavailable', reason: "No suitable park or green space found nearby." };
    }
    const name = el.name || el.tags?.name;
    const title = name ? `Walk to ${name}` : `Walk to ${CATEGORY_LABELS[el.category] || 'a park'}`;
    const label = CATEGORY_LABELS[el.category] || 'A park';
    const n = Math.round(el.distanceMeters || 0);
    const r = radiusByCategory(el.category);
    const description = `${label}, about ${n} m away. Check in within ${r} m.`;
    
    return { 
      id, type, elementId: el.id, element: el, status: 'available', 
      date: normDateStr, title, description, flavor: description
    };
  }
  
  if (type === 'LEARN') {
    el = selectLearnElement(shuffled, null);
    if (!el) {
      return { id, type, status: 'unavailable', reason: "No historic place or noteworthy tree found nearby." };
    }
    const name = el.name || el.tags?.name;
    const species = el.tags?.species;
    const title = name || (species ? `${species} tree` : CATEGORY_LABELS[el.category]) || 'A place';
    const label = CATEGORY_LABELS[el.category] || 'A place';
    const n = Math.round(el.distanceMeters || 0);
    const description = `${label}, about ${n} m away. Check in, take a photo, then read what the map says.`;
    
    return { 
      id, type, elementId: el.id, element: el, status: 'available', 
      date: normDateStr, title, description, flavor: description
    };
  }
}

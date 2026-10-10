import { CATEGORY_LABELS, radiusByCategory } from './describe.js';
import { LOOK_PROMPTS, shuffleArray, selectGoElement, selectLearnElement } from './generate.js';

export function nextMission({ dateStr, type, seq, origin, elements, visitedIds, activeTargetIds, skippedIds, usedLookPrompts, doneCounts, cfg }) {
  const id = `${dateStr}:${type}:${seq}`;
  
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
    let availablePrompts = LOOK_PROMPTS.filter(p => !usedLookPrompts.includes(p));
    if (availablePrompts.length === 0) {
      availablePrompts = LOOK_PROMPTS; // reset
    }
    const prompt = availablePrompts[Math.abs(seed) % availablePrompts.length];
    const description = "Take a photo of it as proof. Any place outdoors works.";
    return {
      id, type, prompt, elementId: null, element: null, target: null,
      status: 'available', date: dateStr, title: `Find: ${prompt}`,
      description, flavor: description
    };
  }
  
  const excludeIds = [...(visitedIds || []), ...(activeTargetIds || []), ...(skippedIds || [])];
  const pool = (elements || []).filter(e => !excludeIds.includes(e.id));
  
  if (pool.length === 0) {
    return { id, type, status: 'unavailable', reason: "No new places nearby. Re-cache your area in Setup." };
  }
  
  const shuffled = shuffleArray(pool, seed);
  let el = null;
  
  if (type === 'GO') {
    el = selectGoElement(shuffled);
    const name = el.name || el.tags?.name;
    const title = name ? `Walk to ${name}` : `Walk to ${CATEGORY_LABELS[el.category] || 'a park'}`;
    const label = CATEGORY_LABELS[el.category] || 'A park';
    const n = Math.round(el.distanceMeters || 0);
    const r = radiusByCategory(el.category);
    const description = `${label}, about ${n} m away. Check in within ${r} m.`;
    
    return { 
      id, type, elementId: el.id, element: el, status: 'available', 
      date: dateStr, title, description, flavor: description
    };
  }
  
  if (type === 'LEARN') {
    el = selectLearnElement(shuffled, null);
    const name = el.name || el.tags?.name;
    const species = el.tags?.species;
    const title = name || (species ? `${species} tree` : CATEGORY_LABELS[el.category]) || 'A place';
    const label = CATEGORY_LABELS[el.category] || 'A place';
    const n = Math.round(el.distanceMeters || 0);
    const description = `${label}, about ${n} m away. Check in, take a photo, then read what the map says.`;
    
    return { 
      id, type, elementId: el.id, element: el, status: 'available', 
      date: dateStr, title, description, flavor: description
    };
  }
}

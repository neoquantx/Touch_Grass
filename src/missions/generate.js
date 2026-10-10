export function seededRandom(seed) {
  let x = Math.sin(seed++) * 10000;
  return x - Math.floor(x);
}

export function shuffleArray(array, seed) {
  let m = array.length, t, i;
  let currentSeed = seed;
  const result = [...array];
  while (m) {
    i = Math.floor(seededRandom(currentSeed++) * m--);
    t = result[m];
    result[m] = result[i];
    result[i] = t;
  }
  return result;
}


import { CATEGORY_LABELS, radiusByCategory } from './describe.js';
import { FEATURES } from '../config.js';
export const MISSION_GEN_VERSION = 1;

export const LOOK_PROMPTS = [
  "a yellow flower",
  "a textured leaf",
  "a bird",
  "an interesting shadow",
  "a patch of moss",
  "a funny shaped rock",
  "something colorful",
  "a cloud that looks like an animal",
  "an insect"
];

export function selectGoElement(shuffled) {
  let goEl = null;
  for (const d of [ {min: 100, max: 1500}, {min: 0, max: 2000}, {min: 0, max: 99999} ]) {
    goEl = shuffled.find(e => 
      (e.category === 'park' || e.category === 'garden' || e.category === 'forest') && 
      e.distanceMeters >= d.min && e.distanceMeters <= d.max
    );
    if (goEl) break;
  }
  return goEl || shuffled[0];
}

export function selectLearnElement(shuffled, excludeId) {
  return shuffled.find(e => e.id !== excludeId && e.id !== null && (e.category === 'historic' || e.category === 'tree')) || 
         shuffled.find(e => e.id !== excludeId && e.id !== null) || shuffled[0];
}

export function generateMissions(elements, visitedIds = [], currentDateStr = '') {
  if (!elements || elements.length === 0) return [];
  
  if (!currentDateStr) {
    const today = new Date();
    currentDateStr = `${today.getFullYear()}-${today.getMonth() + 1}-${today.getDate()}`;
  }
  
  // Create a seed from date string
  let seed = 0;
  for (let i = 0; i < currentDateStr.length; i++) {
    seed = (seed << 5) - seed + currentDateStr.charCodeAt(i);
    seed |= 0;
  }
  
  const unvisited = elements.filter(e => !visitedIds.includes(e.id));
  const pool = unvisited.length >= 3 ? unvisited : elements;
  
  const shuffled = shuffleArray(pool, seed);
  
  const goEl = selectGoElement(shuffled);
  const learnEl = selectLearnElement(shuffled, goEl?.id);
  
  
  const missions = [];
  
  if (goEl) {
    const name = goEl.name || goEl.tags?.name;
    const title = name ? `Walk to ${name}` : `Walk to ${CATEGORY_LABELS[goEl.category] || 'a park'}`;
    const label = CATEGORY_LABELS[goEl.category] || 'A park';
    const n = Math.round(goEl.distanceMeters || 0);
    const r = radiusByCategory(goEl.category);
    const description = `${label}, about ${n} m away. Check in within ${r} m.`;
    missions.push({ 
      id: `GO-${currentDateStr}-${goEl.id}`, 
      type: 'GO', 
      elementId: goEl.id, 
      element: goEl, 
      status: 'available', 
      date: currentDateStr, 
      title,
      description,
      flavor: FEATURES.missionFlavor ? null : description
    });
  }
  
  const prompt = LOOK_PROMPTS[seed % LOOK_PROMPTS.length];
  const lookDescription = "Take a photo of it as proof. Any place outdoors works.";
  missions.push({ 
    id: `LOOK-${currentDateStr}-prompt`, 
    type: 'LOOK', 
    prompt, 
    elementId: null, 
    element: null, 
    target: null,
    status: 'available', 
    date: currentDateStr, 
    title: `Find: ${prompt}`, 
    description: lookDescription,
    flavor: lookDescription
  });
  
  if (learnEl) {
    const name = learnEl.name || learnEl.tags?.name;
    const species = learnEl.tags?.species;
    const title = name || (species ? `${species} tree` : CATEGORY_LABELS[learnEl.category]) || 'A place';
    const label = CATEGORY_LABELS[learnEl.category] || 'A place';
    const n = Math.round(learnEl.distanceMeters || 0);
    const description = `${label}, about ${n} m away. Check in, take a photo, then read what the map says.`;
    missions.push({ 
      id: `LEARN-${currentDateStr}-${learnEl.id}`, 
      type: 'LEARN', 
      elementId: learnEl.id, 
      element: learnEl, 
      status: 'available', 
      date: currentDateStr, 
      title,
      description,
      flavor: FEATURES.missionFlavor ? null : description
    });
  }

  
  return missions;
}

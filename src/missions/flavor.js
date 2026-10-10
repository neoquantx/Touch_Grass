import { FEATURES, CONFIG } from '../config.js';
import { CATEGORY_LABELS, radiusByCategory } from './describe.js';
import { runExclusive, cancelCurrentJob } from '../llm/queue.js';
import { generate } from '../llm/llm.js';
import { useStore } from '../store/useStore.js';


export async function generateFlavorText(mission) {
  if (!mission || !mission.element || mission.type === 'LOOK') {
    return;
  }
  const { element } = mission;
  
  if (!FEATURES.missionFlavor) {
    const label = CATEGORY_LABELS[element.category] || 'A place';
    const n = Math.round(element.distanceMeters || 0);
    const r = radiusByCategory(element.category);
    let text = '';
    if (mission.type === 'GO') {
      text = `${label}, about ${n} m away. Check in within ${r} m.`;
    } else if (mission.type === 'LEARN') {
      text = `${label}, about ${n} m away. Check in, take a photo, then read what the map says.`;
    }
    if (text) {
      useStore.getState().setMissionFlavor(mission.id, text);
    }
    return;
  }

  const prompt = `Write a short 1-2 sentence invitation to visit this place. Use only the provided place name, type and distance. Do not add facts.\nPlace: ${element.name || 'Unnamed'}\nType: ${element.category}\nDistance: ${Math.round(element.distanceMeters || 0)}m`;
  
  let text = '';
  try {
    await runExclusive(async (flag) => {
      let timedOut = false;
      const timer = setTimeout(() => {
        timedOut = true;
        cancelCurrentJob();
      }, 8000);
      
      try {
        const res = await generate({
          messages: [{ role: 'user', content: prompt }],
          maxTokens: 40,
          shouldStop: () => {
            flag.check();
            return false;
          }
        });
        text = res.text;
      } finally {
        clearTimeout(timer);
      }
    });
    
    if (text) {
      useStore.getState().setMissionFlavor(mission.id, text.trim());
    }
  } catch (e) {
    // Ignore error, keep template text
  }
}

export async function generateFactText(mission, tagLines) {
  const prompt = `Summarize these OpenStreetMap tags into max 3 sentences. Use ONLY the provided lines. If they contain no history or species, say what they do contain and that more is unknown.\n\nTags:\n${tagLines.join('\n')}`;
  
  let text = '';
  try {
    await runExclusive(async (flag) => {
      const res = await generate({
        messages: [{ role: 'user', content: prompt }],
        maxTokens: 100,
        shouldStop: () => {
          flag.check();
          return false;
        }
      });
      text = res.text;
    });
    return text.trim();
  } catch (e) {
    return null;
  }
}

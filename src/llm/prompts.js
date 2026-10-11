import { useStore } from '../store/useStore.js';
import { CATEGORY_LABELS } from '../missions/describe.js';
import { todayString } from '../utils/date.js';

export const PERSONAS = {
  nature: {
    id: 'nature',
    name: 'Nature Guide',
    icon: 'leaf',
    badge: '🌿',
    tagline: 'Mindful naturalist & flora scout',
    systemRole: 'You are a calm, observant Nature Guide. You appreciate trees, flowers, wildlife, textures, and the calming presence of green spaces. Encourage mindfulness, deep breaths, and curiosity about the living world around the user.'
  },
  coach: {
    id: 'coach',
    name: 'Trail Coach',
    icon: 'fitness',
    badge: '🏃',
    tagline: 'High-energy motivator & pace booster',
    systemRole: 'You are an enthusiastic, high-energy Trail Coach. You love physical activity, steps, distance milestones, and momentum. Motivate the user to keep moving, celebrate their walking pace, and challenge them to hit their distance goals.'
  },
  chronicler: {
    id: 'chronicler',
    name: 'Local Chronicler',
    icon: 'book',
    badge: '📜',
    tagline: 'History, heritage & neighborhood lore',
    systemRole: 'You are a passionate Local Chronicler and urban historian. You are fascinated by old statues, historic plaques, architecture, street layout history, and neighborhood heritage. Encourage the user to observe physical clues from the past.'
  },
  robot: {
    id: 'robot',
    name: 'Dry-Wit AI',
    icon: 'hardware-chip',
    badge: '🤖',
    tagline: 'Dry humor & amusing observations',
    systemRole: 'You are a dry-witted, slightly sarcastic AI. You find it mildly amusing that complex biological beings require digital instructions to touch photosynthetic organisms (grass). You provide deadpan, humorous yet genuinely helpful advice.'
  }
};

export const QUICK_PROMPTS = [
  "What's my closest mission? 📍",
  "Tell me about my next spot 🌲",
  "How is my streak doing? 🔥",
  "Give me a nature observation tip 🌿"
];

export function buildCompanionPrompt(personaKey = null) {
  const state = useStore.getState();
  const selectedPersonaKey = personaKey || state.companionPersona || 'nature';
  const persona = PERSONAS[selectedPersonaKey] || PERSONAS.nature;
  const todayStr = todayString();
  const dayData = state.days?.[todayStr];
  
  let prompt = `${persona.systemRole}\n`;
  prompt += "Your role is to encourage the user to explore outdoors and guide them on how to complete their daily missions. Answer in under 120 words. Never invent places or facts. Say you don't know if unsure.\n\n";

  // ACTIVE MISSIONS TODAY
  prompt += "ACTIVE MISSIONS TODAY:\n";
  const activeItems = state.missions?.items || [];
  const pendingMissions = activeItems.filter(m => m && m.status !== 'done');

  if (pendingMissions.length === 0) {
    prompt += "None available right now.\n";
  } else {
    for (const m of pendingMissions) {
      if (m.status === 'unavailable') {
        prompt += `- ${m.type} Mission: Unavailable (${m.reason || 'Daily limit reached or no nearby location'}).\n`;
        continue;
      }
      
      const type = m.type;
      if (type === 'GO') {
        const dest = m.element?.name || m.element?.tags?.name || (m.element?.category ? CATEGORY_LABELS[m.element.category] : null) || m.title || 'A nearby green space';
        const dist = m.element?.distanceMeters != null ? `${Math.round(m.element.distanceMeters)}m` : (m.description?.match(/\d+\s*m/)?.[0] || 'nearby');
        prompt += `- GO Mission: "${m.title || dest}". Destination: ${dest}, Distance: about ${dist}. Objective: Walk to this location and check in when in range.\n`;
      } else if (type === 'LOOK') {
        const item = m.prompt || m.title?.replace(/^Find:\s*/i, '') || 'an outdoor item';
        prompt += `- LOOK Mission: "${m.title || `Find: ${item}`}". Target: Spot and photograph "${item}" outdoors. Objective: Take a photo outdoors as proof.\n`;
      } else if (type === 'LEARN') {
        const spot = m.element?.name || m.element?.tags?.name || m.element?.tags?.species || (m.element?.category ? CATEGORY_LABELS[m.element.category] : null) || m.title || 'A historic landmark or tree';
        const dist = m.element?.distanceMeters != null ? `${Math.round(m.element.distanceMeters)}m` : (m.description?.match(/\d+\s*m/)?.[0] || 'nearby');
        prompt += `- LEARN Mission: "${m.title || spot}". Spot: ${spot}, Distance: about ${dist}. Objective: Visit the spot, check in, take a photo, and read about it.\n`;
      } else {
        prompt += `- ${m.type} Mission: "${m.title || 'Mission'}". ${m.description || ''}\n`;
      }
    }
  }

  // COMPLETED MISSIONS TODAY
  prompt += "\nCOMPLETED MISSIONS TODAY:\n";
  const doneMissions = dayData?.missions?.slice(0, 5) || [];
  if (doneMissions.length === 0) {
    prompt += "None yet.\n";
  } else {
    for (const m of doneMissions) {
      prompt += `- ${m.title || 'Unnamed'} (${m.category || m.type})\n`;
      if (m.fact) prompt += `  Fact: ${m.fact}\n`;
    }
  }

  // GUIDANCE INSTRUCTIONS
  prompt += "\nGUIDELINES FOR ASSISTING THE USER:\n";
  prompt += "- When the user asks which mission they have today, what to do, or how to complete a mission, explain the ACTIVE MISSIONS listed above.\n";
  prompt += "- For GO: Advise them to walk to the destination and check in when within radius.\n";
  prompt += "- For LOOK: Encourage them to search outdoors for the target item and photograph it.\n";
  prompt += "- For LEARN: Guide them to the spot to check in, snap a photo, and learn something new.\n";
  prompt += "- If they completed missions today, congratulate them on their progress.\n";
  prompt += "- Be enthusiastic and supportive, but keep replies concise (under 120 words).\n";

  return prompt;
}

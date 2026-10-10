import { useStore } from '../store/useStore.js';
import { describeTags } from '../missions/describe.js';

export function buildCompanionPrompt() {
  
  const state = useStore.getState();
  const today = new Date();
  const todayStr = `${today.getFullYear()}-${today.getMonth() + 1}-${today.getDate()}`;
  const dayData = state.days?.[todayStr];
  
  let prompt = "You are a friendly outdoor companion. Answer in under 120 words. Never invent places or facts. Say you don't know if unsure.\n\nCONTEXT (Places the user completed today):\n";
  
  const doneMissions = dayData?.missions?.slice(0, 5) || [];
  
  if (doneMissions.length === 0) {
    prompt += "None yet.";
  } else {
    for (const m of doneMissions) {
      prompt += `- ${m.title || 'Unnamed'} (${m.category || m.type})\n`;
      if (m.fact) prompt += `  Fact: ${m.fact}\n`;
    }
  }
  
  return prompt;
}

import { normalizeDateStr } from '../utils/date.js';

export function migrateState(state) {
  let newState = { ...state };
  
  if (!newState.days) newState.days = {};
  if (!newState.claimedBonuses) newState.claimedBonuses = {};
  if (newState.ledgerCarry === undefined) newState.ledgerCarry = 0;
  if (!newState.walk) newState.walk = null;
  if (newState.cameraExif === undefined) newState.cameraExif = true;
  if (!newState.unlockedBadges) newState.unlockedBadges = {};
  if (!newState.companionPersona) newState.companionPersona = 'nature';
  if (!newState.journal) newState.journal = [];
  newState.lastTps = null;
  
  // 1. Convert old array missions into history
  if (newState.missions && Array.isArray(newState.missions)) {
    for (const m of newState.missions) {
      if (m.status === 'done' && m.completedAt && m.date) {
        const normDate = normalizeDateStr(m.date);
        if (!newState.days[normDate]) {
          newState.days[normDate] = { date: normDate, missions: [], distanceM: 0, distanceRewardedM: 0, walkSeconds: 0, walkSessions: 0, tokensEarned: 0, tokensSpent: 0, bonuses: [] };
        }
        const existing = newState.days[normDate].missions.find(x => x.id === m.id);
        if (!existing) {
          newState.days[normDate].missions.push({
            id: m.id, type: m.type, title: m.title, categoryLabel: m.categoryLabel || 'A place',
            reward: m.reward || 0, completedAt: m.completedAt, proofUri: m.photoUri || m.proofUri,
            lat: m.element?.lat, lon: m.element?.lon
          });
        }
      }
    }
    newState.missions = null;
  }
  
  // 2. Normalize and merge all existing keys in days
  const mergedDays = {};
  for (const [rawDate, day] of Object.entries(newState.days || {})) {
    const normDate = normalizeDateStr(rawDate);
    if (!mergedDays[normDate]) {
      mergedDays[normDate] = {
        date: normDate,
        missions: [],
        distanceM: 0,
        distanceRewardedM: 0,
        walkSeconds: 0,
        walkSessions: 0,
        tokensEarned: 0,
        tokensSpent: 0,
        bonuses: []
      };
    }
    const target = mergedDays[normDate];
    target.distanceM = (target.distanceM || 0) + (day.distanceM || 0);
    target.distanceRewardedM = (target.distanceRewardedM || 0) + (day.distanceRewardedM || 0);
    target.walkSeconds = (target.walkSeconds || 0) + (day.walkSeconds || 0);
    target.walkSessions = (target.walkSessions || 0) + (day.walkSessions || 0);
    target.tokensEarned = (target.tokensEarned || 0) + (day.tokensEarned || 0);
    target.tokensSpent = (target.tokensSpent || 0) + (day.tokensSpent || 0);
    
    // Concatenate missions de-duplicated by id
    for (const m of (day.missions || [])) {
      const normM = { ...m, date: m.date ? normalizeDateStr(m.date) : normDate };
      if (!target.missions.some(x => x.id === normM.id)) {
        target.missions.push(normM);
      }
    }
    
    // Merge bonuses de-duplicated
    for (const b of (day.bonuses || [])) {
      const isDupe = target.bonuses.some(x => 
        (b.key && x.key === b.key) || 
        (x.reason === b.reason && x.amount === b.amount && x.ts === b.ts)
      );
      if (!isDupe) {
        target.bonuses.push(b);
      }
    }
  }
  newState.days = mergedDays;
  
  // 3. Normalize claimedBonuses keys
  const mergedClaimedBonuses = {};
  for (const [key, val] of Object.entries(newState.claimedBonuses || {})) {
    const parts = key.split(':');
    if (parts.length >= 3 && (parts[0] === 'goal' && parts[1] === 'day')) {
      parts[2] = normalizeDateStr(parts[2]);
      mergedClaimedBonuses[parts.join(':')] = val;
    } else if (parts.length >= 3 && parts[0] === 'streak') {
      parts[1] = normalizeDateStr(parts[1]);
      mergedClaimedBonuses[parts.join(':')] = val;
    } else {
      mergedClaimedBonuses[key] = val;
    }
  }
  newState.claimedBonuses = mergedClaimedBonuses;
  
  // 4. Normalize lastMissionDate and missions.date if present
  if (newState.lastMissionDate) {
    newState.lastMissionDate = normalizeDateStr(newState.lastMissionDate);
  }
  if (newState.missions && typeof newState.missions === 'object') {
    if (newState.missions.date) {
      newState.missions.date = normalizeDateStr(newState.missions.date);
    }
    if (Array.isArray(newState.missions.items)) {
      newState.missions.items = newState.missions.items.map(item => ({
        ...item,
        date: item.date ? normalizeDateStr(item.date) : item.date
      }));
    }
  }
  
  return newState;
}

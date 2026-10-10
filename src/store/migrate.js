export function migrateState(state) {
  let newState = { ...state };
  
  if (!newState.days) newState.days = {};
  if (!newState.claimedBonuses) newState.claimedBonuses = {};
  if (newState.ledgerCarry === undefined) newState.ledgerCarry = 0;
  if (!newState.walk) newState.walk = null;
  
  if (newState.missions && Array.isArray(newState.missions)) {
    // Old state was an array of active missions. Some might be 'done'.
    // Convert done missions to history.
    for (const m of newState.missions) {
      if (m.status === 'done' && m.completedAt && m.date) {
        if (!newState.days[m.date]) {
          newState.days[m.date] = { date: m.date, missions: [], distanceM: 0, walkSeconds: 0, walkSessions: 0, tokensEarned: 0, tokensSpent: 0, bonuses: [] };
        }
        
        // ensure we don't duplicate if already in days
        const existing = newState.days[m.date].missions.find(x => x.id === m.id);
        if (!existing) {
          newState.days[m.date].missions.push({
            id: m.id, type: m.type, title: m.title, categoryLabel: m.categoryLabel || 'A place',
            reward: m.reward || 0, completedAt: m.completedAt, proofUri: m.photoUri || m.proofUri,
            lat: m.element?.lat, lon: m.element?.lon
          });
        }
      }
    }
    // Set missions to null so open missions regenerate in new structure
    newState.missions = null;
  }
  
  return newState;
}

import { useStore } from '../store/useStore.js';
import { getOriginFix } from '../location/checkin.js';
import { nextMission } from './next.js';
import { computeBonuses } from '../progress/bonuses.js';
import { CONFIG } from '../config.js';
import { MISSION_GEN_VERSION } from './generate.js';

let toastQueue = [];
let onToastChange = null;

export function setToastListener(fn) {
  onToastChange = fn;
}

export function pushToast(toast) {
  toastQueue.push({ id: Date.now() + Math.random(), ...toast });
  if (onToastChange) onToastChange([...toastQueue]);
}

export function shiftToast() {
  toastQueue.shift();
  if (onToastChange) onToastChange([...toastQueue]);
}

async function getBestFix() {
  try {
    const fix = await getOriginFix(); // 8s timeout in getOriginFix
    if (fix) return fix;
  } catch (e) {}
  
  const state = useStore.getState();
  if (state.area && state.area.origin) {
    return { lat: state.area.origin.lat, lon: state.area.origin.lon };
  }
  return null;
}

export async function ensureToday() {
  const state = useStore.getState();
  const today = new Date();
  const dateStr = `${today.getFullYear()}-${today.getMonth() + 1}-${today.getDate()}`;
  
  const missions = state.missions;
  
  if (!missions || missions.date !== dateStr || missions.generatorVersion !== MISSION_GEN_VERSION) {
    const fix = await getBestFix();
    if (!fix) return; // Cannot initialize without origin
    
    const elements = state.area?.elements || [];
    const cfg = { dailyCap: CONFIG.MISSIONS.dailyCap };
    
    const newMissions = {
      date: dateStr,
      origin: fix,
      items: [],
      seq: { GO: 0, LOOK: 0, LEARN: 0 },
      doneCounts: { GO: 0, LOOK: 0, LEARN: 0 },
      skips: { GO: 0, LOOK: 0, LEARN: 0 },
      skippedIds: [],
      usedLookPrompts: [],
      generatorVersion: MISSION_GEN_VERSION
    };
    
    for (const type of ['GO', 'LOOK', 'LEARN']) {
      const m = nextMission({
        dateStr, type, seq: 0, origin: fix, elements,
        visitedIds: state.visitedIds,
        activeTargetIds: newMissions.items.map(x => x.elementId).filter(Boolean),
        skippedIds: newMissions.skippedIds,
        usedLookPrompts: newMissions.usedLookPrompts,
        doneCounts: newMissions.doneCounts,
        cfg
      });
      if (m.status !== 'unavailable') {
        newMissions.items.push(m);
        newMissions.seq[type] = 1;
        if (type === 'LOOK' && m.prompt) newMissions.usedLookPrompts.push(m.prompt);
      } else {
        newMissions.items.push(m);
      }
    }
    
    useStore.getState().setMissions(newMissions);
  }
}

export async function onMissionCompleted(mission) {
  // spawn replacement
  const state = useStore.getState();
  const fix = await getBestFix();
  const cfg = { dailyCap: CONFIG.MISSIONS.dailyCap };
  
  const nextSeq = (state.missions.seq[mission.type] || 0) + 1;
  const newM = nextMission({
    dateStr: state.missions.date,
    type: mission.type,
    seq: nextSeq,
    origin: fix,
    elements: state.area?.elements || [],
    visitedIds: state.visitedIds,
    activeTargetIds: state.missions.items.filter(x => x.status !== 'done' && x.id !== mission.id).map(x => x.elementId).filter(Boolean),
    skippedIds: state.missions.skippedIds,
    usedLookPrompts: state.missions.usedLookPrompts,
    doneCounts: state.missions.doneCounts,
    cfg
  });
  
  // Actually, wait, doneCounts might have been incremented by completeMission synchronously, but `state` here might be stale if we didn't re-get it.
  // Better to useStore.getState() again right before nextMission just in case.
  const latestState = useStore.getState();
  
  const reallyNewM = nextMission({
    dateStr: latestState.missions.date,
    type: mission.type,
    seq: nextSeq,
    origin: fix,
    elements: latestState.area?.elements || [],
    visitedIds: latestState.visitedIds,
    activeTargetIds: latestState.missions.items.filter(x => x.status !== 'done' && x.id !== mission.id).map(x => x.elementId).filter(Boolean),
    skippedIds: latestState.missions.skippedIds,
    usedLookPrompts: latestState.missions.usedLookPrompts,
    doneCounts: latestState.missions.doneCounts,
    cfg
  });
  
  // replace the slot (which is now done, so it's technically still there in index.js we show it in history, not active slots)
  // wait, the old completed mission shouldn't be in `missions.items` if it was moved to history?
  // "convert any done mission with completedAt on its own date into days[date].missions" - the migration does that, but what about active runtime?
  // Our completeMission in useStore keeps the done mission in `missions.items`.
  // The UI active slots will filter `status !== 'done'`.
  // And `replaceMissionSlot` replaces by type, so the old one is removed from `missions.items`! Yes.
  
  // So we first call replaceMissionSlot
  latestState.replaceMissionSlot(mission.type, reallyNewM);
  
  // Update seq and usedLookPrompts in store directly using set
  useStore.setState(s => ({
    missions: {
      ...s.missions,
      seq: { ...s.missions.seq, [mission.type]: nextSeq },
      usedLookPrompts: reallyNewM.prompt ? [...s.missions.usedLookPrompts, reallyNewM.prompt] : s.missions.usedLookPrompts
    }
  }));
  
  evaluateProgress();
}

export async function skip(mission) {
  const state = useStore.getState();
  const cfg = { dailyCap: CONFIG.MISSIONS.dailyCap };
  const type = mission.type;
  
  if ((state.missions.skips[type] || 0) >= CONFIG.MISSIONS.skipsPerTypePerDay) {
    return; // cannot skip
  }
  
  state.skipMission(mission.id);
  
  const latestState = useStore.getState();
  const fix = await getBestFix();
  const nextSeq = (latestState.missions.seq[type] || 0) + 1;
  
  const replacement = nextMission({
    dateStr: latestState.missions.date,
    type: type,
    seq: nextSeq,
    origin: fix,
    elements: latestState.area?.elements || [],
    visitedIds: latestState.visitedIds,
    activeTargetIds: latestState.missions.items.map(x => x.elementId).filter(Boolean),
    skippedIds: latestState.missions.skippedIds,
    usedLookPrompts: latestState.missions.usedLookPrompts,
    doneCounts: latestState.missions.doneCounts,
    cfg
  });
  
  latestState.replaceMissionSlot(type, replacement);
  
  useStore.setState(s => ({
    missions: {
      ...s.missions,
      seq: { ...s.missions.seq, [type]: nextSeq },
      usedLookPrompts: replacement.prompt ? [...s.missions.usedLookPrompts, replacement.prompt] : s.missions.usedLookPrompts
    }
  }));
}

export function evaluateProgress() {
  const state = useStore.getState();
  const today = new Date();
  const todayStr = `${today.getFullYear()}-${today.getMonth() + 1}-${today.getDate()}`;
  
  const cfg = { goals: CONFIG.GOALS, streak: CONFIG.STREAK };
  const newBonuses = computeBonuses({
    days: state.days,
    claimed: state.claimedBonuses,
    todayStr,
    cfg
  });
  
  for (const bonus of newBonuses) {
    state.addBonus(bonus);
    state.addLedgerEntry(bonus.amount, bonus.reason);
    state.addTokens(bonus.amount);
    pushToast({ message: `+${bonus.amount} tokens. ${bonus.reason}` });
  }
}

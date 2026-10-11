import { useStore } from '../store/useStore.js';
import { getOriginFix } from '../location/checkin.js';
import { nextMission } from './next.js';
import { computeBonuses } from '../progress/bonuses.js';
import { CONFIG } from '../config.js';
import { MISSION_GEN_VERSION } from './generate.js';
import { loadAreaCache } from '../osm/cache.js';
import { logEvent } from '../utils/eventLog.js';
import { todayString, normalizeDateStr } from '../utils/date.js';
import { haversineMeters } from '../utils/geo.js';

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

export async function getBestFix() {
  try {
    const fix = await getOriginFix();
    if (fix && fix.lat !== undefined && fix.lon !== undefined) {
      return { fix, source: 'gps' };
    }
  } catch (e) {}
  
  const state = useStore.getState();
  if (state.area) {
    if (state.area.origin && state.area.origin.lat !== undefined && state.area.origin.lon !== undefined) {
      return { fix: { lat: state.area.origin.lat, lon: state.area.origin.lon }, source: 'area.origin' };
    }
    if (state.area.center && state.area.center.lat !== undefined && state.area.center.lon !== undefined) {
      return { fix: { lat: state.area.center.lat, lon: state.area.center.lon }, source: 'area.center' };
    }
  }
  return null;
}

export async function getAreaElements() {
  const state = useStore.getState();
  if (!state.area) return [];
  
  let elements = state.area.elements || [];
  if (elements.length === 0) {
    try {
      const cached = await loadAreaCache();
      if (cached?.elements && cached.elements.length > 0) {
        elements = cached.elements;
        useStore.setState(s => ({
          area: { ...s.area, elements }
        }));
      }
    } catch (e) {
      console.warn('loadAreaCache error in getAreaElements:', e);
    }
  }
  
  // if the area exists but elements are empty, retry the load once
  if (elements.length === 0 && state.area) {
    try {
      const cached = await loadAreaCache();
      if (cached?.elements && cached.elements.length > 0) {
        elements = cached.elements;
        useStore.setState(s => ({
          area: { ...s.area, elements }
        }));
      }
    } catch (e) {
      console.warn('loadAreaCache retry error in getAreaElements:', e);
    }
  }
  
  return elements;
}

function logCandidateFilterCounts(type, elements, fix, originSource, visitedIds, activeTargetIds, skippedIds) {
  if (type === 'LOOK') {
    logEvent('generation', 'Generation for LOOK mission', {
      type: 'LOOK',
      originSource,
      elementCount: 0
    });
    return;
  }
  
  const total = elements.length;
  const elementsWithDist = elements.map(e => {
    if (fix && e.lat !== undefined && e.lon !== undefined) {
      return { ...e, distanceMeters: haversineMeters(fix.lat, fix.lon, e.lat, e.lon) };
    }
    return e;
  });
  
  // Distance range filter
  let inDistanceRange = elementsWithDist;
  if (type === 'GO') {
    inDistanceRange = elementsWithDist.filter(e => 
      (e.category === 'park' || e.category === 'garden' || e.category === 'forest') && 
      (e.distanceMeters === undefined || e.distanceMeters <= 2000)
    );
  } else if (type === 'LEARN') {
    inDistanceRange = elementsWithDist.filter(e => 
      (e.category === 'historic' || e.category === 'tree' || e.name || e.tags?.name) &&
      (e.distanceMeters === undefined || e.distanceMeters <= 2000)
    );
  }
  
  const distanceRangeCount = inDistanceRange.length;
  const unvisitedCount = elementsWithDist.filter(e => !visitedIds.includes(e.id)).length;
  const nonActiveCount = elementsWithDist.filter(e => !visitedIds.includes(e.id) && !activeTargetIds.includes(e.id)).length;
  const nonSkippedCount = elementsWithDist.filter(e => !visitedIds.includes(e.id) && !activeTargetIds.includes(e.id) && !skippedIds.includes(e.id)).length;
  
  logEvent('generation', `Candidate filtering for ${type}`, {
    type,
    elementCount: total,
    originSource,
    candidateCounts: {
      total,
      distanceRange: distanceRangeCount,
      visitedFilter: unvisitedCount,
      activeFilter: nonActiveCount,
      skippedFilter: nonSkippedCount
    }
  });
}

export async function recheckUnavailableMissions() {
  const state = useStore.getState();
  if (!state.missions || !state.missions.items) return;
  
  const unavailableSlots = state.missions.items.filter(m => m.status === 'unavailable');
  if (unavailableSlots.length === 0) return;
  
  const best = await getBestFix();
  if (!best || !best.fix) return;
  const { fix, source: originSource } = best;
  
  const elements = await getAreaElements();
  if (!elements || elements.length === 0) return;
  
  const dateStr = state.missions.date ? normalizeDateStr(state.missions.date) : todayString();
  const cfg = { dailyCap: CONFIG.MISSIONS.dailyCap };
  
  for (const slot of unavailableSlots) {
    const latestState = useStore.getState();
    const activeTargetIds = latestState.missions.items
      .filter(x => x.status !== 'done' && x.id !== slot.id)
      .map(x => x.elementId)
      .filter(Boolean);
    
    logCandidateFilterCounts(
      slot.type,
      elements,
      fix,
      originSource,
      latestState.visitedIds || [],
      activeTargetIds,
      latestState.missions.skippedIds || []
    );
    
    const seq = latestState.missions.seq[slot.type] || 0;
    const replacement = nextMission({
      dateStr,
      type: slot.type,
      seq,
      origin: fix,
      elements,
      visitedIds: latestState.visitedIds || [],
      activeTargetIds,
      skippedIds: latestState.missions.skippedIds || [],
      usedLookPrompts: latestState.missions.usedLookPrompts || [],
      doneCounts: latestState.missions.doneCounts || {},
      cfg
    });
    
    if (replacement && replacement.status !== 'unavailable') {
      latestState.replaceMissionSlot(slot.type, replacement);
      logEvent('generation', `Recovered unavailable slot ${slot.type}`, {
        id: replacement.id,
        title: replacement.title
      });
    }
  }
}

export async function ensureToday() {
  const state = useStore.getState();
  const dateStr = todayString();
  
  const missions = state.missions;
  
  if (!missions || missions.date !== dateStr || missions.generatorVersion !== MISSION_GEN_VERSION) {
    const best = await getBestFix();
    if (!best || !best.fix) {
      logEvent('generation', 'ensureToday: Aborting, origin fix is null');
      return;
    }
    const { fix, source: originSource } = best;
    
    const elements = await getAreaElements();
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
      const activeTargetIds = newMissions.items.map(x => x.elementId).filter(Boolean);
      logCandidateFilterCounts(
        type,
        elements,
        fix,
        originSource,
        state.visitedIds || [],
        activeTargetIds,
        newMissions.skippedIds
      );
      
      const m = nextMission({
        dateStr, type, seq: 0, origin: fix, elements,
        visitedIds: state.visitedIds || [],
        activeTargetIds,
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
  } else {
    // If missions exist for today, re-evaluate any unavailable slot
    await recheckUnavailableMissions();
  }
}

export async function onMissionCompleted(mission) {
  const state = useStore.getState();
  const best = await getBestFix();
  const fix = best?.fix || state.area?.origin || state.area?.center || null;
  const originSource = best?.source || 'fallback';
  const cfg = { dailyCap: CONFIG.MISSIONS.dailyCap };
  
  const elements = await getAreaElements();
  const nextSeq = (state.missions.seq[mission.type] || 0) + 1;
  const latestState = useStore.getState();
  
  const activeTargetIds = latestState.missions.items
    .filter(x => x.status !== 'done' && x.id !== mission.id)
    .map(x => x.elementId)
    .filter(Boolean);
  
  logCandidateFilterCounts(
    mission.type,
    elements,
    fix,
    originSource,
    latestState.visitedIds || [],
    activeTargetIds,
    latestState.missions.skippedIds || []
  );
  
  const dateStr = latestState.missions.date ? normalizeDateStr(latestState.missions.date) : todayString();
  const replacement = nextMission({
    dateStr,
    type: mission.type,
    seq: nextSeq,
    origin: fix,
    elements,
    visitedIds: latestState.visitedIds || [],
    activeTargetIds,
    skippedIds: latestState.missions.skippedIds || [],
    usedLookPrompts: latestState.missions.usedLookPrompts || [],
    doneCounts: latestState.missions.doneCounts || {},
    cfg
  });
  
  latestState.replaceMissionSlot(mission.type, replacement);
  
  useStore.setState(s => ({
    missions: {
      ...s.missions,
      seq: { ...s.missions.seq, [mission.type]: nextSeq },
      usedLookPrompts: replacement.prompt ? [...s.missions.usedLookPrompts, replacement.prompt] : s.missions.usedLookPrompts
    }
  }));
  
  evaluateProgress();
  await recheckUnavailableMissions();
}

export async function skip(mission) {
  const state = useStore.getState();
  const cfg = { dailyCap: CONFIG.MISSIONS.dailyCap };
  const type = mission.type;
  
  if ((state.missions.skips[type] || 0) >= CONFIG.MISSIONS.skipsPerTypePerDay) {
    return;
  }
  
  state.skipMission(mission.id);
  
  const latestState = useStore.getState();
  const best = await getBestFix();
  const fix = best?.fix || latestState.area?.origin || latestState.area?.center || null;
  const originSource = best?.source || 'fallback';
  const elements = await getAreaElements();
  const nextSeq = (latestState.missions.seq[type] || 0) + 1;
  
  const activeTargetIds = latestState.missions.items.map(x => x.elementId).filter(Boolean);
  logCandidateFilterCounts(
    type,
    elements,
    fix,
    originSource,
    latestState.visitedIds || [],
    activeTargetIds,
    latestState.missions.skippedIds || []
  );
  
  const dateStr = latestState.missions.date ? normalizeDateStr(latestState.missions.date) : todayString();
  const replacement = nextMission({
    dateStr,
    type: type,
    seq: nextSeq,
    origin: fix,
    elements,
    visitedIds: latestState.visitedIds || [],
    activeTargetIds,
    skippedIds: latestState.missions.skippedIds || [],
    usedLookPrompts: latestState.missions.usedLookPrompts || [],
    doneCounts: latestState.missions.doneCounts || {},
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
  
  await recheckUnavailableMissions();
}

export function evaluateProgress() {
  const state = useStore.getState();
  const todayStr = todayString();
  
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

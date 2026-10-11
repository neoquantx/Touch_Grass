import * as Location from 'expo-location';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { useStore } from '../store/useStore.js';
import { CONFIG } from '../config.js';
import { createWalkState, accumulateFix } from './distance.js';
import { evaluateProgress, pushToast } from '../missions/controller.js';
import { todayString } from '../utils/date.js';

let sub = null;
let walkState = createWalkState();
let flushTimer = null;
let liveData = { distanceM: 0, seconds: 0, lastTs: null, accuracyWarn: false };

let listeners = [];
export function subscribeWalk(fn) {
  listeners.push(fn);
  return () => { listeners = listeners.filter(x => x !== fn); };
}
function notify() {
  listeners.forEach(fn => fn({ ...liveData }));
}

function flushToStore() {
  if (liveData.distanceM > 0 || liveData.seconds > 0) {
    const store = useStore.getState();
    store.addWalkDistance(liveData.distanceM, liveData.seconds, Date.now());
    
    // Check rewards
    const dateStr = todayString();
    const dayData = store.days[dateStr];
    if (dayData) {
      const rewM = dayData.distanceRewardedM || 0;
      const totalM = dayData.distanceM;
      if (rewM < CONFIG.WALK.dailyRewardCapM) {
        const unrewarded = totalM - rewM;
        if (unrewarded >= 250) {
          const chunks = Math.floor(unrewarded / 250);
          const toRewardM = chunks * 250;
          const tokens = chunks * CONFIG.WALK.tokensPer250M;
          if (rewM + toRewardM <= CONFIG.WALK.dailyRewardCapM) {
            store.updateWalkRewarded(dateStr, toRewardM);
            store.addLedgerEntry(tokens, "Walk 250 m");
            store.addTokens(tokens);
            pushToast({ message: `+${tokens} tokens for walking ${toRewardM}m!` });
            evaluateProgress();
          }
        }
      }
    }
    
    liveData.distanceM = 0;
    liveData.seconds = 0;
  }
}

export async function startWalk() {
  const { status } = await Location.requestForegroundPermissionsAsync();
  if (status !== 'granted') return { error: "Location permission denied" };
  
  await activateKeepAwakeAsync("walk");
  
  useStore.getState().setWalkState({ active: true, startedAt: Date.now(), lastFixAt: Date.now() });
  
  walkState = createWalkState();
  liveData = { distanceM: 0, seconds: 0, lastTs: Date.now(), accuracyWarn: false };
  notify();
  
  flushTimer = setInterval(() => {
    flushToStore();
    useStore.getState().setWalkState({ active: true, startedAt: useStore.getState().walk?.startedAt || Date.now(), lastFixAt: Date.now() });
  }, 15000);
  
  sub = await Location.watchPositionAsync({
    accuracy: Location.Accuracy.High,
    timeInterval: CONFIG.WALK.intervalMs,
    distanceInterval: CONFIG.WALK.distanceIntervalM
  }, (loc) => {
    const fix = {
      lat: loc.coords.latitude,
      lon: loc.coords.longitude,
      accuracy: loc.coords.accuracy,
      timestamp: loc.timestamp,
      mocked: loc.mocked || false
    };
    
    const { state, addedM, rejected } = accumulateFix(walkState, fix, CONFIG.WALK);
    walkState = state;
    
    liveData.accuracyWarn = fix.accuracy > CONFIG.WALK.minAccuracyM;
    
    if (liveData.lastTs && !rejected) {
      liveData.seconds += (fix.timestamp - liveData.lastTs) / 1000;
    }
    liveData.lastTs = fix.timestamp;
    liveData.distanceM += addedM;
    
    notify();
  });
  
  return { success: true };
}

export async function stopWalk() {
  if (sub) {
    sub.remove();
    sub = null;
  }
  if (flushTimer) {
    clearInterval(flushTimer);
    flushTimer = null;
  }
  deactivateKeepAwake("walk");
  
  flushToStore();
  useStore.getState().setWalkState(null);
  evaluateProgress();
  notify();
}

export async function pauseWalk() {
  if (sub) {
    sub.remove();
    sub = null;
  }
}

export async function resumeWalk() {
  const walk = useStore.getState().walk;
  if (!walk || !walk.active) return;
  
  sub = await Location.watchPositionAsync({
    accuracy: Location.Accuracy.High,
    timeInterval: CONFIG.WALK.intervalMs,
    distanceInterval: CONFIG.WALK.distanceIntervalM
  }, (loc) => {
    const fix = {
      lat: loc.coords.latitude,
      lon: loc.coords.longitude,
      accuracy: loc.coords.accuracy,
      timestamp: loc.timestamp,
      mocked: loc.mocked || false
    };
    const { state, addedM, rejected } = accumulateFix(walkState, fix, CONFIG.WALK);
    walkState = state;
    liveData.accuracyWarn = fix.accuracy > CONFIG.WALK.minAccuracyM;
    if (liveData.lastTs && !rejected) {
      liveData.seconds += (fix.timestamp - liveData.lastTs) / 1000;
    }
    liveData.lastTs = fix.timestamp;
    liveData.distanceM += addedM;
    notify();
  });
}

import { haversineMeters } from '../utils/geo.js';

export function createWalkState() {
  return { lastFix: null };
}

export function accumulateFix(state, fix, cfg) {
  if (fix.mocked) {
    return { state, addedM: 0, rejected: 'mocked' };
  }
  
  if (fix.accuracy == null || fix.accuracy > cfg.minAccuracyM) {
    return { state, addedM: 0, rejected: 'accuracy' };
  }
  
  if (!state.lastFix) {
    return { state: { lastFix: fix }, addedM: 0, rejected: null };
  }
  
  const dt = (fix.timestamp - state.lastFix.timestamp) / 1000;
  
  if (dt <= 0) {
    return { state, addedM: 0, rejected: 'gap' };
  }
  
  if (dt > cfg.maxGapSeconds) {
    return { state: { lastFix: fix }, addedM: 0, rejected: 'gap' };
  }
  
  const dist = haversineMeters(state.lastFix.lat, state.lastFix.lon, fix.lat, fix.lon);
  
  if (dist < cfg.minSegmentM) {
    return { state, addedM: 0, rejected: 'jitter' };
  }
  
  const speed = dist / dt;
  if (speed > cfg.maxSpeedMps) {
    return { state: { lastFix: fix }, addedM: 0, rejected: 'speed' };
  }
  
  return { state: { lastFix: fix }, addedM: dist, rejected: null };
}

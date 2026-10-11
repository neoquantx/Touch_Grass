import { BADGE_DEFINITIONS, computeBadgeMetrics, evaluateBadges } from '../src/progress/badges.js';
import { calculateBearing } from '../src/utils/geo.js';

console.log('--- 1. Testing calculateBearing ---');
// Bearing from Paris (48.8566, 2.3522) to London (51.5074, -0.1278) should be around 330 deg (NW)
const bearing = calculateBearing(48.8566, 2.3522, 51.5074, -0.1278);
if (!bearing || bearing.cardinal !== 'NW') {
  console.error('FAIL: Expected NW bearing from Paris to London, got:', bearing);
  process.exit(1);
}
console.log('Paris to London bearing:', bearing);

// Bearing directly North
const northBearing = calculateBearing(0, 0, 1, 0);
if (northBearing.cardinal !== 'N') {
  console.error('FAIL: Expected N bearing, got:', northBearing);
  process.exit(1);
}
console.log('Equator North bearing:', northBearing);

console.log('--- 2. Testing Badge Evaluation ---');
const sampleDays = {
  '2026-10-10': {
    distanceM: 3000,
    missions: [
      { id: 'm1', type: 'GO', category: 'park', completedAt: new Date('2026-10-10T07:30:00Z').getTime() },
      { id: 'm2', type: 'LOOK', category: 'scavenger', completedAt: new Date('2026-10-10T14:00:00Z').getTime() }
    ]
  },
  '2026-10-11': {
    distanceM: 2500,
    missions: [
      { id: 'm3', type: 'LEARN', category: 'historic', completedAt: new Date('2026-10-11T17:30:00Z').getTime() }
    ]
  }
};

const streakInfo = { current: 2, best: 2 };
const ledger = [
  { amount: 500 },
  { amount: 300 },
  { amount: 700 }
];

const metrics = computeBadgeMetrics({ days: sampleDays, ledger, streakInfo });
console.log('Metrics computed:', metrics);

if (metrics.totalMissions !== 3) {
  console.error('FAIL: Expected 3 missions, got', metrics.totalMissions);
  process.exit(1);
}
if (metrics.totalDistanceM !== 5500) {
  console.error('FAIL: Expected 5500m distance, got', metrics.totalDistanceM);
  process.exit(1);
}
if (!metrics.hasGoldenHourMission) {
  console.error('FAIL: Expected golden hour mission');
  process.exit(1);
}

const { newlyUnlocked } = evaluateBadges({ days: sampleDays, ledger, streakInfo, unlockedBadges: {} });
console.log('Newly unlocked badge IDs:', newlyUnlocked.map(b => b.id));

const unlockedIds = newlyUnlocked.map(b => b.id);
if (!unlockedIds.includes('first_step')) {
  console.error('FAIL: first_step should be unlocked');
  process.exit(1);
}
if (!unlockedIds.includes('walk_5k')) {
  console.error('FAIL: walk_5k should be unlocked');
  process.exit(1);
}
if (!unlockedIds.includes('century_club')) {
  console.error('FAIL: century_club should be unlocked');
  process.exit(1);
}

console.log('ALL check_badges.js tests PASSED!');

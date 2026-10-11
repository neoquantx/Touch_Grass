import { normalizeDateStr, todayString, formatDateDisplay, daysBetween, addDays, isoWeekKey } from '../src/utils/date.js';
import { computeStreak } from '../src/progress/streak.js';
import { migrateState } from '../src/store/migrate.js';

function assert(cond, msg) {
  if (!cond) {
    console.error('FAIL:', msg);
    process.exit(1);
  }
}

console.log('--- 1. Testing normalizeDateStr ---');
assert(normalizeDateStr('2026-10-9') === '2026-10-09', 'unpadded day should zero pad');
assert(normalizeDateStr('2026-1-5') === '2026-01-05', 'unpadded month & day should zero pad');
assert(normalizeDateStr('2026-10-09') === '2026-10-09', 'already padded should stay padded');
assert(normalizeDateStr(new Date('2026-10-09T00:00:00Z')) === '2026-10-09', 'date object should normalize to YYYY-MM-DD');

console.log('--- 2. Testing sorting across 9 to 10 boundary ---');
const rawDates = ['2026-10-10', '2026-10-9'];
const sortedNormalized = rawDates.map(normalizeDateStr).sort();
assert(sortedNormalized[0] === '2026-10-09', '2026-10-09 must sort before 2026-10-10');
assert(sortedNormalized[1] === '2026-10-10', '2026-10-10 must sort after 2026-10-09');

console.log('--- 3. Testing formatDateDisplay ---');
assert(formatDateDisplay('2026-10-09') === 'Fri 9 Oct', 'formatDateDisplay for 2026-10-09 should be Fri 9 Oct');
assert(formatDateDisplay('2026-10-9') === 'Fri 9 Oct', 'formatDateDisplay for 2026-10-9 should also be Fri 9 Oct');

console.log('--- 4. Testing streak calculation ---');
const streakCfg = { minMissions: 1, minWalkM: 1000 };

// Oct 9 to Oct 10
const daysOct = {
  '2026-10-09': { date: '2026-10-09', distanceM: 2000, missions: [] },
  '2026-10-10': { date: '2026-10-10', distanceM: 2000, missions: [] }
};
const streakResOct = computeStreak(daysOct, '2026-10-10', streakCfg);
assert(streakResOct.current === 2, `streak across Oct 9-10 should be 2, got ${streakResOct.current}`);
assert(streakResOct.best === 2, `best streak across Oct 9-10 should be 2, got ${streakResOct.best}`);

// Oct 31 to Nov 1
const daysMonthBoundary = {
  '2026-10-31': { date: '2026-10-31', distanceM: 1500, missions: [] },
  '2026-11-01': { date: '2026-11-01', distanceM: 1500, missions: [] }
};
const streakResMonth = computeStreak(daysMonthBoundary, '2026-11-01', streakCfg);
assert(streakResMonth.current === 2, `streak across Oct 31 - Nov 1 should be 2, got ${streakResMonth.current}`);
assert(streakResMonth.best === 2, `best streak across Oct 31 - Nov 1 should be 2, got ${streakResMonth.best}`);

console.log('--- 5. Testing isoWeekKey across month boundary ---');
// Oct 31, 2026 is Saturday, Nov 1, 2026 is Sunday -> same ISO week W44
const wkOct31 = isoWeekKey('2026-10-31');
const wkNov1 = isoWeekKey('2026-11-01');
assert(wkOct31 === wkNov1, `Oct 31 and Nov 1 should share same ISO week key: got ${wkOct31} and ${wkNov1}`);
assert(wkOct31 === '2026-W44', `Expected 2026-W44, got ${wkOct31}`);

console.log('--- 6. Testing migration & day merging ---');
const testState = {
  days: {
    '2026-10-9': {
      date: '2026-10-9',
      distanceM: 1000,
      walkSeconds: 600,
      tokensEarned: 200,
      tokensSpent: 0,
      missions: [
        { id: 'm1', type: 'GO', title: 'Park 1', reward: 100, date: '2026-10-9' },
        { id: 'm2', type: 'LOOK', title: 'Look 1', reward: 100, date: '2026-10-9' }
      ],
      bonuses: [{ reason: 'Daily Goal', amount: 300, ts: 1000 }]
    },
    '2026-10-09': {
      date: '2026-10-09',
      distanceM: 1500,
      walkSeconds: 900,
      tokensEarned: 300,
      tokensSpent: 50,
      missions: [
        { id: 'm1', type: 'GO', title: 'Park 1', reward: 100, date: '2026-10-09' }, // duplicate id
        { id: 'm3', type: 'LEARN', title: 'Learn 1', reward: 100, date: '2026-10-09' }
      ],
      bonuses: [{ reason: 'Streak 3', amount: 300, ts: 2000 }]
    }
  },
  missions: [
    { id: 'm4', status: 'done', date: '2026-10-9', completedAt: 5000, type: 'GO', title: 'Old Array Mission' }
  ],
  claimedBonuses: {
    'goal:day:2026-10-9': true,
    'streak:2026-10-9:3': true
  }
};

const migrated = migrateState(testState);

// Check that unpadded key is merged into padded key
assert(!migrated.days['2026-10-9'], 'unpadded day key should no longer exist');
assert(migrated.days['2026-10-09'], 'padded day key 2026-10-09 should exist');

const mergedDay = migrated.days['2026-10-09'];
assert(mergedDay.distanceM === 2500, `distanceM should sum to 2500, got ${mergedDay.distanceM}`);
assert(mergedDay.walkSeconds === 1500, `walkSeconds should sum to 1500, got ${mergedDay.walkSeconds}`);
assert(mergedDay.tokensEarned === 500, `tokensEarned should sum to 500, got ${mergedDay.tokensEarned}`);
assert(mergedDay.tokensSpent === 50, `tokensSpent should be 50, got ${mergedDay.tokensSpent}`);

// Missions should include m1, m2, m3 from days plus m4 from old missions array, deduplicated
const missionIds = mergedDay.missions.map(m => m.id);
assert(missionIds.includes('m1'), 'should include m1');
assert(missionIds.includes('m2'), 'should include m2');
assert(missionIds.includes('m3'), 'should include m3');
assert(missionIds.includes('m4'), 'should include m4 from old array');
assert(mergedDay.missions.filter(m => m.id === 'm1').length === 1, 'm1 must be de-duplicated');

// Bonuses merged
assert(mergedDay.bonuses.length === 2, `bonuses should merge to 2, got ${mergedDay.bonuses.length}`);

// Claimed bonuses normalized
assert(migrated.claimedBonuses['goal:day:2026-10-09'] === true, 'goal bonus date normalized');
assert(migrated.claimedBonuses['streak:2026-10-09:3'] === true, 'streak bonus date normalized');

// Camera exif default
assert(migrated.cameraExif === true, 'cameraExif should default to true');

console.log('--- 7. Testing formatDistance ---');
import { formatDistance } from '../src/utils/format.js';
assert(formatDistance(24) === '24 m', `expected '24 m', got ${formatDistance(24)}`);
assert(formatDistance(999) === '999 m', `expected '999 m', got ${formatDistance(999)}`);
assert(formatDistance(1200) === '1.2 km', `expected '1.2 km', got ${formatDistance(1200)}`);
assert(formatDistance(3000) === '3 km', `expected '3 km', got ${formatDistance(3000)}`);
assert(formatDistance(0) === '0 m', `expected '0 m', got ${formatDistance(0)}`);

console.log('--- 8. Testing proofFlow state machine ---');
import { proofFlowReducer, PROOF_STATES, PROOF_EVENTS, initialProofState } from '../src/missions/proofFlow.js';

// 8.1 USE_ANYWAY reaches saving
let s1 = initialProofState();
s1 = proofFlowReducer(s1, { type: PROOF_EVENTS.START_CAMERA });
assert(s1.state === PROOF_STATES.CAMERA, `expected camera state, got ${s1.state}`);
s1 = proofFlowReducer(s1, { type: PROOF_EVENTS.TAKEN, photo: { uri: 'file:///photo.jpg' } });
assert(s1.state === PROOF_STATES.REVIEW, `expected review state, got ${s1.state}`);
s1 = proofFlowReducer(s1, { type: PROOF_EVENTS.USE_ANYWAY });
assert(s1.state === PROOF_STATES.SAVING, `USE_ANYWAY must reach saving state, got ${s1.state}`);
assert(s1.acceptDark === true, 'acceptDark must be true for USE_ANYWAY');

// 8.2 An error keeps the photo
s1 = proofFlowReducer(s1, { type: PROOF_EVENTS.STAGE_FAIL, error: 'GPS accuracy too low' });
assert(s1.state === PROOF_STATES.ERROR, `expected error state, got ${s1.state}`);
assert(s1.photo && s1.photo.uri === 'file:///photo.jpg', 'an error must keep the photo in component state');
assert(s1.failedStage === 'saving', `expected failedStage saving, got ${s1.failedStage}`);

// 8.3 RETRY resumes at the failed stage
s1 = proofFlowReducer(s1, { type: PROOF_EVENTS.RETRY });
assert(s1.state === PROOF_STATES.SAVING, `RETRY must resume at failed stage (saving), got ${s1.state}`);
assert(s1.error === null, 'RETRY should clear error');

// Verify locating stage error and retry
s1 = proofFlowReducer(s1, { type: PROOF_EVENTS.STAGE_OK, savedUri: 'file:///saved.jpg' });
assert(s1.state === PROOF_STATES.LOCATING, `expected locating state, got ${s1.state}`);
s1 = proofFlowReducer(s1, { type: PROOF_EVENTS.STAGE_FAIL, error: 'Location timed out' });
assert(s1.state === PROOF_STATES.ERROR, `expected error state, got ${s1.state}`);
assert(s1.failedStage === 'locating', `expected failedStage locating, got ${s1.failedStage}`);
assert(s1.savedUri === 'file:///saved.jpg', 'error must keep savedUri');
s1 = proofFlowReducer(s1, { type: PROOF_EVENTS.RETRY });
assert(s1.state === PROOF_STATES.LOCATING, `RETRY must resume at locating, got ${s1.state}`);

// 8.4 CANCEL returns to idle
s1 = proofFlowReducer(s1, { type: PROOF_EVENTS.CANCEL });
assert(s1.state === PROOF_STATES.IDLE, `CANCEL must return to idle, got ${s1.state}`);
assert(s1.photo === null, 'CANCEL must clear photo');

console.log('--- 9. Testing history sorting with unpadded and padded legacy keys ---');
const legacyDayKeys = ['2026-10-9', '2026-10-10', '2026-9-30', '2026-10-01'];
const historySorted = legacyDayKeys.map(normalizeDateStr).filter((v, i, a) => a.indexOf(v) === i).sort().reverse();
assert(historySorted[0] === '2026-10-10', `first (newest) must be 2026-10-10, got ${historySorted[0]}`);
assert(historySorted[1] === '2026-10-09', `second must be 2026-10-09, got ${historySorted[1]}`);
assert(historySorted[2] === '2026-10-01', `third must be 2026-10-01, got ${historySorted[2]}`);
assert(historySorted[3] === '2026-09-30', `fourth must be 2026-09-30, got ${historySorted[3]}`);

console.log('ALL check_progress.js tests PASSED!');

// Test journal and toast logic
import assert from 'assert';

console.log('--- 1. Testing Journal Note Updates & Fallback Synthesis ---');

// Mock state and store logic
let mockState = {
  journal: [],
  days: {
    '2026-10-11': {
      missions: [
        { id: 'look_shadow_1', type: 'LOOK', title: 'Find: an interesting shadow', completedAt: 1728669000000 }
      ]
    }
  }
};

function updateJournalNote(id, note, fallbackEntry = null) {
  const cleanNote = typeof note === 'string' ? note.trim() : '';
  const missionIdTarget = id && typeof id === 'string' && id.startsWith('legacy_')
    ? id.slice(7)
    : (fallbackEntry?.missionId || id);
  
  let newJournal = [...(mockState.journal || [])];
  const jIdx = newJournal.findIndex(j => 
    j.id === id || 
    j.missionId === id || 
    j.missionId === missionIdTarget || 
    `legacy_${j.missionId}` === id ||
    (fallbackEntry && (j.id === fallbackEntry.id || (j.missionId && j.missionId === fallbackEntry.missionId)))
  );

  if (jIdx >= 0) {
    newJournal[jIdx] = { ...newJournal[jIdx], note: cleanNote };
  } else if (fallbackEntry) {
    const entryToInsert = {
      ...fallbackEntry,
      id: fallbackEntry.id || `journal_${missionIdTarget || Date.now()}`,
      missionId: fallbackEntry.missionId || missionIdTarget,
      note: cleanNote
    };
    newJournal = [entryToInsert, ...newJournal].slice(0, 200);
  }

  const newDays = { ...mockState.days };
  let daysChanged = false;
  for (const [dateStr, day] of Object.entries(newDays)) {
    if (day.missions && day.missions.length > 0) {
      const mIdx = day.missions.findIndex(m => m.id === id || m.id === missionIdTarget);
      if (mIdx >= 0 && day.missions[mIdx].note !== cleanNote) {
        const updatedMissions = [...day.missions];
        updatedMissions[mIdx] = { ...updatedMissions[mIdx], note: cleanNote };
        newDays[dateStr] = { ...day, missions: updatedMissions };
        daysChanged = true;
      }
    }
  }

  mockState.journal = newJournal;
  if (daysChanged) mockState.days = newDays;
}

// Simulate user editing synthesized mission 'legacy_look_shadow_1'
const synthesizedEntry = {
  id: 'legacy_look_shadow_1',
  missionId: 'look_shadow_1',
  type: 'LOOK',
  title: 'Find: an interesting shadow',
  completedAt: 1728669000000,
  note: ''
};

// 1. User saves note "Hi"
updateJournalNote('legacy_look_shadow_1', 'Hi', synthesizedEntry);

assert.strictEqual(mockState.journal.length, 1, 'Journal must now contain the saved entry');
assert.strictEqual(mockState.journal[0].note, 'Hi', 'Saved journal entry must have note "Hi"');
assert.strictEqual(mockState.journal[0].missionId, 'look_shadow_1', 'Mission ID must be preserved');
assert.strictEqual(mockState.days['2026-10-11'].missions[0].note, 'Hi', 'Days history must also have synced note "Hi"');

// 2. User edits the same note again to "Beautiful sunset shadow"
updateJournalNote('legacy_look_shadow_1', 'Beautiful sunset shadow', mockState.journal[0]);
assert.strictEqual(mockState.journal.length, 1, 'Should update existing entry without duplicating');
assert.strictEqual(mockState.journal[0].note, 'Beautiful sunset shadow');

// 3. User edits by missionId directly
updateJournalNote('look_shadow_1', 'Updated via mission ID', mockState.journal[0]);
assert.strictEqual(mockState.journal.length, 1, 'Should update existing entry');
assert.strictEqual(mockState.journal[0].note, 'Updated via mission ID');

console.log('--- 2. Testing Toast Queue Mechanics ---');
let toastQueue = [];
let queueChanges = [];
function pushToast(t) {
  toastQueue.push(t);
  queueChanges.push([...toastQueue]);
}
function shiftToast() {
  toastQueue.shift();
  queueChanges.push([...toastQueue]);
}

pushToast({ id: 1, message: 'Badge: First Step' });
pushToast({ id: 2, message: 'Badge: 5K Wanderer' });
assert.strictEqual(toastQueue.length, 2);
shiftToast();
assert.strictEqual(toastQueue.length, 1);
assert.strictEqual(toastQueue[0].id, 2);
shiftToast();
assert.strictEqual(toastQueue.length, 0);

console.log('ALL check_journal_toast.js tests PASSED!');

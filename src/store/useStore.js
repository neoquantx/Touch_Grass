import { migrateState } from './migrate.js';
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import * as FileSystem from 'expo-file-system/legacy';
import { CONFIG } from '../config.js';
import { daysBetween, todayString, normalizeDateStr } from '../utils/date.js';

const fileStorage = {
  getItem: async (name) => {
    const uri = `${FileSystem.documentDirectory}${name}.json`;
    try {
      const info = await FileSystem.getInfoAsync(uri);
      if (info.exists) {
        const text = await FileSystem.readAsStringAsync(uri);
        try {
          JSON.parse(text);
          return text;
        } catch (err) {
          console.warn('Corrupt state file:', err);
          // Return null to fallback to initial state.
          // Store a global flag to warn in UI
          useStore.getState().setCorruptStateWarning?.(true);
          return null;
        }
      }
    } catch (e) {
      console.warn('fileStorage getItem error:', e);
    }
    return null;
  },
  setItem: async (name, value) => {
    const uri = `${FileSystem.documentDirectory}${name}.json`;
    try {
      await FileSystem.writeAsStringAsync(uri, value);
    } catch (e) {
      console.warn('fileStorage setItem error:', e);
    }
  },
  removeItem: async (name) => {
    const uri = `${FileSystem.documentDirectory}${name}.json`;
    try {
      await FileSystem.deleteAsync(uri, { idempotent: true });
    } catch (e) {
      console.warn('fileStorage removeItem error:', e);
    }
  },
};

export const useStore = create(
  persist(
    (set, get) => ({
      modelReady: false,
      setModelReady: (ready) => set({ modelReady: ready }),
      
      area: null,
      setArea: (area) => set({ area }),
      clearArea: () => set({ area: null }),
      
      tokens: 0,
      addTokens: (amount) => set((state) => ({ tokens: state.tokens + amount })),
      spendTokens: (amount) => set((state) => ({ tokens: Math.max(0, state.tokens - amount) })),
      
      visitedIds: [],
      addVisited: (id) => set((state) => ({ 
        visitedIds: state.visitedIds.includes(id) ? state.visitedIds : [...state.visitedIds, id] 
      })),
      
      lastMissionDate: null,
      setLastMissionDate: (dateStr) => set({ lastMissionDate: dateStr ? normalizeDateStr(dateStr) : null }),
      
      missions: null,
      setMissions: (missions) => set({ missions }),
      
      cameraExif: true,
      setCameraExif: (cameraExif) => set({ cameraExif: !!cameraExif }),
      
      days: {},
      claimedBonuses: {},
      ledgerCarry: 0,

      walk: null,
      lastPhotoInfo: null,
      setLastPhotoInfo: (info) => set({ lastPhotoInfo: info }),

      unlockedBadges: {},
      unlockBadge: (badgeId, badgeData) => set((state) => ({
        unlockedBadges: { ...state.unlockedBadges, [badgeId]: badgeData || { unlockedAt: Date.now() } }
      })),

      companionPersona: 'nature',
      setCompanionPersona: (persona) => set({ companionPersona: persona }),

      replaceMissionSlot: (type, mission) => set((state) => {
        if (!state.missions || !state.missions.items) return state;
        return {
          missions: {
            ...state.missions,
            items: state.missions.items.filter(m => m.type !== type).concat(mission ? [mission] : [])
          }
        };
      }),
      
      skipMission: (id) => set((state) => {
        if (!state.missions || !state.missions.items) return state;
        const m = state.missions.items.find(x => x.id === id);
        if (!m) return state;
        const newSkips = { ...state.missions.skips, [m.type]: (state.missions.skips[m.type] || 0) + 1 };
        const newSkippedIds = m.elementId ? [...state.missions.skippedIds, m.elementId] : state.missions.skippedIds;
        return {
          missions: {
            ...state.missions,
            skips: newSkips,
            skippedIds: newSkippedIds,
            items: state.missions.items.filter(x => x.id !== id)
          }
        };
      }),
      
      
      updateWalkRewarded: (dateStr, addM) => set((state) => {
        if (!state.days[dateStr]) return state;
        return {
          days: {
            ...state.days,
            [dateStr]: {
              ...state.days[dateStr],
              distanceRewardedM: (state.days[dateStr].distanceRewardedM || 0) + addM
            }
          }
        };
      }),
      
      setWalkState: (walkState) => set({ walk: walkState }),
      addWalkDistance: (addedM, seconds, ts) => set((state) => {
        const dateStr = ts ? todayString(new Date(ts)) : todayString();
        const newDays = { ...state.days };
        if (!newDays[dateStr]) {
          newDays[dateStr] = { date: dateStr, missions: [], distanceM: 0, distanceRewardedM: 0, walkSeconds: 0, walkSessions: 0, tokensEarned: 0, tokensSpent: 0, bonuses: [] };
        }
        newDays[dateStr] = {
          ...newDays[dateStr],
          distanceM: (newDays[dateStr].distanceM || 0) + addedM,
          walkSeconds: (newDays[dateStr].walkSeconds || 0) + seconds,
          walkSessions: seconds > 0 ? (newDays[dateStr].walkSessions || 0) + 1 : (newDays[dateStr].walkSessions || 0)
        };
        return { days: newDays };
      }),
      
      addBonus: (bonus) => set((state) => {
        if (state.claimedBonuses[bonus.key]) return state; // idempotent
        const dateStr = bonus.ts ? todayString(new Date(bonus.ts)) : todayString();
        const newDays = { ...state.days };
        if (!newDays[dateStr]) {
          newDays[dateStr] = { date: dateStr, missions: [], distanceM: 0, distanceRewardedM: 0, walkSeconds: 0, walkSessions: 0, tokensEarned: 0, tokensSpent: 0, bonuses: [] };
        }
        newDays[dateStr] = {
          ...newDays[dateStr],
          bonuses: [...newDays[dateStr].bonuses, bonus]
        };
        return {
          claimedBonuses: { ...state.claimedBonuses, [bonus.key]: true },
          days: newDays
        };
      }),

      completeMission: (id, updates) => set((state) => {
        if (!state.missions || !state.missions.items) return state;
        const dateStr = todayString();
        
        const mIndex = state.missions.items.findIndex(x => x.id === id);
        if (mIndex === -1) return state;
        const m = state.missions.items[mIndex];
        if (m.status === 'done' || (m.date && normalizeDateStr(m.date) !== dateStr)) return state; // idempotent & date guard
        
        const updatedM = { ...m, status: 'done', completedAt: Date.now(), ...updates };
        
        const newMissions = { ...state.missions };
        newMissions.items = [...newMissions.items];
        newMissions.items[mIndex] = updatedM;
        newMissions.doneCounts = { ...newMissions.doneCounts, [m.type]: (newMissions.doneCounts[m.type] || 0) + 1 };
        
        const newDays = { ...state.days };
        if (!newDays[dateStr]) {
          newDays[dateStr] = { date: dateStr, missions: [], distanceM: 0, distanceRewardedM: 0, walkSeconds: 0, walkSessions: 0, tokensEarned: 0, tokensSpent: 0, bonuses: [] };
        }
        
        newDays[dateStr] = { ...newDays[dateStr], missions: [...newDays[dateStr].missions, {
          id: updatedM.id, type: updatedM.type, title: updatedM.title, category: updatedM.element?.category,
          reward: updatedM.reward || 0, completedAt: updatedM.completedAt, proofUri: updatedM.photoUri || updatedM.proofUri,
          lat: updatedM.element?.lat, lon: updatedM.element?.lon
        }]};

        // Automatically record into Explorer's Field Journal
        const journalItem = {
          id: `journal_${updatedM.id}_${Date.now()}`,
          missionId: updatedM.id,
          type: updatedM.type,
          title: updatedM.title,
          category: updatedM.element?.category || (updatedM.type === 'LOOK' ? 'scavenger' : 'park'),
          date: dateStr,
          completedAt: updatedM.completedAt,
          photoUri: updatedM.photoUri || updatedM.proofUri || null,
          lat: updatedM.element?.lat ?? null,
          lon: updatedM.element?.lon ?? null,
          fact: updatedM.fact || null,
          factSource: updatedM.factSource || null,
          tags: updatedM.element?.tags || null,
          note: ''
        };

        const existingJIndex = (state.journal || []).findIndex(j => j.missionId === updatedM.id);
        let newJournal = [...(state.journal || [])];
        if (existingJIndex >= 0) {
          newJournal[existingJIndex] = {
            ...newJournal[existingJIndex],
            photoUri: journalItem.photoUri || newJournal[existingJIndex].photoUri,
            fact: journalItem.fact !== null ? journalItem.fact : newJournal[existingJIndex].fact,
            factSource: journalItem.factSource !== null ? journalItem.factSource : newJournal[existingJIndex].factSource
          };
        } else {
          newJournal = [journalItem, ...newJournal].slice(0, 200);
        }
        
        return {
          missions: newMissions,
          days: newDays,
          journal: newJournal
        };
      }),

      setMissionFlavor: (id, text) => set((state) => {
        if (!state.missions || !state.missions.items) return state;
        return {
          missions: {
            ...state.missions,
            items: state.missions.items.map(m => m.id === id ? { ...m, flavor: text } : m)
          }
        };
      }),
      setMissionFact: (id, fact, factSource) => set((state) => {
        if (!state.missions || !state.missions.items) return state;
        return {
          missions: {
            ...state.missions,
            items: state.missions.items.map(m => m.id === id ? { ...m, fact, factSource } : m)
          }
        };
      }),
      
      lastTps: null,
      setLastTps: (tps) => set({ lastTps: tps }),
      
      llmState: 'idle',
      setLlmState: (state) => set({ llmState: state }),
      
      journal: [],
      addJournalEntry: (entry) => set((state) => ({
        journal: [entry, ...(state.journal || [])].slice(0, 200)
      })),
      updateJournalNote: (id, note, fallbackEntry = null) => set((state) => {
        const cleanNote = typeof note === 'string' ? note.trim() : '';
        const missionIdTarget = id && typeof id === 'string' && id.startsWith('legacy_')
          ? id.slice(7)
          : (fallbackEntry?.missionId || id);
        
        let newJournal = [...(state.journal || [])];
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

        // Also sync note into state.days if mission exists there
        const newDays = { ...state.days };
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

        return {
          journal: newJournal,
          ...(daysChanged ? { days: newDays } : {})
        };
      }),
      deleteJournalEntry: (id) => set((state) => {
        const missionIdTarget = id && typeof id === 'string' && id.startsWith('legacy_') ? id.slice(7) : id;
        return {
          journal: (state.journal || []).filter(j => 
            j.id !== id && 
            j.missionId !== id && 
            j.missionId !== missionIdTarget &&
            `legacy_${j.missionId}` !== id
          )
        };
      }),
      
      hasHydrated: false,
      setHasHydrated: (state) => set({ hasHydrated: state }),
      
      corruptStateWarning: false,
      setCorruptStateWarning: (warn) => set({ corruptStateWarning: warn }),

      ledger: [],
      addLedgerEntry: (amount, reason) => set((state) => {
        
        const max = CONFIG.HISTORY.ledgerMax || 200;
        const newLedger = [{ time: Date.now(), amount, reason }, ...state.ledger];
        
        let carry = state.ledgerCarry || 0;
        if (newLedger.length > max) {
          const pruned = newLedger.splice(max);
          carry += pruned.reduce((sum, item) => sum + item.amount, 0);
        }
        
        // update days[date]
        const dateStr = todayString();
        const newDays = { ...state.days };
        if (!newDays[dateStr]) {
          newDays[dateStr] = { date: dateStr, missions: [], distanceM: 0, distanceRewardedM: 0, walkSeconds: 0, walkSessions: 0, tokensEarned: 0, tokensSpent: 0, bonuses: [] };
        }
        if (amount > 0) {
          newDays[dateStr].tokensEarned = (newDays[dateStr].tokensEarned || 0) + amount;
        } else if (amount < 0) {
          newDays[dateStr].tokensSpent = (newDays[dateStr].tokensSpent || 0) + Math.abs(amount);
        }
        
        return {
          ledger: newLedger,
          ledgerCarry: carry,
          days: newDays
        };
      }),

      pruneHistory: () => set((state) => {
        const todayStr = todayString();
        const newDays = { ...state.days };
        const keepDays = CONFIG.HISTORY.keepDays || 120;
        
        for (const date of Object.keys(newDays)) {
          if (daysBetween(date, todayStr) > keepDays) {
            delete newDays[date];
          }
        }
        return { days: newDays };
      }),


      resetProgress: async () => {
        set({
          tokens: 0,
          visitedIds: [],
          missions: null,
          ledger: [],
          ledgerCarry: 0,
          journal: [],
          unlockedBadges: {},
          companionPersona: 'nature',
          lastMissionDate: null,
          days: {},
          claimedBonuses: {},
          walk: null
        });
        try {
          await FileSystem.deleteAsync(`${FileSystem.documentDirectory}proofs`, { idempotent: true });
        } catch (e) {
          console.warn('Failed to delete proofs:', e);
        }
      },

      resetEverything: async () => {
        const { resetProgress } = get();
        await resetProgress();
        set({ modelReady: false, area: null });
      }
    }),
    {
      name: 'state',
      version: 5,
      storage: createJSONStorage(() => fileStorage),
      partialize: (state) => {
        const { llmState, hasHydrated, corruptStateWarning, ...rest } = state;
        return rest;
      },
      migrate: (persistedState, version) => {
        let state = { ...persistedState };
        if (version < 2) {
          state.lastTps = state.lastTps || null;
        }
        if (version < 3) {
          state.ledger = state.ledger || [];
        }
        if (version < 5) {
          state = migrateState(state);
        }
        return state;
      },
      onRehydrateStorage: () => (state, error) => {
        if (error) {
          console.warn('Hydration error:', error);
          if (state) state.setCorruptStateWarning(true);
        }
        if (state) {
          const current = useStore.getState();
          const normalized = migrateState(current);
          useStore.setState(normalized);
          state.setHasHydrated(true);
        }
      }
    }
  )
);

export const selectIsSetupComplete = (state) => state.modelReady && state.area !== null;

export const llmStore = {
  getState: () => useStore.getState().llmState,
  setState: (newState) => useStore.getState().setLlmState(newState),
  subscribe: (listener) => useStore.subscribe((state) => listener(state.llmState)),
};

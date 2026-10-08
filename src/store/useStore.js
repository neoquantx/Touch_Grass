import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import * as FileSystem from 'expo-file-system/legacy';

const fileStorage = {
  getItem: async (name) => {
    const uri = `${FileSystem.documentDirectory}${name}.json`;
    try {
      const info = await FileSystem.getInfoAsync(uri);
      if (info.exists) {
        return await FileSystem.readAsStringAsync(uri);
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
      
      missions: null,
      journal: [],
      
      hasHydrated: false,
      setHasHydrated: (state) => set({ hasHydrated: state })
    }),
    {
      name: 'state',
      storage: createJSONStorage(() => fileStorage),
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      }
    }
  )
);

export const selectIsSetupComplete = (state) => state.modelReady && state.area !== null;

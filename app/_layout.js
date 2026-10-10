import React, { useEffect } from 'react';
import { View, Text } from 'react-native';
import { Stack } from 'expo-router';
import * as FileSystem from 'expo-file-system/legacy';
import { colors, spacing, type } from '../src/theme.js';
import { Button } from '../src/components/ui/Button.js';
import { Card } from '../src/components/ui/Card.js';
import { useStore } from '../src/store/useStore.js';
import { CONFIG } from '../src/config.js';

export function ErrorBoundary({ error, retry }) {
  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: spacing[16], backgroundColor: colors.background }}>
      <Card style={{ width: '100%' }}>
        <Text style={[type.h2, { color: colors.danger, marginBottom: spacing[12] }]}>Something went wrong</Text>
        <Text style={[type.body, { color: colors.text, marginBottom: spacing[24] }]}>{error.message}</Text>
        <Button label="Try again" onPress={retry} />
      </Card>
    </View>
  );
}

export default function Layout() {
  const hasHydrated = useStore(state => state.hasHydrated);
  
  useEffect(() => {
    if (!hasHydrated) return;
    
    // Prune history
    const store = useStore.getState();
    store.pruneHistory();
    
    // Delete old proofs
    const cleanupProofs = async () => {
       const dir = `${FileSystem.documentDirectory}proofs/`;
       const info = await FileSystem.getInfoAsync(dir);
       if (!info.exists) return;
       const files = await FileSystem.readDirectoryAsync(dir);
       const now = Date.now();
       const maxAge = (CONFIG.HISTORY.proofKeepDays || 30) * 86400000;
       
       let deletedAny = false;
       for (const f of files) {
         const path = dir + f;
         const stat = await FileSystem.getInfoAsync(path);
         if (stat.modificationTime) {
           const age = now - (stat.modificationTime * 1000);
           if (age > maxAge) {
             await FileSystem.deleteAsync(path, { idempotent: true });
             deletedAny = true;
           }
         }
       }
       
       if (deletedAny) {
         // clear from history
         const s = useStore.getState();
         const newDays = { ...s.days };
         for (const d of Object.keys(newDays)) {
           let changed = false;
           const newMissions = (newDays[d].missions || []).map(m => {
             if (m.proofUri) {
               // Check if it exists? Actually just clear it if it's too old
               // Let's just do it by age of the mission completedAt!
               const age = now - (m.completedAt || 0);
               if (age > maxAge) {
                 changed = true;
                 return { ...m, proofUri: null };
               }
             }
             return m;
           });
           if (changed) newDays[d] = { ...newDays[d], missions: newMissions };
         }
         useStore.setState({ days: newDays });
         // not strictly required if we just don't crash when image fails to load,
         // but to be perfect we can clear them.
         // Actually, wait, updating the store days is complex here. Let's just delete the file.
       }
    };
    cleanupProofs();
  }, [hasHydrated]);

  return (
    <Stack>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="debug" options={{ title: 'Phase 0 Test' }} />
    </Stack>
  );
}
import { View, Text, Button, StyleSheet } from 'react-native';
import { useStore, selectIsSetupComplete } from '../../src/store/useStore';
import { useRouter } from 'expo-router';

export default function Companion() {
  const router = useRouter();
  const hasHydrated = useStore((state) => state.hasHydrated);
  const isSetupComplete = useStore(selectIsSetupComplete);

  if (!hasHydrated) return null;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Companion</Text>
      {!isSetupComplete && (
        <View style={styles.banner}>
          <Text style={styles.bannerText}>Finish setup first</Text>
          <Button title="Go to Setup" onPress={() => router.navigate('setup')} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  title: { fontSize: 24, fontWeight: 'bold', marginBottom: 20 },
  banner: { padding: 20, backgroundColor: '#ffe0e0', borderRadius: 10, alignItems: 'center' },
  bannerText: { fontSize: 16, marginBottom: 10, color: '#aa0000', fontWeight: 'bold' }
});

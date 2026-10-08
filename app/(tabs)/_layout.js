import { Tabs } from 'expo-router';

export default function TabsLayout() {
  return (
    <Tabs screenOptions={{
      tabBarActiveTintColor: '#000000',
      tabBarInactiveTintColor: '#666666',
      tabBarLabelStyle: { fontSize: 14, fontWeight: 'bold' },
      tabBarStyle: { height: 60, paddingBottom: 8, backgroundColor: '#ffffff' },
      headerStyle: { backgroundColor: '#ffffff' },
      headerTitleStyle: { color: '#000000' }
    }}>
      <Tabs.Screen name="index" options={{ title: 'Missions' }} />
      <Tabs.Screen name="companion" options={{ title: 'Companion' }} />
      <Tabs.Screen name="journal" options={{ title: 'Journal' }} />
      <Tabs.Screen name="setup" options={{ title: 'Setup' }} />
    </Tabs>
  );
}

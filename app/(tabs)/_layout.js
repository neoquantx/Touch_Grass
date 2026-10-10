import React from 'react';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, type } from '../../src/theme.js';

export default function TabsLayout() {
  const insets = useSafeAreaInsets();
  return (
    <Tabs screenOptions={{
      headerShown: false,
      tabBarActiveTintColor: colors.primary,
      tabBarInactiveTintColor: colors.textMuted,
      tabBarLabelStyle: { fontSize: type.label.fontSize, fontWeight: type.label.fontWeight, textTransform: 'none' },
      tabBarStyle: {
        height: 60 + insets.bottom,
        paddingBottom: insets.bottom,
        paddingTop: 8,
        backgroundColor: colors.surface,
        borderTopWidth: 1,
        borderTopColor: colors.border
      }
    }}>
      <Tabs.Screen name="index" options={{
        title: 'Today',
        tabBarIcon: ({ color, focused }) => <Ionicons name={focused ? 'today' : 'today-outline'} size={24} color={color} />
      }} />
      <Tabs.Screen name="history" options={{
        title: 'History',
        tabBarIcon: ({ color, focused }) => <Ionicons name={focused ? 'calendar' : 'calendar-outline'} size={24} color={color} />
      }} />
      <Tabs.Screen name="companion" options={{
        title: 'Companion',
        tabBarIcon: ({ color, focused }) => <Ionicons name={focused ? 'chatbubble-ellipses' : 'chatbubble-ellipses-outline'} size={24} color={color} />
      }} />
      <Tabs.Screen name="setup" options={{
        title: 'Setup',
        tabBarIcon: ({ color, focused }) => <Ionicons name={focused ? 'settings' : 'settings-outline'} size={24} color={color} />
      }} />
    </Tabs>
  );
}

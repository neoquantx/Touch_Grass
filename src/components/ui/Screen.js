import React from 'react';
import { View, ScrollView, Text, StatusBar } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, spacing, type } from '../../theme.js';

export function Screen({ children, title, rightSlot, scroll = false, style }) {
  const insets = useSafeAreaInsets();
  
  const content = (
    <View style={[{ flex: 1, paddingBottom: insets.bottom, backgroundColor: colors.bg }, style]}>
      {title && (
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: spacing[16] }}>
          <Text style={[type.title, { color: colors.text }]}>{title}</Text>
          {rightSlot && <View>{rightSlot}</View>}
        </View>
      )}
      {children}
    </View>
  );
  
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />
      <View style={{ height: insets.top, backgroundColor: colors.bg, zIndex: 1 }} />
      {scroll ? <ScrollView style={{ flex: 1, backgroundColor: colors.bg }}>{content}</ScrollView> : content}
    </View>
  );
}

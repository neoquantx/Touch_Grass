import React from 'react';
import { View, Text } from 'react-native';
import { radius, spacing, type } from '../../theme.js';

export function Chip({ label, bgColor, textColor, icon }) {
  return (
    <View style={{ backgroundColor: bgColor, borderRadius: radius.pill, paddingVertical: spacing[4], paddingHorizontal: spacing[12], flexDirection: 'row', alignItems: 'center' }}>
      {icon && <View style={{ marginRight: spacing[4] }}>{icon}</View>}
      <Text style={[type.label, { color: textColor }]}>{label}</Text>
    </View>
  );
}

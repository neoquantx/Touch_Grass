import React from 'react';
import { View } from 'react-native';
import { colors, radius, spacing } from '../../theme.js';

export function Card({ children, style }) {
  return (
    <View style={[{ backgroundColor: colors.surface, borderRadius: radius[16], padding: spacing[16] }, style]}>
      {children}
    </View>
  );
}

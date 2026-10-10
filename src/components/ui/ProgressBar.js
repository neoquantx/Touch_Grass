import React from 'react';
import { View } from 'react-native';
import { colors, radius } from '../../theme.js';

export function ProgressBar({ progress }) {
  const bounded = Math.max(0, Math.min(1, progress));
  return (
    <View style={{ height: 8, backgroundColor: colors.surfaceAlt, borderRadius: radius.pill, overflow: 'hidden' }}>
      <View style={{ height: '100%', width: `${bounded * 100}%`, backgroundColor: colors.primary }} />
    </View>
  );
}

import React from 'react';
import { View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { radius } from '../../theme.js';

export function IconCircle({ name, color, bgColor, size = 40 }) {
  return (
    <View style={{ width: size, height: size, borderRadius: radius.pill, backgroundColor: bgColor, alignItems: 'center', justifyContent: 'center' }}>
      <Ionicons name={name} size={size * 0.6} color={color} />
    </View>
  );
}

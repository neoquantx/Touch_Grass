import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { radius } from '../../theme.js';

export function IconCircle({ name, color, bgColor, size = 44, style }) {
  return (
    <View
      style={[
        styles.circle,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: bgColor
        },
        style
      ]}
    >
      <Ionicons name={name} size={Math.round(size * 0.52)} color={color} />
    </View>
  );
}

const styles = StyleSheet.create({
  circle: {
    alignItems: 'center',
    justifyContent: 'center'
  }
});

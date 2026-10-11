import React from 'react';
import { View, StyleSheet } from 'react-native';
import { colors, radius, spacing, shadows } from '../../theme.js';

export function Card({ children, style, variant = 'default' }) {
  const variantStyles = {
    default: {
      backgroundColor: colors.surface,
      borderColor: colors.borderSubtle,
      ...shadows.card
    },
    flat: {
      backgroundColor: colors.surface,
      borderColor: colors.border,
      ...shadows.none
    },
    elevated: {
      backgroundColor: colors.surface,
      borderColor: colors.borderSubtle,
      ...shadows.floating
    },
    surfaceAlt: {
      backgroundColor: colors.surfaceAlt,
      borderColor: colors.borderSubtle,
      ...shadows.none
    },
    tinted: {
      backgroundColor: colors.primarySoft,
      borderColor: colors.primarySoftBorder,
      ...shadows.subtle
    }
  };

  const selected = variantStyles[variant] || variantStyles.default;

  return (
    <View
      style={[
        styles.base,
        selected,
        style
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radius[20],
    padding: spacing[16],
    borderWidth: 1
  }
});

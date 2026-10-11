import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, spacing, type } from '../../theme.js';
import { Button } from './Button.js';

export function EmptyState({ icon, title, body, action, style }) {
  return (
    <View style={[styles.container, style]}>
      {icon && (
        <View style={styles.outerRing}>
          <View style={styles.innerCircle}>
            <Ionicons name={icon} size={36} color={colors.primary} />
          </View>
        </View>
      )}
      <Text style={[type.h2, styles.title]}>{title}</Text>
      <Text style={[type.body, styles.body]}>{body}</Text>
      {action && (
        <Button
          label={action.label}
          onPress={action.onPress}
          style={styles.actionBtn}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: spacing[28],
    alignItems: 'center',
    justifyContent: 'center'
  },
  outerRing: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing[20]
  },
  innerCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center'
  },
  title: {
    color: colors.text,
    marginBottom: spacing[8],
    textAlign: 'center'
  },
  body: {
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: spacing[24],
    maxWidth: 320
  },
  actionBtn: {
    minWidth: 160
  }
});

import React from 'react';
import { View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, type } from '../../theme.js';
import { Button } from './Button.js';

export function EmptyState({ icon, title, body, action }) {
  return (
    <View style={{ padding: spacing[24], alignItems: 'center', justifyContent: 'center' }}>
      {icon && <Ionicons name={icon} size={48} color={colors.textMuted} style={{ marginBottom: spacing[16] }} />}
      <Text style={[type.h2, { color: colors.text, marginBottom: spacing[8], textAlign: 'center' }]}>{title}</Text>
      <Text style={[type.body, { color: colors.textMuted, textAlign: 'center', marginBottom: action ? spacing[24] : 0 }]}>{body}</Text>
      {action && <Button label={action.label} onPress={action.onPress} />}
    </View>
  );
}

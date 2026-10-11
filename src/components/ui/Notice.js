import React from 'react';
import { View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, spacing, type } from '../../theme.js';
import { Button } from './Button.js';

export function Notice({ text, variant = 'info', action }) {
  let bg = colors.surfaceAlt;
  let fg = colors.text;
  let icon = 'alert-circle';

  if (variant === 'warn') {
    bg = colors.warnSoft;
    fg = colors.warnText;
    icon = 'alert-circle';
  } else if (variant === 'error') {
    bg = colors.dangerSoft;
    fg = colors.danger;
    icon = 'alert-circle';
  } else if (variant === 'success') {
    bg = colors.successSoft;
    fg = colors.success;
    icon = 'checkmark-circle';
  }

  return (
    <View style={{ backgroundColor: bg, borderRadius: radius[12], padding: spacing[12], flexDirection: 'row', alignItems: 'center' }}>
      <Ionicons name={icon} size={20} color={fg} style={{ marginRight: spacing[8] }} />
      <Text style={[type.body, { color: fg, flex: 1 }]}>{text}</Text>
      {action && <Button label={action.label} onPress={action.onPress} size="small" variant="secondary" style={{ minHeight: 0, paddingVertical: spacing[4], paddingHorizontal: spacing[8], marginLeft: spacing[8] }} />}
    </View>
  );
}

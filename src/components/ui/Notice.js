import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, spacing, type } from '../../theme.js';
import { Button } from './Button.js';

export function Notice({ text, message, title, variant = 'info', action, style }) {
  const displayText = text || message || '';

  let bg = colors.surfaceAlt;
  let fg = colors.text;
  let borderColor = colors.border;
  let iconName = 'information-circle';

  if (variant === 'warn') {
    bg = colors.warnSoft;
    fg = colors.warnText;
    borderColor = colors.warnBorder;
    iconName = 'alert-circle';
  } else if (variant === 'error') {
    bg = colors.dangerSoft;
    fg = colors.danger;
    borderColor = colors.dangerBorder;
    iconName = 'close-circle';
  } else if (variant === 'success') {
    bg = colors.successSoft;
    fg = colors.success;
    borderColor = colors.successBorder;
    iconName = 'checkmark-circle';
  }

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: bg,
          borderLeftColor: fg,
          borderColor: borderColor
        },
        style
      ]}
    >
      <Ionicons name={iconName} size={20} color={fg} style={styles.icon} />
      <View style={styles.content}>
        {title && (
          <Text style={[type.captionBold, { color: fg, marginBottom: 2 }]}>
            {title}
          </Text>
        )}
        <Text style={[type.body, { color: fg, fontSize: 14, lineHeight: 20 }]}>
          {displayText}
        </Text>
      </View>
      {action && (
        <View style={styles.actionBox}>
          <Button
            label={action.label}
            onPress={action.onPress}
            size="small"
            variant="secondary"
            style={styles.actionBtn}
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: radius[16],
    padding: spacing[12],
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderLeftWidth: 4
  },
  icon: {
    marginRight: spacing[10]
  },
  content: {
    flex: 1
  },
  actionBox: {
    marginLeft: spacing[8]
  },
  actionBtn: {
    minHeight: 32,
    paddingVertical: 4,
    paddingHorizontal: spacing[10]
  }
});

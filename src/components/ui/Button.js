import React from 'react';
import { Pressable, Text, ActivityIndicator, View } from 'react-native';
import { colors, radius, spacing, type } from '../../theme.js';

export function Button({ label, onPress, variant = 'primary', size = 'default', loading = false, disabled = false, style }) {
  const getStyles = (pressed) => {
    let bg = colors.primary;
    let text = colors.onPrimary;
    let opacity = pressed ? 0.8 : 1;
    
    if (disabled || loading) opacity = 0.5;

    if (variant === 'secondary') {
      bg = colors.surfaceAlt;
      text = colors.text;
    } else if (variant === 'ghost') {
      bg = 'transparent';
      text = colors.textMuted;
    } else if (variant === 'danger') {
      bg = colors.danger;
      text = colors.onPrimary;
    }

    return {
      container: {
        backgroundColor: bg,
        borderRadius: radius.pill,
        paddingVertical: size === 'small' ? spacing[8] : spacing[16],
        paddingHorizontal: spacing[24],
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'row',
        opacity,
        minHeight: 48,
        ...style
      },
      text: {
        ...type.body,
        fontWeight: '600',
        color: text,
      }
    };
  };

  return (
    <Pressable onPress={onPress} disabled={disabled || loading} accessibilityRole="button" accessibilityLabel={label}>
      {({ pressed }) => {
        const s = getStyles(pressed);
        return (
          <View style={s.container}>
            {loading && <ActivityIndicator color={s.text.color} style={{ marginRight: spacing[8] }} />}
            <Text style={s.text}>{label}</Text>
          </View>
        );
      }}
    </Pressable>
  );
}

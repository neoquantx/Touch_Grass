import React, { useRef } from 'react';
import { Pressable, Text, ActivityIndicator, View, Animated, StyleSheet } from 'react-native';
import { colors, radius, spacing, type, shadows } from '../../theme.js';

export function Button({
  label,
  onPress,
  variant = 'primary',
  size = 'default',
  loading = false,
  disabled = false,
  icon = null,
  style
}) {
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    Animated.spring(scaleAnim, {
      toValue: 0.97,
      useNativeDriver: true,
      speed: 40,
      bounciness: 4
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      useNativeDriver: true,
      speed: 40,
      bounciness: 4
    }).start();
  };

  const getVariantStyles = () => {
    switch (variant) {
      case 'secondary':
        return {
          container: {
            backgroundColor: colors.surfaceAlt,
            borderWidth: 1,
            borderColor: colors.border
          },
          textColor: colors.text
        };
      case 'outline':
        return {
          container: {
            backgroundColor: 'transparent',
            borderWidth: 1.5,
            borderColor: colors.primary
          },
          textColor: colors.primary
        };
      case 'ghost':
        return {
          container: {
            backgroundColor: 'transparent',
            borderWidth: 0
          },
          textColor: colors.textMuted
        };
      case 'danger':
        return {
          container: {
            backgroundColor: colors.danger,
            borderWidth: 0,
            ...shadows.subtle
          },
          textColor: colors.onPrimary
        };
      case 'primary':
      default:
        return {
          container: {
            backgroundColor: colors.primary,
            borderWidth: 0,
            ...shadows.subtle
          },
          textColor: colors.onPrimary
        };
    }
  };

  const isSmall = size === 'small';
  const isLarge = size === 'large';
  const v = getVariantStyles();

  return (
    <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
      <Pressable
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        disabled={disabled || loading}
        accessibilityRole="button"
        accessibilityLabel={label}
        style={({ pressed }) => [
          styles.base,
          v.container,
          isSmall && styles.smallContainer,
          isLarge && styles.largeContainer,
          (disabled || loading) && styles.disabled,
          pressed && variant === 'ghost' && styles.ghostPressed,
          style
        ]}
      >
        {loading ? (
          <ActivityIndicator color={v.textColor} size={isSmall ? 'small' : 'small'} style={styles.indicator} />
        ) : (
          icon && <View style={styles.iconBox}>{icon}</View>
        )}
        <Text
          style={[
            isSmall ? styles.smallText : styles.text,
            { color: v.textColor }
          ]}
        >
          {label}
        </Text>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radius.pill,
    paddingVertical: spacing[12],
    paddingHorizontal: spacing[20],
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    minHeight: 48
  },
  smallContainer: {
    minHeight: 36,
    paddingVertical: spacing[6],
    paddingHorizontal: spacing[14],
    borderRadius: radius.pill
  },
  largeContainer: {
    minHeight: 54,
    paddingVertical: spacing[16],
    paddingHorizontal: spacing[28],
    borderRadius: radius.pill
  },
  text: {
    ...type.bodyBold,
    letterSpacing: 0.1
  },
  smallText: {
    ...type.captionBold,
    letterSpacing: 0.2
  },
  disabled: {
    opacity: 0.5
  },
  ghostPressed: {
    backgroundColor: colors.surfaceAlt
  },
  indicator: {
    marginRight: spacing[8]
  },
  iconBox: {
    marginRight: spacing[8]
  }
});

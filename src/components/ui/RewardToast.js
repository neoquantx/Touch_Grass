import React, { useEffect, useState, useRef, useCallback } from 'react';
import { View, Text, Animated, StyleSheet, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, spacing, type, shadows } from '../../theme.js';
import { setToastListener, shiftToast } from '../../missions/controller.js';

export function RewardToast() {
  const insets = useSafeAreaInsets();
  const [toasts, setToasts] = useState([]);
  const [active, setActive] = useState(null);
  const anim = useRef(new Animated.Value(0)).current;
  const isHidingRef = useRef(false);
  const timerRef = useRef(null);

  useEffect(() => {
    setToastListener(setToasts);
    return () => setToastListener(null);
  }, []);

  // When queue has items and nothing is currently active, show next toast
  useEffect(() => {
    if (toasts.length > 0 && !active) {
      setActive(toasts[0]);
    }
  }, [toasts, active]);

  const dismiss = useCallback(() => {
    if (isHidingRef.current) return;
    isHidingRef.current = true;
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }

    Animated.timing(anim, {
      toValue: 0,
      duration: 220,
      useNativeDriver: true
    }).start(() => {
      shiftToast();
      setActive(null);
      isHidingRef.current = false;
    });
  }, [anim]);

  // When active toast changes, animate entrance and start auto-dismiss timer
  useEffect(() => {
    if (!active) return;

    isHidingRef.current = false;
    anim.setValue(0);
    Animated.spring(anim, {
      toValue: 1,
      useNativeDriver: true,
      speed: 18,
      bounciness: 6
    }).start();

    timerRef.current = setTimeout(() => {
      dismiss();
    }, 4000);

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [active, dismiss, anim]);

  if (!active) return null;

  const translateY = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [-30, 0]
  });

  const scale = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.92, 1]
  });

  const topOffset = Math.max(insets.top, 16) + 8;

  return (
    <Animated.View
      pointerEvents="box-none"
      style={[
        styles.toastWrapper,
        {
          top: topOffset,
          opacity: anim,
          transform: [{ translateY }, { scale }]
        }
      ]}
    >
      <TouchableOpacity
        activeOpacity={0.9}
        onPress={dismiss}
        style={styles.toastContainer}
        accessibilityRole="button"
        accessibilityLabel="Dismiss reward notification"
      >
        <View style={styles.iconCircle}>
          <Ionicons name="flash" size={16} color={colors.tokenText} />
        </View>
        <View style={styles.textColumn}>
          <Text style={[type.label, { color: colors.tokenText, fontSize: 10, letterSpacing: 1 }]}>
            REWARD UNLOCKED
          </Text>
          <Text style={[type.bodyBold, { color: colors.tokenText, fontSize: 13 }]} numberOfLines={2}>
            {active.message}
          </Text>
        </View>
        <Ionicons name="close-circle-outline" size={18} color={colors.tokenText} style={{ opacity: 0.6, marginLeft: spacing[8] }} />
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  toastWrapper: {
    position: 'absolute',
    left: 20,
    right: 20,
    zIndex: 9999
  },
  toastContainer: {
    backgroundColor: colors.tokenBg,
    borderRadius: radius.pill,
    paddingVertical: spacing[10],
    paddingHorizontal: spacing[16],
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: colors.tokenBorder,
    ...shadows.floating
  },
  iconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(212, 160, 23, 0.25)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing[12]
  },
  textColumn: {
    flex: 1
  }
});

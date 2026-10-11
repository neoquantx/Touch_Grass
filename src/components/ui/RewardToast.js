import React, { useEffect, useState } from 'react';
import { View, Text, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, spacing, type } from '../../theme.js';
import { setToastListener, shiftToast } from '../../missions/controller.js';

export function RewardToast() {
  const [toasts, setToasts] = useState([]);
  const [active, setActive] = useState(null);
  const fadeAnim = new Animated.Value(0);

  useEffect(() => {
    setToastListener(setToasts);
    return () => setToastListener(null);
  }, []);

  useEffect(() => {
    if (toasts.length > 0 && !active) {
      setActive(toasts[0]);
      Animated.timing(fadeAnim, { toValue: 1, duration: 300, useNativeDriver: true }).start();
      
      setTimeout(() => {
        Animated.timing(fadeAnim, { toValue: 0, duration: 300, useNativeDriver: true }).start(() => {
          setActive(null);
          shiftToast();
        });
      }, 4000);
    }
  }, [toasts, active]);

  if (!active) return null;

  return (
    <Animated.View style={{
      position: 'absolute', top: 50, left: 20, right: 20, zIndex: 999, opacity: fadeAnim,
      backgroundColor: colors.tokenBg, borderRadius: radius.pill, padding: spacing[16],
      flexDirection: 'row', alignItems: 'center', elevation: 4, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 10
    }}>
      <Ionicons name="flash" size={20} color={colors.tokenText} style={{ marginRight: spacing[12] }} />
      <Text style={[type.body, { color: colors.tokenText, fontWeight: 'bold' }]}>{active.message}</Text>
    </Animated.View>
  );
}

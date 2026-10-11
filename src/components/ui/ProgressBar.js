import React, { useEffect, useRef } from 'react';
import { View, Animated, StyleSheet } from 'react-native';
import { colors, radius } from '../../theme.js';

export function ProgressBar({ progress, color = colors.primary, trackColor = colors.surfaceAlt, height = 8, style }) {
  const bounded = Math.max(0, Math.min(1, progress || 0));
  const animatedWidth = useRef(new Animated.Value(bounded)).current;

  useEffect(() => {
    Animated.timing(animatedWidth, {
      toValue: bounded,
      duration: 300,
      useNativeDriver: false
    }).start();
  }, [bounded]);

  const widthInterpolation = animatedWidth.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%']
  });

  return (
    <View style={[styles.track, { height, backgroundColor: trackColor }, style]}>
      <Animated.View
        style={[
          styles.fill,
          {
            backgroundColor: color,
            width: widthInterpolation
          }
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    borderRadius: radius.pill,
    overflow: 'hidden',
    width: '100%'
  },
  fill: {
    height: '100%',
    borderRadius: radius.pill
  }
});

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { radius, spacing, type } from '../../theme.js';

export function Chip({ label, bgColor, textColor, icon, style, size = 'default' }) {
  const isSmall = size === 'small';

  return (
    <View
      style={[
        styles.chip,
        isSmall ? styles.chipSmall : styles.chipDefault,
        { backgroundColor: bgColor },
        style
      ]}
    >
      {icon && <View style={styles.iconBox}>{icon}</View>}
      <Text
        style={[
          isSmall ? styles.labelSmall : styles.label,
          { color: textColor }
        ]}
      >
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    borderRadius: radius.pill,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'flex-start'
  },
  chipDefault: {
    paddingVertical: 5,
    paddingHorizontal: spacing[10]
  },
  chipSmall: {
    paddingVertical: 3,
    paddingHorizontal: spacing[8]
  },
  iconBox: {
    marginRight: spacing[4]
  },
  label: {
    ...type.label,
    fontSize: 11
  },
  labelSmall: {
    ...type.label,
    fontSize: 10
  }
});

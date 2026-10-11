import React from 'react';
import { View, ScrollView, Text, StatusBar, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, spacing, type } from '../../theme.js';

export function Screen({ children, title, subtitle, rightSlot, scroll = false, style, contentContainerStyle, refreshControl }) {
  const insets = useSafeAreaInsets();

  const header = title ? (
    <View style={styles.header}>
      <View style={styles.titleColumn}>
        <Text style={[type.hero, styles.titleText]}>{title}</Text>
        {subtitle && (
          <Text style={[type.caption, styles.subtitleText]}>{subtitle}</Text>
        )}
      </View>
      {rightSlot && <View style={styles.rightSlot}>{rightSlot}</View>}
    </View>
  ) : null;

  const content = (
    <View style={[{ flex: 1, paddingBottom: insets.bottom, backgroundColor: colors.bg }, style]}>
      {header}
      {children}
    </View>
  );

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.bg} translucent={false} />
      <View style={{ height: insets.top, backgroundColor: colors.bg }} />
      {scroll ? (
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={contentContainerStyle}
          refreshControl={refreshControl}
          showsVerticalScrollIndicator={false}
        >
          {content}
        </ScrollView>
      ) : (
        content
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg
  },
  scrollView: {
    flex: 1,
    backgroundColor: colors.bg
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing[16],
    paddingTop: spacing[12],
    paddingBottom: spacing[8]
  },
  titleColumn: {
    flex: 1,
    minWidth: 0,
    marginRight: spacing[12]
  },
  titleText: {
    color: colors.text
  },
  subtitleText: {
    color: colors.textMuted,
    marginTop: 2
  },
  rightSlot: {
    flexShrink: 0
  }
});

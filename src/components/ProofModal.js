import React from 'react';
import { Modal, View, Text, Image, TouchableOpacity, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, type, radius } from '../theme.js';

export function ProofModal({ visible, mission, onClose }) {
  const insets = useSafeAreaInsets();
  if (!mission) return null;

  const photoUri = mission.proofUri || mission.photoUri;
  const timeFormatted = mission.completedAt
    ? new Date(mission.completedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : null;

  return (
    <Modal
      visible={visible}
      transparent={false}
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        {/* Top bar with close button */}
        <View style={[styles.topBar, { paddingTop: Math.max(insets.top, 16) }]}>
          <View>
            <Text style={[type.label, styles.topLabel]}>VERIFIED SUBMISSION</Text>
            <Text style={[type.caption, { color: '#AAA' }]}>Mission photo proof</Text>
          </View>
          <TouchableOpacity
            accessibilityLabel="Close proof viewer"
            accessibilityRole="button"
            onPress={onClose}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            style={styles.closeBtn}
          >
            <Ionicons name="close" size={22} color="#FFF" />
          </TouchableOpacity>
        </View>

        {/* Content / Photo area */}
        <View style={styles.contentArea}>
          {photoUri ? (
            <Image
              source={{ uri: photoUri }}
              style={styles.image}
              resizeMode="contain"
            />
          ) : (
            <View style={styles.noPhotoBox}>
              <View style={styles.emptyIconCircle}>
                <Ionicons name="image-outline" size={40} color="#777" />
              </View>
              <Text style={[type.body, { color: '#AAA', marginTop: spacing[12] }]}>
                No photo proof attached
              </Text>
            </View>
          )}
        </View>

        {/* Bottom details card */}
        <View style={[styles.bottomCard, { paddingBottom: Math.max(insets.bottom, 20) }]}>
          <View style={styles.cardHeader}>
            <View style={styles.typeIconCircle}>
              <Ionicons
                name={mission.type === 'GO' ? 'walk' : mission.type === 'LOOK' ? 'eye' : 'book'}
                size={22}
                color={colors.success}
              />
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={[type.h2, { color: '#FFF' }]} numberOfLines={2}>
                {mission.title}
              </Text>
              <View style={styles.metaRow}>
                <Text style={[type.caption, { color: '#999' }]}>
                  {timeFormatted ? `Completed at ${timeFormatted}` : 'Completed'}
                </Text>
                {mission.reward ? (
                  <View style={styles.rewardPill}>
                    <Ionicons name="flash" size={11} color={colors.tokenText} style={{ marginRight: 3 }} />
                    <Text style={[type.captionBold, { color: colors.tokenText, fontSize: 11 }]}>
                      +{mission.reward}
                    </Text>
                  </View>
                ) : null}
              </View>
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0E0C'
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing[16],
    paddingBottom: spacing[12],
    zIndex: 10
  },
  topLabel: {
    color: colors.primaryLight,
    letterSpacing: 1.2
  },
  closeBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center'
  },
  contentArea: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing[8]
  },
  image: {
    width: '100%',
    height: '100%',
    borderRadius: radius[16]
  },
  noPhotoBox: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing[24]
  },
  emptyIconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center'
  },
  bottomCard: {
    backgroundColor: '#151E18',
    borderTopLeftRadius: radius[24],
    borderTopRightRadius: radius[24],
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.08)',
    paddingHorizontal: spacing[20],
    paddingTop: spacing[16]
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  typeIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(35, 123, 71, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing[12]
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    gap: spacing[8]
  },
  rewardPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.tokenBg,
    paddingHorizontal: spacing[6],
    paddingVertical: 2,
    borderRadius: radius.pill
  }
});

import React, { useState, useRef } from 'react';
import { View, Text, TouchableOpacity, Modal, ScrollView, Animated, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, spacing, type, shadows } from '../theme.js';
import { useStore } from '../store/useStore.js';
import { Card } from './ui/Card.js';
import { Notice } from './ui/Notice.js';

export function TokenBadge() {
  const tokens = useStore((state) => state.tokens);
  const ledger = useStore((state) => state.ledger) || [];
  const ledgerCarry = useStore((state) => state.ledgerCarry) || 0;
  const [modalOpen, setModalOpen] = useState(false);
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const earned = ledger.filter(l => l.amount > 0).reduce((sum, l) => sum + l.amount, 0);
  const spent = ledger.filter(l => l.amount < 0).reduce((sum, l) => sum + Math.abs(l.amount), 0);
  const net = earned - spent + ledgerCarry;
  const mismatch = net !== tokens;

  const handlePressIn = () => {
    Animated.spring(scaleAnim, {
      toValue: 0.94,
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

  return (
    <>
      <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
        <TouchableOpacity
          activeOpacity={0.85}
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
          onPress={() => setModalOpen(true)}
          accessibilityRole="button"
          accessibilityLabel={`Tokens: ${tokens}. Tap for history.`}
        >
          <View style={styles.badgePill}>
            <View style={styles.tokenIconCircle}>
              <Ionicons name="flash" size={13} color={colors.tokenText} />
            </View>
            <Text style={styles.tokenCount}>
              {tokens.toLocaleString()}
            </Text>
          </View>
        </TouchableOpacity>
      </Animated.View>

      <Modal
        visible={modalOpen}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setModalOpen(false)}
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <View>
              <Text style={[type.h2, { color: colors.text }]}>Token Accounting</Text>
              <Text style={[type.caption, { color: colors.textMuted }]}>
                Offline token ledger & rewards
              </Text>
            </View>
            <TouchableOpacity
              onPress={() => setModalOpen(false)}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              style={styles.closeBtn}
            >
              <Ionicons name="close" size={20} color={colors.text} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
            {/* Balance Summary Cards */}
            <View style={styles.summaryRow}>
              <Card style={styles.summaryCard}>
                <View style={[styles.statIconCircle, { backgroundColor: colors.tokenBg }]}>
                  <Ionicons name="wallet-outline" size={16} color={colors.tokenText} />
                </View>
                <Text style={styles.statLabel}>Balance</Text>
                <Text style={[type.h1, { color: colors.tokenText }]}>
                  {tokens.toLocaleString()}
                </Text>
              </Card>

              <Card style={styles.summaryCard}>
                <View style={[styles.statIconCircle, { backgroundColor: colors.successSoft }]}>
                  <Ionicons name="arrow-down" size={16} color={colors.success} />
                </View>
                <Text style={styles.statLabel}>Earned</Text>
                <Text style={[type.h1, { color: colors.success }]}>
                  +{earned.toLocaleString()}
                </Text>
              </Card>

              <Card style={styles.summaryCard}>
                <View style={[styles.statIconCircle, { backgroundColor: colors.dangerSoft }]}>
                  <Ionicons name="arrow-up" size={16} color={colors.danger} />
                </View>
                <Text style={styles.statLabel}>Spent</Text>
                <Text style={[type.h1, { color: colors.danger }]}>
                  -{spent.toLocaleString()}
                </Text>
              </Card>
            </View>

            {mismatch && (
              <View style={{ marginBottom: spacing[16] }}>
                <Notice variant="error" text="Balance does not match history" />
              </View>
            )}

            <View style={styles.ledgerHeaderRow}>
              <Text style={[type.label, { color: colors.textMuted }]}>TRANSACTION LEDGER</Text>
              <Text style={[type.caption, { color: colors.textSubtle }]}>
                {ledger.length} entries
              </Text>
            </View>

            {ledger.length === 0 ? (
              <Card style={styles.emptyCard}>
                <Ionicons name="receipt-outline" size={32} color={colors.textSubtle} style={{ marginBottom: spacing[8] }} />
                <Text style={[type.body, { color: colors.textMuted, fontStyle: 'italic', textAlign: 'center' }]}>
                  No token activity recorded yet.
                </Text>
              </Card>
            ) : (
              <Card style={styles.ledgerCard}>
                {ledger.map((entry, idx) => {
                  const isCredit = entry.amount > 0;
                  const isLast = idx === ledger.length - 1;
                  return (
                    <View
                      key={idx}
                      style={[
                        styles.ledgerRow,
                        !isLast && styles.ledgerRowBorder
                      ]}
                    >
                      <View style={[
                        styles.ledgerIconCircle,
                        { backgroundColor: isCredit ? colors.successSoft : colors.dangerSoft }
                      ]}>
                        <Ionicons
                          name={isCredit ? 'add' : 'remove'}
                          size={14}
                          color={isCredit ? colors.success : colors.danger}
                        />
                      </View>
                      <View style={styles.ledgerInfo}>
                        <Text style={[type.bodyBold, { color: colors.text, fontSize: 14 }]} numberOfLines={2}>
                          {entry.reason}
                        </Text>
                        <Text style={[type.caption, { color: colors.textMuted, marginTop: 2 }]}>
                          {new Date(entry.time).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                        </Text>
                      </View>
                      <View style={styles.amountBox}>
                        <Text
                          style={[
                            type.bodyBold,
                            { color: isCredit ? colors.success : colors.danger }
                          ]}
                        >
                          {isCredit ? '+' : ''}{entry.amount}
                        </Text>
                      </View>
                    </View>
                  );
                })}
              </Card>
            )}
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  badgePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.tokenBg,
    paddingHorizontal: spacing[10],
    paddingVertical: spacing[6],
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.tokenBorder,
    ...shadows.subtle
  },
  tokenIconCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(212, 160, 23, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing[6]
  },
  tokenCount: {
    ...type.captionBold,
    color: colors.tokenText,
    letterSpacing: 0.2
  },
  modalContainer: {
    flex: 1,
    backgroundColor: colors.bg
  },
  modalHeader: {
    paddingHorizontal: spacing[16],
    paddingVertical: spacing[16],
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSubtle,
    backgroundColor: colors.surface,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center'
  },
  scrollView: {
    flex: 1
  },
  scrollContent: {
    padding: spacing[16]
  },
  summaryRow: {
    flexDirection: 'row',
    gap: spacing[10],
    marginBottom: spacing[20]
  },
  summaryCard: {
    flex: 1,
    padding: spacing[12],
    alignItems: 'flex-start'
  },
  statIconCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing[6]
  },
  statLabel: {
    ...type.label,
    color: colors.textMuted,
    fontSize: 10,
    marginBottom: 2
  },
  ledgerHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing[10],
    paddingHorizontal: spacing[4]
  },
  ledgerCard: {
    padding: 0,
    overflow: 'hidden'
  },
  emptyCard: {
    padding: spacing[24],
    alignItems: 'center',
    justifyContent: 'center'
  },
  ledgerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing[16],
    paddingVertical: spacing[12]
  },
  ledgerRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSubtle
  },
  ledgerIconCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing[12]
  },
  ledgerInfo: {
    flex: 1,
    marginRight: spacing[10]
  },
  amountBox: {
    alignItems: 'flex-end'
  }
});

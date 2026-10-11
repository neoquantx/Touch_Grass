import React, { useEffect, useState, useRef } from 'react';
import { View, Text, Animated, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Card } from './ui/Card.js';
import { Button } from './ui/Button.js';
import { Notice } from './ui/Notice.js';
import { colors, spacing, type, radius, shadows } from '../theme.js';
import { useStore } from '../store/useStore.js';
import { startWalk, stopWalk, subscribeWalk } from '../progress/walkController.js';
import { CONFIG } from '../config.js';
import { formatDistance } from '../utils/format.js';

export function WalkCard() {
  const walk = useStore(state => state.walk);
  const [liveData, setLiveData] = useState({ distanceM: 0, seconds: 0, accuracyWarn: false });
  const [summary, setSummary] = useState(null);

  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    return subscribeWalk(setLiveData);
  }, []);

  useEffect(() => {
    if (walk?.active) {
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 0.35,
            duration: 800,
            useNativeDriver: true
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 800,
            useNativeDriver: true
          })
        ])
      );
      loop.start();
      return () => loop.stop();
    }
  }, [walk?.active]);

  const handleStart = async () => {
    setSummary(null);
    await startWalk();
  };

  const handleStop = async () => {
    await stopWalk();
    setSummary({
      distance: liveData.distanceM,
      duration: liveData.seconds,
      steps: Math.round(liveData.distanceM / (CONFIG.WALK.strideM || 0.75)),
      calories: Math.round(liveData.distanceM * 0.048)
    });
  };

  if (summary && !walk?.active) {
    return (
      <Card style={styles.cardContainer} variant="elevated">
        <View style={styles.summaryHeader}>
          <View style={styles.trophyIconBox}>
            <Ionicons name="trophy" size={22} color={colors.tokenText} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[type.h2, { color: colors.text }]}>Walk Summary</Text>
            <Text style={[type.caption, { color: colors.textMuted }]}>
              Activity saved to your daily history
            </Text>
          </View>
        </View>

        <View style={styles.summaryStatsRow}>
          <View style={styles.summaryStatItem}>
            <Text style={[type.metric, { color: colors.primary }]}>{formatDistance(summary.distance)}</Text>
            <Text style={styles.statSubLabel}>Distance</Text>
          </View>
          <View style={styles.summaryStatItem}>
            <Text style={[type.metric, { color: colors.text }]}>{Math.round(summary.duration / 60)} min</Text>
            <Text style={styles.statSubLabel}>Duration</Text>
          </View>
          <View style={styles.summaryStatItem}>
            <Text style={[type.metric, { color: colors.text }]}>{summary.steps.toLocaleString()}</Text>
            <Text style={styles.statSubLabel}>Est. Steps</Text>
          </View>
          <View style={styles.summaryStatItem}>
            <Text style={[type.metric, { color: colors.tokenText }]}>{summary.calories}</Text>
            <Text style={styles.statSubLabel}>kcal</Text>
          </View>
        </View>

        <Button label="Done" onPress={() => setSummary(null)} style={{ marginTop: spacing[4] }} />
      </Card>
    );
  }

  if (walk && walk.active) {
    const pace = liveData.distanceM > 0 ? (liveData.seconds / 60) / (liveData.distanceM / 1000) : 0;
    const estSteps = Math.round(liveData.distanceM / (CONFIG.WALK.strideM || 0.75));
    const estKcal = Math.round(liveData.distanceM * 0.048);

    return (
      <Card style={[styles.cardContainer, styles.activeCard]} variant="elevated">
        <View style={styles.activeHeader}>
          <View style={styles.pulseContainer}>
            <Animated.View style={[styles.pulseDot, { opacity: pulseAnim }]} />
            <Text style={[type.label, { color: colors.primary, fontSize: 11 }]}>WALKING ACTIVE</Text>
          </View>
          <Text style={[type.caption, { color: colors.textMuted }]}>Screen stays awake</Text>
        </View>

        {liveData.accuracyWarn && (
          <View style={{ marginBottom: spacing[12] }}>
            <Notice variant="warn" text="Poor GPS accuracy. Move toward open sky." />
          </View>
        )}

        <View style={styles.metricsContainer}>
          <View style={styles.metricColumn}>
            <View style={styles.metricIconBox}>
              <Ionicons name="trail-sign-outline" size={16} color={colors.primary} />
            </View>
            <Text style={[type.metric, { color: colors.primary }]}>{formatDistance(liveData.distanceM)}</Text>
            <Text style={styles.statSubLabel}>Distance</Text>
          </View>

          <View style={styles.metricDivider} />

          <View style={styles.metricColumn}>
            <View style={styles.metricIconBox}>
              <Ionicons name="time-outline" size={16} color={colors.text} />
            </View>
            <Text style={[type.metric, { color: colors.text }]}>{Math.round(liveData.seconds / 60)} min</Text>
            <Text style={styles.statSubLabel}>Time</Text>
          </View>

          <View style={styles.metricDivider} />

          <View style={styles.metricColumn}>
            <View style={styles.metricIconBox}>
              <Ionicons name="speedometer-outline" size={16} color={colors.text} />
            </View>
            <Text style={[type.metric, { color: colors.text }]}>{pace > 0 ? Math.round(pace) : '--'}</Text>
            <Text style={styles.statSubLabel}>min/km</Text>
          </View>
        </View>

        {/* Live Health Metrics: Steps & Energy */}
        <View style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center', backgroundColor: colors.surfaceAlt, paddingVertical: spacing[6], paddingHorizontal: spacing[12], borderRadius: radius.pill, marginTop: spacing[12], marginBottom: spacing[4], gap: spacing[14] }}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Ionicons name="footsteps" size={13} color={colors.primary} style={{ marginRight: 4 }} />
            <Text style={[type.captionBold, { color: colors.textSecondary }]}>
              {estSteps.toLocaleString()} steps
            </Text>
          </View>
          <View style={{ width: 1, height: 12, backgroundColor: colors.border }} />
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Ionicons name="flame" size={13} color={colors.tokenText} style={{ marginRight: 4 }} />
            <Text style={[type.captionBold, { color: colors.textSecondary }]}>
              ~{estKcal} kcal
            </Text>
          </View>
        </View>

        <Button
          variant="danger"
          label="Stop Walk"
          icon={<Ionicons name="stop" size={16} color={colors.onPrimary} />}
          onPress={handleStop}
          style={{ marginTop: spacing[8] }}
        />
      </Card>
    );
  }

  return (
    <Card style={styles.cardContainer} variant="default">
      <View style={styles.startHeader}>
        <View style={styles.walkIconBox}>
          <Ionicons name="footsteps" size={20} color={colors.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[type.h2, { color: colors.text }]}>Start a Walk</Text>
          <Text style={[type.body, { color: colors.textMuted, fontSize: 14, marginTop: 2 }]}>
            Counts distance for tokens. The screen stays on while walking.
          </Text>
        </View>
      </View>

      <Button
        label="Start Walk"
        icon={<Ionicons name="walk" size={18} color={colors.onPrimary} />}
        onPress={handleStart}
        style={{ marginTop: spacing[12] }}
      />
    </Card>
  );
}

const styles = StyleSheet.create({
  cardContainer: {
    marginBottom: spacing[16]
  },
  activeCard: {
    borderColor: colors.primary,
    borderWidth: 1.5,
    backgroundColor: '#FAFDFB'
  },
  summaryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing[16]
  },
  trophyIconBox: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.tokenBg,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing[12]
  },
  summaryStatsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius[16],
    paddingVertical: spacing[14],
    paddingHorizontal: spacing[8],
    marginBottom: spacing[16]
  },
  summaryStatItem: {
    alignItems: 'center'
  },
  activeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing[14]
  },
  pulseContainer: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  pulseDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primary,
    marginRight: spacing[8]
  },
  metricsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    borderRadius: radius[16],
    borderWidth: 1,
    borderColor: colors.primarySoftBorder,
    paddingVertical: spacing[14],
    paddingHorizontal: spacing[8],
    marginBottom: spacing[12]
  },
  metricColumn: {
    flex: 1,
    alignItems: 'center'
  },
  metricIconBox: {
    marginBottom: 4
  },
  metricDivider: {
    width: 1,
    height: 36,
    backgroundColor: colors.borderSubtle
  },
  statSubLabel: {
    ...type.caption,
    color: colors.textMuted,
    fontSize: 12,
    marginTop: 2
  },
  startHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start'
  },
  walkIconBox: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing[12],
    marginTop: 2
  }
});

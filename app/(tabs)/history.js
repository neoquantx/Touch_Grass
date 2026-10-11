import React, { useState } from 'react';
import { View, Text, FlatList, Image, TouchableOpacity } from 'react-native';
import { useStore } from '../../src/store/useStore.js';
import { Screen } from '../../src/components/ui/Screen.js';
import { Card } from '../../src/components/ui/Card.js';
import { EmptyState } from '../../src/components/ui/EmptyState.js';
import { ProgressBar } from '../../src/components/ui/ProgressBar.js';
import { ProofModal } from '../../src/components/ProofModal.js';
import { colors, spacing, type, radius } from '../../src/theme.js';
import { Ionicons } from '@expo/vector-icons';
import { computeStreak } from '../../src/progress/streak.js';
import { BADGE_DEFINITIONS, computeBadgeMetrics } from '../../src/progress/badges.js';
import { CONFIG } from '../../src/config.js';
import { daysBetween, addDays, todayString, formatDateDisplay, normalizeDateStr } from '../../src/utils/date.js';
import { formatDistance } from '../../src/utils/format.js';

export default function HistoryTab() {
  const [selectedProofMission, setSelectedProofMission] = useState(null);
  const days = useStore(s => s.days) || {};
  const visitedIds = useStore(s => s.visitedIds) || [];
  const tokens = useStore(s => s.tokens) || 0;
  const ledger = useStore(s => s.ledger) || [];
  const ledgerCarry = useStore(s => s.ledgerCarry) || 0;
  const unlockedBadges = useStore(s => s.unlockedBadges) || {};
  const journal = useStore(s => s.journal) || [];
  
  const todayStr = todayString();
  const streakInfo = computeStreak(days, todayStr, CONFIG.STREAK);
  
  const totalMissions = Object.values(days).reduce((sum, d) => sum + (d.missions?.length || 0), 0);
  const totalDistanceM = Object.values(days).reduce((sum, d) => sum + (d.distanceM || 0), 0);
  
  const earned = ledger.filter(l => l.amount > 0).reduce((sum, l) => sum + l.amount, 0) + (ledgerCarry > 0 ? ledgerCarry : 0);
  const spent = ledger.filter(l => l.amount < 0).reduce((sum, l) => sum + Math.abs(l.amount), 0) + (ledgerCarry < 0 ? Math.abs(ledgerCarry) : 0);
  const badgeMetrics = computeBadgeMetrics({ days, journal, ledger, streakInfo });
  
  const getDayData = (dateStr) => {
    if (days[dateStr]) return days[dateStr];
    const norm = normalizeDateStr(dateStr);
    if (days[norm]) return days[norm];
    const match = Object.entries(days).find(([k]) => normalizeDateStr(k) === norm);
    return match ? match[1] : {};
  };

  // 14 day chart
  const chartDays = [];
  let maxDist = 1;
  let totalWalkedIn14Days = 0;
  for (let i = 13; i >= 0; i--) {
    const d = addDays(todayStr, -i);
    const dayData = getDayData(d);
    const dist = dayData.distanceM || 0;
    if (dist > maxDist) maxDist = dist;
    totalWalkedIn14Days += dist;
    chartDays.push({ date: d, dist });
  }
  const chartMax = Math.max(maxDist, CONFIG.GOALS.dailyDistanceM);

  const getDayShortLabel = (dateStr) => {
    const norm = normalizeDateStr(dateStr);
    const parts = norm.split('-');
    if (parts.length !== 3) return '';
    const d = new Date(Date.UTC(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10), 12, 0, 0));
    return ['Su', 'M', 'Tu', 'W', 'Th', 'F', 'Sa'][d.getUTCDay()];
  };
  
  const renderChart = () => (
    <View style={{ marginTop: spacing[20], paddingTop: spacing[16], borderTopWidth: 1, borderTopColor: colors.borderSubtle }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing[12] }}>
        <Text style={[type.label, { color: colors.textSecondary }]}>14-DAY ACTIVITY</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: colors.success, marginRight: 4 }} />
          <Text style={[type.caption, { color: colors.textMuted, fontSize: 11 }]}>
            {formatDistance(CONFIG.GOALS.dailyDistanceM)} goal
          </Text>
        </View>
      </View>

      <View style={{ height: 108, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', paddingBottom: 4 }}>
        {/* Goal reference dashed line */}
        <View
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: (CONFIG.GOALS.dailyDistanceM / chartMax) * 72 + 20,
            height: 1,
            backgroundColor: colors.border,
            borderStyle: 'dashed',
            borderWidth: 0.8,
            borderColor: colors.border
          }}
        />
        {chartDays.map((d, i) => {
          const rawHeight = (d.dist / chartMax) * 72;
          const height = Math.max(3, rawHeight);
          const isGoalMet = d.dist >= CONFIG.GOALS.dailyDistanceM;
          const barColor = isGoalMet ? colors.success : (d.dist > 0 ? colors.primary : colors.surfaceAlt);
          const isTodayBar = d.date === todayStr;

          return (
            <View key={i} style={{ width: '6%', alignItems: 'center' }}>
              <View
                style={{
                  width: '100%',
                  height,
                  backgroundColor: barColor,
                  borderTopLeftRadius: 3,
                  borderTopRightRadius: 3,
                  borderWidth: isTodayBar ? 1 : 0,
                  borderColor: colors.primaryDark
                }}
              />
              <Text
                style={[
                  type.caption,
                  {
                    color: isTodayBar ? colors.primary : colors.textMuted,
                    fontWeight: isTodayBar ? 'bold' : 'normal',
                    fontSize: 10,
                    marginTop: 6
                  }
                ]}
              >
                {getDayShortLabel(d.date)}
              </Text>
            </View>
          );
        })}
      </View>
      {totalWalkedIn14Days === 0 && (
        <Text style={[type.caption, { color: colors.textMuted, textAlign: 'center', marginTop: spacing[8] }]}>
          No walking recorded in the last 14 days
        </Text>
      )}
    </View>
  );

  const sortedDates = Object.keys(days).map(normalizeDateStr).filter((v, i, a) => a.indexOf(v) === i).sort().reverse();

  if (sortedDates.length === 0) {
    return (
      <Screen title="History" subtitle="Daily outdoor activity & streaks">
        <EmptyState icon="calendar-outline" title="No history yet" body="Your walking activity, streaks, and completed missions will appear here." />
      </Screen>
    );
  }

  return (
    <Screen title="History" subtitle="Daily outdoor activity & streaks" scroll={false}>
      <FlatList
        data={sortedDates}
        keyExtractor={item => item}
        contentContainerStyle={{ paddingHorizontal: spacing[16], paddingBottom: spacing[24] }}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <>
            <Card style={{ marginBottom: spacing[16] }} variant="default">
              {/* 8-Metric Stat Grid */}
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing[10] }}>
                <View style={{ width: '48%', backgroundColor: colors.surfaceAlt, padding: spacing[12], borderRadius: radius[14] }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
                    <Ionicons name="flame" size={15} color={colors.tokenText} style={{ marginRight: 4 }} />
                    <Text style={[type.label, { color: colors.textMuted, fontSize: 10 }]}>CURRENT STREAK</Text>
                  </View>
                  <Text style={[type.metric, { color: colors.text }]}>{streakInfo.current} <Text style={[type.caption, { color: colors.textMuted }]}>days</Text></Text>
                </View>

                <View style={{ width: '48%', backgroundColor: colors.surfaceAlt, padding: spacing[12], borderRadius: radius[14] }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
                    <Ionicons name="trophy" size={15} color={colors.tokenText} style={{ marginRight: 4 }} />
                    <Text style={[type.label, { color: colors.textMuted, fontSize: 10 }]}>BEST STREAK</Text>
                  </View>
                  <Text style={[type.metric, { color: colors.text }]}>{streakInfo.best} <Text style={[type.caption, { color: colors.textMuted }]}>days</Text></Text>
                </View>

                <View style={{ width: '48%', backgroundColor: colors.surfaceAlt, padding: spacing[12], borderRadius: radius[14] }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
                    <Ionicons name="checkmark-circle" size={15} color={colors.primary} style={{ marginRight: 4 }} />
                    <Text style={[type.label, { color: colors.textMuted, fontSize: 10 }]}>MISSIONS DONE</Text>
                  </View>
                  <Text style={[type.metric, { color: colors.text }]}>{totalMissions}</Text>
                </View>

                <View style={{ width: '48%', backgroundColor: colors.surfaceAlt, padding: spacing[12], borderRadius: radius[14] }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
                    <Ionicons name="trail-sign" size={15} color={colors.primary} style={{ marginRight: 4 }} />
                    <Text style={[type.label, { color: colors.textMuted, fontSize: 10 }]}>TOTAL DISTANCE</Text>
                  </View>
                  <Text style={[type.metric, { color: colors.text }]}>{formatDistance(totalDistanceM)}</Text>
                </View>

                <View style={{ width: '48%', backgroundColor: colors.surfaceAlt, padding: spacing[12], borderRadius: radius[14] }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
                    <Ionicons name="footsteps" size={15} color={colors.primary} style={{ marginRight: 4 }} />
                    <Text style={[type.label, { color: colors.textMuted, fontSize: 10 }]}>EST. STEPS</Text>
                  </View>
                  <Text style={[type.metric, { color: colors.text }]}>{Math.round(totalDistanceM / 0.75).toLocaleString()}</Text>
                </View>

                <View style={{ width: '48%', backgroundColor: colors.surfaceAlt, padding: spacing[12], borderRadius: radius[14] }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
                    <Ionicons name="flame-outline" size={15} color={colors.tokenText} style={{ marginRight: 4 }} />
                    <Text style={[type.label, { color: colors.textMuted, fontSize: 10 }]}>EST. BURN</Text>
                  </View>
                  <Text style={[type.metric, { color: colors.tokenText }]}>{Math.round(totalDistanceM * 0.048).toLocaleString()} <Text style={[type.caption, { color: colors.textMuted }]}>kcal</Text></Text>
                </View>

                <View style={{ width: '48%', backgroundColor: colors.surfaceAlt, padding: spacing[12], borderRadius: radius[14] }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
                    <Ionicons name="compass" size={15} color={colors.look} style={{ marginRight: 4 }} />
                    <Text style={[type.label, { color: colors.textMuted, fontSize: 10 }]}>PLACES VISITED</Text>
                  </View>
                  <Text style={[type.metric, { color: colors.text }]}>{visitedIds.length}</Text>
                </View>

                <View style={{ width: '48%', backgroundColor: colors.surfaceAlt, padding: spacing[12], borderRadius: radius[14] }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
                    <Ionicons name="flash" size={15} color={colors.tokenText} style={{ marginRight: 4 }} />
                    <Text style={[type.label, { color: colors.textMuted, fontSize: 10 }]}>TOKENS EARNED</Text>
                  </View>
                  <Text style={[type.metric, { color: colors.tokenText }]}>{earned.toLocaleString()}</Text>
                </View>
              </View>

              {/* 14-Day Activity Chart */}
              {renderChart()}
            </Card>

            {/* Grass Badges Card */}
            <Card style={{ marginBottom: spacing[16] }} variant="default">
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing[12] }}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: colors.tokenBg, alignItems: 'center', justifyContent: 'center', marginRight: spacing[8], borderWidth: 1, borderColor: colors.tokenBorder }}>
                    <Ionicons name="trophy" size={14} color={colors.tokenText} />
                  </View>
                  <Text style={[type.h2, { fontSize: 16, color: colors.text }]}>Grass Badges</Text>
                </View>
                <View style={{ backgroundColor: colors.tokenBg, paddingHorizontal: spacing[8], paddingVertical: 3, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.tokenBorder }}>
                  <Text style={[type.captionBold, { color: colors.tokenText, fontSize: 11 }]}>
                    {Object.keys(unlockedBadges).length} / {BADGE_DEFINITIONS.length} Unlocked
                  </Text>
                </View>
              </View>

              {BADGE_DEFINITIONS.map((b) => {
                const isUnlocked = !!unlockedBadges[b.id];
                const prog = b.progress(badgeMetrics);
                const percent = Math.min(100, Math.round((prog.current / prog.target) * 100));

                return (
                  <View
                    key={b.id}
                    style={{
                      backgroundColor: isUnlocked ? colors.successSoft : colors.surfaceAlt,
                      padding: spacing[10],
                      borderRadius: radius[12],
                      marginBottom: spacing[8],
                      borderWidth: 1,
                      borderColor: isUnlocked ? colors.successBorder : colors.borderSubtle
                    }}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 4 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, marginRight: spacing[8] }}>
                        <View style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: isUnlocked ? colors.surface : colors.surfaceMuted, alignItems: 'center', justifyContent: 'center', marginRight: spacing[8] }}>
                          <Ionicons name={b.icon} size={16} color={isUnlocked ? colors.success : colors.textMuted} />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={[type.bodyBold, { color: colors.text, fontSize: 14 }]}>{b.title}</Text>
                          <Text style={[type.caption, { color: colors.textMuted, fontSize: 11 }]}>{b.description}</Text>
                        </View>
                      </View>

                      {isUnlocked ? (
                        <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: colors.success, paddingHorizontal: spacing[8], paddingVertical: 2, borderRadius: radius.pill }}>
                          <Ionicons name="checkmark" size={11} color="#FFF" style={{ marginRight: 2 }} />
                          <Text style={[type.captionBold, { color: '#FFF', fontSize: 10 }]}>UNLOCKED</Text>
                        </View>
                      ) : (
                        <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: colors.tokenBg, paddingHorizontal: spacing[8], paddingVertical: 2, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.tokenBorder }}>
                          <Ionicons name="flash" size={10} color={colors.tokenText} style={{ marginRight: 2 }} />
                          <Text style={[type.captionBold, { color: colors.tokenText, fontSize: 10 }]}>+{b.reward}</Text>
                        </View>
                      )}
                    </View>

                    {!isUnlocked && (
                      <View style={{ marginTop: spacing[4] }}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 2 }}>
                          <Text style={[type.caption, { color: colors.textMuted, fontSize: 10 }]}>Progress</Text>
                          <Text style={[type.captionBold, { color: colors.textSecondary, fontSize: 10 }]}>
                            {prog.current.toLocaleString()} / {prog.target.toLocaleString()} {prog.unit || ''}
                          </Text>
                        </View>
                        <ProgressBar progress={percent} color={colors.primary} height={4} />
                      </View>
                    )}
                  </View>
                );
              })}
            </Card>
          </>
        }
        renderItem={({ item: dateStr }) => {
          const d = getDayData(dateStr);
          const hasActivity = (d.missions && d.missions.length > 0) || d.distanceM > 0;
          const isToday = dateStr === todayStr;

          return (
            <Card style={{ marginBottom: spacing[12] }} variant="default">
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing[8] }}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Ionicons name="calendar-outline" size={16} color={colors.primary} style={{ marginRight: 6 }} />
                  <Text style={[type.bodyBold, { color: colors.text }]}>
                    {formatDateDisplay(dateStr)} {isToday ? '(Today)' : ''}
                  </Text>
                </View>
                {hasActivity && (
                  <View style={{ backgroundColor: colors.surfaceAlt, paddingHorizontal: spacing[8], paddingVertical: 2, borderRadius: radius.pill }}>
                    <Text style={[type.captionBold, { color: colors.textSecondary, fontSize: 11 }]}>
                      {d.missions?.length || 0} missions • {formatDistance(d.distanceM || 0)} • {Math.round((d.distanceM || 0) / 0.75).toLocaleString()} steps
                    </Text>
                  </View>
                )}
              </View>

              {!hasActivity ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surfaceAlt, padding: spacing[10], borderRadius: radius[12] }}>
                  <Ionicons name="leaf-outline" size={18} color={colors.textMuted} style={{ marginRight: spacing[8] }} />
                  <View>
                    <Text style={[type.captionBold, { color: colors.textSecondary }]}>Rest Day</Text>
                    <Text style={[type.caption, { color: colors.textMuted, fontSize: 11 }]}>Rested and recharged</Text>
                  </View>
                </View>
              ) : (
                <View>
                  {d.walkSeconds > 0 && (
                    <Text style={[type.caption, { color: colors.textMuted, marginBottom: spacing[8] }]}>
                      Total walking time: {Math.round(d.walkSeconds / 60)} min
                    </Text>
                  )}

                  {d.missions?.map((m, idx) => (
                    <TouchableOpacity 
                      key={idx} 
                      activeOpacity={0.75}
                      accessibilityRole="button"
                      accessibilityLabel={`View submission for ${m.title}`}
                      onPress={() => setSelectedProofMission(m)}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        backgroundColor: colors.surfaceAlt,
                        padding: spacing[8],
                        borderRadius: radius[10],
                        marginBottom: spacing[6]
                      }}
                    >
                       <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center', marginRight: spacing[8] }}>
                         <Ionicons name={m.type === 'GO' ? 'walk' : m.type === 'LOOK' ? 'camera' : 'book'} size={14} color={colors.primary} />
                       </View>
                       <View style={{ flex: 1, minWidth: 0 }}>
                         <Text style={[type.captionBold, { color: colors.text }]} numberOfLines={1}>
                           {m.title}
                         </Text>
                         {m.reward ? (
                           <Text style={[type.caption, { color: colors.textMuted, fontSize: 11 }]}>+{m.reward} tokens</Text>
                         ) : null}
                       </View>
                       {m.proofUri ? (
                         <View style={{ position: 'relative' }}>
                           <Image source={{ uri: m.proofUri }} style={{ width: 32, height: 32, borderRadius: radius[6] }} />
                           <View style={{ position: 'absolute', bottom: 1, right: 1, backgroundColor: 'rgba(0,0,0,0.5)', width: 12, height: 12, borderRadius: 6, alignItems: 'center', justifyContent: 'center' }}>
                             <Ionicons name="expand" size={7} color="#FFF" />
                           </View>
                         </View>
                       ) : (
                         <View style={{ width: 32, height: 32, borderRadius: radius[6], backgroundColor: colors.borderSubtle, alignItems: 'center', justifyContent: 'center' }}>
                           <Ionicons name="image-outline" size={14} color={colors.textSubtle} />
                         </View>
                       )}
                    </TouchableOpacity>
                  ))}

                  {d.bonuses?.map((b, idx) => (
                    <View key={`b${idx}`} style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: colors.tokenBg, paddingHorizontal: spacing[10], paddingVertical: 4, borderRadius: radius.pill, alignSelf: 'flex-start', marginTop: spacing[4], borderWidth: 1, borderColor: colors.tokenBorder }}>
                       <Ionicons name="star" size={13} color={colors.tokenText} style={{ marginRight: 4 }} />
                       <Text style={[type.captionBold, { color: colors.tokenText, fontSize: 11 }]}>
                         {b.reason} (+{b.amount} tokens)
                       </Text>
                    </View>
                  ))}
                </View>
              )}
            </Card>
          );
        }}
      />
      <ProofModal
        visible={!!selectedProofMission}
        mission={selectedProofMission}
        onClose={() => setSelectedProofMission(null)}
      />
    </Screen>
  );
}


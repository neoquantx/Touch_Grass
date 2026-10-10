import React from 'react';
import { View, Text, FlatList, Image } from 'react-native';
import { useStore } from '../../src/store/useStore.js';
import { Screen } from '../../src/components/ui/Screen.js';
import { Card } from '../../src/components/ui/Card.js';
import { EmptyState } from '../../src/components/ui/EmptyState.js';
import { colors, spacing, type, radius } from '../../src/theme.js';
import { Ionicons } from '@expo/vector-icons';
import { computeStreak } from '../../src/progress/streak.js';
import { CONFIG } from '../../src/config.js';
import { daysBetween, addDays } from '../../src/utils/date.js';

export default function HistoryTab() {
  const days = useStore(s => s.days) || {};
  const visitedIds = useStore(s => s.visitedIds) || [];
  const tokens = useStore(s => s.tokens) || 0;
  const ledger = useStore(s => s.ledger) || [];
  const ledgerCarry = useStore(s => s.ledgerCarry) || 0;
  
  const todayStr = new Date().toLocaleDateString('en-CA');
  const streakInfo = computeStreak(days, todayStr, CONFIG.STREAK);
  
  const totalMissions = Object.values(days).reduce((sum, d) => sum + (d.missions?.length || 0), 0);
  const totalKm = Object.values(days).reduce((sum, d) => sum + (d.distanceM || 0), 0) / 1000;
  
  const earned = ledger.filter(l => l.amount > 0).reduce((sum, l) => sum + l.amount, 0) + (ledgerCarry > 0 ? ledgerCarry : 0);
  const spent = ledger.filter(l => l.amount < 0).reduce((sum, l) => sum + Math.abs(l.amount), 0) + (ledgerCarry < 0 ? Math.abs(ledgerCarry) : 0);
  
  // 14 day chart
  const chartDays = [];
  let maxDist = 1;
  for (let i = 13; i >= 0; i--) {
    const d = addDays(todayStr, -i);
    const dist = days[d]?.distanceM || 0;
    if (dist > maxDist) maxDist = dist;
    chartDays.push({ date: d, dist });
  }
  const chartMax = Math.max(maxDist, CONFIG.GOALS.dailyDistanceM);
  
  const renderChart = () => (
    <View style={{ height: 100, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', marginTop: spacing[16], paddingTop: 20 }}>
      {/* Goal line */}
      <View style={{ position: 'absolute', left: 0, right: 0, bottom: (CONFIG.GOALS.dailyDistanceM / chartMax) * 80, height: 1, backgroundColor: colors.border, borderStyle: 'dashed' }} />
      {chartDays.map((d, i) => {
        const height = (d.dist / chartMax) * 80;
        return (
          <View key={i} style={{ width: '6%', alignItems: 'center' }}>
            <View style={{ width: '100%', height, backgroundColor: d.dist >= CONFIG.GOALS.dailyDistanceM ? colors.success : colors.primary, borderRadius: 2 }} />
          </View>
        );
      })}
    </View>
  );

  const sortedDates = Object.keys(days).sort().reverse();

  if (sortedDates.length === 0) {
    return (
      <Screen title="History">
        <EmptyState icon="calendar" title="No history yet" body="Your daily activity will appear here." />
      </Screen>
    );
  }

  return (
    <Screen title="History" scroll={false}>
      <FlatList
        data={sortedDates}
        keyExtractor={item => item}
        contentContainerStyle={{ padding: spacing[16] }}
        ListHeaderComponent={<>
          <Card style={{ marginBottom: spacing[16] }}>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' }}>
              <View style={{ width: '48%', marginBottom: spacing[12] }}>
                <Text style={[type.h2, { color: colors.text }]}>{streakInfo.current} days</Text>
                <Text style={[type.caption, { color: colors.textMuted }]}>Current streak</Text>
              </View>
              <View style={{ width: '48%', marginBottom: spacing[12] }}>
                <Text style={[type.h2, { color: colors.text }]}>{streakInfo.best} days</Text>
                <Text style={[type.caption, { color: colors.textMuted }]}>Best streak</Text>
              </View>
              <View style={{ width: '48%', marginBottom: spacing[12] }}>
                <Text style={[type.h2, { color: colors.text }]}>{totalMissions}</Text>
                <Text style={[type.caption, { color: colors.textMuted }]}>Missions done</Text>
              </View>
              <View style={{ width: '48%', marginBottom: spacing[12] }}>
                <Text style={[type.h2, { color: colors.text }]}>{totalKm.toFixed(1)} km</Text>
                <Text style={[type.caption, { color: colors.textMuted }]}>Distance walked</Text>
              </View>
              <View style={{ width: '48%' }}>
                <Text style={[type.h2, { color: colors.text }]}>{visitedIds.length}</Text>
                <Text style={[type.caption, { color: colors.textMuted }]}>Places visited</Text>
              </View>
              <View style={{ width: '48%' }}>
                <Text style={[type.h2, { color: colors.text }]}>{earned}</Text>
                <Text style={[type.caption, { color: colors.textMuted }]}>Tokens earned</Text>
              </View>
            </View>
            {renderChart()}
          </Card>
        </>}
        renderItem={({ item: dateStr }) => {
          const d = days[dateStr];
          const hasActivity = (d.missions && d.missions.length > 0) || d.distanceM > 0;
          return (
            <Card style={{ marginBottom: spacing[12] }}>
              <Text style={[type.label, { color: colors.text, marginBottom: spacing[8] }]}>{dateStr}</Text>
              {!hasActivity ? (
                <Text style={[type.body, { color: colors.textMuted, fontStyle: 'italic' }]}>Rest day</Text>
              ) : (
                <View>
                  <Text style={[type.body, { color: colors.textMuted, marginBottom: spacing[8] }]}>
                    {d.missions?.length || 0} missions, {(d.distanceM / 1000).toFixed(1)} km, {Math.round(d.walkSeconds / 60)} min
                  </Text>
                  {d.missions?.map((m, idx) => (
                    <View key={idx} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing[4] }}>
                       <Ionicons name={m.type === 'GO' ? 'walk' : m.type === 'LOOK' ? 'eye' : 'book'} size={14} color={colors.primary} style={{ marginRight: spacing[8] }} />
                       <Text style={[type.caption, { color: colors.text, flex: 1 }]} numberOfLines={1}>{m.title}</Text>
                       {m.proofUri ? (
                         <Image source={{ uri: m.proofUri }} style={{ width: 24, height: 24, borderRadius: 4 }} />
                       ) : (
                         <View style={{ width: 24, height: 24, borderRadius: 4, backgroundColor: colors.border, alignItems: 'center', justifyContent: 'center' }}>
                           <Ionicons name="image-outline" size={12} color={colors.textMuted} />
                         </View>
                       )}
                    </View>
                  ))}
                  {d.bonuses?.map((b, idx) => (
                    <View key={`b${idx}`} style={{ flexDirection: 'row', alignItems: 'center', marginTop: spacing[4] }}>
                       <Ionicons name="star" size={14} color={colors.tokenText} style={{ marginRight: spacing[8] }} />
                       <Text style={[type.caption, { color: colors.textMuted }]}>{b.reason} (+{b.amount})</Text>
                    </View>
                  ))}
                </View>
              )}
            </Card>
          );
        }}
      />
    </Screen>
  );
}

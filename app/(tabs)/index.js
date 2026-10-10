import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, AppState, RefreshControl, Image, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { useStore, selectIsSetupComplete } from '../../src/store/useStore.js';
import { Screen } from '../../src/components/ui/Screen.js';
import { EmptyState } from '../../src/components/ui/EmptyState.js';
import { Notice } from '../../src/components/ui/Notice.js';
import { ProgressBar } from '../../src/components/ui/ProgressBar.js';
import { TokenBadge } from '../../src/components/TokenBadge.js';
import { MissionCard } from '../../src/components/MissionCard.js';
import { Button } from '../../src/components/ui/Button.js';
import { Card } from '../../src/components/ui/Card.js';
import { WalkCard } from '../../src/components/WalkCard.js';
import { RewardToast } from '../../src/components/ui/RewardToast.js';
import { colors, spacing, type, radius } from '../../src/theme.js';
import * as Location from 'expo-location';
import { haversineMeters } from '../../src/utils/geo.js';
import { CONFIG } from '../../src/config.js';
import { ensureToday, onMissionCompleted, skip, evaluateProgress } from '../../src/missions/controller.js';
import { Ionicons } from '@expo/vector-icons';
import { computeStreak } from '../../src/progress/streak.js';
import { isoWeekKey } from '../../src/utils/date.js';

export default function MissionsTab() {
  const router = useRouter();
  const hasHydrated = useStore((state) => state.hasHydrated);
  const isSetupComplete = useStore(selectIsSetupComplete);
  const missions = useStore((state) => state.missions);
  const days = useStore((state) => state.days);
  const area = useStore((state) => state.area);
  const walk = useStore((state) => state.walk);
  
  const [refreshing, setRefreshing] = useState(false);
  const [darknessNotice, setDarknessNotice] = useState(false);

  const checkAppResume = useCallback(() => {
    if (!hasHydrated || !isSetupComplete) return;
    ensureToday();
    evaluateProgress();
    
    const hour = new Date().getHours();
    setDarknessNotice(hour < CONFIG.SAFETY.daylightStartHour || hour >= CONFIG.SAFETY.daylightEndHour);
    
    // Check stale walk
    const currentWalk = useStore.getState().walk;
    if (currentWalk?.active) {
       const staleMin = (Date.now() - (currentWalk.lastFixAt || currentWalk.startedAt)) / 60000;
       if (staleMin > CONFIG.WALK.staleSessionMinutes) {
          // stop it via controller
          const { stopWalk } = require('../../src/progress/walkController.js');
          stopWalk();
       }
    }
  }, [hasHydrated, isSetupComplete]);

  useEffect(() => {
    checkAppResume();
    const sub = AppState.addEventListener('change', (nextAppState) => {
      if (nextAppState === 'active') {
        checkAppResume();
      } else if (nextAppState === 'background') {
        const currentWalk = useStore.getState().walk;
        if (currentWalk?.active) {
          const { pauseWalk } = require('../../src/progress/walkController.js');
          pauseWalk();
        }
      }
    });
    return () => sub.remove();
  }, [checkAppResume]);
  
  useEffect(() => {
    const currentWalk = useStore.getState().walk;
    if (currentWalk?.active && AppState.currentState === 'active') {
       const { resumeWalk } = require('../../src/progress/walkController.js');
       resumeWalk();
    }
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await ensureToday();
    setRefreshing(false);
  }, []);

  if (!hasHydrated) return null;

  const headerRight = <TokenBadge />;
  
  const todayStr = new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD
  const dayData = days[todayStr] || {};
  const todayMissions = dayData.missions || [];
  const todayDist = dayData.distanceM || 0;
  
  const streakInfo = computeStreak(days, todayStr, CONFIG.STREAK);
  const nextRewardDay = [3, 7, 14, 30].find(m => m > streakInfo.current) || 30;
  const nextRewardTokens = CONFIG.STREAK.milestones[nextRewardDay] || 0;
  
  const weekKey = isoWeekKey(todayStr);
  const weekDist = Object.keys(days).filter(d => isoWeekKey(d) === weekKey).reduce((sum, d) => sum + (days[d].distanceM || 0), 0);

  const openSlots = missions?.items?.filter(m => m.status !== 'done') || [];

  return (
    <>
    <RewardToast />
    <Screen scroll title="Today" rightSlot={headerRight} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
      {!isSetupComplete ? (
        <EmptyState 
          icon="compass" 
          title="Set up Touch Grass" 
          body="Download the AI model and save your local map area. You only need internet for this step." 
          action={{ label: 'Go to Setup', onPress: () => router.navigate('/setup') }}
        />
      ) : (
        <View style={{ padding: spacing[16] }}>
          
          <Card style={{ marginBottom: spacing[16] }}>
             <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing[12] }}>
               <Ionicons name="flame" size={20} color={colors.primary} style={{ marginRight: spacing[8] }} />
               <Text style={[type.label, { color: colors.text }]}>Next reward at day {nextRewardDay}: +{nextRewardTokens}</Text>
             </View>
             
             <Text style={[type.label, { color: colors.textMuted, marginBottom: spacing[4] }]}>Daily distance</Text>
             <ProgressBar progress={Math.min(1, todayDist / CONFIG.GOALS.dailyDistanceM)} />
             <Text style={[type.caption, { color: colors.textMuted, marginTop: spacing[4], marginBottom: spacing[12] }]}>
               {Math.round(todayDist)} / {CONFIG.GOALS.dailyDistanceM} m (about {Math.round(todayDist / CONFIG.WALK.strideM)} steps estimated)
             </Text>
             
             <Text style={[type.label, { color: colors.textMuted, marginBottom: spacing[4] }]}>Weekly distance</Text>
             <ProgressBar progress={Math.min(1, weekDist / CONFIG.GOALS.weeklyDistanceM)} />
             <Text style={[type.caption, { color: colors.textMuted, marginTop: spacing[4], marginBottom: spacing[12] }]}>
               {Math.round(weekDist)} / {CONFIG.GOALS.weeklyDistanceM} m
             </Text>
             
             <Text style={[type.label, { color: colors.textMuted }]}>{todayMissions.length} missions done today</Text>
          </Card>
          
          {area?.source === 'sample' && (
            <View style={{ marginBottom: spacing[16] }}>
              <Notice variant="warn" text="Using sample map data" />
            </View>
          )}
          
          {darknessNotice && (
            <View style={{ marginBottom: spacing[16] }}>
              <Notice variant="warn" text="It may be dark outside. Do missions in daylight on lit public paths." />
            </View>
          )}
          
          <WalkCard />
          
          <Text style={[type.h2, { marginBottom: spacing[12] }]}>Open missions</Text>
          {openSlots.map(m => (
            <View key={m.id}>
              <MissionCard mission={m} onComplete={(_, reward, updates) => onMissionCompleted({ ...m, ...updates })} />
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: -spacing[12], marginBottom: spacing[24], paddingHorizontal: spacing[12] }}>
                 <Text style={[type.caption, { color: colors.textMuted }]}>{m.type} {(missions.seq[m.type] || 0) + 1} of {CONFIG.MISSIONS.dailyCap[m.type]} today</Text>
                 <Button 
                   variant="ghost" size="small" label="Skip" 
                   disabled={(missions.skips[m.type] || 0) >= CONFIG.MISSIONS.skipsPerTypePerDay} 
                   onPress={() => skip(m)} 
                 />
              </View>
            </View>
          ))}
          
          {todayMissions.length > 0 && (
            <View style={{ marginTop: spacing[16] }}>
              <Text style={[type.h2, { marginBottom: spacing[12] }]}>Completed today</Text>
              {todayMissions.map((m, i) => (
                <View key={i} style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, padding: spacing[12], borderRadius: radius[8], marginBottom: spacing[8] }}>
                  <Ionicons name={m.type === 'GO' ? 'walk' : m.type === 'LOOK' ? 'eye' : 'book'} size={20} color={colors.success} style={{ marginRight: spacing[12] }} />
                  <View style={{ flex: 1 }}>
                    <Text style={[type.body, { color: colors.text }]} numberOfLines={1}>{m.title}</Text>
                    <Text style={[type.caption, { color: colors.textMuted }]}>{new Date(m.completedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • +{m.reward}</Text>
                  </View>
                  {m.proofUri && (
                    <Image source={{ uri: m.proofUri }} style={{ width: 40, height: 40, borderRadius: 6 }} />
                  )}
                </View>
              ))}
            </View>
          )}

        </View>
      )}
    </Screen>
    </>
  );
}

import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, AppState, RefreshControl, Image, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
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
import { ProofModal } from '../../src/components/ProofModal.js';
import { colors, spacing, type, radius } from '../../src/theme.js';
import * as Location from 'expo-location';
import { haversineMeters } from '../../src/utils/geo.js';
import { CONFIG } from '../../src/config.js';
import { ensureToday, onMissionCompleted, skip, evaluateProgress, recheckUnavailableMissions } from '../../src/missions/controller.js';
import { getAllPendingProofFiles, checkPendingCameraResult, clearPendingProof } from '../../src/location/checkin.js';
import { Ionicons } from '@expo/vector-icons';
import { computeStreak } from '../../src/progress/streak.js';
import { isoWeekKey, todayString } from '../../src/utils/date.js';
import { formatDistance } from '../../src/utils/format.js';

export default function MissionsTab() {
  const router = useRouter();
  const hasHydrated = useStore((state) => state.hasHydrated);
  const isSetupComplete = useStore(selectIsSetupComplete);
  const missions = useStore((state) => state.missions);
  const days = useStore((state) => state.days);
  const area = useStore((state) => state.area);
  const walk = useStore((state) => state.walk);
  
  const [refreshing, setRefreshing] = useState(false);
  const [updatedText, setUpdatedText] = useState(false);
  const [darknessNotice, setDarknessNotice] = useState(false);
  const [recoveredProof, setRecoveredProof] = useState(null);
  const [selectedProofMission, setSelectedProofMission] = useState(null);

  const checkScreenPendingProof = useCallback(async (delayMs = 0) => {
    try {
      const pendingFiles = await getAllPendingProofFiles();
      if (!pendingFiles || pendingFiles.length === 0) return;
      if (delayMs > 0) {
        await new Promise(r => setTimeout(r, delayMs));
      }
      const res = await checkPendingCameraResult();
      if (res && !res.canceled && res.assets && res.assets.length > 0) {
        const file = pendingFiles[0];
        await clearPendingProof(file.id);
        setRecoveredProof({
          missionId: file.id,
          mode: file.data?.mode || 'complete',
          asset: res.assets[0]
        });
      }
    } catch (e) {
      console.warn('Screen level recovery error:', e);
    }
  }, []);

  const checkAppResume = useCallback(() => {
    if (!hasHydrated || !isSetupComplete) return;
    ensureToday();
    recheckUnavailableMissions();
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

  // Re-check unavailable slots on focus
  useFocusEffect(
    useCallback(() => {
      if (hasHydrated && isSetupComplete) {
        recheckUnavailableMissions();
      }
    }, [hasHydrated, isSetupComplete])
  );

  useEffect(() => {
    checkAppResume();
    checkScreenPendingProof(0);

    const sub = AppState.addEventListener('change', (nextAppState) => {
      if (nextAppState === 'active') {
        checkAppResume();
        checkScreenPendingProof(1500);
      } else if (nextAppState === 'background') {
        const currentWalk = useStore.getState().walk;
        if (currentWalk?.active) {
          const { pauseWalk } = require('../../src/progress/walkController.js');
          pauseWalk();
        }
      }
    });
    return () => sub.remove();
  }, [checkAppResume, checkScreenPendingProof]);
  
  useEffect(() => {
    const currentWalk = useStore.getState().walk;
    if (currentWalk?.active && AppState.currentState === 'active') {
       const { resumeWalk } = require('../../src/progress/walkController.js');
       resumeWalk();
    }
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await ensureToday();
      await recheckUnavailableMissions();
      checkAppResume();
      setUpdatedText(true);
      setTimeout(() => setUpdatedText(false), 4000);
    } catch (e) {
      console.warn('Refresh error:', e);
    } finally {
      setRefreshing(false);
    }
  }, [checkAppResume]);

  if (!hasHydrated) return null;

  const todayStr = todayString(); // YYYY-MM-DD
  const dayData = days[todayStr] || {};
  const todayMissions = dayData.missions || [];
  const todayDist = dayData.distanceM || 0;
  
  const streakInfo = computeStreak(days, todayStr, CONFIG.STREAK);
  const nextRewardDay = [3, 7, 14, 30].find(m => m > streakInfo.current) || 30;
  const nextRewardTokens = CONFIG.STREAK.milestones[nextRewardDay] || 0;
  
  const weekKey = isoWeekKey(todayStr);
  const weekDist = Object.keys(days).filter(d => isoWeekKey(d) === weekKey).reduce((sum, d) => sum + (days[d].distanceM || 0), 0);

  const openSlots = missions?.items?.filter(m => m.status !== 'done') || [];
  const estSteps = Math.round(todayDist / CONFIG.WALK.strideM);

  const formattedDate = new Date().toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'short',
    day: 'numeric'
  });

  const headerRight = (
    <View style={{ flexDirection: 'row', alignItems: 'center', flexShrink: 1 }}>
      {updatedText && (
        <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surfaceAlt, paddingHorizontal: spacing[8], paddingVertical: 4, borderRadius: radius.pill, marginRight: spacing[8] }}>
          <Ionicons name="checkmark-circle" size={13} color={colors.success} style={{ marginRight: 4 }} />
          <Text style={[type.caption, { color: colors.textMuted, fontSize: 11 }]}>
            Updated
          </Text>
        </View>
      )}
      <TouchableOpacity 
        accessibilityLabel="Refresh Today" 
        accessibilityRole="button"
        disabled={refreshing} 
        onPress={onRefresh}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.borderSubtle, marginRight: spacing[8], justifyContent: 'center', alignItems: 'center' }}
      >
        {refreshing ? (
          <ActivityIndicator size="small" color={colors.primary} />
        ) : (
          <Ionicons name="refresh" size={18} color={colors.text} />
        )}
      </TouchableOpacity>
      <TokenBadge />
    </View>
  );

  return (
    <Screen
      scroll
      title="Today"
      subtitle={formattedDate}
      rightSlot={headerRight}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      {!isSetupComplete ? (
        <EmptyState 
          icon="compass-outline" 
          title="Set up Touch Grass" 
          body="Download the local AI model and save your neighborhood map area to unlock outdoor missions and the companion." 
          action={{ label: 'Go to Setup', onPress: () => router.navigate('/setup') }}
        />
      ) : (
        <View style={{ paddingHorizontal: spacing[16], paddingBottom: spacing[24] }}>
          
          {/* Daily & Weekly Progress Card */}
          <Card style={{ marginBottom: spacing[16] }} variant="default">
             {/* Streak Milestone Pill */}
             <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: colors.tokenBg, paddingHorizontal: spacing[12], paddingVertical: spacing[8], borderRadius: radius.pill, marginBottom: spacing[16], borderWidth: 1, borderColor: colors.tokenBorder }}>
               <Ionicons name="flame" size={18} color={colors.tokenText} style={{ marginRight: spacing[6] }} />
               <Text style={[type.captionBold, { color: colors.tokenText, flex: 1 }]}>
                 Day {nextRewardDay} Milestone: +{nextRewardTokens} bonus tokens
               </Text>
             </View>
             
             {/* Daily Distance Section */}
             <View style={{ marginBottom: spacing[14] }}>
               <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing[6] }}>
                 <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                   <Text style={[type.label, { color: colors.textSecondary, marginRight: spacing[6] }]}>DAILY TARGET</Text>
                   <View style={{
                     flexDirection: 'row',
                     alignItems: 'center',
                     backgroundColor: todayDist >= CONFIG.GOALS.dailyDistanceM ? colors.successSoft : colors.tokenBg,
                     paddingHorizontal: spacing[6],
                     paddingVertical: 2,
                     borderRadius: radius.pill,
                     borderWidth: 1,
                     borderColor: todayDist >= CONFIG.GOALS.dailyDistanceM ? colors.successBorder : colors.tokenBorder
                   }}>
                     <Ionicons name={todayDist >= CONFIG.GOALS.dailyDistanceM ? "checkmark-circle" : "sparkles"} size={10} color={todayDist >= CONFIG.GOALS.dailyDistanceM ? colors.success : colors.tokenText} style={{ marginRight: 3 }} />
                     <Text style={[type.captionBold, { color: todayDist >= CONFIG.GOALS.dailyDistanceM ? colors.success : colors.tokenText, fontSize: 10 }]}>
                       {todayDist >= CONFIG.GOALS.dailyDistanceM ? `MET (+${CONFIG.GOALS.dailyBonus})` : `+${CONFIG.GOALS.dailyBonus} TOKENS`}
                     </Text>
                   </View>
                 </View>
                 <Text style={[type.bodyBold, { color: colors.text, fontSize: 14 }]}>
                   {formatDistance(todayDist)} <Text style={{ color: colors.textMuted, fontWeight: 'normal' }}>/ {formatDistance(CONFIG.GOALS.dailyDistanceM)}</Text>
                 </Text>
               </View>
               <ProgressBar progress={Math.min(1, todayDist / CONFIG.GOALS.dailyDistanceM)} height={8} />
               <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: spacing[6] }}>
                 <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                   <Ionicons name="footsteps-outline" size={13} color={colors.textMuted} style={{ marginRight: 4 }} />
                   <Text style={[type.caption, { color: colors.textMuted, fontSize: 12 }]}>
                     About {estSteps.toLocaleString()} steps estimated
                   </Text>
                 </View>
                 <Text style={[type.caption, { color: colors.textMuted, fontSize: 11 }]}>
                   +{CONFIG.WALK.tokensPer250M} tokens / 250m
                 </Text>
               </View>
             </View>
             
             {/* Weekly Distance Section */}
             <View style={{ marginBottom: spacing[12] }}>
               <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing[6] }}>
                 <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                   <Text style={[type.label, { color: colors.textSecondary, marginRight: spacing[6] }]}>WEEKLY TARGET</Text>
                   <View style={{
                     flexDirection: 'row',
                     alignItems: 'center',
                     backgroundColor: weekDist >= CONFIG.GOALS.weeklyDistanceM ? colors.successSoft : colors.tokenBg,
                     paddingHorizontal: spacing[6],
                     paddingVertical: 2,
                     borderRadius: radius.pill,
                     borderWidth: 1,
                     borderColor: weekDist >= CONFIG.GOALS.weeklyDistanceM ? colors.successBorder : colors.tokenBorder
                   }}>
                     <Ionicons name={weekDist >= CONFIG.GOALS.weeklyDistanceM ? "checkmark-circle" : "sparkles"} size={10} color={weekDist >= CONFIG.GOALS.weeklyDistanceM ? colors.success : colors.tokenText} style={{ marginRight: 3 }} />
                     <Text style={[type.captionBold, { color: weekDist >= CONFIG.GOALS.weeklyDistanceM ? colors.success : colors.tokenText, fontSize: 10 }]}>
                       {weekDist >= CONFIG.GOALS.weeklyDistanceM ? `MET (+${CONFIG.GOALS.weeklyBonus.toLocaleString()})` : `+${CONFIG.GOALS.weeklyBonus.toLocaleString()} TOKENS`}
                     </Text>
                   </View>
                 </View>
                 <Text style={[type.bodyBold, { color: colors.text, fontSize: 14 }]}>
                   {formatDistance(weekDist)} <Text style={{ color: colors.textMuted, fontWeight: 'normal' }}>/ {formatDistance(CONFIG.GOALS.weeklyDistanceM)}</Text>
                 </Text>
               </View>
               <ProgressBar progress={Math.min(1, weekDist / CONFIG.GOALS.weeklyDistanceM)} height={8} />
             </View>
             
             {/* Done Missions Footnote */}
             <View style={{ borderTopWidth: 1, borderTopColor: colors.borderSubtle, paddingTop: spacing[10], flexDirection: 'row', alignItems: 'center' }}>
               <Ionicons name="checkmark-done" size={16} color={colors.primary} style={{ marginRight: 6 }} />
               <Text style={[type.captionBold, { color: colors.textSecondary }]}>
                 {todayMissions.length} {todayMissions.length === 1 ? 'mission' : 'missions'} completed today
               </Text>
             </View>
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
          
          {/* Open Missions Section */}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: spacing[4], marginBottom: spacing[12] }}>
            <Text style={[type.h2, { color: colors.text }]}>Open missions</Text>
            {openSlots.length > 0 && (
              <View style={{ backgroundColor: colors.surfaceAlt, paddingHorizontal: spacing[8], paddingVertical: 2, borderRadius: radius.pill }}>
                <Text style={[type.label, { color: colors.textMuted, fontSize: 10 }]}>{openSlots.length} AVAILABLE</Text>
              </View>
            )}
          </View>

          {openSlots.map(m => {
            const completedCount = todayMissions.filter(x => x.type === m.type).length;
            const skipsUsed = missions?.skips?.[m.type] || 0;
            const canSkip = skipsUsed < CONFIG.MISSIONS.skipsPerTypePerDay;

            return (
              <View key={m.id}>
                <MissionCard 
                  mission={m} 
                  onComplete={(_, reward, updates) => onMissionCompleted({ ...m, ...updates })} 
                  recoveredProof={recoveredProof?.missionId === m.id ? recoveredProof : null}
                  onClearRecoveredProof={() => setRecoveredProof(null)}
                />
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: -spacing[8], marginBottom: spacing[20], paddingHorizontal: spacing[8] }}>
                   <Text style={[type.caption, { color: colors.textMuted }]}>
                     {m.type}: {completedCount} of {CONFIG.MISSIONS.dailyCap[m.type]} today
                   </Text>
                   <Button 
                     variant="ghost"
                     size="small"
                     label="Skip" 
                     icon={<Ionicons name="arrow-forward" size={13} color={colors.textMuted} />}
                     disabled={!canSkip} 
                     onPress={() => skip(m)} 
                     style={{ minHeight: 32, paddingVertical: 4, paddingHorizontal: spacing[10] }}
                   />
                </View>
              </View>
            );
          })}
          
          {/* Completed Missions Section */}
          {todayMissions.length > 0 && (
            <View style={{ marginTop: spacing[12] }}>
              <Text style={[type.h2, { marginBottom: spacing[12], color: colors.text }]}>Completed today</Text>
              {todayMissions.map((m, i) => (
                <TouchableOpacity 
                  key={i} 
                  activeOpacity={0.8}
                  accessibilityRole="button"
                  accessibilityLabel={`View submission for ${m.title}`}
                  onPress={() => setSelectedProofMission(m)}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    backgroundColor: colors.surface,
                    padding: spacing[12],
                    borderRadius: radius[16],
                    marginBottom: spacing[8],
                    borderWidth: 1,
                    borderColor: colors.borderSubtle
                  }}
                >
                  <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: colors.successSoft, alignItems: 'center', justifyContent: 'center', marginRight: spacing[12] }}>
                    <Ionicons name={m.type === 'GO' ? 'walk' : m.type === 'LOOK' ? 'eye' : 'book'} size={18} color={colors.success} />
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={[type.bodyBold, { color: colors.text, fontSize: 14 }]} numberOfLines={1}>
                      {m.title}
                    </Text>
                    <Text style={[type.caption, { color: colors.textMuted, marginTop: 2 }]}>
                      {new Date(m.completedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • +{m.reward} tokens
                    </Text>
                  </View>
                  {m.proofUri && (
                    <View style={{ position: 'relative' }}>
                      <Image source={{ uri: m.proofUri }} style={{ width: 44, height: 44, borderRadius: radius[8], marginLeft: spacing[8] }} />
                      <View style={{ position: 'absolute', bottom: 2, right: 2, backgroundColor: 'rgba(0,0,0,0.5)', width: 14, height: 14, borderRadius: 7, alignItems: 'center', justifyContent: 'center' }}>
                        <Ionicons name="expand" size={9} color="#FFF" />
                      </View>
                    </View>
                  )}
                </TouchableOpacity>
              ))}
            </View>
          )}

          <ProofModal
            visible={!!selectedProofMission}
            mission={selectedProofMission}
            onClose={() => setSelectedProofMission(null)}
          />

        </View>
      )}
    </Screen>
  );
}

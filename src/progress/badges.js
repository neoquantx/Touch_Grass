import { CONFIG } from '../config.js';

export const BADGE_DEFINITIONS = [
  {
    id: 'first_step',
    title: 'First Step',
    icon: 'leaf',
    description: 'Completed your first outdoor mission.',
    category: 'exploration',
    reward: 200,
    check: ({ totalMissions }) => totalMissions >= 1,
    progress: ({ totalMissions }) => ({ current: Math.min(totalMissions, 1), target: 1 })
  },
  {
    id: 'walk_5k',
    title: '5K Wanderer',
    icon: 'walk',
    description: 'Walked a total of 5 kilometers outdoors.',
    category: 'walking',
    reward: 300,
    check: ({ totalDistanceM }) => totalDistanceM >= 5000,
    progress: ({ totalDistanceM }) => ({ current: Math.min(totalDistanceM, 5000), target: 5000, unit: 'm' })
  },
  {
    id: 'walk_25k',
    title: '25K Explorer',
    icon: 'trail-sign',
    description: 'Walked a total of 25 kilometers exploring your area.',
    category: 'walking',
    reward: 1000,
    check: ({ totalDistanceM }) => totalDistanceM >= 25000,
    progress: ({ totalDistanceM }) => ({ current: Math.min(totalDistanceM, 25000), target: 25000, unit: 'm' })
  },
  {
    id: 'eagle_eye',
    title: 'Eagle Eye',
    icon: 'camera',
    description: 'Completed 5 LOOK outdoor photo scavenger missions.',
    category: 'observation',
    reward: 400,
    check: ({ lookCount }) => lookCount >= 5,
    progress: ({ lookCount }) => ({ current: Math.min(lookCount, 5), target: 5 })
  },
  {
    id: 'local_historian',
    title: 'Local Historian',
    icon: 'library',
    description: 'Discovered and learned about 5 historic landmarks or heritage spots.',
    category: 'knowledge',
    reward: 500,
    check: ({ learnCount }) => learnCount >= 5,
    progress: ({ learnCount }) => ({ current: Math.min(learnCount, 5), target: 5 })
  },
  {
    id: 'arborist',
    title: 'Arborist',
    icon: 'flower',
    description: 'Visited 5 distinct trees, gardens, or nature spots.',
    category: 'nature',
    reward: 400,
    check: ({ natureCount }) => natureCount >= 5,
    progress: ({ natureCount }) => ({ current: Math.min(natureCount, 5), target: 5 })
  },
  {
    id: 'century_club',
    title: 'Century Club',
    icon: 'flash',
    description: 'Accumulated 1,000+ total lifetime tokens earned.',
    category: 'tokens',
    reward: 500,
    check: ({ totalTokensEarned }) => totalTokensEarned >= 1000,
    progress: ({ totalTokensEarned }) => ({ current: Math.min(totalTokensEarned, 1000), target: 1000, unit: '⚡' })
  },
  {
    id: 'week_warrior',
    title: 'Week Warrior',
    icon: 'flame',
    description: 'Maintained an unbroken 7-day streak.',
    category: 'streak',
    reward: 1500,
    check: ({ maxStreak }) => maxStreak >= 7,
    progress: ({ currentStreak }) => ({ current: Math.min(currentStreak, 7), target: 7, unit: 'days' })
  },
  {
    id: 'golden_hour',
    title: 'Golden Hour Explorer',
    icon: 'sunny',
    description: 'Completed a mission or walk during sunrise (6-8 AM) or sunset (5-7 PM).',
    category: 'exploration',
    reward: 350,
    check: ({ hasGoldenHourMission }) => !!hasGoldenHourMission,
    progress: ({ hasGoldenHourMission }) => ({ current: hasGoldenHourMission ? 1 : 0, target: 1 })
  }
];

export function computeBadgeMetrics({ days = {}, journal = [], ledger = [], streakInfo = {} }) {
  const daysList = Object.values(days || {});
  
  let totalMissions = 0;
  let totalDistanceM = 0;
  let lookCount = 0;
  let learnCount = 0;
  let natureCount = 0;
  let hasGoldenHourMission = false;

  for (const d of daysList) {
    totalDistanceM += d.distanceM || 0;
    const missions = d.missions || [];
    totalMissions += missions.length;
    for (const m of missions) {
      if (m.type === 'LOOK') lookCount++;
      if (m.type === 'LEARN' || m.category === 'historic') learnCount++;
      if (m.category === 'tree' || m.category === 'park' || m.category === 'garden' || m.category === 'forest') natureCount++;

      if (m.completedAt) {
        const hour = new Date(m.completedAt).getHours();
        if ((hour >= 6 && hour <= 8) || (hour >= 17 && hour <= 19)) {
          hasGoldenHourMission = true;
        }
      }
    }
  }

  // Also count any distinct journal entries if available
  for (const j of journal || []) {
    if (j.completedAt && !hasGoldenHourMission) {
      const hour = new Date(j.completedAt).getHours();
      if ((hour >= 6 && hour <= 8) || (hour >= 17 && hour <= 19)) {
        hasGoldenHourMission = true;
      }
    }
  }

  const totalTokensEarned = (ledger || [])
    .filter(l => l.amount > 0)
    .reduce((sum, l) => sum + l.amount, 0);

  const currentStreak = streakInfo.current || 0;
  const maxStreak = Math.max(streakInfo.best || 0, currentStreak);

  return {
    totalMissions,
    totalDistanceM,
    lookCount,
    learnCount,
    natureCount,
    totalTokensEarned,
    currentStreak,
    maxStreak,
    hasGoldenHourMission
  };
}

export function evaluateBadges({ days = {}, journal = [], ledger = [], unlockedBadges = {}, streakInfo = {} }) {
  const metrics = computeBadgeMetrics({ days, journal, ledger, streakInfo });
  const newlyUnlocked = [];

  for (const badge of BADGE_DEFINITIONS) {
    if (!unlockedBadges[badge.id]) {
      if (badge.check(metrics)) {
        newlyUnlocked.push({
          ...badge,
          unlockedAt: Date.now()
        });
      }
    }
  }

  return { newlyUnlocked, metrics };
}

import { isoWeekKey, weekDates } from '../utils/date.js';
import { computeStreak } from './streak.js';

export function computeBonuses({ days, claimed, todayStr, cfg }) {
  const newBonuses = [];
  
  const tryAdd = (key, amount, reason) => {
    if (!claimed[key] && !newBonuses.some(b => b.key === key)) {
      newBonuses.push({ key, amount, reason, ts: Date.now() });
    }
  };
  
  // Daily goals
  for (const date of Object.keys(days)) {
    const d = days[date];
    if (d.distanceM >= cfg.goals.dailyDistanceM) {
      tryAdd(`goal:day:${date}`, cfg.goals.dailyBonus, 'Daily distance goal met');
    }
  }
  
  // Weekly goals
  const weeks = {};
  for (const date of Object.keys(days)) {
    const weekKey = isoWeekKey(date);
    if (!weeks[weekKey]) weeks[weekKey] = 0;
    weeks[weekKey] += days[date].distanceM || 0;
  }
  
  for (const week of Object.keys(weeks)) {
    if (weeks[week] >= cfg.goals.weeklyDistanceM) {
      tryAdd(`goal:week:${week}`, cfg.goals.weeklyBonus, 'Weekly distance goal met');
    }
  }
  
  // Streak milestones
  const streak = computeStreak(days, todayStr, cfg.streak);
  if (streak.startDate) {
    for (const milestoneStr of Object.keys(cfg.streak.milestones)) {
      const ms = parseInt(milestoneStr, 10);
      if (streak.current >= ms) {
        tryAdd(`streak:${streak.startDate}:${ms}`, cfg.streak.milestones[milestoneStr], `${ms} day streak!`);
      }
    }
  }
  
  // What about past streaks? The rule says `streak:<startDate>:<milestone>`.
  // To handle past streaks, we need to iterate through all streaks. 
  // Let's implement finding all streaks.
  const sortedDates = Object.keys(days).sort();
  let currentStart = null;
  let currentLen = 0;
  
  const processStreak = (start, len) => {
    if (!start) return;
    for (const milestoneStr of Object.keys(cfg.streak.milestones)) {
      const ms = parseInt(milestoneStr, 10);
      if (len >= ms) {
        tryAdd(`streak:${start}:${ms}`, cfg.streak.milestones[milestoneStr], `${ms} day streak!`);
      }
    }
  };
  
  // Re-eval streaks over all history
  // Actually, computeStreak only gives the current and best.
  // We can just iterate through dates.
  let tempLen = 0;
  let tempStart = null;
  let prevDate = null;
  
  for (const d of sortedDates) {
    const counts = days[d].missions?.length >= cfg.streak.minMissions || (days[d].distanceM || 0) >= cfg.streak.minWalkM;
    if (!counts) continue;
    
    if (!prevDate) {
      tempLen = 1;
      tempStart = d;
    } else {
      const gap = Math.round((new Date(d+'T12:00:00Z') - new Date(prevDate+'T12:00:00Z')) / 86400000);
      if (gap === 1) {
        tempLen++;
      } else if (gap > 1) {
        processStreak(tempStart, tempLen);
        tempLen = 1;
        tempStart = d;
      }
    }
    prevDate = d;
    processStreak(tempStart, tempLen); // evaluate at each day so milestone can trigger mid-streak
  }
  
  return newBonuses;
}

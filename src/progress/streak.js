import { addDays, daysBetween } from '../utils/date.js';

export function dayCounts(dayData, cfg) {
  if (!dayData) return false;
  const missionCount = dayData.missions ? dayData.missions.length : 0;
  const distance = dayData.distanceM || 0;
  return missionCount >= cfg.minMissions || distance >= cfg.minWalkM;
}

export function computeStreak(days, todayStr, cfg) {
  let best = 0;
  let current = 0;
  let startDate = null;
  
  // Sort days ascending
  const sortedDates = Object.keys(days).sort((a, b) => daysBetween(b, a)); // wait, a-b means ascending? b,a means b-a? 
  // actually daysBetween(a,b) = b-a. 
  // Let's sort ascending by string comparison
  const sorted = Object.keys(days).sort();
  
  let tempCurrent = 0;
  let tempStart = null;
  let prevDate = null;
  
  for (const d of sorted) {
    if (!dayCounts(days[d], cfg)) continue;
    
    if (!prevDate) {
      tempCurrent = 1;
      tempStart = d;
    } else {
      const gap = daysBetween(prevDate, d);
      if (gap === 1) {
        tempCurrent++;
      } else if (gap > 1) {
        tempCurrent = 1;
        tempStart = d;
      }
    }
    
    if (tempCurrent > best) {
      best = tempCurrent;
    }
    
    prevDate = d;
  }
  
  // Calculate current streak relative to today
  let activeCurrent = 0;
  let activeStart = null;
  const todayCounted = dayCounts(days[todayStr], cfg);
  
  if (todayCounted) {
    activeCurrent = tempCurrent;
    activeStart = tempStart;
    if (prevDate !== todayStr) {
        // wait, tempCurrent might be from an old streak if today is the first day of a new one?
        // Let's count backwards from today or yesterday to find the active streak.
    }
  }
  
  // Better approach: count backwards from today
  activeCurrent = 0;
  activeStart = null;
  
  let checkDate = todayStr;
  if (!todayCounted) {
    checkDate = addDays(todayStr, -1);
  }
  
  if (dayCounts(days[checkDate], cfg)) {
    while (dayCounts(days[checkDate], cfg)) {
      activeCurrent++;
      activeStart = checkDate;
      checkDate = addDays(checkDate, -1);
    }
  }
  
  return {
    current: activeCurrent,
    best,
    startDate: activeStart,
    todayCounted
  };
}

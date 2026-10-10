export const CONFIG = {
  PHOTO: { minBytes: 8000 },
  LLM: { nThreads: 4 },
  MODEL: {
    name: 'Qwen2.5-0.5B-Instruct',
    url: 'https://huggingface.co/Qwen/Qwen2.5-0.5B-Instruct-GGUF/resolve/main/qwen2.5-0.5b-instruct-q4_k_m.gguf',
    fileName: 'qwen2.5-0.5b-instruct-q4_k_m.gguf',
    minBytes: 350000000,
    
    approxMB: 469,
  },
  AREA: {
    radiusMeters: 1000,
    maxElements: 600,
    overpassEndpoints: [
      "https://overpass-api.de/api/interpreter",
      "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
      "https://overpass.private.coffee/api/interpreter"
    ],
    timeoutMs: 25000
  },
  REWARDS: { GO: 500, LOOK: 300, LEARN: 700 },
  CHECKIN: { 
    maxAccuracyMeters: 50, 
    radiusMeters: 60,
    photoMaxAgeMs: 600000 
  },
  // Caps abuse and controls pacing
  MISSIONS: { slots: 3, skipsPerTypePerDay: 3, dailyCap: { GO: 6, LOOK: 6, LEARN: 6 } },
  // Controls reasonable human walk behavior, filters out cars/gps drift
  WALK: { minAccuracyM: 25, minSegmentM: 4, maxSpeedMps: 4.2, maxGapSeconds: 120, intervalMs: 3000, distanceIntervalM: 5, tokensPer250M: 100, dailyRewardCapM: 5000, strideM: 0.75, staleSessionMinutes: 5 },
  // Provides healthy activity benchmarks
  GOALS: { dailyDistanceM: 3000, dailyBonus: 300, weeklyDistanceM: 15000, weeklyBonus: 1000 },
  // Motivates consistent return
  STREAK: { minMissions: 1, minWalkM: 1000, milestones: { 3: 300, 7: 1500, 14: 4000, 30: 10000 } },
  // Prevents unlimited state growth while retaining enough useful history
  HISTORY: { keepDays: 120, proofKeepDays: 30, ledgerMax: 200 },
  // Discourages walking outside during nighttime for safety
  SAFETY: { daylightStartHour: 6, daylightEndHour: 19 }
};

export const FEATURES = {
  missionFlavor: false
};

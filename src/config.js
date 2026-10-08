export const CONFIG = {
  MODEL: {
    name: 'Qwen2.5-0.5B-Instruct',
    url: 'https://huggingface.co/Qwen/Qwen2.5-0.5B-Instruct-GGUF/resolve/main/qwen2.5-0.5b-instruct-q4_k_m.gguf',
    fileName: 'qwen2.5-0.5b-instruct-q4_k_m.gguf',
    minBytes: 350000000,
  },
  AREA: {
    radiusMeters: 1500,
    maxElements: 600,
    overpassEndpoints: [
      "https://overpass-api.de/api/interpreter",
      "https://overpass.kumi.systems/api/interpreter"
    ],
    timeoutMs: 30000
  },
  REWARDS: { GO: 500, LOOK: 300, LEARN: 700 },
  CHECKIN: { maxAccuracyMeters: 50, radiusMeters: 60 }
};

import { initLlama, releaseAllLlama } from 'llama.rn';
import { getModelUri } from './modelDownload.js';
import { llmStore } from '../store/useStore.js';
import { CONFIG } from '../config.js';

let llamaContext = null;
let loadPromise = null;

export const ensureLoaded = async () => {
  if (llamaContext) return llamaContext;
  if (loadPromise) return loadPromise;

  loadPromise = (async () => {
    llmStore.setState('loading');
    try {
      const modelPath = getModelUri();
      llamaContext = await initLlama({
        model: modelPath,
        use_mlock: true,
        n_ctx: 2048,
        n_gpu_layers: 99,
        n_threads: CONFIG.LLM.nThreads,
        nThreads: CONFIG.LLM.nThreads,
      });
      llmStore.setState('ready');
      return llamaContext;
    } catch (e) {
      llmStore.setState('error');
      loadPromise = null;
      throw e;
    }
  })();
  
  return loadPromise;
};

export const generate = async ({ messages, maxTokens = 200, onToken, shouldStop }) => {
  const ctx = await ensureLoaded();
  
  let text = '';
  let tokenCount = 0;
  const start = Date.now();
  
  const result = await ctx.completion(
    {
      messages,
      n_predict: maxTokens,
      temperature: 0.7
    },
    (data) => {
      text += data.token;
      tokenCount++;
      if (onToken) onToken(data.token);
      if (shouldStop && shouldStop()) {
        ctx.stopCompletion();
      }
    }
  );
  
  const seconds = (Date.now() - start) / 1000;
  const tps = seconds > 0 ? tokenCount / seconds : 0;
  
  return {
    text: result.text || text,
    tokenCount,
    seconds,
    tps
  };
};

export const stop = () => {
  if (llamaContext) {
    llamaContext.stopCompletion();
  }
};

export const release = async () => {
  if (llamaContext) {
    await releaseAllLlama();
    llamaContext = null;
    loadPromise = null;
    llmStore.setState('idle');
  }
};

// Aliases for app/debug.js compatibility
export const loadModel = ensureLoaded;
export const releaseModel = release;
export const generateSentence = async (prompt, onToken) => {
  const ctx = await ensureLoaded();
  return ctx.completion(
    {
      messages: [
        { role: 'system', content: 'You are a helpful assistant.' },
        { role: 'user', content: prompt }
      ],
      n_predict: 50,
      temperature: 0.7
    },
    (data) => {
      if (onToken) onToken(data.token);
    }
  );
};

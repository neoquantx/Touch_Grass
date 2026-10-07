import { initLlama, releaseAllLlama } from 'llama.rn';
import { getModelUri } from './modelDownload';

let llamaContext = null;

export const loadModel = async () => {
  if (llamaContext) return llamaContext;
  
  const modelPath = getModelUri();
  
  llamaContext = await initLlama({
    model: modelPath,
    use_mlock: true,
    n_ctx: 2048,
    n_gpu_layers: 99, // use Metal/OpenCL/NPU if available
  });
  
  return llamaContext;
};

export const generateSentence = async (prompt, onToken) => {
  if (!llamaContext) throw new Error('Model not loaded');
  
  const result = await llamaContext.completion(
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
  
  return result;
};

export const releaseModel = async () => {
  if (llamaContext) {
    await releaseAllLlama();
    llamaContext = null;
  }
};

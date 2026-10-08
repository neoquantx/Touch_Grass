import * as FileSystem from 'expo-file-system/legacy';
import { CONFIG } from '../config';

export const getModelUri = () => {
  return `${FileSystem.documentDirectory}${CONFIG.MODEL_FILENAME}`;
};

export const checkModelExists = async () => {
  const fileInfo = await FileSystem.getInfoAsync(getModelUri());
  return fileInfo.exists;
};

export const downloadModel = async (onProgress) => {
  const uri = getModelUri();
  const exists = await checkModelExists();
  if (exists) return uri;

  const downloadResumable = FileSystem.createDownloadResumable(
    CONFIG.MODEL_URL,
    uri,
    {},
    (downloadProgress) => {
      const progress = downloadProgress.totalBytesWritten / downloadProgress.totalBytesExpectedToWrite;
      if (onProgress) onProgress(progress);
    }
  );

  try {
    const { uri: newUri } = await downloadResumable.downloadAsync();
    return newUri;
  } catch (e) {
    console.error('Download error:', e);
    throw e;
  }
};

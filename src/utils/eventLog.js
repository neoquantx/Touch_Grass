import { AppState } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';

const MAX_MEMORY_LOGS = 200;
const MAX_PERSISTED_LOGS = 100;
const FLUSH_INTERVAL_MS = 5000;
const LOG_FILE = `${FileSystem.documentDirectory}eventlog.json`;

let memoryLogs = [];
let isDirty = false;
let flushTimer = null;
let isFlushing = false;

// Attempt to load existing logs on startup
(async () => {
  try {
    const info = await FileSystem.getInfoAsync(LOG_FILE);
    if (info.exists) {
      const content = await FileSystem.readAsStringAsync(LOG_FILE);
      const parsed = JSON.parse(content);
      if (Array.isArray(parsed)) {
        memoryLogs = parsed.slice(-MAX_MEMORY_LOGS);
      }
    }
  } catch (e) {
    console.warn('Failed to load eventlog.json:', e);
  }
})();

export function logEvent(tag, message, data) {
  const timestamp = new Date().toISOString();
  const entry = {
    id: `${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
    time: timestamp,
    tag: String(tag),
    message: String(message),
    data: data !== undefined ? data : null
  };

  memoryLogs.push(entry);
  if (memoryLogs.length > MAX_MEMORY_LOGS) {
    memoryLogs = memoryLogs.slice(-MAX_MEMORY_LOGS);
  }

  // Also console.log
  if (data !== undefined && data !== null) {
    console.log(`[${tag}] ${message}`, data);
  } else {
    console.log(`[${tag}] ${message}`);
  }

  isDirty = true;
  scheduleFlush();
}

function scheduleFlush() {
  if (!flushTimer) {
    flushTimer = setTimeout(() => {
      flushTimer = null;
      flushEventLogs();
    }, FLUSH_INTERVAL_MS);
  }
}

export async function flushEventLogs() {
  if (flushTimer) {
    clearTimeout(flushTimer);
    flushTimer = null;
  }
  if (!isDirty || isFlushing) return;
  isFlushing = true;
  try {
    const toSave = memoryLogs.slice(-MAX_PERSISTED_LOGS);
    await FileSystem.writeAsStringAsync(LOG_FILE, JSON.stringify(toSave, null, 2));
    isDirty = false;
  } catch (e) {
    console.warn('Failed to persist eventlog.json:', e);
  } finally {
    isFlushing = false;
  }
}

export function getEventLogs() {
  return [...memoryLogs];
}

export async function clearEventLogs() {
  memoryLogs = [];
  isDirty = false;
  if (flushTimer) {
    clearTimeout(flushTimer);
    flushTimer = null;
  }
  try {
    await FileSystem.deleteAsync(LOG_FILE, { idempotent: true });
  } catch (e) {
    console.warn('Failed to delete eventlog.json:', e);
  }
}

// Flush on AppState 'background'
if (typeof AppState !== 'undefined' && AppState.addEventListener) {
  AppState.addEventListener('change', (nextState) => {
    if (nextState === 'background') {
      flushEventLogs();
    }
  });
}

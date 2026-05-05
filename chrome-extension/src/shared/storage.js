/**
 * Pagixo OCR — Shared Storage Wrapper
 *
 * Type-safe wrapper around chrome.storage.local / chrome.storage.sync.
 * Handles chrome.runtime.lastError gracefully in every operation.
 */

import { STORAGE_KEYS } from './constants.js';

// ─── Private Helpers ─────────────────────────────────────────

/** Promisified chrome.storage.local.get with error handling */
function localGet(keys) {
  return new Promise((resolve) => {
    try {
      chrome.storage.local.get(keys, (data) => {
        if (chrome.runtime.lastError) {
          console.warn('[Pagixo Storage] get error:', chrome.runtime.lastError.message);
          resolve({});
          return;
        }
        resolve(data || {});
      });
    } catch (err) {
      console.warn('[Pagixo Storage] get exception:', err);
      resolve({});
    }
  });
}

/** Promisified chrome.storage.local.set with error handling */
function localSet(data) {
  return new Promise((resolve) => {
    try {
      chrome.storage.local.set(data, () => {
        if (chrome.runtime.lastError) {
          console.warn('[Pagixo Storage] set error:', chrome.runtime.lastError.message);
        }
        resolve();
      });
    } catch (err) {
      console.warn('[Pagixo Storage] set exception:', err);
      resolve();
    }
  });
}

// ─── Last Result ─────────────────────────────────────────────

/**
 * Get the most recent OCR result.
 * @returns {Promise<object|null>}
 */
export async function getLastResult() {
  const data = await localGet(STORAGE_KEYS.LAST_RESULT);
  return data[STORAGE_KEYS.LAST_RESULT] || null;
}

/**
 * Save an OCR result — stores as last result AND prepends to history.
 * @param {object} result — { text, confidence, pages, processing_time_ms, filename, ... }
 */
export async function saveResult(result) {
  const stamped = {
    ...result,
    id: result.id || crypto.randomUUID(),
    timestamp: result.timestamp || Date.now(),
  };

  // Save as last result
  await localSet({ [STORAGE_KEYS.LAST_RESULT]: stamped });

  // Prepend to history
  const history = await getHistory();
  history.unshift({
    id: stamped.id,
    filename: stamped.filename || 'Untitled',
    text_preview: (stamped.text || '').substring(0, 200),
    full_text: stamped.text || '',
    confidence: stamped.confidence || 0,
    pages: stamped.pages || 1,
    processing_time_ms: stamped.processing_time_ms || 0,
    model_used: stamped.model_used || null,
    timestamp: stamped.timestamp,
  });

  // Cap at 50 items
  if (history.length > 50) history.length = 50;

  await localSet({ [STORAGE_KEYS.HISTORY]: history });
}

// ─── History ─────────────────────────────────────────────────

/**
 * Get all scan history items.
 * @returns {Promise<Array>}
 */
export async function getHistory() {
  const data = await localGet(STORAGE_KEYS.HISTORY);
  return data[STORAGE_KEYS.HISTORY] || [];
}

/**
 * Delete a single history item by ID.
 * @param {string} id
 */
export async function deleteHistoryItem(id) {
  const history = await getHistory();
  const updated = history.filter((item) => item.id !== id);
  await localSet({ [STORAGE_KEYS.HISTORY]: updated });
}

/**
 * Clear all scan history.
 */
export async function clearHistory() {
  await localSet({ [STORAGE_KEYS.HISTORY]: [] });
}

// ─── Settings ────────────────────────────────────────────────

const DEFAULT_SETTINGS = {
  apiUrl: 'http://localhost:8000',
  autoOpenPanel: true,
  showDropZone: true,
};

/**
 * Get user settings (merged with defaults).
 * @returns {Promise<{apiUrl: string, autoOpenPanel: boolean, showDropZone: boolean}>}
 */
export async function getSettings() {
  const data = await localGet(STORAGE_KEYS.SETTINGS);
  const stored = data[STORAGE_KEYS.SETTINGS] || {};
  return { ...DEFAULT_SETTINGS, ...stored };
}

/**
 * Save user settings (partial update supported).
 * @param {object} partial — e.g. { apiUrl: 'http://...' }
 */
export async function saveSettings(partial) {
  const current = await getSettings();
  const merged = { ...current, ...partial };
  await localSet({ [STORAGE_KEYS.SETTINGS]: merged });
}

// ─── Reactive Listener ──────────────────────────────────────

/**
 * Listen for changes to the last scan result.
 * Fires callback whenever a new result is stored.
 *
 * @param {function} callback — (newResult: object) => void
 * @returns {function} unsubscribe — call to remove the listener
 */
export function onResultChange(callback) {
  const listener = (changes, areaName) => {
    if (areaName !== 'local') return;

    if (changes[STORAGE_KEYS.LAST_RESULT]?.newValue) {
      try {
        callback(changes[STORAGE_KEYS.LAST_RESULT].newValue);
      } catch (err) {
        console.warn('[Pagixo Storage] onResultChange callback error:', err);
      }
    }
  };

  chrome.storage.onChanged.addListener(listener);

  // Return unsubscribe function
  return () => chrome.storage.onChanged.removeListener(listener);
}

/**
 * Listen for changes to scan history.
 * @param {function} callback — (newHistory: Array) => void
 * @returns {function} unsubscribe
 */
export function onHistoryChange(callback) {
  const listener = (changes, areaName) => {
    if (areaName !== 'local') return;

    if (changes[STORAGE_KEYS.HISTORY]?.newValue) {
      try {
        callback(changes[STORAGE_KEYS.HISTORY].newValue);
      } catch (err) {
        console.warn('[Pagixo Storage] onHistoryChange callback error:', err);
      }
    }
  };

  chrome.storage.onChanged.addListener(listener);
  return () => chrome.storage.onChanged.removeListener(listener);
}

/**
 * Listen for API status changes (from background health checks).
 * @param {function} callback — ({apiReachable: bool, checkedAt: number}) => void
 * @returns {function} unsubscribe
 */
export function onApiStatusChange(callback) {
  const listener = (changes, areaName) => {
    // API status is stored in session storage by the background worker
    if (changes[STORAGE_KEYS.API_STATUS]?.newValue) {
      try {
        callback(changes[STORAGE_KEYS.API_STATUS].newValue);
      } catch (err) {
        console.warn('[Pagixo Storage] onApiStatusChange callback error:', err);
      }
    }
  };

  chrome.storage.onChanged.addListener(listener);
  return () => chrome.storage.onChanged.removeListener(listener);
}

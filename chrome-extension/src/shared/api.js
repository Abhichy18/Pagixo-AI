/**
 * Shared API client.
 */

import { ENDPOINTS, BRAND } from './constants.js';

// Timeouts.
const DEFAULT_TIMEOUT_MS = 30_000;  // 30s for OCR (large PDFs can be slow)
const HEALTH_TIMEOUT_MS = 3_000;
const HISTORY_TIMEOUT_MS = 5_000;
const UPLOAD_TIMEOUT_MS = 120_000;  // 2min for very large files

/** Standard headers for all requests. */
function getSecureHeaders() {
  return {
    'X-Client-Version': BRAND.VERSION,
    'X-Client-Name': 'pagixo-chrome-extension',
  };
}

/** Sanitize error messages for UI. */
function sanitizeError(raw) {
  if (!raw) return 'An unknown error occurred';

  const str = typeof raw === 'string' ? raw : String(raw);

  // Strip stack traces, file paths, and internal details.
  const stripped = str
    .replace(/\/[^\s]+\.(py|js|ts):\d+/g, '[internal]')     // file paths
    .replace(/Traceback[\s\S]*$/m, '')                        // Python tracebacks
    .replace(/at\s+\w+\s+\(.*?\)/g, '')                      // JS stack frames
    .replace(/\b(password|secret|key|token)=[^\s&]*/gi, '$1=[REDACTED]')
    .trim();

  // Cap length.
  if (stripped.length > 200) return stripped.substring(0, 197) + '...';
  return stripped || 'An unknown error occurred';
}

/**
 * Check if the OCR API is reachable.
 * @param {string} baseUrl
 * @returns {Promise<{ok: boolean, latencyMs: number, data?: object, error?: string}>}
 */
export async function checkApiHealth(baseUrl) {
  const start = performance.now();

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), HEALTH_TIMEOUT_MS);

    const response = await fetch(`${baseUrl}${ENDPOINTS.HEALTH}`, {
      signal: controller.signal,
      headers: getSecureHeaders(),
    });
    clearTimeout(timeout);

    const latencyMs = Math.round(performance.now() - start);

    if (!response.ok) {
      return { ok: false, latencyMs, error: `HTTP ${response.status}` };
    }

    const data = await response.json().catch(() => null);
    return { ok: true, latencyMs, data };
  } catch (err) {
    const latencyMs = Math.round(performance.now() - start);

    if (err.name === 'AbortError') {
      return { ok: false, latencyMs, error: 'Connection timed out (3s)' };
    }

    return { ok: false, latencyMs, error: sanitizeError(err.message) };
  }
}

/**
 * Upload a file (image/PDF) to the OCR API.
 *
 * Uses XHR for large files to report progress.
 *
 * @param {File|Blob} file
 * @param {string} baseUrl
 * @param {object} [options]
 * @param {function} [options.onProgress] — (percent: number) => void
 * @param {AbortSignal} [options.signal]
 * @returns {Promise<object>}
 */
export async function uploadFile(file, baseUrl, options = {}) {
  const { onProgress, signal } = options;
  const url = `${baseUrl}${ENDPOINTS.OCR}`;

  const formData = new FormData();
  formData.append('file', file, file.name || 'upload.png');

  const useXHR = file.size > 1 * 1024 * 1024 && typeof onProgress === 'function';

  try {
    if (useXHR) {
      return await uploadWithXHR(url, formData, onProgress, signal);
    }
    return await uploadWithFetch(url, formData, signal);
  } catch (err) {
    throw new Error(sanitizeError(err.message));
  }
}

/** @private */
async function uploadWithFetch(url, formData, signal) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);

  // Chain external signal if provided.
  if (signal) {
    signal.addEventListener('abort', () => controller.abort(), { once: true });
  }

  try {
    const response = await fetch(url, {
      method: 'POST',
      body: formData,
      signal: controller.signal,
      headers: getSecureHeaders(),
    });
    clearTimeout(timeout);

    if (!response.ok) {
      const errBody = await response.text().catch(() => '');
      const msg = tryParseErrorMessage(errBody) || `Upload failed (HTTP ${response.status})`;
      throw new Error(msg);
    }

    return response.json();
  } finally {
    clearTimeout(timeout);
  }
}

/** @private */
function uploadWithXHR(url, formData, onProgress, signal) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();

    if (signal) {
      if (signal.aborted) { reject(new Error('Upload aborted')); return; }
      signal.addEventListener('abort', () => xhr.abort(), { once: true });
    }

    xhr.upload.addEventListener('progress', (e) => {
      if (e.lengthComputable && onProgress) {
        onProgress(Math.round((e.loaded / e.total) * 100));
      }
    });

    xhr.addEventListener('load', () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try { resolve(JSON.parse(xhr.responseText)); }
        catch { reject(new Error('Invalid JSON response from server')); }
      } else {
        const msg = tryParseErrorMessage(xhr.responseText) || `Upload failed (HTTP ${xhr.status})`;
        reject(new Error(msg));
      }
    });

    xhr.addEventListener('error', () => reject(new Error('Network error during upload')));
    xhr.addEventListener('abort', () => reject(new Error('Upload aborted')));
    xhr.addEventListener('timeout', () => reject(new Error('Upload timed out')));

    // Set headers.
    const headers = getSecureHeaders();

    xhr.timeout = UPLOAD_TIMEOUT_MS;
    xhr.open('POST', url);
    Object.entries(headers).forEach(([k, v]) => xhr.setRequestHeader(k, v));
    xhr.send(formData);
  });
}

/**
 * Fetch scan history from the API backend.
 */
export async function fetchHistory(baseUrl) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), HISTORY_TIMEOUT_MS);

  try {
    const response = await fetch(`${baseUrl}${ENDPOINTS.HISTORY}`, {
      signal: controller.signal,
      headers: getSecureHeaders(),
    });
    clearTimeout(timeout);

    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const data = await response.json();
    return data.items || data || [];
  } catch (err) {
    clearTimeout(timeout);
    if (err.name === 'AbortError') throw new Error('History request timed out');
    throw new Error(sanitizeError(err.message));
  }
}

// Helpers.

function tryParseErrorMessage(body) {
  if (!body) return null;
  try {
    const parsed = JSON.parse(body);
    return sanitizeError(parsed.detail || parsed.message || parsed.error || null);
  } catch {
    return body.length < 200 ? sanitizeError(body) : null;
  }
}

// Export sanitizer for use in other modules.
export { sanitizeError };

/**
 * Validate extension configuration before making API calls.
 *
 * @param {object} config — { apiUrl: string }
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validateConfig(config = {}) {
  const errors = [];

  // Check API URL is present.
  if (!config.apiUrl || typeof config.apiUrl !== 'string') {
    errors.push('API URL is empty or not a string');
    return { valid: false, errors };
  }

  const url = config.apiUrl.trim();

  // Check not empty after trim.
  if (url.length === 0) {
    errors.push('API URL is empty');
    return { valid: false, errors };
  }

  // Check valid URL format.
  try {
    const parsed = new URL(url);

    // Must be http or https.
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      errors.push(`Invalid protocol "${parsed.protocol}" — must be http: or https:`);
    }

    // Warn on non-localhost in dev.
    if (parsed.hostname !== 'localhost' && parsed.hostname !== '127.0.0.1') {
      // Not an error, but worth noting — could be production
    }

    // Check port is reasonable
    if (parsed.port && (parseInt(parsed.port) < 1 || parseInt(parsed.port) > 65535)) {
      errors.push(`Invalid port "${parsed.port}" — must be 1-65535`);
    }

  } catch {
    errors.push(`"${url}" is not a valid URL`);
  }

  return { valid: errors.length === 0, errors };
}

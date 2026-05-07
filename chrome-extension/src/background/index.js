/**
 * Pagixo OCR — Background Service Worker (The Brain)
 * 
 * Handles: context menus, message routing, API calls,
 * health checks, and side panel management.
 */

import {
  API_BASE_URL,
  ENDPOINTS,
  STORAGE_KEYS,
  SUPPORTED_EXTENSIONS,
  RETRY_CONFIG,
  HEALTH_CHECK_INTERVAL_MS,
} from '../shared/constants.js';

// ─── Chat Endpoints ──────────────────────────────────────────
const CHAT_ENDPOINT = `${API_BASE_URL}/api/chat`;
const CHAT_VISION_ENDPOINT = `${API_BASE_URL}/api/chat-vision`;

// ─── State ───────────────────────────────────────────────────
let lastScanTime = null;
let healthCheckTimer = null;

// ─── 1. CONTEXT MENUS — Setup on Install ─────────────────────
chrome.runtime.onInstalled.addListener(() => {
  console.log('[Pagixo] Extension installed — setting up context menus');

  // Remove old menus first (handles updates cleanly)
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: 'scanImage',
      title: '🔍 Scan with Pagixo OCR',
      contexts: ['image'],
    });

    chrome.contextMenus.create({
      id: 'scanLink',
      title: '🔍 Scan linked image with Pagixo',
      contexts: ['link'],
    });

    chrome.contextMenus.create({
      id: 'scanPage',
      title: '📄 Scan visible area',
      contexts: ['page'],
    });
  });

  // Mark first run for onboarding
  chrome.storage.local.get(STORAGE_KEYS.IS_FIRST_RUN, (data) => {
    if (data[STORAGE_KEYS.IS_FIRST_RUN] === undefined) {
      chrome.storage.local.set({ [STORAGE_KEYS.IS_FIRST_RUN]: true });
    }
  });
});

// Enable side panel to open on extension icon click (fallback)
try {
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true })
    .catch(() => {});
} catch (e) {
  // Older Chrome versions may not support this
}

// ─── 2. CONTEXT MENU HANDLER ─────────────────────────────────
chrome.contextMenus.onClicked.addListener((info, tab) => {
  // CRITICAL: Open side panel SYNCHRONOUSLY as the very first call.
  // chrome.sidePanel.open() requires a user gesture context.
  // ANY await/async before this call will kill the gesture and the
  // panel will NOT open. This must be the first statement.
  if (tab) {
    chrome.sidePanel.open({ windowId: tab.windowId }).catch((err) => {
      console.warn('[Pagixo] Could not open side panel:', err);
    });
  }

  // Now handle the actual scan (async work is fine after the open call)
  (async () => {
    try {
      switch (info.menuItemId) {
        case 'scanImage':
          await handleScanImage(info.srcUrl, tab);
          break;

        case 'scanLink':
          await handleScanLink(info.linkUrl, tab);
          break;

        case 'scanPage':
          await handleScanPage(tab);
          break;
      }
    } catch (err) {
      console.error('[Pagixo] Context menu error:', err);
      setBadge('!', '#EF4444');
    }
  })();
});

async function handleScanImage(srcUrl, tab) {
  if (!srcUrl) return;
  console.log('[Pagixo] Scanning image:', srcUrl.substring(0, 80));
  setBadge('...', '#F59E0B');

  try {
    const response = await fetch(srcUrl);
    const blob = await response.blob();
    const filename = extractFilename(srcUrl) || 'image.png';
    await sendToOCRApi(blob, filename, tab);
  } catch (err) {
    console.error('[Pagixo] Failed to fetch image:', err);
    setBadge('!', '#EF4444');
    storeError('Failed to fetch image: ' + err.message);
  }
}

async function handleScanLink(linkUrl, tab) {
  if (!linkUrl) return;

  const ext = linkUrl.split('.').pop().split('?')[0].toLowerCase();
  const imageExts = ['png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp', 'pdf'];

  if (!imageExts.includes(ext)) {
    console.warn('[Pagixo] Link does not appear to be an image:', linkUrl);
    setBadge('!', '#F59E0B');
    return;
  }

  console.log('[Pagixo] Scanning linked image:', linkUrl.substring(0, 80));
  setBadge('...', '#F59E0B');

  try {
    const response = await fetch(linkUrl);
    const blob = await response.blob();
    const filename = extractFilename(linkUrl) || 'linked-image.' + ext;
    await sendToOCRApi(blob, filename, tab);
  } catch (err) {
    console.error('[Pagixo] Failed to fetch linked image:', err);
    setBadge('!', '#EF4444');
    storeError('Failed to fetch linked image: ' + err.message);
  }
}

async function handleScanPage(tab) {
  console.log('[Pagixo] Requesting area capture from content script');

  try {
    // Ensure content script is injected (may not be on pre-existing tabs)
    await ensureContentScript(tab.id);
    await chrome.tabs.sendMessage(tab.id, { action: 'startCapture' });
  } catch (err) {
    console.error('[Pagixo] Could not reach content script:', err);
    // Fallback: capture the full visible tab
    console.log('[Pagixo] Falling back to full visible tab capture');
    setBadge('...', '#F59E0B');
    await captureAndSend(tab, null);
  }
}

// ─── 3. MESSAGE HANDLER ──────────────────────────────────────
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // Must return true for async response
  handleMessage(message, sender)
    .then((result) => sendResponse(result))
    .catch((err) => {
      console.error('[Pagixo] Message handler error:', err);
      sendResponse({ error: err.message });
    });
  return true; // Keep channel open for async
});

async function handleMessage(message, sender) {
  switch (message.action) {
    case 'processFile':
      return await handleProcessFile(message, sender);

    case 'captureArea':
      return await handleCaptureArea(message, sender);

    case 'captureVisiblePage':
      return await handleCaptureVisiblePage(message);

    case 'getStatus':
      return await handleGetStatus();

    case 'openSidePanel':
      return await openSidePanel(sender.tab?.windowId);

    case 'askAI':
      return await handleAskAI(message);

    default:
      console.warn('[Pagixo] Unknown message action:', message.action);
      return { error: 'Unknown action' };
  }
}

async function handleProcessFile(message, sender) {
  const { data, type, name } = message;
  if (!data) return { error: 'No file data provided' };

  console.log('[Pagixo] Processing file from content script:', name);
  setBadge('...', '#F59E0B');

  try {
    // Convert base64 to blob
    const binaryStr = atob(data);
    const bytes = new Uint8Array(binaryStr.length);
    for (let i = 0; i < binaryStr.length; i++) {
      bytes[i] = binaryStr.charCodeAt(i);
    }
    const blob = new Blob([bytes], { type: type || 'image/png' });
    const filename = name || 'dropped-file.png';

    const tab = sender.tab || null;
    const ocrResult = await sendToOCRApi(blob, filename, tab);
    if (ocrResult.success) {
      await saveContextAfterScan(ocrResult.result, tab, 'upload');
    }
    return ocrResult;
  } catch (err) {
    console.error('[Pagixo] processFile error:', err);
    setBadge('!', '#EF4444');
    storeError(err.message);
    return { error: err.message };
  }
}

async function handleCaptureArea(message, sender) {
  const { rect } = message;
  const tab = sender.tab;

  if (!tab) return { error: 'No tab context' };

  console.log('[Pagixo] Capturing area:', rect);
  setBadge('...', '#F59E0B');

  const captureResult = await captureAndSend(tab, rect);
  if (captureResult.success) {
    await saveContextAfterScan(captureResult.result, tab, 'capture');
  }
  return captureResult;
}

async function handleGetStatus() {
  const data = await chrome.storage.session.get(STORAGE_KEYS.API_STATUS);
  const status = data[STORAGE_KEYS.API_STATUS] || {};

  return {
    apiReachable: status.apiReachable || false,
    lastScanTime: lastScanTime,
    checkedAt: status.checkedAt || null,
  };
}

/**
 * Handles 'captureVisiblePage' — called from the side panel where sender.tab
 * is undefined. The tabId is passed explicitly in the message.
 */
async function handleCaptureVisiblePage(message) {
  const { tabId } = message;

  if (!tabId) {
    // No tabId provided — try to find the active tab
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tabs[0]) return { error: 'No active tab found' };
    const tab = tabs[0];
    console.log('[Pagixo] Capturing visible page (auto-detected tab):', tab.id);
    setBadge('...', '#F59E0B');
    const visResult1 = await captureAndSend(tab, null);
    if (visResult1.success) {
      await saveContextAfterScan(visResult1.result, tab, 'visible_page');
    }
    return visResult1;
  }

  try {
    const tab = await chrome.tabs.get(tabId);
    console.log('[Pagixo] Capturing visible page:', tab.url?.substring(0, 60));
    setBadge('...', '#F59E0B');
    const visResult2 = await captureAndSend(tab, null);
    if (visResult2.success) {
      await saveContextAfterScan(visResult2.result, tab, 'visible_page');
    }
    return visResult2;
  } catch (err) {
    console.error('[Pagixo] captureVisiblePage failed:', err);
    setBadge('!', '#EF4444');
    storeError('Visible page capture failed: ' + err.message);
    return { error: err.message };
  }
}

// ─── 4. API CALL — sendToOCRApi ──────────────────────────────
async function sendToOCRApi(blob, filename, tab) {
  const formData = new FormData();
  formData.append('file', blob, filename);

  // Signal "scan in progress" to the side panel so it shows a loading animation
  chrome.storage.session.set({
    [STORAGE_KEYS.SCAN_IN_PROGRESS]: { active: true, filename, startedAt: Date.now() },
  }).catch(() => {});

  let lastError = null;

  // Retry with exponential backoff
  for (let attempt = 0; attempt < RETRY_CONFIG.MAX_RETRIES; attempt++) {
    try {
      if (attempt > 0) {
        const delay = RETRY_CONFIG.BACKOFF_MS[attempt - 1] || 2000;
        console.log(`[Pagixo] Retry ${attempt}/${RETRY_CONFIG.MAX_RETRIES} after ${delay}ms`);
        await sleep(delay);
      }

      const response = await fetch(`${API_BASE_URL}${ENDPOINTS.OCR}`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errText = await response.text().catch(() => 'Unknown error');
        throw new Error(`HTTP ${response.status}: ${errText}`);
      }

      const result = await response.json();

      // Success — store result
      lastScanTime = Date.now();
      const storedResult = {
        ...result,
        filename,
        timestamp: lastScanTime,
      };

      await chrome.storage.local.set({
        [STORAGE_KEYS.LAST_RESULT]: storedResult,
      });

      // Append to history
      await appendToHistory(storedResult);

      // Badge success
      setBadge('✓', '#10B981');

      // Open side panel
      if (tab) {
        await openSidePanel(tab.windowId);
      }

      console.log('[Pagixo] OCR success:', result.status, `(${result.processing_time_ms}ms)`);

      // Mark scan as complete
      chrome.storage.session.set({
        [STORAGE_KEYS.SCAN_IN_PROGRESS]: false,
      }).catch(() => {});

      return { success: true, result };

    } catch (err) {
      lastError = err;
      console.warn(`[Pagixo] OCR attempt ${attempt + 1} failed:`, err.message);
    }
  }

  // All retries exhausted
  console.error('[Pagixo] OCR failed after all retries:', lastError);
  setBadge('!', '#EF4444');
  storeError(lastError?.message || 'OCR request failed');

  // Still open side panel to show error
  if (tab) {
    await openSidePanel(tab.windowId);
  }

  return { success: false, error: lastError?.message };
}

// ─── 5. HEALTH CHECK ─────────────────────────────────────────
async function checkHealth() {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    const response = await fetch(`${API_BASE_URL}${ENDPOINTS.HEALTH}`, {
      signal: controller.signal,
    });
    clearTimeout(timeout);

    const reachable = response.ok;
    const status = {
      apiReachable: reachable,
      checkedAt: Date.now(),
    };

    await chrome.storage.session.set({ [STORAGE_KEYS.API_STATUS]: status });

    if (reachable) {
      console.log('[Pagixo] Health check: API online ✅');
    } else {
      console.warn('[Pagixo] Health check: API returned', response.status);
    }
  } catch (err) {
    const status = {
      apiReachable: false,
      checkedAt: Date.now(),
      error: err.message,
    };
    await chrome.storage.session.set({ [STORAGE_KEYS.API_STATUS]: status });
    console.warn('[Pagixo] Health check: API offline ❌', err.message);
  }
}

// Start health checks on service worker activation
checkHealth();
healthCheckTimer = setInterval(checkHealth, HEALTH_CHECK_INTERVAL_MS);

// ─── 6. TAB CAPTURE ──────────────────────────────────────────

/** Convert a data URL to a Blob without using fetch (MV3 service workers can't fetch data: URLs) */
function dataUrlToBlob(dataUrl) {
  const [header, base64Data] = dataUrl.split(',');
  const mime = header.match(/:(.*?);/)[1];
  const binaryStr = atob(base64Data);
  const bytes = new Uint8Array(binaryStr.length);
  for (let i = 0; i < binaryStr.length; i++) {
    bytes[i] = binaryStr.charCodeAt(i);
  }
  return new Blob([bytes], { type: mime });
}

async function captureAndSend(tab, rect) {
  try {
    const dataUrl = await chrome.tabs.captureVisibleTab(tab.windowId, {
      format: 'png',
      quality: 95,
    });

    // Convert data URL to blob (manual decode — fetch doesn't work in MV3 service workers)
    let blob = dataUrlToBlob(dataUrl);

    // If rect is provided, crop the image using OffscreenCanvas
    if (rect && rect.width > 0 && rect.height > 0) {
      try {
        blob = await cropImage(blob, rect);
      } catch (cropErr) {
        console.warn('[Pagixo] Crop failed, sending full screenshot:', cropErr);
      }
    }

    const filename = `pagixo-capture-${Date.now()}.png`;
    return await sendToOCRApi(blob, filename, tab);
  } catch (err) {
    console.error('[Pagixo] Tab capture failed:', err);
    setBadge('!', '#EF4444');
    storeError('Screen capture failed: ' + err.message);
    return { error: err.message };
  }
}

async function cropImage(blob, rect) {
  const bitmap = await createImageBitmap(blob);
  const { x, y, width, height } = rect;

  // rect values are percentages of viewport → convert to pixel coords
  const cropX = Math.round((x / 100) * bitmap.width);
  const cropY = Math.round((y / 100) * bitmap.height);
  const cropW = Math.round((width / 100) * bitmap.width);
  const cropH = Math.round((height / 100) * bitmap.height);

  const canvas = new OffscreenCanvas(cropW, cropH);
  const ctx = canvas.getContext('2d');
  ctx.drawImage(bitmap, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH);
  bitmap.close();

  return await canvas.convertToBlob({ type: 'image/png' });
}

// ─── HELPERS ─────────────────────────────────────────────────
function extractFilename(url) {
  try {
    const pathname = new URL(url).pathname;
    const parts = pathname.split('/');
    const last = parts[parts.length - 1];
    return last && last.includes('.') ? last.split('?')[0] : null;
  } catch {
    return null;
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function setBadge(text, color) {
  try {
    chrome.action.setBadgeText({ text });
    chrome.action.setBadgeBackgroundColor({ color });

    // Auto-clear badge after 3 seconds
    if (text === '✓' || text === '!') {
      setTimeout(() => {
        chrome.action.setBadgeText({ text: '' });
      }, 3000);
    }
  } catch (err) {
    console.warn('[Pagixo] Badge update failed:', err);
  }
}

async function openSidePanel(windowId) {
  try {
    if (windowId) {
      await chrome.sidePanel.open({ windowId });
    }
  } catch (err) {
    console.warn('[Pagixo] Could not open side panel:', err);
  }
}

async function appendToHistory(result) {
  try {
    const data = await chrome.storage.local.get(STORAGE_KEYS.HISTORY);
    const history = data[STORAGE_KEYS.HISTORY] || [];

    history.unshift({
      id: crypto.randomUUID(),
      filename: result.filename,
      text_preview: (result.text || '').substring(0, 200),
      full_text: result.text || '',
      confidence: result.confidence || 0,
      pages: result.pages || 1,
      processing_time_ms: result.processing_time_ms || 0,
      model_used: result.model_used || null,
      timestamp: result.timestamp || Date.now(),
    });

    // Keep max 50 items
    if (history.length > 50) history.length = 50;

    await chrome.storage.local.set({ [STORAGE_KEYS.HISTORY]: history });
  } catch (err) {
    console.warn('[Pagixo] Failed to save history:', err);
  }
}

function storeError(message) {
  const errorResult = {
    status: 'error',
    text: '',
    error: message,
    timestamp: Date.now(),
  };

  chrome.storage.local.set({
    [STORAGE_KEYS.LAST_RESULT]: errorResult,
  }).catch((err) => {
    console.warn('[Pagixo] Failed to store error state:', err);
  });

  // Also mark scan progress as done
  chrome.storage.session.set({
    [STORAGE_KEYS.SCAN_IN_PROGRESS]: false,
  }).catch(() => {});
}

// ─── 7. KEYBOARD COMMAND HANDLER ─────────────────────────
chrome.commands.onCommand.addListener((command) => {
  if (command === 'capture-area') {
    console.log('[Pagixo] Keyboard shortcut: capture-area (Ctrl+Shift+S)');

    // CRITICAL: Open side panel SYNCHRONOUSLY as the very first call.
    // chrome.sidePanel.open() requires a user gesture context, and
    // ANY await (even chrome.tabs.query) before this call will destroy
    // the gesture context, causing the panel to silently not open.
    // Use chrome.windows.WINDOW_ID_CURRENT to avoid needing a query.
    chrome.sidePanel.open({ windowId: chrome.windows.WINDOW_ID_CURRENT }).catch((err) => {
      console.warn('[Pagixo] Could not open side panel:', err);
    });

    // Now do the async capture work (gesture context no longer needed)
    (async () => {
      try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tab && tab.url && !tab.url.startsWith('chrome://')) {
          await ensureContentScript(tab.id);
          await chrome.tabs.sendMessage(tab.id, { action: 'startCapture' });
        } else {
          console.warn('[Pagixo] Cannot capture on this page (chrome:// or no tab)');
        }
      } catch (err) {
        console.error('[Pagixo] Shortcut handler error:', err);
        setBadge('!', '#EF4444');
      }
    })();
  }
});

// ─── 8. ENSURE CONTENT SCRIPT IS INJECTED ────────────────
async function ensureContentScript(tabId) {
  try {
    // Try pinging the content script first
    await chrome.tabs.sendMessage(tabId, { action: 'ping' });
  } catch {
    // Content script not loaded yet — inject it
    console.log('[Pagixo] Injecting content script into tab', tabId);
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ['dist/content.js'],
    });
    // Small delay to let script initialize
    await sleep(200);
  }
}

// ─── 9. AI CHAT HANDLER ──────────────────────────────────────
async function handleAskAI({ question, context, history, imageBase64, pageUrl, scanType }) {
  const hasImage = !!imageBase64;
  const endpoint = hasImage ? CHAT_VISION_ENDPOINT : CHAT_ENDPOINT;

  const body = {
    question,
    context: context || '',
    history: history || [],
    page_url: pageUrl || '',
    scan_type: scanType || 'unknown',
  };

  if (hasImage) {
    body.image_base64 = imageBase64;
    body.image_media_type = 'image/png';
  }

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`API returned ${response.status}: ${errText}`);
  }

  return await response.json();
}

// ─── 10. CONTEXT SAVING AFTER SCAN ───────────────────────────
async function saveContextAfterScan(result, tab, scanType) {
  const context = {
    extractedText: result.text || '',
    screenshotBase64: result.imageBase64 || result.screenshotBase64 || null,
    pageUrl: tab?.url || '',
    pageTitle: tab?.title || '',
    scanType, // 'visible_page' | 'capture' | 'upload'
    timestamp: Date.now(),
  };
  await chrome.storage.session.set({ pagixoContext: context });
  // Clear stale chat history when new scan completes
  await chrome.storage.session.remove('pagixoChatHistory');
}

// ─── STARTUP LOG ─────────────────────────────────────────────
console.log('[Pagixo] Background service worker started');
console.log('[Pagixo] API target:', API_BASE_URL);

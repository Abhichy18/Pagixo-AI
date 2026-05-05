/**
 * Pagixo OCR — Content Script: Drag & Drop Overlay + Message Router
 *
 * Injects a full-screen drop zone overlay on any webpage.
 * Uses Shadow DOM to avoid CSS conflicts with host pages.
 * Pure vanilla JS — no external dependencies.
 */

import { initCapture } from './capture.js';

// ─── Constants ───────────────────────────────────────────────
const SUPPORTED_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'application/pdf'];
const SUPPORTED_EXTENSIONS = ['png', 'jpg', 'jpeg', 'webp', 'pdf'];
const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB

// ─── State ───────────────────────────────────────────────────
let dropOverlay = null;
let toastContainer = null;
let dragCounter = 0; // Track nested drag events properly

// ─── Shadow DOM Host Setup ───────────────────────────────────
function createShadowHost(id) {
  const host = document.createElement('div');
  host.id = id;
  host.style.cssText = 'all:initial !important; position:fixed; top:0; left:0; z-index:2147483647; pointer-events:none;';
  document.documentElement.appendChild(host);
  return host.attachShadow({ mode: 'closed' });
}

// ─── Drop Overlay ────────────────────────────────────────────
function createDropOverlay() {
  const host = document.createElement('div');
  host.id = 'pagixo-drop-host';
  host.style.cssText = 'all:initial !important;';
  document.documentElement.appendChild(host);
  const shadow = host.attachShadow({ mode: 'closed' });

  const wrapper = document.createElement('div');
  wrapper.innerHTML = `
    <style>
      * { margin:0; padding:0; box-sizing:border-box; }

      .pagixo-drop-overlay {
        position: fixed;
        top: 0; left: 0; right: 0; bottom: 0;
        z-index: 2147483647;
        background: rgba(15, 13, 46, 0.85);
        backdrop-filter: blur(4px);
        display: none;
        align-items: center;
        justify-content: center;
        pointer-events: all;
        transition: opacity 0.2s ease;
        opacity: 0;
      }

      .pagixo-drop-overlay.visible {
        display: flex;
        opacity: 1;
      }

      .pagixo-drop-inner {
        border: 3px dashed #10B981;
        border-radius: 20px;
        padding: 60px 80px;
        text-align: center;
        max-width: 520px;
        animation: pagixoPulse 2s ease-in-out infinite;
      }

      .pagixo-drop-icon {
        width: 64px; height: 64px;
        margin: 0 auto 20px;
        opacity: 0.9;
      }

      .pagixo-drop-title {
        font-family: 'Inter', system-ui, -apple-system, sans-serif;
        font-size: 20px;
        font-weight: 600;
        color: #E0E7FF;
        margin-bottom: 8px;
        line-height: 1.4;
      }

      .pagixo-drop-subtitle {
        font-family: 'Inter', system-ui, sans-serif;
        font-size: 13px;
        color: #A5B4FC;
        opacity: 0.7;
      }

      @keyframes pagixoPulse {
        0%, 100% { box-shadow: 0 0 10px rgba(16, 185, 129, 0.15); }
        50% { box-shadow: 0 0 30px rgba(16, 185, 129, 0.35); }
      }
    </style>

    <div class="pagixo-drop-overlay" id="overlay">
      <div class="pagixo-drop-inner">
        <svg class="pagixo-drop-icon" viewBox="0 0 24 24" fill="none" stroke="#10B981" stroke-width="1.5">
          <path d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/>
        </svg>
        <div class="pagixo-drop-title">Drop image or PDF to scan with Pagixo OCR</div>
        <div class="pagixo-drop-subtitle">PNG, JPG, WebP, or PDF — up to 20MB</div>
      </div>
    </div>
  `;

  shadow.appendChild(wrapper);

  return {
    host,
    shadow,
    overlay: shadow.getElementById('overlay'),
  };
}

// ─── Toast Notifications ─────────────────────────────────────
function createToastContainer() {
  const host = document.createElement('div');
  host.id = 'pagixo-toast-host';
  host.style.cssText = 'all:initial !important;';
  document.documentElement.appendChild(host);
  const shadow = host.attachShadow({ mode: 'closed' });

  const wrapper = document.createElement('div');
  wrapper.innerHTML = `
    <style>
      .pagixo-toast-container {
        position: fixed;
        bottom: 24px;
        right: 24px;
        z-index: 2147483647;
        display: flex;
        flex-direction: column;
        gap: 8px;
        pointer-events: none;
      }

      .pagixo-toast {
        font-family: 'Inter', system-ui, sans-serif;
        font-size: 13px;
        font-weight: 500;
        padding: 12px 20px;
        border-radius: 10px;
        color: #E0E7FF;
        background: rgba(26, 23, 68, 0.95);
        backdrop-filter: blur(12px);
        border: 1px solid rgba(99, 102, 241, 0.3);
        box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
        pointer-events: auto;
        animation: pagixoSlideIn 0.3s ease-out;
        display: flex;
        align-items: center;
        gap: 8px;
      }

      .pagixo-toast.success {
        border-color: rgba(16, 185, 129, 0.4);
      }

      .pagixo-toast.error {
        border-color: rgba(239, 68, 68, 0.4);
      }

      .pagixo-toast.fade-out {
        animation: pagixoSlideOut 0.3s ease-in forwards;
      }

      .pagixo-toast-spinner {
        width: 14px; height: 14px;
        border: 2px solid rgba(99, 102, 241, 0.3);
        border-top-color: #6366F1;
        border-radius: 50%;
        animation: pagixoSpin 0.8s linear infinite;
      }

      @keyframes pagixoSlideIn {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
      }
      @keyframes pagixoSlideOut {
        from { transform: translateX(0); opacity: 1; }
        to { transform: translateX(100%); opacity: 0; }
      }
      @keyframes pagixoSpin {
        to { transform: rotate(360deg); }
      }
    </style>
    <div class="pagixo-toast-container" id="toasts"></div>
  `;

  shadow.appendChild(wrapper);
  return shadow.getElementById('toasts');
}

function showToast(message, type = 'info', duration = 3000) {
  if (!toastContainer) return;

  const toast = document.createElement('div');
  toast.className = `pagixo-toast ${type}`;

  if (type === 'info') {
    toast.innerHTML = `<div class="pagixo-toast-spinner"></div> ${message}`;
  } else if (type === 'success') {
    toast.innerHTML = `<span style="color:#10B981">✓</span> ${message}`;
  } else if (type === 'error') {
    toast.innerHTML = `<span style="color:#EF4444">✕</span> ${message}`;
  } else {
    toast.textContent = message;
  }

  toastContainer.appendChild(toast);

  if (duration > 0) {
    setTimeout(() => {
      toast.classList.add('fade-out');
      setTimeout(() => toast.remove(), 300);
    }, duration);
  }

  return toast;
}

// ─── Drag & Drop Handlers ────────────────────────────────────
function showOverlay() {
  if (dropOverlay?.overlay) {
    dropOverlay.overlay.classList.add('visible');
    dropOverlay.host.style.pointerEvents = 'auto';
  }
}

function hideOverlay() {
  if (dropOverlay?.overlay) {
    dropOverlay.overlay.classList.remove('visible');
    dropOverlay.host.style.pointerEvents = 'none';
  }
  dragCounter = 0;
}

function isValidFile(file) {
  if (!file) return false;

  // Check MIME type
  if (SUPPORTED_TYPES.includes(file.type)) return true;

  // Fallback: check extension
  if (file.name) {
    const ext = file.name.split('.').pop().toLowerCase();
    return SUPPORTED_EXTENSIONS.includes(ext);
  }

  return false;
}

function handleDragEnter(e) {
  e.preventDefault();
  e.stopPropagation();
  dragCounter++;

  // Only show if dragging files (not text/links from the page)
  if (e.dataTransfer?.types?.includes('Files')) {
    showOverlay();
  }
}

function handleDragOver(e) {
  e.preventDefault();
  e.stopPropagation();
}

function handleDragLeave(e) {
  e.preventDefault();
  e.stopPropagation();
  dragCounter--;

  if (dragCounter <= 0) {
    hideOverlay();
  }
}

async function handleDrop(e) {
  e.preventDefault();
  e.stopPropagation();
  hideOverlay();

  const files = e.dataTransfer?.files;
  if (!files || files.length === 0) return;

  const file = files[0]; // Process first file only

  if (!isValidFile(file)) {
    showToast(`Unsupported file type: ${file.type || file.name}`, 'error');
    return;
  }

  if (file.size > MAX_FILE_SIZE) {
    showToast(`File too large (${(file.size / 1024 / 1024).toFixed(1)}MB). Max 20MB.`, 'error');
    return;
  }

  showToast('Scanning with Pagixo...', 'info', 0); // No auto-dismiss

  try {
    // Read file as ArrayBuffer → convert to base64
    const buffer = await file.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    let binary = '';
    // Process in chunks to avoid call stack overflow on large files
    const chunkSize = 8192;
    for (let i = 0; i < bytes.length; i += chunkSize) {
      const chunk = bytes.subarray(i, i + chunkSize);
      binary += String.fromCharCode.apply(null, chunk);
    }
    const base64 = btoa(binary);

    // Send to background service worker
    chrome.runtime.sendMessage(
      {
        action: 'processFile',
        data: base64,
        type: file.type,
        name: file.name,
      },
      (response) => {
        // Clear scanning toast and show result
        clearToasts();
        if (response?.success) {
          showToast('OCR complete — check the side panel!', 'success');
        } else if (response?.error) {
          showToast('Scan failed: ' + response.error, 'error', 5000);
        }
      }
    );
  } catch (err) {
    clearToasts();
    console.error('[Pagixo] Drop processing error:', err);
    showToast('Failed to process file', 'error');
  }
}

function clearToasts() {
  if (toastContainer) {
    toastContainer.innerHTML = '';
  }
}

// ─── Message Listener (for capture trigger) ──────────────────
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'ping') {
    sendResponse({ ok: true, loaded: true });
    return false;
  }
  if (message.action === 'startCapture') {
    initCapture();
    sendResponse({ ok: true });
  }
  return false; // Synchronous response
});

// ─── Initialize ──────────────────────────────────────────────
function init() {
  // Don't inject on extension pages or chrome:// pages
  if (
    window.location.protocol === 'chrome-extension:' ||
    window.location.protocol === 'chrome:'
  ) {
    return;
  }

  console.log('[Pagixo] Content script loaded');

  // Create Shadow DOM elements
  dropOverlay = createDropOverlay();
  toastContainer = createToastContainer();

  // Attach drag/drop listeners to the window
  window.addEventListener('dragenter', handleDragEnter, true);
  window.addEventListener('dragover', handleDragOver, true);
  window.addEventListener('dragleave', handleDragLeave, true);
  window.addEventListener('drop', handleDrop, true);
}

// Run
init();

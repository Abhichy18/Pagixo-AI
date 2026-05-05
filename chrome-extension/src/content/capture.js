/**
 * Pagixo OCR — Content Script: Area Screenshot Selector
 *
 * Injects a transparent full-screen overlay that lets users
 * click-drag to select a rectangular area for OCR capture.
 * Uses Shadow DOM to avoid CSS conflicts with host pages.
 * Pure vanilla JS — no external dependencies.
 */

// ─── State ───────────────────────────────────────────────────
let captureHost = null;
let isCapturing = false;

// ─── Public API ──────────────────────────────────────────────
export function initCapture() {
  if (isCapturing) {
    console.warn('[Pagixo] Capture already in progress');
    return;
  }

  console.log('[Pagixo] Starting area capture');
  isCapturing = true;
  injectCaptureOverlay();
}

// ─── Capture Overlay ─────────────────────────────────────────
function injectCaptureOverlay() {
  // Clean up any previous overlay
  cleanup();

  // Create Shadow DOM host
  captureHost = document.createElement('div');
  captureHost.id = 'pagixo-capture-host';
  captureHost.style.cssText = 'all:initial !important;';
  document.documentElement.appendChild(captureHost);
  const shadow = captureHost.attachShadow({ mode: 'closed' });

  const wrapper = document.createElement('div');
  wrapper.innerHTML = `
    <style>
      * { margin: 0; padding: 0; box-sizing: border-box; }

      .pagixo-capture-overlay {
        position: fixed;
        top: 0; left: 0;
        width: 100vw; height: 100vh;
        z-index: 2147483647;
        cursor: crosshair;
        user-select: none;
        -webkit-user-select: none;
      }

      /* Semi-transparent background — dims everything outside selection */
      .pagixo-capture-bg {
        position: absolute;
        top: 0; left: 0;
        width: 100%; height: 100%;
        background: rgba(15, 13, 46, 0.35);
        transition: background 0.15s;
      }

      /* Selection rectangle */
      .pagixo-capture-rect {
        position: absolute;
        border: 2px dashed #EF4444;
        background: rgba(239, 68, 68, 0.08);
        box-shadow: 0 0 0 9999px rgba(15, 13, 46, 0.5);
        display: none;
        pointer-events: none;
      }

      .pagixo-capture-rect.active {
        display: block;
      }

      /* Size indicator */
      .pagixo-capture-size {
        position: absolute;
        bottom: -28px;
        left: 50%;
        transform: translateX(-50%);
        font-family: 'Inter', system-ui, monospace;
        font-size: 11px;
        font-weight: 500;
        color: #E0E7FF;
        background: rgba(26, 23, 68, 0.9);
        padding: 3px 10px;
        border-radius: 6px;
        white-space: nowrap;
        border: 1px solid rgba(239, 68, 68, 0.3);
      }

      /* Help text */
      .pagixo-capture-help {
        position: fixed;
        top: 16px;
        left: 50%;
        transform: translateX(-50%);
        font-family: 'Inter', system-ui, sans-serif;
        font-size: 13px;
        font-weight: 500;
        color: #E0E7FF;
        background: rgba(26, 23, 68, 0.92);
        backdrop-filter: blur(8px);
        padding: 10px 24px;
        border-radius: 10px;
        border: 1px solid rgba(99, 102, 241, 0.3);
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
        z-index: 1;
        display: flex;
        align-items: center;
        gap: 10px;
        animation: pagixoFadeDown 0.3s ease-out;
      }

      .pagixo-capture-help kbd {
        font-family: 'Inter', system-ui, monospace;
        font-size: 11px;
        padding: 2px 6px;
        background: rgba(255, 255, 255, 0.1);
        border: 1px solid rgba(255, 255, 255, 0.2);
        border-radius: 4px;
        color: #A5B4FC;
      }

      /* Crosshair guides */
      .pagixo-crosshair-h, .pagixo-crosshair-v {
        position: fixed;
        background: rgba(99, 102, 241, 0.25);
        pointer-events: none;
        z-index: 0;
        transition: none;
      }
      .pagixo-crosshair-h {
        left: 0; right: 0;
        height: 1px;
      }
      .pagixo-crosshair-v {
        top: 0; bottom: 0;
        width: 1px;
      }

      @keyframes pagixoFadeDown {
        from { transform: translateX(-50%) translateY(-20px); opacity: 0; }
        to { transform: translateX(-50%) translateY(0); opacity: 1; }
      }
    </style>

    <div class="pagixo-capture-overlay" id="captureOverlay">
      <div class="pagixo-capture-bg" id="captureBg"></div>
      <div class="pagixo-crosshair-h" id="crossH"></div>
      <div class="pagixo-crosshair-v" id="crossV"></div>
      <div class="pagixo-capture-rect" id="captureRect">
        <div class="pagixo-capture-size" id="captureSize"></div>
      </div>
      <div class="pagixo-capture-help">
        🎯 Click and drag to select area &nbsp;·&nbsp; Press <kbd>ESC</kbd> to cancel
      </div>
    </div>
  `;

  shadow.appendChild(wrapper);

  // Get references
  const overlay = shadow.getElementById('captureOverlay');
  const rect = shadow.getElementById('captureRect');
  const sizeLabel = shadow.getElementById('captureSize');
  const crossH = shadow.getElementById('crossH');
  const crossV = shadow.getElementById('crossV');

  // ─── Drawing State ─────────────────────────────────
  let startX = 0;
  let startY = 0;
  let isDragging = false;

  // ─── Mouse Handlers ────────────────────────────────
  function onMouseMove(e) {
    // Update crosshair guides
    crossH.style.top = e.clientY + 'px';
    crossV.style.left = e.clientX + 'px';

    if (!isDragging) return;

    const currentX = e.clientX;
    const currentY = e.clientY;

    const x = Math.min(startX, currentX);
    const y = Math.min(startY, currentY);
    const w = Math.abs(currentX - startX);
    const h = Math.abs(currentY - startY);

    rect.style.left = x + 'px';
    rect.style.top = y + 'px';
    rect.style.width = w + 'px';
    rect.style.height = h + 'px';

    sizeLabel.textContent = `${w} × ${h} px`;
  }

  function onMouseDown(e) {
    if (e.button !== 0) return; // Left click only

    startX = e.clientX;
    startY = e.clientY;
    isDragging = true;

    rect.classList.add('active');
    rect.style.left = startX + 'px';
    rect.style.top = startY + 'px';
    rect.style.width = '0px';
    rect.style.height = '0px';
  }

  function onMouseUp(e) {
    if (!isDragging) return;
    isDragging = false;

    const endX = e.clientX;
    const endY = e.clientY;

    const x = Math.min(startX, endX);
    const y = Math.min(startY, endY);
    const w = Math.abs(endX - startX);
    const h = Math.abs(endY - startY);

    // Minimum selection size (10x10 pixels)
    if (w < 10 || h < 10) {
      console.log('[Pagixo] Selection too small, cancelled');
      cleanup();
      return;
    }

    // Convert to viewport percentages
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const captureRect = {
      x: (x / vw) * 100,
      y: (y / vh) * 100,
      width: (w / vw) * 100,
      height: (h / vh) * 100,
    };

    console.log('[Pagixo] Area selected:', captureRect);

    // Clean up overlay BEFORE sending message
    cleanup();

    // Send to background for screenshot + crop
    chrome.runtime.sendMessage(
      { action: 'captureArea', rect: captureRect },
      (response) => {
        if (chrome.runtime.lastError) {
          console.error('[Pagixo] Capture message error:', chrome.runtime.lastError);
        }
      }
    );
  }

  // ─── Keyboard Handler ──────────────────────────────
  function onKeyDown(e) {
    if (e.key === 'Escape') {
      console.log('[Pagixo] Capture cancelled by ESC');
      cleanup();
    }
  }

  // ─── Attach Events ─────────────────────────────────
  overlay.addEventListener('mousemove', onMouseMove);
  overlay.addEventListener('mousedown', onMouseDown);
  overlay.addEventListener('mouseup', onMouseUp);
  document.addEventListener('keydown', onKeyDown, true);

  // Store cleanup references
  captureHost._cleanup = () => {
    overlay.removeEventListener('mousemove', onMouseMove);
    overlay.removeEventListener('mousedown', onMouseDown);
    overlay.removeEventListener('mouseup', onMouseUp);
    document.removeEventListener('keydown', onKeyDown, true);
  };
}

// ─── Cleanup ─────────────────────────────────────────────────
function cleanup() {
  isCapturing = false;

  if (captureHost) {
    if (captureHost._cleanup) {
      captureHost._cleanup();
    }
    captureHost.remove();
    captureHost = null;
  }
}

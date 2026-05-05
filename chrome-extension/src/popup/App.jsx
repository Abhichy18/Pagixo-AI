import React, { useState, useEffect, useCallback, useMemo } from 'react';
import StatusBar from './components/StatusBar';
import QuickScan from './components/QuickScan';

/** Format a timestamp as relative time (e.g. "2 minutes ago") */
function timeAgo(ts) {
  if (!ts) return null;
  const diff = Math.floor((Date.now() - ts) / 1000);
  if (diff < 5) return 'just now';
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)} min ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

/**
 * Popup App — Chrome Extension popup (320×480px).
 * Main entry point for quick actions: scan image, capture area.
 */
export default function App() {
  // ─── State ───────────────────────────────────────────────
  const [apiStatus, setApiStatus] = useState('checking'); // 'online' | 'offline' | 'checking'
  const [lastScanTime, setLastScanTime] = useState(null);
  const [dropZoneEnabled, setDropZoneEnabled] = useState(true);
  const [scanInProgress, setScanInProgress] = useState(false);

  // ─── Check API status on mount ───────────────────────────
  useEffect(() => {
    checkStatus();

    // Listen for storage changes (e.g. scan completes while popup is open)
    const listener = (changes) => {
      if (changes.pagixo_api_status) {
        const status = changes.pagixo_api_status.newValue;
        setApiStatus(status?.apiReachable ? 'online' : 'offline');
      }
      if (changes.pagixo_scan_progress) {
        setScanInProgress(!!changes.pagixo_scan_progress.newValue);
      }
      if (changes.pagixo_last_result) {
        const result = changes.pagixo_last_result.newValue;
        if (result?.timestamp) setLastScanTime(result.timestamp);
      }
    };

    chrome.storage.onChanged.addListener(listener);
    return () => chrome.storage.onChanged.removeListener(listener);
  }, []);

  const checkStatus = useCallback(() => {
    setApiStatus('checking');
    try {
      chrome.runtime.sendMessage({ action: 'getStatus' }, (response) => {
        if (chrome.runtime.lastError) {
          setApiStatus('offline');
          return;
        }
        setApiStatus(response?.apiReachable ? 'online' : 'offline');
        if (response?.lastScanTime) setLastScanTime(response.lastScanTime);
      });
    } catch {
      setApiStatus('offline');
    }
  }, []);

  // ─── Load saved settings ─────────────────────────────────
  useEffect(() => {
    chrome.storage.local.get('pagixo_settings', (data) => {
      const settings = data.pagixo_settings || {};
      if (settings.dropZoneEnabled !== undefined) {
        setDropZoneEnabled(settings.dropZoneEnabled);
      }
    });
  }, []);

  // ─── Actions ─────────────────────────────────────────────
  const handleScanImage = () => {
    // Open a file picker by creating a temporary tab
    // (popups can't use file inputs easily, so we trigger via the current tab)
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]) {
        chrome.scripting.executeScript({
          target: { tabId: tabs[0].id },
          func: () => {
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = 'image/png,image/jpeg,image/webp,application/pdf';
            input.style.display = 'none';
            document.body.appendChild(input);

            input.addEventListener('change', (e) => {
              const file = e.target.files[0];
              if (!file) return;

              const reader = new FileReader();
              reader.onload = () => {
                const base64 = reader.result.split(',')[1];
                chrome.runtime.sendMessage({
                  action: 'processFile',
                  data: base64,
                  type: file.type,
                  name: file.name,
                });
              };
              reader.readAsDataURL(file);
              input.remove();
            });

            input.click();
          },
        });
      }
    });
    window.close(); // Close popup after triggering
  };

  const handleCaptureArea = () => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]) {
        chrome.tabs.sendMessage(tabs[0].id, { action: 'startCapture' });
      }
    });
    window.close(); // Close popup so user can select area
  };

  const handleToggleDropZone = () => {
    const newVal = !dropZoneEnabled;
    setDropZoneEnabled(newVal);
    chrome.storage.local.set({
      pagixo_settings: { dropZoneEnabled: newVal },
    });
  };

  const handleViewHistory = () => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]) {
        chrome.sidePanel.open({ windowId: tabs[0].windowId });
      }
    });
    window.close();
  };

  // ─── Render ──────────────────────────────────────────────
  return (
    <div className="w-[320px] min-h-[480px] bg-[#0F0D2E] text-[#E0E7FF] flex flex-col overflow-hidden">

      {/* ─── Header ─────────────────────────────────── */}
      <header className="px-5 pt-5 pb-3 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          {/* Logo mark */}
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-600 to-emerald-500 flex items-center justify-center shadow-lg shadow-indigo-500/20">
            <span className="text-white font-bold text-base tracking-tight">P</span>
          </div>
          <div>
            <h1 className="text-base font-bold leading-tight bg-gradient-to-r from-indigo-300 to-emerald-300 bg-clip-text text-transparent">
              Pagixo OCR
            </h1>
            <p className="text-[10px] text-indigo-300/30 leading-tight">
              v1.0.0
            </p>
          </div>
        </div>

        {/* Status dot */}
        <div className="flex items-center gap-2">
          <button
            onClick={checkStatus}
            className="text-indigo-300/30 hover:text-indigo-300/60 transition-colors"
            title="Refresh status"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
          <span className={`
            w-2.5 h-2.5 rounded-full
            ${apiStatus === 'online' ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.6)]' : ''}
            ${apiStatus === 'offline' ? 'bg-red-400 shadow-[0_0_8px_rgba(248,113,113,0.6)]' : ''}
            ${apiStatus === 'checking' ? 'bg-amber-400 animate-pulse' : ''}
          `} />
        </div>
      </header>

      {/* Subtle divider */}
      <div className="mx-5 h-px bg-gradient-to-r from-transparent via-white/[0.06] to-transparent" />

      {/* ─── Body ───────────────────────────────────── */}
      <div className="flex-1 px-5 py-4 flex flex-col gap-4">

        {/* Status bar */}
        <StatusBar status={apiStatus} lastScanTime={lastScanTime} />

        {/* Last scan time */}
        {lastScanTime && (
          <p className="text-[10px] text-indigo-300/30 px-1 -mt-2">
            Last scan: {timeAgo(lastScanTime)}
          </p>
        )}

        {/* Animated scan progress bar */}
        {scanInProgress && (
          <div className="h-1.5 rounded-full bg-indigo-900/50 overflow-hidden">
            <div className="h-full rounded-full bg-gradient-to-r from-indigo-500 via-emerald-500 to-indigo-500 bg-[length:200%_100%] animate-[shimmer_1.5s_ease-in-out_infinite]" />
          </div>
        )}

        {/* Quick scan buttons */}
        <QuickScan
          apiOnline={apiStatus === 'online'}
          onScanImage={handleScanImage}
          onCaptureArea={handleCaptureArea}
        />

        {/* Keyboard shortcut hint */}
        <div className="flex items-center gap-1.5 px-1">
          <svg className="w-3 h-3 text-indigo-300/20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
          <span className="text-[10px] text-indigo-300/25">
            <kbd className="px-1 py-0.5 rounded bg-white/[0.04] border border-white/[0.06] font-mono text-[9px]">Ctrl+Shift+S</kbd> to capture area
          </span>
        </div>

        {/* ─── Secondary Row ────────────────────────── */}
        <div className="mt-auto space-y-2.5">

          {/* Drag & Drop toggle */}
          <div className="flex items-center justify-between px-1">
            <span className="text-xs text-indigo-300/50 font-medium">Drag & Drop overlay</span>
            <button
              onClick={handleToggleDropZone}
              className={`
                relative w-10 h-[22px] rounded-full transition-all duration-200
                ${dropZoneEnabled
                  ? 'bg-emerald-500/30 border-emerald-500/40'
                  : 'bg-white/[0.06] border-white/10'
                }
                border
              `}
            >
              <div className={`
                absolute top-[2px] w-4 h-4 rounded-full transition-all duration-200
                ${dropZoneEnabled
                  ? 'left-[22px] bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.5)]'
                  : 'left-[2px] bg-white/30'
                }
              `} />
            </button>
          </div>

          {/* View History button */}
          <button
            onClick={handleViewHistory}
            className="
              w-full rounded-xl px-4 py-2.5
              bg-white/[0.04] border border-white/[0.06]
              text-sm font-medium text-indigo-300/60
              flex items-center justify-center gap-2
              hover:bg-white/[0.07] hover:text-indigo-300/90 hover:border-white/10
              transition-all duration-200
              active:scale-[0.98]
            "
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            View History
          </button>
        </div>
      </div>

      {/* ─── Footer ─────────────────────────────────── */}
      <footer className="px-5 py-3 border-t border-white/[0.04] flex items-center justify-between">
        <span className="text-[10px] text-indigo-300/25 font-mono">
          API: localhost:8000
        </span>
        <button
          className="text-indigo-300/20 hover:text-indigo-300/50 transition-colors"
          title="Settings"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </button>
      </footer>
    </div>
  );
}

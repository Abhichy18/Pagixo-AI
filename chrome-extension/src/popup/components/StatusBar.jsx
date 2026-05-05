import React from 'react';

/**
 * StatusBar — API connection indicator with text.
 *
 * Props:
 *   status: 'online' | 'offline' | 'checking'
 *   lastScanTime: timestamp or null
 */
export default function StatusBar({ status, lastScanTime }) {
  const config = {
    online: {
      dotClass: 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.6)]',
      text: 'API Connected — Ready to scan',
      textClass: 'text-emerald-400',
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
      ),
    },
    offline: {
      dotClass: 'bg-red-400 shadow-[0_0_8px_rgba(248,113,113,0.6)]',
      text: 'Server Offline — Start your Python API',
      textClass: 'text-red-400',
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
    },
    checking: {
      dotClass: 'bg-amber-400 animate-pulse',
      text: 'Checking connection...',
      textClass: 'text-amber-400',
      icon: (
        <svg className="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
        </svg>
      ),
    },
  };

  const c = config[status] || config.checking;

  // Format relative time
  const timeAgo = lastScanTime ? getRelativeTime(lastScanTime) : null;

  return (
    <div className="space-y-2">
      {/* Main status banner */}
      <div className={`
        rounded-xl px-3.5 py-2.5
        bg-white/[0.04] border border-white/[0.06]
        flex items-center gap-2.5 text-xs font-medium
        ${c.textClass}
        transition-all duration-300
      `}>
        <span className={c.dotClass + ' w-2 h-2 rounded-full flex-shrink-0'} />
        <span className={c.textClass}>{c.icon}</span>
        <span className="truncate">{c.text}</span>
      </div>

      {/* Offline help banner */}
      {status === 'offline' && (
        <div className="rounded-lg px-3 py-2 bg-red-500/[0.08] border border-red-500/20 text-[11px] text-red-300/80 leading-relaxed">
          Run: <code className="px-1.5 py-0.5 rounded bg-white/[0.06] text-red-300 font-mono text-[10px]">
            uvicorn api.main:app --port 8000
          </code>
        </div>
      )}

      {/* Last scan time */}
      {timeAgo && status === 'online' && (
        <div className="text-[10px] text-indigo-300/40 px-1">
          Last scan: {timeAgo}
        </div>
      )}
    </div>
  );
}

function getRelativeTime(timestamp) {
  const diff = Date.now() - timestamp;
  const seconds = Math.floor(diff / 1000);

  if (seconds < 10) return 'just now';
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return 'over a day ago';
}

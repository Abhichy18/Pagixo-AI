import React, { useState } from 'react';

export default function HistoryList({ history, onSelect, onDelete, onClearAll }) {
  const [confirmClear, setConfirmClear] = useState(false);

  const formatTime = (ts) => {
    if (!ts) return '';
    const diff = Date.now() - ts;
    if (diff < 60000) return 'just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return new Date(ts).toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  if (!history || history.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center p-8 animate-fade">
        <div className="text-center space-y-3">
          <svg className="w-12 h-12 mx-auto text-indigo-300/20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-sm text-indigo-300/40">No scan history yet</p>
          <p className="text-[11px] text-indigo-300/25">Scans will appear here after processing</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full animate-fade">
      <div className="flex items-center justify-between px-1 mb-3">
        <span className="text-xs text-indigo-300/40">{history.length} scan{history.length !== 1 ? 's' : ''}</span>
        {!confirmClear ? (
          <button onClick={() => setConfirmClear(true)} className="text-[11px] text-red-400/50 hover:text-red-400/80 transition-colors">Clear All</button>
        ) : (
          <div className="flex items-center gap-2 animate-fade">
            <span className="text-[11px] text-red-400/70">Delete all?</span>
            <button onClick={() => { onClearAll(); setConfirmClear(false); }} className="text-[11px] px-2 py-0.5 rounded bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors">Yes</button>
            <button onClick={() => setConfirmClear(false)} className="text-[11px] px-2 py-0.5 rounded bg-white/[0.04] text-indigo-300/50 hover:bg-white/[0.07] transition-colors">No</button>
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto space-y-2 pr-1">
        {history.slice(0, 20).map((item, idx) => (
          <div
            key={item.id || idx}
            onClick={() => onSelect(item)}
            className="group rounded-xl px-3 py-2.5 bg-white/[0.03] border border-white/[0.05] hover:bg-white/[0.06] hover:border-indigo-500/20 cursor-pointer transition-all duration-200 flex gap-3 items-start"
          >
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[11px] font-medium text-indigo-300/70 truncate max-w-[140px]">{item.filename || 'Untitled'}</span>
                <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium ${
                  (item.confidence || 0) >= 0.7 ? 'bg-emerald-500/15 text-emerald-400' :
                  (item.confidence || 0) >= 0.4 ? 'bg-amber-500/15 text-amber-400' : 'bg-red-500/15 text-red-400'
                }`}>
                  {Math.round((item.confidence || 0) * 100)}%
                </span>
              </div>
              <p className="text-[11px] text-indigo-300/40 leading-relaxed line-clamp-2">
                {(item.text_preview || item.full_text || '').substring(0, 80)}{(item.text_preview || '').length > 80 ? '...' : ''}
              </p>
              <div className="flex items-center gap-3 mt-1.5">
                <span className="text-[9px] text-indigo-300/25">{formatTime(item.timestamp)}</span>
                {item.processing_time_ms && <span className="text-[9px] text-indigo-300/20">{item.processing_time_ms}ms</span>}
              </div>
            </div>
            <button
              onClick={(e) => { e.stopPropagation(); onDelete(item.id); }}
              className="opacity-0 group-hover:opacity-100 p-1 rounded text-indigo-300/20 hover:text-red-400/80 hover:bg-red-500/10 transition-all"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

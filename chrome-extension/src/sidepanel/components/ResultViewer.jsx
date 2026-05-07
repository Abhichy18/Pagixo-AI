import React, { useState, useEffect, useRef, useMemo } from 'react';
import { AIChatPanel } from './AIChatPanel';
import DOMPurify from 'dompurify';
import { marked } from 'marked';
import katex from 'katex';
import renderMathInElement from 'katex/contrib/auto-render';
import 'katex/dist/katex.min.css';

/**
 * ResultViewer — OCR results with Raw/Markdown/LaTeX sub-tabs.
 * Features: find-in-text, metadata bar, copy/download, open in new tab.
 */
export default function ResultViewer({ result }) {
  const [subTab, setSubTab] = useState('raw');
  const [copied, setCopied] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const latexRef = useRef(null);
  const mdRef = useRef(null);
  const searchRef = useRef(null);

  const text = result?.text || '';
  const wordCount = text.trim() ? text.trim().split(/\s+/).length : 0;
  const charCount = text.length;
  const lineCount = text.split('\n').length;

  // Search match count
  const matchCount = useMemo(() => {
    if (!searchQuery || searchQuery.length < 2) return 0;
    try {
      const re = new RegExp(searchQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
      return (text.match(re) || []).length;
    } catch { return 0; }
  }, [searchQuery, text]);

  // Highlighted text for raw view
  const highlightedHtml = useMemo(() => {
    if (!searchQuery || searchQuery.length < 2 || subTab !== 'raw') return null;
    try {
      const escaped = searchQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const re = new RegExp(`(${escaped})`, 'gi');
      return text.replace(/[<>&"']/g, c => ({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;',"'":'&#39;'}[c]||c))
                 .replace(re, '<mark class="bg-amber-400/40 text-amber-200 rounded px-0.5">$1</mark>');
    } catch { return null; }
  }, [searchQuery, text, subTab]);

  // Keyboard shortcut for search
  useEffect(() => {
    const handler = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
        e.preventDefault();
        setSearchOpen(true);
        setTimeout(() => searchRef.current?.focus(), 50);
      }
      if (e.key === 'Escape' && searchOpen) {
        setSearchOpen(false);
        setSearchQuery('');
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [searchOpen]);

  // Render KaTeX
  useEffect(() => {
    if (subTab === 'latex' && latexRef.current) {
      latexRef.current.textContent = text;
      try {
        renderMathInElement(latexRef.current, {
          delimiters: [
            { left: '$$', right: '$$', display: true },
            { left: '$', right: '$', display: false },
            { left: '\\[', right: '\\]', display: true },
            { left: '\\(', right: '\\)', display: false },
            { left: '\\begin{', right: '\\end{', display: true },
          ],
          throwOnError: false,
          output: 'html',
        });
      } catch (e) { console.warn('[Pagixo] KaTeX error:', e); }
    }
  }, [subTab, text]);

  // Render Markdown (sanitized) — also render math inside markdown
  useEffect(() => {
    if (subTab === 'markdown' && mdRef.current) {
      try {
        const rawHtml = marked.parse(text);
        mdRef.current.innerHTML = DOMPurify.sanitize(rawHtml, {
          ALLOWED_TAGS: ['h1','h2','h3','h4','h5','h6','p','br','hr','ul','ol','li','a','strong','em','code','pre','blockquote','table','thead','tbody','tr','th','td','img','span','div','sub','sup'],
          ALLOWED_ATTR: ['href','src','alt','class','title','target'],
          ALLOW_DATA_ATTR: false,
        });

        // Also render any math expressions inside the markdown
        try {
          renderMathInElement(mdRef.current, {
            delimiters: [
              { left: '$$', right: '$$', display: true },
              { left: '$', right: '$', display: false },
              { left: '\\[', right: '\\]', display: true },
              { left: '\\(', right: '\\)', display: false },
            ],
            throwOnError: false,
          });
        } catch (mathErr) { console.warn('[Pagixo] Math in MD error:', mathErr); }
      } catch (e) { mdRef.current.textContent = text; }
    }
  }, [subTab, text]);

  const handleCopy = async () => {
    try { await navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch {}
  };

  const handleDownload = (ext) => {
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `pagixo-ocr-${Date.now()}.${ext}`; a.click();
    URL.revokeObjectURL(url);
  };

  const handleOpenInTab = () => {
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Pagixo OCR Result</title>
    <style>body{font-family:system-ui;max-width:800px;margin:40px auto;padding:20px;background:#0F0D2E;color:#E0E7FF}
    pre{white-space:pre-wrap;word-wrap:break-word;background:rgba(255,255,255,0.04);padding:20px;border-radius:8px;font-size:14px;line-height:1.7}
    .meta{display:flex;gap:12px;margin-bottom:16px;font-size:12px;color:rgba(165,180,252,0.5)}
    .meta span{background:rgba(255,255,255,0.04);padding:4px 10px;border-radius:6px}</style></head>
    <body><h1 style="background:linear-gradient(to right,#a5b4fc,#6ee7b7);-webkit-background-clip:text;-webkit-text-fill-color:transparent">Pagixo OCR Result</h1>
    <div class="meta"><span>File: ${result?.filename||'Unknown'}</span><span>${charCount} chars</span><span>${wordCount} words</span><span>Confidence: ${Math.round((result?.confidence||0)*100)}%</span></div>
    <pre>${text.replace(/[<>&]/g, c=>({'<':'&lt;','>':'&gt;','&':'&amp;'}[c]))}</pre></body></html>`;
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
  };

  const subTabs = [
    { id: 'raw', label: 'Raw Text' },
    { id: 'markdown', label: 'Markdown' },
    { id: 'latex', label: 'LaTeX' },
  ];

  const timestamp = result?.timestamp
    ? new Date(result.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : '';

  return (
    <div className="animate-slide-in flex flex-col h-full">
      {/* Metadata bar */}
      <div className="flex items-center gap-1.5 px-1 py-2 flex-wrap">
        {[
          { label: 'Conf', value: `${Math.round((result?.confidence || 0) * 100)}%`, color: (result?.confidence || 0) > 0.7 ? 'text-emerald-400' : 'text-amber-400' },
          { label: 'Pages', value: result?.pages || 1 },
          { label: 'Time', value: `${result?.processing_time_ms || 0}ms` },
          { label: 'Chars', value: charCount.toLocaleString() },
          { label: 'Words', value: wordCount.toLocaleString() },
          { label: 'At', value: timestamp },
        ].map((m, i) => (
          <span key={i} className="text-[10px] px-1.5 py-0.5 rounded bg-white/[0.04] border border-white/[0.05] text-indigo-300/50">
            {m.label}: <span className={`font-semibold ${m.color || 'text-indigo-300/80'}`}>{m.value}</span>
          </span>
        ))}
      </div>

      {/* Sub-tabs + search toggle */}
      <div className="flex items-center gap-1 px-1 mb-2">
        {subTabs.map((t) => (
          <button key={t.id} onClick={() => setSubTab(t.id)} className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200
            ${subTab === t.id ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30' : 'text-indigo-300/40 hover:text-indigo-300/60 hover:bg-white/[0.03] border border-transparent'}`}>
            {t.label}
          </button>
        ))}
        <div className="ml-auto flex items-center gap-1">
          <button onClick={() => { setSearchOpen(!searchOpen); if (!searchOpen) setTimeout(() => searchRef.current?.focus(), 50); }}
            className={`p-1 rounded transition-colors ${searchOpen ? 'text-amber-400' : 'text-indigo-300/30 hover:text-indigo-300/50'}`} title="Find (Ctrl+F)">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
          </button>
          <button onClick={handleOpenInTab} className="p-1 rounded text-indigo-300/30 hover:text-indigo-300/50 transition-colors" title="Open in new tab">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"/></svg>
          </button>
        </div>
      </div>

      {/* Search bar */}
      {searchOpen && (
        <div className="flex items-center gap-2 px-1 mb-2 animate-fade">
          <div className="flex-1 flex items-center bg-white/[0.04] border border-white/[0.08] rounded-lg px-2.5 py-1.5 focus-within:border-amber-500/30">
            <svg className="w-3 h-3 text-indigo-300/30 mr-1.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
            <input ref={searchRef} type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Find in text..." className="flex-1 bg-transparent text-xs text-indigo-100/80 placeholder-indigo-300/25 focus:outline-none" />
            {searchQuery && (
              <span className="text-[10px] text-indigo-300/40 ml-1.5">{matchCount} match{matchCount !== 1 ? 'es' : ''}</span>
            )}
          </div>
          <button onClick={() => { setSearchOpen(false); setSearchQuery(''); }} className="text-indigo-300/30 hover:text-indigo-300/50 p-1">
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
          </button>
        </div>
      )}

      {/* Content area */}
      <div className="flex-1 min-h-0 overflow-y-auto mb-3 rounded-xl bg-white/[0.02] border border-white/[0.06]">
        {subTab === 'raw' && (
          highlightedHtml ? (
            <pre className="w-full h-full min-h-[200px] p-3 bg-transparent text-[13px] leading-relaxed text-indigo-100/80 font-mono whitespace-pre-wrap break-words"
              dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(highlightedHtml) }} />
          ) : (
            <div className="flex flex-col">
              {/* Rendered math preview — like Streamlit's "Rendered" tab */}
              <MathPreview text={text} />
              {/* Syntax-highlighted raw source */}
              <RawTextBlock text={text} />
            </div>
          )
        )}
        {subTab === 'markdown' && (
          <div ref={mdRef} className="md-body p-3 text-[13px] leading-relaxed text-indigo-100/80 animate-fade" />
        )}
        {subTab === 'latex' && (
          <div ref={latexRef} className="p-3 text-[13px] leading-relaxed text-indigo-100/80 animate-fade" />
        )}
      </div>

      {/* Action buttons */}
      <div className="flex gap-2 mb-2">
        <button onClick={handleCopy} className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-all duration-200 active:scale-[0.97]
          ${copied ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-white/[0.04] text-indigo-300/60 border border-white/[0.06] hover:bg-white/[0.07] hover:text-indigo-300/90'}`}>
          {copied ? (
            <><svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7"/></svg> Copied!</>
          ) : (
            <><svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3"/></svg> Copy</>
          )}
        </button>
        <button onClick={() => handleDownload('txt')} className="flex items-center justify-center gap-1 px-3 py-2 rounded-lg text-xs font-medium bg-white/[0.04] text-indigo-300/60 border border-white/[0.06] hover:bg-white/[0.07] hover:text-indigo-300/90 transition-all active:scale-[0.97]">
          .txt
        </button>
        <button onClick={() => handleDownload('md')} className="flex items-center justify-center gap-1 px-3 py-2 rounded-lg text-xs font-medium bg-white/[0.04] text-indigo-300/60 border border-white/[0.06] hover:bg-white/[0.07] hover:text-indigo-300/90 transition-all active:scale-[0.97]">
          .md
        </button>
      </div>

      {/* Scan Another — Action Panel */}
      <ScanActionPanel />

      {/* ── Pagixo AI Chat ── */}
      <AIChatPanel text={text} />
    </div>
  );
}

/* ─── Math Preview — Rendered Equation Display ─────── */
function MathPreview({ text }) {
  const previewRef = useRef(null);
  const [renderOk, setRenderOk] = useState(false);

  /**
   * Smart detection: Only show rendered preview for short, pure math expressions.
   * Skip for full documents, tables, long prose, etc.
   */
  const shouldRender = useMemo(() => {
    const trimmed = text.trim();

    // Too long — likely a full document, not a single equation
    if (trimmed.length > 500) return false;

    // Too many lines — likely paragraphs/tables
    const lines = trimmed.split('\n').filter(l => l.trim());
    if (lines.length > 6) return false;

    // Contains markdown table syntax — definitely not pure math
    if (/\|.*\|/.test(trimmed)) return false;

    // Contains markdown headers — it's a document
    if (/^#{1,6}\s/m.test(trimmed)) return false;

    // Contains bullet lists
    if (/^[\-\*]\s/m.test(trimmed)) return false;

    // Must contain at least one LaTeX math command
    const mathCommands = trimmed.match(/\\[a-zA-Z]+/g) || [];
    if (mathCommands.length === 0) return false;

    // Check math density — at least 10% of text should be LaTeX commands
    const mathChars = mathCommands.join('').length;
    if (mathChars / trimmed.length < 0.1) return false;

    return true;
  }, [text]);

  useEffect(() => {
    if (!shouldRender || !previewRef.current) {
      setRenderOk(false);
      return;
    }

    const el = previewRef.current;

    // Wrap the entire text in display math if it doesn't already have delimiters
    let mathText = text.trim();
    const hasDelimiters = /^\$|^\\\[|^\\\(|^\\begin\{/.test(mathText);

    if (!hasDelimiters) {
      mathText = `$$${mathText}$$`;
    }

    el.textContent = mathText;

    try {
      renderMathInElement(el, {
        delimiters: [
          { left: '$$', right: '$$', display: true },
          { left: '$', right: '$', display: false },
          { left: '\\[', right: '\\]', display: true },
          { left: '\\(', right: '\\)', display: false },
        ],
        throwOnError: false,
        output: 'html',
      });
      setRenderOk(true);
    } catch (e) {
      console.warn('[Pagixo] Math preview error:', e);
      setRenderOk(false);
    }
  }, [text, shouldRender]);

  if (!shouldRender) return null;

  return (
    <div className="animate-fade">
      {/* Section header */}
      <div className="flex items-center gap-2 px-3 pt-3 pb-1.5">
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] font-semibold text-emerald-400/70 uppercase tracking-wider">Rendered</span>
          <div className="h-px flex-1 bg-gradient-to-r from-emerald-500/20 to-transparent min-w-[40px]" />
        </div>
      </div>

      {/* Rendered math output */}
      <div className="mx-3 mb-2 px-4 py-5 rounded-lg bg-gradient-to-br from-white/[0.04] to-white/[0.02] border border-white/[0.08] flex items-center justify-center overflow-x-auto">
        <div
          ref={previewRef}
          className="text-indigo-100 text-center"
          style={{ fontSize: '1.15em', lineHeight: '2' }}
        />
      </div>

      {/* Tip */}
      <div className="flex items-start gap-1.5 px-3 pb-2">
        <span className="text-amber-400/50 text-[10px] mt-px">⚠️</span>
        <p className="text-[10px] text-indigo-300/35 leading-relaxed">
          Complex equations may render better in the <strong className="text-indigo-300/50">LaTeX</strong> tab — copy and paste into <strong className="text-indigo-300/50">Overleaf</strong> for full rendering.
        </p>
      </div>

      {/* Divider with "Source" label */}
      <div className="flex items-center gap-2 px-3 pt-1 pb-1.5">
        <span className="text-[10px] font-semibold text-indigo-400/40 uppercase tracking-wider">Source</span>
        <div className="h-px flex-1 bg-gradient-to-r from-indigo-500/15 to-transparent" />
      </div>
    </div>
  );
}

/* ─── Raw Text Block — Premium Code Viewer ─────────── */
function RawTextBlock({ text }) {
  const lines = text.split('\n');

  /**
   * Syntax-highlight a single line of OCR text.
   * Highlights LaTeX commands, math operators, braces, and numbers
   * for a rich, readable display.
   */
  const highlightLine = (line) => {
    if (!line) return <span className="text-indigo-300/20 italic select-none">⏎</span>;

    const parts = [];
    // Regex to match LaTeX commands, math operators, braces, and numbers
    const regex = /(\\[a-zA-Z]+(?:\{[^}]*\})*|[{}]|\$\$?|[+\-*/=<>≡≥≤±∓∞∑∏∫]|\b\d+(?:\.\d+)?\b)/g;
    let lastIndex = 0;
    let match;

    while ((match = regex.exec(line)) !== null) {
      // Push plain text before this match
      if (match.index > lastIndex) {
        parts.push(
          <span key={`t${lastIndex}`} className="text-indigo-100/85">
            {line.slice(lastIndex, match.index)}
          </span>
        );
      }

      const token = match[0];
      let className = '';

      if (token.startsWith('\\')) {
        // LaTeX commands — bright cyan/teal
        className = 'text-emerald-400';
      } else if (token === '{' || token === '}') {
        // Braces — amber
        className = 'text-amber-400/80';
      } else if (token === '$' || token === '$$') {
        // Dollar signs (math delimiters) — violet
        className = 'text-violet-400';
      } else if (/^[+\-*/=<>≡≥≤±∓∞∑∏∫]$/.test(token)) {
        // Math operators — pink
        className = 'text-pink-400/90';
      } else if (/^\d/.test(token)) {
        // Numbers — sky blue
        className = 'text-sky-400';
      }

      parts.push(
        <span key={`m${match.index}`} className={className}>
          {token}
        </span>
      );

      lastIndex = match.index + token.length;
    }

    // Push remaining text
    if (lastIndex < line.length) {
      parts.push(
        <span key={`e${lastIndex}`} className="text-indigo-100/85">
          {line.slice(lastIndex)}
        </span>
      );
    }

    return parts.length > 0 ? parts : <span className="text-indigo-100/85">{line}</span>;
  };

  return (
    <div className="w-full min-h-[200px] overflow-x-auto animate-fade">
      <table className="w-full border-collapse" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
        <tbody>
          {lines.map((line, i) => (
            <tr key={i} className="group hover:bg-white/[0.03] transition-colors duration-100">
              {/* Line number gutter */}
              <td className="
                w-8 min-w-[32px] px-2 py-[1px] text-right align-top
                text-[10px] text-indigo-400/25 select-none
                border-r border-white/[0.04]
                group-hover:text-indigo-400/50 group-hover:border-indigo-500/20
                transition-colors duration-100
                sticky left-0 bg-inherit
              ">
                {i + 1}
              </td>
              {/* Line content */}
              <td className="
                px-3 py-[2px] align-top
                text-[13px] leading-[1.75]
                whitespace-pre-wrap break-words
              ">
                {highlightLine(line)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ─── Scan Action Panel ─────────────────────────────── */
function ScanActionPanel() {
  const [expanded, setExpanded] = useState(false);
  const [hovered, setHovered] = useState(null);

  const handleUploadFile = () => {
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
  };

  const handleCaptureArea = () => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]) {
        // Ensure content script is injected, then trigger capture
        chrome.tabs.sendMessage(tabs[0].id, { action: 'startCapture' }, (response) => {
          if (chrome.runtime.lastError) {
            // Content script not loaded — inject it first
            chrome.scripting.executeScript({
              target: { tabId: tabs[0].id },
              files: ['dist/content.js'],
            }, () => {
              setTimeout(() => {
                chrome.tabs.sendMessage(tabs[0].id, { action: 'startCapture' });
              }, 300);
            });
          }
        });
      }
    });
  };

  const handleScanPage = () => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]) {
        chrome.runtime.sendMessage({ action: 'captureVisiblePage', tabId: tabs[0].id });
      }
    });
  };

  const actions = [
    {
      id: 'upload',
      label: 'Upload Document',
      sublabel: 'Pick an image or PDF file',
      onClick: handleUploadFile,
      gradient: 'from-indigo-600 to-violet-600',
      hoverGradient: 'from-indigo-500 to-violet-500',
      glow: 'shadow-indigo-500/25',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
        </svg>
      ),
    },
    {
      id: 'capture',
      label: 'Capture Area',
      sublabel: 'Draw a region on screen',
      onClick: handleCaptureArea,
      gradient: 'from-emerald-600 to-teal-600',
      hoverGradient: 'from-emerald-500 to-teal-500',
      glow: 'shadow-emerald-500/25',
      kbd: 'Ctrl+Shift+S',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M14.121 14.121L19 19m-7-7l7-7m-7 7l-2.879 2.879M12 12L9.121 9.121m0 5.758a3 3 0 10-4.243 4.243 3 3 0 004.243-4.243zm0-5.758a3 3 0 10-4.243-4.243 3 3 0 004.243 4.243z" />
        </svg>
      ),
    },
    {
      id: 'page',
      label: 'Scan Visible Page',
      sublabel: 'Capture the entire viewport',
      onClick: handleScanPage,
      gradient: 'from-amber-600 to-orange-600',
      hoverGradient: 'from-amber-500 to-orange-500',
      glow: 'shadow-amber-500/25',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
        </svg>
      ),
    },
  ];

  if (!expanded) {
    return (
      <button
        onClick={() => setExpanded(true)}
        className="w-full py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-indigo-500 text-white text-sm font-semibold hover:from-indigo-500 hover:to-indigo-400 transition-all duration-200 active:scale-[0.98] shadow-lg shadow-indigo-500/20 flex items-center justify-center gap-2"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
        </svg>
        Scan Another
      </button>
    );
  }

  return (
    <div className="space-y-2 animate-fade">
      {/* Header with collapse */}
      <div className="flex items-center justify-between mb-1">
        <span className="text-[11px] font-semibold text-indigo-300/60 uppercase tracking-wider">New Scan</span>
        <button
          onClick={() => setExpanded(false)}
          className="p-1 rounded-lg text-indigo-300/30 hover:text-indigo-300/60 hover:bg-white/[0.04] transition-all"
          title="Collapse"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
          </svg>
        </button>
      </div>

      {/* Action buttons */}
      {actions.map((action) => {
        const isHovered = hovered === action.id;

        return (
          <button
            key={action.id}
            onClick={action.onClick}
            onMouseEnter={() => setHovered(action.id)}
            onMouseLeave={() => setHovered(null)}
            className={`
              relative w-full rounded-xl px-3.5 py-3
              bg-gradient-to-r ${isHovered ? action.hoverGradient : action.gradient}
              text-white font-medium text-[13px]
              flex items-center gap-3
              transition-all duration-200 ease-out
              ${isHovered ? `shadow-lg ${action.glow} scale-[1.02]` : 'shadow-md'}
              active:scale-[0.98]
              border border-white/10
              overflow-hidden
            `}
          >
            {/* Icon */}
            <div className={`
              w-9 h-9 rounded-lg bg-white/[0.12] backdrop-blur-sm
              flex items-center justify-center flex-shrink-0
              transition-transform duration-200
              ${isHovered ? 'scale-110 bg-white/[0.18]' : ''}
            `}>
              {action.icon}
            </div>

            {/* Text */}
            <div className="text-left flex-1 min-w-0">
              <div className="leading-tight font-semibold">{action.label}</div>
              <div className="text-[10px] font-normal text-white/50 mt-0.5">{action.sublabel}</div>
            </div>

            {/* Keyboard shortcut badge */}
            {action.kbd && (
              <kbd className="hidden sm:inline-block text-[9px] px-1.5 py-0.5 rounded bg-white/[0.12] border border-white/[0.15] text-white/60 font-mono whitespace-nowrap flex-shrink-0">
                {action.kbd}
              </kbd>
            )}

            {/* Arrow */}
            <svg className={`w-4 h-4 text-white/30 flex-shrink-0 transition-all duration-200 ${isHovered ? 'text-white/60 translate-x-0.5' : ''}`}
              fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>

            {/* Shimmer effect */}
            {isHovered && (
              <div className="absolute inset-0 rounded-xl overflow-hidden pointer-events-none">
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/[0.08] to-transparent"
                  style={{ animation: 'pagixoActionShimmer 1.5s ease-in-out infinite' }} />
              </div>
            )}
          </button>
        );
      })}

      {/* Keyboard shortcut hint */}
      <div className="flex items-center justify-center gap-1.5 pt-1">
        <svg className="w-3 h-3 text-indigo-300/20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
        <span className="text-[10px] text-indigo-300/25">
          Or drag & drop a file onto any webpage
        </span>
      </div>

      <style>{`
        @keyframes pagixoActionShimmer {
          0% { transform: translateX(-150%); }
          100% { transform: translateX(250%); }
        }
      `}</style>
    </div>
  );
}

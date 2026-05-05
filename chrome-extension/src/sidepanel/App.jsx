import React, { useState, useEffect, useCallback } from 'react';
import ResultViewer from './components/ResultViewer';
import HistoryList from './components/HistoryList';
import ScanProgress from './components/ScanProgress';

const STORAGE = {
  LAST_RESULT: 'pagixo_last_result',
  HISTORY: 'pagixo_history',
  SETTINGS: 'pagixo_settings',
  API_STATUS: 'pagixo_api_status',
};

export default function App() {
  const [tab, setTab] = useState('result');
  const [result, setResult] = useState(null);
  const [history, setHistory] = useState([]);
  const [settings, setSettings] = useState({
    apiUrl: 'http://localhost:8000',
    autoOpenPanel: true,
    showDropZone: true,
  });
  const [testStatus, setTestStatus] = useState(null);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [onboardingStep, setOnboardingStep] = useState(0);
  const [isScanning, setIsScanning] = useState(false);
  const [scanFilename, setScanFilename] = useState(null);

  // ─── Load data on mount ───────────────────────────
  useEffect(() => {
    chrome.storage.local.get([STORAGE.LAST_RESULT, STORAGE.HISTORY, STORAGE.SETTINGS, 'pagixo_is_first_run'], (data) => {
      if (data[STORAGE.LAST_RESULT]) setResult(data[STORAGE.LAST_RESULT]);
      if (data[STORAGE.HISTORY]) setHistory(data[STORAGE.HISTORY]);
      if (data[STORAGE.SETTINGS]) setSettings((s) => ({ ...s, ...data[STORAGE.SETTINGS] }));
      if (data.pagixo_is_first_run === true) setShowOnboarding(true);
    });

    // Check if a scan is already in progress (e.g., panel reopened mid-scan)
    chrome.storage.session.get('pagixo_scan_progress', (data) => {
      const progress = data.pagixo_scan_progress;
      if (progress && progress.active) {
        setIsScanning(true);
        setScanFilename(progress.filename || null);
        setResult(null);
        setTab('result');
      }
    });
  }, []);

  // ─── Live updates via storage listener ────────────
  useEffect(() => {
    const listener = (changes, areaName) => {
      // Handle scan progress changes (session storage)
      if (changes.pagixo_scan_progress) {
        const progress = changes.pagixo_scan_progress.newValue;
        if (progress && progress.active) {
          // New scan started — clear old result and show loading
          setIsScanning(true);
          setScanFilename(progress.filename || null);
          setResult(null);
          setTab('result');
        } else {
          // Scan completed
          setIsScanning(false);
          setScanFilename(null);
        }
      }

      // Handle result updates (local storage)
      if (changes[STORAGE.LAST_RESULT]?.newValue) {
        setIsScanning(false);
        setScanFilename(null);
        setResult(changes[STORAGE.LAST_RESULT].newValue);
        setTab('result');
      }
      if (changes[STORAGE.HISTORY]?.newValue) {
        setHistory(changes[STORAGE.HISTORY].newValue);
      }
    };
    chrome.storage.onChanged.addListener(listener);
    return () => chrome.storage.onChanged.removeListener(listener);
  }, []);

  // ─── History actions ──────────────────────────────
  const handleSelectHistory = (item) => {
    setResult({ ...item, text: item.full_text, timestamp: item.timestamp });
    setTab('result');
  };

  const handleDeleteHistory = (id) => {
    const updated = history.filter((h) => h.id !== id);
    setHistory(updated);
    chrome.storage.local.set({ [STORAGE.HISTORY]: updated });
  };

  const handleClearHistory = () => {
    setHistory([]);
    chrome.storage.local.set({ [STORAGE.HISTORY]: [] });
  };

  // ─── Settings ─────────────────────────────────────
  const updateSetting = (key, value) => {
    const updated = { ...settings, [key]: value };
    setSettings(updated);
    chrome.storage.local.set({ [STORAGE.SETTINGS]: updated });
  };

  const testConnection = async () => {
    setTestStatus('testing');
    try {
      const ctrl = new AbortController();
      setTimeout(() => ctrl.abort(), 5000);
      const res = await fetch(`${settings.apiUrl}/health`, { signal: ctrl.signal });
      setTestStatus(res.ok ? 'ok' : 'error');
    } catch {
      setTestStatus('error');
    }
    setTimeout(() => setTestStatus(null), 3000);
  };

  const tabs = [
    { id: 'result', label: 'Result' },
    { id: 'history', label: 'History', badge: history.length || null },
    { id: 'settings', label: 'Settings' },
  ];

  const dismissOnboarding = () => {
    setShowOnboarding(false);
    chrome.storage.local.set({ pagixo_is_first_run: false });
  };

  // ─── Render ───────────────────────────────────────
  return (
    <div className="bg-[#0F0D2E] text-[#E0E7FF] min-h-screen flex flex-col" style={{ width: '100%' }}>

      {/* ─── Onboarding Overlay ─────────────────────── */}
      {showOnboarding && (
        <OnboardingWalkthrough
          step={onboardingStep}
          onNext={() => onboardingStep < 2 ? setOnboardingStep(onboardingStep + 1) : dismissOnboarding()}
          onSkip={dismissOnboarding}
        />
      )}

      {/* Header */}
      <header className="px-4 py-3 border-b border-white/[0.06] flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-indigo-600 to-emerald-500 flex items-center justify-center shadow-md shadow-indigo-500/20">
            <span className="text-white font-bold text-xs">P</span>
          </div>
          <h1 className="text-sm font-semibold bg-gradient-to-r from-indigo-300 to-emerald-300 bg-clip-text text-transparent">
            Pagixo OCR Results
          </h1>
        </div>
      </header>

      {/* Tab bar */}
      <nav className="px-4 pt-3 pb-1 flex gap-1.5 flex-shrink-0">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`
              px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 flex items-center gap-1.5
              ${tab === t.id
                ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
                : 'text-indigo-300/40 hover:text-indigo-300/60 hover:bg-white/[0.03] border border-transparent'}
            `}
          >
            {t.label}
            {t.badge ? (
              <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-indigo-500/20 text-indigo-400/60">{t.badge}</span>
            ) : null}
          </button>
        ))}
      </nav>

      <div className="h-px mx-4 bg-gradient-to-r from-transparent via-white/[0.04] to-transparent" />

      {/* Tab Content */}
      <div className="flex-1 px-4 py-3 overflow-y-auto flex flex-col min-h-0">

        {/* TAB 1: Result */}
        {tab === 'result' && (
          isScanning ? (
            <ScanProgress filename={scanFilename} />
          ) : result && result.text ? (
            <ResultViewer result={result} />
          ) : (
            <EmptyState hasError={result?.status === 'error'} errorMsg={result?.error} />
          )
        )}

        {/* TAB 2: History */}
        {tab === 'history' && (
          <HistoryList
            history={history}
            onSelect={handleSelectHistory}
            onDelete={handleDeleteHistory}
            onClearAll={handleClearHistory}
          />
        )}

        {/* TAB 3: Settings */}
        {tab === 'settings' && (
          <SettingsPanel
            settings={settings}
            onUpdate={updateSetting}
            onTestConnection={testConnection}
            testStatus={testStatus}
          />
        )}
      </div>

      {/* Footer */}
      <footer className="px-4 py-2 border-t border-white/[0.04] text-[10px] text-indigo-300/20 text-center flex-shrink-0">
        Pagixo OCR v1.0.0
      </footer>
    </div>
  );
}

/* ─── Empty State ─────────────────────────────────── */
function EmptyState({ hasError, errorMsg }) {
  return (
    <div className="flex-1 flex items-center justify-center p-6 animate-fade">
      <div className="text-center space-y-4 max-w-[260px]">
        {hasError ? (
          <>
            <div className="w-16 h-16 mx-auto rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center">
              <svg className="w-8 h-8 text-red-400/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <p className="text-sm font-medium text-red-400/70">Scan Failed</p>
            <p className="text-[11px] text-red-300/40 leading-relaxed">{errorMsg || 'Unknown error'}</p>
          </>
        ) : (
          <>
            <div className="w-20 h-20 mx-auto rounded-2xl border-2 border-dashed border-white/[0.1] flex items-center justify-center">
              <svg className="w-10 h-10 text-indigo-300/20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <p className="text-sm font-medium text-indigo-300/50">No scan results yet</p>
            <p className="text-[11px] text-indigo-300/30 leading-relaxed">
              Right-click an image → <strong className="text-indigo-300/50">Scan with Pagixo</strong>,
              or drag a file anywhere on the page
            </p>
          </>
        )}
      </div>
    </div>
  );
}

/* ─── Settings Panel ──────────────────────────────── */
function SettingsPanel({ settings, onUpdate, onTestConnection, testStatus }) {
  return (
    <div className="space-y-5 animate-fade">
      {/* API URL */}
      <div>
        <label className="block text-xs font-medium text-indigo-300/50 mb-1.5">API URL</label>
        <input
          type="text"
          value={settings.apiUrl}
          onChange={(e) => onUpdate('apiUrl', e.target.value)}
          className="w-full px-3 py-2.5 rounded-lg bg-white/[0.03] border border-white/[0.08] text-sm text-indigo-100/80 font-mono focus:outline-none focus:border-indigo-500/40 focus:ring-1 focus:ring-indigo-500/20 transition-all"
          placeholder="http://localhost:8000"
        />
      </div>

      {/* Test Connection */}
      <button
        onClick={onTestConnection}
        disabled={testStatus === 'testing'}
        className={`
          w-full py-2.5 rounded-lg text-sm font-medium transition-all duration-200 flex items-center justify-center gap-2
          ${testStatus === 'ok' ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/25' :
            testStatus === 'error' ? 'bg-red-500/15 text-red-400 border border-red-500/25' :
            'bg-white/[0.04] text-indigo-300/60 border border-white/[0.06] hover:bg-white/[0.07] hover:text-indigo-300/90'}
        `}
      >
        {testStatus === 'testing' && <div className="w-3.5 h-3.5 border-2 border-indigo-300/30 border-t-indigo-400 rounded-full animate-spin" />}
        {testStatus === 'ok' && <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7"/></svg>}
        {testStatus === 'error' && <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>}
        {testStatus === 'ok' ? 'Connected!' : testStatus === 'error' ? 'Connection Failed' : testStatus === 'testing' ? 'Testing...' : 'Test Connection'}
      </button>

      <div className="h-px bg-white/[0.04]" />

      {/* Toggles */}
      {[
        { key: 'autoOpenPanel', label: 'Auto-open side panel on scan complete' },
        { key: 'showDropZone', label: 'Show drop zone overlay on all pages' },
      ].map((toggle) => (
        <div key={toggle.key} className="flex items-center justify-between">
          <span className="text-xs text-indigo-300/50 pr-4">{toggle.label}</span>
          <button
            onClick={() => onUpdate(toggle.key, !settings[toggle.key])}
            className={`relative w-10 h-[22px] rounded-full transition-all duration-200 border flex-shrink-0
              ${settings[toggle.key] ? 'bg-emerald-500/30 border-emerald-500/40' : 'bg-white/[0.06] border-white/10'}`}
          >
            <div className={`absolute top-[2px] w-4 h-4 rounded-full transition-all duration-200
              ${settings[toggle.key] ? 'left-[22px] bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.5)]' : 'left-[2px] bg-white/30'}`}
            />
          </button>
        </div>
      ))}

      <div className="h-px bg-white/[0.04]" />

      {/* Info */}
      <div className="text-[10px] text-indigo-300/20 space-y-1">
        <p>Extension version: 1.0.0</p>
        <p>Settings are saved automatically</p>
      </div>
    </div>
  );
}

/* ─── Onboarding Walkthrough ──────────────────────── */
function OnboardingWalkthrough({ step, onNext, onSkip }) {
  const steps = [
    {
      icon: '🖱️',
      title: 'Right-Click to Scan',
      desc: 'Right-click any image on a webpage and select "Scan with Pagixo OCR" to extract text instantly.',
    },
    {
      icon: '📁',
      title: 'Drag & Drop Files',
      desc: 'Drag any image or PDF file onto a webpage. Pagixo will detect it and start scanning automatically.',
    },
    {
      icon: '⌨️',
      title: 'Keyboard Shortcut',
      desc: 'Press Ctrl+Shift+S to draw a selection area on screen. The captured region will be scanned for text.',
    },
  ];

  const current = steps[step];

  return (
    <div className="absolute inset-0 z-50 bg-[#0F0D2E]/95 backdrop-blur-sm flex items-center justify-center p-6 animate-fade">
      <div className="max-w-[280px] text-center space-y-5">
        {/* Step indicator */}
        <div className="flex justify-center gap-2">
          {steps.map((_, i) => (
            <div key={i} className={`h-1 rounded-full transition-all duration-300 ${
              i === step ? 'w-8 bg-gradient-to-r from-indigo-500 to-emerald-500' :
              i < step ? 'w-4 bg-indigo-500/40' : 'w-4 bg-white/[0.08]'
            }`} />
          ))}
        </div>

        {/* Icon */}
        <div className="text-4xl">{current.icon}</div>

        {/* Content */}
        <div>
          <h3 className="text-base font-semibold text-indigo-200 mb-2">{current.title}</h3>
          <p className="text-[12px] text-indigo-300/50 leading-relaxed">{current.desc}</p>
        </div>

        {/* Actions */}
        <div className="flex gap-2 justify-center pt-2">
          <button onClick={onSkip} className="px-4 py-2 rounded-lg text-xs text-indigo-300/40 hover:text-indigo-300/60 transition-colors">
            Skip
          </button>
          <button onClick={onNext} className="px-5 py-2 rounded-lg text-xs font-medium bg-gradient-to-r from-indigo-600 to-indigo-500 text-white hover:from-indigo-500 hover:to-indigo-400 transition-all shadow-lg shadow-indigo-500/20 active:scale-[0.97]">
            {step < 2 ? 'Next' : 'Get Started'}
          </button>
        </div>

        {/* Step count */}
        <p className="text-[10px] text-indigo-300/20">{step + 1} of {steps.length}</p>
      </div>
    </div>
  );
}

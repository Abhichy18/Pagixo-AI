/**
 * ScanProgress — Premium Animated Loading Component
 *
 * Shows a visually stunning loading experience while the OCR
 * pipeline processes a captured screenshot or uploaded file.
 * Features: orbital animation, shimmer progress bar, step indicators,
 * and dynamic status messages.
 */

import React, { useState, useEffect, useRef } from 'react';

// ─── Processing Steps ────────────────────────────────────────
const STEPS = [
  { id: 'capture', label: 'Image Captured', icon: '📸', duration: 800 },
  { id: 'upload', label: 'Uploading to API', icon: '☁️', duration: 1500 },
  { id: 'process', label: 'OCR Processing', icon: '🧠', duration: 4000 },
  { id: 'extract', label: 'Extracting Text', icon: '✨', duration: 2000 },
];

const STATUS_MESSAGES = [
  'Analyzing image structure…',
  'Detecting text regions…',
  'Running neural OCR engine…',
  'Recognizing characters…',
  'Parsing mathematical notation…',
  'Building text output…',
  'Almost there…',
];

export default function ScanProgress({ filename }) {
  const [currentStep, setCurrentStep] = useState(0);
  const [progress, setProgress] = useState(0);
  const [statusIdx, setStatusIdx] = useState(0);
  const [elapsedMs, setElapsedMs] = useState(0);
  const startTime = useRef(Date.now());

  // ─── Step progression ──────────────────────────────
  useEffect(() => {
    const timers = [];
    let totalDelay = 0;

    STEPS.forEach((step, i) => {
      if (i === 0) return; // Start at step 0
      totalDelay += step.duration;
      timers.push(setTimeout(() => setCurrentStep(i), totalDelay));
    });

    return () => timers.forEach(clearTimeout);
  }, []);

  // ─── Smooth progress bar ───────────────────────────
  useEffect(() => {
    const interval = setInterval(() => {
      setProgress((p) => {
        // Ease towards 92% (never reaches 100 until result arrives)
        const target = 92;
        const speed = p < 30 ? 1.2 : p < 60 ? 0.6 : p < 80 ? 0.3 : 0.08;
        const next = p + speed;
        return next >= target ? target : next;
      });
    }, 80);

    return () => clearInterval(interval);
  }, []);

  // ─── Rotating status messages ──────────────────────
  useEffect(() => {
    const interval = setInterval(() => {
      setStatusIdx((i) => (i + 1) % STATUS_MESSAGES.length);
    }, 2800);

    return () => clearInterval(interval);
  }, []);

  // ─── Elapsed time counter ──────────────────────────
  useEffect(() => {
    const interval = setInterval(() => {
      setElapsedMs(Date.now() - startTime.current);
    }, 100);

    return () => clearInterval(interval);
  }, []);

  const elapsed = (elapsedMs / 1000).toFixed(1);

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-5 animate-fade select-none">

      {/* ─── Orbital Scanner Animation ──────────────── */}
      <div className="relative w-28 h-28 mb-6">
        {/* Outer glow */}
        <div className="absolute inset-0 rounded-full bg-gradient-to-br from-indigo-500/20 to-emerald-500/20 blur-xl animate-pulse" />

        {/* Orbital ring 1 */}
        <div
          className="absolute inset-0 rounded-full border border-indigo-500/30"
          style={{
            animation: 'pagixoOrbit1 3s linear infinite',
          }}
        >
          <div
            className="absolute w-2.5 h-2.5 rounded-full bg-indigo-400 shadow-lg shadow-indigo-400/50"
            style={{ top: '-5px', left: '50%', marginLeft: '-5px' }}
          />
        </div>

        {/* Orbital ring 2 */}
        <div
          className="absolute inset-2 rounded-full border border-emerald-500/20"
          style={{
            animation: 'pagixoOrbit2 4s linear infinite reverse',
          }}
        >
          <div
            className="absolute w-2 h-2 rounded-full bg-emerald-400 shadow-lg shadow-emerald-400/50"
            style={{ bottom: '-4px', left: '50%', marginLeft: '-4px' }}
          />
        </div>

        {/* Center icon */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div
            className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-600/40 to-emerald-600/40 border border-white/10 flex items-center justify-center backdrop-blur-sm"
            style={{ animation: 'pagixoCenterPulse 2s ease-in-out infinite' }}
          >
            <svg className="w-7 h-7 text-white/80" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 13h6m-6 4h4" style={{ animation: 'pagixoTextLine 1.5s ease-in-out infinite' }} />
            </svg>
          </div>
        </div>
      </div>

      {/* ─── Status Title ──────────────────────────── */}
      <h2 className="text-sm font-semibold text-indigo-200 mb-1">
        Scanning in Progress
      </h2>

      {/* ─── Rotating Status Message ───────────────── */}
      <p
        className="text-[11px] text-indigo-300/50 mb-5 h-4 transition-opacity duration-300"
        key={statusIdx}
        style={{ animation: 'pagixoFadeSwitch 2.8s ease-in-out infinite' }}
      >
        {STATUS_MESSAGES[statusIdx]}
      </p>

      {/* ─── Progress Bar ──────────────────────────── */}
      <div className="w-full max-w-[220px] mb-5">
        <div className="h-1.5 rounded-full bg-white/[0.06] overflow-hidden relative">
          {/* Shimmer background */}
          <div
            className="absolute inset-0 rounded-full"
            style={{
              background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.06), transparent)',
              animation: 'pagixoShimmer 2s ease-in-out infinite',
            }}
          />
          {/* Actual progress fill */}
          <div
            className="h-full rounded-full relative overflow-hidden transition-all duration-200 ease-out"
            style={{
              width: `${progress}%`,
              background: 'linear-gradient(90deg, #6366F1, #8B5CF6, #10B981)',
              boxShadow: '0 0 12px rgba(99, 102, 241, 0.4)',
            }}
          >
            {/* Animated shine on fill */}
            <div
              className="absolute inset-0"
              style={{
                background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.3) 50%, transparent 100%)',
                animation: 'pagixoShineSlide 1.5s ease-in-out infinite',
              }}
            />
          </div>
        </div>

        {/* Progress text */}
        <div className="flex justify-between mt-1.5">
          <span className="text-[10px] text-indigo-300/30 font-mono">{Math.round(progress)}%</span>
          <span className="text-[10px] text-indigo-300/30 font-mono">{elapsed}s</span>
        </div>
      </div>

      {/* ─── Step Indicators ───────────────────────── */}
      <div className="w-full max-w-[240px] space-y-2">
        {STEPS.map((step, i) => {
          const isActive = i === currentStep;
          const isDone = i < currentStep;

          return (
            <div
              key={step.id}
              className={`
                flex items-center gap-2.5 px-3 py-1.5 rounded-lg transition-all duration-500
                ${isActive ? 'bg-indigo-500/10 border border-indigo-500/20' :
                  isDone ? 'bg-emerald-500/5 border border-transparent' :
                  'border border-transparent opacity-40'}
              `}
            >
              {/* Step icon/check */}
              <div className={`
                w-5 h-5 rounded-md flex items-center justify-center text-[10px] flex-shrink-0
                transition-all duration-500
                ${isDone ? 'bg-emerald-500/20 text-emerald-400' :
                  isActive ? 'bg-indigo-500/20' : 'bg-white/[0.04]'}
              `}>
                {isDone ? (
                  <svg className="w-3 h-3 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                ) : isActive ? (
                  <div className="w-2 h-2 rounded-full bg-indigo-400" style={{ animation: 'pagixoDotPulse 1s ease-in-out infinite' }} />
                ) : (
                  <span className="text-white/20">{step.icon}</span>
                )}
              </div>

              {/* Step label */}
              <span className={`
                text-[11px] font-medium transition-colors duration-300
                ${isDone ? 'text-emerald-400/70' :
                  isActive ? 'text-indigo-300' : 'text-indigo-300/30'}
              `}>
                {step.label}
              </span>

              {/* Active spinner */}
              {isActive && (
                <div className="ml-auto w-3 h-3 border-[1.5px] border-indigo-400/30 border-t-indigo-400 rounded-full"
                  style={{ animation: 'spin 0.8s linear infinite' }}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* ─── Filename ──────────────────────────────── */}
      {filename && (
        <div className="mt-4 px-3 py-1.5 rounded-lg bg-white/[0.02] border border-white/[0.04] max-w-[240px] w-full">
          <p className="text-[10px] text-indigo-300/30 truncate text-center font-mono">
            📎 {filename}
          </p>
        </div>
      )}

      {/* ─── CSS Keyframes (injected via style tag) ─ */}
      <style>{`
        @keyframes pagixoOrbit1 {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes pagixoOrbit2 {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes pagixoCenterPulse {
          0%, 100% { transform: scale(1); box-shadow: 0 0 20px rgba(99, 102, 241, 0.15); }
          50% { transform: scale(1.05); box-shadow: 0 0 30px rgba(99, 102, 241, 0.3); }
        }
        @keyframes pagixoShimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
        @keyframes pagixoShineSlide {
          0% { transform: translateX(-150%); }
          100% { transform: translateX(250%); }
        }
        @keyframes pagixoFadeSwitch {
          0%, 100% { opacity: 0.5; }
          15%, 85% { opacity: 1; }
        }
        @keyframes pagixoDotPulse {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.5); opacity: 0.6; }
        }
        @keyframes pagixoTextLine {
          0%, 100% { opacity: 0.8; }
          50% { opacity: 0.3; }
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

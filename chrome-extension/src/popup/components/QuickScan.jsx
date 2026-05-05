import React, { useState } from 'react';

/**
 * QuickScan — Two big action buttons for the popup.
 *
 * Props:
 *   apiOnline: boolean
 *   onScanImage: () => void
 *   onCaptureArea: () => void
 */
export default function QuickScan({ apiOnline, onScanImage, onCaptureArea }) {
  const [hovered, setHovered] = useState(null);

  const buttons = [
    {
      id: 'scan',
      label: 'Scan Image',
      sublabel: 'Upload or pick a file',
      onClick: onScanImage,
      gradient: 'from-indigo-600 to-indigo-500',
      hoverGradient: 'from-indigo-500 to-indigo-400',
      glowColor: 'shadow-[0_4px_24px_rgba(79,70,229,0.35)]',
      icon: (
        <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round"
            d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
          <circle cx="12" cy="13" r="3" />
        </svg>
      ),
    },
    {
      id: 'capture',
      label: 'Capture Area',
      sublabel: 'Select a screen region',
      onClick: onCaptureArea,
      gradient: 'from-emerald-600 to-emerald-500',
      hoverGradient: 'from-emerald-500 to-emerald-400',
      glowColor: 'shadow-[0_4px_24px_rgba(16,185,129,0.35)]',
      icon: (
        <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round"
            d="M14.121 14.121L19 19m-7-7l7-7m-7 7l-2.879 2.879M12 12L9.121 9.121m0 5.758a3 3 0 10-4.243 4.243 3 3 0 004.243-4.243zm0-5.758a3 3 0 10-4.243-4.243 3 3 0 004.243 4.243z" />
        </svg>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-2.5">
      {buttons.map((btn) => {
        const isHovered = hovered === btn.id;
        const disabled = !apiOnline;

        return (
          <button
            key={btn.id}
            onClick={btn.onClick}
            disabled={disabled}
            onMouseEnter={() => setHovered(btn.id)}
            onMouseLeave={() => setHovered(null)}
            className={`
              relative w-full rounded-xl px-5 py-4
              bg-gradient-to-r ${isHovered ? btn.hoverGradient : btn.gradient}
              text-white font-semibold text-[15px]
              flex items-center gap-4
              transition-all duration-200 ease-out
              ${isHovered ? btn.glowColor + ' scale-[1.02]' : 'shadow-lg'}
              ${disabled ? 'opacity-40 cursor-not-allowed grayscale' : 'cursor-pointer'}
              active:scale-[0.98]
              border border-white/10
              group
            `}
          >
            {/* Icon container */}
            <div className={`
              w-12 h-12 rounded-lg
              bg-white/[0.12] backdrop-blur-sm
              flex items-center justify-center
              transition-transform duration-200
              ${isHovered && !disabled ? 'scale-110 bg-white/[0.18]' : ''}
            `}>
              {btn.icon}
            </div>

            {/* Text */}
            <div className="text-left">
              <div className="leading-tight">{btn.label}</div>
              <div className="text-[11px] font-normal text-white/50 mt-0.5">
                {btn.sublabel}
              </div>
            </div>

            {/* Arrow indicator */}
            <svg
              className={`
                w-5 h-5 ml-auto text-white/30
                transition-all duration-200
                ${isHovered && !disabled ? 'text-white/60 translate-x-0.5' : ''}
              `}
              fill="none" stroke="currentColor" viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>

            {/* Shimmer effect on hover */}
            {isHovered && !disabled && (
              <div className="absolute inset-0 rounded-xl overflow-hidden pointer-events-none">
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/[0.06] to-transparent -translate-x-full animate-[shimmer_1.5s_ease-in-out_infinite]" />
              </div>
            )}
          </button>
        );
      })}

      {/* Keyboard shortcut hint */}
      <div className="text-center text-[10px] text-indigo-300/30 mt-1">
        <kbd className="px-1.5 py-0.5 rounded bg-white/[0.04] border border-white/[0.06] text-indigo-300/40 font-mono text-[9px]">
          Ctrl+Shift+S
        </kbd>
        {' '}to capture area
      </div>
    </div>
  );
}

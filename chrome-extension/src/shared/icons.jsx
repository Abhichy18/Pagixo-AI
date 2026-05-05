/**
 * Pagixo OCR — Shared SVG Icon Library
 *
 * All icons: 24×24 viewBox, currentColor stroke, 1.5–2px stroke width.
 * Usage in React: <ScanIcon className="w-5 h-5 text-indigo-400" />
 */

import React from 'react';

// ─── Helper ──────────────────────────────────────────────────
const Icon = ({ children, className = '', size = 24, strokeWidth = 1.8, ...props }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={strokeWidth}
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    {...props}
  >
    {children}
  </svg>
);

// ─── Scan / Camera ───────────────────────────────────────────
export const ScanIcon = (props) => (
  <Icon {...props}>
    <path d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
    <circle cx="12" cy="13" r="3" />
  </Icon>
);

// ─── Area Capture / Crosshair ────────────────────────────────
export const CaptureIcon = (props) => (
  <Icon {...props}>
    <path d="M2 7V2h5M17 2h5v5M22 17v5h-5M7 22H2v-5" />
    <circle cx="12" cy="12" r="3" />
    <path d="M12 2v4M12 18v4M2 12h4M18 12h4" strokeWidth={1.2} opacity={0.4} />
  </Icon>
);

// ─── Copy / Clipboard ────────────────────────────────────────
export const CopyIcon = (props) => (
  <Icon {...props}>
    <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
    <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
  </Icon>
);

// ─── Download ────────────────────────────────────────────────
export const DownloadIcon = (props) => (
  <Icon {...props}>
    <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
    <polyline points="7 10 12 15 17 10" />
    <line x1="12" y1="15" x2="12" y2="3" />
  </Icon>
);

// ─── History / Clock ─────────────────────────────────────────
export const HistoryIcon = (props) => (
  <Icon {...props}>
    <circle cx="12" cy="12" r="10" />
    <polyline points="12 6 12 12 16 14" />
  </Icon>
);

// ─── Settings / Gear ─────────────────────────────────────────
export const SettingsIcon = (props) => (
  <Icon {...props} strokeWidth={1.5}>
    <path d="M12.22 2h-.44a2 2 0 00-2 2v.18a2 2 0 01-1 1.73l-.43.25a2 2 0 01-2 0l-.15-.08a2 2 0 00-2.73.73l-.22.38a2 2 0 00.73 2.73l.15.1a2 2 0 011 1.72v.51a2 2 0 01-1 1.74l-.15.09a2 2 0 00-.73 2.73l.22.38a2 2 0 002.73.73l.15-.08a2 2 0 012 0l.43.25a2 2 0 011 1.73V20a2 2 0 002 2h.44a2 2 0 002-2v-.18a2 2 0 011-1.73l.43-.25a2 2 0 012 0l.15.08a2 2 0 002.73-.73l.22-.39a2 2 0 00-.73-2.73l-.15-.08a2 2 0 01-1-1.74v-.5a2 2 0 011-1.74l.15-.09a2 2 0 00.73-2.73l-.22-.38a2 2 0 00-2.73-.73l-.15.08a2 2 0 01-2 0l-.43-.25a2 2 0 01-1-1.73V4a2 2 0 00-2-2z" />
    <circle cx="12" cy="12" r="3" />
  </Icon>
);

// ─── Spinner / Loading ───────────────────────────────────────
export const SpinnerIcon = ({ className = '', ...props }) => (
  <Icon className={`animate-spin ${className}`} {...props}>
    <path d="M21 12a9 9 0 11-6.219-8.56" />
  </Icon>
);

// ─── Check / Success ─────────────────────────────────────────
export const CheckIcon = (props) => (
  <Icon {...props} strokeWidth={2.2}>
    <polyline points="20 6 9 17 4 12" />
  </Icon>
);

// ─── Error / X Circle ────────────────────────────────────────
export const ErrorIcon = (props) => (
  <Icon {...props}>
    <circle cx="12" cy="12" r="10" />
    <line x1="15" y1="9" x2="9" y2="15" />
    <line x1="9" y1="9" x2="15" y2="15" />
  </Icon>
);

// ─── Warning / Alert Triangle ────────────────────────────────
export const WarningIcon = (props) => (
  <Icon {...props}>
    <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
    <line x1="12" y1="9" x2="12" y2="13" />
    <line x1="12" y1="17" x2="12.01" y2="17" />
  </Icon>
);

// ─── Refresh ─────────────────────────────────────────────────
export const RefreshIcon = (props) => (
  <Icon {...props}>
    <polyline points="23 4 23 10 17 10" />
    <polyline points="1 20 1 14 7 14" />
    <path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15" />
  </Icon>
);

// ─── Trash / Delete ──────────────────────────────────────────
export const TrashIcon = (props) => (
  <Icon {...props}>
    <polyline points="3 6 5 6 21 6" />
    <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
    <line x1="10" y1="11" x2="10" y2="17" />
    <line x1="14" y1="11" x2="14" y2="17" />
  </Icon>
);

// ─── Upload / File Plus ──────────────────────────────────────
export const UploadIcon = (props) => (
  <Icon {...props}>
    <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
    <polyline points="14 2 14 8 20 8" />
    <line x1="12" y1="18" x2="12" y2="12" />
    <polyline points="9 15 12 12 15 15" />
  </Icon>
);

// ─── Image ───────────────────────────────────────────────────
export const ImageIcon = (props) => (
  <Icon {...props}>
    <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
    <circle cx="8.5" cy="8.5" r="1.5" />
    <polyline points="21 15 16 10 5 21" />
  </Icon>
);

// ─── External Link ───────────────────────────────────────────
export const ExternalLinkIcon = (props) => (
  <Icon {...props}>
    <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6" />
    <polyline points="15 3 21 3 21 9" />
    <line x1="10" y1="14" x2="21" y2="3" />
  </Icon>
);

// ─── Close / X ───────────────────────────────────────────────
export const CloseIcon = (props) => (
  <Icon {...props} strokeWidth={2}>
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </Icon>
);

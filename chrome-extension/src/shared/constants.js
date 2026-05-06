/**
 * Shared constants for the Pagixo OCR Chrome Extension.
 * Used by popup, sidepanel, background, and content scripts.
 */

// API base URL — configured via environment variable or fallback
// Note: esbuild replaces import.meta.env.VITE_API_BASE_URL at build time
export const API_BASE_URL = import.meta.env?.VITE_API_BASE_URL || 'http://localhost:8000';

// File size limits
export const MAX_FILE_SIZE_MB = 20;
export const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

// Supported file types for OCR
export const SUPPORTED_TYPES = [
  'image/png',
  'image/jpeg',
  'image/webp',
  'application/pdf',
];

// Supported file extensions (for quick validation)
export const SUPPORTED_EXTENSIONS = ['png', 'jpg', 'jpeg', 'webp', 'pdf'];

// Chrome storage keys — namespaced to avoid conflicts
export const STORAGE_KEYS = {
  HISTORY: 'pagixo_history',
  SETTINGS: 'pagixo_settings',
  LAST_RESULT: 'pagixo_last_result',
  API_STATUS: 'pagixo_api_status',
  IS_FIRST_RUN: 'pagixo_first_run',
  SCAN_IN_PROGRESS: 'pagixo_scan_progress',
};

// API endpoints
export const ENDPOINTS = {
  HEALTH: '/health',
  OCR: '/api/ocr',
  HISTORY: '/api/history',
  CHAT: '/api/chat',
};

// Extension branding
export const BRAND = {
  NAME: 'Pagixo OCR',
  TAGLINE: 'Scan any image or PDF instantly',
  VERSION: '1.0.0',
  COLORS: {
    PRIMARY: '#4F46E5',
    PRIMARY_LIGHT: '#6366F1',
    ACCENT: '#10B981',
    ACCENT_LIGHT: '#34D399',
    ERROR: '#EF4444',
    WARNING: '#F59E0B',
  },
};

// Retry configuration for API calls
export const RETRY_CONFIG = {
  MAX_RETRIES: 3,
  BACKOFF_MS: [500, 1000, 2000],
};

// Health check interval (ms)
export const HEALTH_CHECK_INTERVAL_MS = 60_000;

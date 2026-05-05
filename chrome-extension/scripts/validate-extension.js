/**
 * Pagixo Extension Validator
 *
 * Pre-flight checks before loading the extension in Chrome.
 * Verifies manifest, dist files, CSP compliance, and icons.
 *
 * Usage: node scripts/validate-extension.js
 */

import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const DIST = resolve(ROOT, 'dist');

// ─── Colors ──────────────────────────────────────────────────
const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const CYAN = '\x1b[36m';
const DIM = '\x1b[2m';
const RESET = '\x1b[0m';
const BOLD = '\x1b[1m';

let passed = 0;
let failed = 0;

function pass(msg) {
  console.log(`  ${GREEN}✓ PASS${RESET}  ${msg}`);
  passed++;
}

function fail(msg, detail) {
  console.log(`  ${RED}✗ FAIL${RESET}  ${msg}`);
  if (detail) console.log(`         ${DIM}${detail}${RESET}`);
  failed++;
}

function warn(msg) {
  console.log(`  ${YELLOW}⚠ WARN${RESET}  ${msg}`);
}

function header(msg) {
  console.log(`\n${CYAN}${BOLD}── ${msg} ──${RESET}`);
}

// ─── Check 1: Manifest JSON ─────────────────────────────────
header('Manifest Validation');

const manifestPath = resolve(ROOT, 'manifest.json');
let manifest = null;

if (!existsSync(manifestPath)) {
  fail('manifest.json not found');
} else {
  try {
    const raw = readFileSync(manifestPath, 'utf-8');
    manifest = JSON.parse(raw);
    pass('manifest.json is valid JSON');
  } catch (e) {
    fail('manifest.json is not valid JSON', e.message);
  }
}

if (manifest) {
  // Required fields
  const requiredFields = [
    'manifest_version', 'name', 'version', 'permissions',
    'background', 'action', 'content_scripts', 'icons',
  ];

  for (const field of requiredFields) {
    if (manifest[field] !== undefined) {
      pass(`manifest.${field} exists`);
    } else {
      fail(`manifest.${field} is missing`);
    }
  }

  // Manifest V3
  if (manifest.manifest_version === 3) {
    pass('Using Manifest V3');
  } else {
    fail(`Expected manifest_version 3, got ${manifest.manifest_version}`);
  }

  // CSP
  if (manifest.content_security_policy?.extension_pages) {
    pass('Content Security Policy defined');
  } else {
    warn('No content_security_policy — recommended for production');
  }
}

// ─── Check 2: Dist Files Exist ──────────────────────────────
header('Dist Files');

const expectedFiles = [
  'background.js',
  'content.js',
  'popup/index.html',
  'popup/index.js',
  'sidepanel/index.html',
  'sidepanel/index.js',
];

if (!existsSync(DIST)) {
  fail('dist/ directory not found — run "npm run build" first');
} else {
  for (const file of expectedFiles) {
    const filePath = resolve(DIST, file);
    if (existsSync(filePath)) {
      const size = readFileSync(filePath).length;
      pass(`dist/${file} ${DIM}(${(size / 1024).toFixed(1)} KB)${RESET}`);
    } else {
      fail(`dist/${file} missing`);
    }
  }
}

// ─── Check 3: No eval() in background.js (CSP) ──────────────
header('CSP Compliance');

const bgPath = resolve(DIST, 'background.js');
if (existsSync(bgPath)) {
  const bgContent = readFileSync(bgPath, 'utf-8');

  // Check for eval()
  const evalMatch = bgContent.match(/\beval\s*\(/g);
  if (evalMatch) {
    fail(`background.js contains eval() (${evalMatch.length} occurrence(s))`, 'eval() violates CSP and will crash in MV3');
  } else {
    pass('background.js has no eval() calls');
  }

  // Check for new Function()
  const funcMatch = bgContent.match(/new\s+Function\s*\(/g);
  if (funcMatch) {
    fail(`background.js uses new Function() (${funcMatch.length} occurrence(s))`);
  } else {
    pass('background.js has no new Function() calls');
  }
} else {
  warn('background.js not found — skipping CSP checks');
}

// Also check content.js
const contentPath = resolve(DIST, 'content.js');
if (existsSync(contentPath)) {
  const contentSrc = readFileSync(contentPath, 'utf-8');
  const evalInContent = contentSrc.match(/\beval\s*\(/g);
  if (evalInContent) {
    fail(`content.js contains eval() (${evalInContent.length} occurrence(s))`);
  } else {
    pass('content.js has no eval() calls');
  }
}

// ─── Check 4: Icons ─────────────────────────────────────────
header('Icons');

const iconSizes = [16, 48, 128];
const assetsDir = resolve(ROOT, 'assets');

for (const size of iconSizes) {
  const iconPath = resolve(assetsDir, `icon${size}.png`);
  if (existsSync(iconPath)) {
    const fileSize = readFileSync(iconPath).length;
    if (fileSize > 50) {
      pass(`icon${size}.png ${DIM}(${fileSize} bytes)${RESET}`);
    } else {
      fail(`icon${size}.png exists but looks empty (${fileSize} bytes)`);
    }
  } else {
    fail(`icon${size}.png missing from assets/`);
  }
}

// ─── Summary ─────────────────────────────────────────────────
console.log(`\n${'─'.repeat(45)}`);
if (failed === 0) {
  console.log(`${GREEN}${BOLD}  ✅ ALL ${passed} CHECKS PASSED${RESET}`);
  console.log(`${DIM}  Extension is ready to load in Chrome${RESET}\n`);
  process.exit(0);
} else {
  console.log(`${RED}${BOLD}  ❌ ${failed} FAILED${RESET} / ${GREEN}${passed} passed${RESET}`);
  console.log(`${DIM}  Fix the failures above before loading${RESET}\n`);
  process.exit(1);
}

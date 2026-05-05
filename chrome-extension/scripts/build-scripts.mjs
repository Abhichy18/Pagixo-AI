/**
 * Build script for background service worker and content scripts.
 *
 * These need IIFE format (not ES modules) because:
 * - Content scripts can't use ES module imports in Chrome Extensions
 * - Service workers work better as self-contained IIFE bundles
 *
 * Uses esbuild (bundled with Vite) for fast, reliable bundling.
 */

import { build } from 'esbuild';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');

async function buildScripts() {
  console.log('📦 Building background + content scripts (IIFE)...\n');

  // Build background service worker
  await build({
    entryPoints: [resolve(root, 'src/background/index.js')],
    bundle: true,
    outfile: resolve(root, 'dist/background.js'),
    format: 'iife',
    minify: process.env.NODE_ENV === 'production',
    sourcemap: process.env.NODE_ENV !== 'production',
    target: 'chrome120',
    define: {
      'import.meta.env.VITE_API_BASE_URL': JSON.stringify(
        process.env.VITE_API_BASE_URL || 'http://localhost:8000'
      ),
    },
  });
  console.log('  ✅ dist/background.js');

  // Build content script
  await build({
    entryPoints: [resolve(root, 'src/content/index.js')],
    bundle: true,
    outfile: resolve(root, 'dist/content.js'),
    format: 'iife',
    minify: process.env.NODE_ENV === 'production',
    sourcemap: process.env.NODE_ENV !== 'production',
    target: 'chrome120',
    define: {
      'import.meta.env.VITE_API_BASE_URL': JSON.stringify(
        process.env.VITE_API_BASE_URL || 'http://localhost:8000'
      ),
    },
  });
  console.log('  ✅ dist/content.js');

  console.log('\n🎉 All scripts built successfully!');
}

buildScripts().catch((err) => {
  console.error('❌ Script build failed:', err);
  process.exit(1);
});

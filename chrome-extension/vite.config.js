/**
 * Vite config for building the Pagixo OCR Chrome Extension.
 *
 * Builds the React-based popup and sidepanel as multi-page HTML entries.
 * Background and content scripts are built separately via scripts/build-scripts.mjs
 * (they need IIFE format which requires a separate build pass).
 */

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';
import { copyFileSync, mkdirSync, existsSync, readdirSync } from 'fs';

/**
 * Plugin: copies manifest.json and icon assets into dist/ after build,
 * so the extension can be loaded directly from the chrome-extension/ folder.
 */
function copyExtensionFiles() {
  return {
    name: 'copy-extension-files',
    closeBundle() {
      // Ensure dist/assets exists
      const distAssets = resolve(__dirname, 'dist/assets');
      if (!existsSync(distAssets)) {
        mkdirSync(distAssets, { recursive: true });
      }

      // Copy icon assets
      const assetsDir = resolve(__dirname, 'assets');
      if (existsSync(assetsDir)) {
        readdirSync(assetsDir).forEach((file) => {
          if (file.endsWith('.png') || file.endsWith('.svg')) {
            copyFileSync(
              resolve(assetsDir, file),
              resolve(distAssets, file)
            );
          }
        });
      }
    },
  };
}

export default defineConfig({
  plugins: [react(), copyExtensionFiles()],

  // Chrome extensions need relative paths (not root-absolute)
  base: './',

  // Set root to src/ so HTML output paths don't include 'src/' prefix
  root: resolve(__dirname, 'src'),

  build: {
    outDir: resolve(__dirname, 'dist'),
    emptyOutDir: true,
    sourcemap: process.env.NODE_ENV !== 'production',

    rollupOptions: {
      input: {
        'popup/index': resolve(__dirname, 'src/popup/index.html'),
        'sidepanel/index': resolve(__dirname, 'src/sidepanel/index.html'),
      },
      output: {
        entryFileNames: '[name].js',
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash].[ext]',
      },
    },
  },

  // Resolve aliases for cleaner imports
  resolve: {
    alias: {
      '@shared': resolve(__dirname, 'src/shared'),
      '@styles': resolve(__dirname, 'src/styles'),
    },
  },
});

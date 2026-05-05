/**
 * Pagixo Icon Generator — Creates extension icons programmatically.
 *
 * Usage: node scripts/generate-icons.js
 * Requires: npm install canvas (added to devDependencies)
 *
 * Generates: assets/icon16.png, assets/icon48.png, assets/icon128.png
 */

import { createCanvas } from 'canvas';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ASSETS_DIR = resolve(__dirname, '..', 'assets');

const SIZES = [16, 48, 128];

function generateIcon(size) {
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext('2d');
  const radius = size * 0.2; // Corner radius

  // ─── Background: Rounded indigo square ──────────
  ctx.beginPath();
  roundedRect(ctx, 0, 0, size, size, radius);
  const bgGrad = ctx.createLinearGradient(0, 0, size, size);
  bgGrad.addColorStop(0, '#4F46E5');
  bgGrad.addColorStop(1, '#3730A3');
  ctx.fillStyle = bgGrad;
  ctx.fill();

  // Subtle inner glow
  const glowGrad = ctx.createRadialGradient(
    size * 0.3, size * 0.3, 0,
    size * 0.5, size * 0.5, size * 0.7
  );
  glowGrad.addColorStop(0, 'rgba(129, 140, 248, 0.25)');
  glowGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = glowGrad;
  ctx.fill();

  // ─── Letter "P" ─────────────────────────────────
  ctx.fillStyle = '#FFFFFF';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  // Scale font based on icon size
  const fontSize = Math.round(size * 0.55);
  ctx.font = `bold ${fontSize}px "Segoe UI", Arial, sans-serif`;

  // Slight offset up for visual centering
  ctx.fillText('P', size * 0.48, size * 0.48);

  // ─── Green online dot (bottom-right) ────────────
  const dotRadius = size * 0.12;
  const dotX = size * 0.78;
  const dotY = size * 0.78;

  // White border ring
  ctx.beginPath();
  ctx.arc(dotX, dotY, dotRadius + size * 0.03, 0, Math.PI * 2);
  ctx.fillStyle = '#3730A3';
  ctx.fill();

  // Green dot
  ctx.beginPath();
  ctx.arc(dotX, dotY, dotRadius, 0, Math.PI * 2);
  const dotGrad = ctx.createRadialGradient(
    dotX - dotRadius * 0.3, dotY - dotRadius * 0.3, 0,
    dotX, dotY, dotRadius
  );
  dotGrad.addColorStop(0, '#34D399');
  dotGrad.addColorStop(1, '#10B981');
  ctx.fillStyle = dotGrad;
  ctx.fill();

  return canvas.toBuffer('image/png');
}

function roundedRect(ctx, x, y, w, h, r) {
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

// ─── Main ────────────────────────────────────────────────────
if (!existsSync(ASSETS_DIR)) {
  mkdirSync(ASSETS_DIR, { recursive: true });
}

console.log('🎨 Generating Pagixo extension icons...\n');

for (const size of SIZES) {
  const buffer = generateIcon(size);
  const path = resolve(ASSETS_DIR, `icon${size}.png`);
  writeFileSync(path, buffer);
  console.log(`  ✅ icon${size}.png  (${buffer.length} bytes)`);
}

console.log('\n🎉 All icons generated in assets/');

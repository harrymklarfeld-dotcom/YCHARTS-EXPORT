#!/usr/bin/env node
/**
 * Composes captioned store screenshots from the raw captures in tenbagger/docs/screenshots.
 * Plan and captions: ../screenshots.md. Raw captures are 780x1688 (390x844 @2x).
 *
 *   mkdir -p /tmp/icongen && (cd /tmp/icongen && npm i @resvg/resvg-js pngjs)
 *   ICONGEN_MODULES=/tmp/icongen node store/screenshots/compose.mjs [outDir]
 *
 * Writes <outDir>/{ios-6.9,ios-6.5,android-phone}/NN-name.png (default outDir: store/screenshots/out).
 * These are DRAFTS: before submission, recapture the raw screens from a production build on the
 * iPhone 17 Pro Max simulator (1320x2868) so the status bar and fonts are native, then re-run.
 */
import { createRequire } from 'node:module';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const raw = resolve(here, '../../../docs/screenshots');
const outDir = resolve(process.argv[2] ?? join(here, 'out'));
const req = createRequire(join(process.env.ICONGEN_MODULES ?? here, 'noop.js'));
const { Resvg } = req('@resvg/resvg-js');

export const SHOTS = [
  { file: 'real-03-question.png', title: 'Learn from real', title2: 'company numbers', sub: 'Every question comes from an actual SEC filing' },
  { file: '04-feedback-correct.png', title: 'Every answer', title2: 'shows its source', sub: 'See exactly which 10-K a number came from' },
  { file: 'real-01-learn.png', title: '3 minutes a day', title2: 'builds the habit', sub: 'A clear path from margins to valuation' },
  { file: 'real-04-screener.png', title: 'Screen companies', title2: 'in plain English', sub: 'Tap any metric for a simple explainer' },
  { file: 'real-05-company-mu.png', title: 'Every key number', title2: 'explained simply', sub: 'Tap any metric to see what it means' },
  { file: '13-lesson-complete.png', title: 'Streaks come from', title2: 'learning, not trading', sub: 'Education only. Never stock tips.' },
];

// [label, width, height]. Google Play: longest side at most 2x the shortest, so use 9:16.
const SIZES = [
  ['ios-6.9', 1320, 2868],
  ['ios-6.5', 1284, 2778],
  ['android-phone', 1080, 1920],
];

const NAVY = '#14213D';
const PAPER = '#F5F2EA';
const BRASS = '#F2B544';
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');

function compose(shot, W, H) {
  const png = readFileSync(join(raw, shot.file)).toString('base64');
  const headH = Math.round(H * 0.24);
  const fs = Math.round(W * 0.078);
  const sub = Math.round(W * 0.036);
  // Phone "card": fit the 780x1688 capture into the remaining space with margins.
  const availH = H - headH - Math.round(H * 0.04);
  const availW = W * 0.8;
  const scale = Math.min(availW / 780, availH / 1688);
  const w = 780 * scale;
  const h = 1688 * scale;
  const x = (W - w) / 2;
  const y = headH;
  const r = Math.round(w * 0.07);
  return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${W}" height="${H}">
  <rect width="${W}" height="${H}" fill="${NAVY}"/>
  <text x="${W / 2}" y="${headH * 0.36}" text-anchor="middle" font-family="Georgia, 'DejaVu Serif', serif" font-weight="700" font-size="${fs}" fill="${PAPER}">${esc(shot.title)}</text>
  <text x="${W / 2}" y="${headH * 0.36 + fs * 1.15}" text-anchor="middle" font-family="Georgia, 'DejaVu Serif', serif" font-weight="700" font-size="${fs}" fill="${BRASS}">${esc(shot.title2)}</text>
  <text x="${W / 2}" y="${headH * 0.36 + fs * 1.15 + sub * 1.9}" text-anchor="middle" font-family="Helvetica, Arial, 'DejaVu Sans', sans-serif" font-size="${sub}" fill="#C9D1E0">${esc(shot.sub)}</text>
  <defs><clipPath id="c"><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}"/></clipPath></defs>
  <rect x="${x - 10}" y="${y - 10}" width="${w + 20}" height="${h + 20}" rx="${r + 10}" fill="#0B1222"/>
  <image x="${x}" y="${y}" width="${w}" height="${h}" clip-path="url(#c)" preserveAspectRatio="xMidYMid slice" xlink:href="data:image/png;base64,${png}"/>
</svg>`;
}

for (const [label, W, H] of SIZES) {
  const dir = join(outDir, label);
  mkdirSync(dir, { recursive: true });
  SHOTS.forEach((shot, i) => {
    const img = new Resvg(compose(shot, W, H), { fitTo: { mode: 'width', value: W }, background: NAVY }).render();
    const name = `${String(i + 1).padStart(2, '0')}-${shot.file.replace(/^(real-)?\d+b?-/, '')}`;
    writeFileSync(join(dir, name), img.asPng());
    console.log(`${label}/${name} ${img.width}x${img.height}`);
  });
}

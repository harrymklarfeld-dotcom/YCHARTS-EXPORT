#!/usr/bin/env node
/**
 * Renders every app icon / splash PNG in ../../assets from the SVG mark defined below.
 *
 * The mark: three ascending bars over a brass double rule — the accountant's
 * "this is the total" underline. It says "read the numbers", not "10x returns",
 * so it survives the planned rename (see docs/PRODUCT_STRATEGY.md §3).
 *
 * Usage (renderer is NOT an app dependency, so install it somewhere throwaway):
 *   mkdir -p /tmp/icongen && (cd /tmp/icongen && npm i @resvg/resvg-js pngjs)
 *   ICONGEN_MODULES=/tmp/icongen node store/brand/generate-icons.mjs
 *
 * Outputs (all paths relative to tenbagger/mobile):
 *   assets/icon.png                     1024x1024 RGB, no alpha, full-bleed (App Store + iOS)
 *   assets/android-icon-foreground.png  1024x1024 RGBA, mark inside the 66% safe circle
 *   assets/android-icon-background.png  1024x1024 RGB solid navy
 *   assets/android-icon-monochrome.png  1024x1024 RGBA, white silhouette (Android 13+ themed icons)
 *   assets/splash-icon.png              1024x1024 RGBA, transparent, shown centred on #F5F2EA
 *   assets/favicon.png                  48x48 RGBA (web)
 *   store/brand/play-feature-graphic.png 1024x500 RGB (Google Play feature graphic)
 *   store/brand/play-icon-512.png       512x512 RGB (Google Play hi-res icon, 32-bit PNG accepted)
 */
import { createRequire } from 'node:module';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const mobile = resolve(here, '../..');
const req = createRequire(join(process.env.ICONGEN_MODULES ?? here, 'noop.js'));
let Resvg, PNG;
try {
  ({ Resvg } = req('@resvg/resvg-js'));
  ({ PNG } = req('pngjs'));
} catch {
  console.error('Missing @resvg/resvg-js / pngjs. See the usage comment at the top of this file.');
  process.exit(1);
}

// Brand palette (mirrors src/theme/tokens.ts "Ledger").
const NAVY = '#14213D';
const PAPER = '#F5F2EA';
const GREEN = '#2BC48A';
const GREEN_DEEP = '#0B7A57';
const BRASS = '#F2B544';
const BRASS_DEEP = '#A8690F';

/** The mark on a 460x496 local grid (origin top-left). */
function mark({ bar = PAPER, top = GREEN, rule = BRASS } = {}) {
  return `
    <rect x="0"   y="220" width="120" height="170" rx="18" fill="${bar}"/>
    <rect x="170" y="120" width="120" height="270" rx="18" fill="${bar}"/>
    <rect x="340" y="0"   width="120" height="390" rx="18" fill="${top}"/>
    <rect x="0" y="430" width="460" height="24" rx="12" fill="${rule}"/>
    <rect x="0" y="472" width="460" height="24" rx="12" fill="${rule}"/>`;
}
const MARK_W = 460;
const MARK_H = 496;

function placed(size, scale, colors) {
  const w = MARK_W * scale;
  const h = MARK_H * scale;
  const tx = (size - w) / 2;
  const ty = (size - h) / 2;
  return `<g transform="translate(${tx} ${ty}) scale(${scale})">${mark(colors)}</g>`;
}

function svg(w, h, body, bg) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
    ${bg ? `<rect width="${w}" height="${h}" fill="${bg}"/>` : ''}${body}</svg>`;
}

function render(svgText, width) {
  const png = new Resvg(svgText, { fitTo: { mode: 'width', value: width }, background: 'rgba(0,0,0,0)' }).render();
  return { width: png.width, height: png.height, rgba: png.pixels };
}

function write(rel, { width, height, rgba }, { alpha }) {
  const out = new PNG({ width, height, colorType: alpha ? 6 : 2, inputColorType: 6, inputHasAlpha: true });
  out.data = Buffer.from(rgba);
  const file = join(mobile, rel);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, PNG.sync.write(out, { colorType: alpha ? 6 : 2, inputColorType: 6, inputHasAlpha: true }));
  console.log(`wrote ${rel} ${width}x${height} ${alpha ? 'RGBA' : 'RGB (no alpha)'}`);
}

// iOS / store icon: full-bleed, opaque. iOS applies the corner mask itself.
write('assets/icon.png', render(svg(1024, 1024, placed(1024, 1.12), NAVY), 1024), { alpha: false });

// Android adaptive: 108dp canvas, launcher masks to ~72dp; keep the mark inside the 66dp safe circle.
// Safe circle on a 1024 canvas ≈ 626px diameter; mark diagonal at 0.85 ≈ 575px.
write('assets/android-icon-foreground.png', render(svg(1024, 1024, placed(1024, 0.85)), 1024), { alpha: true });
write('assets/android-icon-background.png', render(svg(1024, 1024, '', NAVY), 1024), { alpha: false });
write(
  'assets/android-icon-monochrome.png',
  render(svg(1024, 1024, placed(1024, 0.85, { bar: '#FFFFFF', top: '#FFFFFF', rule: '#FFFFFF' })), 1024),
  { alpha: true },
);

// Splash: transparent image drawn centred on the paper splash background. The legacy `splash`
// key scales this image to fit the screen (resizeMode contain), so the mark is drawn small
// with generous transparent padding.
write(
  'assets/splash-icon.png',
  render(svg(1024, 1024, placed(1024, 0.6, { bar: NAVY, top: GREEN_DEEP, rule: BRASS_DEEP })), 1024),
  { alpha: true },
);
write('assets/favicon.png', render(svg(1024, 1024, placed(1024, 1.35), NAVY), 48), { alpha: true });

// Google Play store graphics.
write('store/brand/play-icon-512.png', render(svg(1024, 1024, placed(1024, 1.12), NAVY), 512), { alpha: false });
const feature = svg(
  1024,
  500,
  `<g transform="translate(80 125) scale(0.5)">${mark()}</g>
   <text x="365" y="240" font-family="Georgia, 'DejaVu Serif', serif" font-size="56" font-weight="700" fill="${PAPER}">Read the numbers.</text>
   <text x="365" y="300" font-family="Helvetica, Arial, 'DejaVu Sans', sans-serif" font-size="28" fill="#C9D1E0">3-minute lessons from real SEC filings</text>`,
  NAVY,
);
write('store/brand/play-feature-graphic.png', render(feature, 1024), { alpha: false });

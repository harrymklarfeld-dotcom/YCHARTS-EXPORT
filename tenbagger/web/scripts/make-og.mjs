// Renders public/og.png (1200x630 social card) from site.config.ts. Re-run after rebranding:
//   node --experimental-strip-types scripts/make-og.mjs     (Node 22+) — needs Playwright + Chromium.
import { createRequire } from 'node:module';
import { execSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import site from '../site.config.ts';

const require = createRequire(import.meta.url);
let pw;
try { pw = require('playwright'); } catch { pw = require(path.join(execSync('npm root -g').toString().trim(), 'playwright')); }
const out = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'public', 'og.png');
const c = site.colors.light;
const f = site.fonts;
const esc = (s) => s.replace(/[&<>]/g, (x) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[x]);
const html = `<!doctype html><html><head>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=${f.display.family.replace(/ /g, '+')}:wght@600&family=${f.mono.family.replace(/ /g, '+')}:wght@500&display=swap">
<style>
body{margin:0;width:1200px;height:630px;background:${c.bg};color:${c.ink};font-family:'${f.display.family}',${f.display.fallback};
background-image:linear-gradient(to right,${c.rule} 1px,transparent 1px);background-size:100px 100%;}
.w{position:absolute;inset:0;padding:72px 80px;display:flex;flex-direction:column;justify-content:space-between;background:linear-gradient(180deg,transparent,${c.bg} 70%)}
.k{font-family:'${f.mono.family}',monospace;font-size:22px;letter-spacing:.14em;text-transform:uppercase;color:${c.accent}}
h1{font-size:74px;line-height:1.05;margin:18px 0 0;letter-spacing:-.02em;max-width:980px}
.b{display:flex;align-items:center;gap:18px;font-size:40px;font-weight:600}
.m{width:64px;height:64px;background:${c.ink};color:${c.bg};border-radius:8px;display:grid;place-items:center;font-family:'${f.mono.family}',monospace;font-size:26px;position:relative}
.m:after{content:'';position:absolute;right:-6px;bottom:-6px;width:18px;height:18px;border-radius:4px;background:${c.signal}}
.t{font-family:'${f.mono.family}',monospace;font-size:22px;color:${c.muted};margin-left:auto}
</style></head><body><div class="w"><div><div class="k">Built from SEC filings · never stock tips</div><h1>${esc(site.heroLine)}</h1></div>
<div class="b"><span class="m">${esc(site.logoMark)}</span>${esc(site.name)}<span class="t">${esc(site.url.replace(/^https?:\/\//, ''))}</span></div></div></body></html>`;
const b = await pw.chromium.launch();
const p = await b.newPage({ viewport: { width: 1200, height: 630 }, ignoreHTTPSErrors: true });
await p.setContent(html, { waitUntil: 'networkidle' });
await p.screenshot({ path: out });
await b.close();
console.log('wrote', out);

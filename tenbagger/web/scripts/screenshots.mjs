// Screenshots of key pages (desktop 1440x900 + mobile 390x844) into ../docs/screenshots/.
// Needs Playwright with Chromium available (global install is fine). Run `npm run build` first.
import { createRequire } from 'node:module';
import path from 'node:path';
import fs from 'node:fs';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createServer } from './serve.mjs';

const require = createRequire(import.meta.url);
let pw;
try { pw = require('playwright'); } catch {
  const globalRoot = execSync('npm root -g').toString().trim();
  pw = require(path.join(globalRoot, 'playwright'));
}
const here = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.resolve(here, '..', '..', 'docs', 'screenshots');
fs.mkdirSync(outDir, { recursive: true });

const dist = path.resolve(here, '..', 'dist');
const firstDir = (d) => { try { return fs.readdirSync(path.join(dist, d)).find((f) => fs.statSync(path.join(dist, d, f)).isDirectory()); } catch { return null; } };
const company = process.env.SHOT_COMPANY ?? 'cost';
const article = process.env.SHOT_ARTICLE ?? firstDir('learn');
const pages = [
  { name: 'landing', url: '/', full: true },
  { name: 'company', url: `/companies/${company}/`, full: true },
  ...(article ? [{ name: 'article', url: `/learn/${article}/`, full: true }] : []),
  { name: 'screener', url: '/screener/', full: true },
];
const only = process.argv.slice(2);
const server = createServer().listen(0);
const port = server.address().port;
const browser = await pw.chromium.launch();
for (const [vp, size] of [['desktop', { width: 1440, height: 900 }], ['mobile', { width: 390, height: 844 }]]) {
  const ctx = await browser.newContext({ ignoreHTTPSErrors: true, viewport: size, deviceScaleFactor: 1, colorScheme: process.env.SHOT_DARK ? 'dark' : 'light' });
  const page = await ctx.newPage();
  for (const p of pages) {
    if (only.length && !only.includes(p.name)) continue;
    await page.goto(`http://localhost:${port}${p.url}`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(400);
    const file = path.join(outDir, `web-${p.name}-${vp}${process.env.SHOT_DARK ? '-dark' : ''}.png`);
    await page.screenshot({ path: file, fullPage: p.full });
    console.log('saved', path.relative(process.cwd(), file));
  }
  await ctx.close();
}
await browser.close();
server.close();

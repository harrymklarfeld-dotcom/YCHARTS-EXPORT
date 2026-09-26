#!/usr/bin/env node
/**
 * Checks store copy against the store limits and against the app's monetization config.
 *   node store/check-metadata.mjs
 * Limits: App Store name 30, subtitle 30, promo 170, keywords 100, description 4000, what's new 4000;
 * Google Play title 30, short 80, full 4000.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const m = JSON.parse(readFileSync(join(here, 'metadata.json'), 'utf8'));
const read = (p) => readFileSync(join(here, p), 'utf8').trim();
let failed = 0;
const check = (label, text, max) => {
  const n = [...text].length;
  const ok = n <= max;
  if (!ok) failed++;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${label.padEnd(28)} ${String(n).padStart(4)} / ${max}`);
};

const a = m.appStore;
check('ASC name', a.name, 30);
check('ASC subtitle', a.subtitle, 30);
check('ASC promotional text', a.promotionalText, 170);
check('ASC keywords', a.keywords, 100);
check('ASC description', read('app-store/description.txt'), 4000);
check("ASC what's new", a.whatsNew, 4000);
const g = m.googlePlay;
check('Play title', g.title, 30);
check('Play short description', g.shortDescription, 80);
check('Play full description', read('google-play/full-description.txt'), 4000);

// Apple indexes name + subtitle + keywords together; repeating a word wastes characters.
const nameWords = new Set(`${a.name} ${a.subtitle}`.toLowerCase().split(/[^a-z0-9-]+/).filter(Boolean));
const kw = a.keywords.split(',');
const dupes = kw.filter((k) => nameWords.has(k));
if (a.keywords.includes(', ')) { console.log('FAIL keywords contain ", " (spaces waste characters)'); failed++; }
if (dupes.length) { console.log(`FAIL keywords repeat name/subtitle words: ${dupes.join(', ')}`); failed++; }
if (new Set(kw).size !== kw.length) { console.log('FAIL duplicate keywords'); failed++; }

// Product ids must match the app's monetization config.
try {
  const src = readFileSync(join(here, '../src/config/monetization.ts'), 'utf8');
  for (const p of m.inAppProducts.products) {
    const re = new RegExp(`${p.planId}:\\s*{[^}]*storeProductId:\\s*'${p.storeProductId}'`, 's');
    const ok = re.test(src);
    if (!ok) failed++;
    console.log(`${ok ? 'ok  ' : 'FAIL'} product ${p.planId} -> ${p.storeProductId} matches src/config/monetization.ts`);
  }
} catch {
  console.log('skip product id check (src/config/monetization.ts not found)');
}
process.exit(failed ? 1 : 0);

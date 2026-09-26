// Crawls every HTML file in dist/ and reports broken internal links, assets and #anchors.
// Usage: node scripts/check-links.mjs   (exit code 1 when anything is broken)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dist = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'dist');
if (!fs.existsSync(dist)) { console.error('dist/ not found — run `npm run build` first.'); process.exit(2); }

const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]));
const files = walk(dist);
const html = files.filter((f) => f.endsWith('.html'));
const ids = new Map();
const idsOf = (file) => {
  if (!ids.has(file)) {
    const src = fs.readFileSync(file, 'utf8');
    ids.set(file, new Set([...src.matchAll(/\sid=["']([^"']+)["']/g)].map((m) => m[1])));
  }
  return ids.get(file);
};
const pageFor = (urlPath) => {
  const p = path.join(dist, decodeURIComponent(urlPath));
  if (!p.startsWith(dist)) return null;
  if (fs.existsSync(p) && fs.statSync(p).isFile()) return p;
  const idx = path.join(p, 'index.html');
  if (fs.existsSync(idx)) return idx;
  return null;
};

let checked = 0;
const broken = [];
for (const file of html) {
  const src = fs.readFileSync(file, 'utf8').replace(/<script\b(?![^>]*\bsrc=)[^>]*>[\s\S]*?<\/script>/gi, '');
  const pageUrl = '/' + path.relative(dist, file).replace(/index\.html$/, '').replace(/\\/g, '/');
  for (const m of src.matchAll(/\s(?:href|src)=["']([^"']+)["']/g)) {
    const raw = m[1].replace(/&amp;/g, '&');
    if (/^(https?:|mailto:|tel:|data:|javascript:)/i.test(raw) || raw.startsWith('//')) continue;
    checked++;
    const u = new URL(raw, 'http://x' + pageUrl);
    const target = pageFor(u.pathname);
    if (!target) { broken.push({ from: pageUrl, link: raw, why: 'missing page/file' }); continue; }
    if (u.hash && target.endsWith('.html')) {
      const id = decodeURIComponent(u.hash.slice(1));
      if (id && !idsOf(target).has(id)) broken.push({ from: pageUrl, link: raw, why: `missing #${id}` });
    }
  }
}
const pages = html.length;
console.log(`Checked ${checked} internal links/assets across ${pages} HTML pages (${files.length} files in dist).`);
if (broken.length) {
  console.log(`\n${broken.length} broken:`);
  for (const b of broken) console.log(`  ${b.from}  →  ${b.link}  (${b.why})`);
  process.exit(1);
}
console.log('No broken internal links. ✔');

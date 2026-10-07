// Repo-wide compliance scan: flags user-facing text that reads as investment advice, shaming money copy,
// or banned reward / lending language. Runs in check-all.sh ("compliance" suite) and CI.
// Scans lessons, articles, and app/web source strings. Exit 1 on any hit.
// Allow a deliberate mention on one line with the comment marker: compliance-ok
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const TARGETS = [
  'data/lessons.json', 'data/articles.json', 'content/articles',
  'mobile/src', 'web/src', 'packages/money/src', 'packages/budget/src', 'packages/screener/src/presets.ts',
];
const SKIP = /(__tests__|\.test\.|tests\/|node_modules|dist\/|language\.ts|bannedPhrases|banned|compliance)/i;

const RULES = [
  { id: 'advice', re: /\b(you should (buy|sell|invest)|strong buy|buy now|sell now|price target|guaranteed returns?|can'?t lose|top pick|we recommend (buying|selling))\b/i },
  { id: 'rating', re: /\b(outperform|underperform|overweight|underweight)\b(?! the)/i },
  { id: 'lending', re: /\b(cash advance|payday loan|get an advance|instant advance)\b/i },
  { id: 'shame', re: /\b(you('| a)re (bad|terrible|irresponsible) with money|you failed|shame on)\b/i },
  { id: 'trade-reward', re: /\b(xp|points?|streak|badge|confetti)\b[^.\n]{0,40}\b(for|per|on) (trad(e|ing)|deposits?|buying|selling)\b/i },
];

const exts = new Set(['.ts', '.tsx', '.js', '.mjs', '.astro', '.md', '.json']);
function* walk(p) {
  if (!fs.existsSync(p)) return;
  const st = fs.statSync(p);
  if (st.isFile()) { yield p; return; }
  for (const e of fs.readdirSync(p)) yield* walk(path.join(p, e));
}
let hits = 0, files = 0;
for (const t of TARGETS) {
  for (const f of walk(path.join(ROOT, t))) {
    const rel = path.relative(ROOT, f);
    if (SKIP.test(rel) || !exts.has(path.extname(f))) continue;
    files++;
    fs.readFileSync(f, 'utf8').split('\n').forEach((line, i) => {
      if (line.includes('compliance-ok')) return;
      // Guardrail statements ("never for trading", ban lists) are fine.
      if (/\b(never|nothing|not|no|block\w*|ban\w*|reject\w*|forbid\w*|avoid\w*)\b/i.test(line)) return;
      for (const r of RULES) if (r.re.test(line)) {
        hits++;
        console.log(`${rel}:${i + 1} [${r.id}] ${line.trim().slice(0, 140)}`);
      }
    });
  }
}
console.log(`compliance-scan: ${files} files, ${hits} issue(s)`);
process.exit(hits ? 1 : 0);

#!/usr/bin/env node
/**
 * Build tenbagger/data/articles.json from tenbagger/content/articles/*.md.
 *
 *   node content/build.mjs            # validate + write data/articles.json
 *   node content/build.mjs --check    # validate only (CI)
 *   node content/build.mjs --out x.json
 *
 * Files starting with "_" (e.g. _template.md) are skipped. Zero npm dependencies.
 * Fails (exit 1) on: unknown widget, unknown ticker / metric / lesson / unit, bad frontmatter,
 * unsupported markdown, advice-like phrasing. Prints warnings for word counts outside the target range.
 */
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ContentError, parseArticle, wordCount } from './lib/parse.mjs';
import { makeContext, validateArticle } from './lib/validate.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..');
export const SCHEMA_VERSION = 1;

const readJson = (p) => JSON.parse(readFileSync(p, 'utf8'));

export function loadContext(paths = {}) {
  const spec = readJson(paths.spec ?? join(HERE, 'widgets.json'));
  const companies = readJson(paths.companies ?? join(ROOT, 'data', 'companies.json'));
  const lessons = readJson(paths.lessons ?? join(ROOT, 'data', 'lessons.json'));
  return makeContext({ spec, companies, lessons });
}

/** Build from an in-memory list of {file, text}. Pure: no fs access. */
export function buildArticles(files, ctx) {
  const errors = [];
  const warnings = [];
  const articles = [];
  const seen = new Map();
  for (const { file, text } of files) {
    const expectedSlug = basename(file).replace(/\.md$/, '');
    let parsed;
    try {
      parsed = parseArticle(text, file);
    } catch (e) {
      if (e instanceof ContentError) {
        errors.push(e.message);
        continue;
      }
      throw e;
    }
    const art = validateArticle(parsed, ctx, { file, expectedSlug, errors, warnings });
    if (!art) continue;
    if (seen.has(art.slug)) {
      errors.push(`${file}: duplicate slug "${art.slug}" (also in ${seen.get(art.slug)})`);
      continue;
    }
    seen.set(art.slug, file);
    const words = wordCount(parsed.blocks);
    const [lo, hi] = ctx.spec.rules.word_range ?? [0, Infinity];
    if (words < lo || words > hi) warnings.push(`${file}: ${words} words (target ${lo}-${hi})`);
    articles.push({ ...art, wordCount: words });
  }
  const unitOrder = new Map([...ctx.unitIds.values()].map((u) => [u.id, u.order ?? 0]));
  const levelOrder = new Map(ctx.spec.rules.levels.map((l, i) => [l, i]));
  articles.sort(
    (a, b) =>
      (unitOrder.get(a.unit) ?? 99) - (unitOrder.get(b.unit) ?? 99) ||
      levelOrder.get(a.level) - levelOrder.get(b.level) ||
      a.slug.localeCompare(b.slug),
  );
  // Reorder keys so frontmatter comes first, blocks last (nicer diffs).
  const shaped = articles.map(({ blocks, ...rest }) => ({ ...rest, blocks }));
  const generatedAt = shaped.reduce((m, a) => (a.updated > m ? a.updated : m), '1970-01-01');
  const out = {
    schema_version: SCHEMA_VERSION,
    generated_at: `${generatedAt}T00:00:00Z`,
    widget_spec_version: ctx.spec.schema_version,
    provenance: ctx.spec.provenance,
    metrics: ctx.spec.metrics,
    articles: shaped,
  };
  return { out, errors, warnings };
}

export function readArticleFiles(dir = join(HERE, 'articles')) {
  return readdirSync(dir)
    .filter((f) => f.endsWith('.md') && !f.startsWith('_'))
    .sort()
    .map((f) => ({ file: `articles/${f}`, text: readFileSync(join(dir, f), 'utf8') }));
}

function main(argv) {
  const check = argv.includes('--check');
  const outIdx = argv.indexOf('--out');
  const outPath = outIdx >= 0 ? resolve(argv[outIdx + 1]) : join(ROOT, 'data', 'articles.json');
  const ctx = loadContext();
  const { out, errors, warnings } = buildArticles(readArticleFiles(), ctx);
  for (const w of warnings) console.warn(`warning: ${w}`);
  if (errors.length) {
    for (const e of errors) console.error(`error: ${e}`);
    console.error(`\n${errors.length} error(s); nothing written.`);
    process.exit(1);
  }
  const widgets = out.articles.reduce((n, a) => n + a.widgetCount, 0);
  if (!check) writeFileSync(outPath, `${JSON.stringify(out, null, 2)}\n`);
  console.log(`${check ? 'checked' : 'wrote'} ${out.articles.length} articles, ${widgets} widgets${check ? '' : ` → ${outPath}`}`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main(process.argv.slice(2));

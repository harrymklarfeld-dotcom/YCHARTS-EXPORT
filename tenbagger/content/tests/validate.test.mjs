import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { buildArticles, loadContext, readArticleFiles } from '../build.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ctx = loadContext();

const fm = (over = {}) =>
  [
    '---',
    `slug: ${over.slug ?? 'test-article'}`,
    'title: Test article',
    'summary: A test.',
    'minutes: 3',
    `level: ${over.level ?? 'beginner'}`,
    `unit: ${over.unit ?? 'u2-margins'}`,
    `relatedLessons: [${over.lessons ?? 'u2-l1'}]`,
    `metrics: [${over.metrics ?? 'gross_margin'}]`,
    'tags: [margins]',
    'updated: 2026-09-25',
    '---',
  ].join('\n');

const W_OK = '```widget:metric ticker=MU metric=gross_margin\n```\n\n```widget:quiz lesson=u2-l1\n```\n';
const build = (text, file = 'articles/test-article.md') => buildArticles([{ file, text }], ctx);

test('a valid article builds with coerced params and defaults', () => {
  const text = `${fm()}\nIntro text.\n\n${W_OK}\n\`\`\`widget:compare tickers=mu,COST metric=roic\n\`\`\`\n\n\`\`\`widget:calculator kind=dcf ticker=MU\n\`\`\`\n`;
  const { out, errors } = build(text);
  assert.deepEqual(errors, []);
  const a = out.articles[0];
  assert.equal(a.slug, 'test-article');
  assert.equal(a.widgetCount, 4);
  assert.deepEqual(a.sampleTickers, ['COST']);
  const cmp = a.blocks.find((b) => b.kind === 'compare');
  assert.deepEqual(cmp.params.tickers, ['MU', 'COST']);
  const dcf = a.blocks.find((b) => b.kind === 'calculator');
  assert.deepEqual(dcf.params, { kind: 'dcf', ticker: 'MU', growth: 0.05, discount: 0.09, terminal: 15, years: 5, cyclical: false });
  assert.equal(out.schema_version, 1);
  assert.ok(out.metrics.gross_margin.formula);
});

const expectError = (text, re, file) => {
  const { errors, out } = build(text, file);
  assert.equal(out.articles.length, 0, 'article should be rejected');
  assert.ok(errors.some((e) => re.test(e)), `expected ${re} in:\n${errors.join('\n')}`);
};

test('unknown widget kind fails', () => expectError(`${fm()}\n${W_OK}\n\`\`\`widget:sparkle ticker=MU\n\`\`\`\n`, /unknown widget "widget:sparkle"/));
test('unknown ticker fails', () => expectError(`${fm()}\n${W_OK}\n\`\`\`widget:metric ticker=ZZZZ metric=pe\n\`\`\`\n`, /unknown ticker "ZZZZ"/));
test('unknown metric fails', () => expectError(`${fm()}\n${W_OK}\n\`\`\`widget:metric ticker=MU metric=vibes\n\`\`\`\n`, /unknown metric "vibes"/));
test('unknown lesson fails', () => expectError(`${fm()}\n${W_OK}\n\`\`\`widget:quiz lesson=u99-l1\n\`\`\`\n`, /unknown lesson id "u99-l1"/));
test('unknown lesson in frontmatter fails', () => expectError(`${fm({ lessons: 'u2-l1, nope' })}\n${W_OK}`, /unknown lesson id "nope"/));
test('unknown unit fails', () => expectError(`${fm({ unit: 'u0-x' })}\n${W_OK}`, /unknown unit/));
test('unknown frontmatter metric fails', () => expectError(`${fm({ metrics: 'pe, bogus' })}\n${W_OK}`, /unknown metric "bogus"/));
test('bad level fails', () => expectError(`${fm({ level: 'expert' })}\n${W_OK}`, /level must be/));
test('slug must match file name', () => expectError(`${fm()}\n${W_OK}`, /must match the file name/, 'articles/other.md'));
test('unknown param fails', () => expectError(`${fm()}\n${W_OK}\n\`\`\`widget:metric ticker=MU metric=pe colour=red\n\`\`\`\n`, /does not take "colour"/));
test('missing required param fails', () => expectError(`${fm()}\n${W_OK}\n\`\`\`widget:history ticker=MU\n\`\`\`\n`, /missing required "metric"/));
test('history needs a history series', () => expectError(`${fm()}\n${W_OK}\n\`\`\`widget:history ticker=MU metric=roic\n\`\`\`\n`, /not a history series/));
test('calculator kind must be known', () => expectError(`${fm()}\n${W_OK}\n\`\`\`widget:calculator kind=npv\n\`\`\`\n`, /kind=pe\|dcf\|liquidity/));
test('calculator number range enforced', () => expectError(`${fm()}\n${W_OK}\n\`\`\`widget:calculator kind=dcf fcf=100 discount=0.9\n\`\`\`\n`, /discount" must be ≤ 0.2/));
test('null metric value fails (JPM has no gross margin)', () => expectError(`${fm()}\n${W_OK}\n\`\`\`widget:compare tickers=MU,JPM metric=gross_margin\n\`\`\`\n`, /JPM has no value for "gross_margin"/));
test('fewer than 2 widgets fails', () => expectError(`${fm()}\nJust text.\n\n\`\`\`widget:quiz lesson=u2-l1\n\`\`\`\n`, /at least 2 widgets/));
test('advice language fails', () => expectError(`${fm()}\nThis stock is a strong buy.\n\n${W_OK}`, /educational-voice guard/));
test('tables, images, html and H1 fail', () => {
  expectError(`${fm()}\n| a | b |\n|---|---|\n\n${W_OK}`, /tables are not supported/);
  expectError(`${fm()}\n![chart](x.png)\n\n${W_OK}`, /images are not supported/);
  expectError(`${fm()}\n<b>hi</b>\n\n${W_OK}`, /raw HTML/);
  expectError(`${fm()}\n# Big title\n\n${W_OK}`, /use "##"/);
});

test('the real library builds cleanly and data/articles.json is up to date', () => {
  const { out, errors, warnings } = buildArticles(readArticleFiles(), ctx);
  assert.deepEqual(errors, []);
  assert.deepEqual(warnings, [], 'every article is within the target word range');
  assert.ok(out.articles.length >= 14);
  for (const a of out.articles) assert.ok(a.widgetCount >= 2, `${a.slug} has ≥2 widgets`);
  const onDisk = JSON.parse(readFileSync(join(HERE, '..', '..', 'data', 'articles.json'), 'utf8'));
  assert.deepEqual(onDisk, JSON.parse(JSON.stringify(out)), 'run `node content/build.mjs` to refresh data/articles.json');
});

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ContentError, parseArticle, parseBody, parseParams, parseYamlSubset, splitFrontmatter, wordCount } from '../lib/parse.mjs';

test('frontmatter: scalars, flow lists, block lists, quotes, comments', () => {
  const fm = parseYamlSubset(
    [
      'slug: gross-margin',
      'title: "Gross margin: what a company keeps"',
      "summary: 'It''s the first cut'",
      'minutes: 6',
      '# a comment',
      'tags: [margins, "basics"]',
      'relatedLessons:',
      '  - u2-l1',
      '  - u2-l4',
      'updated: 2026-09-25',
      'flag: true',
    ].join('\n'),
  );
  assert.deepEqual(fm, {
    slug: 'gross-margin',
    title: 'Gross margin: what a company keeps',
    summary: "It's the first cut",
    minutes: 6,
    tags: ['margins', 'basics'],
    relatedLessons: ['u2-l1', 'u2-l4'],
    updated: '2026-09-25',
    flag: true,
  });
});

test('frontmatter: empty flow list and errors', () => {
  assert.deepEqual(parseYamlSubset('metrics: []'), { metrics: [] });
  assert.throws(() => parseYamlSubset('a: 1\na: 2'), /duplicate/);
  assert.throws(() => parseYamlSubset('- orphan'), /without a key/);
  assert.throws(() => parseYamlSubset('not yaml at all'), /cannot parse/);
  assert.throws(() => splitFrontmatter('no frontmatter'), ContentError);
  assert.throws(() => splitFrontmatter('---\nslug: x\n'), /not closed/);
});

test('params: bare, quoted, escaped', () => {
  assert.deepEqual(parseParams(' ticker=COST  metric=gross_margin caption="Two \\"words\\"" note=\'x y\''), {
    ticker: 'COST',
    metric: 'gross_margin',
    caption: 'Two "words"',
    note: 'x y',
  });
  assert.deepEqual(parseParams(''), {});
  assert.throws(() => parseParams('ticker COST'), /key=value/);
  assert.throws(() => parseParams('a=1 a=2'), /duplicate/);
});

test('body: fenced widget, one-line widget, params on body lines, normal code fences kept', () => {
  const body = [
    '## Heading',
    '',
    'Some text.',
    '',
    '```widget:metric ticker=COST metric=gross_margin',
    '```',
    '',
    '```widget:compare metric=roic',
    'tickers=COST,AAPL',
    'caption="Quality test"',
    '```',
    '```widget:quiz lesson=u2-l1```',
    '',
    '```js',
    'const notAWidget = 1;',
    '```',
    'Tail.',
  ].join('\n');
  const blocks = parseBody(body, { lineOffset: 10 });
  assert.equal(blocks.length, 5);
  assert.deepEqual(blocks[0], { type: 'markdown', md: '## Heading\n\nSome text.' });
  assert.deepEqual(blocks[1], { type: 'widget', kind: 'metric', params: { ticker: 'COST', metric: 'gross_margin' }, line: 14 });
  assert.deepEqual(blocks[2].params, { metric: 'roic', tickers: 'COST,AAPL', caption: 'Quality test' });
  assert.equal(blocks[3].kind, 'quiz');
  assert.equal(blocks[4].type, 'markdown');
  assert.match(blocks[4].md, /```js\nconst notAWidget = 1;\n```\nTail\./);
});

test('body: unclosed fence and duplicate param across lines fail', () => {
  assert.throws(() => parseBody('```widget:metric ticker=MU\nmetric=pe'), /never closed/);
  assert.throws(() => parseBody('```widget:metric ticker=MU\nticker=AAPL\n```'), /duplicate/);
});

test('parseArticle + wordCount', () => {
  const { frontmatter, blocks } = parseArticle('---\nslug: a\n---\nOne two **three** [four](x).\n\n```widget:quiz lesson=u1-l1\n```\n', 'a.md');
  assert.equal(frontmatter.slug, 'a');
  assert.equal(blocks.length, 2);
  assert.equal(wordCount(blocks), 4);
});

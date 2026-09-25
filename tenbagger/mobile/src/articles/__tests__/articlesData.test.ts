import { getCompany, getLesson } from '../../data';
import { getArticles, getArticlesFile, filterArticles, normalizeArticles } from '../data';
import { metricValue, workedFormula } from '../values';

describe('bundled data/articles.json', () => {
  const file = getArticlesFile();
  const articles = getArticles();

  it('has the library with ≥2 widgets each and no unsupported widgets', () => {
    expect(file.schema_version).toBe(1);
    expect(articles.length).toBeGreaterThanOrEqual(14);
    for (const a of articles) {
      const widgets = a.blocks.filter((b) => b.type === 'widget');
      expect(widgets.length).toBeGreaterThanOrEqual(2);
      for (const b of widgets) if (b.type === 'widget') expect(b.widget.kind).not.toBe('unsupported');
    }
  });

  it('every widget resolves against the app data (tickers, metrics, lessons)', () => {
    for (const a of articles) {
      for (const id of a.relatedLessons) expect(getLesson(id)).toBeDefined();
      for (const b of a.blocks) {
        if (b.type !== 'widget') continue;
        const w = b.widget;
        if (w.kind === 'metric') expect(metricValue(getCompany(w.ticker)!, w.metric, file.metrics)).not.toBeNull();
        if (w.kind === 'compare') for (const t of w.tickers) expect(metricValue(getCompany(t)!, w.metric, file.metrics)).not.toBeNull();
        if (w.kind === 'history') expect((getCompany(w.ticker)!.history[w.metric] ?? []).length).toBeGreaterThan(1);
        if (w.kind === 'quiz') expect(getLesson(w.lesson)).toBeDefined();
        if ((w.kind === 'calc_pe' || w.kind === 'calc_dcf') && w.ticker) expect(getCompany(w.ticker)).toBeDefined();
      }
    }
  });

  it('worked formula for Micron gross margin uses the contract formula', () => {
    const mu = getCompany('MU')!;
    const { formula, worked } = workedFormula(mu, 'gross_margin', file.metrics);
    expect(formula).toBe('gross profit / revenue');
    expect(worked).toMatch(/^\$15\.0B \/ \$37\.4B = 40\.1%$/);
    expect(metricValue(mu, 'price', file.metrics)).toBe(mu.price);
  });

  it('filters by level and search', () => {
    expect(filterArticles(articles, 'advanced', '').every((a) => a.level === 'advanced')).toBe(true);
    expect(filterArticles(articles, 'all', 'dcf').map((a) => a.slug)).toEqual(expect.arrayContaining(['napkin-dcf', 'cycles-dcf-micron']));
    expect(filterArticles(articles, 'all', 'zzzz')).toEqual([]);
  });

  it('normalize drops malformed articles and keeps bad widgets as unsupported', () => {
    const f = normalizeArticles({ articles: [{ slug: 'x', title: 'X', blocks: [{ type: 'widget', kind: 'nope', params: {} }, { type: 'markdown', md: 'hi' }] }, { title: 'no slug' }, null] });
    expect(f.articles).toHaveLength(1);
    expect(f.articles[0].blocks[0]).toEqual({ type: 'widget', widget: { kind: 'unsupported', original: 'nope', reason: 'unknown widget "nope"' } });
    expect(normalizeArticles(null).articles).toEqual([]);
  });
});

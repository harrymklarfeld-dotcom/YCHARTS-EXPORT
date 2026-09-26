import { describe, expect, it } from 'vitest';
import {
  ASSIST_LIMITS,
  ASSIST_SYNONYMS,
  ASSIST_TOOL,
  BANNED_PHRASES,
  buildAssistSystemPrompt,
  concentration,
  coerceAssistResult,
  filtersAreFinite,
  findBannedPhrases,
  GENERIC_SECTOR_NOTE,
  isFieldKey,
  mergeFilters,
  METRIC_CATALOG,
  mockAssist,
  needsModel,
  normalizeAssistText,
  restateFilters,
  restatementNumbersMatch,
  SCORE_FAMILIES,
  scores,
  SECTOR_NOTES,
  styleBoxes,
  validateAssistOutput,
  validateFilter,
} from '../src/index.ts';
import { COMPANIES, mk } from './helpers.ts';

describe('mockAssist (offline)', () => {
  it('uses the exact parser first', () => {
    const r = mockAssist('pe < 20 and roic > 15%');
    expect(r.source).toBe('parser');
    expect(r.filters).toEqual([
      { metric: 'pe', op: '<', value: 20 },
      { metric: 'roic', op: '>', value: 0.15 },
    ]);
    expect(r.notes).toEqual([]);
    expect(needsModel(r)).toBe(false);
  });

  it('reads "cheap" as P/E < 15 and P/B < 2, with a visible, editable note', () => {
    const r = mockAssist('Show me cheap companies');
    expect(r.source).toBe('synonyms');
    expect(r.filters).toEqual([
      { metric: 'pe', op: '<', value: 15 },
      { metric: 'pb', op: '<', value: 2 },
    ]);
    expect(r.notes[0]).toMatch(/“cheap” was read as P\/E below 15x and P\/B below 2x/);
    expect(r.notes[0]).toMatch(/Edit/);
  });

  it('mixes clauses, synonyms and exact conditions; keeps "between … and …" together', () => {
    const r = mockAssist('large cap stocks with high dividends, debt/equity between 0 and 0.5 and roic > 15%');
    expect(r.filters).toEqual([
      { metric: 'market_cap', op: '>=', value: 10e9 },
      { metric: 'dividend_yield', op: '>', value: 0.03 },
      { metric: 'debt_to_equity', op: 'between', value: [0, 0.5] },
      { metric: 'roic', op: '>', value: 0.15 },
    ]);
    expect(r.unrecognized).toEqual([]);
  });

  it('prefers the longest phrase ("high growth" over "growth")', () => {
    expect(mockAssist('high growth').filters).toEqual([{ metric: 'revenue_cagr_3y', op: '>', value: 0.2 }]);
  });

  it('reports what it could not read so the backend can try', () => {
    const r = mockAssist('companies run by founders');
    expect(r.filters).toEqual([]);
    expect(r.unrecognized.length).toBeGreaterThan(0);
    expect(needsModel(r)).toBe(true);
  });

  it('flags words left over next to a synonym', () => {
    const r = mockAssist('cheap companies run by founders');
    expect(r.filters).toHaveLength(2);
    expect(r.unrecognized).toEqual(['run founders']);
    expect(needsModel(r)).toBe(true);
    expect(mockAssist('cheap profitable companies').unrecognized).toEqual([]);
  });

  it('caps filters and deduplicates', () => {
    const r = mockAssist('cheap and cheap and inexpensive');
    expect(r.filters).toHaveLength(2);
    const many = mockAssist(ASSIST_SYNONYMS.map((s) => s.phrases[0]).join(', '));
    expect(many.filters.length).toBeLessThanOrEqual(ASSIST_LIMITS.maxFilters);
  });

  it('every synonym filter is valid and every meaning is clean', () => {
    for (const s of ASSIST_SYNONYMS) {
      for (const f of s.filters) expect(validateFilter(f), JSON.stringify(f)).toEqual([]);
      expect(findBannedPhrases(s.meaning)).toEqual([]);
    }
  });

  it('normalizes text for caching', () => {
    expect(normalizeAssistText('  Cheap   PROFITABLE\n companies ')).toBe('cheap profitable companies');
    expect(normalizeAssistText('x'.repeat(1000))).toHaveLength(ASSIST_LIMITS.maxTextLength);
  });
});

describe('restatement', () => {
  it('describes filters in plain words', () => {
    expect(restateFilters([{ metric: 'pe', op: '<', value: 15 }, { metric: 'net_margin', op: '>', value: 0 }])).toBe(
      'Companies with P/E below 15x and net margin above 0%.',
    );
    expect(restateFilters([])).toMatch(/every company/);
  });

  it('only allows numbers that are filter thresholds', () => {
    const fs = [{ metric: 'pe' as const, op: '<' as const, value: 15 }, { metric: 'market_cap' as const, op: '>' as const, value: 10e9 }];
    expect(restatementNumbersMatch('P/E below 15x and market cap above $10B', fs)).toBe(true);
    expect(restatementNumbersMatch('P/E below 15x; Acme has a P/E of 42', fs)).toBe(false);
  });
});

describe('validateAssistOutput (server-side check of model output)', () => {
  it('accepts the tool shape and converts "between"', () => {
    const v = validateAssistOutput({
      filters: [
        { metric: 'pe', op: '<', value: 15, high: null },
        { metric: 'debt_to_equity', op: 'between', value: 0, high: 0.5 },
      ],
      restatement: 'Companies with P/E below 15x and debt/equity from 0 to 0.5.',
      assumptions: ['cheap → P/E below 15x'],
      unsupported: [],
    });
    expect(v.ok).toBe(true);
    expect(v.filters).toEqual([
      { metric: 'pe', op: '<', value: 15 },
      { metric: 'debt_to_equity', op: 'between', value: [0, 0.5] },
    ]);
    expect(v.restatementFromModel).toBe(true);
  });

  it('rejects unknown metrics, bad ops and non-finite values', () => {
    const v = validateAssistOutput({
      filters: [
        { metric: 'stock_price_momentum', op: '>', value: 1, high: null },
        { metric: 'pe', op: '~', value: 1, high: null },
        { metric: 'pe', op: '<', value: 'NaN', high: null },
        { metric: 'roic', op: '>', value: 0.15, high: null },
      ],
      restatement: 'x',
      assumptions: [],
      unsupported: [],
    });
    expect(v.ok).toBe(false);
    expect(v.filters).toEqual([{ metric: 'roic', op: '>', value: 0.15 }]);
    expect(v.errors.join(' ')).toMatch(/Unknown metric "stock_price_momentum"/);
    expect(filtersAreFinite(v.filters)).toBe(true);
    for (const f of v.filters) expect(isFieldKey(f.metric)).toBe(true);
  });

  it('replaces restatements with advice words or company numbers', () => {
    const base = { filters: [{ metric: 'pe', op: '<', value: 15, high: null }], assumptions: [], unsupported: [] };
    const advice = validateAssistOutput({ ...base, restatement: 'Attractive cheap stocks to buy now.' });
    expect(advice.restatementFromModel).toBe(false);
    expect(advice.restatement).toBe('Companies with P/E below 15x.');
    const numbers = validateAssistOutput({ ...base, restatement: 'P/E below 15x, like Acme at 9.3x.' });
    expect(numbers.restatementFromModel).toBe(false);
    const long = validateAssistOutput({ ...base, restatement: 'x'.repeat(500) });
    expect(long.restatementFromModel).toBe(false);
  });

  it('drops banned phrases from assumptions and caps the filter count', () => {
    const v = validateAssistOutput({
      filters: Array.from({ length: 12 }, (_, i) => ({ metric: 'pe', op: '<', value: i + 1, high: null })),
      restatement: '',
      assumptions: ['cheap → P/E below 15x', 'these are undervalued'],
      unsupported: ['will go up'],
    });
    expect(v.filters).toHaveLength(ASSIST_LIMITS.maxFilters);
    expect(v.assumptions).toEqual(['cheap → P/E below 15x']);
    expect(v.unsupported).toEqual(['will go up']);
  });

  it('coerces a network AssistResult and merges filters without duplicates', () => {
    const r = coerceAssistResult({ filters: [{ metric: 'pe', op: '<', value: 20 }, { metric: 'bogus', op: '<', value: 1 }], restatement: 'P/E below 20x.', notes: [], unrecognized: [], source: 'model' });
    expect(r?.filters).toEqual([{ metric: 'pe', op: '<', value: 20 }]);
    expect(coerceAssistResult('nope')).toBeNull();
    expect(mergeFilters([{ metric: 'pe', op: '<', value: 20 }], [{ metric: 'pe', op: '<', value: 20 }, { metric: 'roic', op: '>', value: 0.1 }])).toHaveLength(2);
  });
});

describe('model contract', () => {
  const prompt = buildAssistSystemPrompt();

  it('system prompt lists every catalog key and nothing about real companies', () => {
    for (const m of METRIC_CATALOG) expect(prompt).toContain(`- ${m.key} |`);
    for (const c of COMPANIES) {
      expect(prompt).not.toMatch(new RegExp(`\\b${c.ticker}\\b`));
      expect(prompt).not.toContain(c.name);
    }
    expect(buildAssistSystemPrompt()).toBe(prompt); // stable → cacheable
  });

  it('prompt is big enough to be cached on Haiku 4.5 (≥ 4096 tokens, ~4 chars/token)', () => {
    expect(prompt.length / 4).toBeGreaterThan(4096);
  });

  it('tool schema enumerates only catalog keys and all ops', () => {
    const items = ASSIST_TOOL.input_schema.properties.filters.items;
    expect(items.properties.metric.enum).toEqual(METRIC_CATALOG.map((m) => m.key));
    expect(items.properties.op.enum).toEqual(['>', '>=', '<', '<=', 'between', '==']);
    expect(ASSIST_TOOL.strict).toBe(true);
  });
});

describe('no banned phrases in v2 copy (scores are not ratings)', () => {
  it('the extended list catches rating labels', () => {
    for (const s of ['Attractive', 'Avoid', 'Buy', 'Strong Sell', 'Outperform', 'Underweight', 'top pick', 'overvalued', 'Hold rating'])
      expect(findBannedPhrases(s).length, s).toBeGreaterThan(0);
    for (const s of ['Quality', 'Value', 'Growth', 'Balance sheet', 'buyback', 'shareholders', 'household goods'])
      expect(findBannedPhrases(s), s).toEqual([]);
    expect(BANNED_PHRASES.length).toBeGreaterThan(10);
  });

  it('score, style, concentration and assist copy is clean', () => {
    const texts: string[] = [];
    for (const f of SCORE_FAMILIES) {
      texts.push(f.label, f.question, f.formula, f.caveat);
      for (const c of f.components) texts.push(c.label, c.formula, c.note ?? '');
    }
    for (const s of scores(COMPANIES)) for (const f of SCORE_FAMILIES) texts.push(s[f.id].working);
    for (const b of styleBoxes(COMPANIES)) texts.push(b.label, b.explanation);
    for (const n of [...Object.values(SECTOR_NOTES), GENERIC_SECTOR_NOTE]) texts.push(n.text, n.linkLabel);
    texts.push(concentration([mk('A', {}), mk('B', {}), mk('C', {})]).note!.text);
    for (const q of ['cheap', 'big dividends and low debt', 'fast growing profitable', 'pricing power']) {
      const r = mockAssist(q);
      texts.push(r.restatement, ...r.notes);
    }
    texts.push(buildAssistSystemPrompt().split('## Rules')[0]!);
    const hits = texts.flatMap((t) => findBannedPhrases(t).map((h) => `${h} in "${t}"`));
    expect(hits).toEqual([]);
  });
});

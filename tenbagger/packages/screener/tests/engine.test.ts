import { describe, expect, it } from 'vitest';
import {
  explainMatch,
  getValue,
  runScreen,
  ScreenError,
  testValue,
  validateScreen,
  type Company,
  type Screen,
} from '../src/index.ts';
import { byTicker, COMPANIES, mk, tickers } from './helpers.ts';

const screen = (filters: Screen['filters'], sort?: Screen['sort']): Screen => ({
  id: 't',
  name: 'Test',
  description: 'test',
  filters,
  ...(sort ? { sort } : {}),
});

describe('getValue', () => {
  it('reads metrics and fundamentals, normalizing junk to null', () => {
    const c = mk('A', { pe: 12 }, { fundamentals: { revenue: 5e9 } });
    expect(getValue(c, 'pe')).toBe(12);
    expect(getValue(c, 'revenue')).toBe(5e9);
    expect(getValue(c, 'roic')).toBeNull(); // missing key
    expect(getValue(mk('B', { pe: Number.NaN }), 'pe')).toBeNull();
    expect(getValue(mk('C', { pe: Number.POSITIVE_INFINITY }), 'pe')).toBeNull();
    expect(getValue(mk('D', { pe: '12' as unknown as number }), 'pe')).toBeNull();
  });
});

describe('null handling', () => {
  const cs = [mk('HAS', { pe: 10 }), mk('NUL', { pe: null }), mk('MIS', {})];

  it.each(['>', '>=', '<', '<=', '=='] as const)('null never passes "%s"', (op) => {
    const out = runScreen(cs, screen([{ metric: 'pe', op, value: 10 }]));
    expect(tickers(out.results)).not.toContain('NUL');
    expect(tickers(out.results)).not.toContain('MIS');
    expect(out.excludedForMissingData).toBe(2);
    expect(out.missingData).toEqual([
      { ticker: 'NUL', missing: ['pe'] },
      { ticker: 'MIS', missing: ['pe'] },
    ]);
  });

  it('null never passes between, even an all-encompassing one', () => {
    const out = runScreen(cs, screen([{ metric: 'pe', op: 'between', value: [-1e12, 1e12] }]));
    expect(tickers(out.results)).toEqual(['HAS']);
    expect(out.excludedForMissingData).toBe(2);
  });

  it('testValue rejects null directly', () => {
    expect(testValue(null, { metric: 'pe', op: '<', value: 1e9 })).toBe(false);
  });

  it('a company that fails a filter with data is not counted as missing-data', () => {
    const c = [mk('X', { pe: 50, roic: null })];
    const out = runScreen(c, screen([
      { metric: 'pe', op: '<', value: 20 },
      { metric: 'roic', op: '>', value: 0.1 },
    ]));
    expect(out.results).toHaveLength(0);
    expect(out.excludedForMissingData).toBe(0);
  });

  it('reports every missing metric that blocked a match', () => {
    const c = [mk('Y', { pe: 10 })];
    const out = runScreen(c, screen([
      { metric: 'pe', op: '<', value: 20 },
      { metric: 'roic', op: '>', value: 0.1 },
      { metric: 'fcf_margin', op: '>', value: 0.1 },
    ]));
    expect(out.missingData).toEqual([{ ticker: 'Y', missing: ['roic', 'fcf_margin'] }]);
  });

  it('loss-maker with null P/E is excluded from a P/E screen and reported', () => {
    const out = runScreen(COMPANIES, screen([{ metric: 'pe', op: '<', value: 1000 }]));
    expect(tickers(out.results)).not.toContain('BURN');
    expect(out.missingData.map((m) => m.ticker)).toEqual(['BURN']);
  });
});

describe('operators', () => {
  const cs = [mk('A', { roe: 0.1 }), mk('B', { roe: 0.15 }), mk('C', { roe: 0.2 })];
  const run = (f: Screen['filters'][number]) => tickers(runScreen(cs, screen([f])).results);

  it('strict and non-strict comparisons', () => {
    expect(run({ metric: 'roe', op: '>', value: 0.15 })).toEqual(['C']);
    expect(run({ metric: 'roe', op: '>=', value: 0.15 })).toEqual(['B', 'C']);
    expect(run({ metric: 'roe', op: '<', value: 0.15 })).toEqual(['A']);
    expect(run({ metric: 'roe', op: '<=', value: 0.15 })).toEqual(['A', 'B']);
  });

  it('== tolerates floating point noise', () => {
    expect(run({ metric: 'roe', op: '==', value: 0.15 })).toEqual(['B']);
    const c = [mk('F', { roe: 0.1 + 0.2 })];
    expect(runScreen(c, screen([{ metric: 'roe', op: '==', value: 0.3 }])).results).toHaveLength(1);
    expect(runScreen(c, screen([{ metric: 'roe', op: '==', value: 0.31 }])).results).toHaveLength(0);
  });

  it('between is inclusive on both bounds', () => {
    expect(run({ metric: 'roe', op: 'between', value: [0.1, 0.2] })).toEqual(['A', 'B', 'C']);
    expect(run({ metric: 'roe', op: 'between', value: [0.1, 0.15] })).toEqual(['A', 'B']);
    expect(run({ metric: 'roe', op: 'between', value: [0.15, 0.15] })).toEqual(['B']);
    expect(run({ metric: 'roe', op: 'between', value: [0.11, 0.19] })).toEqual(['B']);
    expect(run({ metric: 'roe', op: 'between', value: [0.21, 0.3] })).toEqual([]);
  });

  it('filters on fundamentals as well as metrics', () => {
    const out = runScreen(COMPANIES, screen([{ metric: 'revenue', op: '>=', value: 15e9 }]));
    expect(tickers(out.results)).toEqual(['DPST', 'UTLY']);
  });

  it('all filters must pass (AND)', () => {
    const out = runScreen(COMPANIES, screen([
      { metric: 'pe', op: '<', value: 18 },
      { metric: 'roic', op: '>', value: 0.2 },
    ]));
    expect(tickers(out.results)).toEqual(['NEGQ', 'TWN1', 'TWN2']);
  });

  it('empty filter list matches everyone in input order', () => {
    const out = runScreen(COMPANIES, screen([]));
    expect(tickers(out.results)).toEqual(COMPANIES.map((c) => c.ticker));
    expect(out.total).toBe(COMPANIES.length);
  });
});

describe('sorting', () => {
  const cs = [
    mk('N1', { pe: null }),
    mk('A', { pe: 20 }),
    mk('T1', { pe: 10 }),
    mk('N2', {}),
    mk('B', { pe: 5 }),
    mk('T2', { pe: 10 }),
    mk('T3', { pe: 10 }),
  ];

  it('asc with nulls last and ties kept in input order', () => {
    const out = runScreen(cs, screen([], { metric: 'pe', dir: 'asc' }));
    expect(tickers(out.results)).toEqual(['B', 'T1', 'T2', 'T3', 'A', 'N1', 'N2']);
  });

  it('desc still puts nulls last and keeps ties stable', () => {
    const out = runScreen(cs, screen([], { metric: 'pe', dir: 'desc' }));
    expect(tickers(out.results)).toEqual(['A', 'T1', 'T2', 'T3', 'B', 'N1', 'N2']);
  });

  it('stable for identical fixture twins in both directions', () => {
    for (const dir of ['asc', 'desc'] as const) {
      const out = runScreen(COMPANIES, screen([], { metric: 'roic', dir }));
      const t = tickers(out.results);
      expect(t.indexOf('TWN1')).toBe(t.indexOf('TWN2') - 1);
    }
    const reversed = [...COMPANIES].reverse();
    const t = tickers(runScreen(reversed, screen([], { metric: 'roic', dir: 'desc' })).results);
    expect(t.indexOf('TWN2')).toBe(t.indexOf('TWN1') - 1);
  });

  it('can sort by a metric that is not filtered on, and returns its value', () => {
    const out = runScreen(COMPANIES, screen([{ metric: 'roic', op: '>', value: 0.2 }], {
      metric: 'market_cap',
      dir: 'desc',
    }));
    const caps = out.results.map((r) => r.values.market_cap as number);
    expect([...caps].sort((a, b) => b - a)).toEqual(caps);
    expect(Object.keys(out.results[0]!.values)).toEqual(['roic', 'market_cap']);
  });
});

describe('purity and determinism', () => {
  it('does not mutate inputs and gives identical output on repeat runs', () => {
    const before = JSON.stringify(COMPANIES);
    const s = screen([{ metric: 'roic', op: '>', value: 0.1 }], { metric: 'pe', dir: 'asc' });
    const sBefore = JSON.stringify(s);
    const a = runScreen(COMPANIES, s);
    const b = runScreen(COMPANIES, s);
    expect(JSON.stringify(COMPANIES)).toBe(before);
    expect(JSON.stringify(s)).toBe(sBefore);
    expect(tickers(a.results)).toEqual(tickers(b.results));
    expect(a.results[0]!.matched).toBe(true);
    expect(a.results[0]!.company).toBe(COMPANIES.find((c) => c.ticker === a.results[0]!.company.ticker));
  });
});

describe('validation', () => {
  it('rejects malformed screens with helpful messages', () => {
    const bad = screen([
      { metric: 'peee' as never, op: '<', value: 1 },
      { metric: 'pe', op: 'between', value: [3, 1] },
      { metric: 'pe', op: 'between', value: 3 },
      { metric: 'pe', op: '<', value: [1, 2] },
      { metric: 'pe', op: '!=' as never, value: 1 },
      { metric: 'pe', op: '<', value: Number.NaN },
    ], { metric: 'nah', dir: 'asc' });
    const issues = validateScreen(bad);
    expect(issues).toHaveLength(7);
    expect(issues.join('\n')).toMatch(/Unknown metric "peee"/);
    expect(issues.join('\n')).toMatch(/low bound \(3\) above its high bound \(1\)/);
    expect(issues.join('\n')).toMatch(/Unknown sort metric "nah"/);
    expect(() => runScreen(COMPANIES, bad)).toThrow(ScreenError);
  });

  it('accepts a valid screen', () => {
    expect(validateScreen(screen([{ metric: 'pe', op: 'between', value: [1, 3] }]))).toEqual([]);
  });
});

describe('explainMatch', () => {
  const c: Company = mk('E', { roic: 0.31, pe: 18.24, debt_to_equity: 0.3, net_cash: -2e9 });

  it('renders value, requirement and a mark per filter', () => {
    const lines = explainMatch(c, screen([
      { metric: 'roic', op: '>', value: 0.15 },
      { metric: 'pe', op: '<', value: 15 },
      { metric: 'fcf_margin', op: '>', value: 0.2 },
      { metric: 'debt_to_equity', op: 'between', value: [0, 0.5] },
      { metric: 'net_cash', op: '>=', value: 0 },
    ]));
    expect(lines).toEqual([
      'ROIC 31% (needs > 15%) ✓',
      'P/E 18.2x (needs < 15x) ✗',
      'FCF margin — no data (needs > 20%) ✗',
      'Debt/Equity 0.30 (needs between 0.00 and 0.50) ✓',
      'Net cash -$2B (needs >= $0) ✗',
    ]);
  });

  it('works on fixture data for a matching company', () => {
    const lines = explainMatch(byTicker('QLTY'), screen([
      { metric: 'roic', op: '>', value: 0.15 },
      { metric: 'pe', op: '<', value: 25 },
    ]));
    expect(lines).toEqual(['ROIC 17% (needs > 15%) ✓', 'P/E 20x (needs < 25x) ✓']);
  });
});

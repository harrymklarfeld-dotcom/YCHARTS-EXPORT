import { describe, expect, it } from 'vitest';
import {
  parseQuery,
  QueryParseError,
  resolveMetric,
  runScreen,
  safeParseQuery,
  suggestMetric,
} from '../src/index.ts';
import { COMPANIES, tickers } from './helpers.ts';

describe('parseQuery — happy paths', () => {
  it('parses the canonical example', () => {
    expect(parseQuery('pe < 20 and roic > 0.15')).toEqual([
      { metric: 'pe', op: '<', value: 20 },
      { metric: 'roic', op: '>', value: 0.15 },
    ]);
  });

  it('accepts all symbol operators', () => {
    expect(parseQuery('pe >= 1, pe <= 2; pe = 3 && pe == 4 & pe ≥ 5 and pe ≤ 6')).toEqual([
      { metric: 'pe', op: '>=', value: 1 },
      { metric: 'pe', op: '<=', value: 2 },
      { metric: 'pe', op: '==', value: 3 },
      { metric: 'pe', op: '==', value: 4 },
      { metric: 'pe', op: '>=', value: 5 },
      { metric: 'pe', op: '<=', value: 6 },
    ]);
  });

  it('accepts word operators and filler', () => {
    expect(
      parseQuery(
        'P/E is under 18x and market cap over $10b and dividend yield at least 2% and debt/equity at most 1 and roe greater than 10% and ps less than or equal to 5',
      ),
    ).toEqual([
      { metric: 'pe', op: '<', value: 18 },
      { metric: 'market_cap', op: '>', value: 10e9 },
      { metric: 'dividend_yield', op: '>=', value: 0.02 },
      { metric: 'debt_to_equity', op: '<=', value: 1 },
      { metric: 'roe', op: '>', value: 0.1 },
      { metric: 'ps', op: '<=', value: 5 },
    ]);
  });

  it('parses between with and/to, inclusive bounds preserved', () => {
    expect(parseQuery('roe between 10% and 25% and pe between 5 to 15')).toEqual([
      { metric: 'roe', op: 'between', value: [0.1, 0.25] },
      { metric: 'pe', op: 'between', value: [5, 15] },
    ]);
  });

  it('understands aliases, labels and contract keys', () => {
    expect(resolveMetric('EV/EBITDA')).toBe('ev_ebitda');
    expect(resolveMetric('ev_ebitda')).toBe('ev_ebitda');
    expect(resolveMetric('Free cash flow margin')).toBe('fcf_margin');
    expect(resolveMetric('fcf margin')).toBe('fcf_margin');
    expect(resolveMetric('fcf')).toBe('free_cash_flow');
    expect(resolveMetric('3y revenue CAGR')).toBe('revenue_cagr_3y');
    expect(resolveMetric('Return on invested capital')).toBe('roic');
    expect(resolveMetric('d/e')).toBe('debt_to_equity');
    expect(resolveMetric('Net cash')).toBe('net_cash');
    expect(resolveMetric('nonsense')).toBeUndefined();
  });

  it('handles number formats', () => {
    expect(parseQuery('revenue > 1,000,000')[0]!.value).toBe(1e6);
    expect(parseQuery('revenue > 2.5m')[0]!.value).toBe(2.5e6);
    expect(parseQuery('revenue > 3 billion')[0]!.value).toBe(3e9);
    expect(parseQuery('market cap > 1.5T')[0]!.value).toBe(1.5e12);
    expect(parseQuery('net cash > -$1b')[0]!.value).toBe(-1e9);
    expect(parseQuery('net cash > $-2bn')[0]!.value).toBe(-2e9);
    expect(parseQuery('eps growth > .5')[0]!.value).toBe(0.5);
    expect(parseQuery('pe<20')).toEqual([{ metric: 'pe', op: '<', value: 20 }]);
  });

  it('reads bare numbers > 1 on percent metrics as percents, with a warning', () => {
    const r = safeParseQuery('roic > 15 and gross margin > 0.4');
    expect(r.ok).toBe(true);
    expect(r.filters).toEqual([
      { metric: 'roic', op: '>', value: 0.15 },
      { metric: 'gross_margin', op: '>', value: 0.4 },
    ]);
    expect(r.warnings).toHaveLength(1);
    expect(r.warnings[0]!.message).toMatch(/15%/);
  });

  it('swaps reversed between bounds with a warning', () => {
    const r = safeParseQuery('pe between 20 and 10');
    expect(r.filters).toEqual([{ metric: 'pe', op: 'between', value: [10, 20] }]);
    expect(r.warnings[0]!.message).toMatch(/Swapped/);
  });

  it('empty query is valid and yields no filters', () => {
    expect(parseQuery('')).toEqual([]);
    expect(parseQuery('   ')).toEqual([]);
  });

  it('parsed filters run end-to-end', () => {
    const out = runScreen(COMPANIES, {
      id: 'q',
      name: 'q',
      description: 'q',
      filters: parseQuery('fcf margin > 20% and p/e under 20'),
    });
    expect(tickers(out.results)).toEqual(['NEGQ', 'BNKY', 'TWN1', 'TWN2']);
  });
});

describe('parseQuery — helpful errors', () => {
  const errs = (q: string) => safeParseQuery(q).errors.map((e) => e.message);

  it('suggests a close metric for typos', () => {
    expect(errs('pee < 20')).toEqual(['Unknown metric "pee". Did you mean "pe" (Price-to-earnings)?']);
    expect(suggestMetric('roicc')).toBe('roic');
    expect(suggestMetric('zzzzzzzz')).toBeUndefined();
  });

  it('gives a hint when nothing is close', () => {
    expect(errs('flux capacitance > 3')[0]).toMatch(/Unknown metric "flux capacitance"\. Try names like/);
  });

  it('missing operator / value / metric', () => {
    expect(errs('pe 20')[0]).toMatch(/Expected a comparison like ">", "<" or "between" after "pe"/);
    expect(errs('pe <')[0]).toMatch(/Expected a number after "<" but found the end of the query/);
    expect(errs('< 20')[0]).toMatch(/Expected a metric name/);
    expect(errs('pe < cheap')[0]).toMatch(/Expected a number after "<" but found "cheap"/);
  });

  it('bad between', () => {
    expect(errs('pe between 5')[0]).toMatch(/"between" needs two numbers/);
    expect(errs('pe between 5 or 6')[0]).toMatch(/"between" needs two numbers/);
  });

  it('missing "and" between clauses', () => {
    expect(errs('pe < 20 roic > 0.1')[0]).toMatch(/Expected "and" between conditions but found "roic"/);
  });

  it('rejects or / != / unknown characters', () => {
    expect(errs('pe < 20 or roic > 1')[0]).toMatch(/Expected "and" between conditions but found "or"/);
    expect(errs('pe or roic > 1')[0]).toMatch(/Only "and" is supported/);
    expect(errs('pe != 3')[0]).toMatch(/"Not equal" is not supported/);
    expect(errs('pe < 20 (roic)')[0]).toMatch(/Unexpected character "\("/);
  });

  it('collects several errors with positions and returns no partial filters', () => {
    const r = safeParseQuery('pee < 20 and roic > 0.1 and marketcapp > 5');
    expect(r.ok).toBe(false);
    expect(r.filters).toEqual([]);
    expect(r.errors.map((e) => e.position)).toEqual([0, 28]);
  });

  it('parseQuery throws a QueryParseError carrying every issue', () => {
    try {
      parseQuery('pee < 20');
      expect.unreachable();
    } catch (e) {
      expect(e).toBeInstanceOf(QueryParseError);
      expect((e as QueryParseError).errors).toHaveLength(1);
      expect((e as QueryParseError).message).toMatch(/Did you mean "pe"/);
    }
  });
});

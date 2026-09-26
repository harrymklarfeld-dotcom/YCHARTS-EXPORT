import { bool, num, parseWidget, tickerList } from '../params';

describe('widget param parsing', () => {
  it('coerces primitive helpers', () => {
    expect(num('0.05')).toBe(0.05);
    expect(num(7)).toBe(7);
    expect(num('abc')).toBeUndefined();
    expect(num('')).toBeUndefined();
    expect(num(Infinity)).toBeUndefined();
    expect(bool('true')).toBe(true);
    expect(bool(false, true)).toBe(false);
    expect(bool(undefined, true)).toBe(true);
    expect(tickerList('cost, aapl,COST')).toEqual(['COST', 'AAPL']);
    expect(tickerList(['mu', 'msft'])).toEqual(['MU', 'MSFT']);
  });

  it('parses metric / compare / history / quiz', () => {
    expect(parseWidget('metric', { ticker: 'cost', metric: 'gross_margin' })).toEqual({ kind: 'metric', ticker: 'COST', metric: 'gross_margin', caption: undefined });
    expect(parseWidget('compare', { tickers: 'COST,AAPL,MSFT', metric: 'roic', caption: 'Hi' })).toEqual({ kind: 'compare', tickers: ['COST', 'AAPL', 'MSFT'], metric: 'roic', caption: 'Hi' });
    expect(parseWidget('history', { ticker: 'MU', metric: 'free_cash_flow', average: 'true' })).toMatchObject({ kind: 'history', average: true });
    expect(parseWidget('quiz', { lesson: 'u2-l1' })).toMatchObject({ kind: 'quiz', lesson: 'u2-l1' });
  });

  it('caps compare at 6 tickers and rejects fewer than 2', () => {
    const w = parseWidget('compare', { tickers: 'A,B,C,D,E,F,G', metric: 'pe' });
    expect(w.kind === 'compare' && w.tickers.length).toBe(6);
    expect(parseWidget('compare', { tickers: 'A', metric: 'pe' }).kind).toBe('unsupported');
  });

  it('parses calculators with defaults and clamps', () => {
    expect(parseWidget('calculator', { kind: 'pe', ticker: 'mu' })).toEqual({ kind: 'calc_pe', ticker: 'MU', price: undefined, eps: undefined, requiredReturn: 0.09, caption: undefined });
    const dcf = parseWidget('calculator', { kind: 'dcf', fcf: '1000', growth: 0.9, discount: '0.1', years: 5.4, cyclical: true });
    expect(dcf).toMatchObject({ kind: 'calc_dcf', fcf: 1000, growth: 0.4, discount: 0.1, terminal: 15, years: 5, cyclical: true });
    expect(parseWidget('calculator', { kind: 'liquidity' })).toEqual({ kind: 'calc_liquidity', cash: 3000, card: 1500, caption: undefined });
    expect(parseWidget('calculator', { kind: 'liquidity', cash: -5 })).toMatchObject({ cash: 0 });
  });

  it('degrades unknown / incomplete widgets to unsupported', () => {
    expect(parseWidget('sparkle', {})).toMatchObject({ kind: 'unsupported', original: 'sparkle' });
    expect(parseWidget('metric', { ticker: 'MU' }).kind).toBe('unsupported');
    expect(parseWidget('history', { ticker: 'MU', metric: 'roic' }).kind).toBe('unsupported');
    expect(parseWidget('calculator', { kind: 'npv' }).kind).toBe('unsupported');
    expect(parseWidget('calculator', { kind: 'pe', price: 10 }).kind).toBe('unsupported');
    expect(parseWidget('calculator', { kind: 'dcf' }).kind).toBe('unsupported');
    expect(parseWidget('quiz', null).kind).toBe('unsupported');
  });
});

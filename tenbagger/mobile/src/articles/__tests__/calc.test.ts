import { dcfCalc, dcfRanges, gradeLiquidity, liquidityCalc, liquidityRanges, niceStep, normalizedFcf, pct, peCalc, peRanges, snap } from '../calc';

describe('P/E calculator', () => {
  it('computes P/E, earnings yield and implied growth', () => {
    const r = peCalc(40, 2, 0.09);
    expect(r.pe).toBeCloseTo(20);
    expect(r.earningsYield).toBeCloseTo(0.05);
    expect(r.impliedGrowth).toBeCloseTo(0.04);
  });
  it('matches the curriculum example (P/E 30 at 9% → ~5.7% growth)', () => {
    expect(peCalc(30, 1, 0.09).impliedGrowth).toBeCloseTo(0.0567, 3);
  });
  it('P/E is null (n/m) for zero or negative EPS; bad price → all null', () => {
    expect(peCalc(10, 0).pe).toBeNull();
    expect(peCalc(10, -1).pe).toBeNull();
    expect(peCalc(10, -1).earningsYield).toBeCloseTo(-0.1);
    expect(peCalc(0, 1)).toEqual({ pe: null, earningsYield: null, impliedGrowth: null });
  });
});

describe('DCF calculator', () => {
  it('discounts N years plus a terminal multiple, adds net cash, divides by shares', () => {
    const r = dcfCalc({ fcf: 100, growth: 0, discount: 0.1, terminal: 10, years: 2, netCash: 50, shares: 10 });
    // years: 100/1.1 + 100/1.21 = 90.909 + 82.645
    expect(r.pvYears).toBeCloseTo(173.554, 3);
    // terminal: 100*10/1.21
    expect(r.pvTerminal).toBeCloseTo(826.446, 3);
    expect(r.equityValue).toBeCloseTo(1050, 6);
    expect(r.perShare).toBeCloseTo(105, 6);
    expect(r.terminalShare).toBeCloseTo(826.446 / 1000, 5);
    expect(r.rows).toHaveLength(2);
  });
  it('grows FCF before discounting', () => {
    const r = dcfCalc({ fcf: 100, growth: 0.1, discount: 0.1, terminal: 0, years: 3 });
    expect(r.pvYears).toBeCloseTo(300, 6); // (1.1/1.1)^t = 1 each year
    expect(r.perShare).toBeNull();
  });
  it('matches the illustrative article company (FCF $100M, 6%/9%/15×, 5y)', () => {
    const r = dcfCalc({ fcf: 100e6, growth: 0.06, discount: 0.09, terminal: 15, years: 5, netCash: 0, shares: 50e6 });
    expect(r.perShare!).toBeGreaterThan(34);
    expect(r.perShare!).toBeLessThan(36.5);
    expect(r.terminalShare!).toBeGreaterThan(0.7);
  });
  it('terminal share is null when value ≤ 0', () => {
    expect(dcfCalc({ fcf: -100, growth: 0, discount: 0.1, terminal: 10, years: 5 }).terminalShare).toBeNull();
  });
  it('normalized FCF is the mean of non-null history years', () => {
    expect(normalizedFcf([[2020, 10], [2021, null], [2022, -4], [2023, 12]])).toBeCloseTo(6);
    expect(normalizedFcf([])).toBeNull();
    expect(normalizedFcf(undefined)).toBeNull();
  });
});

describe('liquidity calculator', () => {
  it('ratio, grade bands and cushion (same bands as packages/money)', () => {
    expect(liquidityCalc(3000, 1500)).toEqual({ ratio: 2, grade: 'A', cushion: 1500 });
    expect(liquidityCalc(1600, 1000).grade).toBe('B');
    expect(liquidityCalc(1000, 1000).grade).toBe('C');
    expect(liquidityCalc(800, 1000).grade).toBe('D');
    expect(liquidityCalc(700, 1000).grade).toBe('F');
    expect(liquidityCalc(500, 0)).toEqual({ ratio: null, grade: 'A', cushion: 500 });
    expect(gradeLiquidity(1.4999)).toBe('C');
  });
  it('paying the card from cash raises the ratio only when cash > card', () => {
    expect(liquidityCalc(2500, 1000).ratio!).toBeGreaterThan(liquidityCalc(3000, 1500).ratio!);
    expect(liquidityCalc(500, 1500).ratio!).toBeLessThan(liquidityCalc(1000, 2000).ratio!);
  });
});

describe('slider ranges', () => {
  it('niceStep picks 1/2/2.5/5 × 10^k', () => {
    expect(niceStep(200)).toBe(1);
    expect(niceStep(1000)).toBe(5);
    expect(niceStep(450)).toBe(2.5);
    expect(niceStep(0)).toBe(1);
  });
  it('snap clamps, rounds to the grid and strips float noise', () => {
    const r = { min: 0.05, max: 0.15, step: 0.0025 };
    expect(snap(0.0913, r)).toBe(0.0925);
    expect(snap(1, r)).toBe(0.15);
    expect(snap(-1, r)).toBe(0.05);
  });
  it('dcf FCF range covers 3× the larger of FCF and normalized', () => {
    expect(dcfRanges(1e9, 3e9).fcf.max).toBe(9e9);
    expect(dcfRanges(-2e9, null).fcf.max).toBe(6e9);
  });
  it('pe and liquidity ranges contain their defaults', () => {
    const p = peRanges(1000.26, 7.59);
    expect(p.price.min).toBeLessThan(1000.26);
    expect(p.price.max).toBeGreaterThan(1000.26);
    expect(p.eps.min).toBeLessThan(0);
    expect(liquidityRanges(3000, 1500)).toEqual({ cash: { min: 0, max: 20000, step: 100 }, card: { min: 0, max: 10000, step: 50 } });
  });
  it('percent labels trim zeros', () => {
    expect(pct(0.09)).toBe('9%');
    expect(pct(0.0925)).toBe('9.25%');
    expect(pct(-0.015)).toBe('−1.5%');
  });
});

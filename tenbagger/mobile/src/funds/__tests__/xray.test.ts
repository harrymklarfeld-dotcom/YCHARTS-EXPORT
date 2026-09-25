import { getFunds } from '../data';
import { SAMPLE_PORTFOLIO } from '../samplePortfolio';
import type { Fund } from '../types';
import { fundOverlap, toWeights, xray, type CompanyLike } from '../xray';
import companiesJson from '../../../../data/companies.json';

const lt = { weighted_pe: null, weighted_fcf_yield: null, weighted_roic: null, coverage_pct: 0 };
const fund = (p: Partial<Fund> & Pick<Fund, 'ticker' | 'top_holdings'>): Fund => ({
  name: p.ticker, issuer: 'X', category: 'US Large Cap', expense_ratio: 0.001, total_net_assets: 1e9, as_of: '2025-06-30',
  holdings_count: 100, allocation: { stock: 1, bond: 0, cash: 0, commodity: 0, other: 0 }, sector_weights: {},
  look_through: lt, is_sample: true, sources: [], ...p,
});

const FUNDS: Fund[] = [
  fund({
    ticker: 'AAA',
    top_holdings: [
      { name: 'NVIDIA', ticker: 'NVDA', weight: 0.1 },
      { name: 'Apple', ticker: 'AAPL', weight: 0.05 },
      { name: 'Zeta Corp', ticker: null, weight: 0.05 },
    ],
    allocation: { stock: 0.98, bond: 0, cash: 0.02, commodity: 0, other: 0 },
    sector_weights: { Technology: 0.15, Unclassified: 0.83 },
  }),
  fund({
    ticker: 'BBB',
    top_holdings: [
      { name: 'NVIDIA', ticker: 'NVDA', weight: 0.2 },
      { name: 'Apple', ticker: 'AAPL', weight: 0.1 },
    ],
    sector_weights: { Technology: 0.3, Unclassified: 0.7 },
  }),
  fund({
    ticker: 'GOLD', category: 'Gold',
    top_holdings: [{ name: 'Gold', ticker: null, weight: 1 }],
    allocation: { stock: 0, bond: 0, cash: 0, commodity: 1, other: 0 },
  }),
];

const COMPANIES: CompanyLike[] = [
  { ticker: 'NVDA', name: 'NVIDIA Corporation', sector: 'Technology', metrics: { earnings_yield: 0.02, roic: 0.8, fcf_yield: 0.01 } },
  { ticker: 'AAPL', name: 'Apple Inc.', sector: 'Technology', metrics: { earnings_yield: 0.04, roic: 0.5, fcf_yield: 0.03 } },
  { ticker: 'MU', name: 'Micron', sector: 'Technology', metrics: { earnings_yield: -0.01, pe: null, roic: 0.1, fcf_yield: 0 } },
];

const PORT = [
  { ticker: 'AAA', weight: 50 }, { ticker: 'BBB', weight: 20 }, { ticker: 'NVDA', weight: 10 },
  { ticker: 'MU', weight: 10 }, { ticker: 'GOLD', weight: 5 }, { ticker: 'CASH', weight: 5 },
];

describe('xray (hand-checked)', () => {
  const r = xray(PORT, FUNDS, COMPANIES);
  const by = Object.fromEntries(r.exposures.map((e) => [e.key, e]));

  it('adds direct + look-through exposure per company', () => {
    // NVDA: 10% direct + 50%×10% via AAA + 20%×20% via BBB = 19%
    expect(by.NVDA.direct).toBeCloseTo(0.1);
    expect(by.NVDA.via).toEqual([{ fund: 'AAA', weight: expect.closeTo(0.05) }, { fund: 'BBB', weight: expect.closeTo(0.04) }]);
    expect(by.NVDA.total).toBeCloseTo(0.19);
    expect(by.AAPL.total).toBeCloseTo(0.045); // 2.5% + 2%
    expect(by['name:ZETA CORP'].total).toBeCloseTo(0.025);
    expect(by['name:GOLD'].total).toBeCloseTo(0.05);
    expect(r.exposures.map((e) => e.key)).toEqual(['NVDA', 'MU', 'name:GOLD', 'AAPL', 'name:ZETA CORP']);
  });

  it('reports the unseen part of funds', () => {
    // AAA 50%×(1−20%) + BBB 20%×(1−30%) + GOLD 0 = 40% + 14%
    expect(r.unseenFundWeight).toBeCloseTo(0.54);
  });

  it('asset mix and sector mix each sum to 100%', () => {
    expect(r.assetMix.stock).toBeCloseTo(0.89);
    expect(r.assetMix.cash).toBeCloseTo(0.06);
    expect(r.assetMix.commodity).toBeCloseTo(0.05);
    const s = Object.fromEntries(r.sectors.map((x) => [x.sector, x.weight]));
    expect(s.Technology).toBeCloseTo(0.335); // 7.5 + 6 + 10 + 10
    expect(s.Unclassified).toBeCloseTo(0.555);
    expect(s.Cash).toBeCloseTo(0.06);
    expect(s.Gold).toBeCloseTo(0.05);
    expect(r.sectors.reduce((a, x) => a + x.weight, 0)).toBeCloseTo(1);
  });

  it('look-through P/E is harmonic over covered exposures', () => {
    // E/P = (.19×.02 + .10×−.01 + .045×.04)/.335 = .0046/.335 → P/E 72.83
    expect(r.lookThrough.pe).toBeCloseTo(0.335 / 0.0046, 3);
    expect(r.lookThrough.roic).toBeCloseTo(0.1845 / 0.335, 6);
    expect(r.lookThrough.fcfYield).toBeCloseTo(0.00325 / 0.335, 6);
    expect(r.lookThrough.coverage).toBeCloseTo(0.335);
  });

  it('warns about overlap, concentration and overlapping funds', () => {
    const kinds = r.warnings.map((w) => `${w.kind}:${w.tickers.join('+')}`);
    expect(kinds).toEqual(['overlap:NVDA', 'concentration:MU', 'fund_overlap:AAA+BBB']);
    expect(r.warnings[0].message).toBe('NVDA: 10.0% direct + 5.0% via AAA + 4.0% via BBB = 19.0% of your money.');
    expect(fundOverlap(FUNDS[0], FUNDS[1])).toBeCloseTo(0.15); // min(10,20) + min(5,10)
  });

  it('classifies positions', () => {
    expect(r.positions.map((p) => `${p.ticker}:${p.kind}`)).toEqual(['AAA:fund', 'BBB:fund', 'NVDA:stock', 'MU:stock', 'GOLD:fund', 'CASH:cash']);
  });
});

describe('toWeights', () => {
  it('accepts CONTRACT holdings (market_value) and merges accounts', () => {
    const w = toWeights([
      { ticker: 'mu', market_value: 300 },
      { ticker: 'MU', market_value: 100 },
      { ticker: 'VOO', market_value: 600 },
      { ticker: 'BAD', market_value: null },
      { ticker: '', market_value: 50 },
    ]);
    expect(w).toEqual([{ ticker: 'MU', name: undefined, weight: 0.4 }, { ticker: 'VOO', name: undefined, weight: 0.6 }]);
  });
  it('is null-safe', () => {
    expect(toWeights([])).toEqual([]);
    expect(xray([], [], []).exposures).toEqual([]);
    expect(xray([{ ticker: 'ZZZ', weight: 1 }], [], []).sectors).toEqual([{ sector: 'Unclassified', weight: 1 }]);
    expect(xray([{ ticker: 'X', weight: 1 }], [], []).lookThrough.pe).toBeNull();
  });
});

describe('bundled sample portfolio', () => {
  const r = xray(SAMPLE_PORTFOLIO, getFunds(), (companiesJson as { companies: CompanyLike[] }).companies);
  it('NVDA: 15% direct + 2.92% via VOO', () => {
    const nvda = r.exposures.find((e) => e.ticker === 'NVDA')!;
    expect(nvda.direct).toBeCloseTo(0.15);
    expect(nvda.via.find((v) => v.fund === 'VOO')!.weight).toBeCloseTo(0.4 * 0.073);
    expect(nvda.total).toBeCloseTo(0.1792);
    expect(r.exposures[0].ticker).toBe('NVDA');
  });
  it('mix sums to 100%', () => {
    const m = r.assetMix;
    expect(m.stock + m.bond + m.cash + m.commodity + m.other).toBeCloseTo(1);
    expect(m.commodity).toBeCloseTo(0.05);
  });
});

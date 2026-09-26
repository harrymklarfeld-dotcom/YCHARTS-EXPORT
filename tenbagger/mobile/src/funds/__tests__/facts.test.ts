import companiesJson from '../../../../data/companies.json';
import { getFund, getFunds, normalizeFunds } from '../data';
import { expensePercent, expenseSentence, holdingsSentence, lookThroughSentence, topShare, yearlyCost } from '../facts';
import { rangeFor } from '../range';

const companies = (companiesJson as { companies: { ticker: string; sector: string }[] }).companies;

describe('fund facts', () => {
  it('expense ratio in dollars', () => {
    expect(yearlyCost(0.0003)).toBeCloseTo(0.3);
    expect(expenseSentence(0.0003)).toBe('$0.30 per year on $1,000');
    expect(expenseSentence(0.006)).toBe('$6.00 per year on $1,000');
    expect(expenseSentence(0.02, 10000)).toBe('$200 per year on $10,000');
    expect(expenseSentence(null)).toBe('Fee not available yet');
    expect(expensePercent(0.0003)).toBe('0.03%');
  });
  it('holdings and look-through sentences are null-safe', () => {
    expect(holdingsSentence(505)).toBe('Owns 505 different investments');
    expect(holdingsSentence(null)).toMatch(/not available/);
    expect(lookThroughSentence({ look_through: { weighted_pe: null, weighted_roic: null, weighted_fcf_yield: null, coverage_pct: 0 } })).toMatch(/can’t/);
    expect(lookThroughSentence({ look_through: { weighted_pe: 22.4, weighted_roic: 0.184, weighted_fcf_yield: null, coverage_pct: 0.3 } })).toBe(
      'If this fund were one company, it would have a P/E of about 22 and a return on invested capital near 18%.',
    );
  });
});

describe('funds data', () => {
  it('loads bundled funds.json', () => {
    expect(getFunds().map((f) => f.ticker)).toEqual(['VOO', 'VTI', 'QQQ', 'SCHD', 'XLV', 'XLE', 'GLD', 'HACK']);
    const voo = getFund('voo')!;
    expect(voo.top_holdings[0].ticker).toBe('NVDA');
    expect(topShare(voo, 10)).toBeGreaterThan(0.3);
  });
  it('drops malformed entries', () => {
    const f = normalizeFunds({ funds: [null, { name: 'no ticker' }, { ticker: 'x', top_holdings: [{ weight: 1 }, { name: 'A', weight: 'bad' }], look_through: null }] });
    expect(f.funds).toHaveLength(1);
    expect(f.funds[0].ticker).toBe('X');
    expect(f.funds[0].top_holdings).toEqual([{ name: 'A', ticker: null, weight: null, mapped: false }]);
    expect(f.funds[0].look_through.weighted_pe).toBeNull();
    expect(normalizeFunds(undefined).funds).toEqual([]);
  });
});

describe('rangeFor', () => {
  it('places MU P/E within Technology peers (from compareToPeers)', () => {
    const r = rangeFor(companies, 'pe', 'MU', 'sector')!;
    expect(r.scope).toBe('sector');
    expect(r.peerCount).toBe(3); // AAPL, MSFT, NVDA
    expect(r.pctBelow).toBe(100);
    expect(r.max).toBeCloseTo(r.value);
    expect(r.position).toBe(1);
    expect(r.sentence).toBe('Highest P/E (131.8x) of the 4 Technology companies we cover.');
  });
  it('falls back to all companies when the sector is too small, and is null-safe', () => {
    const r = rangeFor(companies, 'pe', 'JPM', 'sector')!;
    expect(r.scope).toBe('all');
    expect(r.peerCount).toBe(11);
    expect(rangeFor(companies, 'roic', 'JPM')).toBeNull(); // JPM ROIC is null
    expect(rangeFor(companies, 'pe', 'NOPE')).toBeNull();
    expect(r.position).toBeGreaterThanOrEqual(0);
  });
});

import { describe, expect, it } from 'vitest';
import { compareToPeers, median, percentileRank, sectorMedian } from '../src/index.ts';
import { COMPANIES, mk } from './helpers.ts';

describe('median', () => {
  it('odd, even, empty and ignores junk', () => {
    expect(median([3, 1, 2])).toBe(2);
    expect(median([4, 1, 3, 2])).toBe(2.5);
    expect(median([])).toBeNull();
    expect(median([null, undefined, Number.NaN, 5])).toBe(5);
  });
});

describe('sectorMedian', () => {
  it('computes the median P/E of Technology in the fixture', () => {
    // CSHM 89.29, NEWC 37.5, TWN1 16.67, TWN2 16.67 -> (16.67 + 37.5) / 2
    const m = sectorMedian(COMPANIES, 'Technology', 'pe')!;
    expect(m).toBeCloseTo((16.666667 + 37.5) / 2, 4);
  });
  it('is case-insensitive and skips nulls', () => {
    expect(sectorMedian(COMPANIES, 'health care', 'revenue')).toBe(1e9);
    expect(sectorMedian(COMPANIES, 'Health Care', 'pe')).toBeNull(); // only BURN, loss-making
    expect(sectorMedian(COMPANIES, 'Nope', 'pe')).toBeNull();
  });
});

describe('percentileRank', () => {
  const cs = [
    mk('A', { pe: 10 }),
    mk('B', { pe: 20 }),
    mk('C', { pe: 30 }),
    mk('D', { pe: 40 }),
    mk('E', { pe: 50 }),
    mk('N', { pe: null }),
    mk('F', { pe: 60 }, { sector: 'Energy' }),
  ];

  it('is the % of other companies with a strictly lower value', () => {
    expect(percentileRank(cs, 'pe', 'A')).toBe(0);
    expect(percentileRank(cs, 'pe', 'C')).toBe(40); // 2 of 5 peers with data
    expect(percentileRank(cs, 'pe', 'F')).toBe(100);
  });

  it('restricts to the same sector', () => {
    expect(percentileRank(cs, 'pe', 'E', { sector: 'sector' })).toBe(100); // 4 of 4 tech peers
    expect(percentileRank(cs, 'pe', 'F', { sector: 'sector' })).toBeNull(); // no energy peers
    expect(percentileRank(cs, 'pe', 'A', { sector: 'Energy' })).toBe(0);
  });

  it('returns null for unknown tickers or null values', () => {
    expect(percentileRank(cs, 'pe', 'ZZZ')).toBeNull();
    expect(percentileRank(cs, 'pe', 'N')).toBeNull();
  });

  it('ticker lookup is case-insensitive', () => {
    expect(percentileRank(cs, 'pe', 'c')).toBe(40);
  });
});

describe('compareToPeers', () => {
  it('says "cheaper than" for valuation multiples', () => {
    const cs = [
      mk('A', { pe: 10 }),
      ...[20, 30, 40, 50, 60].map((pe, i) => mk(`P${i}`, { pe })),
    ];
    const r = compareToPeers(cs, 'pe', 'A', { sector: 'sector' })!;
    expect(r.pctAbove).toBe(100);
    expect(r.peerCount).toBe(5);
    expect(r.peerMedian).toBe(40);
    expect(r.sentence).toBe('By P/E (10x), cheaper than 100% of Technology companies.');
  });

  it('uses "higher than" for metrics where higher is better', () => {
    const r = compareToPeers(COMPANIES, 'roic', 'TWN1')!;
    // TWN1 ROIC 0.248: 8 of 9 peers are strictly lower; TWN2 ties and counts as neither.
    expect(r.pctBelow).toBe(88.9);
    expect(r.pctAbove).toBe(0);
    expect(r.sentence).toBe('ROIC of 25% is higher than 89% of companies.');
  });

  it('uses "lower than" for metrics where lower is better', () => {
    const r = compareToPeers(COMPANIES, 'debt_to_equity', 'BURN')!;
    expect(r.sentence).toMatch(/^Debt\/Equity of 0\.05 is lower than \d+% of companies\.$/);
  });
});

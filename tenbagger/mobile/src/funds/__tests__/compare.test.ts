import { buildSeries, domainOf, formatCompare, indexTo100, lastPoint, niceTicks, rawPoints, spreadLabels, yearsOf, yoy } from '../compare';

const pts = (xs: [number, number | null][]) => xs.map(([fy, value]) => ({ fy, value }));

describe('compare transforms', () => {
  it('rawPoints sorts, dedupes and nulls bad values', () => {
    expect(rawPoints([[2022, 5], [2020, 1], [2021, NaN as unknown as number], [2022, 6]])).toEqual(pts([[2020, 1], [2021, null], [2022, 6]]));
    expect(rawPoints(undefined)).toEqual([]);
  });

  it('indexTo100 rebases at the first positive value', () => {
    expect(indexTo100(pts([[2019, -5], [2020, 50], [2021, 75], [2022, null], [2023, 25]]))).toEqual(
      pts([[2019, null], [2020, 100], [2021, 150], [2022, null], [2023, 50]]),
    );
    expect(indexTo100(pts([[2020, -1], [2021, 0]]))).toEqual(pts([[2020, null], [2021, null]]));
  });

  it('yoy: % growth, null after ≤0 or gaps; margins in points', () => {
    const g = yoy(pts([[2019, 100], [2020, 120], [2021, -10], [2022, 30], [2024, 40]]), 'usd');
    expect(g.map((p) => p.value)).toEqual([null, expect.closeTo(0.2), expect.closeTo(-10 / 120 - 1), null, null]);
    const m = yoy(pts([[2020, 0.4], [2021, 0.45]]), 'ratio');
    expect(m[1].value).toBeCloseTo(0.05);
  });

  it('buildSeries caps at 3 companies and skips unknown tickers', () => {
    const cos = ['A', 'B', 'C', 'D'].map((t, i) => ({ ticker: t, history: { revenue: [[2020, 10 * (i + 1)], [2021, 20 * (i + 1)]] as [number, number][] } }));
    const s = buildSeries(cos, ['A', 'ZZ', 'B', 'C', 'D'], 'revenue', 'indexed');
    expect(s.map((x) => x.ticker)).toEqual(['A', 'B']);
    expect(buildSeries(cos, ['A', 'B', 'C', 'D'], 'revenue', 'raw')).toHaveLength(3);
    expect(s[1].points).toEqual(pts([[2020, 100], [2021, 200]]));
    expect(yearsOf(s)).toEqual([2020, 2021]);
    expect(lastPoint({ ticker: 'x', points: pts([[2020, 1], [2021, null]]) })).toEqual({ fy: 2020, value: 1 });
  });

  it('domain includes zero for raw/yoy, not for indexed', () => {
    const s = [{ ticker: 'A', points: pts([[2020, 100], [2021, 180]]) }];
    expect(domainOf(s, 'raw')).toEqual({ min: 0, max: 180 });
    expect(domainOf(s, 'indexed')).toEqual({ min: 100, max: 180 });
  });

  it('niceTicks', () => {
    expect(niceTicks(0, 180, 4)).toEqual([0, 50, 100, 150, 200]);
    expect(niceTicks(-0.3, 0.45, 4)).toEqual([-0.4, -0.2, 0, 0.2, 0.4, 0.6]);
    expect(niceTicks(5, 5)).toEqual([4.5, 4.75, 5, 5.25, 5.5]);
  });

  it('formatCompare', () => {
    expect(formatCompare(37.38e9, 'raw', 'usd')).toBe('$37.4B');
    expect(formatCompare(-2.5e9, 'raw', 'usd')).toBe('−$2.5B');
    expect(formatCompare(0.456, 'raw', 'ratio')).toBe('45.6%');
    expect(formatCompare(150, 'indexed', 'usd')).toBe('150');
    expect(formatCompare(0.25, 'yoy', 'usd')).toBe('+25%');
    expect(formatCompare(-0.021, 'yoy', 'ratio')).toBe('−2.1 pts');
    expect(formatCompare(null, 'raw', 'usd')).toBe('—');
  });

  it('spreadLabels keeps labels apart and in bounds', () => {
    expect(spreadLabels([50, 52, 200], 14, 0, 300)).toEqual([50, 64, 200]);
    expect(spreadLabels([295, 296], 14, 0, 300)).toEqual([286, 300]);
  });
});

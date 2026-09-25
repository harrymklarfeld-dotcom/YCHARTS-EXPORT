jest.mock('../../data/sources', () => ({
  rawCompanies: require('../../../assets/data/companies.sample.json'),
  rawLessons: require('../../../assets/data/lessons.sample.json'),
}));

import { getCompanies } from '../../data';
import { describeFilter, passesFilter, PRESET_SCREENS, runScreen, sortCompanies } from '../screener';
import { formatPercent, formatUsdCompact, sourceLabel } from '../format';
import { metricCue } from '../metricCatalog';

const companies = getCompanies();

describe('screener adapter', () => {
  it('filters with every op and never passes null metrics', () => {
    const f = companies.find((c) => c.ticker === 'F')!;
    expect(f.metrics.pe).toBeNull();
    expect(passesFilter(f, { metric: 'pe', op: '<', value: 1000 })).toBe(false);
    const cost = companies.find((c) => c.ticker === 'COST')!;
    expect(passesFilter(cost, { metric: 'gross_margin', op: 'between', value: [0.2, 0.1] })).toBe(true);
    expect(passesFilter(cost, { metric: 'revenue', op: '>', value: 1e11 })).toBe(true); // fundamentals key
    expect(passesFilter(cost, { metric: 'revenue', op: '==', value: cost.fundamentals.revenue! })).toBe(true);
  });

  it('runs presets and sorts nulls last', () => {
    for (const s of PRESET_SCREENS) expect(Array.isArray(runScreen(companies, s))).toBe(true);
    const low = runScreen(companies, PRESET_SCREENS.find((p) => p.id === 'quality-fair-price')!);
    expect(low.map((c) => c.ticker)).not.toContain('F');
    const byPe = sortCompanies(companies, 'pe', 'asc');
    expect(byPe[byPe.length - 1].ticker).toBe('F');
    for (let i = 1; i < byPe.length - 1; i++) expect(byPe[i].metrics.pe!).toBeGreaterThanOrEqual(byPe[i - 1].metrics.pe!);
  });

  it('describes filters in friendly units', () => {
    expect(describeFilter({ metric: 'gross_margin', op: '>=', value: 0.4 })).toBe('Gross mgn ≥ 40.0%');
    expect(describeFilter({ metric: 'pe', op: 'between', value: [0, 20] })).toBe('P/E 0.0×–20.0×');
  });
});

describe('format', () => {
  it('formats money, percents and sources', () => {
    expect(formatUsdCompact(254_000_000_000)).toBe('$254.0B');
    expect(formatUsdCompact(-2e9)).toBe('−$2.0B');
    expect(formatPercent(0.447)).toBe('44.7%');
    expect(formatPercent(null)).toBe('—');
    expect(sourceLabel({ ticker: 'COST', fy: 2025, formula: 'gross_profit / revenue' })).toBe('Source: COST FY2025 10-K · gross_profit / revenue');
  });
  it('cues', () => {
    expect(metricCue('gross_margin', 0.7)).toBe('strong');
    expect(metricCue('pe', 50)).toBe('caution');
    expect(metricCue('market_cap', 1e12)).toBe('none');
    expect(metricCue('pe', null)).toBe('none');
  });
});

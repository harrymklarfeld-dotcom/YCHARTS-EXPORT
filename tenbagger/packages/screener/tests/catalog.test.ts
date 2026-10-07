import { describe, expect, it } from 'vitest';
import { FUNDAMENTAL_KEYS, getMetricInfo, METRIC_CATALOG, METRIC_KEYS } from '../src/index.ts';
import { FIXTURE } from './helpers.ts';

// Keys copied from CONTRACT.md.
const CONTRACT_METRICS =
  'market_cap enterprise_value pe ps pb ev_ebitda fcf_yield earnings_yield dividend_yield gross_margin operating_margin net_margin fcf_margin roe roa roic debt_to_equity current_ratio net_cash revenue_growth_yoy eps_growth_yoy revenue_cagr_3y'.split(' ');
const CONTRACT_FUNDAMENTALS =
  'revenue cost_of_revenue gross_profit operating_income net_income eps_diluted shares_diluted operating_cash_flow capex free_cash_flow dividends_paid cash total_assets total_liabilities total_equity total_debt current_assets current_liabilities inventory d_and_a income_tax pretax_income'.split(' ');

describe('METRIC_CATALOG', () => {
  it('covers every contract metric and fundamental exactly once', () => {
    expect([...METRIC_KEYS]).toEqual(CONTRACT_METRICS);
    expect([...FUNDAMENTAL_KEYS]).toEqual(CONTRACT_FUNDAMENTALS);
    const keys = METRIC_CATALOG.map((m) => m.key);
    expect(new Set(keys).size).toBe(keys.length);
    expect(keys.sort()).toEqual([...CONTRACT_METRICS, ...CONTRACT_FUNDAMENTALS].sort());
  });

  it('matches the keys present in the fixture companies', () => {
    for (const c of FIXTURE.companies) {
      expect(Object.keys(c.metrics).sort()).toEqual([...CONTRACT_METRICS].sort());
      expect(Object.keys(c.fundamentals).sort()).toEqual([...CONTRACT_FUNDAMENTALS].sort());
    }
  });

  it('every entry is complete and beginner sized', () => {
    for (const m of METRIC_CATALOG) {
      expect(m.label.length, m.key).toBeGreaterThan(0);
      expect(m.shortLabel.length, m.key).toBeGreaterThan(0);
      expect(['percent', 'usd', 'multiple', 'ratio', 'count']).toContain(m.unit);
      expect([true, false, null]).toContain(m.higherIsBetter);
      expect(m.learnMoreLessonId).toBe(`metric:${m.key}`);
      // 1–2 sentences.
      const sentences = m.explainer.split(/(?<=[.!?])\s+/).filter(Boolean);
      expect(sentences.length, m.key).toBeGreaterThanOrEqual(1);
      expect(sentences.length, m.key).toBeLessThanOrEqual(2);
      expect(m.explainer.length, m.key).toBeLessThan(260);
      expect(typeof m.format(1)).toBe('string');
      expect(m.format(null)).toBe('—');
      if (m.source === 'metric') expect(m.formula, m.key).toBeTruthy();
    }
  });

  it('sensible units and directions for well-known metrics', () => {
    expect(getMetricInfo('pe')).toMatchObject({ unit: 'multiple', higherIsBetter: false, shortLabel: 'P/E' });
    expect(getMetricInfo('roic')).toMatchObject({ unit: 'percent', higherIsBetter: true });
    expect(getMetricInfo('market_cap')).toMatchObject({ unit: 'usd', higherIsBetter: null });
    expect(getMetricInfo('current_ratio')?.unit).toBe('ratio');
    expect(getMetricInfo('nope')).toBeUndefined();
  });

  it('is frozen', () => {
    expect(Object.isFrozen(METRIC_CATALOG)).toBe(true);
    expect(Object.isFrozen(METRIC_CATALOG[0])).toBe(true);
  });
});

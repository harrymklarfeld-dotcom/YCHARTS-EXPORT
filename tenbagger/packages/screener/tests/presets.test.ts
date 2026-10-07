import { describe, expect, it } from 'vitest';
import { explainMatch, getPresetScreen, PRESET_SCREENS, runScreen, validateScreen } from '../src/index.ts';
import { COMPANIES, tickers } from './helpers.ts';

// Expected results computed by hand from tests/fixtures/companies.json.
const EXPECTED: Record<string, { results: string[]; missing: string[] }> = {
  'cash-machines': { results: ['BNKY', 'CSHM', 'NEWC', 'TWN1', 'TWN2', 'NEGQ'], missing: [] },
  'quality-fair-price': { results: ['TWN1', 'TWN2', 'NEGQ', 'QLTY'], missing: [] },
  'fortress-balance-sheets': { results: ['CSHM', 'BURN', 'NEWC', 'TWN1', 'TWN2'], missing: [] },
  'dividend-payers': { results: ['UTLY', 'NEGQ', 'DPST', 'BNKY', 'QLTY', 'TWN1', 'TWN2'], missing: [] },
  'fast-growers': { results: ['BURN', 'CSHM'], missing: ['NEWC'] },
  'deep-value': { results: ['DPST'], missing: ['BURN'] },
  'profitable-and-growing': { results: ['CSHM', 'TWN1', 'TWN2'], missing: ['NEWC'] },
  'low-debt': { results: ['BURN', 'CSHM', 'NEWC', 'TWN1', 'TWN2', 'QLTY'], missing: [] },
  'pricing-power': { results: ['NEGQ', 'CSHM', 'TWN1', 'TWN2', 'NEWC'], missing: ['BNKY'] },
  'steady-compounders': { results: ['TWN1', 'TWN2', 'QLTY'], missing: ['NEWC'] },
};

describe('PRESET_SCREENS', () => {
  it('has 10 valid presets with unique ids', () => {
    expect(PRESET_SCREENS).toHaveLength(10);
    expect(new Set(PRESET_SCREENS.map((p) => p.id)).size).toBe(10);
    for (const p of PRESET_SCREENS) {
      expect(validateScreen(p), p.id).toEqual([]);
      expect(p.description.length, p.id).toBeGreaterThan(60);
      expect(p.caveat.length, p.id).toBeGreaterThan(30);
      expect(p.learnMoreLessonId).toBe(`preset:${p.id}`);
      expect(p.sort, p.id).toBeDefined();
    }
  });

  it('includes the required beginner screens', () => {
    const cash = getPresetScreen('cash-machines')!;
    expect(cash.filters).toEqual([{ metric: 'fcf_margin', op: '>', value: 0.2 }]);
    expect(getPresetScreen('quality-fair-price')!.filters).toEqual([
      { metric: 'roic', op: '>', value: 0.15 },
      { metric: 'pe', op: '<', value: 25 },
    ]);
    expect(getPresetScreen('fortress-balance-sheets')!.filters).toEqual([
      { metric: 'net_cash', op: '>', value: 0 },
      { metric: 'current_ratio', op: '>', value: 1.5 },
    ]);
    expect(getPresetScreen('fast-growers')!.filters).toEqual([
      { metric: 'revenue_cagr_3y', op: '>', value: 0.2 },
    ]);
    expect(getPresetScreen('deep-value')!.filters).toEqual([{ metric: 'ev_ebitda', op: '<', value: 8 }]);
    expect(getPresetScreen('nope')).toBeUndefined();
  });

  it.each(Object.entries(EXPECTED))('%s returns the expected fixture companies', (id, exp) => {
    const out = runScreen(COMPANIES, getPresetScreen(id)!);
    expect(tickers(out.results)).toEqual(exp.results);
    expect(out.missingData.map((m) => m.ticker)).toEqual(exp.missing);
    expect(out.excludedForMissingData).toBe(exp.missing.length);
  });

  it('every result explains itself with all ✓ marks', () => {
    for (const p of PRESET_SCREENS) {
      for (const r of runScreen(COMPANIES, p).results) {
        const lines = explainMatch(r.company, p);
        expect(lines).toHaveLength(p.filters.length);
        for (const l of lines) expect(l.endsWith('✓'), `${p.id} ${r.company.ticker}: ${l}`).toBe(true);
      }
    }
  });

  it('low-debt excludes negative-equity companies whose D/E looks tiny', () => {
    const out = runScreen(COMPANIES, getPresetScreen('low-debt')!);
    expect(tickers(out.results)).not.toContain('NEGQ');
  });

  it('presets are deeply frozen', () => {
    const p = PRESET_SCREENS[0]!;
    expect(Object.isFrozen(p)).toBe(true);
    expect(Object.isFrozen(p.filters)).toBe(true);
    expect(Object.isFrozen(p.filters[0])).toBe(true);
    expect(Object.isFrozen(getPresetScreen('low-debt')!.filters[0]!.value)).toBe(true);
  });
});

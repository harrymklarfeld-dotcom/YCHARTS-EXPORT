// These tests pin the bundled sample files so they stay stable when sources.ts
// points at the real pipeline output (covered in realData.test.ts).
jest.mock('../sources', () => ({
  rawCompanies: require('../../../assets/data/companies.sample.json'),
  rawLessons: require('../../../assets/data/lessons.sample.json'),
}));

import { getCompanies, getCompany, getLesson, getUnits, normalizeCompanies, normalizeLessons } from '..';

const KEY_METRICS = ['market_cap', 'pe', 'gross_margin', 'roic', 'revenue_cagr_3y'];

describe('data layer (bundled sample JSON)', () => {
  it('loads contract-shaped companies', () => {
    const cs = getCompanies();
    expect(cs.length).toBeGreaterThanOrEqual(8);
    for (const c of cs) {
      for (const k of KEY_METRICS) expect(k in c.metrics).toBe(true);
      for (const [, v] of Object.entries(c.metrics)) expect(v === null || Number.isFinite(v)).toBe(true);
      const rev = c.history.revenue ?? [];
      for (let i = 1; i < rev.length; i++) expect(rev[i][0]).toBeGreaterThan(rev[i - 1][0]);
      expect(rev.length).toBeLessThanOrEqual(10);
    }
    expect(getCompany('cost')?.ticker).toBe('COST');
  });

  it('sample metrics follow CONTRACT formulas', () => {
    for (const c of getCompanies()) {
      const f = c.fundamentals;
      expect(c.metrics.market_cap).toBeCloseTo(c.price! * f.shares_diluted!, -3);
      expect(c.metrics.gross_margin!).toBeCloseTo(f.gross_profit! / f.revenue!, 5);
      if (f.eps_diluted! > 0) expect(c.metrics.pe!).toBeCloseTo(c.price! / f.eps_diluted!, 1);
      else expect(c.metrics.pe).toBeNull();
      expect(f.free_cash_flow!).toBeCloseTo(f.operating_cash_flow! - f.capex!, -3);
    }
  });

  it('loads 2 units with all 5 question types', () => {
    const units = getUnits();
    expect(units.length).toBe(2);
    const types = new Set(units.flatMap((u) => u.lessons.flatMap((l) => l.questions.map((q) => q.type))));
    expect([...types].sort()).toEqual(['compare', 'multiple_choice', 'numeric', 'order', 'true_false']);
    expect(getLesson('u1-l1')?.unit.id).toBe('u1-margins');
  });

  it('every question source ticker exists', () => {
    for (const u of getUnits()) for (const l of u.lessons) for (const q of l.questions) {
      if (q.source) expect(getCompany(q.source.ticker)).toBeDefined();
    }
  });

  it('normalizers drop malformed entries instead of throwing', () => {
    expect(normalizeCompanies(null).companies).toEqual([]);
    expect(normalizeCompanies({ companies: [{ ticker: 1 }] }).companies).toEqual([]);
    const lf = normalizeLessons({
      units: [{ id: 'u', title: 't', summary: '', order: 1, lessons: [{ id: 'l', title: 'l', xp: 5, intro: '', questions: [{ id: 'q', type: 'multiple_choice', prompt: 'p', choices: ['a'], answer: 3, explanation: '' }] }] }],
    });
    expect(lf.units[0].lessons).toEqual([]);
  });
});

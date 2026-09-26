import { getCompanies, getCompany, getUnits } from '..';

// Runs against whatever sources.ts bundles — the real pipeline + lesson output.
describe('data layer (bundled pipeline output)', () => {
  it('loads every company with finite-or-null metrics', () => {
    const cs = getCompanies();
    expect(cs.length).toBeGreaterThanOrEqual(8);
    for (const c of cs) {
      for (const v of Object.values(c.metrics)) expect(v === null || Number.isFinite(v)).toBe(true);
      const f = c.fundamentals;
      if (c.metrics.gross_margin != null) {
        expect(c.metrics.gross_margin).toBeCloseTo(f.gross_profit! / f.revenue!, 5);
      }
      if (c.metrics.pe != null) expect(c.metrics.pe).toBeCloseTo(c.price! / f.eps_diluted!, 1);
    }
  });

  it('loads the generated curriculum and every question type', () => {
    const units = getUnits();
    expect(units.length).toBeGreaterThanOrEqual(8);
    const types = new Set(units.flatMap((u) => u.lessons.flatMap((l) => l.questions.map((q) => q.type))));
    expect([...types].sort()).toEqual(['compare', 'multiple_choice', 'numeric', 'order', 'true_false']);
  });

  it('every non-personalized question source ticker exists', () => {
    for (const u of getUnits()) for (const l of u.lessons) for (const q of l.questions) {
      const src = q.source as { ticker?: string; tickers?: string[] } | undefined;
      const tickers = src?.tickers ?? (src?.ticker ? [src.ticker] : []);
      for (const t of tickers) expect(getCompany(t)).toBeDefined();
    }
  });
});

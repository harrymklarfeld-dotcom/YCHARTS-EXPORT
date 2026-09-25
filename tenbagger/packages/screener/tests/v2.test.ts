import { describe, expect, it } from 'vitest';
import {
  concentration,
  funnel,
  getPresetScreen,
  PRESET_SCREENS,
  runScreen,
  SCORE_FAMILIES,
  scores,
  scoresByTicker,
  SECTOR_NOTES,
  GENERIC_SECTOR_NOTE,
  styleBox,
  styleBoxes,
  filterByStyle,
  sizeBucket,
  STYLE_BOX_CONFIG,
  toCsv,
  catalogCsvColumn,
  csvCell,
  ScreenError,
  type Company,
} from '../src/index.ts';
import { COMPANIES, byTicker, mk } from './helpers.ts';

describe('funnel', () => {
  it('counts survivors per filter, cumulatively and in order', () => {
    const screen = getPresetScreen('steady-compounders')!;
    const out = funnel(COMPANIES, screen);
    expect(out.start).toBe(COMPANIES.length);
    expect(out.steps).toHaveLength(screen.filters.length);
    let prev = out.start;
    for (const st of out.steps) {
      expect(st.before).toBe(prev);
      expect(st.after).toBeLessThanOrEqual(st.before);
      expect(st.removed).toBe(st.before - st.after);
      expect(st.removedForMissingData).toBeLessThanOrEqual(st.removed);
      prev = st.after;
    }
    expect(out.final).toBe(prev);
  });

  it('final count equals runScreen for every preset', () => {
    for (const p of PRESET_SCREENS) {
      expect(funnel(COMPANIES, p).final, p.id).toBe(runScreen(COMPANIES, p).results.length);
    }
  });

  it('identifies the filter that removed the most (first wins ties)', () => {
    const cs = [mk('A', { pe: 10, roic: 0.1 }), mk('B', { pe: 30, roic: 0.2 }), mk('C', { pe: 40, roic: 0.3 }), mk('D', { pe: null, roic: 0.3 })];
    const out = funnel(cs, [
      { metric: 'roic', op: '>', value: 0.15 },
      { metric: 'pe', op: '<', value: 35 },
    ]);
    expect(out.steps.map((s) => s.after)).toEqual([3, 1]);
    expect(out.biggestCut?.index).toBe(1);
    expect(out.steps[1]!.removedForMissingData).toBe(1);
    expect(out.steps[0]!.label).toBe('ROIC > 15%');
  });

  it('handles no filters and rejects malformed screens', () => {
    const out = funnel(COMPANIES, []);
    expect(out).toMatchObject({ start: COMPANIES.length, final: COMPANIES.length, biggestCut: null, steps: [] });
    expect(() => funnel(COMPANIES, [{ metric: 'nope' as never, op: '>', value: 1 }])).toThrow(ScreenError);
  });
});

describe('concentration', () => {
  const tech = (t: string) => mk(t, {}, { sector: 'Technology' });
  const bank = (t: string) => mk(t, {}, { sector: 'Financials' });

  it('reports the top sector share and flags > 60%', () => {
    const out = concentration([bank('A'), bank('B'), bank('C'), tech('D')]);
    expect(out.top).toEqual({ sector: 'Financials', count: 3, share: 0.75 });
    expect(out.isConcentrated).toBe(true);
    expect(out.note?.lessonId).toBe(SECTOR_NOTES.financials!.lessonId);
    expect(out.note?.text).toContain('75%');
    expect(out.note?.text).toMatch(/P\/E and P\/B work differently for lenders/);
  });

  it('is not concentrated at exactly 60% or with tiny result sets', () => {
    expect(concentration([bank('A'), bank('B'), bank('C'), tech('D'), tech('E')]).isConcentrated).toBe(false);
    expect(concentration([bank('A'), bank('B')]).isConcentrated).toBe(false);
    expect(concentration([]).top).toBeNull();
  });

  it('accepts runScreen results and falls back to a generic note', () => {
    const cs = ['A', 'B', 'C'].map((t) => ({ company: mk(t, {}, { sector: 'Aerospace' }) }));
    const out = concentration(cs);
    expect(out.note?.lessonId).toBe(GENERIC_SECTOR_NOTE.lessonId);
    expect(out.note?.text).toContain('Aerospace');
    expect(out.groups[0]!.share).toBe(1);
  });

  it('every lesson id exists in data/lessons.json', async () => {
    const { readFile } = await import('node:fs/promises');
    const lessons = JSON.parse(await readFile(new URL('../../../data/lessons.json', import.meta.url), 'utf8')) as {
      units: Array<{ lessons: Array<{ id: string }> }>;
    };
    const ids = new Set(lessons.units.flatMap((u) => u.lessons.map((l) => l.id)));
    for (const n of [...Object.values(SECTOR_NOTES), GENERIC_SECTOR_NOTE]) expect(ids.has(n.lessonId), n.lessonId).toBe(true);
  });
});

describe('scores', () => {
  const all = scores(COMPANIES);

  it('is deterministic and keeps input order', () => {
    expect(scores(COMPANIES)).toEqual(all);
    expect(all.map((s) => s.ticker)).toEqual(COMPANIES.map((c) => c.ticker));
    expect(JSON.stringify(scores([...COMPANIES]))).toBe(JSON.stringify(all));
  });

  it('bounds every score and percentile to 0–100', () => {
    for (const s of all) {
      for (const f of SCORE_FAMILIES) {
        const fam = s[f.id];
        if (fam.score !== null) {
          expect(Number.isInteger(fam.score)).toBe(true);
          expect(fam.score).toBeGreaterThanOrEqual(0);
          expect(fam.score).toBeLessThanOrEqual(100);
        }
        for (const c of fam.components) {
          if (c.percentile !== null) {
            expect(c.percentile).toBeGreaterThanOrEqual(0);
            expect(c.percentile).toBeLessThanOrEqual(100);
          }
        }
      }
    }
  });

  it('returns components, formula and working, and the score is their average', () => {
    for (const s of all) {
      for (const f of SCORE_FAMILIES) {
        const fam = s[f.id];
        expect(fam.components.map((c) => c.id)).toEqual(f.components.map((c) => c.id));
        expect(fam.formula).toMatch(/average of the percentiles/);
        expect(fam.working.length).toBeGreaterThan(10);
        const ps = fam.components.map((c) => c.percentile).filter((p): p is number => p !== null);
        expect(fam.used).toBe(ps.length);
        if (fam.score !== null) expect(fam.score).toBe(Math.round(ps.reduce((a, b) => a + b, 0) / ps.length));
        else expect(ps.length).toBeLessThan(f.minComponents);
      }
    }
  });

  it('twins score identically; the best-in-list company gets 100 on that input', () => {
    const m = scoresByTicker(COMPANIES);
    expect(m.get('TWN1')!.quality).toEqual(m.get('TWN2')!.quality);
    // CSHM has the highest gross margin in the fixture.
    const gm = m.get('CSHM')!.quality.components.find((c) => c.id === 'gross_margin')!;
    expect(gm.percentile).toBe(100);
  });

  it('lower-is-better inputs flip, and negative D/E ranks as the most debt', () => {
    const cs = [mk('LOW', { debt_to_equity: 0.1 }), mk('HIGH', { debt_to_equity: 3 }), mk('NEG', { debt_to_equity: -2 })];
    const s = scoresByTicker(cs);
    const de = (t: string) => s.get(t)!.balance_sheet.components.find((c) => c.id === 'debt_to_equity')!.percentile;
    expect(de('LOW')).toBe(100);
    expect(de('HIGH')).toBe(50);
    expect(de('NEG')).toBe(0);
  });

  it('a lone company with data gets 50; no data → null with a reason', () => {
    const s = scores([mk('ONE', { roic: 0.2, gross_margin: 0.5 }), mk('NONE', {})]);
    expect(s[0]!.quality.score).toBe(50);
    expect(s[1]!.quality.score).toBeNull();
    expect(s[1]!.quality.working).toMatch(/Not enough data/);
  });

  it('value uses EBITDA/EV (inverse of EV/EBITDA) and skips non-positive multiples', () => {
    const s = scoresByTicker([mk('A', { ev_ebitda: 5 }), mk('B', { ev_ebitda: 20 }), mk('C', { ev_ebitda: null })]);
    const inv = (t: string) => s.get(t)!.value.components.find((c) => c.id === 'ebitda_to_ev')!;
    expect(inv('A').value).toBeCloseTo(0.2);
    expect(inv('A').percentile).toBe(100);
    expect(inv('B').percentile).toBe(0);
    expect(inv('C').percentile).toBeNull();
  });
});

describe('style box', () => {
  it('buckets size by configurable market-cap thresholds', () => {
    expect(sizeBucket(STYLE_BOX_CONFIG.largeMin)).toBe('Large');
    expect(sizeBucket(5e9)).toBe('Mid');
    expect(sizeBucket(1e9)).toBe('Small');
    expect(sizeBucket(null)).toBeNull();
    expect(sizeBucket(5e9, { ...STYLE_BOX_CONFIG, largeMin: 4e9 })).toBe('Large');
  });

  it('cheap + slow-growing is Value, pricey + fast-growing is Growth', () => {
    const u: Company[] = [
      mk('V', { market_cap: 50e9, pe: 8, pb: 1, revenue_cagr_3y: 0.01 }),
      mk('M', { market_cap: 5e9, pe: 18, pb: 3, revenue_cagr_3y: 0.08 }),
      mk('G', { market_cap: 1e9, pe: 60, pb: 12, revenue_cagr_3y: 0.4 }),
    ];
    expect(styleBox(u[0]!, u)).toMatchObject({ size: 'Large', style: 'Value', label: 'Large Value' });
    expect(styleBox(u[1]!, u)).toMatchObject({ size: 'Mid', style: 'Blend' });
    expect(styleBox(u[2]!, u)).toMatchObject({ size: 'Small', style: 'Growth' });
    expect(styleBox(u[2]!, u).explanation).toMatch(/Growth ≥ 67/);
  });

  it('works for loss-makers (no P/E) and returns null style with no inputs', () => {
    const burn = byTicker('BURN');
    expect(burn.metrics.pe).toBeNull();
    expect(styleBox(burn, COMPANIES).style).not.toBeNull();
    expect(styleBox(mk('X', { market_cap: 3e9 }), [mk('X', {})]).style).toBeNull();
  });

  it('styleBoxes matches styleBox and filterByStyle respects both axes', () => {
    const boxes = styleBoxes(COMPANIES);
    COMPANIES.forEach((c, i) => expect(boxes[i]).toEqual(styleBox(c, COMPANIES)));
    const large = filterByStyle(COMPANIES, { size: ['Large'] });
    expect(large.every((c) => styleBox(c, COMPANIES).size === 'Large')).toBe(true);
    const lv = filterByStyle(COMPANIES, { size: ['Large'], style: ['Value'] });
    expect(lv.every((c) => styleBox(c, COMPANIES).label === 'Large Value')).toBe(true);
    expect(filterByStyle(COMPANIES, {})).toHaveLength(COMPANIES.length);
  });
});

describe('csv export', () => {
  it('writes id columns + chosen raw values, escaping text', () => {
    const cs = [mk('AB', { pe: 12.5, roic: 0.2 }, { name: 'Acme, "Best" Inc.' }), mk('CD', { pe: null }, { name: '=HYPERLINK()' })];
    const csv = toCsv(cs, [catalogCsvColumn('pe'), catalogCsvColumn('roic')], { sourceNote: 'Source: SEC filings' });
    const lines = csv.trimEnd().split('\n');
    expect(lines[0]).toBe('Ticker,Name,Sector,Fiscal year,P/E (x),ROIC (decimal)');
    expect(lines[1]).toBe('AB,"Acme, ""Best"" Inc.",Technology,2025,12.5,0.2');
    expect(lines[2]).toBe("CD,'=HYPERLINK(),Technology,2025,,");
    expect(lines[3]).toBe('# Source: SEC filings');
    expect(csvCell(-5)).toBe('-5');
    expect(csvCell(Number.NaN)).toBe('');
  });
});

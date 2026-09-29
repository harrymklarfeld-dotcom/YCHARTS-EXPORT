import { describe, expect, it } from 'vitest';
import {
  bufferWeeks, buildLog, dtiBand, gradeDebt, gradeFromGpa, gradeIncome, gradeInvesting, gradeLiquidity, gradeNetWorth, RUBRIC, scorecard,
} from '../src/index.ts';
import { acct, DEPOSITS, LOG, snap, STREAMS } from './helpers.ts';

describe('scorecard — sample persona', () => {
  const sc = scorecard(LOG, STREAMS, DEPOSITS);
  it('grades every category with a reason', () => {
    expect(sc.asOf).toBe('2026-10-05');
    expect(sc.categories.map((c) => [c.id, c.grade])).toEqual([
      ['net_worth', 'A'],
      ['investing', 'A'],
      ['debt', 'D'],
      ['income', 'B'],
      ['liquidity', 'C'],
      ['spending', 'D'],
    ]);
    expect(sc.overall).toMatchObject({ grade: 'B', gpa: 2.5 });
    const by = Object.fromEntries(sc.categories.map((c) => [c.id, c]));
    expect(by.net_worth!.reason).toBe('Net worth is $3,030, up $360 since Aug 14.');
    expect(by.investing!.reason).toBe('70% of what you own is in investment accounts ($2,900).');
    expect(by.debt!.reason).toBe('You owe $1,120, about 1.7 months of your typical $670 monthly income. Minimum payments are 4% of monthly income (within the common 36% / 43% lines).');
    expect(by.income!.reason).toMatch(/fairly steady: \$531 to \$915 over the last 3 months \(variation 0\.26\)\. Some pay is PENDING until hours submitted\./);
    expect(by.liquidity!.reason).toBe('Cash ($1,250) covers short-term debt ($1,120) 1.12×, a thin cushion.');
    expect(by.spending!.reason).toBe('After the $750 payment on Sep 18, new charges brought the card back to $900 within 12 days: the paydown is being outrun. $1,120 of a $1,500 limit is 75% utilization (30% to 100%).');
    expect(sc.overall.reason).toMatch(/Strongest: Net worth, Investing\. Weakest: Debt, Spending\./);
  });
  it('labels every graded number honestly', () => {
    for (const c of sc.categories) expect(['verified', 'manual', 'projected', 'pending', 'estimate']).toContain(c.label);
    expect(sc.categories.find((c) => c.id === 'net_worth')!.label).toBe('manual');
  });
});

describe('grade boundaries (deterministic rubric)', () => {
  it('net worth', () => {
    expect(gradeNetWorth(1060, 1000)).toBe('A');
    expect(gradeNetWorth(1050, 1000)).toBe('B'); // exactly +5% is flat
    expect(gradeNetWorth(950, 1000)).toBe('B');
    expect(gradeNetWorth(949, 1000)).toBe('C');
    expect(gradeNetWorth(500, null)).toBe('B');
    expect(gradeNetWorth(-10, -5)).toBe('F');
    expect(gradeNetWorth(-10, -50)).toBe('D');
    expect(gradeNetWorth(-10, null)).toBe('D');
    expect(gradeNetWorth(100, 0)).toBe('A');
  });
  it('investing', () => {
    expect([0.5, 0.4999, 0.25, 0.2499, 0.1, 0.0999, 0.0001, 0].map((s) => gradeInvesting(s))).toEqual(['A', 'B', 'B', 'C', 'C', 'D', 'D', 'F']);
  });
  it('debt', () => {
    expect(gradeDebt(0, null)).toBe('A');
    expect(gradeDebt(100, null)).toBe('F');
    expect([0.5, 0.51, 1, 1.01, 2, 2.01].map((m) => gradeDebt(100, m))).toEqual(['B', 'C', 'C', 'D', 'D', 'F']);
  });
  it('income (with the pending cap)', () => {
    expect([0.15, 0.16, 0.3, 0.31, 0.5, 0.51, 0.75, 0.76].map((cv) => gradeIncome(cv, false))).toEqual(['A', 'B', 'B', 'C', 'C', 'D', 'D', 'F']);
    expect(gradeIncome(0.1, true)).toBe('B');
    expect(gradeIncome(0.6, true)).toBe('D');
  });
  it('liquidity', () => {
    expect([null, 2, 1.99, 1.5, 1.49, 1, 0.99, 0.75, 0.74].map(gradeLiquidity)).toEqual(['A', 'A', 'B', 'B', 'C', 'C', 'D', 'D', 'F']);
  });
  it('overall GPA', () => {
    expect([3.5, 3.49, 2.5, 2.49, 1.5, 1.49, 0.5, 0.49].map(gradeFromGpa)).toEqual(['A', 'B', 'B', 'C', 'C', 'D', 'D', 'F']);
  });
  it('rubric documents every category', () => {
    expect(Object.keys(RUBRIC).sort()).toEqual(['debt', 'income', 'investing', 'liquidity', 'net_worth', 'overall', 'spending']);
    for (const r of Object.values(RUBRIC)) expect(r.bands.length).toBeGreaterThanOrEqual(5);
  });
});

describe('scorecard — edge cases', () => {
  it('empty log', () => {
    expect(scorecard([], [], []).overall).toEqual({ grade: null, gpa: null, reason: 'Add a first snapshot to see a scorecard.' });
  });

  it('single snapshot: no trend, ungraded income/spending, says when the card exceeds cash', () => {
    const log = buildLog([snap('2026-10-05', [acct('chk', 'checking', 900), acct('c', 'credit_card', 1200)])]);
    const sc = scorecard(log, [], []);
    const by = Object.fromEntries(sc.categories.map((c) => [c.id, c]));
    expect(by.net_worth!.grade).toBe('D');
    expect(by.income!.grade).toBeNull();
    expect(by.income!.reason).toMatch(/Not enough history yet: 0 complete months/);
    expect(by.spending!.grade).toBeNull();
    expect(by.liquidity!.reason).toBe('The card balance ($1,200) exceeds your cash ($900): a ratio of 0.75.');
    expect(by.liquidity!.grade).toBe('D');
    expect(by.investing!.reason).toBe('Nothing is in an investment account yet.');
    expect(by.debt!.reason).toMatch(/no income on record/);
    // graded: net worth D(1), investing F(0), debt F(0), liquidity D(1) → 0.5 → D
    expect(sc.overall).toMatchObject({ grade: 'D', gpa: 0.5 });
  });

  it('spending: every paydown outrun → F; steady paydown → A; no card → ungraded', () => {
    const mk = (pts: [string, number][]) => buildLog(pts.map(([d, b]) => snap(d, [acct('chk', 'checking', 2000), acct('c', 'credit_card', b)])));
    const outrun = scorecard(mk([['2026-01-01', 1000], ['2026-01-03', 100], ['2026-01-10', 900], ['2026-01-12', 100], ['2026-01-20', 950]]), [], []);
    expect(outrun.categories.find((c) => c.id === 'spending')!.grade).toBe('F');
    const good = scorecard(mk([['2026-01-01', 1000], ['2026-02-01', 700], ['2026-03-01', 400]]), [], []);
    expect(good.categories.find((c) => c.id === 'spending')!.grade).toBe('A');
    const none = scorecard(buildLog([snap('2026-01-01', [acct('chk', 'checking', 10)])]), [], []);
    expect(none.categories.find((c) => c.id === 'spending')!.reason).toBe('No credit card in your snapshots.');
    expect(none.categories.find((c) => c.id === 'liquidity')!.grade).toBe('A');
  });
});

describe('evidence-based rules (SCORECARD_METRICS.md)', () => {
  it('income is capped at B until 4 months of history', () => {
    expect(gradeIncome(0.1, false, 2)).toBe('B');
    expect(gradeIncome(0.1, false, 3)).toBe('B');
    expect(gradeIncome(0.1, false, 4)).toBe('A');
    expect(gradeIncome(0.6, false, 2)).toBe('D');
  });
  it('an open investment account with a tiny balance is a start, not an F', () => {
    expect(gradeInvesting(0, true)).toBe('D');
    expect(gradeInvesting(0, false)).toBe('F');
  });
  it('buffer weeks use JPMCI bands', () => {
    expect(bufferWeeks(600, 100)).toEqual({ weeks: 6, band: 'strong' });
    expect(bufferWeeks(300, 100)).toEqual({ weeks: 3, band: 'building' });
    expect(bufferWeeks(299, 100).band).toBe('thin');
    expect(bufferWeeks(500, 0)).toEqual({ weeks: null, band: null });
  });
  it('DTI uses the CFPB 36% / 43% lines', () => {
    expect([0.36, 0.37, 0.43, 0.44].map(dtiBand)).toEqual(['healthy', 'caution', 'caution', 'high']);
  });
  it('deferred student loans are shown but not graded', () => {
    const loan = { ...acct('sl', 'loan', 20000), deferred: true };
    const log = buildLog([snap('2026-10-05', [acct('chk', 'checking', 900), acct('ira', 'retirement', 300), loan])]);
    const sc = scorecard(log, [], []);
    const by = Object.fromEntries(sc.categories.map((c) => [c.id, c]));
    expect(by.net_worth!.grade).toBe('B'); // graded as positive net worth (1,200), not -18,800
    expect(by.net_worth!.reason).toContain('Deferred student loans');
    expect(by.debt!.grade).toBe('A'); // no counted debt
  });
  it('irregular family help is left out of income grades', () => {
    const streams = [{ id: 'fam', name: 'Family help', kind: 'other', rate: 0, schedule: { unitsPerWeek: 0 }, payFrequency: 'monthly', nextPayDate: '2026-11-01', withholdingRate: 0, irregular: true }] as never;
    const deposits = [
      { date: '2026-06-10', amount: 1000, basis: 'verified' }, { date: '2026-07-10', amount: 1000, basis: 'verified' },
      { date: '2026-08-10', amount: 1000, basis: 'verified' }, { date: '2026-09-10', amount: 1000, basis: 'verified' },
      { date: '2026-07-20', amount: 900, streamId: 'fam', basis: 'verified' },
    ] as const;
    const log = buildLog([snap('2026-10-05', [acct('chk', 'checking', 900)])]);
    const inc = scorecard(log, streams, deposits).categories.find((c) => c.id === 'income')!;
    expect(inc.grade).toBe('A'); // steady 1,000/month once the one-off family help is excluded
  });
  it('spending shows utilization on the real limit when known', () => {
    const card = (bal: number) => ({ ...acct('c', 'credit_card', bal), creditLimit: 1500 });
    const log = buildLog([snap('2026-09-01', [acct('chk', 'checking', 900), card(600)]), snap('2026-10-01', [acct('chk', 'checking', 900), card(450)])]);
    const sp = scorecard(log, [], []).categories.find((c) => c.id === 'spending')!;
    expect(sp.reason).toContain('utilization');
  });
});

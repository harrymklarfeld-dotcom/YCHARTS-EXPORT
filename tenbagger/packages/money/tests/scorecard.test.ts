import { describe, expect, it } from 'vitest';
import {
  buildLog, gradeDebt, gradeFromGpa, gradeIncome, gradeInvesting, gradeLiquidity, gradeNetWorth, RUBRIC, scorecard,
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
    expect(by.debt!.reason).toBe('You owe $1,120, about 1.7 months of your typical $670 monthly income.');
    expect(by.income!.reason).toMatch(/fairly steady: \$531 to \$915 over the last 3 months \(variation 0\.26\)\. Some pay is PENDING until hours submitted\./);
    expect(by.liquidity!.reason).toBe('Cash ($1,250) covers short-term debt ($1,120) 1.12×, a thin cushion.');
    expect(by.spending!.reason).toBe('After the $750 payment on Sep 18, new charges brought the card back to $900 within 12 days: the paydown is being outrun.');
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
    expect([0.5, 0.4999, 0.25, 0.2499, 0.1, 0.0999, 0.0001, 0].map(gradeInvesting)).toEqual(['A', 'B', 'B', 'C', 'C', 'D', 'D', 'F']);
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

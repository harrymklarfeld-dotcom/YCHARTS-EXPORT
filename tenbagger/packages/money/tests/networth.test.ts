import { describe, expect, it } from 'vitest';
import { buildLog, cardTrend, debtToMonthlyIncome, incomeVolatility, monthlyIncome, monthlyTotals, netWorth } from '../src/index.ts';
import { acct, DEPOSITS, LATEST, LOG, snap, STREAMS } from './helpers.ts';

describe('netWorth breakdown — sample persona', () => {
  const b = netWorth(LATEST);
  it('splits liquidity, investments and debt', () => {
    expect(b.liquidity).toEqual({ value: 1250, label: 'verified' });
    expect(b.investments).toEqual({ value: 2900, label: 'manual' }); // Roth typed in by hand
    expect(b.debt).toEqual({ value: 1120, label: 'verified' });
    expect(b.net).toEqual({ value: 3030, label: 'manual' });
    expect(b.totalAssets.value).toBe(4150);
    expect(b.byKind).toMatchObject({ checking: 840, savings: 410, credit_card: 1120, brokerage: 2600, retirement: 300, crypto: 0, loan: 0 });
  });
  it('computes the personal current ratio, net cash and debt-to-net-worth', () => {
    expect(b.shortTermDebt.value).toBe(1120);
    expect(b.liquidityRatio).toEqual({ value: 1.12, label: 'verified' });
    expect(b.netCash.value).toBe(130);
    expect(b.debtToNetWorth.value).toBe(0.37);
  });
  it('loans count only the payment due toward short-term debt; nulls when not computable', () => {
    const s = snap('2026-10-05', [acct('chk', 'checking', 500), acct('ln', 'loan', 8000)], [{ accountId: 'ln', statementBalance: 120, minimumDue: 120, dueDate: '2026-10-20' }]);
    const x = netWorth(s);
    expect(x.shortTermDebt.value).toBe(120);
    expect(x.liquidityRatio.value).toBe(4.17);
    expect(x.net.value).toBe(-7500);
    expect(x.debtToNetWorth.value).toBeNull();
    expect(netWorth(snap('2026-10-05', [acct('chk', 'checking', 500)])).liquidityRatio.value).toBeNull();
  });
});

describe('income history', () => {
  it('monthly totals use complete months only, with $0 months filled in', () => {
    expect(monthlyTotals(DEPOSITS, '2026-10-05')).toEqual([
      { month: '2026-07', total: 915.15 },
      { month: '2026-08', total: 531.2 },
      { month: '2026-09', total: 563.4 },
    ]);
    const gap = [
      { date: '2026-01-10', amount: 100, basis: 'verified' as const },
      { date: '2026-03-10', amount: 300, basis: 'verified' as const },
      { date: '2026-03-20', amount: 999, basis: 'projected' as const },
    ];
    expect(monthlyTotals(gap).map((m) => m.total)).toEqual([100, 0, 300]);
  });
  it('coefficient of variation (population stdev / mean)', () => {
    const v = incomeVolatility(DEPOSITS, { asOf: '2026-10-05' });
    expect(v.mean).toBe(669.92);
    expect(v.cv).toBe(0.26);
    expect(v.label).toBe('verified');
    const flat = [1, 2, 3].map((m) => ({ date: `2026-0${m}-15`, amount: 500, basis: 'verified' as const }));
    expect(incomeVolatility(flat).cv).toBe(0);
    expect(incomeVolatility(flat.slice(0, 1)).cv).toBeNull();
  });
  it('monthly income prefers real history and falls back to a labelled ESTIMATE', () => {
    expect(monthlyIncome(DEPOSITS, STREAMS, '2026-10-05')).toEqual({ value: 669.92, label: 'verified' });
    expect(monthlyIncome([], STREAMS)).toEqual({ value: 898.08, label: 'estimate' });
    const r = debtToMonthlyIncome(netWorth(LATEST), { value: 669.92, label: 'verified' });
    expect(r.value).toBe(1.67);
    expect(debtToMonthlyIncome(netWorth(LATEST), { value: 0, label: 'estimate' }).value).toBeNull();
  });
});

describe('cardTrend — paydown outrun by new charges', () => {
  it('finds both payments in the persona log and the rebound after Sep 18', () => {
    const t = cardTrend(LOG);
    expect(t.accountId).toBe('card');
    expect(t.points.map((p) => p.balance)).toEqual([980, 250, 520, 1050, 300, 900, 1120]);
    expect(t.payments.map((p) => [p.date, p.paid, p.rebound?.date ?? null])).toEqual([
      ['2026-08-18', 730, null], // back to 520 after 14 days = 37% of the paydown: not a rebound
      ['2026-09-18', 750, '2026-09-30'], // back to 900 in 12 days = 80%
    ]);
    expect(t.payments[1]!.rebound).toEqual({ date: '2026-09-30', balance: 900, days: 12, share: 0.8 });
    expect(t.outrun).toBe(true);
    expect(t.change).toBe(140);
    expect(t.direction).toBe('up');
  });

  const mk = (pts: [string, number][]) => buildLog(pts.map(([d, bal]) => snap(d, [acct('c', 'credit_card', bal)])));

  it('respects the rebound window and share thresholds', () => {
    const log = mk([['2026-01-01', 1000], ['2026-01-02', 200], ['2026-01-17', 900]]); // 15 days later
    expect(cardTrend(log).outrun).toBe(false);
    expect(cardTrend(log, { reboundDays: 15 }).outrun).toBe(true);
    const half = mk([['2026-01-01', 1000], ['2026-01-02', 200], ['2026-01-10', 600]]); // exactly 50%
    expect(cardTrend(half).outrun).toBe(true);
    expect(cardTrend(half, { reboundShare: 0.6 }).outrun).toBe(false);
  });

  it('ignores small paydowns and reports direction', () => {
    const t = cardTrend(mk([['2026-01-01', 1000], ['2026-01-05', 980], ['2026-01-20', 1100]]));
    expect(t.payments).toHaveLength(0);
    expect(t.direction).toBe('up');
    expect(cardTrend(mk([['2026-01-01', 1000], ['2026-01-05', 1020]])).direction).toBe('flat');
    expect(cardTrend(mk([['2026-01-01', 1000], ['2026-02-05', 500]])).direction).toBe('down');
    expect(cardTrend(mk([['2026-01-01', 1000]])).direction).toBeNull();
    expect(cardTrend(buildLog([snap('2026-01-01', [acct('chk', 'checking', 1)])])).accountId).toBeNull();
  });
});

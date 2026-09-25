import { describe, expect, it } from 'vitest';
import {
  allocation,
  annualizedIncome,
  applyWorkLog,
  benchmarkComparison,
  buildLog,
  cardPayoffGoal,
  coverageCheck,
  dividendSummary,
  emergencyFundGoal,
  holdingsSummary,
  IRA_CONTRIBUTION_LIMITS,
  moneyAlerts,
  netWorthChange,
  netWorthSeries,
  pendingPayLedger,
  personal10K,
  rothTracker,
  type Holding,
  type Snapshot,
  type Transaction,
  type WorkEntry,
} from '../src/index.ts';
import { DEPOSITS, LATEST, PERSONA, STREAMS } from './helpers.ts';

const HISTORY = [...(PERSONA.monthEndSnapshots as unknown as Snapshot[]), ...(PERSONA.snapshots as unknown as Snapshot[])];
const TX = PERSONA.transactions as unknown as Transaction[];
const HOLDINGS = PERSONA.holdings as unknown as Holding[];

describe('enriched sample persona (fictional)', () => {
  it('has ~90 days of transactions and 6 months of snapshots, and history is append-only', () => {
    const dates = TX.map((t) => t.date).sort();
    expect(dates[0]).toBe('2026-07-07');
    expect(dates[dates.length - 1]).toBe('2026-10-05');
    expect(TX.length).toBeGreaterThan(120);
    expect(HISTORY[0]!.takenAt.slice(0, 7)).toBe('2026-04');
    expect(() => buildLog(HISTORY)).not.toThrow();
    expect(JSON.stringify(PERSONA)).not.toMatch(/\d{6,}|routing|acct#|account number/i);
  });
  it('holdings add up to the account balances in the latest snapshot', () => {
    for (const id of ['brk', 'roth']) {
      const sum = HOLDINGS.filter((h) => h.accountId === id).reduce((s, h) => s + h.shares * h.price, 0);
      expect(Math.round(sum * 100) / 100).toBe(LATEST.accounts.find((a) => a.id === id)!.balance);
    }
  });
  it('card transactions reconcile with card snapshots from July on', () => {
    const pts = HISTORY.map((s) => [s.takenAt.slice(0, 10), s.accounts.find((a) => a.id === 'card')!.balance] as const);
    for (let i = 1; i < pts.length; i++) {
      const [from, b0] = pts[i - 1]!;
      const [to, b1] = pts[i]!;
      if (from < '2026-07-31') continue;
      const net = TX.filter((t) => t.accountId === 'card' && t.date > from && t.date <= to).reduce((s, t) => s - t.amount, 0);
      expect(Math.round(net * 100) / 100, `${from}→${to}`).toBe(b1 - b0);
    }
  });
});

describe('netWorthSeries', () => {
  it('one labelled point per snapshot, oldest first', () => {
    const s = netWorthSeries(HISTORY);
    expect(s).toHaveLength(11);
    expect(s[0]).toMatchObject({ date: '2026-04-30', net: 1770, label: 'manual' });
    expect(s[s.length - 1]).toMatchObject({ date: '2026-10-05', net: 3030, liquidity: 1250, investments: 2900, debt: 1120 });
  });
  it('change since the previous snapshot', () => {
    const c = netWorthChange(netWorthSeries(HISTORY))!;
    expect(c).toMatchObject({ change: 140, days: 5 });
    expect(c.from.date).toBe('2026-09-30');
    expect(netWorthChange(netWorthSeries(HISTORY.slice(0, 1)))).toBeNull();
  });
});

describe('investments', () => {
  it('holdings table: value, weight, gain', () => {
    const h = holdingsSummary(HOLDINGS);
    expect(h.total).toBe(2900);
    const nvda = h.rows.find((r) => r.ticker === 'NVDA')!;
    expect(nvda).toMatchObject({ value: 546.3, gain: 126.3, gainPct: 0.3, weight: 0.19 });
    expect(h.rows[0]!.ticker).toBe('VOO');
    expect(h.cash).toBe(117.38);
    expect(h.label).toBe('manual'); // the Roth is typed in by hand
  });
  it('allocation by asset class', () => {
    expect(allocation(HOLDINGS).map((s) => s.key)).toEqual(['US stock index fund', 'Single stock', 'Gold', 'Sector fund', 'Cash']);
    expect(allocation(HOLDINGS, 'accountId').map((s) => [s.key, s.value])).toEqual([['brk', 2600], ['roth', 300]]);
  });
  it('benchmark comparison vs VOO is an ESTIMATE built from contributions', () => {
    const values = HISTORY.map((s) => ({ date: s.takenAt.slice(0, 10), value: s.accounts.filter((a) => a.kind === 'brokerage' || a.kind === 'retirement').reduce((t, a) => t + a.balance, 0) }));
    const b = benchmarkComparison(values, PERSONA.investmentContributions, PERSONA.benchmark.prices)!;
    expect(b.label).toBe('estimate');
    expect(b.contributed).toBe(600);
    expect(b.series[0]).toMatchObject({ actual: 2050, benchmark: 2050 });
    expect(b.series).toHaveLength(values.length);
    expect(b.actualGain).toBe(250);
    // Simple toy check: one contribution, price doubles.
    const toy = benchmarkComparison([{ date: '2026-01-01', value: 100 }, { date: '2026-03-01', value: 250 }], [{ date: '2026-02-01', amount: 100 }], [
      { date: '2026-01-01', price: 10 }, { date: '2026-02-01', price: 10 }, { date: '2026-03-01', price: 20 },
    ])!;
    expect(toy.series[1]).toMatchObject({ actual: 250, benchmark: 400, contributed: 100 });
    expect(benchmarkComparison(values.slice(0, 1), [], PERSONA.benchmark.prices)).toBeNull();
  });
  it('dividends and the Roth tracker (limit is a dated constant)', () => {
    const d = dividendSummary(PERSONA.dividends, '2026-10-05', 2900);
    expect(d.trailing12m).toBe(9.22);
    expect(d.byTicker[0]!.ticker).toBe('VOO');
    expect(IRA_CONTRIBUTION_LIMITS[2026]!.limit).toBe(7500);
    const r = rothTracker(PERSONA.rothContributions, 2026);
    expect(r).toMatchObject({ contributed: 300, limit: 7500, remaining: 7200, progress: 0.04 });
    expect(rothTracker(PERSONA.rothContributions, 2026, { earnedIncome: 5000 })).toMatchObject({ effectiveLimit: 5000, remaining: 4700 });
    expect(rothTracker([], 1999).limit).toBeNull();
  });
});

describe('income extras', () => {
  it('annualized income from the last 90 days is an ESTIMATE', () => {
    const a = annualizedIncome(DEPOSITS, '2026-10-05');
    expect(a.label).toBe('estimate');
    expect(a.windowTotal).toBe(2106.05);
    expect(a.value).toBe(8541.2);
  });
  it('pending-pay ledger and work log', () => {
    const log: WorkEntry[] = [
      { id: 'a', streamId: 'campus-job', date: '2026-10-02', units: 2 },
      { id: 'b', streamId: 'campus-job', date: '2026-10-05', units: 5 },
      { id: 'c', streamId: 'tutoring', date: '2026-10-05', units: 1 },
      { id: 'd', streamId: 'tutoring', date: '2026-10-04', units: 1, submitted: true },
    ];
    const l = pendingPayLedger(STREAMS, log);
    expect(l.map((x) => [x.streamId, x.units, x.gross])).toEqual([['campus-job', 26.5, 410.75], ['tutoring', 1, 30]]);
    expect(l[0]!.reminder).toMatch(/26.5 hours for Campus library job are not submitted yet/);
    // Only entries inside the already-pending period fold into the coverage check.
    const s2 = applyWorkLog(STREAMS, log);
    expect(s2[0]!.pendingUnsubmitted!.units).toBe(21.5);
    expect(s2[1]).toBe(STREAMS[1]);
    const before = coverageCheck(LATEST, STREAMS, 30).dues[0]!.pendingIncomeBefore;
    const after = coverageCheck(LATEST, s2, 30).dues[0]!.pendingIncomeBefore;
    expect(after - before).toBeCloseTo(2 * 15.5 * 0.95, 2);
  });
});

describe('goals', () => {
  it('emergency fund = N weeks of spending', () => {
    const g = emergencyFundGoal(8, 40, 410);
    expect(g).toMatchObject({ target: 2240, current: 410, progress: 0.18, remaining: 1830, label: 'estimate' });
  });
  it('card payoff progress', () => {
    const g = cardPayoffGoal(1120, 280, '2027-03-31', '2026-10-05', 120);
    expect(g).toMatchObject({ progress: 0.75, remaining: 280 });
  });
});

describe('personal10K', () => {
  const r = personal10K('2026-09', { snapshots: HISTORY, transactions: TX, deposits: DEPOSITS, streams: STREAMS, name: 'Alex', sample: true });
  it('income statement: income − spending = personal free cash flow', () => {
    expect(r.incomeStatement.income).toBe(563.4);
    expect(r.incomeStatement.freeCashFlow).toBe(Math.round((563.4 - r.incomeStatement.spending) * 100) / 100);
    expect(r.incomeStatement.incomeByStream.map((s) => s.streamId)).toEqual(['campus-job', 'tutoring']);
    expect(r.incomeStatement.moneyInvested).toBe(75);
  });
  it('balance sheet at month end, cash flow vs the prior snapshot', () => {
    expect(r.balanceSheet).toMatchObject({ asOf: '2026-09-30', cash: 910, investments: 2880, totalLiabilities: 900, netWorth: 2890 });
    expect(r.cashFlow).toMatchObject({ startCash: 770, endCash: 910, change: 140, cardPayments: 750, debtChange: 650 });
  });
  it('scorecard, company analogs with lessons, and a share text without account details', () => {
    expect(r.scorecard!.categories).toHaveLength(6);
    expect(r.analogs.map((a) => [a.id, a.lessonId])).toEqual([['current_ratio', 'u5-l4'], ['free_cash_flow', 'u4-l2'], ['debt_to_equity', 'u5-l3']]);
    expect(r.shareText).toMatch(/^Alex's Personal 10-K: Sep 2026 \(sample data, fictional\)/);
    expect(r.shareText).not.toMatch(/Checking|Savings|Brokerage|Roth|credit card|\d{4,}(?!\))/i);
  });
});

describe('alerts', () => {
  it('ranks pending pay first, then outrun paydowns and utilization', () => {
    const a = moneyAlerts({
      coverage: coverageCheck(LATEST, STREAMS, 30),
      pending: pendingPayLedger(STREAMS),
      utilization: { balance: 1120, limit: 1500, ratio: 0.75, band: null, at10: 150, at30: 450, sentence: 's' },
      rebounds: [{ date: '2026-09-18', paid: 750, chargesAfter: 600, share: 0.8, outrun: true, topMerchants: [] }],
      runwayDays: 31,
    });
    expect(a.map((x) => x.id)).toEqual(['pending-campus-job', 'rebound', 'utilization']);
  });
});

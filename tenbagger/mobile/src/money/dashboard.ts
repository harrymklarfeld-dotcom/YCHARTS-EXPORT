/**
 * Everything the tabbed Money dashboard shows, derived from one MoneyData + the user's local
 * edits (work log, goals, category overrides). Pure (no React), unit-tested in
 * __tests__/dashboard.test.ts. Nothing here awards XP.
 */
import {
  addDays,
  allocation,
  annualizedIncome,
  applyWorkLog,
  averageDailySpend,
  benchmarkComparison,
  buildLog,
  cardPayoffGoal,
  cardTrend,
  cashRunwayDays,
  categorizeAll,
  compareCategories,
  coverageCheck,
  dateOf,
  detectSubscriptions,
  diffDays,
  dividendSummary,
  emergencyFundGoal,
  holdingsSummary,
  incomeVolatility,
  interestAvoided,
  monthKey,
  moneyAlerts,
  netWorth,
  netWorthChange,
  netWorthSeries,
  paymentRebounds,
  pendingPayLedger,
  personal10K,
  prevMonth,
  projectIncome,
  requiredMonthlyPayment,
  rothTracker,
  savingsTargetGoal,
  spendingByCategory,
  spendingLeaks,
  spendingPace,
  statementCycle,
  utilization,
  type Account,
  type AllocationSlice,
  type BenchmarkComparison,
  type Breakdown,
  type CardTrend,
  type CategorizedTransaction,
  type CategoryChange,
  type CategorySpend,
  type CoverageReport,
  type DailySpend,
  type DividendSummary,
  type GoalProgress,
  type HoldingsSummary,
  type IncomeStream,
  type Leak,
  type Liability,
  type MoneyAlert,
  type NetWorthChange,
  type NetWorthPoint,
  type NumberLabel,
  type PaymentRebound,
  type PendingLine,
  type Personal10K,
  type RothTracker,
  type Snapshot,
  type SpendingPace,
  type StatementCycle,
  type Subscription,
  type Utilization,
  type Volatility,
  type WorkEntry,
} from './engine';
import type { MoneyData, MoneyGoals } from './hub';

export const DASH_TABS = ['overview', 'investments', 'bank', 'credit', 'income', 'spending', 'goals', 'report'] as const;
export type DashTab = (typeof DASH_TABS)[number];
export const TAB_TITLES: Record<DashTab, string> = {
  overview: 'Overview',
  investments: 'Investments',
  bank: 'Bank',
  credit: 'Credit',
  income: 'Income',
  spending: 'Spending',
  goals: 'Goals',
  report: 'Report',
};
export function isDashTab(x: unknown): x is DashTab {
  return typeof x === 'string' && (DASH_TABS as readonly string[]).includes(x);
}

export const DEFAULT_GOALS: MoneyGoals = { emergencyFundWeeks: 8, cardPayoffBy: '2027-03-31', rothTarget: 1000, rothYear: 2026 };

export type LocalMoneyState = {
  workLog: WorkEntry[];
  goals: Partial<MoneyGoals>;
  categoryOverrides: Record<string, string>;
};
export const EMPTY_LOCAL: LocalMoneyState = { workLog: [], goals: {}, categoryOverrides: {} };

export type TimelineEvent = { date: string; kind: 'pay' | 'due' | 'statement' | 'subscription'; label: string; amount: number; basis: NumberLabel };

export type Dashboard = {
  asOf: string;
  history: Snapshot[];
  latest: Snapshot;
  breakdown: Breakdown;
  series: NetWorthPoint[];
  change: NetWorthChange | null;
  freshness: { takenAt: string; daysOld: number; oldestAccount: Account | null };
  streams: IncomeStream[];
  coverage: CoverageReport;
  pending: PendingLine[];
  card: {
    account: Account | null;
    liability: Liability | null;
    apr: number | null;
    utilization: Utilization | null;
    cycle: StatementCycle | null;
    interestAvoided: ReturnType<typeof interestAvoided> | null;
    rebounds: PaymentRebound[];
    trend: CardTrend;
  };
  tx: CategorizedTransaction[];
  dailySpend: DailySpend;
  runwayDays: number | null;
  subscriptions: Subscription[];
  spendMonth: string;
  spend: CategorySpend;
  compare: CategoryChange[];
  leaks: Leak[];
  pace: SpendingPace;
  investments: {
    holdings: HoldingsSummary | null;
    allocation: AllocationSlice[];
    benchmark: BenchmarkComparison | null;
    dividends: DividendSummary | null;
    roth: RothTracker | null;
  };
  income: {
    annualized: ReturnType<typeof annualizedIncome>;
    volatility: Volatility;
    projectedRestOfMonth: number;
  };
  goals: { settings: MoneyGoals; items: GoalProgress[]; cardMonthly: number | null };
  reportMonths: string[];
  alerts: MoneyAlert[];
  events: TimelineEvent[];
};

function sum(accts: Account[]): number {
  return Math.round(accts.reduce((s, a) => s + a.balance, 0) * 100) / 100;
}

/** Months with a complete calendar month of transactions, newest first. */
export function completeMonths(tx: { date: string }[], asOf: string): string[] {
  if (!tx.length) return [];
  const first = tx.reduce((a, b) => (b.date < a.date ? b : a)).date;
  const out: string[] = [];
  for (let m = prevMonth(monthKey(asOf)); `${m}-01` >= first; m = prevMonth(m)) out.push(m);
  return out;
}

export function buildDashboard(data: MoneyData, local: LocalMoneyState = EMPTY_LOCAL): Dashboard {
  const history = [...(data.monthEndSnapshots ?? []), ...data.snapshots];
  const log = buildLog(history);
  const latest = log[log.length - 1]!;
  const asOf = data.asOf ?? dateOf(latest.takenAt);
  const breakdown = netWorth(latest);
  const series = netWorthSeries(history);
  const oldest = latest.accounts.reduce<Account | null>((o, a) => (!o || a.asOf < o.asOf ? a : o), null);

  const streams = applyWorkLog(data.streams, local.workLog);
  const coverage = coverageCheck(latest, streams, data.horizonDays);
  const pending = pendingPayLedger(data.streams, local.workLog);

  // Card
  const cardAcct = latest.accounts.find((a) => a.kind === 'credit_card') ?? null;
  const liability = cardAcct ? [...history].reverse().flatMap((s) => s.liabilities).find((l) => l.accountId === cardAcct.id) ?? null : null;
  const apr = liability?.apr ?? null;
  const overrides = local.categoryOverrides;
  const txRaw = data.transactions ?? [];
  const rebounds = cardAcct ? paymentRebounds(txRaw, cardAcct.id, { overrides }) : [];

  // Spending
  const tx = categorizeAll(txRaw, { overrides }).sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
  const dailySpend = averageDailySpend(txRaw, asOf, 30, { overrides });
  const runwayDays = cashRunwayDays(breakdown.liquidity.value, dailySpend.value);
  const subscriptions = detectSubscriptions(txRaw, { overrides });
  const months = completeMonths(txRaw, asOf);
  const spendMonth = months[0] ?? monthKey(asOf);
  const monthEnd = addDays(`${monthKey(addDays(`${monthKey(asOf)}-01`, 31))}-01`, -1);
  const projectedRest = projectIncome(streams, addDays(asOf, 1), monthEnd).reduce((s, d) => s + d.amount, 0);
  const pace = spendingPace(txRaw, asOf, { overrides, expectedIncomeRest: projectedRest });

  // Investments
  const holdings = data.holdings?.length ? holdingsSummary(data.holdings) : null;
  const invValues = history.map((s) => ({ date: dateOf(s.takenAt), value: sum(s.accounts.filter((a) => a.kind === 'brokerage' || a.kind === 'retirement' || a.kind === 'crypto')) }));
  const benchmark = data.benchmark ? benchmarkComparison(invValues, data.investmentContributions ?? [], data.benchmark.prices, data.benchmark.ticker) : null;

  // Goals
  const settings: MoneyGoals = { ...DEFAULT_GOALS, ...(data.goals ?? {}), ...local.goals };
  const savings = sum(latest.accounts.filter((a) => a.kind === 'savings'));
  const roth = sum(latest.accounts.filter((a) => a.kind === 'retirement'));
  const cardBal = cardAcct?.balance ?? 0;
  const monthsLeft = Math.max(1, Math.round(diffDays(asOf, settings.cardPayoffBy) / 30.44));
  const cardMonthly = cardAcct ? requiredMonthlyPayment(cardBal, apr ?? 0, monthsLeft) : null;
  const peak = Math.max(cardBal, ...series.map((p) => p.debt));
  const goals: GoalProgress[] = [
    emergencyFundGoal(settings.emergencyFundWeeks, dailySpend.value, savings),
    ...(cardAcct ? [cardPayoffGoal(peak, cardBal, settings.cardPayoffBy, asOf, cardMonthly ?? 0)] : []),
    savingsTargetGoal('roth', `Roth IRA ${formatK(settings.rothTarget)}`, settings.rothTarget, roth, `Roth IRA balance toward a ${formatK(settings.rothTarget)} target.`, 'manual'),
  ];

  const util = cardAcct ? utilization(cardBal, cardAcct.creditLimit) : null;
  const leaks = spendingLeaks(txRaw, spendMonth, { overrides });

  // Timeline: next pay, dues, statement closings and recurring charges after asOf.
  const events: TimelineEvent[] = [];
  for (const p of coverage.runway)
    for (const e of p.events) {
      if (p.date <= asOf) continue;
      events.push({ date: p.date, kind: e.kind === 'due' ? 'due' : 'pay', label: e.kind === 'due' ? e.label : `${e.label} pay`, amount: e.amount, basis: e.basis });
    }
  for (const s of subscriptions) if (s.nextExpected > asOf) events.push({ date: s.nextExpected, kind: 'subscription', label: s.name, amount: -s.lastAmount, basis: 'projected' });
  events.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));

  return {
    asOf,
    history,
    latest,
    breakdown,
    series,
    change: netWorthChange(series),
    freshness: { takenAt: latest.takenAt, daysOld: Math.max(0, diffDays(dateOf(latest.takenAt), asOf)), oldestAccount: oldest },
    streams,
    coverage,
    pending,
    card: {
      account: cardAcct,
      liability,
      apr,
      utilization: util,
      cycle: liability ? statementCycle(liability) : null,
      interestAvoided: liability && apr !== null ? interestAvoided(liability.statementBalance, apr) : null,
      rebounds,
      trend: cardTrend(log),
    },
    tx,
    dailySpend,
    runwayDays,
    subscriptions,
    spendMonth,
    spend: spendingByCategory(txRaw, spendMonth, { overrides }),
    compare: compareCategories(txRaw, spendMonth, { overrides }),
    leaks,
    pace,
    investments: {
      holdings,
      allocation: data.holdings?.length ? allocation(data.holdings) : [],
      benchmark,
      dividends: data.dividends ? dividendSummary(data.dividends, asOf, holdings?.total) : null,
      roth: data.rothContributions ? rothTracker(data.rothContributions, settings.rothYear) : null,
    },
    income: {
      annualized: annualizedIncome(data.deposits, asOf),
      volatility: incomeVolatility(data.deposits, { asOf }),
      projectedRestOfMonth: Math.round(projectedRest * 100) / 100,
    },
    goals: { settings, items: goals, cardMonthly },
    reportMonths: months,
    alerts: moneyAlerts({ coverage, utilization: util ?? undefined, pending, rebounds, leaks, runwayDays, subscriptions }),
    events,
  };
}

function formatK(n: number): string {
  return `$${Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`;
}

/** The Personal 10-K for a month (separate so the Report tab can switch months cheaply). */
export function reportFor(data: MoneyData, month: string, local: LocalMoneyState = EMPTY_LOCAL): Personal10K {
  return personal10K(month, {
    snapshots: [...(data.monthEndSnapshots ?? []), ...data.snapshots],
    transactions: data.transactions ?? [],
    deposits: data.deposits,
    streams: data.streams,
    overrides: local.categoryOverrides,
    name: data.persona.name,
    sample: data.sample,
  });
}

/** Tickers that have a company page in the bundled data. */
export function companyTickers(tickers: (string | null)[], known: (t: string) => boolean): Set<string> {
  return new Set(tickers.filter((t): t is string => !!t && known(t)));
}

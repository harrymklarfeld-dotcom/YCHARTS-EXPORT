/**
 * Where the money is: liquidity vs investments vs debt, plus the ratios a company analyst
 * would compute for a business, applied to a person.
 */
import { dateOf, diffDays, monthKey, parts, makeDate } from './dates.ts';
import { round2, weakestLabel } from './format.ts';
import { scheduledMonthlyIncome } from './income.ts';
import type { Account, AccountKind, IncomeDeposit, IncomeStream, ISODate, Labeled, NumberLabel, Snapshot, SnapshotLog } from './types.ts';

export const LIQUID_KINDS: readonly AccountKind[] = ['checking', 'savings'];
export const INVESTMENT_KINDS: readonly AccountKind[] = ['brokerage', 'retirement', 'crypto'];
export const DEBT_KINDS: readonly AccountKind[] = ['credit_card', 'loan'];

export type LabeledRatio = { value: number | null; label: NumberLabel };

export type Breakdown = {
  asOf: ISODate;
  /** Checking + savings (uses `available` when given). */
  liquidity: Labeled;
  /** Brokerage + retirement + crypto. */
  investments: Labeled;
  /** Everything owed (cards + loans). */
  debt: Labeled;
  /** liquidity + investments − debt. The personal "shareholders' equity". */
  net: Labeled;
  totalAssets: Labeled;
  /** Cards in full + loan payments currently due: the personal "current liabilities". */
  shortTermDebt: Labeled;
  /** liquidity / shortTermDebt — the personal analog of a company's current ratio. null when no short-term debt. */
  liquidityRatio: LabeledRatio;
  /** liquidity − debt — the personal analog of a company's net cash. */
  netCash: Labeled;
  /** debt / net — the personal analog of debt-to-equity. null when net ≤ 0. */
  debtToNetWorth: LabeledRatio;
  byKind: Record<AccountKind, number>;
};

function labelOf(accts: readonly Account[]): NumberLabel {
  return accts.length ? weakestLabel(accts.map((a) => a.basis)) : 'verified';
}

function sum(accts: readonly Account[], useAvailable = false): number {
  return round2(accts.reduce((t, a) => t + (useAvailable && a.available !== undefined ? a.available : a.balance), 0));
}

export function liquidCash(snapshot: Snapshot): Labeled {
  const accts = snapshot.accounts.filter((a) => LIQUID_KINDS.includes(a.kind));
  return { value: sum(accts, true), label: labelOf(accts) };
}

export function netWorth(snapshot: Snapshot): Breakdown {
  const A = snapshot.accounts;
  const liquid = A.filter((a) => LIQUID_KINDS.includes(a.kind));
  const inv = A.filter((a) => INVESTMENT_KINDS.includes(a.kind));
  const debts = A.filter((a) => DEBT_KINDS.includes(a.kind));
  const liquidity: Labeled = { value: sum(liquid, true), label: labelOf(liquid) };
  const investments: Labeled = { value: sum(inv), label: labelOf(inv) };
  const debt: Labeled = { value: sum(debts), label: labelOf(debts) };
  const allLabel = labelOf(A);
  const net: Labeled = { value: round2(liquidity.value + investments.value - debt.value), label: allLabel };
  const totalAssets: Labeled = { value: round2(liquidity.value + investments.value), label: labelOf([...liquid, ...inv]) };

  // Cards count in full; loans count only the payment currently due (their "current portion").
  let st = 0;
  const stAccts: Account[] = [];
  for (const a of debts) {
    stAccts.push(a);
    if (a.kind === 'credit_card') st += a.balance;
    else st += snapshot.liabilities.find((l) => l.accountId === a.id)?.minimumDue ?? 0;
  }
  const shortTermDebt: Labeled = { value: round2(st), label: labelOf(stAccts) };
  const ratioLabel = weakestLabel([liquidity.label, shortTermDebt.label]);
  const liquidityRatio: LabeledRatio = {
    value: shortTermDebt.value > 0 ? round2(liquidity.value / shortTermDebt.value) : null,
    label: ratioLabel,
  };
  const netCash: Labeled = { value: round2(liquidity.value - debt.value), label: weakestLabel([liquidity.label, debt.label]) };
  const debtToNetWorth: LabeledRatio = {
    value: net.value > 0 ? round2(debt.value / net.value) : null,
    label: allLabel,
  };
  const byKind = {
    checking: 0, savings: 0, brokerage: 0, retirement: 0, crypto: 0, credit_card: 0, loan: 0,
  } as Record<AccountKind, number>;
  for (const a of A) byKind[a.kind] = round2(byKind[a.kind] + a.balance);
  return {
    asOf: dateOf(snapshot.takenAt),
    liquidity, investments, debt, net, totalAssets, shortTermDebt, liquidityRatio, netCash, debtToNetWorth, byKind,
  };
}

// ---------------------------------------------------------------- income history

export type MonthTotal = { month: string; total: number };

export type Volatility = {
  /** Coefficient of variation of monthly deposit totals (stdev / mean). null with < 2 complete months. */
  cv: number | null;
  mean: number | null;
  stdev: number | null;
  months: MonthTotal[];
  label: NumberLabel;
};

function nextMonth(key: string): string {
  const { y, m } = parts(`${key}-01`);
  return m === 12 ? `${y + 1}-01` : makeDate(y, m + 1, 1).slice(0, 7);
}

/**
 * Monthly totals of past deposits, for complete calendar months only: every month from the
 * first deposit's month up to (not including) `asOf`'s month. Months with no deposit count as $0.
 * Projected/pending deposits are ignored — history only.
 */
export function monthlyTotals(deposits: readonly IncomeDeposit[], asOf?: ISODate): MonthTotal[] {
  const real = deposits.filter((d) => d.basis === 'verified' || d.basis === 'manual');
  if (!real.length) return [];
  const sorted = [...real].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  const first = monthKey(sorted[0]!.date);
  const endExclusive = asOf ? monthKey(asOf) : nextMonth(monthKey(sorted[sorted.length - 1]!.date));
  const totals = new Map<string, number>();
  for (const d of sorted) totals.set(monthKey(d.date), (totals.get(monthKey(d.date)) ?? 0) + d.amount);
  const out: MonthTotal[] = [];
  for (let k = first, guard = 0; k < endExclusive && guard < 1200; k = nextMonth(k), guard++) {
    out.push({ month: k, total: round2(totals.get(k) ?? 0) });
  }
  return out;
}

export function incomeVolatility(deposits: readonly IncomeDeposit[], opts: { asOf?: ISODate } = {}): Volatility {
  const months = monthlyTotals(deposits, opts.asOf);
  const label = weakestLabel(deposits.filter((d) => d.basis === 'verified' || d.basis === 'manual').map((d) => d.basis as NumberLabel));
  if (months.length < 2) return { cv: null, mean: null, stdev: null, months, label };
  const mean = months.reduce((t, m) => t + m.total, 0) / months.length;
  const variance = months.reduce((t, m) => t + (m.total - mean) ** 2, 0) / months.length;
  const stdev = Math.sqrt(variance);
  return { cv: mean > 0 ? round2(stdev / mean) : null, mean: round2(mean), stdev: round2(stdev), months, label };
}

/**
 * Typical monthly income: the average of complete months of real deposits when available
 * (labelled like the deposits), otherwise the regular schedule of the streams (an ESTIMATE).
 */
export function monthlyIncome(deposits: readonly IncomeDeposit[], streams: readonly IncomeStream[], asOf?: ISODate): Labeled {
  const v = incomeVolatility(deposits, asOf ? { asOf } : {});
  if (v.months.length >= 1) {
    const mean = v.months.reduce((t, m) => t + m.total, 0) / v.months.length;
    return { value: round2(mean), label: v.label };
  }
  return { value: scheduledMonthlyIncome(streams), label: 'estimate' };
}

/** Total debt ÷ typical monthly income ("how many months of income the debt equals"). */
export function debtToMonthlyIncome(b: Breakdown, income: Labeled): LabeledRatio {
  return {
    value: income.value > 0 ? round2(b.debt.value / income.value) : null,
    label: weakestLabel([b.debt.label, income.label]),
  };
}

// ---------------------------------------------------------------- card trend

export type CardPoint = { date: ISODate; takenAt: string; balance: number; label: NumberLabel };
export type CardPayment = {
  date: ISODate;
  before: number;
  after: number;
  paid: number;
  /** Set when new charges won back ≥ `reboundShare` of this paydown within `reboundDays`. */
  rebound: { date: ISODate; balance: number; days: number; share: number } | null;
};
export type CardTrend = {
  accountId: string | null;
  accountName: string | null;
  points: CardPoint[];
  payments: CardPayment[];
  /** First → last snapshot. null with < 2 points. */
  change: number | null;
  direction: 'up' | 'down' | 'flat' | null;
  /** True when at least one paydown was outrun by new charges. */
  outrun: boolean;
};

export type CardTrendOptions = { accountId?: string; reboundDays?: number; reboundShare?: number; minPaydown?: number };

/**
 * Card balance over the snapshot log, and "paydown being outrun" detection:
 * a payment is a drop of ≥ max(minPaydown, 10% of the prior balance) between consecutive
 * snapshots; it REBOUNDS when, within `reboundDays` (default 14) of the post-payment snapshot,
 * the balance climbs back by ≥ `reboundShare` (default 50%) of the amount paid.
 */
export function cardTrend(log: SnapshotLog, opts: CardTrendOptions = {}): CardTrend {
  const reboundDays = opts.reboundDays ?? 14;
  const reboundShare = opts.reboundShare ?? 0.5;
  const minPaydown = opts.minPaydown ?? 25;
  const last = log[log.length - 1];
  const id = opts.accountId ?? last?.accounts.find((a) => a.kind === 'credit_card')?.id ?? null;
  const empty: CardTrend = { accountId: id, accountName: null, points: [], payments: [], change: null, direction: null, outrun: false };
  if (!id) return empty;
  const points: CardPoint[] = [];
  let name: string | null = null;
  for (const s of log) {
    const a = s.accounts.find((x) => x.id === id);
    if (!a) continue;
    name = a.name;
    points.push({ date: dateOf(s.takenAt), takenAt: s.takenAt, balance: a.balance, label: a.basis });
  }
  const payments: CardPayment[] = [];
  for (let i = 1; i < points.length; i++) {
    const before = points[i - 1]!.balance;
    const after = points[i]!.balance;
    const paid = before - after;
    if (paid < Math.max(minPaydown, 0.1 * before)) continue;
    let rebound: CardPayment['rebound'] = null;
    for (let j = i + 1; j < points.length; j++) {
      const days = diffDays(points[i]!.date, points[j]!.date);
      if (days > reboundDays) break;
      const share = (points[j]!.balance - after) / paid;
      if (share >= reboundShare) {
        rebound = { date: points[j]!.date, balance: points[j]!.balance, days, share: round2(share) };
        break;
      }
    }
    payments.push({ date: points[i]!.date, before, after, paid: round2(paid), rebound });
  }
  let change: number | null = null;
  let direction: CardTrend['direction'] = null;
  if (points.length >= 2) {
    const f = points[0]!.balance;
    const l = points[points.length - 1]!.balance;
    change = round2(l - f);
    const rel = f > 0 ? change / f : l > 0 ? 1 : 0;
    direction = rel > 0.05 ? 'up' : rel < -0.05 ? 'down' : 'flat';
  }
  return { accountId: id, accountName: name, points, payments, change, direction, outrun: payments.some((p) => p.rebound !== null) };
}

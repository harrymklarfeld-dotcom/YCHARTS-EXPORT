/**
 * Envelopes (spending categories) with rollover, and plan-vs-actual variance once transactions
 * exist. Categorizing reuses the money package's rule-based categorizer; each envelope lists the
 * money categories it collects (`matches`).
 */
import {
  categorize,
  daysInMonth,
  formatUSD,
  isSpending,
  monthBounds,
  monthKey,
  parts,
  round2,
  toDayNumber,
  type CategorizeOptions,
  type IncomeDeposit,
  type ISODate,
  type NumberLabel,
  type Transaction,
} from './money.ts';
import type { BudgetProfile, SpendingCategory } from './types.ts';

export type EnvelopeStatus = 'on_track' | 'watch' | 'over';

export type Envelope = {
  id: string;
  title: string;
  kind: SpendingCategory['kind'];
  rollover: boolean;
  budget: number;
  /** Carried in from last month (+ leftover, − overspend). */
  carried: number;
  available: number;
  spent: number;
  /** available − spent (negative = over). */
  remaining: number;
  /** spent ÷ available, 0..1+ */
  progress: number;
  /** What "on pace" spending would be by `asOf`. */
  expectedByNow: number;
  status: EnvelopeStatus;
  label: NumberLabel;
  sentence: string;
};

/** Money categories that are bills, not envelopes (they live in the Bills list). */
export const BILL_CATEGORIES: readonly string[] = ['subscriptions', 'phone'];

/** Which envelope a transaction lands in (null = a bill, a transfer, or not spending). */
export function envelopeFor(p: Pick<BudgetProfile, 'categories'>, tx: Transaction, opts: CategorizeOptions = {}): string | null {
  if (!isSpending(tx, opts)) return null;
  const cat = categorize(tx, opts);
  const hit = p.categories.find((c) => (c.matches ?? [c.id]).includes(cat));
  if (hit) return hit.id;
  if (BILL_CATEGORIES.includes(cat)) return null;
  return p.categories.find((c) => c.id === 'other')?.id ?? null;
}

export function spentByEnvelope(p: Pick<BudgetProfile, 'categories'>, txs: readonly Transaction[], from: ISODate, to: ISODate, opts: CategorizeOptions = {}): Record<string, number> {
  const out: Record<string, number> = {};
  const f = toDayNumber(from);
  const t = toDayNumber(to);
  for (const tx of txs) {
    const n = toDayNumber(tx.date);
    if (n < f || n > t) continue;
    const id = envelopeFor(p, tx, opts);
    if (!id) continue;
    out[id] = round2((out[id] ?? 0) - tx.amount);
  }
  return out;
}

export type EnvelopeOptions = CategorizeOptions & {
  transactions?: readonly Transaction[];
  /** Day to measure pace against (default: last day of the month). */
  asOf?: ISODate;
  /** Carry-in per envelope id (from `nextCarry` of last month). */
  carried?: Readonly<Record<string, number>>;
  /** Manual spending entries per envelope (when nothing is linked). */
  manualSpent?: Readonly<Record<string, number>>;
};

/** Leftover rolls forward (overspend too), clamped to one month's budget either way. */
export function nextCarry(e: Pick<Envelope, 'rollover' | 'remaining' | 'budget'>): number {
  if (!e.rollover) return 0;
  return round2(Math.max(-e.budget, Math.min(e.budget, e.remaining)));
}

export function envelopes(p: Pick<BudgetProfile, 'categories'>, month: string, opts: EnvelopeOptions = {}): Envelope[] {
  const b = monthBounds(month);
  const asOf = opts.asOf && monthKey(opts.asOf) === month ? opts.asOf : b.end;
  const { y, m, d } = parts(asOf);
  const frac = d / daysInMonth(y, m);
  const spentTx = opts.transactions ? spentByEnvelope(p, opts.transactions, b.start, asOf, opts) : {};
  const label: NumberLabel = opts.transactions ? 'verified' : 'manual';
  return p.categories.map((c) => {
    const carried = round2(c.rollover ? (opts.carried?.[c.id] ?? 0) : 0);
    const budget = round2(Math.max(0, c.monthly));
    const available = round2(budget + carried);
    const spent = round2((spentTx[c.id] ?? 0) + (opts.manualSpent?.[c.id] ?? 0));
    const remaining = round2(available - spent);
    const expectedByNow = round2(Math.max(0, available) * frac);
    // Early in the month pace is noisy: only flag once more than half the envelope is gone.
    const status: EnvelopeStatus = remaining < 0 ? 'over' : spent > Math.max(expectedByNow * 1.15 + 5, available * 0.5) ? 'watch' : 'on_track';
    const sentence =
      status === 'over'
        ? `${c.title}: ${formatUSD(-remaining)} past the envelope. ${c.rollover ? 'It comes out of next month’s, no drama.' : 'Next month starts fresh.'}`
        : status === 'watch'
          ? `${c.title}: ${formatUSD(spent)} of ${formatUSD(available)} used, a bit ahead of pace.`
          : `${c.title}: ${formatUSD(remaining)} left of ${formatUSD(available)}.`;
    return { id: c.id, title: c.title, kind: c.kind, rollover: c.rollover, budget, carried, available, spent, remaining, progress: available > 0 ? round2(spent / available) : spent > 0 ? 1 : 0, expectedByNow, status, label, sentence };
  });
}

/** Envelopes month by month, carrying leftovers forward. Months must be consecutive, oldest first. */
export function envelopeHistory(p: Pick<BudgetProfile, 'categories'>, months: readonly string[], opts: EnvelopeOptions = {}): { month: string; envelopes: Envelope[] }[] {
  const out: { month: string; envelopes: Envelope[] }[] = [];
  let carried: Record<string, number> = { ...(opts.carried ?? {}) };
  for (const month of months) {
    const envs = envelopes(p, month, { ...opts, carried, ...(opts.asOf && monthKey(opts.asOf) === month ? { asOf: opts.asOf } : {}) });
    out.push({ month, envelopes: envs });
    carried = Object.fromEntries(envs.map((e) => [e.id, nextCarry(e)]));
  }
  return out;
}

export type VarianceRow = { id: string; title: string; planned: number; actual: number; diff: number; status: 'under' | 'on_plan' | 'over' };

export type VarianceReport = {
  month: string;
  rows: VarianceRow[];
  spentPlanned: number;
  spentActual: number;
  incomePlanned: number;
  incomeActual: number;
  label: NumberLabel;
  sentence: string;
};

/** Plan vs actual for a month (needs transactions; deposits optional). */
export function varianceReport(
  p: Pick<BudgetProfile, 'categories' | 'bills'>,
  month: string,
  opts: CategorizeOptions & { transactions: readonly Transaction[]; deposits?: readonly IncomeDeposit[]; incomePlanned?: number },
): VarianceReport {
  const b = monthBounds(month);
  const spent = spentByEnvelope(p, opts.transactions, b.start, b.end, opts);
  const rows: VarianceRow[] = p.categories.map((c) => row(c.id, c.title, c.monthly, spent[c.id] ?? 0));
  const billActual = opts.transactions
    .filter((t) => t.date >= b.start && t.date <= b.end && isSpending(t, opts) && BILL_CATEGORIES.includes(categorize(t, opts)))
    .reduce((s, t) => s - t.amount, 0);
  const billPlanned = p.bills.reduce((s, x) => s + x.amount, 0);
  if (billPlanned > 0 || billActual > 0) rows.push(row('bills', 'Bills & subscriptions', billPlanned, billActual));
  const spentPlanned = round2(rows.reduce((s, r) => s + r.planned, 0));
  const spentActual = round2(rows.reduce((s, r) => s + r.actual, 0));
  const incomeActual = round2((opts.deposits ?? []).filter((d) => monthKey(d.date) === month && (d.basis === 'verified' || d.basis === 'manual')).reduce((s, d) => s + d.amount, 0));
  const incomePlanned = round2(opts.incomePlanned ?? 0);
  const diff = round2(spentActual - spentPlanned);
  const sentence =
    diff > 0
      ? `${month}: spending came in ${formatUSD(diff)} above the plan (${formatUSD(spentActual)} vs ${formatUSD(spentPlanned)}).`
      : `${month}: spending came in ${formatUSD(-diff)} under the plan (${formatUSD(spentActual)} vs ${formatUSD(spentPlanned)}).`;
  return { month, rows, spentPlanned, spentActual, incomePlanned, incomeActual, label: 'verified', sentence };
}

function row(id: string, title: string, planned: number, actual: number): VarianceRow {
  const pl = round2(planned);
  const ac = round2(actual);
  const diff = round2(ac - pl);
  const status = diff > Math.max(5, pl * 0.1) ? 'over' : diff < -Math.max(5, pl * 0.1) ? 'under' : 'on_plan';
  return { id, title, planned: pl, actual: ac, diff, status };
}

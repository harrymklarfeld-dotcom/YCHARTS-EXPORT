/**
 * "Can I cover the card?" — the forward-looking cash-flow check.
 *
 *   cash now (checking + savings)
 * + income expected to land BEFORE the due date (projected + pending, each labelled)
 * − amounts due earlier in the window
 * − this statement (in full, and the minimum, computed separately)
 * = surplus or shortfall
 */
import { addDays, dateOf, diffDays, shortDate, toDayNumber } from './dates.ts';
import { formatUSD, formatPct, round2, weakestLabel } from './format.ts';
import { projectIncome } from './income.ts';
import { liquidCash } from './networth.ts';
import type { ExpectedDeposit, IncomeStream, ISODate, NumberLabel, Snapshot } from './types.ts';

export type Verdict = 'covered' | 'covered_minimum_only' | 'short';

export type EquationStep = {
  label: string;
  /** Signed contribution (+ adds to cash, − takes away). */
  amount: number;
  basis: NumberLabel;
  op: '+' | '−' | '=';
};

export type DueCheck = {
  accountId: string;
  accountName: string;
  dueDate: ISODate;
  daysAway: number;
  cashNow: number;
  cashLabel: NumberLabel;
  /** All income expected strictly before the due date (projected + pending). */
  expectedIncomeBefore: number;
  projectedIncomeBefore: number;
  pendingIncomeBefore: number;
  depositsBefore: ExpectedDeposit[];
  /** Amounts due earlier in the window (other cards/loans), in each scenario. */
  earlierDueFull: number;
  earlierDueMinimum: number;
  statementBalance: number;
  minimumDue: number;
  apr: number | null;
  /** Cash left after paying the statement in full (negative = shortfall). */
  afterPayInFull: number;
  /** Cash left after paying only the minimum (negative = shortfall). */
  afterMinimum: number;
  verdict: Verdict;
  /** Verdict if the PENDING money does not land (e.g. hours never submitted). */
  verdictWithoutPending: Verdict;
  sentence: string;
  /** The pay-in-full equation, one line per term, for step-by-step display. */
  steps: EquationStep[];
};

export type RunwayPoint = {
  date: ISODate;
  /** Projected cash if every statement in the window is paid in full on its due date. */
  payInFull: number;
  /** Projected cash if only minimums are paid. */
  payMinimum: number;
  /** Deposits and payments landing that day. */
  events: { kind: 'deposit' | 'due'; label: string; amount: number; basis: NumberLabel }[];
};

export type CoverageReport = {
  asOf: ISODate;
  horizonEnd: ISODate;
  cashNow: number;
  cashLabel: NumberLabel;
  deposits: ExpectedDeposit[];
  dues: DueCheck[];
  runway: RunwayPoint[];
  /** Lowest point of the pay-in-full runway. */
  lowPoint: { date: ISODate; cash: number } | null;
  /** Worst verdict across all due dates (covered when nothing is due). */
  verdict: Verdict;
  headline: string;
  /** Always-on caveats about what the check does and does not include. */
  assumptions: string[];
};

export type CoverageOptions = {
  /** Treat a paycheck landing ON the due date as available in time. Default false (safer). */
  countSameDayDeposits?: boolean;
  /** Assumed everyday spending per day (labelled ESTIMATE). Default 0. */
  dailySpend?: number;
};

const RANK: Record<Verdict, number> = { covered: 0, covered_minimum_only: 1, short: 2 };

function verdictFor(afterFull: number, afterMin: number): Verdict {
  if (afterFull >= 0) return 'covered';
  if (afterMin >= 0) return 'covered_minimum_only';
  return 'short';
}

function sentenceFor(d: Omit<DueCheck, 'sentence' | 'steps'>, conditions: string[]): string {
  const when = shortDate(d.dueDate);
  const pendingNote =
    d.pendingIncomeBefore > 0
      ? ` That counts ${formatUSD(d.pendingIncomeBefore)} of PENDING pay that only lands if ${conditions.length ? conditions.join(' and ') : 'the work is submitted'}.`
      : '';
  const withoutPending =
    d.pendingIncomeBefore > 0 && d.verdictWithoutPending !== d.verdict
      ? ` Without the pending pay, ${
          d.verdictWithoutPending === 'short'
            ? `you'd be ${formatUSD(-(d.afterMinimum - d.pendingIncomeBefore))} short even for the minimum.`
            : `you'd be ${formatUSD(-(d.afterPayInFull - d.pendingIncomeBefore))} short of the full balance.`
        }`
      : '';
  const cash = formatUSD(d.cashNow);
  const inc = formatUSD(d.expectedIncomeBefore);
  const earlier = d.earlierDueFull > 0 ? ` − ${formatUSD(d.earlierDueFull)} due earlier` : '';
  switch (d.verdict) {
    case 'covered':
      return `You're fine for ${when}: ${cash} cash + ${inc} expected before then${earlier} − ${formatUSD(d.statementBalance)} statement balance leaves ${formatUSD(d.afterPayInFull)}.${pendingNote}${withoutPending}`;
    case 'covered_minimum_only': {
      const interest = d.apr !== null ? ` The unpaid part would carry interest at ${formatPct(d.apr, 2)} APR.` : '';
      return `You can cover the ${formatUSD(d.minimumDue)} minimum by ${when}, but you'd be ${formatUSD(-d.afterPayInFull)} short of the full ${formatUSD(d.statementBalance)} statement balance.${interest}${pendingNote}${withoutPending}`;
    }
    case 'short':
      return `${formatUSD(-d.afterMinimum)} short by ${when}, even for the ${formatUSD(d.minimumDue)} minimum.${pendingNote}`;
  }
}

/**
 * Check every statement due within `horizonDays` of the snapshot date.
 *
 * - Cash now = checking + savings only (investments are not counted as spendable).
 * - Income counts from the day AFTER the snapshot (the snapshot already includes today's deposits)
 *   and strictly before each due date unless `countSameDayDeposits`.
 * - Due dates are handled in order; earlier dues reduce the cash left for later ones.
 * - Statements due before the snapshot date are ignored (assumed handled).
 */
export function coverageCheck(
  snapshot: Snapshot,
  streams: readonly IncomeStream[],
  horizonDays: number,
  opts: CoverageOptions = {},
): CoverageReport {
  const asOf = dateOf(snapshot.takenAt);
  const horizonEnd = addDays(asOf, Math.max(0, Math.floor(horizonDays)));
  const cash = liquidCash(snapshot);
  const dailySpend = Math.max(0, opts.dailySpend ?? 0);
  const deposits = projectIncome(streams, addDays(asOf, 1), horizonEnd);

  const dueItems = snapshot.liabilities
    .filter((l) => toDayNumber(l.dueDate) >= toDayNumber(asOf) && toDayNumber(l.dueDate) <= toDayNumber(horizonEnd))
    .sort((a, b) => (a.dueDate < b.dueDate ? -1 : a.dueDate > b.dueDate ? 1 : a.accountId.localeCompare(b.accountId)));

  const dues: DueCheck[] = [];
  let earlierFull = 0;
  let earlierMin = 0;
  for (const l of dueItems) {
    const acct = snapshot.accounts.find((a) => a.id === l.accountId);
    const cutoff = toDayNumber(l.dueDate) - (opts.countSameDayDeposits ? 0 : 1);
    const before = deposits.filter((d) => toDayNumber(d.date) <= cutoff);
    const projected = round2(before.filter((d) => d.basis === 'projected').reduce((t, d) => t + d.amount, 0));
    const pending = round2(before.filter((d) => d.basis === 'pending').reduce((t, d) => t + d.amount, 0));
    const expected = round2(projected + pending);
    const spend = round2(dailySpend * Math.max(0, diffDays(asOf, l.dueDate)));
    const afterFull = round2(cash.value + expected - earlierFull - l.statementBalance - spend);
    const afterMin = round2(cash.value + expected - earlierMin - l.minimumDue - spend);
    const verdict = verdictFor(afterFull, afterMin);
    const verdictWithoutPending = verdictFor(afterFull - pending, afterMin - pending);
    const base = {
      accountId: l.accountId,
      accountName: acct?.name ?? l.accountId,
      dueDate: l.dueDate,
      daysAway: diffDays(asOf, l.dueDate),
      cashNow: cash.value,
      cashLabel: cash.label,
      expectedIncomeBefore: expected,
      projectedIncomeBefore: projected,
      pendingIncomeBefore: pending,
      depositsBefore: before,
      earlierDueFull: round2(earlierFull),
      earlierDueMinimum: round2(earlierMin),
      statementBalance: l.statementBalance,
      minimumDue: l.minimumDue,
      apr: l.apr ?? null,
      afterPayInFull: afterFull,
      afterMinimum: afterMin,
      verdict,
      verdictWithoutPending,
    };
    const steps: EquationStep[] = [{ label: 'Cash now (checking + savings)', amount: cash.value, basis: cash.label, op: '+' }];
    if (projected > 0) steps.push({ label: `Pay expected before ${shortDate(l.dueDate)}`, amount: projected, basis: 'projected', op: '+' });
    if (pending > 0) steps.push({ label: 'Pending pay (only if submitted)', amount: pending, basis: 'pending', op: '+' });
    if (earlierFull > 0) steps.push({ label: 'Due earlier in this window', amount: -round2(earlierFull), basis: 'verified', op: '−' });
    if (spend > 0) steps.push({ label: 'Everyday spending (assumed)', amount: -spend, basis: 'estimate', op: '−' });
    steps.push({ label: `${base.accountName} statement balance`, amount: -l.statementBalance, basis: acct?.basis ?? 'manual', op: '−' });
    steps.push({ label: afterFull >= 0 ? 'Left over' : 'Short', amount: afterFull, basis: weakestLabel(steps.map((s) => s.basis)), op: '=' });
    const conditions = [...new Set(before.filter((d) => d.basis === 'pending').map((d) => streams.find((s) => s.id === d.streamId)?.condition).filter((c): c is string => !!c))];
    dues.push({ ...base, sentence: sentenceFor(base, conditions), steps });
    earlierFull += l.statementBalance;
    earlierMin += l.minimumDue;
  }

  // Daily runway series.
  const runway: RunwayPoint[] = [];
  let full = cash.value;
  let min = cash.value;
  const n = diffDays(asOf, horizonEnd);
  for (let i = 0; i <= n; i++) {
    const date = addDays(asOf, i);
    const events: RunwayPoint['events'] = [];
    if (i > 0) {
      full -= dailySpend;
      min -= dailySpend;
      for (const d of deposits) {
        if (d.date !== date) continue;
        full += d.amount;
        min += d.amount;
        events.push({ kind: 'deposit', label: d.streamName, amount: d.amount, basis: d.basis });
      }
    }
    for (const l of dueItems) {
      if (l.dueDate !== date) continue;
      full -= l.statementBalance;
      min -= l.minimumDue;
      const name = snapshot.accounts.find((a) => a.id === l.accountId)?.name ?? l.accountId;
      events.push({ kind: 'due', label: `${name} due`, amount: -l.statementBalance, basis: 'verified' });
    }
    runway.push({ date, payInFull: round2(full), payMinimum: round2(min), events });
  }
  let lowPoint: CoverageReport['lowPoint'] = null;
  for (const p of runway) if (!lowPoint || p.payInFull < lowPoint.cash) lowPoint = { date: p.date, cash: p.payInFull };

  const verdict = dues.reduce<Verdict>((w, d) => (RANK[d.verdict] > RANK[w] ? d.verdict : w), 'covered');
  const worst = dues.find((d) => d.verdict === verdict);
  const headline = !dues.length
    ? `Nothing is due in the next ${n} days.`
    : verdict === 'covered'
      ? `You're fine: every statement due by ${shortDate(dues[dues.length - 1]!.dueDate)} is covered in full.`
      : verdict === 'covered_minimum_only'
        ? `Minimums are covered, but you're ${formatUSD(-worst!.afterPayInFull)} short of paying ${worst!.accountName} in full by ${shortDate(worst!.dueDate)}.`
        : `${formatUSD(-worst!.afterMinimum)} short by ${shortDate(worst!.dueDate)}.`;

  const assumptions = [
    'Cash now counts checking and savings only; investments are not treated as spendable.',
    `Pay counts only if it lands ${opts.countSameDayDeposits ? 'on or before' : 'before'} the due date.`,
    dailySpend > 0
      ? `Everyday spending is an ESTIMATE of ${formatUSD(dailySpend)} per day.`
      : 'Everyday spending between now and the due date is not included.',
    'PROJECTED pay follows your usual schedule; PENDING pay depends on the work being submitted.',
  ];

  return { asOf, horizonEnd, cashNow: cash.value, cashLabel: cash.label, deposits, dues, runway, lowPoint, verdict, headline, assumptions };
}

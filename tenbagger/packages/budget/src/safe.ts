/**
 * "Safe to spend until payday" — the one hero number.
 *
 *   cash now (checking; savings is never counted)
 * − bills due on or before the next confirmed paycheck
 * − the card payment if it is due in that window
 * − automatic goal transfers in that window
 * − set-aside: later bills (within a month) that the paychecks before them can't fully cover
 * − your cushion (buffer)
 * = safe to spend
 *
 * The window ends at the next PROJECTED paycheck. Pending pay (hours not submitted yet) is never
 * counted and never ends the window; it is listed separately so the user sees what it would add.
 */
import { addDays, diffDays, formatUSD, round2, shortDate, weakestLabel, type ExpectedDeposit, type ISODate, type NumberLabel } from './money.ts';
import { fundObligations } from './allocate.ts';
import { billOccurrences, cardObligation, goalTransfers, sortObligations, type Obligation } from './obligations.ts';
import { projectedDeposits } from './income.ts';
import { bufferFor } from './setup.ts';
import type { BudgetProfile, MathLine } from './types.ts';

export type SafeStatus = 'comfortable' | 'tight' | 'short';

export type SafeToSpend = {
  asOf: ISODate;
  amount: number;
  /** amount ÷ days until payday (0 when short). */
  perDay: number;
  days: number;
  until: ISODate;
  nextPaycheck: ExpectedDeposit | null;
  /** Pending paychecks landing before `until` (NOT counted). */
  excludedPending: ExpectedDeposit[];
  obligations: Obligation[];
  /** Later obligations (after payday, within `lookaheadDays`) that need cash set aside now. */
  setAside: { obligation: Obligation; amount: number }[];
  reserve: number;
  cash: number;
  buffer: number;
  label: NumberLabel;
  status: SafeStatus;
  lines: MathLine[];
  headline: string;
  sentence: string;
  notes: string[];
};

export type SafeToSpendOptions = {
  /** Bill occurrences already paid, as `billId@YYYY-MM-DD`. */
  paid?: readonly string[];
  /** Window when no paycheck is expected (default 14 days). */
  fallbackDays?: number;
  /** Override cash (e.g. linked checking `available`) with its label. */
  cash?: { amount: number; label: NumberLabel };
  /** Below this per-day amount the status is `tight` (default $10/day). */
  tightPerDay?: number;
  /** How far past today later bills are checked for set-asides (default 31 days). */
  lookaheadDays?: number;
};

export function safeToSpend(p: BudgetProfile, asOf: ISODate, opts: SafeToSpendOptions = {}): SafeToSpend {
  const deposits = projectedDeposits(p, addDays(asOf, 1), addDays(asOf, 62));
  const next = deposits.find((d) => d.basis === 'projected') ?? null;
  const until = next ? next.date : addDays(asOf, opts.fallbackDays ?? 14);
  const excludedPending = deposits.filter((d) => d.basis === 'pending' && d.date <= until);

  const cashLabel: NumberLabel = opts.cash?.label ?? (p.balances.basis === 'verified' ? 'verified' : 'manual');
  const cash = round2(opts.cash?.amount ?? p.balances.cash ?? 0);
  const paid = new Set(opts.paid ?? []);
  // Bills due today count (not paid yet unless marked), through the payday itself: a paycheck can land late.
  const card = cardObligation(p, asOf);
  const obligations = sortObligations([
    ...billOccurrences(p.bills, asOf, until, paid),
    ...(card && card.date <= until && !paid.has(card.id) ? [card] : []),
    ...goalTransfers(p, asOf, until, asOf),
  ]);
  const buffer = round2(bufferFor(p));
  const due = round2(obligations.reduce((t, o) => t + o.amount, 0));
  // Later obligations: the paychecks before each due date pay first; the rest is set aside now.
  const lookEnd = addDays(asOf, Math.max(opts.lookaheadDays ?? 31, diffDays(asOf, until)));
  const inWindow = new Set(obligations.map((o) => o.id));
  const later = sortObligations([
    ...billOccurrences(p.bills, addDays(until, 1), lookEnd, paid),
    ...(card && card.date > until && card.date <= lookEnd && !paid.has(card.id) ? [card] : []),
    ...goalTransfers(p, addDays(until, 1), lookEnd, asOf),
  ]).filter((o) => !inWindow.has(o.id));
  const funding = fundObligations(deposits.filter((d) => d.date <= lookEnd), later);
  const setAside = later.filter((o) => (funding.fromCash[o.id] ?? 0) > 0).map((o) => ({ obligation: o, amount: funding.fromCash[o.id]! }));
  const reserve = funding.reserve;
  const amount = round2(cash - due - reserve - buffer);
  const days = Math.max(1, diffDays(asOf, until));
  const perDay = amount > 0 ? round2(amount / days) : 0;
  const status: SafeStatus = amount < 0 ? 'short' : perDay < (opts.tightPerDay ?? 10) ? 'tight' : 'comfortable';
  const label = weakestLabel([
    cashLabel,
    ...obligations.map((o) => o.basis),
    ...setAside.map((s) => s.obligation.basis),
    ...(reserve > 0 ? ['projected' as NumberLabel] : []),
    ...(next ? [] : ['estimate' as NumberLabel]),
  ]);

  const lines: MathLine[] = [
    { label: 'Cash now', amount: cash, basis: cashLabel, op: '+' },
    ...obligations.map((o): MathLine => ({ label: `${o.label} (due ${shortDate(o.date)})`, amount: -o.amount, basis: o.basis, op: '−', date: o.date })),
    ...setAside.map((s): MathLine => ({
      label: `Set aside for ${s.obligation.label} (due ${shortDate(s.obligation.date)}; paychecks before it cover the rest)`,
      amount: -s.amount,
      basis: weakestLabel([s.obligation.basis, 'projected']),
      op: '−',
      date: s.obligation.date,
    })),
    { label: 'Cushion you keep', amount: -buffer, basis: 'manual', op: '−' },
    { label: 'Safe to spend', amount, basis: label, op: '=' },
  ];

  const whenText = next ? `until payday (${shortDate(until)})` : `for the next ${days} days`;
  const pendingTotal = round2(excludedPending.reduce((t, d) => t + d.amount, 0));
  const headline =
    status === 'short'
      ? `${formatUSD(-amount)} more is due before payday than you have`
      : `${formatUSD(amount)} safe to spend ${whenText}`;
  const sentence =
    status === 'short'
      ? `Coming up: ${formatUSD(round2(due + reserve))} to cover${reserve > 0 ? ' (including what later paychecks can\'t reach in time)' : ''} plus a ${formatUSD(buffer)} cushion, against ${formatUSD(cash)} in cash. ${pendingTotal > 0 ? `Submitting your pending work would add ${formatUSD(pendingTotal)}.` : 'Using part of the cushion, or moving a bill date, are ways to close the gap.'}`
      : `That is about ${formatUSD(perDay)} a day for ${days} day${days === 1 ? '' : 's'}, after ${obligations.length || reserve > 0 ? `${formatUSD(round2(due + reserve))} for bills` : 'no bills'} and a ${formatUSD(buffer)} cushion.`;

  const notes: string[] = ['Savings is not counted: it stays your cushion.'];
  if (pendingTotal > 0) notes.push(`${formatUSD(pendingTotal)} of pending pay is not counted until it is confirmed.`);
  if (!next) notes.push('No paycheck is expected soon, so this covers the next two weeks (ESTIMATE).');
  return { asOf, amount, perDay, days, until, nextPaycheck: next, excludedPending, obligations, setAside, reserve, cash, buffer, label, status, lines, headline, sentence, notes };
}

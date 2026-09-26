/**
 * Per-paycheck plans: "When your $186 lands (Oct 9): $40 card, $25 Roth, $121 flexible."
 *
 * Order for each paycheck:
 *  1. bills and card payments due after it lands and before the next paycheck can reach them
 *     (see allocate.ts; pending paychecks never fund bills)
 *  2. goals, in the order the user listed them: each gets its monthly amount × this paycheck's
 *     share of monthly income (pay-yourself-first and 50/30/20 raise the savings slice)
 *  3. the rest is flexible (the envelopes)
 * Lines always add up to the paycheck exactly.
 */
import { addDays, formatUSD, round2, shortDate, type ExpectedDeposit, type ISODate } from './money.ts';
import { fundObligations } from './allocate.ts';
import { billOccurrences, cardObligation, goalMonthly, goalTransfers, sortObligations } from './obligations.ts';
import { projectedDeposits, type IncomeBaseline } from './income.ts';
import { PYF_RATE } from './plan.ts';
import type { BudgetProfile } from './types.ts';

export type PaycheckLine = {
  id: string;
  kind: 'bill' | 'card' | 'goal' | 'cushion' | 'flexible';
  label: string;
  amount: number;
  dueDate?: ISODate;
  goalId?: string;
};

export type PaycheckPlan = {
  deposit: ExpectedDeposit;
  lines: PaycheckLine[];
  flexible: number;
  /** false when goals got less than planned because bills took the paycheck. */
  goalsFullyFunded: boolean;
  sentence: string;
};

export type PaycheckPlanOptions = {
  count?: number;
  horizonDays?: number;
  paid?: readonly string[];
};

function goalShortName(title: string): string {
  const t = title.toLowerCase();
  if (t.includes('roth')) return 'Roth';
  if (t.includes('emergency') || t.includes('buffer') || t.includes('cushion')) return 'buffer';
  return title;
}

export function planPaychecks(p: BudgetProfile, asOf: ISODate, baseline: Pick<IncomeBaseline, 'monthly'>, opts: PaycheckPlanOptions = {}): PaycheckPlan[] {
  const horizonEnd = addDays(asOf, opts.horizonDays ?? 45);
  const deposits = projectedDeposits(p, addDays(asOf, 1), horizonEnd);
  const next = deposits.find((d) => d.basis === 'projected');
  const firstWindowEnd = next ? next.date : asOf;
  const paid = new Set(opts.paid ?? []);
  const card = cardObligation(p, asOf);
  const later = sortObligations([
    ...billOccurrences(p.bills, addDays(firstWindowEnd, 1), horizonEnd, paid),
    ...(card && card.date > firstWindowEnd && card.date <= horizonEnd && !paid.has(card.id) ? [card] : []),
    ...goalTransfers(p, addDays(firstWindowEnd, 1), horizonEnd, asOf),
  ]);
  const funding = fundObligations(deposits, later);
  const byId = new Map(later.map((o) => [o.id, o]));
  const monthly = Math.max(0, baseline.monthly);
  const goals = p.goals
    .filter((g) => g.kind !== 'cover_card' && g.kind !== 'pay_off_card' && g.transferDay === undefined)
    .map((g) => ({ g, m: goalMonthly(g, p, asOf) }))
    .filter((x) => x.m > 0);

  const plans: PaycheckPlan[] = [];
  const count = opts.count ?? 3;
  for (let i = 0; i < deposits.length && plans.length < count; i++) {
    const d = deposits[i]!;
    const lines: PaycheckLine[] = [];
    for (const f of funding.fundings.filter((x) => x.depositIndex === i)) {
      const o = byId.get(f.obligationId)!;
      lines.push({ id: o.id, kind: o.kind === 'card' ? 'card' : 'bill', label: `${o.label} (due ${shortDate(o.date)})`, amount: f.amount, dueDate: o.date });
    }
    let left = round2(d.amount - lines.reduce((t, l) => t + l.amount, 0));
    // Savings slice for this paycheck.
    const share = monthly > 0 ? Math.min(1, d.amount / monthly) : 0;
    let wanted = goals.map((x) => ({ ...x, want: round2(x.m * share) }));
    if (monthly <= 0 && goals.length) {
      // No baseline (zero-income month): give goals a small, equal slice of what actually landed.
      wanted = goals.map((x) => ({ ...x, want: round2(Math.min(x.m, (d.amount * 0.1) / goals.length)) }));
    }
    let extraSavings = 0;
    if (p.style === 'pay_yourself_first') extraSavings = round2(Math.max(0, d.amount * PYF_RATE[p.comfort.tightness] - wanted.reduce((t, x) => t + x.want, 0)));
    if (p.style === 'fifty_thirty_twenty') {
      const cardPart = lines.filter((l) => l.kind === 'card').reduce((t, l) => t + l.amount, 0);
      extraSavings = round2(Math.max(0, d.amount * 0.2 - cardPart - wanted.reduce((t, x) => t + x.want, 0)));
    }
    let full = true;
    for (const x of wanted) {
      const give = round2(Math.min(left, x.want));
      if (give < x.want) full = false;
      if (give > 0) {
        lines.push({ id: `goal:${x.g.id}`, kind: x.g.kind === 'emergency_fund' ? 'cushion' : 'goal', label: goalShortName(x.g.title), amount: give, goalId: x.g.id });
        left = round2(left - give);
      }
    }
    if (extraSavings > 0 && left > 0) {
      const give = round2(Math.min(left, extraSavings));
      lines.push({ id: 'cushion', kind: 'cushion', label: 'savings (off the top)', amount: give });
      left = round2(left - give);
    }
    lines.push({ id: 'flexible', kind: 'flexible', label: 'flexible', amount: left });
    const parts = lines.filter((l) => l.amount > 0).map((l) => `${formatUSD(l.amount)} ${l.kind === 'bill' ? l.label.replace(/ \(due.*\)$/, '') : l.kind === 'card' ? 'card' : l.label}`);
    const pendingNote = d.basis === 'pending' ? ` It only lands once ${d.note ? d.note.replace(/^Only lands if /, '').replace(/:.*$/, '') : 'the work is submitted'}.` : '';
    plans.push({
      deposit: d,
      lines,
      flexible: left,
      goalsFullyFunded: full,
      sentence: `When your ${formatUSD(d.amount)} from ${d.streamName} lands (${shortDate(d.date)}): ${parts.join(', ')}.${pendingNote}`,
    });
  }
  return plans;
}

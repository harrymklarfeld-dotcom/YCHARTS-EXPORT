/**
 * Credit-card math, explained plainly: utilization, statement vs due date, payoff timelines,
 * and the interest a pay-in-full month avoids. No offers, no product talk.
 *
 * Interest model (an ESTIMATE): monthly interest = balance × APR ÷ 12. Real cards charge a
 * daily periodic rate on the average daily balance, so actual interest differs slightly.
 */
import { diffDays, shortDate } from './dates.ts';
import { formatPct, formatUSD, round2 } from './format.ts';
import type { ISODate, Liability, NumberLabel } from './types.ts';

// ---------------------------------------------------------------- utilization

export type UtilizationBandId = 'low' | 'moderate' | 'high' | 'over';

export type UtilizationBand = { id: UtilizationBandId; upTo: number; title: string; text: string };

/**
 * Educational bands. Scoring models look at how much of the limit is used; lower generally reads
 * better, and "under 30%" / "under 10%" are the commonly cited rules of thumb (not hard cut-offs).
 */
export const UTILIZATION_BANDS: readonly UtilizationBand[] = [
  { id: 'low', upTo: 0.1, title: 'Under 10%', text: 'A small share of the limit is in use. This is the range people with the highest scores tend to show.' },
  { id: 'moderate', upTo: 0.3, title: '10% to 30%', text: 'Under the commonly cited 30% rule of thumb. Scores usually read this as manageable.' },
  { id: 'high', upTo: 1, title: '30% to 100%', text: 'Over 30% of the limit is in use. Scoring models tend to read high utilization as more risk, even when the bill is paid on time.' },
  { id: 'over', upTo: Infinity, title: 'Over the limit', text: 'The balance is above the limit, which can bring fees and declined purchases.' },
];

export type Utilization = {
  balance: number;
  limit: number | null;
  /** balance ÷ limit; null without a limit. */
  ratio: number | null;
  band: UtilizationBand | null;
  /** Balance that would sit exactly at 10% and 30% of the limit. */
  at10: number | null;
  at30: number | null;
  sentence: string;
};

export function utilization(balance: number, limit: number | null | undefined): Utilization {
  if (!limit || limit <= 0) {
    return { balance, limit: null, ratio: null, band: null, at10: null, at30: null, sentence: 'No credit limit on record, so utilization cannot be computed.' };
  }
  const exact = Math.max(0, balance) / limit;
  const ratio = round2(exact);
  const band = UTILIZATION_BANDS.find((b) => exact < b.upTo || (b.id === 'high' && exact <= 1)) ?? UTILIZATION_BANDS[UTILIZATION_BANDS.length - 1]!;
  return {
    balance,
    limit,
    ratio,
    band,
    at10: round2(limit * 0.1),
    at30: round2(limit * 0.3),
    sentence: `${formatUSD(balance)} of a ${formatUSD(limit)} limit is ${formatPct(exact)} utilization (${band.title.toLowerCase()}).`,
  };
}

// ---------------------------------------------------------------- statement vs due date

export type StatementCycle = {
  statementDate: ISODate | null;
  dueDate: ISODate;
  /** Days between the statement closing and the due date (the grace period). */
  graceDays: number | null;
  statementBalance: number;
  minimumDue: number;
  steps: string[];
};

export function statementCycle(l: Liability): StatementCycle {
  const grace = l.statementDate ? diffDays(l.statementDate, l.dueDate) : null;
  const steps = [
    l.statementDate
      ? `Statement date (${shortDate(l.statementDate)}): the billing cycle closed and the card company totalled it up: ${formatUSD(l.statementBalance)}.`
      : `Statement date: the billing cycle closes and the balance becomes the statement balance (${formatUSD(l.statementBalance)}).`,
    `Due date (${shortDate(l.dueDate)}): the day a payment has to arrive${grace !== null ? `, ${grace} days after the statement` : ''}.`,
    `Paying the full ${formatUSD(l.statementBalance)} by the due date means no interest on those purchases (the grace period).`,
    `Paying only the ${formatUSD(l.minimumDue)} minimum avoids a late fee, but interest starts on what is left.`,
    'New purchases after the statement date land on the next statement.',
  ];
  return { statementDate: l.statementDate ?? null, dueDate: l.dueDate, graceDays: grace, statementBalance: l.statementBalance, minimumDue: l.minimumDue, steps };
}

// ---------------------------------------------------------------- payoff

export type PayoffMonth = { month: number; payment: number; interest: number; principal: number; balance: number };

export type PayoffPlan = {
  balance: number;
  apr: number;
  monthlyPayment: number;
  /** false when the payment never catches up with the interest. */
  feasible: boolean;
  /** Months until the balance reaches $0 (null when infeasible or past `maxMonths`). */
  months: number | null;
  totalInterest: number;
  totalPaid: number;
  schedule: PayoffMonth[];
  /** Interest charged in month 1 (the payment has to beat this to make progress). */
  firstMonthInterest: number;
  label: NumberLabel;
  sentence: string;
};

/**
 * Fixed monthly payment → months to $0 and total interest, assuming no new charges.
 * Monthly interest = balance × apr / 12, rounded to cents; the last payment is whatever is left.
 */
export function payoffPlan(balance: number, apr: number, monthlyPayment: number, opts: { maxMonths?: number } = {}): PayoffPlan {
  const maxMonths = opts.maxMonths ?? 600;
  const rate = Math.max(0, apr) / 12;
  const firstInterest = round2(Math.max(0, balance) * rate);
  const base = { balance, apr, monthlyPayment, firstMonthInterest: firstInterest, label: 'estimate' as NumberLabel };
  if (balance <= 0) {
    return { ...base, feasible: true, months: 0, totalInterest: 0, totalPaid: 0, schedule: [], sentence: 'Nothing is owed.' };
  }
  if (!(monthlyPayment > firstInterest)) {
    return {
      ...base, feasible: false, months: null, totalInterest: 0, totalPaid: 0, schedule: [],
      sentence: `${formatUSD(monthlyPayment, { cents: true })} a month does not cover the ${formatUSD(firstInterest, { cents: true })} of monthly interest, so the balance would never shrink.`,
    };
  }
  let bal = balance;
  let interestTotal = 0;
  let paid = 0;
  const schedule: PayoffMonth[] = [];
  for (let m = 1; m <= maxMonths && bal > 0; m++) {
    const interest = round2(bal * rate);
    const payment = round2(Math.min(monthlyPayment, bal + interest));
    const principal = round2(payment - interest);
    bal = round2(bal + interest - payment);
    interestTotal += interest;
    paid += payment;
    schedule.push({ month: m, payment, interest, principal, balance: bal });
  }
  const done = bal <= 0;
  const months = done ? schedule.length : null;
  return {
    ...base,
    feasible: true,
    months,
    totalInterest: round2(interestTotal),
    totalPaid: round2(paid),
    schedule,
    sentence: done
      ? `At ${formatUSD(monthlyPayment)} a month with no new charges, ${formatUSD(balance)} reaches $0 in ${months} month${months === 1 ? '' : 's'}, with about ${formatUSD(interestTotal)} of interest at ${formatPct(apr, 2)} APR.`
      : `At ${formatUSD(monthlyPayment)} a month the balance is still not paid off after ${maxMonths} months.`,
  };
}

/**
 * Minimum-only payoff: each month's minimum = max(floor, interest + percent × balance), a common
 * card formula (issuers vary). Shows why minimum-only takes so long. ESTIMATE.
 */
export function minimumOnlyPlan(
  balance: number,
  apr: number,
  opts: { floor?: number; percent?: number; maxMonths?: number } = {},
): Omit<PayoffPlan, 'monthlyPayment'> & { monthlyPayment: null } {
  const floor = opts.floor ?? 25;
  const pct = opts.percent ?? 0.01;
  const maxMonths = opts.maxMonths ?? 600;
  const rate = Math.max(0, apr) / 12;
  let bal = balance;
  let interestTotal = 0;
  let paid = 0;
  const schedule: PayoffMonth[] = [];
  for (let m = 1; m <= maxMonths && bal > 0; m++) {
    const interest = round2(bal * rate);
    const minimum = round2(Math.max(floor, interest + pct * bal));
    const payment = round2(Math.min(minimum, bal + interest));
    bal = round2(bal + interest - payment);
    interestTotal += interest;
    paid += payment;
    schedule.push({ month: m, payment, interest, principal: round2(payment - interest), balance: bal });
  }
  const months = bal <= 0 ? schedule.length : null;
  return {
    balance, apr, monthlyPayment: null, feasible: true, months,
    totalInterest: round2(interestTotal), totalPaid: round2(paid), schedule,
    firstMonthInterest: round2(balance * rate), label: 'estimate',
    sentence:
      months === null
        ? 'Paying only the minimum, the balance is not paid off within 50 years.'
        : `Paying only the minimum (about ${formatUSD(floor)} or 1% plus interest), ${formatUSD(balance)} takes about ${months} months (${(months / 12).toFixed(1)} years) and about ${formatUSD(interestTotal)} of interest.`,
  };
}

/**
 * Fixed monthly payment that reaches $0 in exactly `months` (standard amortization formula), in cents,
 * rounded up. With APR 0 it is balance ÷ months.
 */
export function requiredMonthlyPayment(balance: number, apr: number, months: number): number {
  if (balance <= 0) return 0;
  const n = Math.max(1, Math.floor(months));
  const r = Math.max(0, apr) / 12;
  const p = r === 0 ? balance / n : (balance * r) / (1 - (1 + r) ** -n);
  return Math.ceil(p * 100 - 1e-9) / 100;
}

/**
 * Interest a pay-in-full month avoids: roughly one month of interest on the statement balance
 * (statementBalance × APR ÷ 12). ESTIMATE; real cards also charge interest on new purchases
 * once the grace period is lost.
 */
export function interestAvoided(statementBalance: number, apr: number): { perMonth: number; perYear: number; label: NumberLabel; sentence: string } {
  const perMonth = round2(Math.max(0, statementBalance) * Math.max(0, apr) / 12);
  const perYear = round2(perMonth * 12);
  return {
    perMonth,
    perYear,
    label: 'estimate',
    sentence: `Paying the full ${formatUSD(statementBalance)} avoids about ${formatUSD(perMonth, { cents: true })} of interest next month at ${formatPct(apr, 2)} APR (about ${formatUSD(perYear)} over a year if the balance stayed there).`,
  };
}

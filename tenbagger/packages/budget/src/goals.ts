/**
 * Goal timelines ("emergency fund in 5 months", "card paid off by March") and buffer progress.
 */
import { addMonthsClamped, formatUSD, payoffPlan, round2, shortDate, toDayNumber, type ISODate, type NumberLabel } from './money.ts';
import { essentialsMonthly, goalByDate, goalCurrent, goalMonthly, goalTarget } from './obligations.ts';
import type { BudgetGoal, BudgetProfile } from './types.ts';

export type GoalTimeline = {
  goalId: string;
  kind: BudgetGoal['kind'];
  title: string;
  target: number;
  current: number;
  remaining: number;
  progress: number;
  monthly: number;
  /** Months until done at `monthly` (null = never at this pace, or no target). */
  months: number | null;
  eta: ISODate | null;
  byDate: ISODate | null;
  /** ETA on or before the target date (null when there is no date). */
  onTrack: boolean | null;
  /** pay_off_card: total interest at this pace (ESTIMATE). */
  interest?: number;
  label: NumberLabel;
  sentence: string;
};

function monthLabel(d: ISODate): string {
  const names = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  return `${names[Number(d.slice(5, 7)) - 1]} ${d.slice(0, 4)}`;
}

export function goalTimeline(g: BudgetGoal, p: BudgetProfile, asOf: ISODate): GoalTimeline {
  const byDate = goalByDate(g, asOf);
  const monthly = goalMonthly(g, p, asOf);
  const base = { goalId: g.id, kind: g.kind, title: g.title, monthly, byDate };
  if (g.kind === 'cover_card') {
    const card = p.balances.card;
    const due = card?.statementBalance ?? card?.balance ?? 0;
    return {
      ...base, target: round2(due), current: 0, remaining: round2(due), progress: 0, months: null, eta: card?.dueDate ?? null, onTrack: null,
      label: p.balances.basis === 'verified' ? 'verified' : 'manual',
      sentence: card?.dueDate ? `Each paycheck sets aside part of the ${formatUSD(due)} statement due ${shortDate(card.dueDate)}.` : 'Add your card’s due date to plan around it.',
    };
  }
  if (g.kind === 'pay_off_card') {
    const card = p.balances.card;
    const bal = card?.balance ?? 0;
    const start = g.target ?? bal;
    const plan = payoffPlan(bal, card?.apr ?? 0, monthly);
    const months = plan.feasible ? plan.months : null;
    const eta = months !== null ? addMonthsClamped(asOf, months) : null;
    return {
      ...base, target: round2(start), current: round2(Math.max(0, start - bal)), remaining: round2(bal),
      progress: start > 0 ? round2(Math.min(1, Math.max(0, (start - bal) / start))) : 1,
      months, eta, onTrack: byDate && eta ? toDayNumber(eta) <= toDayNumber(byDate) : null, interest: plan.totalInterest, label: 'estimate',
      sentence: months === null
        ? `At ${formatUSD(monthly)} a month the interest (${formatUSD(plan.firstMonthInterest, { cents: true })}/mo) keeps up with the payments, so the balance would not shrink.`
        : months === 0 ? 'The card is paid off.' : `At ${formatUSD(monthly)} a month with no new charges, the card reaches $0 around ${monthLabel(eta!)} (about ${formatUSD(plan.totalInterest)} of interest).`,
    };
  }
  const target = goalTarget(g, p);
  const current = goalCurrent(g, p);
  const remaining = round2(Math.max(0, target - current));
  const months = remaining <= 0 ? 0 : monthly > 0 ? Math.ceil(remaining / monthly - 1e-9) : null;
  const eta = months !== null ? addMonthsClamped(asOf, months) : null;
  return {
    ...base, target, current, remaining, progress: target > 0 ? round2(Math.min(1, current / target)) : 1, months, eta,
    onTrack: byDate && eta ? toDayNumber(eta) <= toDayNumber(byDate) : null,
    label: g.kind === 'emergency_fund' && g.target === undefined ? 'estimate' : 'manual',
    sentence: remaining <= 0
      ? `${g.title}: done. ${formatUSD(current)} saved.`
      : months === null
        ? `${g.title}: ${formatUSD(remaining)} to go. Add a monthly amount to see a date.`
        : `${g.title}: ${formatUSD(remaining)} to go; at ${formatUSD(monthly)} a month that is ${months} month${months === 1 ? '' : 's'} (${monthLabel(eta!)}).`,
  };
}

export function goalTimelines(p: BudgetProfile, asOf: ISODate): GoalTimeline[] {
  return p.goals.map((g) => goalTimeline(g, p, asOf));
}

export type BufferProgress = {
  /** One month of spending (bills + need envelopes). */
  target: number;
  current: number;
  progress: number;
  remaining: number;
  /** Paychecks to a full buffer month if each gives `perPaycheck` (null when nothing is planned per paycheck). */
  paychecksToGo: number | null;
  perPaycheck: number;
  label: NumberLabel;
  sentence: string;
};

/** "Buffer month": savings ÷ one month of planned spending (bills + envelopes). */
export function bufferProgress(p: BudgetProfile, opts: { perPaycheck?: number } = {}): BufferProgress {
  const ef = p.goals.find((g) => g.kind === 'emergency_fund');
  const target = round2(ef?.target ?? essentialsMonthly(p));
  const current = round2(ef ? goalCurrent(ef, p) : (p.balances.savings ?? 0));
  const remaining = round2(Math.max(0, target - current));
  const per = round2(Math.max(0, opts.perPaycheck ?? 0));
  const paychecksToGo = remaining <= 0 ? 0 : per > 0 ? Math.ceil(remaining / per - 1e-9) : null;
  return {
    target, current, progress: target > 0 ? round2(Math.min(1, current / target)) : 1, remaining, paychecksToGo, perPaycheck: per,
    label: ef?.target !== undefined ? 'manual' : 'estimate',
    sentence: target <= 0
      ? 'Add your bills and envelopes to size a buffer month.'
      : remaining <= 0
        ? `You have a full buffer month (${formatUSD(current)} vs ${formatUSD(target)} of spending).`
        : `${formatUSD(current)} of a ${formatUSD(target)} buffer month${paychecksToGo !== null ? `: ${paychecksToGo} more paycheck${paychecksToGo === 1 ? '' : 's'} at ${formatUSD(per)} each` : ''}.`,
  };
}

/**
 * Money that is already spoken for: bill occurrences, the card payment, automatic goal
 * transfers, and each goal's monthly amount.
 */
import {
  addMonthsClamped,
  daysInMonth,
  diffDays,
  parts,
  requiredMonthlyPayment,
  round2,
  toDayNumber,
  type ISODate,
  type NumberLabel,
} from './money.ts';
import type { Bill, BudgetGoal, BudgetProfile } from './types.ts';

export type Obligation = {
  id: string;
  kind: 'bill' | 'card' | 'goal_transfer';
  label: string;
  date: ISODate;
  amount: number;
  basis: NumberLabel;
  /** card only: the minimum, for "minimum is covered" messages. */
  minimum?: number;
};

function dayIn(y: number, m: number, day: number): ISODate {
  const d = Math.min(day, daysInMonth(y, m));
  return `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

/** Monthly day-of-month occurrences in `[from, to]` (29–31 clamp to short months). */
export function monthlyOccurrences(dueDay: number, from: ISODate, to: ISODate): ISODate[] {
  const out: ISODate[] = [];
  const f = toDayNumber(from);
  const t = toDayNumber(to);
  let { y, m } = parts(from);
  for (let guard = 0; guard < 240; guard++) {
    const d = dayIn(y, m, dueDay);
    const n = toDayNumber(d);
    if (n > t) break;
    if (n >= f) out.push(d);
    m += 1;
    if (m === 13) {
      m = 1;
      y += 1;
    }
  }
  return out;
}

export function billOccurrences(bills: readonly Bill[], from: ISODate, to: ISODate, paid: ReadonlySet<string> = new Set()): Obligation[] {
  const out: Obligation[] = [];
  for (const b of bills) {
    if (!(b.amount > 0)) continue;
    for (const date of monthlyOccurrences(b.dueDay, from, to)) {
      const id = `${b.id}@${date}`;
      if (paid.has(id)) continue;
      out.push({ id, kind: 'bill', label: b.name, date, amount: round2(b.amount), basis: 'manual' });
    }
  }
  return sortObligations(out);
}

export function sortObligations<T extends Obligation>(xs: T[]): T[] {
  return xs.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.id.localeCompare(b.id)));
}

/** One month of planned spending: bills + every envelope. The size of one buffer month. */
export function essentialsMonthly(p: Pick<BudgetProfile, 'bills' | 'categories'>): number {
  return round2(p.bills.reduce((t, b) => t + Math.max(0, b.amount), 0) + p.categories.reduce((t, c) => t + Math.max(0, c.monthly), 0));
}

function monthsUntil(asOf: ISODate, byDate: ISODate): number {
  return Math.max(1, Math.round(diffDays(asOf, byDate) / 30.44));
}

export function goalByDate(g: BudgetGoal, asOf: ISODate): ISODate | null {
  if (g.byDate) return g.byDate;
  if (g.kind === 'roth') return `${asOf.slice(0, 4)}-12-31`;
  if (g.kind === 'emergency_fund') return addMonthsClamped(asOf, 6);
  return null;
}

export function goalTarget(g: BudgetGoal, p: Pick<BudgetProfile, 'bills' | 'categories' | 'balances'>): number {
  if (g.kind === 'emergency_fund') return round2(g.target ?? essentialsMonthly(p));
  if (g.kind === 'pay_off_card' || g.kind === 'cover_card') return round2(p.balances.card?.balance ?? 0);
  return round2(Math.max(0, g.target ?? 0));
}

export function goalCurrent(g: BudgetGoal, p: Pick<BudgetProfile, 'balances'>): number {
  if (g.current !== undefined) return round2(g.current);
  if (g.kind === 'emergency_fund') return round2(p.balances.savings ?? 0);
  return 0;
}

/**
 * Monthly amount for a goal: the user's own number, else what reaches the target by the date.
 * cover_card has no separate savings (it is the card payment itself), so it is $0 here.
 */
export function goalMonthly(g: BudgetGoal, p: Pick<BudgetProfile, 'bills' | 'categories' | 'balances'>, asOf: ISODate): number {
  if (g.monthly !== undefined) return round2(Math.max(0, g.monthly));
  if (g.kind === 'cover_card') return 0;
  if (g.kind === 'pay_off_card') {
    const card = p.balances.card;
    if (!card || card.balance <= 0) return 0;
    const by = goalByDate(g, asOf);
    if (by) return requiredMonthlyPayment(card.balance, card.apr ?? 0, monthsUntil(asOf, by));
    return round2(Math.max(card.minimumDue ?? 25, 50));
  }
  const remaining = Math.max(0, goalTarget(g, p) - goalCurrent(g, p));
  const by = goalByDate(g, asOf);
  if (remaining <= 0) return 0;
  return round2(Math.ceil((remaining / (by ? monthsUntil(asOf, by) : 12)) * 100) / 100);
}

/**
 * What the plan pays toward the card each due date:
 * - pay_off_card goal → that goal's monthly amount (at least the minimum, at most the statement)
 * - otherwise (cover_card, or no card goal) → the statement balance in full
 */
export function plannedCardPayment(p: Pick<BudgetProfile, 'goals' | 'bills' | 'categories' | 'balances'>, asOf: ISODate, statement: number): number {
  const card = p.balances.card;
  if (!card || statement <= 0) return 0;
  const payOff = p.goals.find((g) => g.kind === 'pay_off_card');
  const covers = p.goals.some((g) => g.kind === 'cover_card');
  if (payOff && !covers) {
    const m = goalMonthly(payOff, p, asOf);
    return round2(Math.min(statement, Math.max(card.minimumDue ?? 0, m)));
  }
  return round2(statement);
}

/**
 * The next card payment on/after `from`. A due date already in the past rolls forward monthly,
 * using the current balance as an ESTIMATE of the next statement.
 */
export function cardObligation(p: Pick<BudgetProfile, 'goals' | 'bills' | 'categories' | 'balances'>, from: ISODate): Obligation | null {
  const card = p.balances.card;
  if (!card || !card.dueDate || !(card.balance > 0 || (card.statementBalance ?? 0) > 0)) return null;
  let due = card.dueDate;
  let statement = card.statementBalance ?? card.balance;
  let basis: NumberLabel = p.balances.basis === 'verified' ? 'verified' : 'manual';
  let rolled = 0;
  while (toDayNumber(due) < toDayNumber(from) && rolled < 24) {
    rolled += 1;
    due = addMonthsClamped(card.dueDate, rolled, parts(card.dueDate).d);
  }
  if (rolled > 0) {
    statement = card.balance;
    basis = 'estimate';
  }
  const amount = plannedCardPayment(p, from, statement);
  if (amount <= 0) return null;
  const minimum = round2(Math.min(statement, card.minimumDue ?? Math.min(statement, 25)));
  return { id: `card@${due}`, kind: 'card', label: card.name ? `${card.name} payment` : 'Card payment', date: due, amount, basis, minimum };
}

/** Automatic goal transfers (goals with `transferDay`) in `[from, to]`. */
export function goalTransfers(p: BudgetProfile, from: ISODate, to: ISODate, asOf: ISODate): Obligation[] {
  const out: Obligation[] = [];
  for (const g of p.goals) {
    if (g.transferDay === undefined) continue;
    const amt = goalMonthly(g, p, asOf);
    if (amt <= 0) continue;
    for (const date of monthlyOccurrences(g.transferDay, from, to)) {
      out.push({ id: `${g.id}@${date}`, kind: 'goal_transfer', label: `${g.title} transfer`, date, amount: amt, basis: 'manual' });
    }
  }
  return sortObligations(out);
}

/**
 * Linked data (the backend `money-summary` shape, or the Money hub's sample) makes the plan
 * sharper: verified balances replace typed-in ones, the card's real statement and due date are
 * used, and manual income streams from the Money hub fill in income. Nothing is required.
 */
import { round2, type IncomeDeposit, type IncomeStream, type Snapshot, type Transaction } from './money.ts';
import type { Balances, BudgetProfile, IncomeSource } from './types.ts';

/** Subset of backend `MoneySummary` (tenbagger/backend/README.md) the budget uses. */
export type LinkedMoney = {
  snapshots?: readonly Snapshot[];
  /** money-summary calls these `incomeStreams`; the sample file calls them `streams`. */
  incomeStreams?: readonly IncomeStream[];
  streams?: readonly IncomeStream[];
  deposits?: readonly IncomeDeposit[];
  transactions?: readonly Transaction[];
};

export function latestSnapshot(l: LinkedMoney): Snapshot | null {
  const s = l.snapshots ?? [];
  if (!s.length) return null;
  return [...s].sort((a, b) => (a.takenAt < b.takenAt ? -1 : a.takenAt > b.takenAt ? 1 : 0))[s.length - 1]!;
}

/** Balances from the latest snapshot. Returns null when nothing is linked. */
export function balancesFromSnapshot(s: Snapshot): Balances {
  const sum = (kinds: string[], useAvailable = false) =>
    round2(s.accounts.filter((a) => kinds.includes(a.kind)).reduce((t, a) => t + (useAvailable ? (a.available ?? a.balance) : a.balance), 0));
  const checking = s.accounts.filter((a) => a.kind === 'checking');
  const cardAcct = s.accounts.find((a) => a.kind === 'credit_card');
  const liab = cardAcct ? s.liabilities.find((l) => l.accountId === cardAcct.id) : undefined;
  const out: Balances = {
    asOf: s.takenAt.slice(0, 10),
    basis: checking.length > 0 && checking.every((a) => a.basis === 'verified') ? 'verified' : 'manual',
    cash: sum(['checking'], true),
    savings: sum(['savings']),
    investments: sum(['brokerage', 'retirement', 'crypto']),
  };
  if (cardAcct) {
    out.card = {
      name: cardAcct.name,
      balance: round2(cardAcct.balance),
      ...(cardAcct.creditLimit !== undefined ? { limit: cardAcct.creditLimit } : {}),
      ...(liab ? { statementBalance: liab.statementBalance, minimumDue: liab.minimumDue, dueDate: liab.dueDate } : {}),
      ...(liab?.apr !== undefined ? { apr: liab.apr } : {}),
    };
  }
  return out;
}

export function sourceFromStream(s: IncomeStream): IncomeSource {
  const kind: IncomeSource['kind'] = s.kind === 'other' ? 'paycheck' : s.kind;
  return {
    id: s.id,
    name: s.name,
    kind,
    rate: s.kind === 'other' ? round2(s.rate * (1 - s.withholdingRate)) : s.rate,
    ...(s.kind === 'hourly' || s.kind === 'per_session' ? { unitsPerWeek: s.schedule.unitsPerWeek, weekdays: [...s.schedule.weekdays] } : {}),
    frequency: s.payFrequency,
    nextPayDate: s.nextPayDate,
    ...(s.kind !== 'other' ? { withholdingRate: s.withholdingRate } : {}),
    ...(s.condition ? { paidOnlyIfSubmitted: true, condition: s.condition } : {}),
    ...(s.pendingUnsubmitted ? { pendingUnsubmitted: { ...s.pendingUnsubmitted } } : {}),
  };
}

/**
 * Merge linked data into a profile:
 * - balances: from the latest snapshot (keeps the user's savings/investments if the snapshot has none)
 * - income: linked streams replace the quick-setup paycheck; sources the user added by hand stay
 */
export function applyLinked(p: BudgetProfile, linked: LinkedMoney): BudgetProfile {
  const snap = latestSnapshot(linked);
  const streams = linked.incomeStreams ?? linked.streams ?? [];
  let income = p.income;
  if (streams.length) {
    const ids = new Set(streams.map((s) => s.id));
    income = [...streams.map(sourceFromStream), ...p.income.filter((s) => s.id !== 'main-pay' && !ids.has(s.id))];
  }
  return { ...p, income, balances: snap ? balancesFromSnapshot(snap) : p.balances };
}

export function hasTransactions(l: LinkedMoney | null | undefined): boolean {
  return !!l?.transactions && l.transactions.length > 0;
}

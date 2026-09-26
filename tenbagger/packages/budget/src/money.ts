/**
 * The ONLY file that imports @tenbagger/money. Read-only reuse of its date math, labels,
 * income projection, card math, transaction categorizer and language guard, so the budget
 * engine never re-implements (or disagrees with) the Money hub. If the money package renames
 * something, fix it here once.
 */
export {
  addDays,
  addMonthsClamped,
  categorize,
  daysInMonth,
  detectSubscriptions,
  diffDays,
  findBannedPhrases as findMoneyBannedPhrases,
  formatPct,
  formatUSD,
  interestAvoided,
  isISODate,
  isSpending,
  monthBounds,
  monthKey,
  parts,
  payoffPlan,
  pendingPayLedger,
  prevMonth,
  projectIncome,
  PERIODS_PER_YEAR,
  requiredMonthlyPayment,
  round2,
  shortDate,
  toDayNumber,
  weakestLabel,
  BANNED_PHRASES as MONEY_BANNED_PHRASES,
} from '../../money/src/index.ts';

export type {
  CategorizeOptions,
  ExpectedDeposit,
  IncomeDeposit,
  IncomeStream,
  ISODate,
  NumberLabel,
  PayFrequency,
  PendingLine,
  Snapshot,
  Subscription,
  Transaction,
  Weekday,
  WorkEntry,
} from '../../money/src/index.ts';

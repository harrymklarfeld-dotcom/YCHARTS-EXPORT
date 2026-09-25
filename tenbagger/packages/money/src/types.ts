/**
 * Shapes for the Tenbagger Money hub.
 *
 * Conventions (match tenbagger/CONTRACT.md):
 * - Currency is USD in raw units (dollars, not cents, not thousands).
 * - Calendar dates are date-only strings `YYYY-MM-DD` (an `ISODate`). They name a day on the
 *   user's own calendar; no timezone conversion is ever applied, so DST cannot shift them.
 * - Debt balances are stored as POSITIVE amounts owed (a $1,120 card balance is `1120`).
 * - Every number the engine emits carries an honest `NumberLabel`.
 */

/** Date-only `YYYY-MM-DD`. */
export type ISODate = string;

/**
 * How much to trust a number.
 * - `verified`  read from a statement or a linked-account snapshot
 * - `manual`    typed in by the user for a snapshot
 * - `projected` expected from a regular schedule (not guaranteed)
 * - `pending`   earned but conditional (e.g. hours not submitted yet)
 * - `estimate`  derived by the engine from partial data (averages, assumptions)
 */
export type NumberLabel = 'verified' | 'manual' | 'projected' | 'pending' | 'estimate';

export type Labeled = { value: number; label: NumberLabel };

export type AccountKind =
  | 'checking'
  | 'savings'
  | 'brokerage'
  | 'retirement'
  | 'crypto'
  | 'credit_card'
  | 'loan';

export type AccountBasis = 'verified' | 'manual';

export type Account = {
  id: string;
  name: string;
  kind: AccountKind;
  /** Assets: current value. Debts (`credit_card`, `loan`): positive amount owed. */
  balance: number;
  /** Spendable amount if different from balance (e.g. pending card holds). */
  available?: number;
  asOf: ISODate;
  basis: AccountBasis;
  /** credit_card only: the credit limit (for utilization). */
  creditLimit?: number;
};

/** Statement details for a debt account (credit card or loan). */
export type Liability = {
  accountId: string;
  statementBalance: number;
  minimumDue: number;
  dueDate: ISODate;
  /** Decimal (0.2499 = 24.99%). */
  apr?: number;
  /** The day the statement closed (the balance was "snapshotted" and the bill created). */
  statementDate?: ISODate;
};

export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6; // 0 = Sunday

export type IncomeKind = 'hourly' | 'per_session' | 'salary' | 'other';
export type PayFrequency = 'weekly' | 'biweekly' | 'semimonthly' | 'monthly';

export type WorkSchedule = {
  /** Hours per week (hourly) or sessions per week (per_session). Ignored for salary/other. */
  unitsPerWeek: number;
  /** Which weekdays the work happens on (display, and exact period counting when `periodLagDays` is set). */
  weekdays: Weekday[];
};

export type IncomeStream = {
  id: string;
  name: string;
  kind: IncomeKind;
  /**
   * hourly: $/hour · per_session: $/session · salary: $/year · other: $/paycheck.
   */
  rate: number;
  schedule: WorkSchedule;
  payFrequency: PayFrequency;
  /** The next date money is expected to land. */
  nextPayDate: ISODate;
  /** Decimal share withheld (taxes etc.). 0.05 = 5%. */
  withholdingRate: number;
  /** What must happen for the money to land, e.g. "hours submitted" or "session reports filed". */
  condition?: string;
  /** Work already done but not yet submitted/filed: it pays only if the condition is met. */
  pendingUnsubmitted?: { units: number; periodEnd: ISODate };
  /** semimonthly only: the two paydays (31 = last day of month). Default [15, 31]. */
  semimonthlyDays?: [number, number];
  /**
   * Days between the end of a pay period and payday. When set (and weekdays are given), units
   * per paycheck are counted from the actual weekdays in the period instead of weeks × units/week.
   */
  periodLagDays?: number;
  /** Move paydays that fall on a weekend to the previous Friday. Default 'none'. */
  weekendRule?: 'none' | 'previous_business_day';
};

/** A deposit the engine expects (from `projectIncome`). */
export type ExpectedDeposit = {
  date: ISODate;
  /** Net amount (after withholding), rounded to cents. */
  amount: number;
  gross: number;
  basis: 'projected' | 'pending';
  streamId: string;
  streamName: string;
  /** Hours/sessions this paycheck covers (hourly/per_session). */
  units?: number;
  /** Plain-English caveat, e.g. "Only lands if hours submitted". */
  note?: string;
};

/** A deposit that already happened (history), used for income volatility. */
export type IncomeDeposit = {
  date: ISODate;
  amount: number;
  streamId?: string;
  basis: 'verified' | 'manual' | 'projected' | 'pending';
};

export type Snapshot = {
  /** `YYYY-MM-DD` or local wall time `YYYY-MM-DDTHH:MM` (no timezone). */
  takenAt: string;
  accounts: Account[];
  liabilities: Liability[];
  note: string;
};

export type SnapshotLog = readonly Snapshot[];

export type Grade = 'A' | 'B' | 'C' | 'D' | 'F';

/**
 * One bank/card transaction (matches the backend `transactions` table: signed amount, + = money in).
 * On a card account, a purchase is negative (it adds to what you owe) and a payment is positive.
 */
export type Transaction = {
  id: string;
  date: ISODate;
  accountId: string;
  /** Signed: + money in, − money out. */
  amount: number;
  /** Merchant / descriptor as the bank shows it. */
  name: string;
  /** Category from the provider, if any. The rule-based categorizer fills it in otherwise. */
  category?: string | null;
  pending?: boolean;
  basis?: 'verified' | 'manual';
};

export type HoldingKind = 'stock' | 'etf' | 'fund' | 'cash' | 'crypto' | 'other';

/** One position in an investment account. */
export type Holding = {
  accountId: string;
  /** null for cash and positions without a ticker. */
  ticker: string | null;
  name: string;
  kind: HoldingKind;
  /** Display bucket for the allocation chart, e.g. "US stock index fund", "Single stock", "Cash". */
  assetClass?: string;
  shares: number;
  price: number;
  /** Total cost paid for the position; null when unknown (common for linked accounts). */
  costBasis: number | null;
  basis: 'verified' | 'manual';
};

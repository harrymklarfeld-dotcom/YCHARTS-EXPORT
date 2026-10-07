/**
 * The budget profile: everything the user told us in setup (quick or full), stored on device.
 *
 * Conventions follow @tenbagger/money: USD dollars, `YYYY-MM-DD` dates (no timezone), card
 * balances are positive amounts owed, and every number the engine emits carries a NumberLabel.
 */
import type { ISODate, NumberLabel, PayFrequency, Weekday } from './money.ts';

/**
 * - `paycheck`            Paycheck-to-paycheck plan: give each paycheck its jobs when it lands (irregular income).
 * - `fifty_thirty_twenty` 50% needs, 30% wants, 20% savings and debt.
 * - `zero_based`          Every dollar of the month gets a job until $0 is left unassigned.
 * - `pay_yourself_first`  Savings and goals come off the top; the rest is free to spend.
 */
export type BudgetStyle = 'paycheck' | 'fifty_thirty_twenty' | 'zero_based' | 'pay_yourself_first';

export type GoalKind = 'cover_card' | 'emergency_fund' | 'roth' | 'pay_off_card' | 'save_for';

export type BudgetGoal = {
  id: string;
  kind: GoalKind;
  title: string;
  /** Dollar target. emergency_fund defaults to one month of spending (bills + envelopes); roth is the yearly amount. */
  target?: number;
  /** Target date. roth defaults to Dec 31 of this year; emergency_fund to 6 months out. */
  byDate?: ISODate;
  /** Already saved toward it. emergency_fund defaults to the savings balance. */
  current?: number;
  /** Planned monthly amount. Omitted: the engine works it out from target and date. */
  monthly?: number;
  /** Day of month an automatic transfer for this goal leaves checking (counts in safe-to-spend). */
  transferDay?: number;
};

/**
 * - hourly / per_session: `rate` per hour / session × `unitsPerWeek`
 * - salary:    `rate` per year (gross)
 * - paycheck:  `rate` = the usual take-home amount per paycheck (quick setup)
 * - allowance: `rate` per payment (family support); `occasional` = never counted in the plan
 * - stipend:   dated lump sums in `disbursements` (aid refunds, semester stipends)
 */
export type IncomeKind = 'hourly' | 'per_session' | 'salary' | 'paycheck' | 'allowance' | 'stipend';
export type SourceFrequency = PayFrequency | 'occasional';

export type Disbursement = { date: ISODate; amount: number; /** Last day this money has to last (default: 4 months later). */ coversUntil?: ISODate };

export type IncomeSource = {
  id: string;
  name: string;
  kind: IncomeKind;
  rate: number;
  unitsPerWeek?: number;
  weekdays?: Weekday[];
  frequency: SourceFrequency;
  nextPayDate?: ISODate;
  /** Share withheld for taxes etc. (0.05 = 5%). */
  withholdingRate?: number;
  /** "Paid only if hours submitted": the check depends on something the user still has to do. */
  paidOnlyIfSubmitted?: boolean;
  condition?: string;
  /** Work done but not submitted yet: that paycheck is PENDING. */
  pendingUnsubmitted?: { units: number; periodEnd: ISODate };
  disbursements?: Disbursement[];
};

export type BillKind = 'rent' | 'phone' | 'subscription' | 'utilities' | 'insurance' | 'transport' | 'other';

export type Bill = {
  id: string;
  name: string;
  amount: number;
  /** Day of month it is due (29–31 clamp to short months). */
  dueDay: number;
  kind: BillKind;
};

export type CategoryKind = 'need' | 'want';

export type SpendingCategory = {
  id: string;
  title: string;
  /** Rough monthly amount (the envelope size). */
  monthly: number;
  kind: CategoryKind;
  /** Leftover (or overspend) carries into next month. */
  rollover: boolean;
  /** @tenbagger/money categorizer ids that land in this envelope (e.g. ['food']). */
  matches?: string[];
};

export type CardInfo = {
  name?: string;
  /** Current balance owed. */
  balance: number;
  statementBalance?: number;
  minimumDue?: number;
  dueDate?: ISODate;
  /** Decimal (0.2499 = 24.99%). */
  apr?: number;
  limit?: number;
};

export type Balances = {
  asOf: ISODate;
  basis: 'manual' | 'verified';
  /** Checking / spendable cash. */
  cash?: number;
  /** Savings: never counted as spendable (it is the cushion). */
  savings?: number;
  investments?: number;
  card?: CardInfo;
};

export type Tightness = 'tight' | 'balanced' | 'flexible';

export type Comfort = {
  /** tight = bigger cushion, smaller fun money; flexible = smaller cushion. */
  tightness: Tightness;
  notify: 'daily' | 'paycheck' | 'weekly' | 'off';
  /** Cash cushion kept out of safe-to-spend. Default by tightness. */
  buffer?: number;
};

export type SetupStep = 'quick' | 'goals' | 'income' | 'bills' | 'spending' | 'balances' | 'comfort' | 'style';

export type BudgetProfile = {
  version: 1;
  createdAt: ISODate;
  updatedAt: ISODate;
  /** quick = the 4-input setup only; full = "Build my full plan" done (or partly done). */
  mode: 'quick' | 'full';
  name?: string;
  goals: BudgetGoal[];
  income: IncomeSource[];
  bills: Bill[];
  categories: SpendingCategory[];
  balances: Balances;
  comfort: Comfort;
  style: BudgetStyle;
  /** Setup steps the user actually answered (drives endowed progress). */
  answered: SetupStep[];
};

/** One line of a shown-the-math equation. */
export type MathLine = { label: string; amount: number; basis: NumberLabel; op: '+' | '−' | '=' ; date?: ISODate };

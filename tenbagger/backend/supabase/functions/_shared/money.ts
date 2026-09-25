// Money hub data layer: shapes DB rows into the input that packages/money consumes
// (Account, Liability, IncomeStream, ExpectedDeposit, IncomeDeposit, Snapshot — mirrored
// below from packages/money/src/types.ts), projects expected deposits from Plaid recurring
// predictions, and builds the append-only snapshot. No cash-flow math here: packages/money
// owns the forward check (cash now + expected income before the due date − amount due).
//
// Basis labels (every number is covered by one):
//   verified  = returned by the provider (Account.basis, Liability.basis, deposits history)
//   projected = predicted (ExpectedDeposit.basis, from Plaid predicted_next_date + cadence)
//   manual    = entered by the user (manual IncomeStream.basis, manual Account.basis)
import type { Basis, IncomeFrequency, NormalizedCashAccount, NormalizedIncomeStream, NormalizedLiability, TransactionsDelta } from "./types.ts";

export const MONEY_SCHEMA_VERSION = 1;
export const MONEY_HORIZON_DAYS = 45;
export const MONEY_SNAPSHOT_LOOKBACK_DAYS = 90;
export const MONEY_DEPOSIT_HISTORY_DAYS = 180;

/** Payload of replace_item_money(). A null section = not fetched this time (keep rows). */
export interface MoneyItemPayload {
  as_of: string;
  cash_accounts: NormalizedCashAccount[];
  liabilities: NormalizedLiability[];
  transactions: TransactionsDelta | null;
  income_streams: NormalizedIncomeStream[] | null;
}

// ---- packages/money shapes (structural mirror; extra fields are additive) ----------------
export type ISODate = string;
export type AccountKind = "checking" | "savings" | "brokerage" | "retirement" | "crypto" | "credit_card" | "loan";
export type PayFrequency = "weekly" | "biweekly" | "semimonthly" | "monthly";
export type IncomeKind = "hourly" | "per_session" | "salary" | "other";

export interface Account {
  id: string;
  name: string;
  kind: AccountKind;
  /** Assets: current value. Debts: POSITIVE amount owed. */
  balance: number;
  available?: number;
  asOf: ISODate;
  basis: "verified" | "manual";
  // additive
  source: "plaid" | "snaptrade" | "manual";
  institution: string | null;
  mask: string | null;
}
export interface Liability {
  accountId: string;
  statementBalance: number;
  minimumDue: number;
  dueDate: ISODate;
  /** Decimal (0.2499 = 24.99%). */
  apr?: number;
  // additive
  basis: "verified";
  lastPaymentAmount: number | null;
  lastPaymentDate: ISODate | null;
  isOverdue: boolean | null;
}
export interface IncomeStream {
  id: string;
  name: string;
  kind: IncomeKind;
  rate: number;
  schedule: { unitsPerWeek: number; weekdays: number[] };
  payFrequency: PayFrequency;
  nextPayDate: ISODate;
  withholdingRate: number;
  condition?: string;
  pendingUnsubmitted?: { units: number; periodEnd: ISODate };
  semimonthlyDays?: [number, number];
  periodLagDays?: number;
  weekendRule?: "none" | "previous_business_day";
  // additive
  basis: Basis;
  source: "manual" | "plaid";
}
export interface ExpectedDeposit {
  date: ISODate;
  amount: number;
  gross: number;
  basis: "projected";
  streamId: string;
  streamName: string;
  note?: string;
  // additive: high = Plaid MATURE + regular cadence; low = EARLY_DETECTION / irregular
  confidence: "high" | "low";
}
export interface IncomeDeposit {
  date: ISODate;
  amount: number;
  streamId?: string;
  basis: "verified";
}
export interface Snapshot {
  takenAt: string;
  accounts: Account[];
  liabilities: Liability[];
  note: string;
}
/** A detected (Plaid recurring) inflow stream, for display and optional confirmation. */
export interface DetectedStream {
  id: string;
  name: string;
  category: string | null;
  frequency: IncomeFrequency;
  status: string;
  averageAmount: number | null;
  lastAmount: number | null;
  lastDate: ISODate | null;
  predictedNextDate: ISODate | null;
  basis: "verified";
  /**
   * packages/money IncomeStream (kind "other", $/paycheck = average deposit) when the cadence is
   * regular. NOT included in incomeStreams (its deposits are already in expectedDeposits); the
   * app may swap it in if the user confirms the stream, to avoid double counting with a manual one.
   */
  asIncomeStream: IncomeStream | null;
}

export interface MoneySummary {
  schemaVersion: number;
  asOf: ISODate;
  timezone: string;
  horizonDays: number;
  accounts: Account[];
  liabilities: Liability[];
  /** Manual, active streams: feed straight to projectIncome / coverageCheck. */
  incomeStreams: IncomeStream[];
  detectedStreams: DetectedStream[];
  /** Projected deposits from detected streams within [asOf, asOf + horizonDays]. */
  expectedDeposits: ExpectedDeposit[];
  /** Income deposits observed in the last 180 days (transactions categorized INCOME). */
  deposits: IncomeDeposit[];
  /** Last 90 days, oldest first (packages/money SnapshotLog order). */
  snapshots: Array<Snapshot & { id: string; basis: Record<string, unknown>; notes: Array<{ id: string; note: string; createdAt: string }> }>;
  sources: Array<{ itemId: string; institution: string | null; status: string; moneyHub: boolean; moneySyncedAt: string | null }>;
  warnings: string[];
}

// ---- DB row shapes (Repo.getMoneyRows; numerics converted; dates as YYYY-MM-DD) ----------
export interface CashAccountRow {
  id: string;
  name: string;
  mask: string | null;
  subtype: string | null;
  institution_name: string | null;
  balance_current: number | null;
  balance_available: number | null;
  currency: string;
  as_of: string; // ISO timestamp
}
export interface InvestmentAccountRow {
  id: string;
  name: string;
  mask: string | null;
  subtype: string | null;
  institution_name: string | null;
  source: "plaid" | "snaptrade" | "manual";
  balance: number | null;
  currency: string;
  as_of: string | null; // ISO timestamp
}
export interface LiabilityRow {
  id: string;
  kind: "credit_card" | "student_loan" | "other_loan";
  name: string;
  mask: string | null;
  institution_name: string | null;
  balance_current: number | null;
  last_statement_balance: number | null;
  minimum_payment_amount: number | null;
  next_payment_due_date: string | null;
  last_payment_amount: number | null;
  last_payment_date: string | null;
  apr_percentage: number | null;
  is_overdue: boolean | null;
  currency: string;
  details_available: boolean;
  as_of: string; // ISO timestamp
}
export interface IncomeStreamRow {
  id: string;
  source: "plaid" | "manual";
  description: string;
  category: string | null;
  frequency: IncomeFrequency;
  average_amount: number | null;
  last_amount: number | null;
  last_date: string | null;
  predicted_next_date: string | null;
  status: string;
  pay_type: IncomeKind | null;
  rate: number | null;
  units_per_week: number | null;
  weekdays: number[] | null;
  next_pay_date: string | null;
  withholding_rate: number | null;
  condition: string | null;
  pending_units: number | null;
  pending_period_end: string | null;
  semimonthly_days: number[] | null;
  period_lag_days: number | null;
  weekend_rule: "none" | "previous_business_day" | null;
  currency: string;
}
export interface SnapshotRow {
  id: string;
  snapshot: Record<string, unknown>;
  basis: Record<string, unknown>;
  notes: Array<{ id: string; note: string; created_at: string }>;
}
export interface MoneySourceRow {
  id: string;
  institution_name: string | null;
  status: string;
  money_hub: boolean;
  money_synced_at: string | null;
}
export interface MoneyRows {
  timezone: string;
  cash: CashAccountRow[];
  investments: InvestmentAccountRow[];
  liabilities: LiabilityRow[];
  streams: IncomeStreamRow[];
  deposits: Array<{ date: string; amount: number }>;
  snapshots: SnapshotRow[];
  sources: MoneySourceRow[];
}

// ---- dates ------------------------------------------------------------------------------
const toDate = (s: string) => new Date(`${s}T00:00:00Z`);
const fmt = (d: Date) => d.toISOString().slice(0, 10);
export function addDays(s: string, n: number): string {
  const d = toDate(s);
  d.setUTCDate(d.getUTCDate() + n);
  return fmt(d);
}
function addMonths(s: string, n: number): string {
  const d = toDate(s);
  const day = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + n);
  const last = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(day, last));
  return fmt(d);
}

/** Local calendar date + wall time for a user's IANA timezone (falls back to UTC). */
export function localParts(at: Date, timezone: string): { date: ISODate; time: string } {
  let f: Intl.DateTimeFormat;
  try {
    f = new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
  } catch {
    f = new Intl.DateTimeFormat("en-CA", { timeZone: "UTC", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
  }
  const p = Object.fromEntries(f.formatToParts(at).map((x) => [x.type, x.value]));
  return { date: `${p.year}-${p.month}-${p.day}`, time: `${p.hour}:${p.minute}` };
}

/** Next occurrence after `s` for a cadence; null for irregular / unknown cadences. */
export function nextOccurrence(s: string, f: IncomeFrequency): string | null {
  switch (f) {
    case "weekly":
      return addDays(s, 7);
    case "biweekly":
      return addDays(s, 14);
    case "semimonthly": {
      // 1st/15th-style pay: alternate +15 days and back to the same day next month.
      const d = toDate(s).getUTCDate();
      return d <= 15 ? addDays(s, 15) : addMonths(addDays(s, -15), 1);
    }
    case "monthly":
      return addMonths(s, 1);
    case "annually":
      return addMonths(s, 12);
    default:
      return null;
  }
}

/** First predicted date on/after `today` (stale predictions roll forward by cadence). */
function rollForward(start: string, f: IncomeFrequency, today: string): string | null {
  let d: string | null = start;
  for (let g = 0; d && d < today && g < 1000; g++) d = nextOccurrence(d, f);
  return d;
}

// ---- mapping ------------------------------------------------------------------------------
const RETIREMENT = /(401|403|457|ira|roth|sep|simple|keogh|pension|retirement|tsp|rrsp|tfsa|lif|lira|rrif)/i;
function cashKind(subtype: string | null): AccountKind {
  return /savings|money market|cd|hsa/i.test(subtype ?? "") ? "savings" : "checking";
}
function investmentKind(subtype: string | null, name: string): AccountKind {
  const s = `${subtype ?? ""} ${name}`;
  if (/crypto/i.test(s)) return "crypto";
  return RETIREMENT.test(subtype ?? "") ? "retirement" : "brokerage";
}
const REGULAR: readonly IncomeFrequency[] = ["weekly", "biweekly", "semimonthly", "monthly"];
const isRegular = (f: IncomeFrequency): f is PayFrequency => REGULAR.includes(f);

function manualStream(s: IncomeStreamRow): IncomeStream {
  const out: IncomeStream = {
    id: s.id,
    name: s.description,
    kind: s.pay_type ?? "other",
    rate: s.rate ?? 0,
    schedule: { unitsPerWeek: s.units_per_week ?? 0, weekdays: s.weekdays ?? [] },
    payFrequency: isRegular(s.frequency) ? s.frequency : "biweekly",
    nextPayDate: s.next_pay_date!,
    withholdingRate: s.withholding_rate ?? 0,
    basis: "manual",
    source: "manual",
  };
  if (s.condition) out.condition = s.condition;
  if (s.pending_units !== null && s.pending_period_end) out.pendingUnsubmitted = { units: s.pending_units, periodEnd: s.pending_period_end };
  if (s.semimonthly_days?.length === 2) out.semimonthlyDays = [s.semimonthly_days[0], s.semimonthly_days[1]];
  if (s.period_lag_days !== null) out.periodLagDays = s.period_lag_days;
  if (s.weekend_rule) out.weekendRule = s.weekend_rule;
  return out;
}

/**
 * Expected deposits within [today, today + horizonDays] from DETECTED (Plaid) streams: start
 * at predicted_next_date, roll stale predictions forward, repeat by cadence. Irregular /
 * unknown cadences contribute only their single predicted date. Tombstoned, non-USD and
 * amount-less streams are skipped. Manual streams are NOT projected here (packages/money
 * projectIncome does that, including pending/conditional pay).
 */
export function projectExpectedDeposits(streams: IncomeStreamRow[], today: string, horizonDays = MONEY_HORIZON_DAYS): ExpectedDeposit[] {
  const end = addDays(today, horizonDays);
  const out: ExpectedDeposit[] = [];
  for (const s of streams) {
    if (s.source !== "plaid" || s.status === "tombstoned" || s.currency !== "USD" || !s.predicted_next_date) continue;
    const value = s.average_amount ?? s.last_amount;
    if (value === null || value <= 0) continue;
    const confidence = s.status === "mature" && isRegular(s.frequency) ? "high" : "low";
    let d = s.predicted_next_date < today ? rollForward(s.predicted_next_date, s.frequency, today) : s.predicted_next_date;
    for (let g = 0; d && d <= end && g < 400; g++) {
      out.push({
        date: d,
        amount: value,
        gross: value,
        basis: "projected",
        streamId: s.id,
        streamName: s.description,
        note: confidence === "high" ? "Detected pattern from past deposits; not guaranteed" : "Early or irregular pattern; amount and date may vary",
        confidence,
      });
      d = nextOccurrence(d, s.frequency);
    }
  }
  return out.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.streamId.localeCompare(b.streamId)));
}

export function buildMoneySummary(rows: MoneyRows, now: Date, horizonDays = MONEY_HORIZON_DAYS): MoneySummary {
  const tz = rows.timezone || "UTC";
  const asOf = localParts(now, tz).date;
  const localDate = (iso: string | null) => (iso ? localParts(new Date(iso), tz).date : asOf);
  const warnings: string[] = [];
  const skip = (name: string, why: string) => warnings.push(`${name}: ${why}`);

  const accounts: Account[] = [];
  for (const c of rows.cash) {
    if (c.currency !== "USD") {
      skip(c.name, `${c.currency} account not converted to USD; left out`);
      continue;
    }
    if (c.balance_current === null) {
      skip(c.name, "no balance reported");
      continue;
    }
    const a: Account = {
      id: c.id,
      name: c.name,
      kind: cashKind(c.subtype),
      balance: c.balance_current,
      asOf: localDate(c.as_of),
      basis: "verified",
      source: "plaid",
      institution: c.institution_name,
      mask: c.mask,
    };
    if (c.balance_available !== null) a.available = c.balance_available;
    accounts.push(a);
  }
  for (const i of rows.investments) {
    if (i.currency !== "USD") {
      skip(i.name, `${i.currency} account not converted to USD; left out`);
      continue;
    }
    if (i.balance === null) continue;
    accounts.push({
      id: i.id,
      name: i.name,
      kind: investmentKind(i.subtype, i.name),
      balance: i.balance,
      asOf: localDate(i.as_of),
      basis: i.source === "manual" ? "manual" : "verified",
      source: i.source,
      institution: i.institution_name,
      mask: i.mask,
    });
  }
  const liabilities: Liability[] = [];
  for (const l of rows.liabilities) {
    if (l.currency !== "USD") {
      skip(l.name, `${l.currency} account not converted to USD; left out`);
      continue;
    }
    if (l.balance_current === null) {
      skip(l.name, "no balance reported");
      continue;
    }
    if (l.balance_current < 0) skip(l.name, "credit balance (overpaid) shown as $0 owed");
    accounts.push({
      id: l.id,
      name: l.name,
      kind: l.kind === "credit_card" ? "credit_card" : "loan",
      balance: Math.max(0, l.balance_current),
      asOf: localDate(l.as_of),
      basis: "verified",
      source: "plaid",
      institution: l.institution_name,
      mask: l.mask,
    });
    if (!l.details_available) {
      if (l.kind === "credit_card") skip(l.name, "due date and minimum payment unavailable (Liabilities not enabled for this card)");
      continue;
    }
    if (!l.next_payment_due_date || l.last_statement_balance === null || l.minimum_payment_amount === null) {
      if (l.kind === "credit_card" && l.balance_current > 0) skip(l.name, "no upcoming statement due date reported");
      continue;
    }
    const li: Liability = {
      accountId: l.id,
      statementBalance: Math.max(0, l.last_statement_balance),
      minimumDue: Math.max(0, l.minimum_payment_amount),
      dueDate: l.next_payment_due_date,
      basis: "verified",
      lastPaymentAmount: l.last_payment_amount,
      lastPaymentDate: l.last_payment_date,
      isOverdue: l.is_overdue,
    };
    if (l.apr_percentage !== null) li.apr = Math.round(l.apr_percentage * 100) / 10000;
    liabilities.push(li);
  }

  const incomeStreams = rows.streams.filter((s) => s.source === "manual" && s.status === "active").map(manualStream);
  const paused = rows.streams.filter((s) => s.source === "manual" && s.status !== "active").length;
  if (paused) warnings.push(`${paused} paused income stream(s) not projected`);

  const detectedStreams: DetectedStream[] = rows.streams.filter((s) => s.source === "plaid").map((s) => {
    const avg = s.average_amount ?? s.last_amount;
    const next = s.predicted_next_date ? rollForward(s.predicted_next_date, s.frequency, asOf) : null;
    const usable = s.status !== "tombstoned" && s.currency === "USD" && isRegular(s.frequency) && avg !== null && avg > 0 && next;
    return {
      id: s.id,
      name: s.description,
      category: s.category,
      frequency: s.frequency,
      status: s.status,
      averageAmount: s.average_amount,
      lastAmount: s.last_amount,
      lastDate: s.last_date,
      predictedNextDate: s.predicted_next_date,
      basis: "verified",
      asIncomeStream: usable
        ? {
          id: s.id,
          name: s.description,
          kind: "other",
          rate: avg!,
          schedule: { unitsPerWeek: 0, weekdays: [] },
          payFrequency: s.frequency as PayFrequency,
          nextPayDate: next!,
          withholdingRate: 0, // Plaid amounts are net deposits
          basis: "projected",
          source: "plaid",
        }
        : null,
    };
  });

  // Oldest first, matching packages/money SnapshotLog.
  const snapshots = [...rows.snapshots].reverse().map((r) => {
    const s = r.snapshot as unknown as Snapshot;
    const notes = r.notes.map((n) => ({ id: n.id, note: n.note, createdAt: n.created_at }));
    return {
      id: r.id,
      takenAt: String(s.takenAt),
      accounts: Array.isArray(s.accounts) ? s.accounts : [],
      liabilities: Array.isArray(s.liabilities) ? s.liabilities : [],
      note: [s.note, ...notes.map((n) => n.note)].filter((x) => typeof x === "string" && x).join("\n"),
      basis: r.basis,
      notes,
    };
  });

  return {
    schemaVersion: MONEY_SCHEMA_VERSION,
    asOf,
    timezone: tz,
    horizonDays,
    accounts,
    liabilities,
    incomeStreams,
    detectedStreams,
    expectedDeposits: projectExpectedDeposits(rows.streams, asOf, horizonDays),
    deposits: rows.deposits.map((d) => ({ date: d.date, amount: d.amount, basis: "verified" as const })),
    snapshots,
    sources: rows.sources.map((i) => ({ itemId: i.id, institution: i.institution_name, status: i.status, moneyHub: i.money_hub, moneySyncedAt: i.money_synced_at })),
    warnings,
  };
}

/**
 * The append-only history row: a packages/money Snapshot (takenAt in the user's local wall
 * time, accounts incl. debts, liabilities) + basis labels per account / liability.
 * The forward check is recomputed from these by packages/money, never stored.
 */
export function buildSnapshot(s: MoneySummary, now: Date): { snapshot: Snapshot; basis: Record<string, unknown> } {
  const { date, time } = localParts(now, s.timezone);
  const snapshot: Snapshot = { takenAt: `${date}T${time}`, accounts: s.accounts, liabilities: s.liabilities, note: "" };
  const basis = {
    accounts: Object.fromEntries(s.accounts.map((a) => [a.id, a.basis])),
    liabilities: Object.fromEntries(s.liabilities.map((l) => [l.accountId, l.basis])),
  };
  return { snapshot, basis };
}

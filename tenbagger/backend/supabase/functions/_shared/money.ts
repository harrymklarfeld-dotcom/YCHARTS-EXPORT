// Money hub data layer: shapes DB rows into the normalized input that packages/money
// consumes, projects expected deposits from Plaid recurring predictions, and builds the
// append-only snapshot. NO cash-flow math here beyond simple labelled sums for snapshots:
// packages/money owns the forward check (cash now + expected income before due − amount due).
//
// Every number is wrapped as {value, basis, asOf}:
//   verified  = returned by the provider (asOf = when we last pulled it)
//   projected = predicted (Plaid recurring predicted_next_date / frequency roll-forward)
//   manual    = entered by the user
import type { Basis, IncomeFrequency, LiabilityKind, NormalizedCashAccount, NormalizedLiability, NormalizedIncomeStream, TransactionsDelta } from "./types.ts";

export const MONEY_HORIZON_DAYS = 45;
export const MONEY_SNAPSHOT_LOOKBACK_DAYS = 90;

export interface Amount {
  value: number;
  basis: Basis;
  asOf: string | null;
}

/** Payload of replace_item_money(). A null section = not fetched this time (keep rows). */
export interface MoneyItemPayload {
  as_of: string;
  cash_accounts: NormalizedCashAccount[];
  liabilities: NormalizedLiability[];
  transactions: TransactionsDelta | null;
  income_streams: NormalizedIncomeStream[] | null;
}

// ---- DB row shapes (as returned by Repo.getMoneyRows; numerics already converted) ------
export interface CashAccountRow {
  id: string;
  name: string;
  mask: string | null;
  subtype: string | null;
  institution_name: string | null;
  balance_current: number | null;
  balance_available: number | null;
  currency: string;
  as_of: string;
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
  as_of: string | null;
}
export interface LiabilityRow {
  id: string;
  kind: LiabilityKind;
  name: string;
  mask: string | null;
  institution_name: string | null;
  balance_current: number | null;
  credit_limit: number | null;
  last_statement_balance: number | null;
  last_statement_date: string | null;
  minimum_payment_amount: number | null;
  next_payment_due_date: string | null;
  last_payment_amount: number | null;
  last_payment_date: string | null;
  apr_percentage: number | null;
  is_overdue: boolean | null;
  currency: string;
  details_available: boolean;
  as_of: string;
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
  pay_type: "hourly" | "per_session" | "salary" | null;
  rate: number | null;
  units_per_period: number | null;
  next_pay_date: string | null;
  withholding_rate: number | null;
  condition: string | null;
  currency: string;
  updated_at: string;
}
export interface SnapshotRow {
  id: string;
  taken_at: string;
  trigger: string;
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
  cash: CashAccountRow[];
  investments: InvestmentAccountRow[];
  liabilities: LiabilityRow[];
  streams: IncomeStreamRow[];
  snapshots: SnapshotRow[];
  sources: MoneySourceRow[];
}

// ---- Output: the normalized input shape for packages/money ------------------------------
export interface MoneyAccount {
  id: string;
  kind: "cash" | "investment";
  name: string;
  mask: string | null;
  subtype: string | null;
  institution: string | null;
  source: "plaid" | "snaptrade" | "manual";
  currency: string;
  balance: Amount | null;
  /** Depository "available" balance (after holds / pending); null for investments. */
  available: Amount | null;
}
export interface MoneyLiability {
  id: string;
  kind: LiabilityKind;
  name: string;
  mask: string | null;
  institution: string | null;
  currency: string;
  balance: Amount | null;
  creditLimit: Amount | null;
  statementBalance: Amount | null;
  statementDate: string | null;
  minimumPayment: Amount | null;
  nextDueDate: string | null;
  lastPaymentAmount: Amount | null;
  lastPaymentDate: string | null;
  aprPercentage: Amount | null;
  isOverdue: boolean | null;
  /** false => only balance/limit known (Liabilities product not available for this card). */
  detailsAvailable: boolean;
}
export interface MoneyIncomeStream {
  id: string;
  source: "plaid" | "manual";
  basis: Basis;
  description: string;
  category: string | null;
  frequency: IncomeFrequency;
  status: string;
  currency: string;
  averageAmount: Amount | null;
  lastAmount: Amount | null;
  lastDate: string | null;
  nextDate: string | null;
  manual: {
    payType: "hourly" | "per_session" | "salary";
    rate: Amount;
    unitsPerPeriod: Amount | null;
    withholdingRate: Amount | null;
    condition: string | null;
  } | null;
}
export interface ExpectedDeposit {
  streamId: string;
  description: string;
  date: string;
  amount: Amount;
  frequency: IncomeFrequency;
  /** high = Plaid MATURE stream, low = EARLY_DETECTION / unknown cadence. */
  confidence: "high" | "low";
}
export interface MoneySnapshotOut {
  id: string;
  takenAt: string;
  trigger: string;
  snapshot: Record<string, unknown>;
  basis: Record<string, unknown>;
  notes: Array<{ id: string; note: string; createdAt: string }>;
}
export interface MoneySummary {
  asOf: string;
  horizonDays: number;
  accounts: MoneyAccount[];
  liabilities: MoneyLiability[];
  incomeStreams: MoneyIncomeStream[];
  expectedDeposits: ExpectedDeposit[];
  snapshots: MoneySnapshotOut[];
  sources: Array<{ itemId: string; institution: string | null; status: string; moneyHub: boolean; moneySyncedAt: string | null }>;
  warnings: string[];
}

const amt = (v: number | null | undefined, basis: Basis, asOf: string | null): Amount | null =>
  v === null || v === undefined || !Number.isFinite(v) ? null : { value: v, basis, asOf };

// ---- date helpers (UTC calendar dates) --------------------------------------------------
const toDate = (s: string) => new Date(`${s}T00:00:00Z`);
const fmt = (d: Date) => d.toISOString().slice(0, 10);
function addDays(s: string, n: number): string {
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
/** Next occurrence after `s` for a cadence; null for irregular / unknown cadences. */
export function nextOccurrence(s: string, f: IncomeFrequency): string | null {
  switch (f) {
    case "weekly":
      return addDays(s, 7);
    case "biweekly":
      return addDays(s, 14);
    case "semi_monthly": {
      // 1st/15th-style pay: alternate +15 days and to the same day next month.
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

/**
 * Expected deposits within [today, today + horizonDays] from DETECTED (Plaid) streams.
 * Starts at predicted_next_date and rolls forward by frequency; a stale prediction is
 * rolled forward to today. Tombstoned streams and streams without an amount are skipped.
 * Manual streams are not projected here (packages/money derives them from incomeStreams).
 */
export function projectExpectedDeposits(streams: IncomeStreamRow[], today: string, horizonDays = MONEY_HORIZON_DAYS): ExpectedDeposit[] {
  const end = addDays(today, horizonDays);
  const out: ExpectedDeposit[] = [];
  for (const s of streams) {
    if (s.source !== "plaid" || s.status === "tombstoned" || s.currency !== "USD") continue;
    const value = s.average_amount ?? s.last_amount;
    if (value === null || value <= 0 || !s.predicted_next_date) continue;
    let d: string | null = s.predicted_next_date;
    for (let guard = 0; d && d < today && guard < 400; guard++) d = nextOccurrence(d, s.frequency);
    for (let guard = 0; d && d <= end && guard < 400; guard++) {
      if (d >= today) {
        out.push({
          streamId: s.id,
          description: s.description,
          date: d,
          amount: { value, basis: "projected", asOf: s.predicted_next_date },
          frequency: s.frequency,
          confidence: s.status === "mature" && s.frequency !== "unknown" && s.frequency !== "irregular" ? "high" : "low",
        });
      }
      d = nextOccurrence(d, s.frequency);
    }
  }
  return out.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.streamId.localeCompare(b.streamId)));
}

export function buildMoneySummary(rows: MoneyRows, today: string, horizonDays = MONEY_HORIZON_DAYS): MoneySummary {
  const warnings: string[] = [];
  const accounts: MoneyAccount[] = [
    ...rows.cash.map((c): MoneyAccount => ({
      id: c.id,
      kind: "cash",
      name: c.name,
      mask: c.mask,
      subtype: c.subtype,
      institution: c.institution_name,
      source: "plaid",
      currency: c.currency,
      balance: amt(c.balance_current, "verified", c.as_of),
      available: amt(c.balance_available, "verified", c.as_of),
    })),
    ...rows.investments.map((a): MoneyAccount => ({
      id: a.id,
      kind: "investment",
      name: a.name,
      mask: a.mask,
      subtype: a.subtype,
      institution: a.institution_name,
      source: a.source,
      currency: a.currency,
      balance: amt(a.balance, a.source === "manual" ? "manual" : "verified", a.as_of),
      available: null,
    })),
  ];
  const liabilities: MoneyLiability[] = rows.liabilities.map((l) => {
    const v = (x: number | null) => amt(x, "verified", l.as_of);
    return {
      id: l.id,
      kind: l.kind,
      name: l.name,
      mask: l.mask,
      institution: l.institution_name,
      currency: l.currency,
      balance: v(l.balance_current),
      creditLimit: v(l.credit_limit),
      statementBalance: v(l.last_statement_balance),
      statementDate: l.last_statement_date,
      minimumPayment: v(l.minimum_payment_amount),
      nextDueDate: l.next_payment_due_date,
      lastPaymentAmount: v(l.last_payment_amount),
      lastPaymentDate: l.last_payment_date,
      aprPercentage: v(l.apr_percentage),
      isOverdue: l.is_overdue,
      detailsAvailable: l.details_available,
    };
  });
  for (const l of liabilities) {
    if (l.kind === "credit_card" && !l.detailsAvailable) warnings.push(`${l.name}: due date and minimum payment unavailable (Liabilities not enabled for this card)`);
  }
  const incomeStreams: MoneyIncomeStream[] = rows.streams.map((s) => {
    if (s.source === "manual") {
      const m = (x: number | null) => amt(x, "manual", s.updated_at);
      return {
        id: s.id,
        source: "manual",
        basis: "manual",
        description: s.description,
        category: s.category,
        frequency: s.frequency,
        status: s.status,
        currency: s.currency,
        averageAmount: null,
        lastAmount: null,
        lastDate: null,
        nextDate: s.next_pay_date,
        manual: {
          payType: s.pay_type!,
          rate: m(s.rate)!,
          unitsPerPeriod: m(s.units_per_period),
          withholdingRate: m(s.withholding_rate),
          condition: s.condition,
        },
      };
    }
    return {
      id: s.id,
      source: "plaid",
      basis: "verified",
      description: s.description,
      category: s.category,
      frequency: s.frequency,
      status: s.status,
      currency: s.currency,
      // Average / last amounts are observed history: verified. Only the future is projected.
      averageAmount: amt(s.average_amount, "verified", s.last_date),
      lastAmount: amt(s.last_amount, "verified", s.last_date),
      lastDate: s.last_date,
      nextDate: s.predicted_next_date,
      manual: null,
    };
  });
  const nonUsd = [...rows.cash, ...rows.investments, ...rows.liabilities].filter((x) => x.currency !== "USD").length;
  if (nonUsd) warnings.push(`${nonUsd} non-USD account(s) are listed but not converted`);

  return {
    asOf: today,
    horizonDays,
    accounts,
    liabilities,
    incomeStreams,
    expectedDeposits: projectExpectedDeposits(rows.streams, today, horizonDays),
    snapshots: rows.snapshots.map((s) => ({
      id: s.id,
      takenAt: s.taken_at,
      trigger: s.trigger,
      snapshot: s.snapshot,
      basis: s.basis,
      notes: s.notes.map((n) => ({ id: n.id, note: n.note, createdAt: n.created_at })),
    })),
    sources: rows.sources.map((i) => ({ itemId: i.id, institution: i.institution_name, status: i.status, moneyHub: i.money_hub, moneySyncedAt: i.money_synced_at })),
    warnings,
  };
}

const round2 = (n: number) => Math.round(n * 100) / 100;
const sumUsd = (xs: Array<{ currency: string; v: Amount | null }>) => round2(xs.filter((x) => x.currency === "USD" && x.v).reduce((s, x) => s + x.v!.value, 0));

/**
 * Minimized, labelled totals for the append-only history. Stores components only; the
 * forward check itself is recomputed by packages/money from these inputs.
 */
export function buildSnapshot(s: MoneySummary): { snapshot: Record<string, unknown>; basis: Record<string, Basis> } {
  const cash = s.accounts.filter((a) => a.kind === "cash");
  const inv = s.accounts.filter((a) => a.kind === "investment");
  const upcoming = s.liabilities
    .filter((l) => l.kind === "credit_card" && l.nextDueDate && l.nextDueDate >= s.asOf)
    .sort((a, b) => (a.nextDueDate! < b.nextDueDate! ? -1 : 1))[0];
  const incomeBeforeDue = upcoming ? round2(s.expectedDeposits.filter((d) => d.date <= upcoming.nextDueDate!).reduce((t, d) => t + d.amount.value, 0)) : null;
  const snapshot = {
    as_of: s.asOf,
    cash_current: sumUsd(cash.map((a) => ({ currency: a.currency, v: a.balance }))),
    cash_available: sumUsd(cash.map((a) => ({ currency: a.currency, v: a.available }))),
    investments: sumUsd(inv.map((a) => ({ currency: a.currency, v: a.balance }))),
    debt: sumUsd(s.liabilities.map((l) => ({ currency: l.currency, v: l.balance }))),
    next_card_due: upcoming
      ? { date: upcoming.nextDueDate, minimum_payment: upcoming.minimumPayment?.value ?? null, statement_balance: upcoming.statementBalance?.value ?? null }
      : null,
    expected_income_before_due: incomeBeforeDue,
    expected_income_horizon: round2(s.expectedDeposits.reduce((t, d) => t + d.amount.value, 0)),
    counts: { cash_accounts: cash.length, investment_accounts: inv.length, liabilities: s.liabilities.length, income_streams: s.incomeStreams.length },
  };
  const basis: Record<string, Basis> = {
    cash_current: "verified",
    cash_available: "verified",
    investments: inv.some((a) => a.balance?.basis === "manual") ? "manual" : "verified",
    debt: "verified",
    next_card_due: "verified",
    expected_income_before_due: "projected",
    expected_income_horizon: "projected",
  };
  return { snapshot, basis };
}

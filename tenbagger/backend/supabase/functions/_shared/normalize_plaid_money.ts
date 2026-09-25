// Plaid Money-hub responses -> normalized, MINIMIZED rows.
//   /accounts/get (or /accounts/balance/get)  -> NormalizedBalances
//   /liabilities/get                           -> NormalizedLiabilities
//   /transactions/sync pages                   -> TransactionsDelta
//   /transactions/recurring/get                -> NormalizedRecurring (inflow streams only)
// Only the fields the cash-flow check needs survive normalization: no account numbers,
// no locations, no counterparties, no servicer addresses, no transaction_ids lists.
import type {
  IncomeFrequency,
  LiabilityKind,
  MoneyWarning,
  NormalizedBalances,
  NormalizedCashAccount,
  NormalizedIncomeStream,
  NormalizedLiabilities,
  NormalizedLiability,
  NormalizedRecurring,
  NormalizedTransaction,
  TransactionsDelta,
} from "./types.ts";
import { clean, num } from "./tickers.ts";

// ---- Minimal structural types for the parts of Plaid's responses we read ----------------
export interface PlaidBalanceAccount {
  account_id: string;
  balances?: {
    available?: number | null;
    current?: number | null;
    limit?: number | null;
    iso_currency_code?: string | null;
    unofficial_currency_code?: string | null;
  };
  mask?: string | null;
  name?: string | null;
  official_name?: string | null;
  type?: string | null;
  subtype?: string | null;
}
export interface PlaidAccountsResponse {
  accounts: PlaidBalanceAccount[];
}

export interface PlaidApr {
  apr_percentage?: number | null;
  apr_type?: string | null;
}
export interface PlaidCreditLiability {
  account_id: string | null;
  aprs?: PlaidApr[] | null;
  is_overdue?: boolean | null;
  last_payment_amount?: number | null;
  last_payment_date?: string | null;
  last_statement_issue_date?: string | null;
  last_statement_balance?: number | null;
  minimum_payment_amount?: number | null;
  next_payment_due_date?: string | null;
}
export interface PlaidStudentLiability {
  account_id: string | null;
  interest_rate_percentage?: number | null;
  is_overdue?: boolean | null;
  last_payment_amount?: number | null;
  last_payment_date?: string | null;
  last_statement_issue_date?: string | null;
  last_statement_balance?: number | null;
  loan_name?: string | null;
  minimum_payment_amount?: number | null;
  next_payment_due_date?: string | null;
}
export interface PlaidLiabilitiesResponse {
  accounts: PlaidBalanceAccount[];
  liabilities: {
    credit?: PlaidCreditLiability[] | null;
    student?: PlaidStudentLiability[] | null;
    mortgage?: Array<{ account_id: string }> | null;
  };
}

export interface PlaidTransaction {
  transaction_id: string;
  account_id: string;
  amount: number;
  iso_currency_code?: string | null;
  unofficial_currency_code?: string | null;
  date: string;
  name?: string | null;
  merchant_name?: string | null;
  pending?: boolean | null;
  personal_finance_category?: { primary?: string | null; detailed?: string | null } | null;
  category?: string[] | null;
}
export interface PlaidTransactionsSyncResponse {
  added: PlaidTransaction[];
  modified: PlaidTransaction[];
  removed: Array<{ transaction_id: string; account_id?: string }>;
  next_cursor: string;
  has_more: boolean;
}

export interface PlaidAmount {
  amount?: number | null;
  iso_currency_code?: string | null;
  unofficial_currency_code?: string | null;
}
export interface PlaidRecurringStream {
  stream_id: string;
  account_id?: string | null;
  description?: string | null;
  merchant_name?: string | null;
  personal_finance_category?: { primary?: string | null; detailed?: string | null } | null;
  category?: string[] | null;
  first_date?: string | null;
  last_date?: string | null;
  predicted_next_date?: string | null;
  frequency?: string | null;
  average_amount?: PlaidAmount | null;
  last_amount?: PlaidAmount | null;
  is_active?: boolean | null;
  status?: string | null;
}
export interface PlaidRecurringResponse {
  inflow_streams: PlaidRecurringStream[];
  outflow_streams?: PlaidRecurringStream[];
}

// ---- helpers ----------------------------------------------------------------------------
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const date = (x: unknown): string | null => (typeof x === "string" && DATE_RE.test(x) ? x : null);
const money = (x: unknown): number | null => {
  const n = num(x);
  return n === null ? null : clean(n);
};
const text = (x: unknown, max: number): string | null => {
  if (typeof x !== "string") return null;
  const t = x.trim().replace(/\s+/g, " ");
  return t ? t.slice(0, max) : null;
};
const mask = (x: unknown): string | null => {
  const t = text(x, 8);
  return t && /^[0-9A-Za-z]{1,8}$/.test(t) ? t : null;
};
function currencyOf(b: { iso_currency_code?: string | null; unofficial_currency_code?: string | null } | null | undefined): string {
  return (b?.iso_currency_code ?? b?.unofficial_currency_code ?? "USD").toUpperCase();
}

function liabilityKind(a: PlaidBalanceAccount): LiabilityKind | null {
  const t = (a.type ?? "").toLowerCase();
  const s = (a.subtype ?? "").toLowerCase();
  if (t === "credit") return "credit_card";
  if (t === "loan") return s === "student" ? "student_loan" : s === "mortgage" || s === "home equity" ? null : "other_loan";
  return null;
}

function balanceOnlyLiability(a: PlaidBalanceAccount, kind: LiabilityKind): NormalizedLiability {
  return {
    provider_account_id: a.account_id,
    kind,
    name: text(a.name ?? a.official_name, 120) ?? "Account",
    mask: mask(a.mask),
    balance_current: money(a.balances?.current),
    credit_limit: kind === "credit_card" ? money(a.balances?.limit) : null,
    last_statement_balance: null,
    last_statement_date: null,
    minimum_payment_amount: null,
    next_payment_due_date: null,
    last_payment_amount: null,
    last_payment_date: null,
    apr_percentage: null,
    is_overdue: null,
    currency: currencyOf(a.balances),
    details_available: false,
  };
}

// ---- balances ---------------------------------------------------------------------------
export function normalizePlaidBalances(raw: PlaidAccountsResponse): NormalizedBalances {
  const warnings: MoneyWarning[] = [];
  const cash_accounts: NormalizedCashAccount[] = [];
  const debt_accounts: NormalizedLiability[] = [];
  for (const a of raw.accounts ?? []) {
    if (!a?.account_id) continue;
    const type = (a.type ?? "").toLowerCase();
    const cur = currencyOf(a.balances);
    if (cur !== "USD") {
      warnings.push({ code: "non_usd", message: `account in ${cur} is not converted to USD`, provider_account_id: a.account_id });
    }
    if (type === "depository") {
      cash_accounts.push({
        provider_account_id: a.account_id,
        name: text(a.name ?? a.official_name, 120) ?? "Account",
        mask: mask(a.mask),
        subtype: text(a.subtype, 40),
        balance_current: money(a.balances?.current),
        balance_available: money(a.balances?.available),
        currency: cur,
      });
      continue;
    }
    if (type === "investment" || type === "brokerage") {
      warnings.push({ code: "investment_account_skipped", message: "investment balances come from the holdings sync", provider_account_id: a.account_id });
      continue;
    }
    const kind = liabilityKind(a);
    if (kind) {
      debt_accounts.push(balanceOnlyLiability(a, kind));
      continue;
    }
    if (type === "loan") {
      warnings.push({ code: "mortgage_skipped", message: `${a.subtype ?? "loan"} is outside the Money hub scope`, provider_account_id: a.account_id });
      continue;
    }
    warnings.push({ code: "unsupported_account_type", message: `account type ${type || "unknown"} skipped`, provider_account_id: a.account_id });
  }
  return { cash_accounts, debt_accounts, warnings };
}

// ---- liabilities ------------------------------------------------------------------------
function purchaseApr(aprs: PlaidApr[] | null | undefined): number | null {
  if (!aprs?.length) return null;
  const pick = aprs.find((a) => a.apr_type === "purchase_apr") ?? aprs[0];
  const v = num(pick.apr_percentage);
  return v === null || v < 0 || v > 100 ? null : v;
}

export function normalizePlaidLiabilities(raw: PlaidLiabilitiesResponse): NormalizedLiabilities {
  const warnings: MoneyWarning[] = [];
  const byId = new Map((raw.accounts ?? []).filter((a) => a?.account_id).map((a) => [a.account_id, a]));
  const out: NormalizedLiability[] = [];

  for (const c of raw.liabilities?.credit ?? []) {
    const a = c.account_id ? byId.get(c.account_id) : undefined;
    if (!a) continue; // Plaid can return null account_id for unlinked cards
    const base = balanceOnlyLiability(a, "credit_card");
    const l: NormalizedLiability = {
      ...base,
      last_statement_balance: money(c.last_statement_balance),
      last_statement_date: date(c.last_statement_issue_date),
      minimum_payment_amount: money(c.minimum_payment_amount),
      next_payment_due_date: date(c.next_payment_due_date),
      last_payment_amount: money(c.last_payment_amount),
      last_payment_date: date(c.last_payment_date),
      apr_percentage: purchaseApr(c.aprs),
      is_overdue: typeof c.is_overdue === "boolean" ? c.is_overdue : null,
      details_available: true,
    };
    if (!l.next_payment_due_date) {
      warnings.push({ code: "missing_due_date", message: "card has no next payment due date (e.g. zero balance)", provider_account_id: a.account_id });
    }
    out.push(l);
  }
  for (const s of raw.liabilities?.student ?? []) {
    const a = s.account_id ? byId.get(s.account_id) : undefined;
    if (!a) continue;
    const base = balanceOnlyLiability(a, "student_loan");
    const rate = num(s.interest_rate_percentage);
    out.push({
      ...base,
      // loan_name is a program name, e.g. "Consolidation"; never the servicer/account number.
      name: text(s.loan_name, 120) ?? base.name,
      last_statement_balance: money(s.last_statement_balance),
      last_statement_date: date(s.last_statement_issue_date),
      minimum_payment_amount: money(s.minimum_payment_amount),
      next_payment_due_date: date(s.next_payment_due_date),
      last_payment_amount: money(s.last_payment_amount),
      last_payment_date: date(s.last_payment_date),
      apr_percentage: rate === null || rate < 0 || rate > 100 ? null : rate,
      is_overdue: typeof s.is_overdue === "boolean" ? s.is_overdue : null,
      details_available: true,
    });
  }
  for (const m of raw.liabilities?.mortgage ?? []) {
    warnings.push({ code: "mortgage_skipped", message: "mortgages are outside the Money hub scope", provider_account_id: m.account_id });
  }
  return { liabilities: out, warnings };
}

/** Balance-only debt accounts, overlaid with /liabilities/get details where available. */
export function mergeLiabilities(debtAccounts: NormalizedLiability[], details: NormalizedLiability[] | null): NormalizedLiability[] {
  const detail = new Map((details ?? []).map((d) => [d.provider_account_id, d]));
  const merged = debtAccounts.map((b) => {
    const d = detail.get(b.provider_account_id);
    detail.delete(b.provider_account_id);
    // Balances call is fresher for balance_current / limit; details win for statement fields.
    return d ? { ...d, balance_current: b.balance_current ?? d.balance_current, credit_limit: b.credit_limit ?? d.credit_limit } : b;
  });
  return [...merged, ...detail.values()];
}

// ---- transactions -----------------------------------------------------------------------
export function normalizePlaidTransaction(t: PlaidTransaction): NormalizedTransaction | null {
  const d = date(t.date);
  const amt = num(t.amount);
  if (!t?.transaction_id || !t.account_id || !d || amt === null) return null;
  return {
    provider_transaction_id: t.transaction_id,
    provider_account_id: t.account_id,
    date: d,
    amount: clean(-amt), // Plaid: positive = money out. Ours: positive = money in.
    name: text(t.merchant_name ?? t.name, 140),
    category: text(t.personal_finance_category?.primary ?? t.category?.[0], 80),
    pending: t.pending === true,
    currency: currencyOf(t),
  };
}

/** Fold one or more /transactions/sync pages (in order) into a single delta. */
export function foldTransactionsSync(pages: PlaidTransactionsSyncResponse[], startCursor: string | null): TransactionsDelta {
  const added = new Map<string, NormalizedTransaction>();
  const modified = new Map<string, NormalizedTransaction>();
  const removed = new Set<string>();
  for (const p of pages) {
    for (const t of p.added ?? []) {
      const n = normalizePlaidTransaction(t);
      if (n) {
        added.set(n.provider_transaction_id, n);
        removed.delete(n.provider_transaction_id);
      }
    }
    for (const t of p.modified ?? []) {
      const n = normalizePlaidTransaction(t);
      if (!n) continue;
      if (added.has(n.provider_transaction_id)) added.set(n.provider_transaction_id, n);
      else modified.set(n.provider_transaction_id, n);
    }
    for (const r of p.removed ?? []) {
      if (!r?.transaction_id) continue;
      added.delete(r.transaction_id);
      modified.delete(r.transaction_id);
      removed.add(r.transaction_id);
    }
  }
  const last = pages.at(-1);
  return { added: [...added.values()], modified: [...modified.values()], removed: [...removed], next_cursor: last?.next_cursor ?? startCursor ?? "" };
}

// ---- recurring income -------------------------------------------------------------------
const FREQ: Record<string, IncomeFrequency> = {
  WEEKLY: "weekly",
  BIWEEKLY: "biweekly",
  SEMI_MONTHLY: "semi_monthly",
  MONTHLY: "monthly",
  ANNUALLY: "annually",
  UNKNOWN: "unknown",
};
const STATUS: Record<string, NormalizedIncomeStream["status"]> = {
  MATURE: "mature",
  EARLY_DETECTION: "early_detection",
  TOMBSTONED: "tombstoned",
  UNKNOWN: "unknown",
};
// Money moving between the user's own accounts, or borrowed money, is not income.
const NOT_INCOME = new Set([
  "TRANSFER_IN_ACCOUNT_TRANSFER",
  "TRANSFER_IN_SAVINGS",
  "TRANSFER_IN_INVESTMENT_AND_RETIREMENT_FUNDS",
  "TRANSFER_IN_CASH_ADVANCES_AND_LOANS",
]);

const inflow = (a: PlaidAmount | null | undefined): number | null => {
  const v = money(a?.amount);
  return v === null ? null : Math.abs(v); // Plaid reports inflows as negative amounts
};

export function normalizePlaidRecurring(raw: PlaidRecurringResponse): NormalizedRecurring {
  const warnings: MoneyWarning[] = [];
  const income_streams: NormalizedIncomeStream[] = [];
  for (const s of raw.inflow_streams ?? []) {
    if (!s?.stream_id) continue;
    const detailed = s.personal_finance_category?.detailed ?? "";
    if (NOT_INCOME.has(detailed)) {
      warnings.push({ code: "transfer_stream_skipped", message: `${detailed} is a transfer, not income`, provider_account_id: s.account_id ?? undefined });
      continue;
    }
    let status = STATUS[(s.status ?? "UNKNOWN").toUpperCase()] ?? "unknown";
    if (s.is_active === false) status = "tombstoned";
    const cur = currencyOf(s.average_amount);
    if (cur !== "USD") warnings.push({ code: "non_usd", message: `income stream in ${cur} is not converted to USD`, provider_account_id: s.account_id ?? undefined });
    income_streams.push({
      provider_stream_id: s.stream_id,
      provider_account_id: s.account_id ?? null,
      description: text(s.merchant_name ?? s.description, 140) ?? "Income",
      category: text(detailed || s.personal_finance_category?.primary || s.category?.[0], 80),
      frequency: FREQ[(s.frequency ?? "UNKNOWN").toUpperCase()] ?? "unknown",
      average_amount: inflow(s.average_amount),
      last_amount: inflow(s.last_amount),
      last_date: date(s.last_date),
      predicted_next_date: date(s.predicted_next_date),
      status,
      currency: cur,
    });
  }
  return { income_streams, warnings };
}

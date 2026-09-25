// Shared domain types for Tenbagger backend.

export type ProviderName = "plaid" | "snaptrade";
export type HoldingSource = ProviderName | "manual";

export type AssetClass =
  | "equity"
  | "etf"
  | "mutual_fund"
  | "cash"
  | "crypto"
  | "option"
  | "fixed_income"
  | "other";

/** CONTRACT.md holdings shape (+ additive, optional fields). */
export interface ContractHolding {
  account_id: string;
  institution: string | null;
  /** null for cash, options and securities we could not map to a ticker (additive: contract shows string). */
  ticker: string | null;
  quantity: number;
  cost_basis: number | null;
  market_value: number;
  as_of: string; // YYYY-MM-DD
  source: HoldingSource;
  // additive fields
  name?: string | null;
  asset_class?: AssetClass;
  currency?: string;
}

export interface NormalizedAccount {
  provider_account_id: string;
  name: string;
  mask: string | null;
  type: string | null;
  subtype: string | null;
  institution_name: string | null;
  balance_current: number | null;
  currency: string;
}

export interface NormalizedSecurity {
  provider_security_id: string;
  ticker: string | null;
  cusip: string | null;
  isin: string | null;
  name: string | null;
  asset_class: AssetClass;
  is_cash_equivalent: boolean;
  underlying_ticker: string | null;
}

export interface NormalizedHolding {
  provider_account_id: string;
  provider_security_id: string;
  institution: string | null;
  ticker: string | null;
  name: string | null;
  asset_class: AssetClass;
  quantity: number;
  cost_basis: number | null;
  market_value: number;
  currency: string;
  as_of: string;
}

export type SyncWarningCode =
  | "unmapped_security"
  | "proxy_ticker_used"
  | "cusip_ticker_used"
  | "missing_cost_basis"
  | "non_usd"
  | "option_position"
  | "crypto_position"
  | "zero_quantity_skipped"
  | "invalid_identifier_dropped"
  | "missing_market_value"
  | "unknown_security"
  | "account_fetch_failed";

export interface SyncWarning {
  code: SyncWarningCode;
  message: string;
  provider_security_id?: string;
  provider_account_id?: string;
}

/** Output of every provider's holdings normalization; input of replace_item_holdings(). */
export interface NormalizedSnapshot {
  provider: ProviderName;
  as_of: string;
  accounts: NormalizedAccount[];
  securities: NormalizedSecurity[];
  holdings: NormalizedHolding[];
  warnings: SyncWarning[];
}

/** Map a normalized snapshot to the contract shape given provider_account_id -> account uuid. */
export function toContractHoldings(
  snap: NormalizedSnapshot,
  accountIdFor: (providerAccountId: string) => string,
): ContractHolding[] {
  return snap.holdings.map((h) => ({
    account_id: accountIdFor(h.provider_account_id),
    institution: h.institution,
    ticker: h.ticker,
    quantity: h.quantity,
    cost_basis: h.cost_basis,
    market_value: h.market_value,
    as_of: h.as_of,
    source: snap.provider,
    name: h.name,
    asset_class: h.asset_class,
    currency: h.currency,
  }));
}

// ---------------------------------------------------------------------------
// Money hub (cash, debt, transactions, income). Produced by normalize_plaid_money.ts,
// written by replace_item_money(), shaped for packages/money by money.ts.
// ---------------------------------------------------------------------------

/** Provenance of every number the Money hub shows. */
export type Basis = "verified" | "projected" | "manual";

export type MoneyWarningCode =
  | "investment_account_skipped"
  | "unsupported_account_type"
  | "non_usd"
  | "mortgage_skipped"
  | "transfer_stream_skipped"
  | "missing_due_date"
  | "product_unavailable"
  | "product_not_ready"
  | "retention_skipped";

export interface MoneyWarning {
  code: MoneyWarningCode;
  message: string;
  provider_account_id?: string;
}

export interface NormalizedCashAccount {
  provider_account_id: string;
  name: string;
  mask: string | null;
  subtype: string | null;
  balance_current: number | null;
  balance_available: number | null;
  currency: string;
}

export type LiabilityKind = "credit_card" | "student_loan" | "other_loan";

export interface NormalizedLiability {
  provider_account_id: string;
  kind: LiabilityKind;
  name: string;
  mask: string | null;
  /** Amount owed now (positive = owed). */
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
  /** true when statement / payment fields came from /liabilities/get. */
  details_available: boolean;
}

/** Output of getBalances(): depository accounts + debt accounts (balance-only). */
export interface NormalizedBalances {
  cash_accounts: NormalizedCashAccount[];
  /** credit / loan accounts with balance fields only; merged with getLiabilities() details. */
  debt_accounts: NormalizedLiability[];
  warnings: MoneyWarning[];
}

export interface NormalizedLiabilities {
  liabilities: NormalizedLiability[];
  warnings: MoneyWarning[];
}

export interface NormalizedTransaction {
  provider_transaction_id: string;
  provider_account_id: string;
  date: string;
  /** Signed from the user's view: + money in, − money out (Plaid's sign flipped). */
  amount: number;
  name: string | null;
  category: string | null;
  pending: boolean;
  currency: string;
}

export interface TransactionsDelta {
  added: NormalizedTransaction[];
  modified: NormalizedTransaction[];
  removed: string[];
  next_cursor: string;
}

export type IncomeFrequency = "weekly" | "biweekly" | "semi_monthly" | "monthly" | "annually" | "irregular" | "unknown";

export interface NormalizedIncomeStream {
  provider_stream_id: string;
  provider_account_id: string | null;
  description: string;
  category: string | null;
  frequency: IncomeFrequency;
  /** Positive = inflow. */
  average_amount: number | null;
  last_amount: number | null;
  last_date: string | null;
  predicted_next_date: string | null;
  status: "mature" | "early_detection" | "tombstoned" | "unknown";
  currency: string;
}

export interface NormalizedRecurring {
  income_streams: NormalizedIncomeStream[];
  warnings: MoneyWarning[];
}

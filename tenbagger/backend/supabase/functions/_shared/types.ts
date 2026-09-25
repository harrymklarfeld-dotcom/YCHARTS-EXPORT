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

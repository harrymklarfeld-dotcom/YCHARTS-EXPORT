// AggregatorProvider: the seam between edge-function handlers and Plaid / SnapTrade / mock.
// Handlers only ever talk to this interface, so providers can be swapped per environment
// (PROVIDER_MODE=mock for local dev + tests) and a new aggregator is one new class.
import type {
  NormalizedBalances,
  NormalizedLiabilities,
  NormalizedRecurring,
  NormalizedSnapshot,
  ProviderName,
  TransactionsDelta,
} from "../types.ts";

/** Decrypted credential. Lives only in edge-function memory; never serialized to clients or logs. */
export type ProviderCredential =
  | { kind: "plaid"; accessToken: string }
  | { kind: "snaptrade"; userId: string; userSecret: string };

export interface LinkSession {
  /** Plaid Link token (client opens Plaid Link with it). */
  linkToken?: string;
  /** SnapTrade Connection Portal URL (client opens in a browser / webview). */
  redirectUrl?: string;
  expiration?: string;
}

export interface ExchangeResult {
  providerItemId: string;
  accessToken: string;
  institution: { id: string | null; name: string | null };
}

export interface ProviderConnection {
  providerItemId: string;
  institution: { id: string | null; name: string | null };
  disabled: boolean;
}

export interface FetchHoldingsContext {
  providerItemId: string;
  institutionName: string | null;
  asOf: string; // YYYY-MM-DD
}

export interface AggregatorProvider {
  readonly name: ProviderName;

  /** SnapTrade only: create the aggregator-side user. Returns the secret to encrypt & store. */
  registerUser?(providerUserId: string): Promise<{ providerUserId: string; secret: string }>;

  /** Start a (read-only) link flow. `credential` present => update/re-auth mode where supported. */
  createLinkSession(input: {
    appUserId: string;
    credential?: ProviderCredential;
    redirectUri?: string;
    webhookUrl?: string;
    broker?: string;
    /** Money hub opt-in: also request Transactions + Liabilities (Plaid). */
    moneyHub?: boolean;
  }): Promise<LinkSession>;

  /** Plaid only: public_token -> access_token + item/institution metadata. */
  exchangePublicToken?(publicToken: string): Promise<ExchangeResult>;

  /** SnapTrade only: enumerate brokerage authorizations (each becomes a linked_item). */
  listConnections?(cred: ProviderCredential): Promise<ProviderConnection[]>;

  /** Fetch + normalize holdings for ONE linked item. */
  fetchHoldings(cred: ProviderCredential, ctx: FetchHoldingsContext): Promise<NormalizedSnapshot>;

  /** Revoke the connection at the aggregator (Plaid /item/remove, SnapTrade DELETE authorization). */
  removeConnection(cred: ProviderCredential, providerItemId: string): Promise<void>;

  /** SnapTrade only: delete the aggregator-side user and all its data. */
  deleteUser?(cred: ProviderCredential): Promise<void>;

  // ---- Money hub (Plaid only; optional so SnapTrade need not implement) ----------------
  /** Depository balances (current/available) + credit/loan balances. */
  getBalances?(cred: ProviderCredential): Promise<NormalizedBalances>;
  /** Credit-card / student-loan statement & payment details (Plaid /liabilities/get). */
  getLiabilities?(cred: ProviderCredential): Promise<NormalizedLiabilities>;
  /** Cursor-based transactions delta (Plaid /transactions/sync, all pages). `null` cursor = full history. */
  syncTransactions?(cred: ProviderCredential, cursor: string | null): Promise<TransactionsDelta>;
  /** Detected recurring INFLOW streams (Plaid /transactions/recurring/get). */
  getRecurring?(cred: ProviderCredential): Promise<NormalizedRecurring>;
}

/**
 * Plaid error codes meaning "this product/data is not available for this Item" (not an
 * Item failure): the Money hub records a warning and carries on with what it has.
 */
export const PRODUCT_UNAVAILABLE_CODES = new Set([
  "PRODUCTS_NOT_SUPPORTED",
  "PRODUCT_NOT_ENABLED",
  "ADDITIONAL_CONSENT_REQUIRED",
  "INVALID_PRODUCT",
  "NO_LIABILITY_ACCOUNTS",
  "NO_INVESTMENT_ACCOUNTS",
  "NO_INVESTMENT_HOLDINGS",
  "NO_ACCOUNTS",
]);

export class ProviderError extends Error {
  constructor(
    readonly provider: ProviderName,
    readonly code: string,
    message: string,
    readonly httpStatus?: number,
    /** true => item must go through Link update mode / reconnect. */
    readonly needsReauth = false,
    /** true => transient, safe to retry later (e.g. PRODUCT_NOT_READY, rate limit). */
    readonly retryable = false,
  ) {
    super(message);
  }
}

export type FetchLike = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;

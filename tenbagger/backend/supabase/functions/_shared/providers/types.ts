// AggregatorProvider: the seam between edge-function handlers and Plaid / SnapTrade / mock.
// Handlers only ever talk to this interface, so providers can be swapped per environment
// (PROVIDER_MODE=mock for local dev + tests) and a new aggregator is one new class.
import type { NormalizedSnapshot, ProviderName } from "../types.ts";

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
}

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

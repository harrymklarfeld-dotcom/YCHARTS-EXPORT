/**
 * Live money data layer: the shapes every MoneyClient speaks. Read-only by design: there is no
 * method that moves money, places an order or changes anything at a bank.
 *
 * Tokens (Plaid access tokens, public tokens, JWTs) never live in these shapes beyond the one call
 * that needs them, and nothing here is persisted except ids and timestamps (see ./store.ts).
 */
import type { MoneyData } from '../hub';

/**
 * active         syncing normally
 * needs_relogin  the bank wants the user to sign in again (Plaid ITEM_LOGIN_REQUIRED)
 * expiring       access ends soon unless the user signs in again (Plaid PENDING_EXPIRATION / PENDING_DISCONNECT)
 * error          the last update failed for another reason
 * revoked        the user removed access at the bank
 */
export type ConnectionStatus = 'active' | 'needs_relogin' | 'expiring' | 'error' | 'revoked';

export type Connection = {
  /** Backend linked_items.id (uuid) or a mock id. Not a secret. */
  id: string;
  /** Institution id when known (Plaid ins_…, or the mock catalogue id). */
  institutionId: string | null;
  institution: string;
  provider: 'plaid' | 'snaptrade' | 'mock';
  status: ConnectionStatus;
  /** Accounts under this connection; null when the backend could not say. */
  accountsCount: number | null;
  /** Last successful update (ISO timestamp), null if never. */
  lastSyncedAt: string | null;
  /** When the bank's consent runs out, if known. */
  consentExpiresAt?: string | null;
  /** True for sandbox / fictional connections. */
  sample: boolean;
};

export type LinkToken = { linkToken: string; expiration: string | null; mode: 'create' | 'update' };

export type RefreshResult = { id: string; ok: boolean; status: ConnectionStatus; code?: string };

export interface MoneyClient {
  readonly mode: 'mock' | 'http';
  listConnections(): Promise<Connection[]>;
  /**
   * create mode: a token for Plaid Link (mock: `institutionId` picks the fixture institution).
   * update mode (`itemId`): a token that lets the user sign in again to an existing connection.
   */
  createLinkToken(opts?: { itemId?: string; institutionId?: string }): Promise<LinkToken>;
  /** Swap Plaid Link's one-time public token for a connection (the access token stays on the server). */
  exchangePublicToken(publicToken: string): Promise<Connection>;
  refresh(connectionIds: string[]): Promise<RefreshResult[]>;
  unlink(id: string): Promise<void>;
  fetchSummary(): Promise<MoneyData>;
}

export class MoneyClientError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = 'MoneyClientError';
  }
}

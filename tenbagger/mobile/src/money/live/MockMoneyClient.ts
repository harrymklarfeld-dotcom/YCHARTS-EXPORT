/**
 * MockMoneyClient: the default client (no backend URL configured). Simulates Plaid-style linking
 * against the SANDBOX catalogue in ./mockFixtures.ts, entirely in memory. Fictional data only.
 *
 * Sandbox behaviour, so every status is visible:
 *   - Discover card links in `needs_relogin` (refresh fails until "Sign in again").
 *   - Ally Bank links as `expiring` (consent ends in 5 days until "Sign in again").
 *   - Sign in again = createLinkToken({itemId}) → Link (mock resolves) → refresh([itemId]).
 */
import { buildMockMoneyData, mockInstitution, MOCK_INSTITUTIONS, type MockInstitution } from './mockFixtures';
import { MoneyClientError, type Connection, type LinkToken, type MoneyClient, type RefreshResult } from './types';

/** Mock link tokens are `link-mock-…`, so they can never be confused with real `link-sandbox-…` Plaid tokens. */
export const MOCK_LINK_PREFIX = 'link-mock-';
export const MOCK_PUBLIC_PREFIX = 'public-mock-';

type MockConn = Connection & { institutionId: MockInstitution['id']; repairOnRefresh: boolean };

/** What the store persists so a mock session survives an app restart (ids + timestamps only). */
export type SavedConnection = { id: string; institutionId: string | null; lastSyncedAt: string | null; status?: Connection['status'] };

export class MockMoneyClient implements MoneyClient {
  readonly mode = 'mock' as const;
  private conns = new Map<string, MockConn>();
  private seq = 0;
  private readonly now: () => Date;

  constructor(opts: { now?: () => Date } = {}) {
    this.now = opts.now ?? (() => new Date());
  }

  /** Re-create sandbox connections from persisted ids (mock only; real connections live on the server). */
  restore(saved: readonly SavedConnection[]): void {
    for (const s of saved) {
      const inst = mockInstitution(s.institutionId);
      if (!inst || this.conns.has(s.id)) continue;
      const c = this.make(inst, s.id, s.lastSyncedAt ?? this.now().toISOString(), false);
      if (s.status) c.status = s.status;
      if (c.status !== 'expiring') c.consentExpiresAt = null;
      this.conns.set(s.id, c);
    }
  }

  async listConnections(): Promise<Connection[]> {
    return [...this.conns.values()].map(publicConn);
  }

  async createLinkToken(opts: { itemId?: string; institutionId?: string } = {}): Promise<LinkToken> {
    const expiration = new Date(this.now().getTime() + 4 * 3600_000).toISOString();
    if (opts.itemId) {
      const c = this.conns.get(opts.itemId);
      if (!c) throw new MoneyClientError('not_found', 'connection not found', 404);
      c.repairOnRefresh = true;
      return { linkToken: `${MOCK_LINK_PREFIX}update-${c.institutionId}-${++this.seq}`, expiration, mode: 'update' };
    }
    const inst = mockInstitution(opts.institutionId ?? MOCK_INSTITUTIONS[0].id);
    if (!inst) throw new MoneyClientError('invalid_request', 'unknown sandbox institution', 400);
    return { linkToken: `${MOCK_LINK_PREFIX}${inst.id}-${++this.seq}`, expiration, mode: 'create' };
  }

  async exchangePublicToken(publicToken: string): Promise<Connection> {
    const m = new RegExp(`^${MOCK_PUBLIC_PREFIX}([a-z]+)-\\d+$`).exec(publicToken);
    const inst = mockInstitution(m?.[1]);
    if (!inst) throw new MoneyClientError('invalid_request', 'not a sandbox public token', 400);
    const existing = [...this.conns.values()].find((c) => c.institutionId === inst.id);
    if (existing) return publicConn(existing);
    const c = this.make(inst, `mock-${inst.id}-${++this.seq}`, this.now().toISOString());
    this.conns.set(c.id, c);
    return publicConn(c);
  }

  async refresh(connectionIds: string[]): Promise<RefreshResult[]> {
    const nowIso = this.now().toISOString();
    return connectionIds.map((id) => {
      const c = this.conns.get(id);
      if (!c) return { id, ok: false, status: 'revoked', code: 'not_found' };
      if (c.repairOnRefresh) {
        c.repairOnRefresh = false;
        c.status = 'active';
        c.consentExpiresAt = null;
      }
      if (c.status === 'needs_relogin' || c.status === 'revoked') return { id, ok: false, status: c.status, code: 'ITEM_LOGIN_REQUIRED' };
      c.lastSyncedAt = nowIso;
      return { id, ok: true, status: c.status };
    });
  }

  async unlink(id: string): Promise<void> {
    this.conns.delete(id);
  }

  async fetchSummary() {
    const linked = [...this.conns.values()].map((c) => ({ institutionId: c.institutionId, lastSyncedAt: c.lastSyncedAt ?? this.now().toISOString() }));
    if (linked.length === 0) throw new MoneyClientError('no_connections', 'nothing linked yet', 404);
    return buildMockMoneyData(linked, this.now());
  }

  private make(inst: MockInstitution, id: string, syncedAt: string, fresh = true): MockConn {
    // A freshly linked connection that needs a sign-in last updated two days ago (its balances are older).
    const lastSyncedAt = fresh && inst.simulate === 'needs_relogin' ? new Date(Date.parse(syncedAt) - 2 * 86400_000).toISOString() : syncedAt;
    return {
      id,
      institutionId: inst.id,
      institution: inst.name,
      provider: 'mock',
      status: inst.simulate,
      accountsCount: inst.accountsCount,
      lastSyncedAt,
      consentExpiresAt: inst.simulate === 'expiring' ? new Date(this.now().getTime() + 5 * 86400_000).toISOString() : null,
      sample: true,
      repairOnRefresh: false,
    };
  }
}

function publicConn(c: MockConn): Connection {
  const { repairOnRefresh: _r, ...rest } = c;
  return { ...rest };
}

/** The sandbox catalogue the picker shows. */
export { MOCK_INSTITUTIONS };

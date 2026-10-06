/**
 * HttpMoneyClient: talks to the Supabase edge functions in tenbagger/backend with plain fetch.
 * Shapes mirror backend/supabase/functions/_shared/handlers.ts:
 *
 *   plaid-link-token  POST {item_id?, money_hub}      → {link_token, expiration, mode, money_hub}
 *   plaid-exchange    POST {public_token, money_hub}  → {item: PublicLinkedItem, sync, money?}
 *   money-sync        POST {item_id}                  → {results: [{item_id, status, error_code?, item_status?}], snapshot_id}
 *                                                       (409 {error:'item_needs_reauth'} when the bank wants a sign-in)
 *   unlink            POST {item_id}                  → {removed, provider_errors}
 *   money-summary     GET                             → MoneySummary (packages/money shapes)
 *
 * Connections are read from PostgREST under RLS (`linked_items`, non-secret columns only), and the
 * per-connection account count from `cash_accounts` / `accounts` / `liabilities`.
 *
 * Auth: `apikey` = the project's anon key (public by design), `Authorization: Bearer <user JWT>`
 * from the caller's getAccessToken(). Tokens are never stored by this client. Linking and
 * money-sync enable require an MFA (aal2) session on the backend.
 */
import { Platform } from 'react-native';
import type { Account, IncomeDeposit, IncomeStream, Liability, Snapshot } from '../engine';
import type { DetectedStream, MoneyData } from '../hub';
import { MoneyClientError, type Connection, type ConnectionStatus, type LinkToken, type MoneyClient, type RefreshResult } from './types';

type FetchLike = (input: string, init?: { method?: string; headers?: Record<string, string>; body?: string }) => Promise<{
  ok: boolean;
  status: number;
  json(): Promise<unknown>;
}>;

export type HttpMoneyClientOptions = {
  /** https://<project>.supabase.co (no trailing slash needed). */
  baseUrl: string;
  anonKey: string;
  /** The signed-in user's Supabase access token (JWT), or null when signed out. */
  getAccessToken: () => Promise<string | null>;
  fetch?: FetchLike;
};

/** linked_items row as PostgREST returns it (non-secret columns). */
type LinkedItemRow = {
  id: string;
  provider: 'plaid' | 'snaptrade';
  institution_id?: string | null;
  institution_name: string | null;
  status: 'active' | 'needs_reauth' | 'revoked' | 'error';
  status_reason: string | null;
  last_synced_at: string | null;
  money_synced_at?: string | null;
};

type SummaryJson = {
  asOf: string;
  horizonDays: number;
  accounts: Account[];
  liabilities: Liability[];
  incomeStreams: IncomeStream[];
  detectedStreams?: Array<DetectedStream & { asIncomeStream?: unknown }>;
  deposits: IncomeDeposit[];
  snapshots: Array<Snapshot & { id?: string; basis?: unknown; notes?: unknown }>;
};

export function mapItemStatus(status: LinkedItemRow['status'], reason: string | null): ConnectionStatus {
  if (status === 'needs_reauth') return reason === 'PENDING_EXPIRATION' || reason === 'PENDING_DISCONNECT' ? 'expiring' : 'needs_relogin';
  return status;
}

export function itemToConnection(r: LinkedItemRow, accountsCount: number | null): Connection {
  const synced = [r.last_synced_at, r.money_synced_at].filter((x): x is string => !!x).sort();
  return {
    id: r.id,
    institutionId: r.institution_id ?? null,
    institution: r.institution_name ?? 'Linked institution',
    provider: r.provider,
    status: mapItemStatus(r.status, r.status_reason),
    accountsCount,
    lastSyncedAt: synced.length ? synced[synced.length - 1] : null,
    sample: false,
  };
}

/** money-summary → the app's MoneyData. Extra backend fields (ids, notes, basis maps) are dropped. */
export function summaryToMoneyData(s: SummaryJson): MoneyData {
  let snapshots: Snapshot[] = (s.snapshots ?? []).map((x) => ({ takenAt: x.takenAt, accounts: x.accounts, liabilities: x.liabilities, note: x.note ?? '' }));
  if (snapshots.length === 0 && s.accounts?.length) {
    snapshots = [{ takenAt: s.asOf, accounts: s.accounts, liabilities: s.liabilities ?? [], note: '' }];
  }
  return {
    sample: false,
    sampleLabel: '',
    persona: { name: 'You', age: 0, year: '', blurb: '' },
    asOf: s.asOf,
    horizonDays: s.horizonDays ?? 30,
    streams: s.incomeStreams ?? [],
    deposits: s.deposits ?? [],
    snapshots,
    detectedStreams: (s.detectedStreams ?? []).map(({ asIncomeStream: _drop, ...d }) => d),
  };
}

export class HttpMoneyClient implements MoneyClient {
  readonly mode = 'http' as const;
  private readonly base: string;
  private readonly fetchImpl: FetchLike;

  constructor(private readonly opts: HttpMoneyClientOptions) {
    this.base = opts.baseUrl.replace(/\/+$/, '');
    this.fetchImpl = opts.fetch ?? ((input, init) => fetch(input, init));
  }

  private async headers(): Promise<Record<string, string>> {
    const jwt = await this.opts.getAccessToken();
    if (!jwt) throw new MoneyClientError('signed_out', 'Sign in to see linked accounts', 401);
    return { apikey: this.opts.anonKey, authorization: `Bearer ${jwt}`, 'content-type': 'application/json' };
  }

  private async call<T>(fn: string, body?: Record<string, unknown>, method: 'GET' | 'POST' = 'POST'): Promise<T> {
    const res = await this.fetchImpl(`${this.base}/functions/v1/${fn}`, {
      method,
      headers: await this.headers(),
      ...(method === 'POST' ? { body: JSON.stringify(body ?? {}) } : {}),
    });
    const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    if (!res.ok) throw new MoneyClientError(String(json.error ?? 'http_error'), String(json.message ?? `HTTP ${res.status}`), res.status);
    return json as T;
  }

  private async rest<T>(path: string): Promise<T> {
    const res = await this.fetchImpl(`${this.base}/rest/v1/${path}`, { method: 'GET', headers: await this.headers() });
    if (!res.ok) throw new MoneyClientError('rest_error', `HTTP ${res.status}`, res.status);
    return (await res.json()) as T;
  }

  async listConnections(): Promise<Connection[]> {
    const items = await this.rest<LinkedItemRow[]>(
      'linked_items?select=id,provider,institution_id,institution_name,status,status_reason,last_synced_at,money_synced_at',
    );
    const counts = await this.accountCounts().catch(() => null);
    return items.map((r) => itemToConnection(r, counts ? counts.get(r.id) ?? 0 : null));
  }

  private async accountCounts(): Promise<Map<string, number>> {
    const tables = ['cash_accounts', 'accounts', 'liabilities'];
    const rows = await Promise.all(tables.map((t) => this.rest<Array<{ linked_item_id: string | null }>>(`${t}?select=linked_item_id`)));
    const m = new Map<string, number>();
    for (const r of rows.flat()) if (r.linked_item_id) m.set(r.linked_item_id, (m.get(r.linked_item_id) ?? 0) + 1);
    return m;
  }

  async createLinkToken(opts: { itemId?: string } = {}): Promise<LinkToken> {
    const r = await this.call<{ link_token: string; expiration: string | null; mode: 'create' | 'update' }>('plaid-link-token', {
      money_hub: true,
      // Plaid OAuth (Chase): the backend sends redirect_uri for iOS/web, android_package_name for Android.
      platform: Platform.OS === 'android' ? 'android' : Platform.OS === 'ios' ? 'ios' : 'web',
      ...(opts.itemId ? { item_id: opts.itemId } : {}),
    });
    return { linkToken: r.link_token, expiration: r.expiration ?? null, mode: r.mode };
  }

  async exchangePublicToken(publicToken: string): Promise<Connection> {
    const r = await this.call<{ item: LinkedItemRow }>('plaid-exchange', { public_token: publicToken, money_hub: true });
    return itemToConnection(r.item, null);
  }

  async refresh(connectionIds: string[]): Promise<RefreshResult[]> {
    const out: RefreshResult[] = [];
    for (const id of connectionIds) {
      try {
        const r = await this.call<{ results: Array<{ item_id: string; status: string; error_code?: string; item_status?: LinkedItemRow['status'] }> }>(
          'money-sync',
          { item_id: id },
        );
        const x = r.results[0];
        const status = x?.item_status ? mapItemStatus(x.item_status, x.error_code ?? null) : 'active';
        out.push({ id, ok: !!x && (x.status === 'succeeded' || x.error_code === 'throttled'), status, code: x?.error_code });
      } catch (e) {
        const err = e as MoneyClientError;
        out.push({ id, ok: false, status: err.status === 409 ? 'needs_relogin' : 'error', code: err.code });
      }
    }
    return out;
  }

  async unlink(id: string): Promise<void> {
    await this.call('unlink', { item_id: id });
  }

  async fetchSummary(): Promise<MoneyData> {
    return summaryToMoneyData(await this.call<SummaryJson>('money-summary', undefined, 'GET'));
  }
}

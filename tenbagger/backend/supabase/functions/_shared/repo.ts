// Data access for edge functions. Runs as the service role over a direct Postgres
// connection (SUPABASE_DB_URL), so it bypasses RLS — EVERY query is therefore scoped by
// user_id explicitly. Tests run the same SQL against PGlite with the real migrations.
import type { NormalizedSnapshot, ProviderName } from "./types.ts";
import type { PortfolioRow } from "./portfolio.ts";

/** Minimal parameterized-query executor ($1, $2 … placeholders). */
export interface SqlExecutor {
  query<T = Record<string, unknown>>(text: string, params?: unknown[]): Promise<T[]>;
}

export type ItemStatus = "active" | "needs_reauth" | "revoked" | "error";

export interface LinkedItemRow {
  id: string;
  user_id: string;
  provider: ProviderName;
  provider_item_id: string;
  institution_id: string | null;
  institution_name: string | null;
  access_token_ciphertext: string | null;
  access_token_key_id: string | null;
  status: ItemStatus;
  status_reason: string | null;
  last_synced_at: string | null;
}

/** Client-safe projection: no ciphertext, no key id. */
export interface PublicLinkedItem {
  id: string;
  provider: ProviderName;
  institution_name: string | null;
  status: ItemStatus;
  status_reason: string | null;
  last_synced_at: string | null;
}

export function toPublicItem(r: LinkedItemRow): PublicLinkedItem {
  return {
    id: r.id,
    provider: r.provider,
    institution_name: r.institution_name,
    status: r.status,
    status_reason: r.status_reason,
    last_synced_at: r.last_synced_at ? new Date(r.last_synced_at).toISOString() : null,
  };
}

export interface AggregatorUserRow {
  user_id: string;
  provider: ProviderName;
  provider_user_id: string;
  secret_ciphertext: string | null;
  secret_key_id: string | null;
}

const ITEM_COLS = `id, user_id, provider, provider_item_id, institution_id, institution_name,
  access_token_ciphertext, access_token_key_id, status, status_reason, last_synced_at`;

const toNum = (v: unknown): number | null => (v === null || v === undefined ? null : Number(v));

export class Repo {
  constructor(private readonly db: SqlExecutor) {}

  async getLinkedItem(userId: string, itemId: string): Promise<LinkedItemRow | null> {
    const rows = await this.db.query<LinkedItemRow>(`select ${ITEM_COLS} from public.linked_items where id = $1 and user_id = $2`, [itemId, userId]);
    return rows[0] ?? null;
  }

  async getLinkedItemByProviderId(provider: ProviderName, providerItemId: string): Promise<LinkedItemRow | null> {
    const rows = await this.db.query<LinkedItemRow>(
      `select ${ITEM_COLS} from public.linked_items where provider = $1 and provider_item_id = $2`,
      [provider, providerItemId],
    );
    return rows[0] ?? null;
  }

  listLinkedItems(userId: string, provider?: ProviderName): Promise<LinkedItemRow[]> {
    return provider
      ? this.db.query<LinkedItemRow>(`select ${ITEM_COLS} from public.linked_items where user_id = $1 and provider = $2 order by created_at`, [userId, provider])
      : this.db.query<LinkedItemRow>(`select ${ITEM_COLS} from public.linked_items where user_id = $1 order by created_at`, [userId]);
  }

  /** Insert or refresh a linked item. Refuses to take over an item owned by another user. */
  async upsertLinkedItem(i: {
    userId: string;
    provider: ProviderName;
    providerItemId: string;
    institutionId: string | null;
    institutionName: string | null;
    tokenCiphertext: string | null;
    tokenKeyId: string | null;
    status?: ItemStatus;
  }): Promise<LinkedItemRow> {
    const rows = await this.db.query<LinkedItemRow>(
      `insert into public.linked_items (user_id, provider, provider_item_id, institution_id, institution_name,
                                        access_token_ciphertext, access_token_key_id, status)
       values ($1, $2, $3, $4, $5, $6, $7, coalesce($8, 'active'))
       on conflict (provider, provider_item_id) do update set
         institution_id = coalesce(excluded.institution_id, linked_items.institution_id),
         institution_name = coalesce(excluded.institution_name, linked_items.institution_name),
         access_token_ciphertext = coalesce(excluded.access_token_ciphertext, linked_items.access_token_ciphertext),
         access_token_key_id = coalesce(excluded.access_token_key_id, linked_items.access_token_key_id),
         status = case when $8::text is null then linked_items.status else excluded.status end,
         updated_at = now()
       where linked_items.user_id = excluded.user_id
       returning ${ITEM_COLS}`,
      [i.userId, i.provider, i.providerItemId, i.institutionId, i.institutionName, i.tokenCiphertext, i.tokenKeyId, i.status ?? null],
    );
    if (!rows[0]) throw new Error("linked item belongs to a different user");
    return rows[0];
  }

  async setItemStatus(itemId: string, status: ItemStatus, reason: string | null): Promise<void> {
    await this.db.query(`update public.linked_items set status = $2, status_reason = $3, updated_at = now() where id = $1`, [itemId, status, reason]);
  }

  /** Deletes the item; accounts + holdings cascade; ciphertext is gone with the row. */
  async deleteLinkedItem(userId: string, itemId: string): Promise<boolean> {
    const rows = await this.db.query(`delete from public.linked_items where id = $1 and user_id = $2 returning id`, [itemId, userId]);
    return rows.length > 0;
  }

  async getAggregatorUser(userId: string, provider: ProviderName): Promise<AggregatorUserRow | null> {
    const rows = await this.db.query<AggregatorUserRow>(
      `select user_id, provider, provider_user_id, secret_ciphertext, secret_key_id
         from public.aggregator_users where user_id = $1 and provider = $2`,
      [userId, provider],
    );
    return rows[0] ?? null;
  }

  async insertAggregatorUser(r: AggregatorUserRow): Promise<void> {
    await this.db.query(
      `insert into public.aggregator_users (user_id, provider, provider_user_id, secret_ciphertext, secret_key_id)
       values ($1, $2, $3, $4, $5)`,
      [r.user_id, r.provider, r.provider_user_id, r.secret_ciphertext, r.secret_key_id],
    );
  }

  async deleteAggregatorUser(userId: string, provider: ProviderName): Promise<void> {
    await this.db.query(`delete from public.aggregator_users where user_id = $1 and provider = $2`, [userId, provider]);
  }

  async startSyncRun(userId: string, itemId: string, provider: ProviderName, trigger: "user" | "webhook" | "link" | "schedule"): Promise<string> {
    const rows = await this.db.query<{ id: string }>(
      `insert into public.sync_runs (user_id, linked_item_id, provider, trigger) values ($1, $2, $3, $4) returning id`,
      [userId, itemId, provider, trigger],
    );
    return rows[0].id;
  }

  async finishSyncRun(runId: string, r: { status: "succeeded" | "partial" | "failed"; holdingsCount?: number; warnings?: unknown[]; errorCode?: string; errorMessage?: string }): Promise<void> {
    await this.db.query(
      `update public.sync_runs set status = $2, holdings_count = $3, warnings = $4::jsonb, error_code = $5,
              error_message = left($6, 500), finished_at = now() where id = $1`,
      [runId, r.status, r.holdingsCount ?? null, JSON.stringify(r.warnings ?? []), r.errorCode ?? null, r.errorMessage ?? null],
    );
  }

  async replaceItemHoldings(userId: string, itemId: string, snap: NormalizedSnapshot): Promise<{ holdings: number; accounts: number }> {
    const rows = await this.db.query<{ r: { holdings: number; accounts: number } | string }>(
      `select public.replace_item_holdings($1::uuid, $2::uuid, $3::jsonb) as r`,
      [userId, itemId, JSON.stringify(snap)],
    );
    const r = rows[0].r;
    return typeof r === "string" ? JSON.parse(r) : r;
  }

  async getPortfolioRows(userId: string): Promise<PortfolioRow[]> {
    const rows = await this.db.query<Record<string, unknown>>(
      `select h.ticker, h.name, h.asset_class, h.market_value, h.cost_basis, h.currency,
              c.name as company_name, c.sector, c.industry,
              m.pe, m.earnings_yield, m.fcf_yield, m.roic, m.dividend_yield, m.gross_margin,
              m.operating_margin, m.net_margin, m.revenue_growth_yoy, m.debt_to_equity,
              (c.ticker is not null) as in_universe
         from public.holdings h
         left join public.companies c
                on c.ticker = h.ticker and h.asset_class in ('equity', 'etf', 'mutual_fund', 'other')
         left join public.company_metrics m on m.ticker = c.ticker
        where h.user_id = $1`,
      [userId],
    );
    return rows.map((r) => ({
      ticker: (r.ticker as string) ?? null,
      name: (r.name as string) ?? null,
      asset_class: String(r.asset_class),
      market_value: Number(r.market_value),
      cost_basis: toNum(r.cost_basis),
      currency: String(r.currency),
      company: r.in_universe
        ? {
          name: String(r.company_name),
          sector: (r.sector as string) ?? null,
          industry: (r.industry as string) ?? null,
          metrics: {
            pe: toNum(r.pe),
            earnings_yield: toNum(r.earnings_yield),
            fcf_yield: toNum(r.fcf_yield),
            roic: toNum(r.roic),
            dividend_yield: toNum(r.dividend_yield),
            gross_margin: toNum(r.gross_margin),
            operating_margin: toNum(r.operating_margin),
            net_margin: toNum(r.net_margin),
            revenue_growth_yoy: toNum(r.revenue_growth_yoy),
            debt_to_equity: toNum(r.debt_to_equity),
          },
        }
        : null,
    }));
  }

  async audit(userId: string | null, action: string, detail: Record<string, unknown> = {}): Promise<void> {
    await this.db.query(`insert into public.audit_log (user_id, action, detail) values ($1, $2, $3::jsonb)`, [userId, action, JSON.stringify(detail)]);
  }
}

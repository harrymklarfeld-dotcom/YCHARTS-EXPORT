// Data access for edge functions. Runs as the service role over a direct Postgres
// connection (SUPABASE_DB_URL), so it bypasses RLS — EVERY query is therefore scoped by
// user_id explicitly. Tests run the same SQL against PGlite with the real migrations.
import type { NormalizedSnapshot, ProviderName } from "./types.ts";
import type { PortfolioRow } from "./portfolio.ts";
import type { MoneyItemPayload, MoneyRows } from "./money.ts";

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
  money_hub: boolean;
  money_synced_at: string | null;
  /** Plaid /transactions/sync cursor. Service-only (not granted to clients). */
  transactions_cursor: string | null;
}

/** Client-safe projection: no ciphertext, no key id. */
export interface PublicLinkedItem {
  id: string;
  provider: ProviderName;
  institution_name: string | null;
  status: ItemStatus;
  status_reason: string | null;
  last_synced_at: string | null;
  money_hub: boolean;
}

export function toPublicItem(r: LinkedItemRow): PublicLinkedItem {
  return {
    id: r.id,
    provider: r.provider,
    institution_name: r.institution_name,
    status: r.status,
    status_reason: r.status_reason,
    last_synced_at: r.last_synced_at ? new Date(r.last_synced_at).toISOString() : null,
    money_hub: r.money_hub === true,
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
  access_token_ciphertext, access_token_key_id, status, status_reason, last_synced_at,
  money_hub, money_synced_at, transactions_cursor`;

const toNum = (v: unknown): number | null => (v === null || v === undefined ? null : Number(v));
const toIso = (v: unknown): string | null => (v === null || v === undefined ? null : new Date(v as string).toISOString());
const toJson = (v: unknown): Record<string, unknown> => (typeof v === "string" ? JSON.parse(v) : (v as Record<string, unknown>));

export class Repo {
  constructor(private readonly db: SqlExecutor) {}

  async getLinkedItem(userId: string, itemId: string): Promise<LinkedItemRow | null> {
    const rows = await this.db.query<LinkedItemRow>(`select ${ITEM_COLS} from public.linked_items where id = $1 and user_id = $2`, [
      itemId,
      userId,
    ]);
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
      ? this.db.query<LinkedItemRow>(
        `select ${ITEM_COLS} from public.linked_items where user_id = $1 and provider = $2 order by created_at`,
        [userId, provider],
      )
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
    /** true => opt the item into the Money hub (never turns it off). */
    moneyHub?: boolean;
  }): Promise<LinkedItemRow> {
    const rows = await this.db.query<LinkedItemRow>(
      `insert into public.linked_items (user_id, provider, provider_item_id, institution_id, institution_name,
                                        access_token_ciphertext, access_token_key_id, status, money_hub)
       values ($1, $2, $3, $4, $5, $6, $7, coalesce($8, 'active'), $9)
       on conflict (provider, provider_item_id) do update set
         institution_id = coalesce(excluded.institution_id, linked_items.institution_id),
         institution_name = coalesce(excluded.institution_name, linked_items.institution_name),
         access_token_ciphertext = coalesce(excluded.access_token_ciphertext, linked_items.access_token_ciphertext),
         access_token_key_id = coalesce(excluded.access_token_key_id, linked_items.access_token_key_id),
         status = case when $8::text is null then linked_items.status else excluded.status end,
         money_hub = linked_items.money_hub or excluded.money_hub,
         updated_at = now()
       where linked_items.user_id = excluded.user_id
       returning ${ITEM_COLS}`,
      [
        i.userId,
        i.provider,
        i.providerItemId,
        i.institutionId,
        i.institutionName,
        i.tokenCiphertext,
        i.tokenKeyId,
        i.status ?? null,
        i.moneyHub === true,
      ],
    );
    if (!rows[0]) throw new Error("linked item belongs to a different user");
    return rows[0];
  }

  async setItemStatus(itemId: string, status: ItemStatus, reason: string | null): Promise<void> {
    await this.db.query(`update public.linked_items set status = $2, status_reason = $3, updated_at = now() where id = $1`, [
      itemId,
      status,
      reason,
    ]);
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

  async startSyncRun(
    userId: string,
    itemId: string,
    provider: ProviderName,
    trigger: "user" | "webhook" | "link" | "schedule",
    kind: "holdings" | "money" = "holdings",
  ): Promise<string> {
    const rows = await this.db.query<{ id: string }>(
      `insert into public.sync_runs (user_id, linked_item_id, provider, trigger, kind) values ($1, $2, $3, $4, $5) returning id`,
      [userId, itemId, provider, trigger, kind],
    );
    return rows[0].id;
  }

  async finishSyncRun(
    runId: string,
    r: {
      status: "succeeded" | "partial" | "failed";
      holdingsCount?: number;
      warnings?: unknown[];
      errorCode?: string;
      errorMessage?: string;
    },
  ): Promise<void> {
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

  // ---- Money hub -----------------------------------------------------------------------

  /** Opt an item in/out. Opting out deletes that item's money data (snapshots are append-only and stay). */
  async setMoneyHub(userId: string, itemId: string, on: boolean): Promise<void> {
    await this.db.query(
      `update public.linked_items set money_hub = $3, transactions_cursor = case when $3 then transactions_cursor else null end,
              updated_at = now() where id = $1 and user_id = $2`,
      [itemId, userId, on],
    );
    if (!on) {
      for (const t of ["cash_accounts", "liabilities", "transactions"]) {
        await this.db.query(`delete from public.${t} where linked_item_id = $1 and user_id = $2`, [itemId, userId]);
      }
      await this.db.query(`delete from public.income_streams where linked_item_id = $1 and user_id = $2 and source = 'plaid'`, [
        itemId,
        userId,
      ]);
    }
  }

  async replaceItemMoney(userId: string, itemId: string, payload: MoneyItemPayload): Promise<Record<string, number>> {
    const rows = await this.db.query<{ r: Record<string, number> | string }>(
      `select public.replace_item_money($1::uuid, $2::uuid, $3::jsonb) as r`,
      [userId, itemId, JSON.stringify(payload)],
    );
    return toJson(rows[0].r) as Record<string, number>;
  }

  async appendMoneySnapshot(
    userId: string,
    trigger: "sync" | "schedule" | "manual",
    snapshot: unknown,
    basis: Record<string, unknown>,
  ): Promise<string> {
    const rows = await this.db.query<{ id: string }>(
      `insert into public.money_snapshots (user_id, trigger, snapshot, basis) values ($1, $2, $3::jsonb, $4::jsonb) returning id`,
      [userId, trigger, JSON.stringify(snapshot), JSON.stringify(basis)],
    );
    return rows[0].id;
  }

  /** Everything money-summary needs, scoped to one user. Dates as YYYY-MM-DD text. */
  async getMoneyRows(userId: string, opts: { snapshotLookbackDays: number; depositHistoryDays: number; asOf: string }): Promise<MoneyRows> {
    const q = (sql: string, p: unknown[] = [userId]) => this.db.query<Record<string, unknown>>(sql, p);
    const s = (v: unknown) => (v === null || v === undefined ? null : String(v));
    const tz = await q(`select timezone from public.profiles where id = $1`);
    const cash = await q(
      `select c.id, c.name, c.mask, c.subtype, c.institution_name, c.balance_current, c.balance_available, c.currency, c.as_of
         from public.cash_accounts c join public.linked_items i on i.id = c.linked_item_id
        where c.user_id = $1 and i.money_hub order by c.name, c.id`,
    );
    // Investment balances: linked accounts use the provider balance (fallback: sum of holdings);
    // manual accounts use the sum of their manual holdings.
    const inv = await q(
      `select a.id, a.name, a.mask, a.subtype, a.institution_name,
              case when a.linked_item_id is null then 'manual' else i.provider end as source,
              coalesce(a.balance_current, (select sum(h.market_value) from public.holdings h where h.account_id = a.id)) as balance,
              a.currency, coalesce(i.last_synced_at, a.updated_at) as as_of
         from public.accounts a left join public.linked_items i on i.id = a.linked_item_id
        where a.user_id = $1
          and (a.linked_item_id is null or i.provider = 'snaptrade' or coalesce(a.type, 'investment') in ('investment', 'brokerage'))
        order by a.name, a.id`,
    );
    const liab = await q(
      `select l.id, l.kind, l.name, l.mask, l.institution_name, l.balance_current, l.last_statement_balance,
              l.minimum_payment_amount, l.next_payment_due_date::text as next_payment_due_date, l.last_payment_amount,
              l.last_payment_date::text as last_payment_date, l.apr_percentage, l.is_overdue, l.currency, l.details_available, l.as_of
         from public.liabilities l join public.linked_items i on i.id = l.linked_item_id
        where l.user_id = $1 and i.money_hub order by l.next_payment_due_date nulls last, l.id`,
    );
    const streams = await q(
      `select s.id, s.source, s.description, s.category, s.frequency, s.average_amount, s.last_amount,
              s.last_date::text as last_date, s.predicted_next_date::text as predicted_next_date, s.status, s.pay_type, s.rate,
              s.units_per_week, s.weekdays, s.next_pay_date::text as next_pay_date, s.withholding_rate, s.condition,
              s.pending_units, s.pending_period_end::text as pending_period_end, s.semimonthly_days, s.period_lag_days,
              s.weekend_rule, s.currency
         from public.income_streams s left join public.linked_items i on i.id = s.linked_item_id
        where s.user_id = $1 and (s.source = 'manual' or i.money_hub) order by s.source, s.description, s.id`,
    );
    const deposits = await q(
      `select t.date::text as date, t.amount
         from public.transactions t join public.linked_items i on i.id = t.linked_item_id
        where t.user_id = $1 and i.money_hub and t.amount > 0 and not t.pending and t.category = 'INCOME'
          and t.currency = 'USD' and t.date > $3::date - $2::int and t.date <= $3::date
        order by t.date, t.id`,
      [userId, opts.depositHistoryDays, opts.asOf],
    );
    const snaps = await q(
      `select s.id, s.snapshot, s.basis,
              coalesce((select jsonb_agg(jsonb_build_object('id', n.id, 'note', n.note, 'created_at', n.created_at) order by n.created_at)
                          from public.money_snapshot_notes n where n.snapshot_id = s.id), '[]'::jsonb) as notes
         from public.money_snapshots s
        where s.user_id = $1 and s.taken_at >= now() - make_interval(days => $2::int)
        order by s.taken_at desc, s.id`,
      [userId, opts.snapshotLookbackDays],
    );
    const sources = await q(
      `select id, institution_name, status, money_hub, money_synced_at from public.linked_items
        where user_id = $1 and provider = 'plaid' order by created_at`,
    );
    const nums = (v: unknown) => (Array.isArray(v) ? v.map(Number) : null);
    return {
      timezone: s(tz[0]?.timezone) ?? "UTC",
      cash: cash.map((r) => ({
        id: String(r.id),
        name: String(r.name),
        mask: s(r.mask),
        subtype: s(r.subtype),
        institution_name: s(r.institution_name),
        balance_current: toNum(r.balance_current),
        balance_available: toNum(r.balance_available),
        currency: String(r.currency),
        as_of: toIso(r.as_of)!,
      })),
      investments: inv.map((r) => ({
        id: String(r.id),
        name: String(r.name),
        mask: s(r.mask),
        subtype: s(r.subtype),
        institution_name: s(r.institution_name),
        source: r.source as "plaid" | "snaptrade" | "manual",
        balance: toNum(r.balance),
        currency: String(r.currency),
        as_of: toIso(r.as_of),
      })),
      liabilities: liab.map((r) => ({
        id: String(r.id),
        kind: r.kind as MoneyRows["liabilities"][number]["kind"],
        name: String(r.name),
        mask: s(r.mask),
        institution_name: s(r.institution_name),
        balance_current: toNum(r.balance_current),
        last_statement_balance: toNum(r.last_statement_balance),
        minimum_payment_amount: toNum(r.minimum_payment_amount),
        next_payment_due_date: s(r.next_payment_due_date),
        last_payment_amount: toNum(r.last_payment_amount),
        last_payment_date: s(r.last_payment_date),
        apr_percentage: toNum(r.apr_percentage),
        is_overdue: r.is_overdue === null || r.is_overdue === undefined ? null : Boolean(r.is_overdue),
        currency: String(r.currency),
        details_available: Boolean(r.details_available),
        as_of: toIso(r.as_of)!,
      })),
      streams: streams.map((r) => ({
        id: String(r.id),
        source: r.source as "plaid" | "manual",
        description: String(r.description),
        category: s(r.category),
        frequency: r.frequency as MoneyRows["streams"][number]["frequency"],
        average_amount: toNum(r.average_amount),
        last_amount: toNum(r.last_amount),
        last_date: s(r.last_date),
        predicted_next_date: s(r.predicted_next_date),
        status: String(r.status),
        pay_type: (r.pay_type ?? null) as MoneyRows["streams"][number]["pay_type"],
        rate: toNum(r.rate),
        units_per_week: toNum(r.units_per_week),
        weekdays: nums(r.weekdays),
        next_pay_date: s(r.next_pay_date),
        withholding_rate: toNum(r.withholding_rate),
        condition: s(r.condition),
        pending_units: toNum(r.pending_units),
        pending_period_end: s(r.pending_period_end),
        semimonthly_days: nums(r.semimonthly_days),
        period_lag_days: toNum(r.period_lag_days),
        weekend_rule: (r.weekend_rule ?? null) as MoneyRows["streams"][number]["weekend_rule"],
        currency: String(r.currency),
      })),
      deposits: deposits.map((r) => ({ date: String(r.date), amount: Number(r.amount) })),
      snapshots: snaps.map((r) => ({
        id: String(r.id),
        snapshot: toJson(r.snapshot),
        basis: toJson(r.basis),
        notes: (toJson(r.notes) as unknown as Array<{ id: string; note: string; created_at: string }>).map((n) => ({ ...n, created_at: toIso(n.created_at)! })),
      })),
      sources: sources.map((r) => ({
        id: String(r.id),
        institution_name: s(r.institution_name),
        status: String(r.status),
        money_hub: Boolean(r.money_hub),
        money_synced_at: toIso(r.money_synced_at),
      })),
    };
  }

  async audit(userId: string | null, action: string, detail: Record<string, unknown> = {}): Promise<void> {
    await this.db.query(`insert into public.audit_log (user_id, action, detail) values ($1, $2, $3::jsonb)`, [
      userId,
      action,
      JSON.stringify(detail),
    ]);
  }
}

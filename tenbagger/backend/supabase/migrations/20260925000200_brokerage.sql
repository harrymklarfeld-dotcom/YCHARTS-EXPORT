-- Tenbagger Phase 3 — read-only brokerage linking (Plaid / SnapTrade).
--
-- TOKEN STORAGE DECISION (see backend/SECURITY.md §4):
--   Provider access tokens / user secrets are encrypted in the EDGE FUNCTION with
--   AES-256-GCM (key from the TOKEN_ENCRYPTION_KEYS function secret) and stored here
--   as opaque text  "v1.<key_id>.<iv_b64url>.<ciphertext_b64url>"  plus a separate
--   `*_key_id` column for rotation bookkeeping. The AAD binds each ciphertext to
--   (provider, user_id, provider_item_id) so a ciphertext copied onto another row
--   will not decrypt.
--   Why not pgsodium Transparent Column Encryption? Supabase has deprecated pgsodium
--   TCE and discourages new usage. Why not one Vault secret per token? Vault is
--   designed for a handful of project-level secrets, and decrypted_secrets is
--   readable by anyone who can query the DB as postgres. With app-layer encryption a
--   database dump, a leaked backup, or a SQL-injection read yields only ciphertext:
--   the key never enters Postgres. Clients can never even SELECT the ciphertext
--   columns (column-level privileges below).

-- ---------------------------------------------------------------------------
-- aggregator_users: per-user provider identity (SnapTrade userId + userSecret)
-- ---------------------------------------------------------------------------
create table public.aggregator_users (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null references auth.users (id) on delete cascade,
  provider           text not null check (provider in ('plaid', 'snaptrade')),
  provider_user_id   text not null,
  secret_ciphertext  text,
  secret_key_id      text,
  created_at         timestamptz not null default now(),
  unique (user_id, provider),
  unique (provider, provider_user_id)
);

-- ---------------------------------------------------------------------------
-- linked_items: one per Plaid Item / SnapTrade brokerage authorization
-- ---------------------------------------------------------------------------
create table public.linked_items (
  id                        uuid primary key default gen_random_uuid(),
  user_id                   uuid not null references auth.users (id) on delete cascade,
  provider                  text not null check (provider in ('plaid', 'snaptrade')),
  provider_item_id          text not null check (char_length(provider_item_id) <= 200),
  institution_id            text,
  institution_name          text,
  access_token_ciphertext   text,   -- NULL for SnapTrade (credential lives in aggregator_users)
  access_token_key_id       text,
  status                    text not null default 'active'
                            check (status in ('active', 'needs_reauth', 'revoked', 'error')),
  status_reason             text,
  last_synced_at            timestamptz,
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now(),
  unique (provider, provider_item_id),
  check (provider <> 'plaid' or (access_token_ciphertext is not null and access_token_key_id is not null))
);
create index linked_items_user_idx on public.linked_items (user_id);

-- ---------------------------------------------------------------------------
-- accounts
-- ---------------------------------------------------------------------------
create table public.accounts (
  id                    uuid primary key default gen_random_uuid(),
  user_id               uuid not null references auth.users (id) on delete cascade,
  linked_item_id        uuid references public.linked_items (id) on delete cascade, -- NULL = manual account
  provider_account_id   text,
  name                  text not null default 'Account',
  mask                  text check (mask is null or char_length(mask) <= 8),
  type                  text,
  subtype               text,
  institution_name      text,
  balance_current       numeric,
  currency              text not null default 'USD',
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  unique (linked_item_id, provider_account_id)
);
create index accounts_user_idx on public.accounts (user_id);

-- ---------------------------------------------------------------------------
-- securities: provider security reference data (ticker / cusip / name)
-- ---------------------------------------------------------------------------
create table public.securities (
  id                     uuid primary key default gen_random_uuid(),
  provider               text not null check (provider in ('plaid', 'snaptrade', 'manual')),
  provider_security_id   text not null,
  ticker                 text,
  cusip                  text check (cusip is null or cusip ~ '^[0-9A-Z]{9}$'),
  isin                   text check (isin is null or isin ~ '^[A-Z]{2}[0-9A-Z]{10}$'),
  name                   text,
  asset_class            text not null default 'other'
                         check (asset_class in ('equity','etf','mutual_fund','cash','crypto','option','fixed_income','other')),
  is_cash_equivalent     boolean not null default false,
  underlying_ticker      text,
  updated_at             timestamptz not null default now(),
  unique (provider, provider_security_id)
);
create index securities_ticker_idx on public.securities (ticker);

-- ---------------------------------------------------------------------------
-- holdings (CONTRACT shape: account_id, institution, ticker, quantity,
--           cost_basis, market_value, as_of, source) + additive columns
-- ---------------------------------------------------------------------------
create table public.holdings (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users (id) on delete cascade,
  account_id      uuid not null references public.accounts (id) on delete cascade,
  security_id     uuid references public.securities (id) on delete set null,
  institution     text,
  ticker          text,            -- NULL for cash / options / unmapped securities
  name            text,
  asset_class     text not null default 'other'
                  check (asset_class in ('equity','etf','mutual_fund','cash','crypto','option','fixed_income','other')),
  quantity        numeric not null,
  cost_basis      numeric,         -- total cost basis in USD; NULL when provider omits it
  market_value    numeric not null,
  currency        text not null default 'USD',
  as_of           date not null,
  source          text not null check (source in ('plaid', 'snaptrade', 'manual')),
  created_at      timestamptz not null default now()
);
create index holdings_user_idx on public.holdings (user_id);
create index holdings_account_idx on public.holdings (account_id);

-- ---------------------------------------------------------------------------
-- sync_runs
-- ---------------------------------------------------------------------------
create table public.sync_runs (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users (id) on delete cascade,
  linked_item_id   uuid references public.linked_items (id) on delete set null,
  provider         text not null check (provider in ('plaid', 'snaptrade')),
  trigger          text not null default 'user' check (trigger in ('user', 'webhook', 'link', 'schedule')),
  status           text not null default 'running' check (status in ('running', 'succeeded', 'partial', 'failed')),
  holdings_count   integer,
  warnings         jsonb not null default '[]',
  error_code       text,
  error_message    text,
  started_at       timestamptz not null default now(),
  finished_at      timestamptz
);
create index sync_runs_user_idx on public.sync_runs (user_id, started_at desc);

-- ---------------------------------------------------------------------------
-- audit_log (service-role only; never exposed to clients)
-- ---------------------------------------------------------------------------
create table public.audit_log (
  id          bigint generated always as identity primary key,
  user_id     uuid,
  action      text not null,
  detail      jsonb not null default '{}',
  created_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Contract view (security_invoker => caller's RLS applies)
-- ---------------------------------------------------------------------------
create view public.holdings_contract with (security_invoker = true) as
  select h.account_id, h.institution, h.ticker, h.quantity, h.cost_basis,
         h.market_value, h.as_of, h.source,
         h.name, h.asset_class, h.currency
  from public.holdings h;

-- ---------------------------------------------------------------------------
-- Privileges
-- ---------------------------------------------------------------------------
alter table public.aggregator_users enable row level security;
alter table public.linked_items     enable row level security;
alter table public.accounts         enable row level security;
alter table public.securities       enable row level security;
alter table public.holdings         enable row level security;
alter table public.sync_runs        enable row level security;
alter table public.audit_log        enable row level security;

revoke all on public.aggregator_users, public.linked_items, public.accounts, public.securities,
              public.holdings, public.sync_runs, public.audit_log, public.holdings_contract
  from anon, authenticated;

grant all on public.aggregator_users, public.linked_items, public.accounts, public.securities,
             public.holdings, public.sync_runs, public.audit_log, public.holdings_contract
  to service_role;

-- linked_items: clients may read NON-secret columns only. Ciphertext columns are not granted.
grant select (id, user_id, provider, institution_id, institution_name, status, status_reason,
              last_synced_at, created_at, updated_at)
  on public.linked_items to authenticated;

grant select on public.accounts, public.securities, public.holdings, public.sync_runs,
                public.holdings_contract to authenticated;
-- Manual portfolios: users may maintain their own manual accounts/holdings.
grant insert (user_id, name, type, subtype, institution_name, currency),
      update (name, type, subtype, institution_name, currency),
      delete
  on public.accounts to authenticated;
grant insert (user_id, account_id, institution, ticker, name, asset_class, quantity, cost_basis,
              market_value, currency, as_of, source),
      update (ticker, name, asset_class, quantity, cost_basis, market_value, as_of),
      delete
  on public.holdings to authenticated;
-- aggregator_users & audit_log: no client access at all.

-- ---------------------------------------------------------------------------
-- RLS policies
-- ---------------------------------------------------------------------------
create policy linked_items_select_own on public.linked_items
  for select to authenticated using (user_id = auth.uid());

create policy accounts_select_own on public.accounts
  for select to authenticated using (user_id = auth.uid());
create policy accounts_insert_manual on public.accounts
  for insert to authenticated with check (user_id = auth.uid() and linked_item_id is null);
create policy accounts_update_manual on public.accounts
  for update to authenticated using (user_id = auth.uid() and linked_item_id is null)
  with check (user_id = auth.uid() and linked_item_id is null);
create policy accounts_delete_manual on public.accounts
  for delete to authenticated using (user_id = auth.uid() and linked_item_id is null);

create policy holdings_select_own on public.holdings
  for select to authenticated using (user_id = auth.uid());
-- Aggregator-sourced holdings are written ONLY by service_role (edge functions).
create policy holdings_insert_manual on public.holdings
  for insert to authenticated with check (
    user_id = auth.uid() and source = 'manual'
    and exists (select 1 from public.accounts a
                where a.id = account_id and a.user_id = auth.uid() and a.linked_item_id is null));
create policy holdings_update_manual on public.holdings
  for update to authenticated using (user_id = auth.uid() and source = 'manual')
  with check (user_id = auth.uid() and source = 'manual');
create policy holdings_delete_manual on public.holdings
  for delete to authenticated using (user_id = auth.uid() and source = 'manual');

-- Securities are only visible if the caller holds them (no enumeration of other users' positions).
create policy securities_select_held on public.securities
  for select to authenticated using (
    exists (select 1 from public.holdings h where h.security_id = securities.id and h.user_id = auth.uid()));

create policy sync_runs_select_own on public.sync_runs
  for select to authenticated using (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- replace_item_holdings: atomic snapshot write used by sync edge functions.
-- Payload = output of normalizePlaidHoldings / normalizeSnapTradeHoldings.
-- ---------------------------------------------------------------------------
create or replace function public.replace_item_holdings(p_user_id uuid, p_item_id uuid, p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_item   public.linked_items;
  v_as_of  date := coalesce((p_payload->>'as_of')::date, current_date);
  v_acct_ids text[];
  v_n      integer;
begin
  select * into v_item from public.linked_items where id = p_item_id;
  if not found or v_item.user_id <> p_user_id then
    raise exception 'linked item not found for user' using errcode = '42501';
  end if;

  -- accounts (upsert, then drop ones that disappeared at the institution)
  insert into public.accounts (user_id, linked_item_id, provider_account_id, name, mask, type, subtype,
                               institution_name, balance_current, currency, updated_at)
  select p_user_id, p_item_id, a->>'provider_account_id', coalesce(a->>'name', 'Account'), a->>'mask',
         a->>'type', a->>'subtype', coalesce(a->>'institution_name', v_item.institution_name),
         (a->>'balance_current')::numeric, coalesce(a->>'currency', 'USD'), now()
  from jsonb_array_elements(coalesce(p_payload->'accounts', '[]')) a
  on conflict (linked_item_id, provider_account_id) do update set
    name = excluded.name, mask = excluded.mask, type = excluded.type, subtype = excluded.subtype,
    institution_name = excluded.institution_name, balance_current = excluded.balance_current,
    currency = excluded.currency, updated_at = now();

  select coalesce(array_agg(a->>'provider_account_id'), '{}') into v_acct_ids
  from jsonb_array_elements(coalesce(p_payload->'accounts', '[]')) a;
  delete from public.accounts
   where linked_item_id = p_item_id and not (provider_account_id = any(v_acct_ids));

  -- securities (global reference data keyed by provider id)
  insert into public.securities (provider, provider_security_id, ticker, cusip, isin, name, asset_class,
                                 is_cash_equivalent, underlying_ticker, updated_at)
  select v_item.provider, s->>'provider_security_id', s->>'ticker', s->>'cusip', s->>'isin', s->>'name',
         coalesce(s->>'asset_class', 'other'), coalesce((s->>'is_cash_equivalent')::boolean, false),
         s->>'underlying_ticker', now()
  from jsonb_array_elements(coalesce(p_payload->'securities', '[]')) s
  on conflict (provider, provider_security_id) do update set
    ticker = excluded.ticker, cusip = excluded.cusip, isin = excluded.isin, name = excluded.name,
    asset_class = excluded.asset_class, is_cash_equivalent = excluded.is_cash_equivalent,
    underlying_ticker = excluded.underlying_ticker, updated_at = now();

  -- holdings: full snapshot replace for this item
  delete from public.holdings h using public.accounts a
   where h.account_id = a.id and a.linked_item_id = p_item_id;

  insert into public.holdings (user_id, account_id, security_id, institution, ticker, name, asset_class,
                               quantity, cost_basis, market_value, currency, as_of, source)
  select p_user_id, a.id, s.id, coalesce(h->>'institution', a.institution_name), h->>'ticker', h->>'name',
         coalesce(h->>'asset_class', 'other'), (h->>'quantity')::numeric, (h->>'cost_basis')::numeric,
         (h->>'market_value')::numeric, coalesce(h->>'currency', 'USD'),
         coalesce((h->>'as_of')::date, v_as_of), v_item.provider
  from jsonb_array_elements(coalesce(p_payload->'holdings', '[]')) h
  join public.accounts a on a.linked_item_id = p_item_id and a.provider_account_id = h->>'provider_account_id'
  left join public.securities s on s.provider = v_item.provider
                               and s.provider_security_id = h->>'provider_security_id';
  get diagnostics v_n = row_count;

  update public.linked_items set last_synced_at = now(), updated_at = now(),
         status = case when status = 'error' then 'active' else status end,
         status_reason = case when status = 'error' then null else status_reason end
   where id = p_item_id;

  return jsonb_build_object('holdings', v_n, 'accounts', coalesce(array_length(v_acct_ids, 1), 0));
end;
$$;

revoke all on function public.replace_item_holdings(uuid, uuid, jsonb) from public, anon, authenticated;
grant execute on function public.replace_item_holdings(uuid, uuid, jsonb) to service_role;

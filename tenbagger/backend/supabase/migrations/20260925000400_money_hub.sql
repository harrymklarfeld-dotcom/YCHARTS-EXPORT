-- Tenbagger — Money hub: cash, credit-card debt, transactions, income streams, snapshots.
--
-- Purpose: give students with irregular income one place for "what I have" (cash vs
-- investments vs debt) and a forward cash-flow check (cash now + expected income before
-- the card due date − amount due). The math lives in packages/money; these tables are
-- its data layer.
--
-- Data minimization (SECURITY.md §2): we store only the fields that check needs. No full
-- account numbers, no routing numbers, no transaction locations or counterparties beyond
-- a display name, no student-loan servicer details. Transactions older than 24 months
-- are never inserted and are purged by purge_money_retention() (schedule: TODO).
--
-- Write model (same as holdings):
--   * Provider data (cash_accounts, liabilities, transactions, plaid income streams) is
--     written ONLY by service_role through replace_item_money().
--   * Users may create / edit / delete their own MANUAL income streams and append notes
--     to their own snapshots.
--   * money_snapshots and money_snapshot_notes are APPEND-ONLY: a trigger rejects every
--     UPDATE and every DELETE, except the cascade that runs when the owning auth user is
--     deleted (account deletion must still dispose of all customer information).

-- ---------------------------------------------------------------------------
-- linked_items: Money-hub opt-in + transactions cursor
-- ---------------------------------------------------------------------------
alter table public.linked_items
  add column money_hub            boolean not null default false,
  add column money_synced_at      timestamptz,
  add column transactions_cursor  text check (transactions_cursor is null or char_length(transactions_cursor) <= 1024);

-- Clients may see the opt-in state and freshness; the cursor stays service-only.
grant select (money_hub, money_synced_at) on public.linked_items to authenticated;

alter table public.sync_runs
  add column kind text not null default 'holdings' check (kind in ('holdings', 'money'));

-- ---------------------------------------------------------------------------
-- cash_accounts: depository accounts (checking / savings / prepaid / cash management)
-- ---------------------------------------------------------------------------
create table public.cash_accounts (
  id                   uuid primary key default gen_random_uuid(),
  user_id              uuid not null references auth.users (id) on delete cascade,
  linked_item_id       uuid not null references public.linked_items (id) on delete cascade,
  provider_account_id  text not null check (char_length(provider_account_id) <= 200),
  name                 text not null default 'Account' check (char_length(name) <= 120),
  mask                 text check (mask is null or char_length(mask) <= 8),
  subtype              text check (subtype is null or char_length(subtype) <= 40),
  institution_name     text,
  balance_current      numeric,
  balance_available    numeric,
  currency             text not null default 'USD',
  as_of                timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  unique (linked_item_id, provider_account_id)
);
create index cash_accounts_user_idx on public.cash_accounts (user_id);

-- ---------------------------------------------------------------------------
-- liabilities: credit cards (Plaid /liabilities/get "credit") + student loans (payment
-- fields only). Balance fields come from the account balance; statement/payment fields
-- from /liabilities/get when that product is available (NULL otherwise).
-- ---------------------------------------------------------------------------
create table public.liabilities (
  id                      uuid primary key default gen_random_uuid(),
  user_id                 uuid not null references auth.users (id) on delete cascade,
  linked_item_id          uuid not null references public.linked_items (id) on delete cascade,
  provider_account_id     text not null check (char_length(provider_account_id) <= 200),
  kind                    text not null check (kind in ('credit_card', 'student_loan', 'other_loan')),
  name                    text not null default 'Account' check (char_length(name) <= 120),
  mask                    text check (mask is null or char_length(mask) <= 8),
  institution_name        text,
  balance_current         numeric,          -- amount owed now (positive = owed)
  credit_limit            numeric,
  last_statement_balance  numeric,
  last_statement_date     date,
  minimum_payment_amount  numeric,
  next_payment_due_date   date,
  last_payment_amount     numeric,
  last_payment_date       date,
  apr_percentage          numeric check (apr_percentage is null or apr_percentage between 0 and 100),
  is_overdue              boolean,
  currency                text not null default 'USD',
  details_available       boolean not null default false,  -- true when /liabilities/get fields are present
  as_of                   timestamptz not null default now(),
  updated_at              timestamptz not null default now(),
  unique (linked_item_id, provider_account_id)
);
create index liabilities_user_idx on public.liabilities (user_id);

-- ---------------------------------------------------------------------------
-- transactions: minimal columns (Plaid /transactions/sync). amount is SIGNED from the
-- user's point of view: positive = money in, negative = money out (Plaid's sign flipped).
-- ---------------------------------------------------------------------------
create table public.transactions (
  id                        uuid primary key default gen_random_uuid(),
  user_id                   uuid not null references auth.users (id) on delete cascade,
  linked_item_id            uuid not null references public.linked_items (id) on delete cascade,
  provider_transaction_id   text not null check (char_length(provider_transaction_id) <= 200),
  provider_account_id       text not null check (char_length(provider_account_id) <= 200),
  date                      date not null,
  amount                    numeric not null,
  name                      text check (name is null or char_length(name) <= 140),
  category                  text check (category is null or char_length(category) <= 80),
  pending                   boolean not null default false,
  currency                  text not null default 'USD',
  updated_at                timestamptz not null default now(),
  unique (linked_item_id, provider_transaction_id)
);
create index transactions_user_date_idx on public.transactions (user_id, date desc);

-- ---------------------------------------------------------------------------
-- income_streams: detected (Plaid recurring inflows) + manual (user-entered)
-- ---------------------------------------------------------------------------
create table public.income_streams (
  id                   uuid primary key default gen_random_uuid(),
  user_id              uuid not null references auth.users (id) on delete cascade,
  source               text not null check (source in ('plaid', 'manual')),
  linked_item_id       uuid references public.linked_items (id) on delete cascade,
  provider_stream_id   text check (provider_stream_id is null or char_length(provider_stream_id) <= 200),
  provider_account_id  text,
  description          text not null check (char_length(description) between 1 and 140),
  category             text check (category is null or char_length(category) <= 80),
  frequency            text not null default 'unknown'
                       check (frequency in ('weekly', 'biweekly', 'semi_monthly', 'monthly', 'annually', 'irregular', 'unknown')),
  average_amount       numeric,             -- detected: Plaid average (positive = inflow)
  last_amount          numeric,
  last_date            date,
  predicted_next_date  date,
  status               text not null default 'active'
                       check (status in ('mature', 'early_detection', 'tombstoned', 'unknown', 'active', 'paused')),
  -- manual-only fields
  pay_type             text check (pay_type is null or pay_type in ('hourly', 'per_session', 'salary')),
  rate                 numeric check (rate is null or (rate >= 0 and rate <= 1000000)),
  units_per_period     numeric check (units_per_period is null or (units_per_period >= 0 and units_per_period <= 1000)),
  next_pay_date        date,
  withholding_rate     numeric check (withholding_rate is null or (withholding_rate >= 0 and withholding_rate < 1)),
  condition            text check (condition is null or char_length(condition) <= 200),
  currency             text not null default 'USD',
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  unique (linked_item_id, provider_stream_id),
  check (source <> 'plaid' or (linked_item_id is not null and provider_stream_id is not null and pay_type is null)),
  check (source <> 'manual' or (linked_item_id is null and provider_stream_id is null and pay_type is not null and rate is not null
                                and status in ('active', 'paused')))
);
create index income_streams_user_idx on public.income_streams (user_id);

-- ---------------------------------------------------------------------------
-- money_snapshots (APPEND-ONLY) + notes (APPEND-ONLY)
-- ---------------------------------------------------------------------------
create table public.money_snapshots (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  taken_at    timestamptz not null default now(),
  trigger     text not null default 'sync' check (trigger in ('sync', 'schedule', 'manual')),
  snapshot    jsonb not null check (jsonb_typeof(snapshot) = 'object'),
  basis       jsonb not null check (jsonb_typeof(basis) = 'object')   -- field -> 'verified' | 'projected' | 'manual'
);
create index money_snapshots_user_idx on public.money_snapshots (user_id, taken_at desc);

create table public.money_snapshot_notes (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users (id) on delete cascade,
  snapshot_id  uuid not null references public.money_snapshots (id) on delete cascade,
  note         text not null check (char_length(note) between 1 and 500),
  created_at   timestamptz not null default now()
);
create index money_snapshot_notes_snapshot_idx on public.money_snapshot_notes (snapshot_id);

-- Reject UPDATE always; reject DELETE unless the owning auth user no longer exists, which
-- is only true inside the ON DELETE CASCADE from auth.users (account deletion). Applies to
-- every role, including service_role and postgres (triggers are not bypassed by BYPASSRLS).
create or replace function public.enforce_append_only()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'DELETE' and not exists (select 1 from auth.users u where u.id = old.user_id) then
    return old;
  end if;
  raise exception '% is append-only (% rejected)', tg_table_name, tg_op using errcode = '42501';
end;
$$;
revoke all on function public.enforce_append_only() from public, anon, authenticated;

create trigger money_snapshots_append_only
  before update or delete on public.money_snapshots
  for each row execute function public.enforce_append_only();
create trigger money_snapshot_notes_append_only
  before update or delete on public.money_snapshot_notes
  for each row execute function public.enforce_append_only();
-- TRUNCATE bypasses row triggers; block it too.
create or replace function public.reject_truncate()
returns trigger language plpgsql as $$
begin
  raise exception '% is append-only (TRUNCATE rejected)', tg_table_name using errcode = '42501';
end;
$$;
revoke all on function public.reject_truncate() from public, anon, authenticated;
create trigger money_snapshots_no_truncate before truncate on public.money_snapshots
  for each statement execute function public.reject_truncate();
create trigger money_snapshot_notes_no_truncate before truncate on public.money_snapshot_notes
  for each statement execute function public.reject_truncate();

-- ---------------------------------------------------------------------------
-- Privileges + RLS
-- ---------------------------------------------------------------------------
alter table public.cash_accounts        enable row level security;
alter table public.liabilities          enable row level security;
alter table public.transactions         enable row level security;
alter table public.income_streams       enable row level security;
alter table public.money_snapshots      enable row level security;
alter table public.money_snapshot_notes enable row level security;

revoke all on public.cash_accounts, public.liabilities, public.transactions, public.income_streams,
              public.money_snapshots, public.money_snapshot_notes
  from anon, authenticated;
grant all on public.cash_accounts, public.liabilities, public.transactions, public.income_streams,
             public.money_snapshots, public.money_snapshot_notes
  to service_role;

grant select on public.cash_accounts, public.liabilities, public.transactions, public.income_streams,
                public.money_snapshots, public.money_snapshot_notes
  to authenticated;
-- Manual income streams: users choose only the manual fields; source/status are pinned by policy.
grant insert (user_id, source, description, frequency, status, pay_type, rate, units_per_period, next_pay_date,
              withholding_rate, condition, currency),
      update (description, frequency, status, pay_type, rate, units_per_period, next_pay_date, withholding_rate,
              condition, currency),
      delete
  on public.income_streams to authenticated;
grant insert (user_id, snapshot_id, note) on public.money_snapshot_notes to authenticated;

create policy cash_accounts_select_own on public.cash_accounts
  for select to authenticated using (user_id = auth.uid());
create policy liabilities_select_own on public.liabilities
  for select to authenticated using (user_id = auth.uid());
create policy transactions_select_own on public.transactions
  for select to authenticated using (user_id = auth.uid());

create policy income_streams_select_own on public.income_streams
  for select to authenticated using (user_id = auth.uid());
create policy income_streams_insert_manual on public.income_streams
  for insert to authenticated with check (user_id = auth.uid() and source = 'manual');
create policy income_streams_update_manual on public.income_streams
  for update to authenticated using (user_id = auth.uid() and source = 'manual')
  with check (user_id = auth.uid() and source = 'manual');
create policy income_streams_delete_manual on public.income_streams
  for delete to authenticated using (user_id = auth.uid() and source = 'manual');

create policy money_snapshots_select_own on public.money_snapshots
  for select to authenticated using (user_id = auth.uid());
create policy money_snapshot_notes_select_own on public.money_snapshot_notes
  for select to authenticated using (user_id = auth.uid());
create policy money_snapshot_notes_insert_own on public.money_snapshot_notes
  for insert to authenticated with check (
    user_id = auth.uid()
    and exists (select 1 from public.money_snapshots s where s.id = snapshot_id and s.user_id = auth.uid()));

-- ---------------------------------------------------------------------------
-- replace_item_money: atomic write of one item's money data (service_role only).
-- Payload = MoneyItemPayload from _shared/money.ts:
--   {cash_accounts[], liabilities[], transactions: {added[], modified[], removed[], next_cursor} | null,
--    income_streams[] | null}
-- A NULL section means "not fetched this time" (e.g. PRODUCT_NOT_READY): existing rows are kept.
-- ---------------------------------------------------------------------------
create or replace function public.replace_item_money(p_user_id uuid, p_item_id uuid, p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_item      public.linked_items;
  v_ids       text[];
  v_cash      integer := 0;
  v_liab      integer := 0;
  v_tx_upsert integer := 0;
  v_tx_del    integer := 0;
  v_tx_old    integer := 0;
  v_streams   integer := 0;
  v_cutoff    date := (current_date - interval '24 months')::date;
  v_tx        jsonb := p_payload->'transactions';
begin
  select * into v_item from public.linked_items where id = p_item_id;
  if not found or v_item.user_id <> p_user_id then
    raise exception 'linked item not found for user' using errcode = '42501';
  end if;

  -- cash accounts
  if jsonb_typeof(p_payload->'cash_accounts') = 'array' then
    insert into public.cash_accounts (user_id, linked_item_id, provider_account_id, name, mask, subtype, institution_name,
                                      balance_current, balance_available, currency, as_of, updated_at)
    select p_user_id, p_item_id, a->>'provider_account_id', coalesce(a->>'name', 'Account'), a->>'mask', a->>'subtype',
           coalesce(a->>'institution_name', v_item.institution_name),
           (a->>'balance_current')::numeric, (a->>'balance_available')::numeric, coalesce(a->>'currency', 'USD'), now(), now()
    from jsonb_array_elements(p_payload->'cash_accounts') a
    on conflict (linked_item_id, provider_account_id) do update set
      name = excluded.name, mask = excluded.mask, subtype = excluded.subtype, institution_name = excluded.institution_name,
      balance_current = excluded.balance_current, balance_available = excluded.balance_available,
      currency = excluded.currency, as_of = now(), updated_at = now();
    get diagnostics v_cash = row_count;
    select coalesce(array_agg(a->>'provider_account_id'), '{}') into v_ids from jsonb_array_elements(p_payload->'cash_accounts') a;
    delete from public.cash_accounts where linked_item_id = p_item_id and not (provider_account_id = any(v_ids));
  end if;

  -- liabilities
  if jsonb_typeof(p_payload->'liabilities') = 'array' then
    insert into public.liabilities (user_id, linked_item_id, provider_account_id, kind, name, mask, institution_name,
                                    balance_current, credit_limit, last_statement_balance, last_statement_date,
                                    minimum_payment_amount, next_payment_due_date, last_payment_amount, last_payment_date,
                                    apr_percentage, is_overdue, currency, details_available, as_of, updated_at)
    select p_user_id, p_item_id, l->>'provider_account_id', l->>'kind', coalesce(l->>'name', 'Account'), l->>'mask',
           coalesce(l->>'institution_name', v_item.institution_name),
           (l->>'balance_current')::numeric, (l->>'credit_limit')::numeric, (l->>'last_statement_balance')::numeric,
           (l->>'last_statement_date')::date, (l->>'minimum_payment_amount')::numeric, (l->>'next_payment_due_date')::date,
           (l->>'last_payment_amount')::numeric, (l->>'last_payment_date')::date, (l->>'apr_percentage')::numeric,
           (l->>'is_overdue')::boolean, coalesce(l->>'currency', 'USD'), coalesce((l->>'details_available')::boolean, false),
           now(), now()
    from jsonb_array_elements(p_payload->'liabilities') l
    on conflict (linked_item_id, provider_account_id) do update set
      kind = excluded.kind, name = excluded.name, mask = excluded.mask, institution_name = excluded.institution_name,
      balance_current = excluded.balance_current, credit_limit = excluded.credit_limit,
      last_statement_balance = excluded.last_statement_balance, last_statement_date = excluded.last_statement_date,
      minimum_payment_amount = excluded.minimum_payment_amount, next_payment_due_date = excluded.next_payment_due_date,
      last_payment_amount = excluded.last_payment_amount, last_payment_date = excluded.last_payment_date,
      apr_percentage = excluded.apr_percentage, is_overdue = excluded.is_overdue, currency = excluded.currency,
      details_available = excluded.details_available, as_of = now(), updated_at = now();
    get diagnostics v_liab = row_count;
    select coalesce(array_agg(l->>'provider_account_id'), '{}') into v_ids from jsonb_array_elements(p_payload->'liabilities') l;
    delete from public.liabilities where linked_item_id = p_item_id and not (provider_account_id = any(v_ids));
  end if;

  -- transactions (cursor-based delta)
  if jsonb_typeof(v_tx) = 'object' then
    select count(*) into v_tx_old
      from jsonb_array_elements(coalesce(v_tx->'added', '[]') || coalesce(v_tx->'modified', '[]')) t
     where (t->>'date')::date < v_cutoff;

    insert into public.transactions (user_id, linked_item_id, provider_transaction_id, provider_account_id, date, amount,
                                     name, category, pending, currency, updated_at)
    select distinct on (t->>'provider_transaction_id')
           p_user_id, p_item_id, t->>'provider_transaction_id', t->>'provider_account_id', (t->>'date')::date,
           (t->>'amount')::numeric, left(t->>'name', 140), left(t->>'category', 80),
           coalesce((t->>'pending')::boolean, false), coalesce(t->>'currency', 'USD'), now()
    from jsonb_array_elements(coalesce(v_tx->'added', '[]') || coalesce(v_tx->'modified', '[]')) with ordinality as x(t, ord)
    where (t->>'date')::date >= v_cutoff
    order by t->>'provider_transaction_id', ord desc   -- a later "modified" wins over "added"
    on conflict (linked_item_id, provider_transaction_id) do update set
      provider_account_id = excluded.provider_account_id, date = excluded.date, amount = excluded.amount,
      name = excluded.name, category = excluded.category, pending = excluded.pending, currency = excluded.currency,
      updated_at = now();
    get diagnostics v_tx_upsert = row_count;

    delete from public.transactions
     where linked_item_id = p_item_id
       and provider_transaction_id in (select jsonb_array_elements_text(coalesce(v_tx->'removed', '[]')));
    get diagnostics v_tx_del = row_count;

    update public.linked_items set transactions_cursor = v_tx->>'next_cursor' where id = p_item_id;
  end if;

  -- detected income streams (manual streams are never touched here)
  if jsonb_typeof(p_payload->'income_streams') = 'array' then
    insert into public.income_streams (user_id, source, linked_item_id, provider_stream_id, provider_account_id, description,
                                       category, frequency, average_amount, last_amount, last_date, predicted_next_date,
                                       status, currency, updated_at)
    select p_user_id, 'plaid', p_item_id, s->>'provider_stream_id', s->>'provider_account_id',
           left(coalesce(nullif(s->>'description', ''), 'Income'), 140), left(s->>'category', 80),
           coalesce(s->>'frequency', 'unknown'), (s->>'average_amount')::numeric, (s->>'last_amount')::numeric,
           (s->>'last_date')::date, (s->>'predicted_next_date')::date, coalesce(s->>'status', 'unknown'),
           coalesce(s->>'currency', 'USD'), now()
    from jsonb_array_elements(p_payload->'income_streams') s
    on conflict (linked_item_id, provider_stream_id) do update set
      provider_account_id = excluded.provider_account_id, description = excluded.description, category = excluded.category,
      frequency = excluded.frequency, average_amount = excluded.average_amount, last_amount = excluded.last_amount,
      last_date = excluded.last_date, predicted_next_date = excluded.predicted_next_date, status = excluded.status,
      currency = excluded.currency, updated_at = now();
    get diagnostics v_streams = row_count;
    select coalesce(array_agg(s->>'provider_stream_id'), '{}') into v_ids from jsonb_array_elements(p_payload->'income_streams') s;
    delete from public.income_streams
     where linked_item_id = p_item_id and source = 'plaid' and not (provider_stream_id = any(v_ids));
  end if;

  update public.linked_items set money_synced_at = now(), updated_at = now(),
         status = case when status = 'error' then 'active' else status end,
         status_reason = case when status = 'error' then null else status_reason end
   where id = p_item_id;

  return jsonb_build_object('cash_accounts', v_cash, 'liabilities', v_liab, 'transactions_upserted', v_tx_upsert,
                            'transactions_removed', v_tx_del, 'transactions_skipped_retention', v_tx_old,
                            'income_streams', v_streams);
end;
$$;

revoke all on function public.replace_item_money(uuid, uuid, jsonb) from public, anon, authenticated;
grant execute on function public.replace_item_money(uuid, uuid, jsonb) to service_role;

-- ---------------------------------------------------------------------------
-- purge_money_retention: delete transactions older than 24 months (service_role only).
-- Scheduling it (pg_cron / scheduled edge function) is TODO — see SECURITY.md §2.
-- Snapshots are append-only and are removed only with the account (see SECURITY.md).
-- ---------------------------------------------------------------------------
create or replace function public.purge_money_retention()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare v_n integer;
begin
  delete from public.transactions where date < (current_date - interval '24 months')::date;
  get diagnostics v_n = row_count;
  return v_n;
end;
$$;
revoke all on function public.purge_money_retention() from public, anon, authenticated;
grant execute on function public.purge_money_retention() to service_role;

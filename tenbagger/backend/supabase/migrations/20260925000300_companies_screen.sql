-- Tenbagger Phase 3 — companies + metrics (mirror of data/companies.json) and run_screen().
-- Public reference data: readable by anon and authenticated, writable by service_role only.

create table public.companies (
  ticker            text primary key check (ticker ~ '^[A-Z0-9][A-Z0-9.\-]{0,9}$'),
  cik               bigint,
  name              text not null,
  sector            text,
  industry          text,
  fiscal_year_end   text,
  price             numeric,
  price_date        date,
  price_is_sample   boolean not null default false,
  latest_fy         integer,
  fundamentals      jsonb not null default '{}',   -- contract "fundamentals" object (raw USD)
  history           jsonb not null default '{}',   -- contract "history" object
  source            text,
  updated_at        timestamptz not null default now()
);

-- One typed column per contract metric (ratios as decimals, USD raw units).
create table public.company_metrics (
  ticker              text primary key references public.companies (ticker) on delete cascade,
  market_cap          numeric,
  enterprise_value    numeric,
  pe                  numeric,
  ps                  numeric,
  pb                  numeric,
  ev_ebitda           numeric,
  fcf_yield           numeric,
  earnings_yield      numeric,
  dividend_yield      numeric,
  gross_margin        numeric,
  operating_margin    numeric,
  net_margin          numeric,
  fcf_margin          numeric,
  roe                 numeric,
  roa                 numeric,
  roic                numeric,
  debt_to_equity      numeric,
  current_ratio       numeric,
  net_cash            numeric,
  revenue_growth_yoy  numeric,
  eps_growth_yoy      numeric,
  revenue_cagr_3y     numeric
);
create index company_metrics_pe_idx on public.company_metrics (pe);
create index companies_sector_idx on public.companies (sector);

alter table public.companies       enable row level security;
alter table public.company_metrics enable row level security;
revoke all on public.companies, public.company_metrics from anon, authenticated;
grant select on public.companies, public.company_metrics to anon, authenticated;
grant all on public.companies, public.company_metrics to service_role;

create policy companies_read_all on public.companies
  for select to anon, authenticated using (true);
create policy company_metrics_read_all on public.company_metrics
  for select to anon, authenticated using (true);

-- ---------------------------------------------------------------------------
-- Screenable keys = contract Metrics ∪ Fundamentals (whitelist => no dynamic SQL)
-- ---------------------------------------------------------------------------
create or replace function public.screenable_metrics()
returns text[]
language sql
immutable
as $$
  select array[
    -- metrics
    'market_cap','enterprise_value','pe','ps','pb','ev_ebitda','fcf_yield','earnings_yield',
    'dividend_yield','gross_margin','operating_margin','net_margin','fcf_margin','roe','roa','roic',
    'debt_to_equity','current_ratio','net_cash','revenue_growth_yoy','eps_growth_yoy','revenue_cagr_3y',
    -- fundamentals
    'revenue','cost_of_revenue','gross_profit','operating_income','net_income','eps_diluted',
    'shares_diluted','operating_cash_flow','capex','free_cash_flow','dividends_paid','cash',
    'total_assets','total_liabilities','total_equity','total_debt','current_assets',
    'current_liabilities','inventory','d_and_a','income_tax','pretax_income',
    -- convenience
    'price'
  ]::text[]
$$;

create or replace function public._screen_match(v numeric, op text, target jsonb)
returns boolean
language sql
immutable
as $$
  select case
    when v is null then false
    when op = '>'  then v >  (target #>> '{}')::numeric
    when op = '>=' then v >= (target #>> '{}')::numeric
    when op = '<'  then v <  (target #>> '{}')::numeric
    when op = '<=' then v <= (target #>> '{}')::numeric
    when op = '==' then v =  (target #>> '{}')::numeric
    when op = 'between' then v between (target->>0)::numeric and (target->>1)::numeric
    else false
  end
$$;

-- run_screen(filters, sort, max_rows)
--   filters: [{"metric":"pe","op":"<","value":20}, {"metric":"roic","op":"between","value":[0.1,0.5]}]
--   sort:    {"metric":"fcf_yield","dir":"desc"}   (optional; nulls last; tie-break ticker)
-- Semantics match packages/screener: a company with a NULL value for a filtered metric
-- does not pass that filter. Unknown metric/op or malformed value -> error 22023.
create or replace function public.run_screen(filters jsonb, sort jsonb default null, max_rows integer default 200)
returns table (ticker text, name text, sector text, industry text, price numeric, metrics jsonb)
language plpgsql
stable
security invoker
set search_path = public
as $$
#variable_conflict use_column
declare
  f        jsonb;
  allowed  text[] := public.screenable_metrics();
  s_metric text := null;
  s_dir    text := 'desc';
begin
  filters := coalesce(filters, '[]'::jsonb);
  if jsonb_typeof(filters) <> 'array' then
    raise exception 'filters must be a JSON array' using errcode = '22023';
  end if;
  if jsonb_array_length(filters) > 25 then
    raise exception 'too many filters (max 25)' using errcode = '22023';
  end if;

  for f in select value from jsonb_array_elements(filters) loop
    if jsonb_typeof(f) <> 'object' or not coalesce(f->>'metric' = any(allowed), false) then
      raise exception 'unknown metric: %', coalesce(f->>'metric', 'null') using errcode = '22023';
    end if;
    if not coalesce(f->>'op' = any(array['>','>=','<','<=','between','==']), false) then
      raise exception 'unknown op: %', coalesce(f->>'op', 'null') using errcode = '22023';
    end if;
    if f->>'op' = 'between' then
      if jsonb_typeof(f->'value') <> 'array' or jsonb_array_length(f->'value') <> 2
         or jsonb_typeof(f->'value'->0) <> 'number' or jsonb_typeof(f->'value'->1) <> 'number' then
        raise exception 'between needs [number, number]' using errcode = '22023';
      end if;
    elsif coalesce(jsonb_typeof(f->'value'), 'null') <> 'number' then
      raise exception 'value must be a number for op %', f->>'op' using errcode = '22023';
    end if;
  end loop;

  if sort is not null and jsonb_typeof(sort) = 'object' then
    s_metric := sort->>'metric';
    s_dir := lower(coalesce(sort->>'dir', 'desc'));
    if not coalesce(s_metric = any(allowed), false) or s_dir not in ('asc', 'desc') then
      raise exception 'invalid sort' using errcode = '22023';
    end if;
  end if;

  return query
  with base as (
    select c.ticker, c.name, c.sector, c.industry, c.price,
           (c.fundamentals || (to_jsonb(m) - 'ticker') || jsonb_build_object('price', c.price)) as vals
    from public.companies c
    join public.company_metrics m on m.ticker = c.ticker
  )
  select b.ticker, b.name, b.sector, b.industry, b.price, b.vals
  from base b
  where not exists (
    select 1 from jsonb_array_elements(filters) ff
    where not public._screen_match((b.vals->>(ff->>'metric'))::numeric, ff->>'op', ff->'value')
  )
  order by
    case when s_metric is not null and s_dir = 'asc'  then (b.vals->>s_metric)::numeric end asc  nulls last,
    case when s_metric is not null and s_dir = 'desc' then (b.vals->>s_metric)::numeric end desc nulls last,
    b.ticker
  limit least(greatest(coalesce(max_rows, 200), 1), 1000);
end;
$$;

grant execute on function public.run_screen(jsonb, jsonb, integer) to anon, authenticated, service_role;
grant execute on function public.screenable_metrics() to anon, authenticated, service_role;
grant execute on function public._screen_match(numeric, text, jsonb) to anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- load_companies(doc): upsert a whole data/companies.json document (service_role only)
-- ---------------------------------------------------------------------------
create or replace function public.load_companies(doc jsonb)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_n integer;
begin
  if coalesce((doc->>'schema_version')::int, 0) <> 1 then
    raise exception 'unsupported companies.json schema_version' using errcode = '22023';
  end if;

  insert into public.companies (ticker, cik, name, sector, industry, fiscal_year_end, price, price_date,
                                price_is_sample, latest_fy, fundamentals, history, source, updated_at)
  select c->>'ticker', (c->>'cik')::bigint, c->>'name', c->>'sector', c->>'industry', c->>'fiscal_year_end',
         (c->>'price')::numeric, (c->>'price_date')::date, coalesce((c->>'price_is_sample')::boolean, false),
         (c->>'latest_fy')::int, coalesce(c->'fundamentals', '{}'), coalesce(c->'history', '{}'),
         doc->>'source', now()
  from jsonb_array_elements(doc->'companies') c
  on conflict (ticker) do update set
    cik = excluded.cik, name = excluded.name, sector = excluded.sector, industry = excluded.industry,
    fiscal_year_end = excluded.fiscal_year_end, price = excluded.price, price_date = excluded.price_date,
    price_is_sample = excluded.price_is_sample, latest_fy = excluded.latest_fy,
    fundamentals = excluded.fundamentals, history = excluded.history, source = excluded.source,
    updated_at = now();
  get diagnostics v_n = row_count;

  insert into public.company_metrics
  select (jsonb_populate_record(null::public.company_metrics,
            coalesce(c->'metrics', '{}') || jsonb_build_object('ticker', c->>'ticker'))).*
  from jsonb_array_elements(doc->'companies') c
  on conflict (ticker) do update set
    market_cap = excluded.market_cap, enterprise_value = excluded.enterprise_value, pe = excluded.pe,
    ps = excluded.ps, pb = excluded.pb, ev_ebitda = excluded.ev_ebitda, fcf_yield = excluded.fcf_yield,
    earnings_yield = excluded.earnings_yield, dividend_yield = excluded.dividend_yield,
    gross_margin = excluded.gross_margin, operating_margin = excluded.operating_margin,
    net_margin = excluded.net_margin, fcf_margin = excluded.fcf_margin, roe = excluded.roe, roa = excluded.roa,
    roic = excluded.roic, debt_to_equity = excluded.debt_to_equity, current_ratio = excluded.current_ratio,
    net_cash = excluded.net_cash, revenue_growth_yoy = excluded.revenue_growth_yoy,
    eps_growth_yoy = excluded.eps_growth_yoy, revenue_cagr_3y = excluded.revenue_cagr_3y;

  return v_n;
end;
$$;

revoke all on function public.load_companies(jsonb) from public, anon, authenticated;
grant execute on function public.load_companies(jsonb) to service_role;

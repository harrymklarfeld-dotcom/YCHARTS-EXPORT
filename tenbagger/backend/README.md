# Tenbagger backend (Phase 3): accounts, progress and read-only brokerage holdings

Supabase (Postgres + Auth + Edge Functions, Deno/TypeScript). Users can link real brokerage
accounts through **Plaid** or **SnapTrade** with read-only access. Their holdings are normalized to the
`CONTRACT.md` holdings shape and joined with `data/companies.json` metrics. The lesson engine
uses the result to personalize `{holding}` lessons.

```
backend/
  deno.json                     tasks: test / check / seed
  .env.example                  every env var, documented
  SECURITY.md                   DRAFT written information security program (FTC Safeguards Rule)
  scripts/build_seed.ts         generates seed.sql + tests/fixtures/companies_sample.json
  supabase/
    config.toml                 MFA on; plaid-webhook has verify_jwt = false
    migrations/
      20260925000100_core_learning.sql     profiles, lesson_progress, daily_activity, XP/heart RPCs
      20260925000200_brokerage.sql         aggregator_users, linked_items, accounts, securities,
                                           holdings, sync_runs, audit_log, holdings_contract view,
                                           replace_item_holdings()
      20260925000300_companies_screen.sql  companies, company_metrics, run_screen(), load_companies()
    seed.sql                    5 SAMPLE companies (price_is_sample = true)
    functions/
      _shared/                  all logic (see below); each <fn>/index.ts is a 3-line shim
      plaid-link-token/  plaid-exchange/  plaid-sync-holdings/  plaid-webhook/
      snaptrade-register/  snaptrade-sync/  unlink/  portfolio-summary/
  tests/                        Deno tests: PGlite (real Postgres 17 in WASM) + fixtures
```

## Architecture

* **`AggregatorProvider`** (`_shared/providers/types.ts`) is the only interface handlers use.
  It has three implementations: `PlaidProvider`, `SnapTradeProvider` (plain `fetch`, no SDKs,
  injectable fetch) and `MockProvider`. The mock runs the real normalizers over sandbox-shaped
  JSON. Set `PROVIDER_MODE=mock` to run the whole stack without keys.
* **Normalizers** (`normalize_plaid.ts`, `normalize_snaptrade.ts`) are pure functions that
  return a `NormalizedSnapshot` of accounts, securities, holdings and warnings. They handle:
  * cash (`CUR:USD`, money-market funds, SnapTrade balances)
  * crypto
  * options (ticker `null`, `underlying_ticker` kept)
  * fixed income without a ticker
  * Plaid proxy securities (401k trusts)
  * a CUSIP→ticker resolver hook
  * share classes (`BRK.B` → `BRK-B`)
  * null cost basis (Plaid often has no tax lots)
  * non-USD positions (flagged, not converted)
  * zero-quantity rows and unknown securities
* **`replace_item_holdings(user, item, snapshot)`** is one atomic SQL call per sync. It upserts
  accounts and securities, deletes accounts that have disappeared, and replaces the item's
  holdings.
* **`portfolio-summary`** computes MV-weighted look-through metrics:
  * **P/E with harmonic weighting**: `PE = 1 / Σ wᵢ·EYᵢ`. The P/E of a basket is its total
    value divided by the earnings it owns, `Σ MVᵢ / Σ (MVᵢ/PEᵢ)`, which is exactly a harmonic
    mean. An arithmetic mean of P/Es is biased upward and blows up near zero earnings.
    Loss-makers count through their negative earnings yield instead of being dropped.
  * FCF yield and dividend yield are weighted arithmetic means of yields, which is the same
    idea.
  * ROIC and margins are weighted arithmetic means over the holdings that have data.
  * Each metric reports `coverage`, the share of non-cash value that had data.
  * It also returns sector mix, the largest holding, HHI concentration, unrealized gain
    (where cost basis is known), and `lesson_context.variables` (`{holding}`,
    `{holding_pe}`, `{portfolio_pe}`, …) for lesson templates.

### Function API (all JSON; responses never contain tokens)

| Function | Auth | Body | Returns |
|---|---|---|---|
| `plaid-link-token` | JWT, **aal2** | `{item_id?}` (update/re-auth mode) | `{link_token, expiration, mode}` |
| `plaid-exchange` | JWT, **aal2** | `{public_token}` | `{item, sync}` |
| `plaid-sync-holdings` | JWT | `{item_id?, force?}` | `{results[]}` (60 s throttle unless forced) |
| `plaid-webhook` | Plaid-Verification JWT | Plaid webhook | `ITEM_LOGIN_REQUIRED`/`PENDING_*` → `needs_reauth`; `USER_PERMISSION_REVOKED` → `revoked`; `LOGIN_REPAIRED` → `active`; `HOLDINGS:DEFAULT_UPDATE` → sync |
| `snaptrade-register` | JWT, **aal2** | `{broker?}` | `{redirect_url}` (read-only Connection Portal) |
| `snaptrade-sync` | JWT | `{force?}` | `{items, results}`, with one linked item per brokerage authorization |
| `unlink` | JWT | `{item_id}` or `{all:true}` | `{removed, provider_errors}` |
| `portfolio-summary` | JWT | none (GET) | `PortfolioSummary` |

Clients can also read their own rows directly through PostgREST under RLS:
* `holdings_contract` (the contract shape)
* `linked_items` (non-secret columns only)
* `sync_runs`
* `lesson_progress`, `daily_activity`
* `rpc/record_lesson_completion`, `rpc/spend_heart`
* `rpc/run_screen` (open to anon)

## Setup

```bash
# 0. Tools: Supabase CLI (https://supabase.com/docs/guides/cli) + Docker, Deno 2.x
#    (no global Deno? `npx deno --version` works: the npm "deno" package ships the binary)

cd tenbagger/backend
supabase start                       # local Postgres/Auth/Functions
supabase db reset                    # applies migrations/ then seed.sql

# Load real pipeline output instead of the sample seed (as service_role / postgres):
#   select public.load_companies($1::jsonb);   -- $1 = contents of tenbagger/data/companies.json

cp .env.example supabase/functions/.env   # fill in; generate key: openssl rand -base64 32
supabase functions serve --env-file supabase/functions/.env

# Deploy
supabase link --project-ref <ref>
supabase db push
supabase secrets set --env-file supabase/functions/.env
supabase functions deploy            # deploys all functions; plaid-webhook without JWT check per config.toml
```

Enable **TOTP MFA** in Supabase Auth. Linking requires an `aal2` session. The mobile app
should enroll the user in MFA and verify it before it opens Plaid Link or SnapTrade.

### Environment variables

See `.env.example`. Required: `TOKEN_ENCRYPTION_KEYS` (JSON `{keyId: base64 32 bytes}`),
`TOKEN_ENCRYPTION_ACTIVE_KEY_ID`, `PLAID_CLIENT_ID`, `PLAID_SECRET`, `PLAID_ENV`,
`SNAPTRADE_CLIENT_ID`, `SNAPTRADE_CONSUMER_KEY`. These are provided by Supabase automatically:
`SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_DB_URL`.

### Getting provider keys

* **Plaid**: sign up at dashboard.plaid.com.
  1. Sandbox keys are available immediately. The sandbox login is `user_good` / `pass_good`,
     and the default sandbox institutions include investment accounts with holdings.
  2. Request the **Trial** plan (free, up to 10 real Items) to link your own real brokerage.
     This needs the Investments product enabled and a completed application profile.
  3. Set `PLAID_WEBHOOK_URL` to `https://<ref>.supabase.co/functions/v1/plaid-webhook`.
  4. For OAuth institutions on mobile, register `PLAID_REDIRECT_URI` in the dashboard.
* **SnapTrade**: sign up at dashboard.snaptrade.com to get `clientId` and `consumerKey`.
  1. Free/test keys let you connect with limited brokerages.
  2. The Launch plan is needed for production users.

### Cost notes (from our research; re-check current pricing before committing)

* **Plaid Trial**: $0 for up to 10 real Items. Enough for the founders and a few beta
  testers. After that, Investments is billed per connected Item under a Plaid
  production/pay-as-you-go agreement.
* **SnapTrade Launch**: about **$100/month plus $1–2 per connected user per month**. It
  covers brokerages Plaid handles poorly (e.g. Robinhood, Wealthsimple) and gives better
  cost basis.
* **Plaid tax lots / cost basis are often empty.** The UI and lessons must treat
  `cost_basis: null` as normal. The summary reports `cost_basis_coverage`.
* Supabase free tier is enough for development. Production needs a paid plan (backups,
  no pausing).
* To keep costs down, sync on webhook or on user action (with a 60 s throttle) instead of
  polling, and remove Items on unlink (Plaid bills connected Items).

## Tests

```bash
deno task test      # 40 tests: normalizers, weighted math, crypto, webhook JWT, provider clients,
                    # SQL/RLS (real migrations in PGlite), end-to-end handlers
deno task check     # type-checks all 8 function entrypoints (pulls supabase-js / postgres from npm)
deno lint
```

Nothing in the tests calls Plaid or SnapTrade. The provider clients are tested against a fake
`fetch` that replays the sandbox-shaped fixtures in `tests/fixtures/`.

## Known gaps

* No test has run against live Plaid/SnapTrade yet (no keys). These are the parts to
  confirm first:
  * SnapTrade request signing (matches their documented scheme and is tested for internal
    consistency only)
  * Plaid webhook JWT verification (tested with a locally generated P-256 key)
  * SnapTrade option `price` units
* Tests use a Supabase shim (roles, `auth.uid()`, default grants) on PGlite, not the Supabase
  Docker image. Run `supabase db reset` once on a real stack before shipping.
* CUSIP→ticker resolution is only a hook (`tickerByCusip`). Wiring it to OpenFIGI or similar
  is TODO.
* Non-USD positions are flagged and excluded from USD totals. There is no FX conversion.
* Token re-encryption after key rotation is lazy (`needsRotation`). There is no batch job yet.
* Scheduled background sync (cron) and retention purges are TODO. See SECURITY.md.

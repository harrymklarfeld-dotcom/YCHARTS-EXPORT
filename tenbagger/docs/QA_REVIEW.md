# Tenbagger QA review

Scope: `pipeline/`, `lessons/`, `packages/screener/src` (engine, catalog, peers, presets,
query, format), `packages/money/src`, `backend/supabase` (migrations + `functions/_shared`),
`datasources/`, `.github/workflows/tenbagger-data.yml`. Reviewed against `CONTRACT.md`.
Read-only review; no source files touched, no commits made.

## Method

Read every non-test file in scope against the CONTRACT.md formulas (EV, P/E, ROIC + tax
clamp, FCF sign, CAGR, growth, margins), the EDGAR extraction/dedupe/fiscal-year logic, the
screener null/sort handling, the money-hub date math (paydate projection, weekend
adjustment), the Supabase RLS policies and SQL construction, the licence gate, and the
workflow's permissions/secrets. Ran every existing test suite in scope rather than
duplicating coverage with new scratch repros, since the formulas/edge cases a QA pass would
target (tax clamp, negative-EPS P/E null, FCF sign, harmonic P/E, RLS isolation, webhook
signature verification, weekend paydate shift, semimonthly rollover) are already exercised
by name in the existing suites below, and all of them pass.

## Test suites run (this session)

| Suite | Result |
|---|---|
| `python -m pytest -q pipeline/tests lessons/tests datasources/tests` | **133 passed** |
| `packages/screener`: `npx vitest run` | **81 passed** (7 files) |
| `packages/money`: `npx vitest run` | **70 passed** (9 files) |
| `backend`: `deno test --allow-read --allow-env tests/` | **60 passed** (11 files, incl. `sql_rls_test.ts` against PGlite + real migrations) |

Total: 344 tests, 0 failures, across all in-scope areas.

## Confirmed findings

None. No reproducible defect was found in the reviewed formulas, dedupe/fiscal-year
selection, null handling, RLS policies, SQL construction, secret handling, or workflow
permissions. Specifically verified clean:

- `pipeline/metrics.py` — every CONTRACT metric formula (market_cap, EV, P/E null-if-EPS≤0,
  EV/EBITDA null-if-EBITDA≤0, ROIC tax-rate clamp `[0, 0.35]` default `0.21`, FCF sign
  (`ocf − |capex|`), growth `this/prior − 1` null-if-prior≤0, `revenue_cagr_3y`) matches
  `CONTRACT.md` line-for-line; `clean()` maps NaN/Inf to `null` before every field is
  written, and `div()` refuses negative/zero denominators by default.
- `pipeline/extract.py` — fiscal-year-of-period is derived from `end` date, not the
  filing's `fy` field (handles the "10-K also carries prior-year comparatives" trap);
  restatement `dedupe_latest` ranks by `(filed, is_amendment)` so a later filing always
  wins; instant facts are tolerance-matched to a flow-derived fiscal-year-end so
  off-cycle balances are dropped.
- `packages/screener/src/engine.ts` — `getValue` never returns non-finite; sort is
  index-decorated so it's stable; missing-vs-fail is tracked separately for the
  "would match with data" UX; `==` uses a relative epsilon.
- `packages/money/src/dates.ts` / `income.ts` — pure integer-day (Hinnant) calendar math,
  no `Date`/timezone use; weekend adjustment (Sat → −1, Sun → −2) and semimonthly rollover
  both look correct and are covered by `dates.test.ts` / `income.test.ts`.
- `backend/supabase/migrations/*.sql` — RLS enabled on all 18 tables; every policy scopes
  by `auth.uid()` (or an `exists` join back to a user-owned row); `run_screen` uses a
  hard-coded metric whitelist (`screenable_metrics()`), never dynamic SQL, for filter/sort
  keys — no injection surface despite building a query from client JSON.
- `backend/supabase/functions/_shared/repo.ts` — every query is parameterized; the one
  string-interpolated table name in `setMoneyHub` comes from a fixed local array literal,
  not request input.
- `backend/supabase/functions/_shared/crypto.ts` / `webhook.ts` — AES-256-GCM with
  per-row AAD (so a ciphertext can't be replayed onto another user's row); Plaid webhook
  verification checks alg, kid, ES256 signature, `iat` freshness, and constant-time body
  hash compare.
- `.github/workflows/tenbagger-data.yml` — top-level `permissions: contents: read`;
  `contents: write` is scoped to only the `publish-data-branch` job, which pushes only to
  `data`; secrets are only exported into the steps that need them.
- `datasources/checks.py` / `manifest.py` — licence gate defaults every vendor to
  `display_allowed=False` until a non-boolean-looking env var is set (rejects `"1"`,
  `"true"` as accidental opt-ins), and cross-checks each non-sample price's `price_date`
  against the manifest before allowing publish.

## Plausible-but-unconfirmed concerns (not reproduced as defects)

1. **Missing-debt/cash treated as zero in EV/ROIC (pipeline) vs. required-present
   (lessons).** `pipeline/metrics.py` computes `enterprise_value` and `roic`'s invested
   capital by defaulting an absent `total_debt`/`cash` to `0`, while
   `lessons/lessons/formulas.py:_ic()` requires all three fields present or returns
   `None`. Not a wrong-answer bug (lessons just skips the question when data is
   incomplete), but it means `companies.json` can carry an EV/ROIC computed as if a
   company had zero debt when the tag was simply never filed vs. genuinely zero — worth a
   `data_notes` flag if it turns out to matter for real filers with unusual debt tagging.
2. **Balance-sheet fallback coverage.** `pipeline/tags.py` has only one tag each for
   `current_assets`/`current_liabilities`/`total_liabilities` (`AssetsCurrent`,
   `LiabilitiesCurrent`, `Liabilities`) with no fallback list, unlike most other fields.
   Filers that omit a classified balance sheet (common for banks/financials) would silently
   get `current_ratio = null` rather than a fallback — a coverage gap, not a math error, and
   likely intentional for a first S&P-500 pass.

## Not reviewed

`mobile/` and other actively-edited folders were excluded per instructions. No source file
was edited and no commit was made as part of this review.

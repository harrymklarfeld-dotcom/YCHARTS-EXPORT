# Tenbagger — Written Information Security Program (WISP)

> **DRAFT — NOT LEGAL ADVICE. Requires review by qualified counsel before reliance.**
> Prepared as an engineering starting point aligned to the FTC Standards for Safeguarding
> Customer Information (16 CFR Part 314, "Safeguards Rule", as amended 2021/2023).
> Whether and how the Rule applies to Tenbagger (e.g. as a "financial institution" because
> it aggregates brokerage data for consumers) must be confirmed by counsel. Sections marked
> **TODO** name decisions and owners that do not exist yet.

Version 0.1 · 2026-09-25 · Scope: the Tenbagger mobile app, Supabase project (Postgres,
Auth, Edge Functions), and integrations with Plaid and SnapTrade (read-only brokerage data).

---

## 1. Qualified Individual and roles (§314.4(a))

| Role | Responsibility | Assigned |
|---|---|---|
| **Qualified Individual (QI)** | Owns this program; reports in writing to the board/owner at least annually (§314.4(i)) | **TODO** (founder until hired) |
| Engineering lead | Implements controls in this repo; reviews all changes to `backend/` | **TODO** |
| Incident commander (rotating) | Runs §8 incident response | **TODO** |
| Vendor owner | Maintains §9 vendor inventory and reviews | **TODO** |

If the QI is a service provider, Tenbagger retains responsibility and designates a senior
member of staff to oversee them.

## 2. Customer information we hold

| Data | Where | Sensitivity | Retention |
|---|---|---|---|
| Email, auth factors | Supabase Auth (`auth.users`) | High | Until account deletion |
| Plaid `access_token`, SnapTrade `userSecret` | `linked_items.access_token_ciphertext`, `aggregator_users.secret_ciphertext` — **AES-256-GCM ciphertext only** | Critical | Until unlink / account deletion |
| Holdings, accounts (name, last-4 mask, balances) | `holdings`, `accounts`, `securities` | High | Until unlink / account deletion; snapshot replaced each sync |
| Bank balances (Money hub, opt-in) | `cash_accounts` (name, last-4 mask, subtype, current/available balance) | High | Until opt-out / unlink / account deletion; replaced each sync |
| Credit-card / student-loan payment data | `liabilities` (balance, limit, statement balance/date, minimum, due date, last payment, APR, overdue flag) | High | Until opt-out / unlink / account deletion; replaced each sync |
| Transactions | `transactions` (date, signed amount, display name, top-level category, pending, account id) | High | **24 months**: rows older than 24 months are never stored and are deleted by `purge_money_retention()` (**TODO**: schedule daily); also on opt-out / unlink / account deletion |
| Income streams | `income_streams` (detected: description, cadence, average/last amount, dates; manual: pay type, rate, schedule, withholding, condition text) | High | Detected: replaced each sync, deleted on opt-out / unlink. Manual: until the user deletes them or the account |
| Money history | `money_snapshots`, `money_snapshot_notes` (append-only) | High | Until account deletion (append-only by design; **TODO**: counsel to confirm, or add a vetted retention migration) |
| Transactions sync cursor | `linked_items.transactions_cursor` (service-only column) | Low | Until opt-out / unlink |
| Sync status / errors | `sync_runs` | Medium | **TODO**: purge after 180 days |
| Security audit events | `audit_log` (service-role only) | Medium | **TODO**: 1 year |
| Lesson progress | `lesson_progress`, `daily_activity` | Low | Until account deletion |

We never collect brokerage **login credentials** (the user enters them inside Plaid Link /
SnapTrade Connection Portal) and never request trading permissions (SnapTrade
`connectionType: "read"`, Plaid `investments` product only). Plaid `transactions` and
`liabilities` (read-only) are requested **only** when the user opts into the Money hub.

**Data minimization (Money hub).** Normalizers keep only what the cash-flow check needs. We do
**not** store: full account or routing numbers, student-loan account numbers, servicer addresses,
payment reference numbers, guarantor or PSLF details, transaction locations, counterparties,
payment channels, Plaid transaction-id lists, or outflow (spending) recurring streams. Transaction
names are truncated to 140 characters and categories to Plaid's top-level category. Internal
transfers and loan disbursements are not treated as income. Opting out of the Money hub
(`money-sync {item_id, enable:false}`) deletes that item's cash, debt, transaction and detected
income rows and its cursor immediately.

## 3. Risk assessment (§314.4(b))

Written assessment to be repeated **at least annually** and on material change (new
provider, new data type, new region). Initial risk register:

| # | Threat | Likelihood | Impact | Controls (this repo) | Residual / TODO |
|---|---|---|---|---|---|
| R1 | DB dump / backup leak exposes provider tokens | Med | Critical | App-layer AES-GCM, key never in DB, AAD row binding | Key in Supabase secrets — move to KMS (TODO) |
| R2 | Client reads another user's holdings | Med | High | RLS on every table + explicit grants; tests in `tests/sql_rls_test.ts` | Pen-test before launch |
| R3 | Client forges holdings / XP | Med | Low-Med | Service-role-only writes for aggregator data; XP only via validated RPC | — |
| R4 | Account takeover → attacker links / views brokerage data | Med | High | MFA (aal2) required to link; Supabase Auth rate limits | Require aal2 to *view* holdings (TODO decision) |
| R5 | Forged Plaid webhook | Low | Med | ES256 JWT verification, body hash, 5-min replay window | Validate against live Plaid |
| R6 | Token leaks in logs / responses | Med | Critical | Handlers never serialize tokens; tests assert no secrets in responses/logs | Log-drain scrubbing (TODO) |
| R7 | Vendor compromise (Plaid/SnapTrade/Supabase) | Low | High | Least privilege, read-only scopes, §9 oversight | Incident contacts (TODO) |
| R8 | Stale data after user revokes access | Med | Low | Webhooks + `snaptrade-sync` mark items revoked/needs_reauth | — |
| R9 | Transaction history over-collection / over-retention | Med | High | Money hub opt-in only; minimized columns; 24-month cutoff at write time; `purge_money_retention()` | Schedule the purge (TODO) |
| R10 | Tampering with money history (e.g. hiding a missed payment) | Low | Med | `money_snapshots`/notes append-only via trigger for all roles incl. service_role; clients cannot insert snapshots | Superuser can still drop the trigger: covered by change management §4.7 |

## 4. Safeguards (§314.4(c))

### 4.1 Access control (§314.4(c)(1))
- **End users**: Postgres Row Level Security on every `public` table; policies restrict
  rows to `user_id = auth.uid()`. Table privileges are explicitly revoked from `anon` /
  `authenticated` and re-granted minimally (e.g. only non-secret columns of
  `linked_items`). `aggregator_users` and `audit_log` have **no** client access.
- **Service code**: Edge functions use the service connection only for writes the user
  cannot make; every query is additionally scoped by `user_id`.
- **Staff**: Supabase dashboard access limited to named individuals with MFA; production
  DB access via SSO + MFA; quarterly access review. **TODO**: document list.

### 4.2 Data inventory (§314.4(c)(2)) — see §2; update with every migration.

### 4.3 Encryption (§314.4(c)(3))
- **In transit**: TLS for all client ↔ Supabase and Supabase ↔ Plaid/SnapTrade traffic.
- **At rest**: Supabase encrypts storage at rest (AES-256). In addition, provider
  credentials are encrypted at the application layer:
  - AES-256-GCM, random 96-bit IV per encryption (`_shared/crypto.ts`).
  - Additional authenticated data binds each ciphertext to `(provider, user_id, item_id)`.
  - Keys come from `TOKEN_ENCRYPTION_KEYS` (Edge Function secret), identified by key id;
    rotation = add new key, set `TOKEN_ENCRYPTION_ACTIVE_KEY_ID`, re-encrypt lazily
    (`needsRotation()`), remove old key after all rows migrated. Rotate annually and on
    suspected exposure.
  - **Why app-layer instead of pgsodium/Vault**: Supabase has deprecated pgsodium TCE;
    Vault is intended for a small number of project secrets and decrypts for anyone with
    `postgres` access. App-layer encryption keeps the key out of the database entirely, so a
    SQL-injection read, dump, or leaked backup yields only ciphertext.
  - **TODO**: move key material to a cloud KMS (envelope encryption) before GA.

### 4.4 Secure development (§314.4(c)(4))
- All backend changes via PR with review; tests (`deno task test`) must pass, including RLS
  tests that run the real migrations.
- Inputs allow-listed and size-capped (`_shared/validate.ts`, `_shared/http.ts`); screening
  uses a metric whitelist — no dynamic SQL.
- Dependencies pinned by version; review before upgrade.

### 4.5 Multi-factor authentication (§314.4(c)(5))
- Linking a brokerage (Plaid Link token, Plaid exchange, SnapTrade register) requires a
  Supabase Auth session at **aal2** (TOTP verified). Enforced in `handlers.ts`
  (`requireMfa`). `REQUIRE_MFA_FOR_LINKING=false` is for local dev only.
- All staff access to Supabase, GitHub, Plaid and SnapTrade dashboards requires MFA.

### 4.6 Data disposal (§314.4(c)(6))
- **Unlink** (`unlink` function): revokes at the provider (`/item/remove`, SnapTrade
  `DELETE /authorizations/{id}`), then deletes the item row — ciphertext, accounts and
  holdings cascade. Provider failure does not block local deletion; it is audit-logged for
  ops follow-up.
- **Account deletion**: deleting the `auth.users` row cascades to every user table
  (tested). `unlink {all: true}` also deletes the SnapTrade user.
- Customer information is disposed of no later than 2 years after last use unless needed
  for legal/business reasons (§314.4(c)(6)(i)); holdings are replaced on every sync.
- **Money hub retention**: transactions older than 24 months are skipped on write
  (`replace_item_money`) and purged by `purge_money_retention()` (service_role only).
  **TODO**: schedule it daily (pg_cron or a scheduled edge function) and alert on failure.
  Snapshots are append-only; they are removed only with the account (FK cascade from
  `auth.users`; the append-only trigger allows exactly that path).
- **TODO**: scheduled job purging `sync_runs` and `audit_log` per §2.

### 4.7 Change management (§314.4(c)(7)) — migrations only via `supabase/migrations`, reviewed.

### 4.8 Monitoring & logging (§314.4(c)(8))
- Structured logs from edge functions never include tokens, secrets, or raw provider
  payloads. `audit_log` records link/unlink/webhook events.
- **TODO**: alerting on spikes of failed auth, webhook signature failures, sync failures.

## 5. Testing & monitoring (§314.4(d))
- Continuous: automated tests on every change.
- **TODO**: annual penetration test; vulnerability assessment every 6 months (required
  unless continuous monitoring is in place).

## 6. Training (§314.4(e))
- **TODO**: security awareness training at onboarding and annually for all staff with
  production access.

## 7. Service provider oversight (§314.4(f)) — see §9.

## 8. Incident response plan (§314.4(h))
1. **Detect & triage** — anyone may declare; incident commander assigned within 1 hour.
2. **Contain** — revoke affected provider items (Plaid `/item/remove`), rotate
   `TOKEN_ENCRYPTION_KEYS`, rotate Plaid/SnapTrade secrets, disable affected functions.
3. **Eradicate & recover** — patch, re-deploy, re-encrypt tokens under new key.
4. **Notify** — FTC notification **within 30 days** of discovery for a "notification event"
   involving unencrypted information of ≥500 consumers (§314.4(j)); state breach laws;
   Plaid/SnapTrade per contract; affected users. Counsel decides. **TODO**: contacts list.
5. **Post-mortem** — written within 10 business days; update this program and risk register.

## 9. Vendor inventory & oversight

| Vendor | Data | Assurance to collect | Review |
|---|---|---|---|
| Supabase | All app data, auth | SOC 2 Type II report, DPA | Annual |
| Plaid | Brokerage connections (tokens reference) | SOC 2 Type II, ISO 27001, DPA | Annual |
| SnapTrade | Brokerage connections | SOC 2 report, DPA | Annual |
| Apple / Google (app stores) | none beyond distribution | — | — |

Contracts must require the vendor to maintain appropriate safeguards (§314.4(f)(2)).

## 10. Annual report to the board (§314.4(i)) — **TODO**: first report due 12 months after launch.

# Trial run #1: the founder

You are the first real user. The goal is to link **your own** accounts (Chase, your other savings bank,
Robinhood, your card) and use Home daily for two weeks before anyone else touches it. Each phase ends with
a checklist. Report anything odd and it gets fixed before phase 4.

Privacy rule: your real data lives only in **your** Supabase project and on your phone. Keys go in
git-ignored files (`.env`, `.env.*`, `supabase/functions/.env`). Nothing personal is ever committed.

| Phase | What | Cost | Your time |
|---|---|---|---|
| 0 | Click through the sandbox web preview | $0 | 10 min |
| 1 | Accounts: Plaid, Supabase, Expo | $0 | 30 min |
| 2 | Deploy the backend with Plaid **sandbox** keys | $0 | 30 min (with me) |
| 3 | Install the test app on your phone, link fake sandbox banks | $0 Android / $99/yr iPhone | 30 min |
| 4 | Switch to Plaid **Trial** (real data), link your real accounts | $0 for up to 10 connections | 15 min |
| 5 | Use it daily for 14 days, log issues | $0 | 2 min/day |

## Phase 0: sandbox preview (today)
- [ ] Open the web preview, tap **Manage connections → Link an account**, link all four sandbox banks.
- [ ] Sign in with the sandbox sign-in (any email, code `123456`), set up two-step (code `123456`).
- [ ] Note anything confusing. Nothing here is real.

## Phase 1: create the accounts (you)
- [ ] **Plaid**: sign up at dashboard.plaid.com. Copy `client_id` and the **Sandbox** secret. Request
  **Trial** (production access) now; approval can take a few days.
- [ ] **Supabase**: create a project at supabase.com (free tier). Note the project URL and the **anon** key.
  Never share the **service_role** key with anyone, including in chat.
- [ ] **Authenticator app** on your phone (Google Authenticator, 1Password, etc.) for two-step sign-in.
- [ ] **Expo**: sign up at expo.dev (free). iPhone only: an **Apple Developer** account ($99/yr) is needed to
  install a test build on a real iPhone. Android needs nothing extra.

## Phase 2: deploy the backend (together)
Run from `tenbagger/backend` on your computer:
```bash
cp .env.example supabase/functions/.env        # git-ignored; fill PLAID_CLIENT_ID, PLAID_SECRET (sandbox)
openssl rand -base64 32                        # paste into TOKEN_ENCRYPTION_KEYS
# set PROVIDER_MODE=plaid, PLAID_ENV=sandbox, PLAID_WEBHOOK_URL=https://<ref>.supabase.co/functions/v1/plaid-webhook
supabase link --project-ref <ref>
supabase db push
supabase secrets set --env-file supabase/functions/.env
supabase functions deploy
```
In the Supabase dashboard:
- [ ] Auth → Providers → Email: on. Email template shows the 6-digit code (`{{ .Token }}`).
- [ ] Auth → Multi-factor: TOTP on.

## Phase 3: the app on your phone (sandbox banks)
In `tenbagger/mobile`, create `.env.local` (git-ignored):
```
EXPO_PUBLIC_SUPABASE_URL=https://<ref>.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=<anon key>
```
- [ ] Build: `npx eas-cli@latest build --profile development --platform android` (or `ios`). Install from the link.
- [ ] Sign in with your email, enter the code, set up two-step.
- [ ] Link Plaid's test bank (username `user_good`, password `pass_good`). Check Home, pull to refresh, unlink.

Plaid's native Link SDK (`react-native-plaid-link-sdk`) is already in the app; it runs in this test build,
not in Expo Go.

OAuth banks (Chase) bounce you to the bank's own login page and back. Set this once:
- Pick the app id, e.g. `com.harryklarfeld.tenbagger`, and set it as `BUNDLE_ID` in `mobile/eas.json`.
- Android: backend `PLAID_ANDROID_PACKAGE_NAME=<that id>`; Plaid dashboard → Developers → API →
  Allowed Android package names: add it.
- iPhone: backend `PLAID_REDIRECT_URI=https://<your domain>/plaid-oauth` and the same URL in the Plaid
  dashboard's Allowed redirect URIs; the domain must serve an `apple-app-site-association` file (we set this up
  together when you have a domain). Non-OAuth banks work without it.

## Phase 4: your real accounts
- [ ] When Plaid approves Trial: swap `PLAID_SECRET` to the production secret, `PLAID_ENV=production`,
  `supabase secrets set …` again. No app rebuild needed.
- [ ] Link Chase, your savings bank, Robinhood, your card. That is about 4 of your 10 free connections.
- [ ] Check every balance against each bank's own app. Write down any mismatch (amount, account, time).

## Phase 5: two weeks of daily use
Log each day in `tenbagger/private/trial-log.md` (git-ignored):
- Did Home match your banks? Was "updated X ago" honest?
- Did a Chase → savings move show as a transfer (not spending)?
- Anything that felt stressful, confusing or slow?

Pass bar to invite 5 friends: balances match for 14 days, no sign-in loops, no transfer counted as spending.

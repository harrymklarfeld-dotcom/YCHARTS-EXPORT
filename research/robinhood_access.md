# Getting live portfolio data out of Robinhood

*Sep 2026. Applies to `portfolio/robinhood_sync.py` and `portfolio/csv_import.py`.*

## The options

| Route | Live? | Official? | Effort | Notes |
|---|---|---|---|---|
| **robin_stocks (private API)** | Yes: positions, quotes, orders, dividends, equity history | No. Robinhood has no public stocks API and its terms of service prohibit automated access; only the *crypto* trading API is official | Low | Login goes through the app's own endpoints, so it breaks when Robinhood changes them. Read-only use is the safest posture. This is what the sync script uses. |
| **Activity report CSV** | No (up to 24h to generate; ~1 year of history per report) | Yes | Low | Account → Reports and statements → Generate report → CSV. `csv_import.py` rebuilds positions, average cost, realized P&L and dividends from it, then prices them with yfinance. |
| **Plaid Investments** | Daily holdings, not intraday | Yes (Robinhood is a Plaid institution) | High: needs a Plaid developer account and OAuth flow | The sanctioned way; overkill for one account, but the right answer if this ever becomes a product. |
| **Screen scraping the web app** | Yes | No | High and fragile | Not worth it while robin_stocks works. |

## How the robin_stocks login works now (v3.4.0)

1. `rh.login(user, pass)` POSTs to `/oauth2/token/` with a random device token.
2. Robinhood answers with a `verification_workflow` instead of a token. The library then calls `/pathfinder/user_machine/` and polls `/pathfinder/inquiries/<id>/user_view/`.
3. The challenge is either a **device-approval push** (approve in the Robinhood app; the library polls `/push/<id>/get_prompts_status/` for up to 2 minutes), an **SMS/email code** (you type it in), or, if you use an authenticator app, a **TOTP code** you pass as `mfa_code` (the sync script generates it from `RH_TOTP_SECRET` with pyotp).
4. On success the access + refresh token and device token are pickled to `~/.tokens/robinhood.pickle`, so subsequent runs (and the dashboard's auto-refresh) log in silently until the token expires (~24h).

Known failure modes from the library's issue tracker:

* `KeyError: 'status'` / `"Authentication credentials were not provided"` during the challenge (issue #1597, Mar 2025, still open at time of writing). Usually a stale pickle or the challenge type changing; delete `~/.tokens/robinhood.pickle` and retry, and make sure the app is open on your phone when the push arrives.
* The device-approval poll never sees the approval (issue #535). Approve fast (within ~2 min) and retry; some users report it only works on the second attempt after the device is remembered.
* MFA rejected (#521). If you set up an authenticator app, TOTP via `mfa_code` is the reliable path; SMS codes are flaky.

If the login is dead, fall back to the CSV route; the dashboard does not care which one produced `snapshot.json`.

## What the sync pulls

| Field group | Endpoint (via robin_stocks) | Used for |
|---|---|---|
| Open positions, Robinhood's own average buy price | `get_open_stock_positions`, `get_instrument_by_url` | Holdings table; cross-check against the ledger's average cost |
| Quotes incl. previous close and extended hours | `get_quotes` | Live price, day change |
| Key stats: P/E, P/B, market cap, 52-week range, dividend yield, sector | `get_fundamentals` | The YCharts-style stat strip per holding |
| Portfolio equity, previous close, cash, buying power | `load_portfolio_profile`, `load_account_profile` | Hero numbers |
| Every filled order (with partial executions) | `get_all_stock_orders` | The trade ledger → average cost, FIFO lots, realized P&L, replay backtest |
| Dividends paid/reinvested | `get_dividends` | Income column and total return |
| Robinhood's own equity history | `get_historical_portfolio` (year, all) | Equity curve before the local history folder has enough days |

Secrets never touch the repo: credentials come from environment variables or an interactive prompt, the token cache lives in your home directory, and `data/portfolio/` and `data/prices/` are git-ignored except for the synthetic sample.

## Sources

* robin_stocks issues: device approvals (https://github.com/jmfernandes/robin_stocks/issues/535), login KeyError (https://github.com/jmfernandes/robin_stocks/issues/1597), MFA failures (https://github.com/jmfernandes/robin_stocks/issues/521); authentication source (https://github.com/jmfernandes/robin_stocks/blob/master/robin_stocks/robinhood/authentication.py).
* Robinhood device approvals help (https://robinhood.com/us/en/support/articles/device-approvals); reports and statements (https://robinhood.com/us/en/support/articles/finding-your-reports-and-statements/).
* Official API status and Plaid alternative (https://apidog.com/blog/robinhood-api/, https://ibridgepy.com/blog/know-everything-about-robinhood-api/).

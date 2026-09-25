# Tenbagger data pipeline (Phase 0)

This pipeline turns SEC EDGAR XBRL `companyfacts` into `tenbagger/data/companies.json`
(schema_version 1, see `../CONTRACT.md`). It needs Python 3.11 and runs on the standard
library alone. You also need `openpyxl` for `validate` and MU fixture generation, and
`pytest` for the tests.

```bash
cd tenbagger
pip install -r pipeline/requirements.txt

# offline (fixtures in data/fixtures/edgar + sample prices)
python -m pipeline build --tickers MU,AAPL,MSFT,COST,KO,NVDA,JPM,XOM,JNJ,TSLA,AMZN,PG --offline
python -m pipeline build --universe sp500-sample --offline      # builds the 12 that have fixtures, warns on the rest
python -m pipeline validate --ticker MU --offline                # compare against data/ycharts/*.xlsx
python -m pytest pipeline -q

# live EDGAR
export TENBAGGER_SEC_UA="Your Name you@example.com"             # SEC requires a real contact
python -m pipeline build --universe sp500-sample --prices my_prices.csv
python -m pipeline validate --ticker MU                          # real XBRL vs YCharts
```

## Commands
| Command | What it does |
|---|---|
| `build --tickers A,B` / `--universe sp500-sample` | Fetches (or reads fixtures for) each company, extracts up to 10 fiscal years, computes metrics and writes `data/companies.json`. `--out` changes the output path. If no company builds, the existing file is left untouched. |
| `build --prices file.csv` | CSV `ticker,price,price_date[,is_sample]`. Rows here set `price_is_sample=false`. Tickers missing from the file fall back to `data/fixtures/prices_sample.csv`, which is always flagged as sample. |
| `validate --ticker MU` | Prints a pass/fail table of pipeline values against YCharts statement exports for each overlapping FY, with a tolerance of max(1%, $5M) or $0.02 for EPS. For MU it also checks the press-release history in `data/mu_fundamentals.json`. Exits 1 on any FAIL. |
| `make-fixtures` | Regenerates `data/fixtures/edgar/*.json`. |

## Letting the sandbox reach data.sec.gov
The Claude Code sandbox proxy returns `403 Tunnel connection failed` for `data.sec.gov` and
`www.sec.gov`. The live path is already implemented. To use it:
1. Add `data.sec.gov` and `www.sec.gov` to the environment's allowed network hosts
   (Claude Code on the web: environment settings → Network access → custom allowlist),
   or run from a machine with normal internet access.
2. Set `TENBAGGER_SEC_UA` to "Name email". SEC blocks generic user agents.
3. If you are behind a TLS-intercepting proxy, set `SSL_CERT_FILE` or `REQUESTS_CA_BUNDLE`
   to its CA bundle. The client honours both, and `HTTPS_PROXY` through urllib.

Client behaviour (`sec.py`):
- Requests are limited to 10 per second.
- 429 and 5xx responses are retried with backoff.
- Responses are cached on disk in `pipeline/.cache/` (override with `TENBAGGER_CACHE_DIR`).
- Cached data expires after 24 hours by default (override with `TENBAGGER_CACHE_TTL_HOURS`).
- To make a live pull the new offline fixture, copy `pipeline/.cache/companyfacts/CIK*.json`
  into `data/fixtures/edgar/`.

## How extraction works (`extract.py`, `tags.py`)
- **Annual facts:** only facts from forms `10-K`/`10-K/A` with `fp == "FY"` are used. Flow
  items must cover 350–380 days, which drops Q4 3-month and YTD facts. Balance-sheet instants
  must fall within 10 days of a fiscal-year end.
- **Fiscal year:** taken from the period `end` date, not the `fy` field (`fy` is the
  *filing's* year, so comparatives carry the newer fy). A 52/53-week year ending in the first
  week of January belongs to the prior year (J&J FY2020 ended 2021-01-03).
- **Restatements:** when several facts cover the same `(start, end)`, the one with the latest
  `filed` date wins. A 10-K/A wins a tie.
- **Tag fallback:** each field has an ordered tag list, resolved **per fiscal year**. For
  example, revenue checks `Revenues` → `RevenueFromContractWithCustomerExcludingAssessedTax` →
  `SalesRevenueNet` → …, so a company that moved to ASC 606 keeps its older years.
- **total_debt:** noncurrent LTD (`LongTermDebtNoncurrent` | `LongTermDebtAndCapitalLeaseObligations`)
  plus current debt. Current debt is `DebtCurrent` if tagged, otherwise `LongTermDebtCurrent`
  + `CommercialPaper`|`ShortTermBorrowings`. If only `LongTermDebt` is tagged, it is used as
  the total.
- **Derived values:**
  - `gross_profit = revenue − cost_of_revenue` when `GrossProfit` isn't tagged.
  - `free_cash_flow = OCF − |capex|`.
  - `total_liabilities = LiabilitiesAndStockholdersEquity − equity` when `Liabilities` is missing.
- **Imputations:** these are recorded in an optional per-company `data_notes` array, which is
  an additive field not in the contract.
  - `dividends_paid = 0` when a cash-flow statement exists but no dividend tag does.
  - `total_debt = 0` when a balance sheet exists but no debt tag does.

## Metrics (`metrics.py`)
The metrics follow the contract formulas exactly. Null rules:
- `pe` is null when EPS ≤ 0. `pb`, `roe` and `debt_to_equity` are null when equity ≤ 0.
- `ev_ebitda` is null when EBITDA ≤ 0.
- Growth is null when the prior value is ≤ 0. CAGR is null unless both ends are > 0.
- `roic` is null when invested capital is ≤ 0.
- In EV and ROIC, missing debt or cash counts as 0.
- `tax_rate` is `income_tax / pretax_income` clamped to [0, 0.35]. It defaults to 0.21 when
  that can't be computed.

Ratios are rounded to 6 decimals and USD values ≥ 1e6 to whole dollars. The output is
written with `allow_nan=False` and checked by `schema.validate_document` before writing.

History pairs are omitted for years where a value can't be computed (for example, gross
margin for banks), so a series may have fewer points than `revenue`.

## Known gaps
- The fixtures for everyone except MU are approximate values from memory (see `data/fixtures/README.md`).
- Offline, MU validation is circular because the MU fixture was built from the same YCharts
  files. It proves extraction is lossless. The meaningful check is `validate` against live EDGAR.
- YCharts `Total Debt` for MU includes lease obligations. EDGAR's `LongTermDebtNoncurrent` may
  not, so expect a few % difference on `total_debt` in a live validation.
- There is no stock-split adjustment. EDGAR keeps old EPS and share counts as originally
  reported unless a later 10-K re-presents them. NVDA and TSLA fixtures are pre-adjusted.
- Banks and insurers have no gross profit, operating income or current ratio. EV and FCF for
  banks are not meaningful.
- Sector and industry are hardcoded only for the bundled universe. Other tickers get "Unknown".
- `shares_diluted` is the weighted-average diluted count for the fiscal year, so market cap
  uses it rather than the current shares outstanding, as the contract specifies.

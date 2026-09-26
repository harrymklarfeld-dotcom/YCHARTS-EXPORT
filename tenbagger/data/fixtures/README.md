# Pipeline fixtures

**WARNING: most of these values are approximate and were typed from memory. Do not
treat them as reported financials. Replace them with live EDGAR pulls before relying on them.**

| Path | What | Provenance |
|---|---|---|
| `edgar/CIK0000723125.json` (MU) | companyfacts, FY2015–FY2025 + FY2026 Q1–Q3 10-Q facts | **Real data.** Built from the YCharts statement exports in `data/ycharts/` (annual = sum of fiscal quarters, balance sheet = fiscal-year-end quarter). EPS = net income / average diluted shares, so it can differ from the 10-K by about $0.01. |
| `edgar/CIK*.json` (AAPL, MSFT, COST, KO, NVDA, JPM, XOM, JNJ, TSLA, AMZN, PG) | companyfacts, about 5 fiscal years | **APPROXIMATE, typed from memory** (`pipeline/fixture_data.py`). |
| `edgar/company_tickers.json` | ticker→CIK map subset | same shape as `https://www.sec.gov/files/company_tickers.json` |
| `prices_sample.csv` | one price per ticker | **SAMPLE, not live quotes** (`is_sample=true`). The MU price comes from `data/mu_fundamentals.json`. |

The files use the real companyfacts structure
(`facts → us-gaap → Tag → units → USD → [{start, end, val, accn, fy, fp, form, filed}]`).
Each synthetic 10-K repeats prior-year comparatives with the *filing's* `fy`, the same way EDGAR does.
Some quirks are included on purpose so the extractor gets tested:
- J&J revenue is restated after the Kenvue separation.
- MU uses the pre-ASC 606 `SalesRevenueNet` tag before FY2019.
- MU has a 3-month Q4 fact inside a 10-K, plus 10-Q facts.
- Tags vary across filers, for example `PaymentsToAcquireProductiveAssets` and `DebtCurrent`.

Regenerate with `python -m pipeline make-fixtures` (run from `tenbagger/`).
To replace the synthetic files with real ones, copy live responses from
`https://data.sec.gov/api/xbrl/companyfacts/CIK##########.json` (or `pipeline/.cache/companyfacts/`) into `edgar/`.

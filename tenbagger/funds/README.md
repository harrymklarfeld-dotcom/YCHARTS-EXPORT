# Tenbagger funds (ETF look-through)

Builds `tenbagger/data/funds.json` from free SEC data: **Form N-PORT-P** holdings and the
**prospectus risk/return inline XBRL** fee table. Python 3.11, standard library only (pytest for tests).

```bash
cd tenbagger
python -m funds build --offline          # sample fixtures in data/fixtures/nport → data/funds.json
python -m funds build                    # live SEC (falls back to the fixture per fund on any error)
python -m funds build --tickers VOO,QQQ  # subset
python -m funds make-fixtures            # regenerate the SAMPLE fixtures
python -m pytest funds -q
```

> **The offline fixtures are SAMPLES, not filings.** `data/fixtures/nport/*.xml` use the real
> N-PORT-P XML layout, but the weights are rough approximations written from memory, with the tail
> collapsed into one `SAMPLE AGGREGATE` line. Every fund built from them has `is_sample: true` and the
> app shows a "Sample data" badge. **Replace them with live N-PORT pulls** (`python -m funds build`
> from a machine that can reach `www.sec.gov` / `data.sec.gov`, with `TENBAGGER_SEC_UA="Name email"`).

## Live flow (`sec.py`)
1. `www.sec.gov/files/company_tickers_mf.json` → trust CIK, series id, class id for the ticker.
2. `data.sec.gov/submissions/CIK##########.json` → recent `NPORT-P` accessions. A trust files one per
   series, so they are opened newest-first until `genInfo/seriesId` matches (max 60).
3. `Archives/edgar/data/<cik>/<acc>/primary_doc.xml` → `nport.parse_nport`.
4. Newest `485BPOS`/`497K` primary document → `rr.expense_ratio(doc, class_id)`
   (`NetExpensesOverAssets` preferred over `ExpensesOverAssets`, `scale` honoured).

Not every ETF files N-PORT. **QQQ** is a unit investment trust (live builds read **QQQM**, same index,
flagged `proxy_for` in `sources`), and **GLD** is a grantor trust holding bullion (10-K filer, so it
keeps the sample). N-PORT is public only for each fiscal quarter's third month and appears ~60 days
later, so the app always shows `as_of`.

## Output shape (`data/funds.json`, schema_version 1)
```jsonc
{ "schema_version": 1, "generated_at": "…Z", "source": "fixture | sec-nport | mixed",
  "funds": [{
    "ticker": "VOO", "name": "Vanguard S&P 500 ETF", "issuer": "Vanguard",
    "category": "US Large Cap",            // our own labels, see reference.CATEGORIES
    "expense_ratio": 0.0003,               // decimal
    "total_net_assets": 1.4e12, "as_of": "2025-06-30", "holdings_count": 505,
    "top_holdings": [{ "name": "NVIDIA Corp", "ticker": "NVDA", "weight": 0.073, "mapped": true }],  // ≤ 25, desc
    "allocation": { "stock": 0.999, "bond": 0, "cash": 0.001, "commodity": 0, "other": 0 },         // sums to 1
    "sector_weights": { "Technology": 0.2255, "…": 0, "Unclassified": 0.50 },                         // decimals of NAV, stocks only
    "look_through": { "weighted_pe": 38.2, "weighted_fcf_yield": 0.019, "weighted_roic": 0.53, "coverage_pct": 0.31 },
    "is_sample": true, "note": null,
    "sources": [{ "type": "nport-p | nport-p-fixture | prospectus-ixbrl | sample-expense-ratio | companies.json", "ref": "…" }]
  }]}
```
Additive fields beyond the brief: `top_holdings[].mapped` (ticker is in `companies.json`, so the app can
link it) and `note`.

## Rules
- **Allocation.** EC/EP → stock; DBT/ABS/LON/SN → bond; STIV → cash; COMM or OTHER described as gold →
  commodity; the rest → other. N-PORT lists securities only, so `100% − Σ pctVal` is counted as cash.
  Over 100% gets rescaled and shorts get folded into other, so the mix always sums to 1.
- **Mapping** (`mapping.py`) tries the position's ticker identifier first, then its CUSIP or US ISIN
  (`reference.CUSIP_TO_TICKER`), then the normalised issuer name against `companies.json`
  (`"Coca-Cola Co/The"` → `"coca cola"` ← `"The Coca-Cola Company"`).
- **Look-through** (`lookthrough.py`) runs over mapped holdings only, re-weighted per metric.
  P/E is **harmonic**: `1 / Σwᵢ·(E/P)ᵢ / Σwᵢ`, using `earnings_yield` so loss-makers count. It is null
  if that value is ≤ 0. FCF yield and ROIC are plain weighted means. `coverage_pct` is the NAV share
  that maps to `companies.json`. With the current 12-company universe, coverage is low (2–37%), so
  treat these as illustrations.
- **Sectors.** A holding uses its `companies.json` sector, then `reference.SECTOR_HINTS`, then the
  fund's `default_sector` (sector funds only), then `Unclassified`.

# Tenbagger: Data Sourcing Strategy

**Status:** decision document, v1, 2026-09-25. **Owner:** data infrastructure.
**Audience:** founder plus an outside reviewer (engineering or legal).
**Scope:** where Tenbagger gets fundamentals, prices, fund/ETF data, identifiers and
corporate actions, and which of those sources we may **legally show to paying users**.

> **How this was researched.** Vendor terms change often. Every vendor claim below comes
> from web searches run on **2026-09-25**. Each one cites the URL the search surfaced.
> The sandbox this was written in blocks direct fetches of vendor sites (eodhd.com,
> massive.com, intrinio.com, tiingo.com, FMP, Alpaca docs all returned `EGRESS_BLOCKED`).
> So claims tagged **[S]** rest on search-result excerpts of the cited page, not on a
> full read of it. **[U]** means unverified: industry knowledge, or a figure we could not
> tie to a primary page. Before signing anything, a human should read each vendor's
> current order form. **The contract you sign controls, not this document.**

---

## 1. Decision summary

| Phase | Fundamentals | Prices (EOD) | Funds/ETFs | IDs | Corp. actions | Est. data cost / mo |
|---|---|---|---|---|---|---|
| **Prototype** (team plus invited testers, free) | SEC EDGAR XBRL (companyfacts API, FSDS bulk as fallback) | **Sample prices flagged `price_is_sample`**. Team-only checks may use Tiingo internal ($50) | SEC N-PORT (holdings) | SEC `company_tickers.json` + OpenFIGI | SEC XBRL (annual dividends paid, DPS) | **$0** (optionally $50 Tiingo for internal QA only) |
| **Public beta** (paying users, US equities, EOD) | SEC EDGAR (unchanged) | **Tiingo EOD with redistribution licence** (startup tier) *or* EODHD Commercial/B2B | SEC N-PORT + ETF prices from the same vendor | same | Tiingo EOD `divCash`/`splitFactor`, or EODHD splits/dividends | **≈ $250 to $450** + Supabase/GitHub (≈ $25) |
| **Scale** (delayed/intraday quotes, ETFs, linked brokerage) | SEC EDGAR, plus a vendor for normalized/TTM/quarterly and non-US names if needed | Massive (ex-Polygon) Business, or an EODHD/Intrinio enterprise display agreement | Vendor ETF data + N-PORT | + licensed CUSIP only if the brokerage requires it | vendor | **≈ $2,000 to $5,000** [U: enterprise quotes] |

**Rules that stay fixed in every phase**

1. **Fundamentals come from the SEC.** It is free and is US-government work (no copyright).
   Showing it to paying users is legally safe. We only have to follow the SEC fair-access
   policy: a declared User-Agent and at most 10 requests per second.
2. **Every price shown to a user must come from a vendor whose contract grants display or
   redistribution rights to external users.** An API key alone does not grant those rights.
   Nearly every self-serve "individual" or "startup" plan we reviewed forbids display.
   This rule is enforced in code: `python -m datasources gate` refuses to publish real
   prices unless the price source is recorded as licensed (§5).
3. **Never ship yfinance, Yahoo, Stooq, Alpaca free data or any scraped prices to users.**
   A sample price must stay flagged `price_is_sample: true` so the app labels it.
4. **Do not show GICS sectors, CUSIPs, or the "S&P 500" name without a licence.**
   Sectors come from public SEC SIC codes mapped to our own taxonomy
   (`datasources/sic.py`). The universe is labelled "US large caps".

---

## 2. Evaluation criteria

- **Cost:** list price, where it is published.
- **Coverage:** US equities, ETFs, history depth, fundamentals.
- **Display rights:** whether we may show the data to *other people* (including testers) in
  a commercial consumer app. This is the gating criterion.
- **Reliability:** SLA, vendor longevity, rate limits.
- **Effort:** integration work, given our pipeline (EDGAR XBRL, then `companies.json`,
  then Supabase).

---

## 3. Options by data domain

### 3a. Fundamentals

| Source | Cost | Coverage | Display rights (commercial app) | Reliability | Effort |
|---|---|---|---|---|---|
| **SEC EDGAR XBRL API**: `companyfacts`, `companyconcept`, `frames` | Free | Every XBRL filer since ~2009; 10-K/10-Q as reported; no key needed | **Yes.** US-government work. We must follow fair access: User-Agent with contact info, ≤10 req/s ([SEC Accessing EDGAR Data](https://www.sec.gov/search-filings/edgar-search-assistance/accessing-edgar-data), [SEC EDGAR APIs](https://www.sec.gov/search-filings/edgar-application-programming-interfaces)) [S] | Good. No SLA; occasional throttling; filings appear within minutes | **Done.** `tenbagger/pipeline` already does this |
| **SEC Financial Statement Data Sets** (quarterly zips: `sub/num/tag/pre.txt`) | Free | All face-financial XBRL values filed in each quarter ([SEC FSDS page](https://www.sec.gov/data-research/sec-markets-data/financial-statement-data-sets), [field spec PDF](https://www.sec.gov/files/financial-statement-data-sets.pdf)) [S] | **Yes** (same basis) | Good. Updated quarterly, so it lags the API by up to a quarter; `ddate` is rounded to month-end | **Done:** `datasources/edgar_bulk.py` emits a companyfacts-shaped cache the pipeline reads unchanged |
| EODHD fundamentals | Inside Commercial plans; B2B "from $399/mo" ([EODHD commercial pricing](https://eodhd.com/commercial-pricing), [commercial vs personal](https://eodhd.com/financial-apis/commercial-vs-personal-license-use)) [S] | Global, normalized, ETFs | **Only on a commercial licence.** Personal plans are non-commercial. "Commercial plans include all necessary exchange redistribution rights" [S] | Good. Small vendor | Low |
| FMP | Self-serve plans; display needs a separate **Data Display and Licensing Agreement**, custom quote ([FMP FAQ](https://site.financialmodelingprep.com/faqs), [FMP public-app article](https://site.financialmodelingprep.com/insights/platform/can-you-use-fmp-data-in-a-public-app-website-or-client-dashboard)) [S] | Broad | **No** on standard plans; **yes** only with the display agreement | Good | Low |
| Intrinio | Individual/Startup: "No redistribution or display". Small Business "from $333/mo" ([Intrinio pricing](https://intrinio.com/pricing), [Starter plan](https://intrinio.com/guides/starter-plan)) [S]. Display rights on Small Business [U] | Strong US fundamentals (standardized) | **No** on Startup; display needs a custom agreement ("contact Intrinio") [S] | Good. Took over IEX Cloud refugees | Medium |
| Nasdaq Data Link / **Sharadar** Core US Fundamentals | Not published; separates non-professional from professional/institutional licences ([Sharadar on NDL](https://data.nasdaq.com/databases/SFA), [sharadar.com](https://sharadar.com/)) [S] | Excellent point-in-time US fundamentals, ~1998+ | **No** by default. Display needs a negotiated distribution licence [U] | Very good | Low (bulk tables) |
| Massive (ex-Polygon) Financials add-on | Individual "Stocks Financials Add-on" vs "Stocks Financials for Business" ([Massive pricing](https://massive.com/pricing), [Massive business](https://massive.com/business)) [S] | XBRL-derived | Business plan only (see 3b) | Good | Low |
| Finnhub | Free tier is **non-commercial**; commercial through sales ([Finnhub pricing](https://finnhub.io/pricing), [startups/enterprise](https://finnhub.io/pricing-startups-and-enterprise), [FAQ](https://finnhub.io/faq)) [S] | Global | **No** without a commercial contract | OK | Low |
| Tiingo fundamentals | Redistribution: **$200/mo startup (<5 employees), $500/mo enterprise** ([Tiingo fundamentals](https://www.tiingo.com/products/fundamental-data-api), [Tiingo pricing](https://www.tiingo.com/about/pricing)) [S] | US, ~5,500 names [U] | **Yes** with a redistribution licence | Good | Low |

**Recommendation.** Keep SEC XBRL as the system of record for every lesson number. It is
free, primary, auditable, and safe to display. Lessons can cite the filing (the `accn` is
kept in companyfacts). Add a vendor for fundamentals only when a real gap appears:
quarterly/TTM normalization at scale, non-US companies, or pre-2009 history.

### 3b. Prices (EOD or 15-minute delayed)

Exchange last-sale data is licensed by the exchanges. Vendors pass those obligations on to
us through their contracts. A single closing price is arguably a fact. **But our exposure
is contractual: vendor ToS, then exchange policies.** Copyright is not the issue.
Nasdaq's policies allow fee-free or reduced-fee *delayed* data under a qualifying
distributor agreement, and require a delay label on every display
([Nasdaq US data policies](https://www.nasdaqtrader.com/content/AdministrationSupport/Policy/USEquitiesandOptionsDataPolicies.pdf),
[Display requirements](https://www.nasdaqtrader.com/content/AdministrationSupport/Policy/DISPLAYREQUIREMENTSPOLICY.pdf)) [S].
In practice a startup gets these rights by buying a vendor tier that bundles them.

| Source | Cost | Display rights | Notes |
|---|---|---|---|
| **Tiingo EOD / IEX** | Internal commercial **$50/mo** (no display). **Redistribution: $250/mo startup, $500/mo enterprise**, flat rate, by contacting sales@tiingo.com ([Tiingo pricing](https://www.tiingo.com/about/pricing), [EOD product](https://www.tiingo.com/products/end-of-day-stock-price-data), [ToS](https://app.tiingo.com/tos/)) [S] | **Yes** on the redistribution tier | Cheapest *published* redistribution price we found. EOD rows include `divCash` and `splitFactor` [U]. **Beta pick.** No adapter yet; `csv_prices` or a copy of `eodhd.py` is about a 1-hour job |
| **EODHD Commercial / B2B** | from **$399/mo** (search also shows "custom plans from €399") ([commercial pricing](https://eodhd.com/commercial-pricing), [B2B](https://eodhd.com/lp/b2b-solution)) [S] | **Yes.** "Commercial plans include all necessary exchange redistribution rights" [S]. Confirm end-user caps in the order form [U] | Adds global coverage, 20k+ ETFs, fundamentals, splits/dividends in one contract. **Beta alternative.** Adapter: `datasources/eodhd.py` |
| **Massive (ex-Polygon) Business** | Individual $29 to $399/mo tiers (pre-rebrand figures) ([qveris guide](https://qveris.ai/guides/polygon-pricing-optimized/)) [S]. Business "Scale" plan cited at **$2,000/mo with redistribution rights** [U: figure from a search snippet, not the pricing page] | **Business plan required to show data to *anyone* else, testers included** ([Massive KB](https://massive.com/knowledge-base/article/which-plan-do-i-need-to-show-massive-data-in-my-app)) [S] | Best developer experience and real-time/delayed websockets. **Scale-phase pick** |
| **Intrinio** | Startup: "No redistribution or display". Small Business from $333/mo ([pricing](https://intrinio.com/pricing), [licensing guide](https://intrinio.com/blog/market-data-licensing-guide-for-fintechs)) [S] | Display = custom contract | Adapter: `datasources/intrinio.py` (per-ticker calls) |
| **FMP** | Plans + separate display agreement (quote) [S] | Display = separate agreement | Adapter: `datasources/fmp.py` |
| **Alpaca Market Data** (free "Basic" = IEX only; SIP is paid) ([About Market Data API](https://docs.alpaca.markets/us/docs/about-market-data-api), [Market data FAQ](https://docs.alpaca.markets/us/docs/market-data-faq)) [S] | Free / paid | **No.** Alpaca's support article "Can I redistribute Alpaca API data via my platform?" answers no ([Alpaca support](https://alpaca.markets/support/redistribute-alpaca-api)) [S]. Broker API partners get "bespoke" market-data plans ([Broker API](https://alpaca.markets/broker)) [S] | Useful for **internal** QA. Relevant again in Phase 3 *if* we become an Alpaca Broker API partner, since the partner data plan may cover our own brokerage customers [U]. Adapter: `datasources/alpaca.py` |
| **Finnhub** | Free = non-commercial; commercial by quote [S] | Contract only | Skip unless quoted cheaper than Tiingo |
| **Nasdaq Data Link** (Sharadar SEP prices) | Not published [S] | Professional/distribution licence [U] | Better as a research dataset than an app feed |
| **IEX Cloud** | n/a | n/a | **Shut down.** Retirement announced 2024-05-31, all APIs off 2024-08-31. Customers were referred to Intrinio ([Alpha Vantage analysis](https://www.alphavantage.co/iexcloud_shutdown_analysis_and_migration/), [Tiingo blog](https://www.tiingo.com/blog/iex-cloud-alternatives/), [Massive migration guide](https://massive.com/blog/iex-cloud-migration-guide)) [S] |
| **Stooq** | Free CSV, undocumented endpoints, low daily quota ([QuantStart](https://www.quantstart.com/articles/an-introduction-to-stooq-pricing-data/), [stooq.com/db](https://stooq.com/db/)) [S] | **No** licence to redistribute that we can find | Dev/backtest only. Never ship |
| **yfinance / Yahoo** | Free, unofficial | **No.** yfinance says the Yahoo API is "intended for personal use only". Yahoo's API terms bar deriving income without written permission ([yfinance docs](https://ranaroussi.github.io/yfinance/), [Yahoo Developer API Terms](https://legal.yahoo.com/us/en/yahoo/terms/product-atos/apiforydn/index.html)) [S] | **ToS risk, and it breaks often.** Never ship |

### 3c. Fund / ETF data

| Source | What | Cost | Display | Notes |
|---|---|---|---|---|
| **SEC Form N-PORT Data Sets** | Position-level holdings of registered funds and ETFs, flattened quarterly. Only the 3rd month of each fiscal quarter is public ([SEC announcement 2024-07](https://www.sec.gov/newsroom/whats-new/2407-form-nport-data-sets), [data.gov](https://catalog.data.gov/dataset/form-n-port-data-sets), [readme](https://sec.gov/files/nport_readme.pdf)) [S] | Free | **Yes** (public SEC data) | Good for "what's inside this ETF" lessons. It lags ~60 days, so show the as-of date |
| SEC fund prospectus risk/return XBRL (expense ratios, fees) | Public XBRL [U: data-set name and cadence] | Free | Yes | Expense-ratio lessons |
| Vendor ETF prices and NAV | EODHD (20k+ ETFs [S]), Tiingo, Massive | In the price contract | Per contract | Use the same vendor as for stock prices |

### 3d. Identifier mapping (ticker, CIK, FIGI, CUSIP)

| Source | Cost | Display | Notes |
|---|---|---|---|
| **SEC `company_tickers.json`** (ticker, CIK, name) | Free | Yes | Already used by the pipeline. Refresh daily. Tickers get reused, so key everything on **CIK** ([SEC EDGAR APIs](https://www.sec.gov/search-filings/edgar-application-programming-interfaces)) [S] |
| **OpenFIGI** (Bloomberg) | Free; an API key raises rate limits | FIGI data is open (the search cites the MIT licence) | Takes CUSIP/ISIN as **input** but does **not return** CUSIP/ISIN, because of third-party licensing ([OpenFIGI FAQ](https://www.openfigi.com/about/faq), [API docs](https://www.openfigi.com/api/documentation)) [S]. Use FIGI as our cross-vendor security key |
| CUSIP | Licensed by CUSIP Global Services | **Licence needed** to store or display at scale [U] | Avoid. Brokerage aggregators (Plaid/SnapTrade) may return CUSIPs: use them for matching only, never show them |

### 3e. Corporate actions and dividends

- **SEC XBRL (free, displayable):** annual `PaymentsOfDividends*` and
  `CommonStockDividendsPerShareDeclared`, share counts, and
  `StockholdersEquityNoteStockSplitConversionRatio1` when tagged [U: tag coverage varies].
  This is enough for "dividend yield" and "buybacks" lessons.
- **Split-adjusted price history and ex-dates** need a vendor. Tiingo EOD carries dividend
  and split fields [U]. EODHD and Massive have dedicated split/dividend endpoints. All fall
  under the same display licence as the prices.
- **Policy:** show unadjusted price next to reported (unadjusted) EPS for P/E. The
  `eodhd.py` adapter uses unadjusted `close` by default for this reason.

---

## 4. Legal safety matrix: what we may show paying users

| Data | Source | Safe to display? |
|---|---|---|
| Financial statements, derived metrics, history | SEC EDGAR API / FSDS | **Yes** |
| Fund holdings | SEC N-PORT | **Yes** (show as-of date) |
| Ticker / CIK / name | SEC | **Yes** |
| FIGI | OpenFIGI | **Yes** |
| Sector (our own labels from SIC) | SEC SIC codes | **Yes** |
| GICS sector/industry | MSCI / S&P | **No** without a licence |
| "S&P 500" as a product label or index membership | S&P DJI | **No** without a licence (our universe CSV uses public ticker/CIK only) |
| EOD / delayed prices | Tiingo redistribution, EODHD Commercial, Massive Business, Intrinio/FMP **with signed display agreement** | **Yes, only under that contract** |
| Prices from Alpaca free/paid, Tiingo $50 internal, FMP/Intrinio/EODHD personal or startup, Finnhub free | vendor | **No** (internal use only) |
| yfinance / Yahoo / Stooq / scraped | none | **No** |
| Sample prices (`price_is_sample: true`) | typed placeholders | Only as clearly labelled examples. Never as quotes |
| CUSIP | CGS | **No** |
| User's own holdings (Plaid/SnapTrade) | the user's own brokerage data, under aggregator terms | **Yes, to that user only**, per aggregator agreement [U] |

Also required, and not just good practice: an "educational, not investment advice"
disclaimer. Price displays need the as-of timestamp and delay label that exchange
policies ask for.

---

## 5. How the code enforces this (`tenbagger/datasources/`)

- `PriceSource` / `FundamentalsSource` interfaces. Each adapter exposes a
  `license: LicenseInfo` and a `license_allows_display` property.
- Vendor adapters (`alpaca`, `eodhd`, `intrinio`, `fmp`) default to **not displayable**.
  They switch to displayable only when `TENBAGGER_<VENDOR>_DISPLAY_LICENSE` holds a
  **contract reference**, e.g. `"EODHD B2B order 1234, signed 2026-10-01"`. Bare
  `1`/`true` are rejected. The reference goes into the provenance manifest for audit.
- `python -m datasources prices` writes a pipeline-compatible `prices.csv` plus
  `prices.manifest.json` (per-ticker source, date, display flag).
- `python -m datasources gate` exits 3 when any real (non-sample) price lacks licensed
  provenance or its date does not match. The nightly workflow publishes (to the `data`
  branch and Supabase) **only if the gate passes**. Otherwise the build is kept as a
  private CI artifact.
- `edgar_bulk` turns SEC FSDS zips into companyfacts JSON so the pipeline can build ~500
  companies from ~16 zip downloads instead of 500 API calls. It also records SIC codes
  for sector labels.

---

## 6. Phased plan and costs

**Prototype (now, $0).**
Nightly GitHub Action: SEC API for the ~500-name US large-cap universe, then
`companies.json`, validation, publish to the `data` branch. Prices stay sample and are
flagged. Lessons that need prices (P/E, yields) are labelled "example price". Optional
Tiingo $50 internal plan for the team to sanity-check metrics. Its prices are **not**
published: the gate blocks them automatically.

**Public beta (≈ $250 to $450/mo data).**
Before the first paying user, sign **Tiingo EOD redistribution (startup, $250/mo)** or
**EODHD Commercial (from $399/mo)**. Record the contract reference as a repo variable and
set `TENBAGGER_PRICE_SOURCE`. Keep fundamentals on SEC. Add N-PORT for ETF lessons.
Decision rule: Tiingo if US-only EOD is enough. EODHD if we want ETFs, global names and
vendor fundamentals under one contract.

**Scale (≈ $2k to $5k/mo, quotes needed).**
When the product needs intraday/delayed quotes or watchlists: Massive Business or an
enterprise display agreement (EODHD/Intrinio). Get a written end-user cap and the exchange
reporting obligations (non-pro user counts). If Phase-3 brokerage goes through Alpaca
Broker API, negotiate the market-data addendum then, and re-evaluate before paying for
two feeds.

**Infra cost (all phases):** GitHub Actions nightly run is inside free minutes for a
public repo and ~10 to 20 minutes/night for a private one [U]. Supabase Pro is $25/mo [U].

---

## 7. Risks and open questions

1. **Every vendor price above must be re-confirmed from an order form.** They are search
   excerpts, and several are "contact sales".
2. **SEC fair access.** Use a real contact User-Agent (secret `SEC_USER_AGENT`) and ≤10 req/s.
   The pipeline enforces both. Bulk FSDS mode cuts request count about 30×.
3. **XBRL quality.** Tag choice varies by filer. The pipeline validates against YCharts
   exports for MU. FSDS rounds period dates to month-end, so `fiscal_year_end` may read
   `08-31` rather than `08-28`.
4. **Universe drift.** `datasources/universes/sp500.csv` is a 2026-09-25 snapshot from a
   public GitHub dataset. Refresh it quarterly.
5. **Exchange non-professional reporting** may apply once real-time or delayed quotes
   ship (Scale phase) [U].

# Tenbagger: YCharts Competitive Feature Teardown

Prepared 2026-09-25 by the research agent. It builds on `PRODUCT_STRATEGY.md`, `DATA_STRATEGY.md` and `MONEY_HUB_RESEARCH.md`, and on what already exists in `CONTRACT.md`, `packages/screener/`, `packages/money/` and `mobile/src/app/`.

**Confidence tags** (same as the other docs):
- **[P]** Primary: YCharts' own product pages, knowledge base, blog, or press release, describing its own product.
- **[S]** Reputable secondary: established press (BusinessWire syndication counts as the company's own release; press coverage counts as [S]).
- **[U]** Unverified: review sites, comparison blogs, aggregator summaries of G2/Capterra, or our own inference.

**Method and ground rules.**
- `ycharts.com` is blocked by this sandbox's proxy. **Every claim below comes from web-search snippets of the linked page, all accessed 2026-09-25.** Nothing was fetched, scraped, logged into, or copied. No YCharts text, data or visual design is reproduced. Descriptions are our paraphrase.
- Snippet-sourced claims should be opened and checked by a human before they go in a deck.
- The purpose is to learn *which jobs* YCharts does well, so we can build our **own** versions on SEC EDGAR data with our own design. We are not cloning its UI.
- Nothing here is legal advice.

---

## 0. The answer in one screen

- **YCharts is an advisor workflow tool, not a retail product.** It costs about $300–$500 per user per month billed annually, has no free tier, and reviewers call it "overkill" for individuals ([WallStreetZen, U](https://www.wallstreetzen.com/blog/ycharts-review/); [SoftwareSuggest, U](https://www.softwaresuggest.com/ycharts/pricing)). Its growth is in proposals, reports, risk profiles and AI for advisors ([BusinessWire 2025-06-09, S](https://www.businesswire.com/news/home/20250609721891/en/More-Than-Research-YCharts-Powers-Personalized-Proposals-at-Scale)).
- **What it does brilliantly and we can learn from:** any metric over time for several companies on one chart; side-by-side comparison tables; weighted scoring models that turn metrics into a 0–100 percentile rank; screens that alert you when a company enters or leaves; and one-click "Quickflows" that chain tools together.
- **What we should not copy:** real-time or intraday quotes, the 500k economic-indicator library, Morningstar/S&P/MSCI-licensed data (fund ratings, style boxes, ESG), advisor proposals and branded reports, and the Excel add-in.
- **Top 10 to adapt for beginners** (ranked in §2): 1. Metric dictionary everywhere (S), 2. Compare two to four companies (S), 3. Metric-over-time chart with peer overlay (M), 4. Saved screens with "who's new" alerts (S), 5. Watchlist plus SEC-filing feed that becomes a drill (M), 6. Two-metric scatter "map" (M), 7. Build-your-own scorecard (M), 8. Statement explorer (M), 9. Portfolio look-through in the Money hub (M), 10. Shareable company one-pager (S).
- **Build next:** #2 Compare, #1 Metric dictionary, #3 Metric-over-time chart. All three run on data we already have or can get free from SEC XBRL, and all three turn existing lessons into tools people keep using.

---

## 1. Feature catalog

"Who it serves" is our reading of YCharts' positioning: **A** = advisors/institutions, **R** = self-directed retail, **A>R** = advisor-first but useful to retail.

### 1.1 Fundamental Charts

| | |
|---|---|
| **What it does** | Plots any of 4,000+ metrics or line items over time for many securities at once, and can layer in economic indicators ([product page, P](https://get.ycharts.com/platform/tools/fundamental-charts/)). There are "original" (raw values) and "normalized" (percent change from the first period) modes ([KB overview, P](https://go.ycharts.com/knowledge-base/fundamental-charts-overview)). You can add annotations and recession shading, and put a firm logo on the chart ([product page, P](https://get.ycharts.com/platform/tools/fundamental-charts/); [KB annotations, P](https://go.ycharts.com/knowledge-base/fundamental-charts-annotations)). It can also show percent off high or the growth of a dollar amount ([TopTradeReviews, U](https://toptradereviews.com/ycharts-review/)). |
| **Who** | A>R |
| **Why it's good** | One question ("how has X's margin moved against its peers?") gets one picture. Normalizing makes companies of very different size comparable. Reviewers call it one of the platform's most distinctive features ([TopTradeReviews, U](https://toptradereviews.com/ycharts-review/)). |

### 1.2 Stock Screener and Fund Screener

| | |
|---|---|
| **What it does** | Stock: filter about 28k equities on about 4,500 metrics, with custom formulas; more than 30 prebuilt templates; save and share screens across a team; set alerts when a security starts or stops meeting the criteria ([product page, P](https://get.ycharts.com/platform/tools/stock-screener/); [KB, P](https://go.ycharts.com/knowledge-base/stock-screener-overview)). Fund: a universe of up to 77k mutual funds, ETFs, CEFs and UITs, filtered on expense ratio, manager tenure, fund flows, custodian availability and exposure limits, with 30+ templates ([product page, P](https://get.ycharts.com/platform/tools/fund-screener/)). Results feed into Charts, Comp Tables, Excel and timeseries tools. |
| **Who** | A>R (stock); A (fund, especially custodian availability) |
| **Why it's good** | Templates give people a starting point. Screens are persistent objects that can be saved, shared and alerted on, not one-off queries. Screen results flow straight into the next tool. |

### 1.3 Comp Tables and Scoring Models

| | |
|---|---|
| **What it does** | Side-by-side tables of stocks, funds or portfolios on metrics you pick. You can seed the table from a watchlist, holdings or screener results, and export to CSV or a client-ready PDF ([KB, P](https://go.ycharts.com/knowledge-base/comp-table-overview); [blog, P](https://get.ycharts.com/resources/blog/new-comp-tables-pdf/)). **Scoring Models** let you pick metrics and weights and get a 0–100 score based on percentile rank inside the peer set ([KB, P](https://go.ycharts.com/knowledge-base/scoring-models-overview)). |
| **Who** | A>R |
| **Why it's good** | The table answers "which of these is different, and on what?" The score makes a methodology explicit and transparent: *you* chose the weights. |

### 1.4 Scatter Plot and Timeseries Tables

| | |
|---|---|
| **What it does** | Pick securities or a list and any two metrics for the X and Y axes. It can plot one point in time or a series over time ([search snippet of ycharts.com/charts/scatter_plot, U](https://ycharts.com/charts/scatter_plot/)). Timeseries tables give the raw history ([ycharts.com/tables/timeseries, U](https://ycharts.com/tables/timeseries/)). |
| **Who** | A>R |
| **Why it's good** | A scatter shows a whole sector's trade-off, such as growth against valuation, in one glance. It is a very good teaching visual. |

### 1.5 Model Portfolios, Scenarios and Risk Profiles

| | |
|---|---|
| **What it does** | Build and backtest model portfolios. It shows performance, risk, holdings overlap, exposures and ESG, compares a model against a prospect's current portfolio, and produces FINRA-reviewed comparison reports ([Portfolios page, P](https://get.ycharts.com/platform/tools/model-portfolios/)). Scenarios stress-test portfolios against historical market events ([blog, P](https://get.ycharts.com/resources/blog/how-financial-advisors-use-ycharts-to-optimize-investment-strategies/)). Risk Profiles map a firm's risk tiers to benchmark and model portfolios ([KB, P](https://go.ycharts.com/knowledge-base/what-are-risk-profiles); [blog, P](https://get.ycharts.com/resources/blog/breaking-open-the-black-box-introducing-transparent-customizable-risk-profiles/)). |
| **Who** | A |
| **Why it's good** | It turns "your portfolio vs. ours" into a compliant sales artifact. That is advisor-specific value. |

### 1.6 Fund analysis

| | |
|---|---|
| **What it does** | Fund pages and screens cover holdings, expense ratios, flows, and equity or fixed-income style boxes. The mutual-fund overview summarises style-box performance and flows ([fund screener page, P](https://get.ycharts.com/platform/tools/fund-screener/); [ycharts.com/mutual_funds snippet, U](https://ycharts.com/mutual_funds)). Fund characteristics are sourced from Morningstar and eVestment ([Data page, P](https://get.ycharts.com/platform/data/)). |
| **Who** | A |
| **Why it's good** | Look-through ("what do I actually own?") and cost ("what does this fund charge me?") are the two questions every fund holder should ask. |

### 1.7 Economic Indicators

| | |
|---|---|
| **What it does** | About 500k economic series (Federal Reserve, BLS and others), some with history back to the 1800s. They can be overlaid on security charts ([Data page, P](https://get.ycharts.com/platform/data/); [KB, P](https://go.ycharts.com/knowledge-base/economic-indicator-data)). |
| **Who** | A>R |
| **Why it's good** | It gives macro context ("the why") next to company data. YCharts even runs a beginner's guide to it ([blog, P](https://get.ycharts.com/resources/blog/understanding-economic-indicators-with-ycharts-a-beginners-guide/)). |

### 1.8 Excel Add-in

| | |
|---|---|
| **What it does** | Formula functions (e.g. `YCS` for a series: ticker, metric code, lookback) that refresh models in one click, plus 40+ templates. It covers most platform data except bonds and alternatives ([product page, P](https://get.ycharts.com/platform/tools/excel-add-in/); [KB YCS, P](https://go.ycharts.com/knowledge-base/excel-ycs-function)). |
| **Who** | A |
| **Why it's good** | It meets analysts where they already work, in spreadsheets. |

### 1.9 Reports, Report Builder and Custom Reports

| | |
|---|---|
| **What it does** | Drag-and-drop PDF reports built from 30+ modules, starting from four report types (Overview, Comparison, Multi-Comparison, Presentation). You add a logo, colours and disclosures, compliance can lock sections, and you can upload outside PDFs ([Report Builder page, P](https://get.ycharts.com/platform/tools/report-builder/); [blog, P](https://get.ycharts.com/resources/blog/new-on-ycharts-report-builder/); [April 2026 update, P](https://get.ycharts.com/resources/blog/ycharts-monthly-product-update/)). |
| **Who** | A |
| **Why it's good** | Reviewers say client-facing output is what separates YCharts from cheaper tools ([WallStreetZen, U](https://www.wallstreetzen.com/blog/ycharts-review/)). |

### 1.10 Proposals

| | |
|---|---|
| **What it does** | An end-to-end proposal flow that combines Risk Profiles, Householding, Folders, AI Chat and "Quick Extract" of a prospect's statement into a personalised proposal ([BusinessWire 2025-06-09, S](https://www.businesswire.com/news/home/20250609721891/en/More-Than-Research-YCharts-Powers-Personalized-Proposals-at-Scale)). |
| **Who** | A only |
| **Why it's good** | It converts research into new assets under management, which is the advisor's revenue. |

### 1.11 Alerts

| | |
|---|---|
| **What it does** | Alerts on stocks, funds, indicators and model portfolios, triggered by financial metrics, earnings and dividend events, news, and SEC filings. They arrive by email in real time, daily or weekly ([KB Alerts Manager, P](https://go.ycharts.com/knowledge-base/alerts-manager-overview)). Price is the only metric that updates intraday, and alerts are checked every 30 minutes from 7am to 5pm ET ([Zendesk example alerts, U](https://ychartsinc.zendesk.com/hc/en-us/articles/115004439263-Example-Alerts)). Screener alerts fire on entering or leaving a screen ([product page, P](https://get.ycharts.com/platform/tools/stock-screener/)). |
| **Who** | A>R |
| **Why it's good** | The tool comes to you. The digest cadence (real-time, daily or weekly) respects attention. |

### 1.12 Dashboards, Watchlists, News and Events

| | |
|---|---|
| **What it does** | Dashboards are custom grids of modules: charts, lists, news, scatter plots, screeners and portfolios ([Dashboard page, P](https://get.ycharts.com/platform/tools/dashboard/)). A Watchlist Manager covers securities and indicators, with presets ([ycharts.com/watchlists snippet, U](https://ycharts.com/watchlists/list/)). The news feed can be filtered by ticker and source, and watchlists and holdings are monitored for news, SEC filings and big moves ([ycharts.com home snippet, U](https://ycharts.com/)). An events calendar covers earnings, dividends, splits and spinoffs, with alerts ([ycharts.com/events/calendar snippet, U](https://ycharts.com/events/calendar/)). |
| **Who** | A>R |
| **Why it's good** | One home screen for "what changed in the things I care about". |

### 1.13 Quickflows

| | |
|---|---|
| **What it does** | One-click workflows over a list of up to 12 tickers: correlation analysis, earnings beats and misses, ratio comparison (P/E, P/S, P/B), historical stress tests, and finding alternative holdings ([Quickflows page, P](https://get.ycharts.com/platform/tools/quickflows/); [blog, P](https://get.ycharts.com/resources/blog/quickflows-stock-etf-mutual-fund-comparison-tool/)). YCharts says they were built from observed customer workflows (same source). |
| **Who** | A>R |
| **Why it's good** | It is the **"next step" pattern**: a user who already has a list gets the obvious follow-up analyses without having to know which tool does them. This matters most for beginners. |

### 1.14 Data Dictionary and Glossary

| | |
|---|---|
| **What it does** | A public financial glossary with a definition and formula page per metric (e.g. `ycharts.com/glossary/terms/growth_metrics`), plus a downloadable metric reference guide for Excel ([search snippets of ycharts.com/glossary, U](https://ycharts.com/glossary); [metric reference guide snippet, U](https://ycharts.com/securities/export_metric_reference_guide/excel)). The data page describes annual, quarterly and TTM growth and per-share calculations for every line item ([Data page, P](https://get.ycharts.com/platform/data/)). |
| **Who** | A>R |
| **Why it's good** | Trust comes from knowing exactly how a number is computed. Public glossary pages also bring in search traffic (inferred, U). |

### 1.15 AI Chat and the "Y" agent

| | |
|---|---|
| **What it does** | AI Chat (launched at T3 2025) answers from YCharts data, SEC filings and news, with custom disclosure language ([AI Chat page, P](https://get.ycharts.com/platform/tools/ai-chat/); [T3 Tech Hub, U](https://t3technologyhub.com/ycharts-launches-ai-chat-to-accelerate-investment-research-enhance-client-engagement/)). The AI Market Commentary dashboard module refreshes every 15–20 minutes ([April 2026 update, P](https://get.ycharts.com/resources/blog/ycharts-monthly-product-update/)). "Y", an agent that builds visualizations and screens, was announced 2026-06-16 ([BusinessWire, S](https://www.businesswire.com/news/home/20260616232584/en/YCharts-Unveils-Specialized-AI-Agent-for-Financial-Advisors-and-Asset-Managers)). |
| **Who** | A |
| **Why it's good** | Natural language in, a finished chart or screen out. This validates our `parseQuery` direction. |

### 1.16 Company data pages

| | |
|---|---|
| **What it does** | Security pages with financial statements, consensus analyst recommendations and firm-branded tearsheets. S&P 500 fundamentals update before the next market open; small caps can take up to 10 days ([KB Equity Data, P](https://go.ycharts.com/knowledge-base/equity-data); [Data page, P](https://get.ycharts.com/platform/data/)). |
| **Who** | A>R |
| **Why it's good** | Statements are shown alongside derived growth and per-share rows, so the user does not have to do the maths. |

**Data provenance (matters for §3).** YCharts licenses fundamentals and fund data from Morningstar, S&P Global and eVestment, and ESG from MSCI ([Data page, P](https://get.ycharts.com/platform/data/)). Much of what makes it rich is licensed data we cannot legally reuse, and do not need.

---

## 2. The 10 features that translate best to a beginner consumer app (ranked)

**Ranking criteria:**
- Teaching value: does using the feature make someone better at reading numbers?
- Fit with what already exists.
- Whether free SEC data covers it.
- Effort.
- Regulatory safety: education, never advice.

**Effort scale** (same as PRODUCT_STRATEGY): **S** is under 1 week, **M** is 1–3 weeks, **L** is more than 3 weeks, for one developer with AI tools.

**Data legend:**
- **SEC ✓**: covered by free EDGAR XBRL (companyfacts or frames).
- **SEC ✓ + pipeline**: the data is in SEC, but `data/companies.json` needs a new field. That is a pipeline change and a CONTRACT change, so it must be flagged to the lead.
- **Price ✗**: needs historical prices, which are licensed (DATA_STRATEGY §1 rule 2).

| # | Our feature (YCharts analog) | Plugs into | Data | Effort |
|---|---|---|---|---|
| 1 | **Metric dictionary everywhere** (Data Dictionary/Glossary) | all screens, lessons | SEC ✓ (already in `METRIC_CATALOG`) | S |
| 2 | **Compare 2–4 companies** (Comp Tables + Quickflows ratio compare) | company page, screener results, lessons | SEC ✓ | S |
| 3 | **Metric-over-time chart with peer overlay** (Fundamental Charts) | company page, compare, lessons | SEC ✓ for existing 8 history series; SEC ✓ + pipeline for more | M |
| 4 | **Saved screens with "who's new" alerts** (saved screens + screener alerts) | screener | SEC ✓ | S |
| 5 | **Watchlist and filing feed that becomes a drill** (Watchlists + SEC-filing alerts + events) | home, company page, lessons | SEC ✓ (submissions feed) | M |
| 6 | **Two-metric scatter "map"** (Scatter Plot) | screener, lessons | SEC ✓ | M |
| 7 | **Build-your-own scorecard** (Scoring Models) | screener, compare, lessons | SEC ✓ | M |
| 8 | **Statement explorer** (company financials pages) | company page, lessons | SEC ✓ + pipeline | M |
| 9 | **Portfolio look-through** (Model Portfolios exposures) | money hub | SEC ✓ + user holdings | M |
| 10 | **Shareable company one-pager** (Report Builder/tearsheets, as a social card) | company page, share cards | SEC ✓ | S |

Honourable mentions, deliberately left out of the top 10:
- **ETF look-through** (what's inside your ETF, and what it costs). SEC N-PORT holdings plus risk/return summary XBRL cover it, but it is **L** effort and a second data domain. It belongs in v2 with the Money hub.
- **Screener next-step chips** (Quickflows pattern). Folded into #2 and #4 below.
- **Natural-language screen** (AI Chat/Y). This already exists as `parseQuery`, so it only needs surfacing in the UI.

### #1 Metric dictionary everywhere (S)

**Simplified version.**
- Every metric label in the app is tappable.
- Tapping it opens one sheet with the plain-English meaning, the exact formula, this company's numbers plugged into the formula, a "typical range" note, and a "Practice this" button that deep-links to the lesson.
- A searchable **Glossary** screen lists all 44 fields.

**Plugs in.**
- `METRIC_CATALOG` already has `explainer`, `formula` and `learnMoreLessonId` (`metric:<key>`).
- `mobile/src/components/MetricExplainer.tsx` exists. Extend it; do not duplicate it.

**Data.** SEC ✓. No new data.

**Build spec.**
- Add `mobile/src/app/glossary/index.tsx`: a searchable FlatList of `METRIC_CATALOG` grouped by `category`.
- Add `mobile/src/app/glossary/[key].tsx`: a full page.
- Extend `MetricExplainer` to accept an optional `company`, then render a "worked example" row that substitutes that company's raw fundamentals into the contract formula. For example, `gross_margin = gross_profit / revenue = $X / $Y = Z%`.
  - Build it from a new pure helper `workedExample(key, company): {lhs, terms: {label, value}[], result} | null` in `mobile/src/lib/metricCatalog.ts`.
  - Unit-test it against fixture companies, including the null cases (negative EPS makes P/E null, and the sheet should say why: "P/E isn't meaningful when earnings are negative").
- Map `learnMoreLessonId` to the first lesson whose question `source.metrics` includes the key. Otherwise hide the button.
- Add a "Glossary" entry in the Profile tab.
- Acceptance: every metric label on the company, screener and compare screens opens the sheet, and no sheet ever shows NaN.

### #2 Compare 2–4 companies (S)

**Simplified version.**
- A "Versus" screen with 2 to 4 columns of companies and rows of metrics grouped as Valuation, Profitability, Health and Growth.
- For each row, the leader gets a subtle highlight, using direction from `higherIsBetter` and neutral styling when that is `null`.
- A one-line plain-English difference sits under each group, e.g. "COST keeps 3¢ of each sales dollar; MSFT keeps 36¢."
- Next-step chips (the Quickflows pattern): "Chart these over time" (goes to #3), "Quiz me on this comparison" (a generated `compare` question), "Add to scorecard" (goes to #7).

**Plugs in.**
- A "Compare" button on the company page, and multi-select on screener results.
- `compareToPeers` / `sectorMedian` from `@tenbagger/screener` supply the sector-median column.
- The lesson question type `compare` already exists in the contract.

**Data.** SEC ✓.

**Build spec.**
- Add route `mobile/src/app/compare.tsx?tickers=A,B,C`.
- The ticker picker reuses `CompanyRow`.
- Rows come from the `GRID` constant already in `company/[ticker].tsx`. Hoist it to `lib/metricCatalog.ts` so both screens share it.
- An optional fifth column shows the "sector median" (`sectorMedian`) when all companies share a sector.
- Leader logic:
  - Ignore nulls.
  - With ties, highlight none.
  - Never use "better" or "winner" wording. Use "highest" or "lowest".
- The difference sentence comes from a pure `describeGap(key, a, b)` in `lib/`, which handles percent, USD and multiple units via `formatValue`.
- The "Quiz me" chip builds 3 questions client-side, deterministically from the numbers (mirror `lib/practice.ts` `generatedQuestions`). An example prompt: "Which has the higher operating margin?"
- Horizontal scroll on phones: freeze the first column, 16px gutters.
- Add a Disclaimer footer.
- Tests cover: null handling, ties, and the 4-column limit.

### #3 Metric-over-time chart with peer overlay (M)

**Simplified version.**
- One chart, one metric, and up to 3 companies overlaid.
- A toggle switches between **Actual** and **Growth since start (=100)**, which is YCharts' "normalized" idea in beginner words.
- Tapping a year shows the values, plus a one-line "what happened" computed from the data, e.g. "Revenue fell 12% this year".
- No price-based metrics over time. Historical P/E needs historical prices, which are licensed.

**Plugs in.**
- The company page already renders `MiniBarChart` per history series. Add "Compare over time" on each chart card.
- Compare (#2) has a "Chart these" chip.
- Lessons can embed a static version as the question stem: "Which line is Costco?"

**Data.**
- SEC ✓ for the 8 existing `history` series (revenue, net_income, free_cash_flow, eps_diluted, gross_margin, operating_margin, total_debt, cash).
- SEC ✓ + pipeline to add `operating_cash_flow`, `net_margin`, `fcf_margin`, `roic` and `shares_diluted` history. Share count over time teaches buybacks and dilution. This is a CONTRACT change, so flag it to the lead.
- Price ✗ for P/E, P/S, EV/EBITDA and market-cap history. Exclude these until a licensed EOD vendor is signed.

**Build spec.**
- Add `mobile/src/components/LineOverlayChart.tsx`, drawn with `react-native-svg`. It takes `series: {ticker, points: [fy, value|null][]}[]` and `mode: 'actual'|'indexed'`. No chart library is needed for fewer than 4 lines of 10 points.
- Indexed mode: `value / firstNonNull * 100`. If the first value is ≤ 0 (e.g. negative FCF), disable indexed mode for that series and label it "can't index from a loss".
- Align the x-axis on `fy`, and draw gaps for nulls rather than interpolating.
- Use a colour-blind-safe palette of 3 series from theme tokens, with direct labels at line ends instead of a legend.
- Add route `mobile/src/app/chart.tsx?metric=gross_margin&tickers=COST,WMT`.
- A pure helper `yearNote(series, fy)` produces the one-liner. Unit-test it.
- Accessibility: expose a table view toggle so the data can be read without the chart.

### #4 Saved screens with "who's new" alerts (S)

**Simplified version.**
- Users can save a custom screen or a preset with a name and emoji.
- The Screener tab shows "My screens" with a live count.
- When the data file updates, each saved screen shows a **"2 new, 1 dropped"** badge, and tapping it shows `explainMatch` lines for why each company entered or left. This is the teaching payoff.
- Optional weekly digest notification.

**Plugs in.**
- The screener tab already builds `Screen` objects.
- `runScreen`, `explainMatch` and `validateScreen` exist.
- The Screener Quests in PRODUCT_STRATEGY §1.1 #3 can be saved screens with a target.

**Data.** SEC ✓.

**Build spec.**
- Add `mobile/src/lib/savedScreens.ts`:
  - `{ id, name, emoji, screen: Screen, lastRunAt, lastTickers: string[], dataGeneratedAt }` persisted with AsyncStorage, wrapped in try/catch, local-first. Supabase sync comes later in `backend/`.
  - `diffRun(saved, companies): { entered: string[], left: string[] }` compares the current `runScreen` tickers against `lastTickers` whenever `companies.json` `generated_at` differs from `dataGeneratedAt`.
- UI: a "Save" action on custom and preset screens, and a "My screens" section above presets with the badge.
- The diff sheet lists entered and left tickers with `explainMatch(company, screen)`.
- Before saving, validate with `validateScreen` and show the issues.
- Notifications (weekly, opt-in) go through `expo-notifications` local scheduling. Copy must be neutral: "2 companies now match *Cash machines*". Never "opportunity".
- Test `diffRun` on the fixture by mutating one metric.

### #5 Watchlist and filing feed that becomes a drill (M)

**Simplified version.**
- The user stars companies to make "My Stocks". This is the no-brokerage-link option in PRODUCT_STRATEGY.
- Home shows a feed: "NVDA filed its 10-Q on Aug 27". Each item opens a **3-question drill built from the new numbers** ("Did gross margin rise or fall vs. last year?") and then the updated company page.
- No news feed and no price-move alerts (see §3).

**Plugs in.**
- Home tab `(tabs)/index.tsx`.
- `lesson/[id]` and `practice/[ticker]` already run question sets, so reuse `practiceLessonFor`.
- Pairs with the Earnings Season packs in PRODUCT_STRATEGY.

**Data.**
- SEC ✓. EDGAR `submissions/CIK##########.json` lists form type, filing date and accession for 10-K, 10-Q and 8-K. It is free, subject to the fair-access User-Agent rule and ≤10 requests/s (DATA_STRATEGY rule 1).
- The pipeline adds `filings: [{form, filed, period, accession}]` per company, capped at the last 8. This is a CONTRACT change, so flag it.

**Build spec.**
- Pipeline: extend the fetch to read the submissions JSON (fixtures for tests) and emit the `filings` array.
- Mobile:
  - `lib/watchlist.ts` (AsyncStorage set of tickers, try/catch).
  - A star toggle on the company page header.
  - `components/FilingFeed.tsx` on Home, sorted by `filed` desc and limited to watchlist tickers. It shows "No new filings" when there are none. Never invent events.
- Each item links to `practice/[ticker]?since=<fy>`, which prioritises questions whose `source.fy` is the latest year.
- Link out to the filing on sec.gov (`Linking.openURL`) as "Read the original".
- Later, a backend edge function does a daily diff and sends push notifications.

### #6 Two-metric scatter "map" (M)

**Simplified version.**
- Pick two metrics, or a preset pair: "Growth vs. price" (revenue CAGR vs. P/E), "Quality vs. price" (ROIC vs. EV/EBITDA), "Profit vs. debt".
- Dots are the companies in a sector or the current screen results. Tap a dot to see the company.
- Faint median lines split the chart into four quadrants with neutral, descriptive labels ("higher growth, higher P/E").

**Plugs in.**
- The screener results have a "Map these" toggle.
- Lessons can add a question type later: "Which quadrant is AAPL in?"
- `sectorMedian` supplies the quadrant lines.

**Data.** SEC ✓ for point-in-time. The time-animated version needs the history extension from #3 and is skipped for now.

**Build spec.**
- Add `components/ScatterMap.tsx` in `react-native-svg`. It takes `points: {ticker, x, y}[]`, axis `MetricInfo`s, and optional `medianX`/`medianY`.
- Drop nulls, and report "N companies hidden (no data)", reusing `runScreen`'s `missingData` idea.
- Clip outliers at the 5th and 95th percentile, show them as edge arrows, and add a "show all" toggle.
- Hit-testing picks the nearest point within 24px.
- Quadrant labels come from `higherIsBetter` and stay descriptive, never "undervalued".
- Presets live in `lib/scatterPresets.ts`.
- Tests: the pure helpers `toPoints(companies, xKey, yKey)` and `clipBounds(values)`.

### #7 Build-your-own scorecard (M)

**Simplified version.**
- Choose 3–5 metrics and set each one's importance with 1–3 dots.
- Every company in the current list gets a 0–100 **"fit to your scorecard"**, calculated as the weighted average of its percentile ranks. Direction is flipped for lower-is-better metrics.
- Always show the breakdown bars.
- A mandatory framing line: "This scores how well companies fit *your* rules. It isn't a prediction."
- Teaching moment: change a weight and watch the order reshuffle. Criteria are choices.

**Plugs in.**
- Screener (sort by scorecard) and Compare (a scorecard row).
- A lesson unit, "Building a checklist".
- `percentileRank` in `@tenbagger/screener` already computes the core.

**Data.** SEC ✓.

**Build spec.**
- In `packages/screener`, which the screener agent owns, propose `scoreCompanies(companies, {metrics: {key, weight, dir?}[]}): {ticker, score|null, parts: {key, pct|null}[]}[]`.
- Direction defaults to `higherIsBetter`. A metric with `higherIsBetter === null` must have an explicit `dir`, otherwise it is a validation error.
- A company missing more than half the weight gets `null` and is listed as "not enough data". Otherwise, renormalise the weights over the available metrics and flag it.
- Output is deterministic with stable ties. Add banned-phrase tests like the presets have.
- Mobile: `app/scorecard.tsx` with a metric picker (reuse `MetricPicker`), weight dots, and a result list with stacked part bars. Save it like #4.

### #8 Statement explorer (M)

**Simplified version.**
- Three tabs: Income, Balance sheet, Cash flow.
- Each shows up to 5 fiscal years as simple rows, with YoY growth under each value and "% of revenue" (common-size) as a toggle.
- Every row is tappable and opens its dictionary entry (#1).
- Beginner layout: fewer than 12 rows per statement, with ordering that tells a story (Revenue → Gross profit → Operating income → Net income).

**Plugs in.**
- Company page, via a "See the statements" link.
- Lessons can highlight a row ("Find the line that tells you…").

**Data.**
- SEC ✓ + pipeline. Today `fundamentals` holds the latest year only, and `history` holds 8 series.
- Add `history` arrays for the remaining `fundamentals` keys, or a `statements` block keyed by fy. This is a CONTRACT change. All of it is in companyfacts XBRL.

**Build spec.**
- After the pipeline change, add `app/company/[ticker]/statements.tsx` with a segmented control.
- Row config lives in `lib/statementLayout.ts`: an ordered `{key, label, indent, kind:'subtotal'|'line'}`.
- A pure `commonSize(row, revenue)` and a growth helper that reuses the contract formula `this/prior − 1`, returning null when the prior value is ≤ 0.
- Freeze the first column and scroll the years horizontally.
- "As reported in 10-K for FY2025" with a link to the filing (#5 data).

### #9 Portfolio look-through in the Money hub (M)

**Simplified version.**
- "Your stocks as one company": combine the user's holdings (manual entry or later linked) into one blended profile, e.g. "Your portfolio's companies have a combined net margin of 18%, a blended P/E of 24, and 60% are in Technology".
- Show concentration: top holding share, and sector split by our SIC-based sectors.
- No performance, returns or risk scores (see §3).

**Plugs in.**
- The Money tab (`src/money/`, engine `packages/money`).
- Holdings shape from CONTRACT with `source: 'manual'`.
- Links to each company page and to the lessons on diversification.

**Data.**
- SEC ✓ for fundamentals.
- Weights: use the user's own `market_value`, or `cost_basis` as a labelled fallback. We never compute weights from prices we display, so there is no price licence issue.
- Aggregate on a "sum of parts" basis (sum of net income ÷ sum of revenue, weighted by ownership share = quantity ÷ shares_diluted). This is methodologically more honest than averaging ratios. Explain it in the UI.

**Build spec.**
- In `packages/money` (coordinate with its owner), add `lookThrough(holdings, companies)`.
  - It returns `{ownedRevenue, ownedNetIncome, ownedFcf, blendedNetMargin, earningsYield, sectorWeights, topHoldingPct, unmatched: string[]}`.
  - Ownership fraction = quantity / shares_diluted.
  - Owned X = fraction × X.
  - Blended margin = Σ owned net income / Σ owned revenue.
  - Earnings yield = Σ owned net income / Σ market_value.
- Unmatched tickers (ETFs, non-SEC filers) are listed, not guessed.
- UI: one card in MoneyScreen, "What you own, as one business", with a "how we calculated this" sheet.
- Tests: a two-holding fixture, zero-share and missing-company cases.

### #10 Shareable company one-pager (S)

**Simplified version.**
- One tap on a company page renders a clean card image: the company name, 4 chosen stats with plain-English labels, one mini chart, the "Learned on <app>" wordmark, and the data source line "SEC filings, FY2025".
- It is the consumer version of a branded tearsheet, used for distribution rather than advisor sales.

**Plugs in.**
- Company page share button.
- Shares the rendering path with the share cards in PRODUCT_STRATEGY §1.1 #2.

**Data.** SEC ✓.

**Build spec.**
- Add `components/ShareCard.tsx`, rendered offscreen and captured with `react-native-view-shot`, then shared via `expo-sharing`.
- Stats default to the 4 the user last opened explainers for, with an editable picker.
- Hard rules:
  - no price target, no rating, no "buy", no returns or P&L;
  - show `price_is_sample` as "sample price" if any price-derived metric is included, or better, default to non-price metrics;
  - include the disclaimer footer text in the image.
- Snapshot-test the layout at 1080×1350.

---

## 3. What NOT to copy, and why

| YCharts feature | Why not | Our alternative |
|---|---|---|
| **Real-time or intraday quotes, price alerts, big-move alerts** | Display rights for quotes are licensed per user and expensive. DATA_STRATEGY §1 rule 2 bans showing any price without a redistribution licence. Price alerts also drive trading behaviour, which works against an education positioning. | Filing and data-update alerts (#4, #5). Prices stay sample-flagged until a licensed EOD vendor is signed. |
| **Price-derived history (P/E over time, total return, growth of $10k, drawdown)** | Needs licensed historical prices. | Fundamentals-only charts (#3). Revisit after the EOD licence. |
| **500k economic indicators** | Many aggregated series carry third-party copyright and redistribution limits (e.g. FRED marks some series as copyrighted by their source: U, check the FRED terms). It is also scope creep for a company-numbers app. | Later, a handful of public-domain BLS and BEA series (CPI, unemployment) inside lessons only, sourced directly from the agency. |
| **Morningstar, S&P, eVestment and MSCI data: style boxes, fund ratings, ESG scores, analyst consensus** | Licensed ([Data page, P](https://get.ycharts.com/platform/data/)). GICS sectors and the "S&P 500" name need licences too (DATA_STRATEGY rule 4). Analyst ratings also read as recommendations. | Our own SIC-based sectors. ETF look-through from SEC N-PORT (v2). No ratings. |
| **Proposals, Risk Profiles, Householding, FINRA-reviewed reports** | Advisor revenue tools. Mapping a consumer to a "risk profile" plus portfolios is suitability territory, which is regulated advice. | None. Education only. |
| **Model Portfolios, backtests, stress-test Scenarios** | Hypothetical-performance presentation is heavily regulated for advisors, needs price history, and pushes users toward "which portfolio should I buy". | Look-through of the user's *own* holdings (#9), described, never scored for risk. |
| **Report Builder, branded PDFs, compliance locks** | B2B feature with no consumer job. | One-pager share card (#10). |
| **Excel add-in and formula language** | Our users don't live in Excel. A formula API also invites bulk data extraction. | `parseQuery` natural-language screens. CSV export can come later, if ever. |
| **News feed aggregation** | News licensing costs money, and headline-driven feeds encourage trading on noise. | SEC filings feed (#5) that links to primary documents. |
| **AI agent that writes screens and commentary freely** | Risk of hallucinated numbers, and it breaks the CONTRACT rule that no number is LLM-invented. | If we add AI later, limit it to "explain my mistake", citing deterministic numbers (PRODUCT_STRATEGY). |
| **4,000+ metric catalog** | Choice overload is the opposite of what a beginner needs. | 44 well-explained fields. Add a metric only when a lesson teaches it. |

---

## 4. UX lessons from public reviews

All review evidence is [U] (aggregator snippets of G2, Capterra and review blogs, accessed 2026-09-25). G2 shows 4.7★ from 129 reviews ([G2, U](https://www.g2.com/products/ycharts/reviews)).

**What users praise, and what we should do because of it:**

1. **Intuitive, clean interface, and reports without code** ([G2 pros/cons summary, U](https://www.g2.com/products/ycharts/reviews?qs=pros-and-cons)). *Design rule:* every tool is usable with zero typing. Presets first, custom second. `parseQuery` is an accelerator, not the entry point.
2. **Fundamental charts that compare peers over time** ([TopTradeReviews, U](https://toptradereviews.com/ycharts-review/); [DayTradeReview, U](https://daytradereview.com/ycharts-review/)). *Design rule:* a "compare over time" action should be one tap from any number.
3. **Export and share anything** ([SaaSworthy/GetApp summaries, U](https://www.saasworthy.com/product/ycharts)). *Design rule:* every result screen (a comparison, a screen diff, a scorecard, a statement) has a share affordance that produces a card, not a spreadsheet.
4. **Training and support: scheduled tutorial classes** ([G2 summary, U](https://www.g2.com/products/ycharts/reviews?qs=pros-and-cons)). *Design rule:* our lessons *are* the onboarding. Each tool gets a 60-second "try it" quest the first time it is opened.
5. **One-click follow-ups (Quickflows)** ([Quickflows blog, P](https://get.ycharts.com/resources/blog/quickflows-stock-etf-mutual-fund-comparison-tool/)). *Design rule:* every result screen ends in 2–3 next-step chips. Never a dead end.

**What users complain about, and how we design around it:**

1. **Steep learning curve that feels overwhelming** ([Capterra/G2 summary via search, U](https://www.capterra.com/p/210403/YCharts)). *Response:* progressive disclosure, with at most 6 metrics per card, advanced filters behind "More", and metric names always paired with plain-English labels.
2. **Limited layout customisation, and saved searches or layouts are hard** ([G2 pros/cons, U](https://www.g2.com/products/ycharts/reviews?qs=pros-and-cons); [SaaSworthy, U](https://www.saasworthy.com/product/ycharts)). *Response:* saving is a first-class, one-tap action (#4), and state like the last tab and last metric is remembered locally.
3. **Price: $3.6k–$6k a year, "overkill" for individuals** ([WallStreetZen, U](https://www.wallstreetzen.com/blog/ycharts-review/); [TraderHQ, U](https://traderhq.com/ycharts-review-financial-analysis-tool-features-pricing-alternatives/)). *Response:* this is our opening. The Pro tier at $79.99/yr (PRODUCT_STRATEGY) is about 2% of YCharts Standard. Keep the core tools (compare, chart, dictionary) free, and gate depth (scorecards, saved-screen alerts, statement history).
4. **Data gaps, sync problems and missing history for some holdings** (e.g. UITs, custodian sync) ([G2 pros/cons, U](https://www.g2.com/products/ycharts/reviews?qs=pros-and-cons)). *Response:* be loud about missing data. Show "N hidden, no data" counts (already in `runScreen`), list unmatched holdings, and never silently drop rows.
5. **Occasional glitches and support responsiveness** ([SaaSworthy, U](https://www.saasworthy.com/product/ycharts)). *Response:* the app works offline on bundled `companies.json`, and every data screen shows "Data as of <generated_at>, from SEC filings".
6. **Data freshness varies: S&P 500 next day, small caps up to 10 days** ([KB Equity Data, P](https://go.ycharts.com/knowledge-base/equity-data)). *Response:* show the filing date per company, and let the filing feed (#5) make freshness visible instead of hiding it.

---

## 5. Recommendation: build these three next

1. **#2 Compare (S).**
   - Highest teaching value per hour.
   - Reuses `GRID`, `compareToPeers`, `sectorMedian` and the `compare` question type.
   - Creates the hub that #3 and #7 attach to.
2. **#1 Metric dictionary everywhere (S).**
   - Makes every existing screen a lesson entry point, and its worked-example row is the core "real numbers" differentiator.
   - Mostly wiring `METRIC_CATALOG` and `MetricExplainer`.
3. **#3 Metric-over-time overlay chart (M).**
   - The single feature reviewers single out.
   - Ship it first on the 8 existing `history` series with no contract change. Then request the history extension (shares, ROIC, FCF margin) from the pipeline owner.

**Contract changes these imply** (for the lead; not made here):
- Optional extra `history` series (#3, #8).
- A `filings` array per company (#5).
- `scoreCompanies` in `packages/screener` (#7).
- `lookThrough` in `packages/money` (#9).

## Sources

Every source below was accessed on 2026-09-25 via search-engine snippets. None were fetched directly.

**YCharts product pages** ([P])
- https://get.ycharts.com/platform/tools/fundamental-charts/
- https://get.ycharts.com/platform/tools/stock-screener/
- https://get.ycharts.com/platform/tools/fund-screener/
- https://get.ycharts.com/platform/tools/model-portfolios/
- https://get.ycharts.com/platform/tools/quickflows/
- https://get.ycharts.com/platform/tools/excel-add-in/
- https://get.ycharts.com/platform/tools/report-builder/
- https://get.ycharts.com/platform/tools/dashboard/
- https://get.ycharts.com/platform/tools/ai-chat/
- https://get.ycharts.com/platform/data/

**YCharts knowledge base** ([P])
- https://go.ycharts.com/knowledge-base/fundamental-charts-overview
- https://go.ycharts.com/knowledge-base/fundamental-charts-annotations
- https://go.ycharts.com/knowledge-base/stock-screener-overview
- https://go.ycharts.com/knowledge-base/comp-table-overview
- https://go.ycharts.com/knowledge-base/scoring-models-overview
- https://go.ycharts.com/knowledge-base/alerts-manager-overview
- https://go.ycharts.com/knowledge-base/what-are-risk-profiles
- https://go.ycharts.com/knowledge-base/economic-indicator-data
- https://go.ycharts.com/knowledge-base/equity-data
- https://go.ycharts.com/knowledge-base/excel-ycs-function

**YCharts blog** ([P])
- https://get.ycharts.com/resources/blog/new-comp-tables-pdf/
- https://get.ycharts.com/resources/blog/quickflows-stock-etf-mutual-fund-comparison-tool/
- https://get.ycharts.com/resources/blog/new-on-ycharts-report-builder/
- https://get.ycharts.com/resources/blog/ycharts-monthly-product-update/
- https://get.ycharts.com/resources/blog/breaking-open-the-black-box-introducing-transparent-customizable-risk-profiles/
- https://get.ycharts.com/resources/blog/how-financial-advisors-use-ycharts-to-optimize-investment-strategies/
- https://get.ycharts.com/resources/blog/understanding-economic-indicators-with-ycharts-a-beginners-guide/

**YCharts press releases, via BusinessWire** ([S])
- https://www.businesswire.com/news/home/20250609721891/en/More-Than-Research-YCharts-Powers-Personalized-Proposals-at-Scale
- https://www.businesswire.com/news/home/20260616232584/en/YCharts-Unveils-Specialized-AI-Agent-for-Financial-Advisors-and-Asset-Managers

**ycharts.com app pages and support** ([U], search snippets only)
- https://ycharts.com/charts/scatter_plot/
- https://ycharts.com/tables/timeseries/
- https://ycharts.com/glossary
- https://ycharts.com/watchlists/list/
- https://ycharts.com/events/calendar/
- https://ychartsinc.zendesk.com/hc/en-us/articles/115004439263-Example-Alerts

**Reviews and pricing** ([U])
- https://www.g2.com/products/ycharts/reviews
- https://www.g2.com/products/ycharts/reviews?qs=pros-and-cons
- https://www.capterra.com/p/210403/YCharts
- https://www.wallstreetzen.com/blog/ycharts-review/
- https://traderhq.com/ycharts-review-financial-analysis-tool-features-pricing-alternatives/
- https://toptradereviews.com/ycharts-review/
- https://daytradereview.com/ycharts-review/
- https://www.saasworthy.com/product/ycharts
- https://www.softwaresuggest.com/ycharts/pricing
- https://t3technologyhub.com/ycharts-launches-ai-chat-to-accelerate-investment-research-enhance-client-engagement/

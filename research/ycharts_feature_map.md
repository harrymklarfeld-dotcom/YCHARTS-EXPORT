# YCharts feature map & parity backlog

A living checklist of everything YCharts offers, and where our free/local platform stands on each.
We fill this in together: I seed it from YCharts' **public** docs; you fill the gaps I can't see
(the authenticated Tools/Data menus) by screenshotting each menu. Nothing here involves scraping
your paid account or its code — public docs + your own screenshots only.

Status key: ✅ built · 🟡 partial · ❌ not yet · 💲 needs paid data we don't have free

---

## Top bar — TOOLS menu

| Feature | What it does | Status | Our equivalent / plan |
|---|---|---|---|
| Stock Screener | Filter 28,000+ equities on 4,500+ metrics (price, P/E, mktcap, EPS growth…) | ❌ | Build `screener.py` over a yfinance/EDGAR universe; start with S&P 1500 + your watchlists |
| Fund / ETF Screener | Filter funds on 50+ risk calcs, fund flows, manager tenure, exposure limits | 🟡 | `riskstats` already computes the risk calcs per fund; add a filter/sort UI over the fund set |
| Comp Tables | Side-by-side data tables across securities/portfolios | ❌ | Generalize the ETF "performance vs" table into an arbitrary comp table |
| Scoring Models | Weight chosen metrics → a composite score → PDF | ❌ | Ties into your model-portfolio work; add weighted scoring on top of comp tables |
| Timeseries Analysis | Plot fundamentals over time; align unlike frequencies; export | 🟡 | Research tab charts one metric; add multi-metric + frequency alignment |
| Comparison / overlay charts | Overlay many securities rebased | ✅ | Compare tab (normalize / indexed / growth-of-$10k) |
| Economic scenario / impact | Model a macro shock across holdings | ❌ | Extend Macro tab (regime) into a scenario tool |
| Event alerts | Alerts for earnings, dividends, splits, spinoffs | ❌ | `events.py` already has the timeline; add a watch/alert layer |
| Reports (PDF, FINRA-reviewed) | Formatted, compliant client reports | 🟡 | We emit markdown/HTML reports; PDF export is addable |
| Watchlists | Named security lists that feed every tool | ✅ | `watchlists.py` + `config/watchlists.json` |
| Dashboards / Model Portfolios | Track a constructed portfolio's stats | 🟡 | Model portfolios + hedge-strategy diagnostics built |

## Top bar — DATA menu

| Feature | What it does | Status | Our equivalent / plan |
|---|---|---|---|
| Fundamental metrics (4,000+) | EPS, P/E, P/S, P/FCF, margins, sector/industry averages | 🟡 | EDGAR fundamentals + valuation gauge; expand metric coverage |
| Economic indicators (500,000+) | Fed/BLS/BEA series: GDP, unemployment, inflation… | 🟡 | Macro tab pulls FRED (keyless); can add any FRED series trivially |
| Dividend data | Ex/declaration/record/payable dates, dividend type | 🟡 | ETF TTM distributions; add the full date set from yfinance |
| Risk & performance metrics | Alpha, beta, Sharpe, Sortino, std dev, VaR, max DD, capture | ✅ | `riskstats.py` (unit-tested) |
| Custom calculations | User-defined formulas across metrics/series | ❌ | Add a small formula layer over cached series |
| Export: CSV / XLSX / Excel Add-in | Get any series out | 🟡 | Excel bridge + CSV caches exist |

## Beyond YCharts — things WE have that Robinhood/YCharts don't surface the same way

| Feature | Status |
|---|---|
| "Why it moved" — click any day → market/sector/earnings/sentiment decomposition (EMH vs sentiment) | ✅ |
| Finance-lexicon news sentiment scoring | ✅ |
| Holdings-overlap between any two funds (hedge-quality check) | ✅ |
| Accumulation & swing backtests (DCA, value-averaging, EMA/RSI/MACD…) | ✅ |
| Live 24/7 crypto (Hyperliquid) | ✅ |
| Your real Robinhood ledger: avg-cost + FIFO, realized/unrealized, XIRR | ✅ |

---

## Walkthrough log (you drive, I fill this in)

For each item in the top-bar **Tools** and **Data** menus, screenshot it and send it here.
I'll append: what it does, whether we can build it on free data, and the effort. Newest first.

- _(pending your screenshots of the Tools menu)_
- _(pending your screenshots of the Data menu)_

## Sources (public YCharts docs)
- Tools: https://get.ycharts.com/platform/tools/
- Data: https://get.ycharts.com/platform/data/
- Knowledge base: https://go.ycharts.com/knowledge-base
- Stock screener: https://ycharts.com/screener/stock/
- Fund/ETF screener: https://ycharts.com/screener/mutual_fund_and_etf/

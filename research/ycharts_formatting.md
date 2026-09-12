# How YCharts presents data, and how this project mirrors it

*Research notes, Sep 2026. Sources at the bottom. The goal is to reproduce the parts of the YCharts experience that make its data legible, without its subscription or API.*

## What YCharts actually is

YCharts is a professional research terminal: **4,000+ metrics and line items** across **~100,000 securities** and **500,000+ economic indicators**, with time series reaching back roughly three decades. Its value is not any single number; it is that every number is (a) charted, (b) comparable across securities, and (c) available as a raw or normalized series you can export.

## The pieces of a YCharts company page

A company page (e.g. `ycharts.com/companies/MU`) is a set of tabs:

| Tab | What it shows | This project's equivalent |
|---|---|---|
| **Key Stats** | current valuation, profitability, price stats in a grid | the holding drawer's stat grid (P/E, P/B, market cap, 52-week range, yield, sector) |
| **Financials** | income statement, balance sheet, cash flow, quarterly back decades | `ycharts_export/load_xlsx.py` parses the YCharts statement exports into the fundamentals JSON |
| **Fundamental Chart** | pick any metric, plot its history, overlay multiple securities | the **Compare** tab (normalized) + the per-holding price chart |
| **Multichart** | a grid of many metrics for one company at once | the holding drawer (price + average cost + trades) |
| **Valuation / Y-Rating** | model-driven fair value | `ycharts_export/valuation.py` (the MU intrinsic-value model) |

## The signature YCharts chart behaviours (the ones worth copying)

1. **Normalized comparison.** YCharts' Fundamental Chart offers four data formats; the one everyone uses is **Normalized: each series shown as percent change from the first period on the chart**. This lets you compare a $1,000 stock and a $50 stock on the same axis, because you are comparing *performance*, not price. Growth-of-a-custom-dollar-amount and percent-off-high are variants. **Implemented** in the Compare tab: `% change`, `Indexed to 100`, and `Growth of $10k`, each rebased to the range's start with a zero baseline.
2. **A metric selector, not a fixed dashboard.** You type a metric name and it is added. This project can't reach YChartss 4,000 metrics without a subscription, but the public company pages expose a slice (price, P/E, market cap, margins, 52-week range) that `ycharts_export/scrape.py` reads, and the dashboard's `/api/ycharts` endpoint pulls a metric's history on demand.
3. **Range selectors.** 1M / 3M / 6M / YTD / 1Y / 3Y / All, applied to whatever is on screen. **Implemented** on Compare (and the equity curve).
4. **Sparklines and clean line styling.** Thin 1.5-2px lines, a light grid, a faint area fill under the line, the current value called out. **Implemented**: every holding row has a 90-day sparkline (green up / red down, area fill); charts use the same treatment.
5. **Comparison against a benchmark.** VOO is added to the Compare universe by default so every position is measured against the S&P 500, the way YCharts lets you drop `^SPX` onto any chart.

## What we can and cannot get without paying

| Data | YCharts (paid) | This project (free) |
|---|---|---|
| Daily price history | 30+ years, adjusted | yfinance (adjusted, ~decades), or a YCharts CSV export you drop in `data/prices/` |
| Valuation ratios (P/E, P/B, P/S) current | yes, plus sector/industry averages | Robinhood key stats (current) + `scrape.py` from public pages |
| Ratio *history* (e.g. 10y P/E) | yes | partial: public YCharts pages show a short history; a YCharts Timeseries export gives the full series |
| Fundamentals (revenue, margins, cash flow) quarterly | 30 years | from YCharts statement exports (`load_xlsx.py`); Micron is loaded back to 1983 |
| Economic indicators | 500k series | not attempted |
| Screening across 100k securities | yes | no |

The honest gap is **metric history at scale**. YCharts' edge is that every one of 4,000 metrics has a clean multi-decade series behind it. Free sources give deep *price* history everywhere and deep *fundamental* history only where you export it. The workflow that closes the gap: in YCharts, use Timeseries Analysis to export the exact metric and window you want to `data/prices/<SYM>.csv` or a fundamentals sheet, and this project charts it with the same styling.

## How to feed YCharts data in

1. **Prices / any timeseries:** YCharts → Timeseries Analysis → Export CSV/XLSX → save as `data/prices/<SYM>.csv` (a date column + a value column is all the loader needs). Total-return price, P/E history, anything.
2. **Financial statements:** YCharts → Financials → Export → drop the xlsx in `data/ycharts/`, then `python -m ycharts_export.load_xlsx`.
3. **Public pages (no login):** `python -m ycharts_export.scrape <TICKER>` reads what YCharts shows without a subscription.

## Sources

* Fundamental Charts overview and the four data formats incl. Normalized percent-change (https://get.ycharts.com/platform/tools/fundamental-charts/, https://go.ycharts.com/knowledge-base/fundamental-charts).
* Metric library scale, ~4,000 metrics / 100k securities / 500k economic indicators, ~30 years of history (https://get.ycharts.com/platform/data/).
* Company-page tabs (Key Stats, Financials, Fundamental Chart, Multichart, Valuation) (https://ycharts.com/companies/KEY/multichart, https://get.ycharts.com/platform/tools/).
* Chart types incl. line, area, OHLC/candlestick (https://get.ycharts.com/resources/blog/new-on-ycharts-technical-charts/).

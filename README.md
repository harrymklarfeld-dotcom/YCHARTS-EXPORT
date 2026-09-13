# ycharts-export → portfolio desk

Personal investing toolkit. Three pieces:

1. **Live portfolio dashboard** fed by your Robinhood account (`dashboard/`, `portfolio/robinhood_sync.py`).
2. **Backtester for average-cost / accumulation strategies** and a replay of your own trades (`portfolio/backtest.py`).
3. **YCharts-flavoured fundamentals + intrinsic-value model** (the original `ycharts_export/` work on Micron).

```
portfolio/robinhood_sync.py   log in to Robinhood (robin_stocks), pull positions/quotes/orders/dividends/equity history -> data/portfolio/snapshot.json
portfolio/csv_import.py       same snapshot from Robinhood's activity-report CSV (fallback when the private API breaks)
portfolio/ledger.py           trades -> average cost, FIFO lots, realized/unrealized P&L, XIRR (pure python, unit-tested)
portfolio/backtest.py         lump sum / DCA / value averaging / buy-the-dip / below-avg-only / avg-cost bands / 200d MA filter
portfolio/prices.py           daily prices with a CSV cache: yfinance -> Robinhood -> ycharts.com page -> YCharts exports you drop in
portfolio/demo_data.py        synthetic snapshot + price series so everything runs offline
dashboard/serve.py            local stdlib web server + JSON API (127.0.0.1 only)
dashboard/index.html          the dashboard (no build step, no CDN, light/dark)
research/                     backtesting_and_average_cost.md, robinhood_access.md
ycharts_export/               scrape.py (public YCharts pages), load_xlsx.py (YCharts statement exports), valuation.py
tests/                        python3 tests/test_ledger.py && python3 tests/test_backtest.py
```

## Quick start

```bash
pip install -r requirements.txt

# 1. see it working with fake data
python -m dashboard.serve --demo            # open http://127.0.0.1:8765

# 2. your real account
python -m portfolio.robinhood_sync          # prompts for login; approve the device push in the Robinhood app
python -m dashboard.serve --refresh 300     # re-syncs every 5 min during market hours; "Refresh" button any time

# 3. backtests
python -m portfolio.backtest MU VOO --start 2016-01-01 --amount 500 --freq M -o reports/backtest.md
python -m portfolio.backtest --replay data/portfolio/snapshot.json -o reports/replay.md   # your trades vs DCA of the same dollars
```

Credentials come from the prompt or `RH_USERNAME` / `RH_PASSWORD` / `RH_TOTP_SECRET` (authenticator-app seed, optional).
The session token is cached in `~/.tokens/`; `data/portfolio/` and `data/prices/` are git-ignored. Nothing about your
account is ever committed. Read `research/robinhood_access.md` first: robin_stocks uses Robinhood's private API, which is
against their terms of service and breaks from time to time; the CSV importer is the sanctioned fallback.

## What the dashboard shows

* **Hero tiles**: total equity, day change, unrealized P&L, total return (unrealized + realized + dividends), cash.
* **Holdings**: YCharts-style sortable table (shares, average cost, price, day %, market value, weight, unrealized, P/E, dividend yield, position in 52-week range). Click a row for the price chart with your running average cost and every buy/sell marked, FIFO lots with holding period, and recent fills.
* **Average cost**: price vs. your average per holding, allocation, and what adding $1,000 does to each average.
* **Performance**: Robinhood's equity curve vs. net contributions, plus the daily snapshot history the sync builds up.
* **Trades & income**: every fill and dividend.
* **Backtest**: run the seven strategies on any ticker from the browser.

## YCharts data

The Micron work still runs as before:

```bash
python -m ycharts_export.load_xlsx data/ycharts MU --merge data/mu_fundamentals.json
python -m ycharts_export.scrape MU -o data/mu_ycharts.json       # public ycharts.com pages, needs network
python -m ycharts_export.valuation --ticker MU --out reports/MU_intrinsic_value.md
```

For price history the backtester will also read any YCharts Timeseries export saved as `data/prices/<SYM>.csv` or `.xlsx`
(date column + price/close column), which is the way to get total-return or very long histories in.

## Swing-trading signals

Test technical setups (EMA crossover, RSI pullback, MACD, Bollinger reversion, Donchian breakout)
with an ATR stop, long-only, and see the honest scoreboard vs. buy-and-hold:

```bash
python -m portfolio.signals MU NVDA VOO --all --start 2018-01-01 -o reports/signals.md
```

Win rate, profit factor, expectancy per trade, max drawdown, time in market, and whether it beat
holding. Most setups lose to buy-and-hold on trending names — which is exactly what backtesting is
for. Indicators are close-based; ATR is a close-to-close proxy, VWAP needs volume (from YCharts).

## YCharts research engine

With a YCharts API key (Account -> "Excel Add-in Access Key"), pull deep data for any ticker
into a local cache and browse it in the dashboard's **Research** tab (a YCharts-style company
page: key stats + metric charts).

```bash
export YCHARTS_API_KEY=your_key            # on your machine only; never commit it
python -m ycharts_export.api --watchlist sl_model --portfolio   # 10 S&L ETFs + your holdings
python -m dashboard.serve --open           # Research tab reads data/ycharts_cache/
```

Or just double-click **Pull YCharts (Mac).command**. Watchlists and the three model portfolios
(de-risk / barbell / growth) live in `portfolio/watchlists.py`; `config/watchlists.json` is editable.

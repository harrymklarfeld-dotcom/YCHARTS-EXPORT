# Data check: Robinhood snapshot vs Yahoo Finance vs YCharts

*Snapshot 2026-09-11T20:00:00+00:00 (DEMO synthetic data (portfolio.demo_data)). Checked Sep 12, 2026.*

## 1. Average cost: ledger vs Robinhood

| Symbol | Shares (ledger) | Shares (Robinhood) | Avg cost (ledger) | Avg cost (Robinhood) | Diff |
|---|---:|---:|---:|---:|---:|
| VOO | 116.200000 | 116.200000 | $325.53 | $325.53 | +0.00% |

Ledger and Robinhood agree on every average cost.

## 2. Market data: Robinhood vs Yahoo vs YCharts

### VOO — Vanguard S&P 500 ETF

| Field | Robinhood | Yahoo | YCharts | RH vs Yahoo | RH vs YCharts |
|---|---:|---:|---:|---:|---:|
| Price | $311.55 | -- | -- | -- | -- |
| Prev close | $311.06 | -- | -- | -- | -- |
| P/E (TTM) | 24.0 | -- | -- | -- | -- |
| Dividend yield | 1.20% | -- | -- | -- | -- |
| 52w high | $600.00 | -- | -- | -- | -- |
| 52w low | $450.00 | -- | -- | -- | -- |
| Market cap | -- | -- | -- | -- | -- |

## Notes

* VOO YCharts: price: URLError: <urlopen error Tunnel connection failed: 403 Forbidden>; pe_ratio: URLError: <urlopen error Tunnel connection failed: 403 Forbidden>; dividend_
* VOO YCharts: page fetched but no values parsed (layout changed?). Send the file in .cache/ that contains 'VOO_price' to Claude.

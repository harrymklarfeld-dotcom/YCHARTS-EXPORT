# ycharts-export

Fundamental-analysis toolkit built around YCharts' public company pages (no API key)
plus a cycle-aware intrinsic-value model. First target: **Micron (MU)**.

```
data/mu_fundamentals.json          # every input, with sources
ycharts_export/scrape.py           # scrape ycharts.com/companies/<T>/<metric> pages
ycharts_export/valuation.py        # multiples + earnings power + scenario DCF + asset floor + MoS
ycharts_export/export_csv.py       # flatten fundamentals JSON to CSV
reports/MU_intrinsic_value_2026-09-09.md
```

## Run

```bash
python -m ycharts_export.scrape MU -o data/mu_ycharts.json   # needs network access to ycharts.com
python -m ycharts_export.valuation --ticker MU --out reports/MU_intrinsic_value.md
python -m ycharts_export.valuation --price 650 --discount 0.11  # what-if
python -m ycharts_export.export_csv data/mu_fundamentals.json data/mu_fundamentals.csv
```

No third-party dependencies (Python 3.9+, stdlib only).

## Method

A single DCF on a memory company near a cycle peak is meaningless, so the model
values the business four ways and reports margin of safety against each:

1. **Multiples** — trailing, forward, EV-based, and price/book.
2. **Through-cycle earnings power** — normalized mid-cycle net income × a
   through-cycle multiple, plus net cash (Graham).
3. **Scenario DCF** — bear / base / bull FCF paths through FY31 with an explicit
   down-cycle; terminal value is struck on *mid-cycle* FCF, then probability-weighted.
4. **Asset floor** — book value and net cash per share, projected forward, because
   memory drawdowns historically bottom near 1–1.5× book.

Scenario assumptions live at the top of `ycharts_export/valuation.py`; edit and re-run.

## Caveat

The analysis session that produced the first report could not reach ycharts.com
(blocked by the network egress policy), so `data/mu_fundamentals.json` was assembled
from Micron's SEC-filed press releases / 10-Qs, TrendForce, and sell-side notes.
The scraper is provided so the same fields can be refreshed from YCharts on an
unrestricted network.

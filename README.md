# ycharts-export

Fundamental-analysis toolkit built around YCharts' public company pages (no API key)
plus a cycle-aware intrinsic-value model. First target: **Micron (MU)**.

```
data/mu_fundamentals.json          # every input, with sources (includes parsed YCharts statements)
data/ycharts/*.xlsx                # YCharts Financial Statement exports (income, balance sheet, cash flow)
ycharts_export/load_xlsx.py        # parse YCharts statement exports -> fundamentals JSON (quarters + fiscal years)
ycharts_export/scrape.py           # scrape ycharts.com/companies/<T>/<metric> pages
ycharts_export/valuation.py        # multiples + earnings power + scenario DCF + asset floor + MoS
ycharts_export/export_csv.py       # flatten fundamentals JSON to CSV
reports/MU_intrinsic_value_2026-09-09.md
```

## Run

```bash
pip install openpyxl                                         # only needed for the xlsx loader
python -m ycharts_export.load_xlsx data/ycharts MU --merge data/mu_fundamentals.json
python -m ycharts_export.scrape MU -o data/mu_ycharts.json   # needs network access to ycharts.com
python -m ycharts_export.valuation --ticker MU --out reports/MU_intrinsic_value.md
python -m ycharts_export.valuation --price 650 --discount 0.11  # what-if
python -m ycharts_export.export_csv data/mu_fundamentals.json data/mu_fundamentals.csv
```

Valuation and scraper are stdlib-only (Python 3.9+); the xlsx loader needs openpyxl.

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
5. **Earnings-quality diagnostics** from the YCharts statements (inventory days, DSO,
   working-capital drag, capex vs. D&A, net debt) and a **pre-earnings section** with
   event math for the next print when `pre_earnings` is present in the JSON.

Scenario assumptions live at the top of `ycharts_export/valuation.py`; edit and re-run.

## Data provenance

Financial statements come from the YCharts exports in `data/ycharts/` (quarterly back
to 1983). Guidance, consensus, industry pricing and pre-earnings context were gathered
from Micron press releases, TrendForce and sell-side coverage because ycharts.com itself
was not reachable from the analysis environment; `scrape.py` is provided to refresh
those fields from YCharts on an unrestricted network.

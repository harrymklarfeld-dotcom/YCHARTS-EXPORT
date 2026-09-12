#!/usr/bin/env python3
"""
Check the dashboard's numbers against outside sources.

    python -m portfolio.verify                     # uses data/portfolio/snapshot.json
    python -m portfolio.verify --no-ycharts        # Yahoo only

Three comparisons per holding:
  1. Average cost: what the ledger rebuilt from your orders vs. what Robinhood reports.
     These should match to the cent; a gap means a split/DRIP/transfer the order feed missed.
  2. Price, previous close, P/E, dividend yield, 52-week high/low, market cap:
     Robinhood vs. Yahoo Finance (yfinance).
  3. The same fields vs. ycharts.com public company pages (ycharts_export.scrape).
     Robinhood's key stats are computed by Robinhood's data vendor and can differ from
     YCharts by a few percent (different TTM windows, diluted vs basic EPS); prices should agree
     to the cent except after hours.

Writes reports/data_check_<date>.md and prints the table.
"""
from __future__ import annotations

import argparse
import json
import os
import sys
from datetime import date

from .backtest import fmt_money, fmt_pct

FIELDS = [("price", "Price", "$"), ("prev_close", "Prev close", "$"), ("pe_ratio", "P/E (TTM)", "x"),
          ("dividend_yield", "Dividend yield", "%"), ("high_52_weeks", "52w high", "$"),
          ("low_52_weeks", "52w low", "$"), ("market_cap", "Market cap", "$")]
YC_METRICS = {"price": ("Price", "$"), "pe_ratio": ("PE Ratio", "x"), "dividend_yield": ("Dividend Yield", "%"),
              "52_week_high": ("52-Week High", "$"), "52_week_low": ("52-Week Low", "$"),
              "market_cap": ("Market Cap", "$")}
YC_MAP = {"price": "price", "pe_ratio": "pe_ratio", "dividend_yield": "dividend_yield",
          "high_52_weeks": "52_week_high", "low_52_weeks": "52_week_low", "market_cap": "market_cap"}


def yahoo(sym: str) -> dict:
    out = {}
    try:
        import logging
        logging.getLogger("yfinance").setLevel(logging.CRITICAL)
        import yfinance as yf
        t = yf.Ticker(sym)
        fi = t.fast_info
        out.update({"price": _g(fi, "last_price"), "prev_close": _g(fi, "previous_close"),
                    "high_52_weeks": _g(fi, "year_high"), "low_52_weeks": _g(fi, "year_low"),
                    "market_cap": _g(fi, "market_cap")})
        try:
            info = t.get_info()
            out["pe_ratio"] = info.get("trailingPE")
            dy = info.get("dividendYield")
            if dy is not None:
                out["dividend_yield"] = dy * 100 if dy < 1 else dy   # yfinance changed units across versions
        except Exception:  # noqa: BLE001
            pass
    except Exception as e:  # noqa: BLE001
        out["_error"] = f"{type(e).__name__}: {e}"
    return out


def _g(fi, k):
    try:
        v = fi[k]
        return float(v) if v is not None else None
    except Exception:  # noqa: BLE001
        return None


def ycharts(sym: str) -> dict:
    from ycharts_export.scrape import scrape
    res = scrape(sym, YC_METRICS, verbose=False)
    out = {}
    for mine, theirs in YC_MAP.items():
        m = res["metrics"].get(theirs)
        if m and m.get("current") is not None:
            out[mine] = m["current"]
            out.setdefault("_as_of", m.get("as_of"))
    if res["errors"]:
        out["_error"] = "; ".join(f"{k}: {v}" for k, v in res["errors"].items())
    if not any(k in out for k in YC_MAP):
        out["_unparsed"] = True
    return out


def fmt(v, unit):
    if v is None:
        return "--"
    if unit == "$":
        return fmt_money(v) if v < 1e6 else fmt_money(v)
    if unit == "%":
        return fmt_pct(v)
    return f"{v:.1f}"


def diff(a, b):
    if a is None or b is None or not b:
        return "--"
    return fmt_pct((a / b - 1) * 100, 2, sign=True)


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--snapshot", default=os.path.join("data", "portfolio", "snapshot.json"))
    ap.add_argument("--no-ycharts", action="store_true")
    ap.add_argument("--no-yahoo", action="store_true")
    ap.add_argument("--symbols", help="comma-separated subset")
    args = ap.parse_args(argv)
    with open(args.snapshot, encoding="utf-8") as fh:
        snap = json.load(fh)
    holdings = snap["holdings"]
    if args.symbols:
        want = {s.strip().upper() for s in args.symbols.split(",")}
        holdings = [h for h in holdings if h["symbol"] in want]

    lines = [f"# Data check: Robinhood snapshot vs Yahoo Finance vs YCharts", "",
             f"*Snapshot {snap.get('as_of', '')} ({snap.get('source', '')}). Checked {date.today().strftime('%b %d, %Y')}.*", "",
             "## 1. Average cost: ledger vs Robinhood", "",
             "| Symbol | Shares (ledger) | Shares (Robinhood) | Avg cost (ledger) | Avg cost (Robinhood) | Diff |",
             "|---|---:|---:|---:|---:|---:|"]
    worst = 0.0
    for h in holdings:
        d = (h["avg_cost"] / h["rh_avg_cost"] - 1) * 100 if h.get("rh_avg_cost") else None
        worst = max(worst, abs(d or 0))
        lines.append(f"| {h['symbol']} | {h['qty']:.6f} | {h.get('rh_qty', 0):.6f} | {fmt_money(h['avg_cost'])} | "
                     f"{fmt_money(h.get('rh_avg_cost'))} | {diff(h['avg_cost'], h.get('rh_avg_cost'))} |")
    lines.append("")
    lines.append("Ledger and Robinhood agree on every average cost." if worst < 0.05 else
                 f"Largest average-cost gap is {worst:.2f}%. Robinhood's number is authoritative for taxes; "
                 "a gap usually means a split or reinvested dividend the order feed did not include.")
    lines += ["", "## 2. Market data: Robinhood vs Yahoo vs YCharts", ""]

    notes = []
    for h in holdings:
        s = h["symbol"]
        print(f"checking {s} ...", file=sys.stderr)
        ya = {} if args.no_yahoo else yahoo(s)
        yc = {} if args.no_ycharts else ycharts(s)
        for src, d in (("Yahoo", ya), ("YCharts", yc)):
            if d.get("_error"):
                notes.append(f"{s} {src}: {d['_error'][:160]}")
            if d.get("_unparsed"):
                notes.append(f"{s} YCharts: page fetched but no values parsed (layout changed?). "
                             f"Send the file in .cache/ that contains '{s}_price' to Claude.")
        lines += [f"### {s} — {h.get('name', '')}", "",
                  "| Field | Robinhood | Yahoo | YCharts | RH vs Yahoo | RH vs YCharts |", "|---|---:|---:|---:|---:|---:|"]
        for k, label, unit in FIELDS:
            rh_v, ya_v, yc_v = h.get(k), ya.get(k), yc.get(k)
            lines.append(f"| {label} | {fmt(rh_v, unit)} | {fmt(ya_v, unit)} | {fmt(yc_v, unit)} | {diff(rh_v, ya_v)} | {diff(rh_v, yc_v)} |")
        if yc.get("_as_of"):
            lines.append(f"\n*YCharts values as of {yc['_as_of']}.*")
        lines.append("")
    if notes:
        lines += ["## Notes", ""] + [f"* {n}" for n in notes]
    body = "\n".join(lines) + "\n"
    os.makedirs("reports", exist_ok=True)
    out = os.path.join("reports", f"data_check_{date.today().isoformat()}.md")
    with open(out, "w", encoding="utf-8") as fh:
        fh.write(body)
    print(body)
    print(f"wrote {out}", file=sys.stderr)


if __name__ == "__main__":
    main()

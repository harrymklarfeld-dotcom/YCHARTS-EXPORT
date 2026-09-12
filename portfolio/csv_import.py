#!/usr/bin/env python3
"""
Fallback when the private Robinhood API is unavailable: rebuild the portfolio
from Robinhood's own activity report.

In the app/site: Account -> Reports and statements -> Generate report (Activity,
CSV, pick the date range) -> download. Columns look like:

  "Activity Date","Process Date","Settle Date","Instrument","Description","Trans Code","Quantity","Price","Amount"

Trans Code: Buy / Sell / CDIV (dividend) / ACH / SPL (split) / ... Prices and
amounts are strings like "$1,234.56" or "($1,234.56)".

    python -m portfolio.csv_import ~/Downloads/robinhood_activity.csv [--cash 1234.56] [--prices MU=1000,NVDA=190]

Writes the same data/portfolio/snapshot.json the Robinhood sync writes, so the
dashboard and backtester do not care where it came from. Current prices come
from --prices, or from portfolio.prices (yfinance) when available.
"""
from __future__ import annotations

import argparse
import csv
import json
import os
import re
import sys
from datetime import datetime, timezone

from .ledger import build_positions, summarize
from .robinhood_sync import write_snapshot, DATA_DIR

_NUM = re.compile(r"[^0-9.\-]")


def money(s: str) -> float:
    s = (s or "").strip()
    if not s:
        return 0.0
    neg = s.startswith("(") or s.startswith("-")
    v = float(_NUM.sub("", s) or 0)
    return -abs(v) if neg else v


def parse_activity(path: str):
    trades, dividends, cash_flows, splits = [], [], [], []
    with open(path, newline="", encoding="utf-8-sig") as fh:
        for row in csv.DictReader(fh):
            code = (row.get("Trans Code") or "").strip().upper()
            sym = (row.get("Instrument") or "").strip().upper()
            d = row.get("Activity Date") or row.get("Process Date") or ""
            try:
                date = datetime.strptime(d.strip(), "%m/%d/%Y").date().isoformat()
            except ValueError:
                continue
            if code in ("BUY", "SELL") and sym:
                qty = money(row.get("Quantity"))
                price = money(row.get("Price"))
                amt = abs(money(row.get("Amount")))
                fees = max(0.0, (amt - qty * price) if code == "SELL" else (amt - qty * price)) if qty and price else 0.0
                trades.append({"symbol": sym, "date": date, "side": code.lower(), "qty": qty, "price": price,
                               "fees": round(abs(fees), 4)})
            elif code in ("CDIV", "DIV", "QCDIV") and sym:
                dividends.append({"symbol": sym, "date": date, "amount": money(row.get("Amount"))})
            elif code in ("ACH", "RTP", "WIRE", "DEP", "WDL"):
                cash_flows.append({"date": date, "amount": money(row.get("Amount")), "code": code})
            elif code == "SPL" and sym:
                splits.append({"symbol": sym, "date": date, "qty": money(row.get("Quantity")),
                               "desc": row.get("Description")})
    return trades, dividends, cash_flows, splits


def apply_splits(trades, splits):
    """A split row adds shares at $0. Fold it into a cost-basis-preserving adjustment of earlier buys."""
    for sp in splits:
        prior = [t for t in trades if t["symbol"] == sp["symbol"] and t["date"] <= sp["date"]]
        held = sum(t["qty"] if t["side"] == "buy" else -t["qty"] for t in prior)
        if held <= 0 or sp["qty"] <= 0:
            continue
        ratio = (held + sp["qty"]) / held
        for t in prior:
            t["qty"] *= ratio
            t["price"] /= ratio
    return trades


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("csv", nargs="+", help="one or more Robinhood activity-report CSVs")
    ap.add_argument("--cash", type=float, default=0.0, help="current cash balance (not in the report)")
    ap.add_argument("--prices", default="", help="SYM=price,SYM=price overrides for current prices")
    ap.add_argument("--data-dir", default=DATA_DIR)
    args = ap.parse_args(argv)

    trades, dividends, cash_flows, splits = [], [], [], []
    for p in args.csv:
        t, d, c, s = parse_activity(p)
        trades += t; dividends += d; cash_flows += c; splits += s
    trades = apply_splits(trades, splits)
    positions = build_positions(trades, dividends)
    symbols = [s for s, p in positions.items() if p.qty > 0]

    prices = {}
    for kv in filter(None, args.prices.split(",")):
        k, v = kv.split("=")
        prices[k.strip().upper()] = float(v)
    missing = [s for s in symbols if s not in prices]
    prev = {}
    if missing:
        try:
            from .prices import latest_quotes
            q = latest_quotes(missing)
            prices.update({s: v["price"] for s, v in q.items()})
            prev.update({s: v["prev_close"] for s, v in q.items()})
        except Exception as e:  # noqa: BLE001
            print(f"warning: could not fetch quotes for {missing}: {e}; using average cost", file=sys.stderr)
    summary = summarize(positions, prices, cash=args.cash, prev_close=prev)
    snap = {"source": f"robinhood activity CSV ({', '.join(os.path.basename(p) for p in args.csv)})",
            "as_of": datetime.now(timezone.utc).isoformat(timespec="seconds"),
            "account": {"cash": args.cash, "deposits": sum(c["amount"] for c in cash_flows)},
            "summary": {k: v for k, v in summary.items() if k != "holdings"},
            "holdings": summary["holdings"], "trades": trades, "dividends": dividends,
            "cash_flows": cash_flows, "equity_curve": {}}
    path = write_snapshot(snap, args.data_dir)
    print(f"wrote {path}: {len(trades)} trades, {len(symbols)} open positions, equity ${summary['equity']:,.2f}")


if __name__ == "__main__":
    main()

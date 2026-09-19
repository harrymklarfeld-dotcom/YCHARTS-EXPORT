#!/usr/bin/env python3
"""
Paper-trading simulator: run model portfolios with NO real money and watch what happens to
the basis and value over time. Each "mark" reads current prices and logs a snapshot, so a
scheduled mark (or a click) builds an equity history you can study — the safe way to forward-test
a strategy and build intuition before risking a dollar.

    python -m portfolio.paper new barbell --capital 10000          # open a paper book on the Barbell model
    python -m portfolio.paper new mine --tickers VOO:50,GLD:10,NVDA:10,SDCI:10,USFR:10,XLV:10 --capital 10000
    python -m portfolio.paper mark                                  # record a snapshot for every paper book
    python -m portfolio.paper report barbell                       # value, return, vs benchmark, history
    python -m portfolio.paper list

Books live in data/paper/<name>.json (positions) + <name>.log.jsonl (one snapshot per mark).
Prices come from the local cache / yfinance (portfolio.prices). Benchmark defaults to VOO.
Nothing here touches a brokerage; it is a simulator.
"""
from __future__ import annotations

import argparse
import glob
import json
import os
import sys
from datetime import datetime, timezone

from .backtest import fmt_money, fmt_pct

DIR = os.path.join("data", "paper")


def _price(sym):
    from .prices import load_prices
    try:
        rows = load_prices(sym, "2015-01-01", quiet=True)
        return rows[-1][1] if rows else None
    except Exception:  # noqa: BLE001
        return None


def _weights(model=None, tickers=None):
    if tickers:
        out = {}
        for part in tickers.split(","):
            sym, w = part.split(":")
            out[sym.strip().upper()] = float(w)
        return out
    from .watchlists import MODEL_PORTFOLIOS
    if model not in MODEL_PORTFOLIOS:
        sys.exit(f"unknown model '{model}'. Options: {', '.join(MODEL_PORTFOLIOS)}")
    return {k: v for k, v in MODEL_PORTFOLIOS[model]["weights"].items() if k != "CASH"}


def new(name, model=None, tickers=None, capital=10000.0, benchmark="VOO"):
    os.makedirs(DIR, exist_ok=True)
    w = _weights(model, tickers)
    tot = sum(w.values())
    holdings, spent = {}, 0.0
    for sym, wt in w.items():
        px = _price(sym)
        if not px:
            print(f"  no price for {sym}; skipping", file=sys.stderr); continue
        dollars = capital * (wt / tot)
        holdings[sym] = {"shares": dollars / px, "entry_price": px, "target_wt": wt / tot * 100}
        spent += dollars
    book = {"name": name, "model": model, "created": datetime.now(timezone.utc).isoformat(timespec="seconds"),
            "capital": capital, "cash": round(capital - spent, 2), "benchmark": benchmark,
            "bench_entry": _price(benchmark), "holdings": holdings}
    with open(os.path.join(DIR, f"{name}.json"), "w", encoding="utf-8") as fh:
        json.dump(book, fh, indent=1)
    print(f"opened paper book '{name}': {len(holdings)} positions, {fmt_money(capital)} basis "
          f"({model or 'custom'})")
    mark(name)


def _value(book):
    mv = book["cash"]
    rows = []
    for sym, h in book["holdings"].items():
        px = _price(sym) or h["entry_price"]
        val = h["shares"] * px
        mv += val
        rows.append({"symbol": sym, "shares": h["shares"], "entry": h["entry_price"], "price": px,
                     "value": val, "ret_pct": (px / h["entry_price"] - 1) * 100, "target_wt": h["target_wt"]})
    bench_now = _price(book["benchmark"]) or book.get("bench_entry")
    bench_ret = ((bench_now / book["bench_entry"] - 1) * 100) if book.get("bench_entry") else None
    return mv, rows, bench_ret


def mark(name=None):
    books = [name] if name else [os.path.basename(f)[:-5] for f in glob.glob(os.path.join(DIR, "*.json"))]
    for nm in books:
        path = os.path.join(DIR, f"{nm}.json")
        if not os.path.exists(path):
            continue
        with open(path, encoding="utf-8") as fh:
            book = json.load(fh)
        mv, rows, bench_ret = _value(book)
        ret = (mv / book["capital"] - 1) * 100
        snap = {"t": datetime.now(timezone.utc).isoformat(timespec="seconds"), "value": round(mv, 2),
                "return_pct": round(ret, 3), "bench_return_pct": round(bench_ret, 3) if bench_ret is not None else None,
                "alpha_pct": round(ret - bench_ret, 3) if bench_ret is not None else None}
        with open(os.path.join(DIR, f"{nm}.log.jsonl"), "a", encoding="utf-8") as fh:
            fh.write(json.dumps(snap) + "\n")
        print(f"[{nm}] {fmt_money(mv)}  {fmt_pct(ret,2,True)}  vs {book['benchmark']} "
              f"{fmt_pct(bench_ret,2,True) if bench_ret is not None else '--'}  "
              f"alpha {fmt_pct(snap['alpha_pct'],2,True) if snap['alpha_pct'] is not None else '--'}")


def report(name):
    path = os.path.join(DIR, f"{name}.json")
    if not os.path.exists(path):
        sys.exit(f"no paper book '{name}'. Create one: python -m portfolio.paper new {name} --model barbell")
    with open(path, encoding="utf-8") as fh:
        book = json.load(fh)
    mv, rows, bench_ret = _value(book)
    ret = (mv / book["capital"] - 1) * 100
    print(f"\nPaper book: {name}  ({book.get('model') or 'custom'})  opened {book['created'][:10]}")
    print(f"Value {fmt_money(mv)}  basis {fmt_money(book['capital'])}  return {fmt_pct(ret,2,True)}  "
          f"vs {book['benchmark']} {fmt_pct(bench_ret,2,True) if bench_ret is not None else '--'}\n")
    print(f"{'sym':6}{'shares':>12}{'entry':>10}{'price':>10}{'value':>11}{'ret':>9}{'target':>8}")
    for r in sorted(rows, key=lambda x: -x["value"]):
        print(f"{r['symbol']:6}{r['shares']:>12.4f}{r['entry']:>10.2f}{r['price']:>10.2f}"
              f"{r['value']:>11.2f}{r['ret_pct']:>8.1f}%{r['target_wt']:>7.0f}%")
    log = os.path.join(DIR, f"{name}.log.jsonl")
    if os.path.exists(log):
        lines = [json.loads(x) for x in open(log, encoding="utf-8") if x.strip()]
        print(f"\n{len(lines)} snapshots logged. Recent:")
        for s in lines[-8:]:
            print(f"  {s['t'][:16].replace('T',' ')}  {fmt_money(s['value'])}  {fmt_pct(s['return_pct'],2,True)}"
                  f"  alpha {fmt_pct(s['alpha_pct'],2,True) if s.get('alpha_pct') is not None else '--'}")


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = ap.add_subparsers(dest="cmd", required=True)
    n = sub.add_parser("new"); n.add_argument("name"); n.add_argument("--model"); n.add_argument("--tickers")
    n.add_argument("--capital", type=float, default=10000.0); n.add_argument("--benchmark", default="VOO")
    m = sub.add_parser("mark"); m.add_argument("name", nargs="?")
    r = sub.add_parser("report"); r.add_argument("name")
    sub.add_parser("list")
    args = ap.parse_args(argv)
    if args.cmd == "new":
        new(args.name, args.model, args.tickers, args.capital, args.benchmark)
    elif args.cmd == "mark":
        mark(args.name)
    elif args.cmd == "report":
        report(args.name)
    elif args.cmd == "list":
        for f in sorted(glob.glob(os.path.join(DIR, "*.json"))):
            print(os.path.basename(f)[:-5])


if __name__ == "__main__":
    main()

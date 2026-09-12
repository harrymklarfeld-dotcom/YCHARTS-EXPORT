#!/usr/bin/env python3
"""
Pull the live portfolio out of Robinhood and write a snapshot the dashboard
and backtester can read.

    python -m portfolio.robinhood_sync                 # interactive login, writes data/portfolio/snapshot.json
    python -m portfolio.robinhood_sync --no-orders     # skip the (slow) full order history
    RH_USERNAME=... RH_PASSWORD=... RH_TOTP_SECRET=... python -m portfolio.robinhood_sync

How the login works (robin_stocks >= 3.4):
  * Robinhood has no public stock API; robin_stocks talks to the same private
    endpoints the app uses. It is against Robinhood's terms of service and the
    library breaks whenever Robinhood changes the login flow, so treat it as
    read-only and keep the CSV import (portfolio.csv_import) as the fallback.
  * First run: Robinhood pushes a *device approval* to your phone. Approve it in
    the Robinhood app within ~2 minutes; the script polls until it is approved.
    If your account uses an authenticator app, set RH_TOTP_SECRET to the TOTP
    seed and a code is generated automatically (pip install pyotp).
  * The session token is cached in ~/.tokens/robinhood.pickle so later runs
    do not prompt again until it expires (~24h).

Output (data/portfolio/):
  snapshot.json         everything the dashboard renders (holdings, cash, P&L, equity curve, trades, dividends)
  trades.csv            filled orders as a ledger (symbol,date,side,qty,price,fees)
  history/<date>.json   one copy of each day's snapshot so the dashboard can chart your own equity over time
"""
from __future__ import annotations

import argparse
import csv
import json
import os
import sys
import time
from datetime import datetime, timezone

from .ledger import build_positions, summarize

DATA_DIR = os.path.join("data", "portfolio")


def _f(x, default=0.0):
    try:
        return float(x)
    except (TypeError, ValueError):
        return default


def login(username=None, password=None, totp_secret=None, pickle_path=None):
    import robin_stocks.robinhood as rh
    from .rh_login import login as rh_login
    username = username or os.environ.get("RH_USERNAME")
    password = password or os.environ.get("RH_PASSWORD")
    totp_secret = totp_secret or os.environ.get("RH_TOTP_SECRET")
    mfa_code = None
    if totp_secret:
        try:
            import pyotp
            mfa_code = pyotp.TOTP(totp_secret).now()
        except ImportError:
            sys.exit("RH_TOTP_SECRET is set but pyotp is missing: pip install pyotp")
    print("Logging in to Robinhood...", file=sys.stderr)
    res = rh_login(username, password, mfa_code=mfa_code, pickle_path=pickle_path)
    if not res or "access_token" not in res:
        sys.exit("Robinhood login failed. See research/robinhood_access.md; fallback: python -m portfolio.csv_import <activity.csv>")
    return rh


def fetch_positions(rh) -> list[dict]:
    """Open positions with symbol, qty, Robinhood's own average buy price, and instrument url."""
    out = []
    for item in rh.get_open_stock_positions() or []:
        if not item:
            continue
        inst = rh.get_instrument_by_url(item["instrument"]) or {}
        out.append({"symbol": inst.get("symbol"), "name": inst.get("simple_name") or inst.get("name"),
                    "qty": _f(item.get("quantity")), "rh_avg_cost": _f(item.get("average_buy_price")),
                    "instrument": item["instrument"], "type": inst.get("type"),
                    "tradable": inst.get("tradability")})
        time.sleep(0.2)  # be polite to the private API
    return [p for p in out if p["symbol"]]


def fetch_quotes(rh, symbols: list[str]) -> dict[str, dict]:
    quotes = {}
    if not symbols:
        return quotes
    for q in rh.get_quotes(symbols) or []:
        if not q:
            continue
        last = _f(q.get("last_extended_hours_trade_price")) or _f(q.get("last_trade_price"))
        quotes[q["symbol"]] = {"price": _f(q.get("last_trade_price")), "extended": last,
                               "prev_close": _f(q.get("adjusted_previous_close") or q.get("previous_close")),
                               "bid": _f(q.get("bid_price")), "ask": _f(q.get("ask_price")),
                               "updated_at": q.get("updated_at")}
    return quotes


def fetch_fundamentals(rh, symbols: list[str]) -> dict[str, dict]:
    """The YCharts-style key stats Robinhood exposes per symbol (P/E, market cap, 52w range, dividend yield)."""
    out = {}
    if not symbols:
        return out
    for s, f in zip(symbols, rh.get_fundamentals(symbols) or []):
        if not f:
            continue
        out[s] = {"pe_ratio": _f(f.get("pe_ratio"), None), "market_cap": _f(f.get("market_cap"), None),
                  "dividend_yield": _f(f.get("dividend_yield"), None), "pb_ratio": _f(f.get("pb_ratio"), None),
                  "high_52_weeks": _f(f.get("high_52_weeks"), None), "low_52_weeks": _f(f.get("low_52_weeks"), None),
                  "sector": f.get("sector"), "industry": f.get("industry"),
                  "average_volume": _f(f.get("average_volume"), None)}
    return out


def fetch_trades(rh, instrument_symbols: dict[str, str] | None = None) -> list[dict]:
    """Every filled stock order -> ledger trades. Partial fills use the executions list."""
    instrument_symbols = dict(instrument_symbols or {})
    trades = []
    for o in rh.get_all_stock_orders() or []:
        if not o or o.get("state") != "filled":
            continue
        url = o.get("instrument")
        sym = instrument_symbols.get(url)
        if not sym:
            sym = rh.get_symbol_by_url(url)
            instrument_symbols[url] = sym
            time.sleep(0.2)
        fees = _f(o.get("fees"))
        execs = o.get("executions") or []
        if execs:
            n = len(execs)
            for e in execs:
                trades.append({"symbol": sym, "date": (e.get("timestamp") or o["updated_at"])[:10],
                               "side": o["side"], "qty": _f(e.get("quantity")), "price": _f(e.get("price")),
                               "fees": fees / n, "order_id": o.get("id")})
        else:
            trades.append({"symbol": sym, "date": o["updated_at"][:10], "side": o["side"],
                           "qty": _f(o.get("cumulative_quantity")), "price": _f(o.get("average_price")),
                           "fees": fees, "order_id": o.get("id")})
    trades.sort(key=lambda t: t["date"])
    return trades


def fetch_dividends(rh, instrument_symbols: dict[str, str]) -> list[dict]:
    out = []
    for d in rh.get_dividends() or []:
        if not d or d.get("state") not in ("paid", "reinvested"):
            continue
        url = d.get("instrument")
        sym = instrument_symbols.get(url)
        if not sym:
            sym = rh.get_symbol_by_url(url)
            instrument_symbols[url] = sym
        out.append({"symbol": sym, "date": (d.get("paid_at") or d.get("payable_date"))[:10],
                    "amount": _f(d.get("amount")), "rate": _f(d.get("rate")), "position": _f(d.get("position")),
                    "reinvested": d.get("state") == "reinvested"})
    return out


def fetch_equity_curve(rh, span="year") -> list[dict]:
    """Robinhood's own daily portfolio equity for the span (day/week/month/3month/year/5year/all)."""
    interval = {"day": "5minute", "week": "10minute", "month": "hour", "3month": "day",
                "year": "day", "5year": "week", "all": None}[span]
    data = rh.get_historical_portfolio(interval=interval, span=span) or []
    return [{"t": d["begins_at"], "equity": _f(d.get("adjusted_close_equity") or d.get("close_equity")),
             "net_return": _f(d.get("net_return"))} for d in data if d]


def build_snapshot(rh, with_orders=True, spans=("year",)) -> dict:
    positions = fetch_positions(rh)
    symbols = [p["symbol"] for p in positions]
    inst_map = {p["instrument"]: p["symbol"] for p in positions}
    quotes = fetch_quotes(rh, symbols)
    funds = fetch_fundamentals(rh, symbols)
    port = rh.load_portfolio_profile() or {}
    acct = rh.load_account_profile() or {}
    trades = fetch_trades(rh, inst_map) if with_orders else []
    divs = fetch_dividends(rh, inst_map)
    cash = _f(acct.get("portfolio_cash")) or (_f(acct.get("cash")) + _f(acct.get("uncleared_deposits")))

    # Ledger view rebuilt from orders when we have them; otherwise trust Robinhood's average cost.
    if trades:
        ledger = build_positions(trades, divs)
    else:
        ledger = build_positions([{"symbol": p["symbol"], "date": "1970-01-01", "side": "buy",
                                   "qty": p["qty"], "price": p["rh_avg_cost"]} for p in positions], divs)
    prices = {s: (q["extended"] or q["price"]) for s, q in quotes.items()}
    prev = {s: q["prev_close"] for s, q in quotes.items()}
    summary = summarize(ledger, prices, cash=cash, prev_close=prev)

    # Attach what the ledger can't know: Robinhood's own avg cost (should match), names, key stats.
    by_sym = {p["symbol"]: p for p in positions}
    for row in summary["holdings"]:
        p = by_sym.get(row["symbol"], {})
        row["name"] = p.get("name")
        row["rh_avg_cost"] = p.get("rh_avg_cost")
        row["rh_qty"] = p.get("qty")
        row.update({k: v for k, v in funds.get(row["symbol"], {}).items()})
        row["quote_time"] = quotes.get(row["symbol"], {}).get("updated_at")

    snap = {"source": "robinhood (robin_stocks, private API)",
            "as_of": datetime.now(timezone.utc).isoformat(timespec="seconds"),
            "account": {"equity_rh": _f(port.get("equity")), "extended_hours_equity": _f(port.get("extended_hours_equity"), None),
                        "equity_previous_close": _f(port.get("adjusted_equity_previous_close") or port.get("equity_previous_close")),
                        "market_value_rh": _f(port.get("market_value")), "cash": cash,
                        "buying_power": _f(acct.get("buying_power")), "withdrawable": _f(port.get("withdrawable_amount"))},
            "summary": {k: v for k, v in summary.items() if k != "holdings"},
            "holdings": summary["holdings"],
            "trades": trades, "dividends": divs,
            "equity_curve": {span: fetch_equity_curve(rh, span) for span in spans}}
    return snap


def write_snapshot(snap: dict, data_dir: str = DATA_DIR) -> str:
    os.makedirs(os.path.join(data_dir, "history"), exist_ok=True)
    path = os.path.join(data_dir, "snapshot.json")
    with open(path, "w", encoding="utf-8") as fh:
        json.dump(snap, fh, indent=2)
    day = snap["as_of"][:10]
    with open(os.path.join(data_dir, "history", f"{day}.json"), "w", encoding="utf-8") as fh:
        json.dump({"as_of": snap["as_of"], "account": snap["account"], "summary": snap["summary"],
                   "holdings": [{k: r[k] for k in ("symbol", "qty", "avg_cost", "price", "market_value")}
                                for r in snap["holdings"]]}, fh)
    if snap.get("trades"):
        with open(os.path.join(data_dir, "trades.csv"), "w", newline="", encoding="utf-8") as fh:
            w = csv.DictWriter(fh, fieldnames=["symbol", "date", "side", "qty", "price", "fees", "order_id"])
            w.writeheader()
            w.writerows(snap["trades"])
    return path


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--no-orders", action="store_true", help="skip full order history (faster; uses Robinhood's avg cost)")
    ap.add_argument("--spans", default="year,all", help="equity-curve spans to pull (day,week,month,3month,year,5year,all)")
    ap.add_argument("--data-dir", default=DATA_DIR)
    ap.add_argument("--pickle-path", default=None, help="where to cache the session token (default ~/.tokens)")
    args = ap.parse_args(argv)
    rh = login(pickle_path=args.pickle_path)
    snap = build_snapshot(rh, with_orders=not args.no_orders, spans=tuple(args.spans.split(",")))
    path = write_snapshot(snap, args.data_dir)
    s = snap["summary"]
    print(f"wrote {path}: {len(snap['holdings'])} holdings, equity ${s['equity']:,.2f}, "
          f"day {s['day_change']:+,.2f} ({s['day_change_pct']:+.2f}%), unrealized {s['unrealized']:+,.2f}")
    return 0


if __name__ == "__main__":
    sys.exit(main())

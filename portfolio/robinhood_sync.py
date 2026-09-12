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

from .ledger import build_positions, summarize, ytd_summary, period_returns

DATA_DIR = os.path.join("data", "portfolio")


def snap_date_str():
    return datetime.now(timezone.utc).date().isoformat()


def _one_year_ago():
    from datetime import timedelta
    return (datetime.now(timezone.utc).date() - timedelta(days=366)).isoformat()


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
    # Robinhood's /orders/ feed returns a limited window by default; asking with an old
    # updated_at[gte] pulls the rest. Union both and de-duplicate by order id.
    seen, orders = set(), []
    for kwargs in ({}, {"start_date": "2010-01-01T00:00:00Z"}):
        try:
            for o in rh.get_all_stock_orders(**kwargs) or []:
                if o and o.get("id") not in seen:
                    seen.add(o.get("id")); orders.append(o)
        except Exception as e:  # noqa: BLE001
            print(f"warning: order fetch {kwargs} failed: {e}", file=sys.stderr)
    for o in orders:
        if o.get("state") != "filled":
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


def fetch_transfers(rh) -> list[dict]:
    """Cash in/out of the account: deposits positive, withdrawals negative."""
    out = []
    try:
        for t in rh.get_bank_transfers() or []:
            if not t or t.get("state") not in ("completed", "settled"):
                continue
            amt = _f(t.get("amount"))
            out.append({"date": (t.get("created_at") or t.get("updated_at"))[:10],
                        "amount": amt if t.get("direction") == "deposit" else -amt, "source": "bank"})
    except Exception as e:  # noqa: BLE001
        print(f"warning: bank transfers unavailable: {e}", file=sys.stderr)
    if not hasattr(rh, "get_unified_transfers"):
        return out
    try:
        for t in rh.get_unified_transfers() or []:
            if not t or str(t.get("state", "")).lower() not in ("completed", "settled"):
                continue
            amt = _f(t.get("amount", {}).get("amount") if isinstance(t.get("amount"), dict) else t.get("amount"))
            d = (t.get("initiated_at") or t.get("created_at") or t.get("updated_at") or "")[:10]
            direction = str(t.get("direction", "")).lower()
            if not d or not amt or direction not in ("deposit", "withdraw", "withdrawal", "in", "out"):
                continue
            key = (d, round(amt, 2))
            if any((x["date"], round(abs(x["amount"]), 2)) == key for x in out):
                continue
            out.append({"date": d, "amount": amt if direction in ("deposit", "in") else -amt, "source": "unified"})
    except Exception as e:  # noqa: BLE001
        print(f"warning: unified transfers unavailable: {e}", file=sys.stderr)
    return sorted(out, key=lambda x: x["date"])


def merge_csv_history(trades: list[dict], dividends: list[dict], transfers: list[dict], csv_paths: list[str]):
    """Fold Robinhood activity-report CSVs (full history) into the API data, de-duplicated."""
    from .csv_import import parse_activity, apply_splits
    tkey = lambda t: (t["symbol"], t["date"], t["side"].lower()[0], round(float(t["qty"]), 4), round(float(t["price"]), 2))
    dkey = lambda d: (d["symbol"], d["date"], round(float(d["amount"]), 2))
    xkey = lambda x: (x["date"], round(float(x["amount"]), 2))
    have_t, have_d, have_x = {tkey(t) for t in trades}, {dkey(d) for d in dividends}, {xkey(x) for x in transfers}
    added = 0
    for path in csv_paths:
        t, d, c, sp = parse_activity(path)
        t = apply_splits(t, sp)
        for x in t:
            x["source"] = "csv"
            if tkey(x) not in have_t:
                trades.append(x); have_t.add(tkey(x)); added += 1
        for x in d:
            if dkey(x) not in have_d:
                dividends.append(x); have_d.add(dkey(x))
        for x in c:
            x = {"date": x["date"], "amount": x["amount"], "source": "csv"}
            if xkey(x) not in have_x:
                transfers.append(x); have_x.add(xkey(x))
        print(f"merged {os.path.basename(path)}: {len(t)} trades ({added} new so far), {len(d)} dividends, {len(c)} cash movements",
              file=sys.stderr)
    trades.sort(key=lambda t: t["date"]); dividends.sort(key=lambda d: d["date"]); transfers.sort(key=lambda x: x["date"])
    return trades, dividends, transfers


def reconstruct_curve(trades, live_prices, live_date, live_equity):
    """Build a daily portfolio-value curve from your own fills + cached daily prices, so period
    returns and the equity chart do not depend on Robinhood's historicals endpoint (which 404s for
    some accounts). Returns (curve, flows_by_date) where flows are net buy dollars per day."""
    from .prices import load_prices
    syms = sorted({t["symbol"] for t in trades})
    if not syms:
        return [], {}
    start = min(t["date"] for t in trades)
    px = {}
    for sym in syms:
        try:
            rows = load_prices(sym, start, quiet=True)
            if rows:
                px[sym] = dict(rows)
        except Exception as e:  # noqa: BLE001
            print(f"warning: no price history for {sym}: {e}", file=sys.stderr)
    if not px:
        return [], {}
    all_dates = sorted({d for m in px.values() for d in m} | {t["date"] for t in trades})
    all_dates = [d for d in all_dates if d >= start and d <= live_date]
    tsorted = sorted(trades, key=lambda t: t["date"])
    ti, held, last = 0, {s: 0.0 for s in syms}, {s: None for s in syms}
    flows, curve = {}, []
    for d in all_dates:
        while ti < len(tsorted) and tsorted[ti]["date"] <= d:
            t = tsorted[ti]; ti += 1
            q = float(t["qty"]); pr = float(t["price"])
            if str(t.get("note", "")).startswith("reconciled"):
                held[t["symbol"]] += q if t["side"].lower().startswith("b") else -q
                continue
            held[t["symbol"]] += q if t["side"].lower().startswith("b") else -q
            flows[d] = flows.get(d, 0.0) + (q * pr if t["side"].lower().startswith("b") else -q * pr)
        for s in px:
            if d in px[s]:
                last[s] = px[s][d]
        mv = sum(held[s] * (last[s] or 0.0) for s in px)
        curve.append({"t": d, "equity": round(mv, 2)})
    # pin the final point to today's live holdings value so the chart ends where you actually are
    if curve and live_equity:
        if curve[-1]["t"] == live_date:
            curve[-1]["equity"] = round(live_equity, 2)
        else:
            curve.append({"t": live_date, "equity": round(live_equity, 2)})
    return curve, flows


def fetch_equity_curve(rh, span="year") -> list[dict]:
    """Robinhood's own daily portfolio equity for the span (day/week/month/3month/year/5year/all)."""
    interval = {"day": "5minute", "week": "10minute", "month": "hour", "3month": "day",
                "year": "day", "5year": "week", "all": None}[span]
    data = rh.get_historical_portfolio(interval=interval, span=span) or []
    return [{"t": d["begins_at"], "equity": _f(d.get("adjusted_close_equity") or d.get("close_equity")),
             "net_return": _f(d.get("net_return"))} for d in data if d]


def reconcile(trades: list[dict], positions: list[dict]) -> list[dict]:
    """Robinhood's order feed misses shares that arrived by dividend reinvestment, transfer, split or
    stock gift. Compare the replayed order history with the live position and insert an opening
    'buy' at Robinhood's own average cost for any shares the orders cannot explain."""
    synthetic = []
    by_sym: dict[str, list[dict]] = {}
    for t in trades:
        by_sym.setdefault(t["symbol"], []).append(t)
    for p in positions:
        s = p["symbol"]
        running, low = 0.0, 0.0
        for t in sorted(by_sym.get(s, []), key=lambda x: x["date"]):
            running += t["qty"] if t["side"].lower().startswith("b") else -t["qty"]
            low = min(low, running)
        missing = max(-low, p["qty"] - running)
        if missing > 1e-6:
            synthetic.append({"symbol": s, "date": "1970-01-01", "side": "buy", "qty": round(missing, 6),
                              "price": p["rh_avg_cost"] or (by_sym.get(s) or [{"price": 0}])[0]["price"], "fees": 0.0,
                              "order_id": None, "note": "reconciled to Robinhood position (DRIP/transfer/split not in order history)"})
    return synthetic + trades


def build_snapshot(rh, with_orders=True, spans=("year",), csv_paths=()) -> dict:
    positions = fetch_positions(rh)
    symbols = [p["symbol"] for p in positions]
    inst_map = {p["instrument"]: p["symbol"] for p in positions}
    quotes = fetch_quotes(rh, symbols)
    funds = fetch_fundamentals(rh, symbols)
    port = rh.load_portfolio_profile() or {}
    acct = rh.load_account_profile() or {}
    trades = fetch_trades(rh, inst_map) if with_orders else []
    divs = fetch_dividends(rh, inst_map)
    transfers = fetch_transfers(rh)
    if csv_paths:
        trades, divs, transfers = merge_csv_history(trades, divs, transfers, list(csv_paths))
    cash = _f(acct.get("portfolio_cash")) or (_f(acct.get("cash")) + _f(acct.get("uncleared_deposits")))

    # Ledger view rebuilt from orders when we have them; otherwise trust Robinhood's average cost.
    if trades:
        trades = reconcile(trades, positions)
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

    curves = {}
    for span in spans:
        try:
            c = fetch_equity_curve(rh, span)
            if c and c[0] is not None:
                curves[span] = c
        except Exception as e:  # noqa: BLE001
            print(f"warning: Robinhood equity history ({span}) unavailable: {e}", file=sys.stderr)
    # Reconstruct from our own fills + prices; reliable, and the source for period returns.
    recon, flows = reconstruct_curve(trades, prices, snap_date_str(), summary["equity"])
    if recon:
        curves["all"] = recon
        curves.setdefault("year", [p for p in recon if p["t"] >= _one_year_ago()])
    long_curve = recon or curves.get("all") or curves.get("year") or []
    returns = period_returns(long_curve, transfers, flows)
    ytd = ytd_summary(ledger, trades, divs, transfers, long_curve, summary["equity"])
    closed = [p.to_dict() for p in ledger.values() if p.qty <= 1e-9 and (p.buys or p.sells)]
    summary["rh_cost_basis"] = sum(p["qty"] * (p["rh_avg_cost"] or 0) for p in positions)
    summary["realized_fifo"] = sum(p.realized_fifo for p in ledger.values())
    snap = {"source": "robinhood (robin_stocks, private API)" + (" + activity CSV" if csv_paths else ""),
            "as_of": datetime.now(timezone.utc).isoformat(timespec="seconds"),
            "account": {"equity_rh": _f(port.get("equity")), "extended_hours_equity": _f(port.get("extended_hours_equity"), None),
                        "equity_previous_close": _f(port.get("adjusted_equity_previous_close") or port.get("equity_previous_close")),
                        "market_value_rh": _f(port.get("market_value")), "cash": cash,
                        "buying_power": _f(acct.get("buying_power")), "withdrawable": _f(port.get("withdrawable_amount"))},
            "summary": {k: v for k, v in summary.items() if k != "holdings"},
            "holdings": summary["holdings"],
            "trades": trades, "dividends": divs, "transfers": transfers, "closed": closed, "ytd": ytd,
            "returns": returns, "equity_curve": curves}
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
            w = csv.DictWriter(fh, fieldnames=["symbol", "date", "side", "qty", "price", "fees", "order_id", "note", "source"],
                               extrasaction="ignore")
            w.writeheader()
            w.writerows(snap["trades"])
    return path


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--no-orders", action="store_true", help="skip full order history (faster; uses Robinhood's avg cost)")
    ap.add_argument("--spans", default="all,year,3month,month,week", help="equity-curve spans to pull (day,week,month,3month,year,5year,all)")
    ap.add_argument("--data-dir", default=DATA_DIR)
    ap.add_argument("--pickle-path", default=None, help="where to cache the session token (default ~/.tokens)")
    ap.add_argument("--csv", nargs="*", default=[], help="Robinhood activity-report CSV(s) to merge for full history")
    args = ap.parse_args(argv)
    import glob
    csvs = list(args.csv) + sorted(glob.glob(os.path.join(args.data_dir, "imports", "*.csv")))
    rh = login(pickle_path=args.pickle_path)
    snap = build_snapshot(rh, with_orders=not args.no_orders, spans=tuple(args.spans.split(",")), csv_paths=csvs)
    path = write_snapshot(snap, args.data_dir)
    s = snap["summary"]
    y = snap["ytd"]
    print(f"wrote {path}: {len(snap['holdings'])} holdings, {len(snap['closed'])} closed, {len(snap['trades'])} fills, "
          f"equity ${s['equity']:,.2f}, day {s['day_change']:+,.2f} ({s['day_change_pct']:+.2f}%), "
          f"unrealized {s['unrealized']:+,.2f}, realized {s['realized']:+,.2f}, cost basis ${s['cost_basis']:,.2f} "
          f"(Robinhood says ${s['rh_cost_basis']:,.2f})")
    print(f"{y['year']} to date: bought ${y['buys']:,.2f}, sold ${y['sells']:,.2f}, deposits ${y['net_deposits']:,.2f}, "
          f"dividends ${y['dividends']:,.2f}, realized {y['realized']:+,.2f}"
          + (f", return {y['return']:+,.2f}" if y['return'] is not None else ""))
    return 0


if __name__ == "__main__":
    sys.exit(main())

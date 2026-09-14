#!/usr/bin/env python3
"""
The live recorder — runs on YOUR Mac and keeps your holdings current by itself, so you never have
to hand Claude a transaction again. It logs into Robinhood once (cached session) and then:

  * at the market open and close, writes a FULL snapshot (holdings, cash, P&L) via robinhood_sync,
  * every few minutes in between, appends a lightweight intraday "tick" (equity + each price) to
    data/portfolio/intraday/<date>.jsonl,

building a growing, second-by-day time series of exactly how your real book moves. The dashboard,
the growth simulator (portfolio.simulate), and the signal/attribution engines all read what it
records — so "backtest on my actual holdings" becomes literally true.

Nothing here trades. It is read-only market data + your own positions.

    python -m portfolio.autopull --once                 # one full sync + tick, then exit
    python -m portfolio.autopull --loop --interval 300   # tick every 5 min while the market is open
    python -m portfolio.autopull --loop --all-hours      # also tick after hours (for testing)

Leave the --loop form running (or install it via the launchd plist the Mac launcher writes) and it
keeps itself up to date. When you want analysis, just open Claude — it reads the latest snapshot.
"""
from __future__ import annotations

import argparse
import datetime as dt
import json
import os
import sys
import time

DATA_DIR = os.path.join("data", "portfolio")
INTRADAY = os.path.join(DATA_DIR, "intraday")


def now_et() -> dt.datetime:
    try:
        from zoneinfo import ZoneInfo
        return dt.datetime.now(ZoneInfo("America/New_York"))
    except Exception:  # noqa: BLE001
        return dt.datetime.utcnow() - dt.timedelta(hours=4)  # rough EDT fallback


def market_open(t: dt.datetime | None = None) -> bool:
    """True during regular US equity hours (Mon-Fri, 9:30-16:00 ET). Ignores holidays."""
    t = t or now_et()
    if t.weekday() >= 5:
        return False
    mins = t.hour * 60 + t.minute
    return 9 * 60 + 30 <= mins <= 16 * 60


def append_tick(equity: float, prices: dict, when: dt.datetime | None = None, data_dir=DATA_DIR) -> str:
    """Append one intraday observation as a JSON line under intraday/<date>.jsonl."""
    when = when or now_et()
    d = os.path.join(data_dir, "intraday")
    os.makedirs(d, exist_ok=True)
    path = os.path.join(d, f"{when.date().isoformat()}.jsonl")
    with open(path, "a", encoding="utf-8") as fh:
        fh.write(json.dumps({"t": when.isoformat(timespec="seconds"),
                             "equity": round(equity, 2),
                             "prices": {k: round(v, 4) for k, v in prices.items()}}) + "\n")
    return path


def read_intraday(day: str, data_dir=DATA_DIR) -> list[dict]:
    path = os.path.join(data_dir, "intraday", f"{day}.jsonl")
    if not os.path.exists(path):
        return []
    with open(path, encoding="utf-8") as fh:
        return [json.loads(line) for line in fh if line.strip()]


def _tick_from_rh(rh) -> tuple[float, dict]:
    """Light pull: current positions + quotes -> (equity, {symbol: price}). No order history."""
    from .robinhood_sync import fetch_positions, fetch_quotes, _f
    positions = fetch_positions(rh)
    syms = [p["symbol"] for p in positions]
    quotes = fetch_quotes(rh, syms)
    prices, equity = {}, 0.0
    for p in positions:
        px = _f(quotes.get(p["symbol"], {}).get("price"))
        prices[p["symbol"]] = px
        equity += p["qty"] * px
    return equity, prices


def full_sync(rh, data_dir=DATA_DIR):
    """Heavy pull: the complete snapshot the dashboard uses (open/close of day)."""
    from .robinhood_sync import build_snapshot, write_snapshot
    snap = build_snapshot(rh, with_orders=False, spans=("all", "month", "week"))
    write_snapshot(snap, data_dir)
    return snap["summary"].get("equity")


def run_once(data_dir=DATA_DIR, quiet=False):
    from .robinhood_sync import login
    rh = login()
    eq = full_sync(rh, data_dir)
    equity, prices = _tick_from_rh(rh)
    append_tick(equity, prices, data_dir=data_dir)
    if not quiet:
        print(f"synced: equity ${equity:,.2f} across {len(prices)} names at {now_et():%H:%M ET}")
    return equity


def loop(interval=300, all_hours=False, data_dir=DATA_DIR):
    from .robinhood_sync import login
    rh = login()
    print(f"autopull running — tick every {interval}s while the market is open. Ctrl+C to stop.")
    did_open = did_close = None
    while True:
        t = now_et()
        day = t.date().isoformat()
        if all_hours or market_open(t):
            try:
                # full snapshot once at first tick of the day and once near the close
                if did_open != day:
                    full_sync(rh, data_dir); did_open = day
                    print(f"{t:%Y-%m-%d %H:%M} open snapshot written")
                equity, prices = _tick_from_rh(rh)
                append_tick(equity, prices, t, data_dir)
                if t.hour == 15 and t.minute >= 55 and did_close != day:
                    full_sync(rh, data_dir); did_close = day
                    print(f"{t:%H:%M} close snapshot written")
                print(f"{t:%H:%M} ${equity:,.2f}", flush=True)
            except Exception as e:  # noqa: BLE001
                print(f"{t:%H:%M} tick failed: {type(e).__name__}: {e}", file=sys.stderr)
        time.sleep(interval)


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--once", action="store_true", help="one full sync + tick, then exit")
    ap.add_argument("--loop", action="store_true", help="keep ticking on an interval")
    ap.add_argument("--interval", type=int, default=300, help="seconds between ticks in --loop")
    ap.add_argument("--all-hours", action="store_true", help="tick even when the market is closed (testing)")
    ap.add_argument("--data-dir", default=DATA_DIR)
    args = ap.parse_args(argv)
    if args.loop:
        loop(args.interval, args.all_hours, args.data_dir)
    else:
        run_once(args.data_dir)


if __name__ == "__main__":
    main()

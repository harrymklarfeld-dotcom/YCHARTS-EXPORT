#!/usr/bin/env python3
"""
Synthetic data so everything runs without a Robinhood login or network:

    python -m portfolio.demo_data            # writes data/portfolio/sample_snapshot.json + data/prices/DEMO*.csv

The snapshot has the same shape robinhood_sync.py writes. Numbers are made up.
"""
from __future__ import annotations

import json
import math
import os
import random
from datetime import date, timedelta, datetime, timezone

from .ledger import build_positions, summarize
from .robinhood_sync import DATA_DIR


def gbm(start_price: float, days: int, mu: float, sigma: float, seed: int, start: date) -> list[tuple[str, float]]:
    rnd = random.Random(seed)
    px, out, d = start_price, [], start
    dt = 1 / 252
    while len(out) < days:
        if d.weekday() < 5:
            px *= math.exp((mu - sigma ** 2 / 2) * dt + sigma * math.sqrt(dt) * rnd.gauss(0, 1))
            out.append((d.isoformat(), round(px, 2)))
        d += timedelta(days=1)
    return out


def build(seed: int = 7) -> dict:
    today = date(2026, 9, 11)
    start = today - timedelta(days=365 * 3)
    series = {"MU": gbm(90, 760, 0.55, 0.55, seed, start), "NVDA": gbm(45, 760, 0.45, 0.45, seed + 1, start),
              "AAPL": gbm(170, 760, 0.12, 0.22, seed + 2, start), "VOO": gbm(380, 760, 0.13, 0.15, seed + 3, start),
              "AMD": gbm(100, 760, 0.10, 0.45, seed + 4, start)}
    names = {"MU": "Micron Technology", "NVDA": "NVIDIA", "AAPL": "Apple", "VOO": "Vanguard S&P 500 ETF",
             "AMD": "Advanced Micro Devices"}
    rnd = random.Random(seed)
    trades = []
    for sym, px in series.items():
        idx = {d: p for d, p in px}
        dates = [d for d, _ in px]
        # monthly buys, occasional trims
        for i in range(20, len(dates), 21):
            d = dates[i]
            if rnd.random() < 0.85:
                trades.append({"symbol": sym, "date": d, "side": "buy", "qty": round(rnd.uniform(1, 6), 2),
                               "price": idx[d], "fees": 0.0})
            elif i > 200:
                trades.append({"symbol": sym, "date": d, "side": "sell", "qty": 1.0, "price": idx[d], "fees": 0.02})
    trades.sort(key=lambda t: t["date"])
    divs = [{"symbol": "VOO", "date": (start + timedelta(days=91 * k + 80)).isoformat(), "amount": round(8 + 2 * k, 2),
             "reinvested": False} for k in range(11)]
    divs += [{"symbol": "AAPL", "date": (start + timedelta(days=91 * k + 40)).isoformat(), "amount": round(3 + 0.5 * k, 2),
              "reinvested": True} for k in range(11)]
    pos = build_positions(trades, divs)
    last = {s: px[-1][1] for s, px in series.items()}
    prev = {s: px[-2][1] for s, px in series.items()}
    cash = 2_314.55
    summary = summarize(pos, last, cash=cash, prev_close=prev)
    stats = {"MU": (22.6, 1.145e12, 0.1, 11.2, 1255.0, 138.0, "Technology", "Semiconductors"),
             "NVDA": (48.0, 4.6e12, 0.02, 40.0, 210.0, 90.0, "Technology", "Semiconductors"),
             "AAPL": (32.0, 3.5e12, 0.45, 50.0, 260.0, 170.0, "Technology", "Consumer Electronics"),
             "VOO": (24.0, None, 1.2, None, 600.0, 450.0, "ETF", "Large Blend"),
             "AMD": (95.0, 2.5e11, 0.0, 4.0, 190.0, 80.0, "Technology", "Semiconductors")}
    for r in summary["holdings"]:
        pe, mc, dy, pb, hi, lo, sec, ind = stats[r["symbol"]]
        r.update({"name": names[r["symbol"]], "rh_avg_cost": r["avg_cost"], "rh_qty": r["qty"], "pe_ratio": pe,
                  "market_cap": mc, "dividend_yield": dy, "pb_ratio": pb, "high_52_weeks": hi, "low_52_weeks": lo,
                  "sector": sec, "industry": ind})
    # equity curve: replay ledger at each day's close
    curve = []
    dates = [d for d, _ in series["MU"]]
    tix = 0
    held = {s: 0.0 for s in series}
    cash_flow = 0.0
    lookup = {s: dict(px) for s, px in series.items()}
    for d in dates:
        while tix < len(trades) and trades[tix]["date"] <= d:
            t = trades[tix]
            held[t["symbol"]] += t["qty"] if t["side"] == "buy" else -t["qty"]
            cash_flow += t["qty"] * t["price"] * (1 if t["side"] == "buy" else -1)
            tix += 1
        eq = sum(held[s] * lookup[s][d] for s in series) + cash
        curve.append({"t": d, "equity": round(eq, 2), "net_return": round(eq - cash - cash_flow, 2)})
    snap = {"source": "DEMO synthetic data (portfolio.demo_data)",
            "as_of": datetime(2026, 9, 11, 20, 0, tzinfo=timezone.utc).isoformat(timespec="seconds"),
            "account": {"equity_rh": summary["equity"], "extended_hours_equity": None,
                        "equity_previous_close": summary["equity"] - summary["day_change"],
                        "market_value_rh": summary["market_value"], "cash": cash, "buying_power": cash,
                        "withdrawable": cash},
            "summary": {k: v for k, v in summary.items() if k != "holdings"},
            "holdings": summary["holdings"], "trades": trades, "dividends": divs,
            "equity_curve": {"all": curve, "year": curve[-252:]}}
    return snap, series


def main():
    snap, series = build()
    os.makedirs(DATA_DIR, exist_ok=True)
    os.makedirs(os.path.join("data", "prices"), exist_ok=True)
    p = os.path.join(DATA_DIR, "sample_snapshot.json")
    with open(p, "w", encoding="utf-8") as fh:
        json.dump(snap, fh, indent=1)
    for s, px in series.items():
        with open(os.path.join("data", "prices", f"DEMO_{s}.csv"), "w", encoding="utf-8") as fh:
            fh.write("date,adj_close\n" + "\n".join(f"{d},{v}" for d, v in px) + "\n")
    print(f"wrote {p} ({len(snap['holdings'])} holdings, {len(snap['trades'])} trades) and data/prices/DEMO_*.csv")


if __name__ == "__main__":
    main()

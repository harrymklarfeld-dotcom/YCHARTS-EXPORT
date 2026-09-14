#!/usr/bin/env python3
"""
Monte-Carlo growth simulation for YOUR actual book.

Instead of a generic "assume 7% a year," this builds the portfolio's own daily return series from
its current weights applied to each holding's real price history, then projects it forward two ways:

  bootstrap (default) — resample your holdings' ACTUAL historical days (in short blocks, so runs and
                        fat tails survive). This is "backtesting from the experiences your positions
                        have actually had," projected forward.
  parametric          — classic lognormal (GBM) using the book's mean/vol. Smoother, thinner tails.

Outputs percentile fan bands (p5..p95) per day, terminal-value stats, probability of a loss, and the
distribution of worst drawdown along the way. Optional monthly deposit models your DCA habit.

Pure stdlib. Runs on cached/live prices via portfolio.prices; unit-tested offline.

    python -m portfolio.simulate                          # 1y projection of data/portfolio/snapshot.json
    python -m portfolio.simulate --days 504 --deposit 100 # 2y, adding $100/mo
    python -m portfolio.simulate --method parametric --paths 5000
"""
from __future__ import annotations

import argparse
import json
import math
import os
import random
import statistics

from .prices import load_prices

TRADING_DAYS = 252


def load_holdings(path=os.path.join("data", "portfolio", "snapshot.json")):
    """Return {ticker: market_value} from the snapshot the recorder maintains."""
    with open(path, encoding="utf-8") as fh:
        snap = json.load(fh)
    out = {}
    for h in snap.get("holdings", []):
        mv = h.get("market_value")
        if mv is None and h.get("shares") is not None and h.get("price") is not None:
            mv = h["shares"] * h["price"]
        if mv:
            out[h["symbol"].upper()] = float(mv)
    return out, snap.get("summary", {}).get("equity", sum(out.values()))


def portfolio_returns(weights, start="2018-01-01", quiet=True):
    """Daily returns of the current book held at fixed weights (daily rebalanced) over history."""
    series = {}
    for tk in weights:
        try:
            series[tk] = dict(load_prices(tk, start, quiet=quiet))
        except Exception:  # noqa: BLE001
            pass
    if not series:
        return [], []
    common = sorted(set.intersection(*[set(s) for s in series.values()]))
    wsum = sum(weights[t] for t in series)
    w = {t: weights[t] / wsum for t in series}
    dates, rets = [], []
    for i in range(1, len(common)):
        d0, d1 = common[i - 1], common[i]
        if any(series[t][d0] <= 0 for t in series):
            continue
        r = sum(w[t] * (series[t][d1] / series[t][d0] - 1) for t in series)
        dates.append(d1); rets.append(r)
    return dates, rets


def _paths(daily, days, n, method, seed, block=5):
    rng = random.Random(seed)
    mu = statistics.fmean(daily)
    sd = statistics.pstdev(daily) or 1e-9
    out = []
    for _ in range(n):
        cum = 1.0
        series = [1.0]
        if method == "parametric":
            for _ in range(days):
                cum *= 1 + rng.gauss(mu, sd)
                series.append(cum)
        else:  # block bootstrap from actual days
            i = 0
            while i < days:
                start = rng.randrange(len(daily))
                for k in range(block):
                    if i >= days:
                        break
                    cum *= 1 + daily[(start + k) % len(daily)]
                    series.append(cum)
                    i += 1
        out.append(series)
    return out


def _max_dd(series):
    peak, mdd = series[0], 0.0
    for v in series:
        peak = max(peak, v)
        mdd = min(mdd, v / peak - 1)
    return mdd


def simulate(start_value, daily, days=TRADING_DAYS, paths=2000, method="bootstrap",
             deposit=0.0, seed=0):
    """
    Project `start_value` forward `days` trading days over `paths` simulations.
    `deposit` is added monthly (~21 trading days). Returns bands + terminal stats.
    """
    if not daily:
        return {"error": "no return history for this book"}
    raw = _paths(daily, days, paths, method, seed)
    # scale to dollars, injecting monthly deposits
    dollar_paths = []
    for growth in raw:
        val = start_value
        vals = [val]
        for t in range(1, len(growth)):
            step = growth[t] / growth[t - 1]
            val *= step
            if deposit and t % 21 == 0:
                val += deposit
            vals.append(val)
        dollar_paths.append(vals)

    def pct(day, q):
        col = sorted(p[day] for p in dollar_paths)
        idx = min(len(col) - 1, max(0, int(q / 100 * len(col))))
        return col[idx]

    L = len(dollar_paths[0])
    bands = [{"t": t,
              "p5": round(pct(t, 5), 2), "p25": round(pct(t, 25), 2), "p50": round(pct(t, 50), 2),
              "p75": round(pct(t, 75), 2), "p95": round(pct(t, 95), 2)} for t in range(L)]
    terminal = sorted(p[-1] for p in dollar_paths)
    contributed = start_value + deposit * (days // 21)
    n = len(terminal)
    yrs = days / TRADING_DAYS
    med = terminal[n // 2]
    return {
        "method": method, "days": days, "paths": paths, "start_value": round(start_value, 2),
        "deposit_monthly": deposit, "contributed_total": round(contributed, 2),
        "bands": bands,
        "terminal": {
            "p5": round(terminal[int(0.05 * n)], 2), "p25": round(terminal[int(0.25 * n)], 2),
            "p50": round(med, 2), "p75": round(terminal[int(0.75 * n)], 2),
            "p95": round(terminal[int(0.95 * n)], 2),
            "mean": round(statistics.fmean(terminal), 2),
        },
        "expected_cagr_pct": round(((med / start_value) ** (1 / yrs) - 1) * 100, 1) if start_value > 0 else None,
        "prob_loss_pct": round(sum(1 for v in terminal if v < contributed) / n * 100, 1),
        "prob_down_20_pct": round(sum(1 for v in terminal if v < contributed * 0.8) / n * 100, 1),
        "median_max_drawdown_pct": round(statistics.median(_max_dd(p) for p in dollar_paths) * 100, 1),
        "hist": {"ann_return_pct": round((statistics.fmean(daily) * TRADING_DAYS) * 100, 1),
                 "ann_vol_pct": round(statistics.pstdev(daily) * math.sqrt(TRADING_DAYS) * 100, 1),
                 "days_of_history": len(daily)},
    }


def run(path=os.path.join("data", "portfolio", "snapshot.json"), start="2018-01-01",
        days=TRADING_DAYS, paths=2000, method="bootstrap", deposit=0.0, quiet=True):
    values, equity = load_holdings(path)
    weights = values  # dollars work as weights
    dates, daily = portfolio_returns(weights, start, quiet=quiet)
    sim = simulate(equity, daily, days=days, paths=paths, method=method, deposit=deposit)
    sim["as_of_holdings"] = sorted(values, key=lambda k: -values[k])
    sim["history_from"] = dates[0] if dates else None
    return sim


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--snapshot", default=os.path.join("data", "portfolio", "snapshot.json"))
    ap.add_argument("--start", default="2018-01-01", help="history start for estimating behavior")
    ap.add_argument("--days", type=int, default=TRADING_DAYS, help="trading days to project")
    ap.add_argument("--paths", type=int, default=2000)
    ap.add_argument("--method", choices=["bootstrap", "parametric"], default="bootstrap")
    ap.add_argument("--deposit", type=float, default=0.0, help="monthly deposit $")
    ap.add_argument("--json", metavar="PATH")
    args = ap.parse_args(argv)

    sim = run(args.snapshot, args.start, args.days, args.paths, args.method, args.deposit, quiet=False)
    if args.json:
        json.dump(sim, open(args.json, "w"), indent=2); print("wrote", args.json); return
    if sim.get("error"):
        print(sim["error"]); return
    t = sim["terminal"]
    print(f"\nGrowth simulation — {sim['start_value']:,.0f} start, {sim['days']} trading days "
          f"(~{sim['days']/TRADING_DAYS:.1f}y), {sim['method']}, {sim['paths']} paths")
    print(f"  book history: {sim['hist']['days_of_history']} days, "
          f"{sim['hist']['ann_return_pct']}%/yr return, {sim['hist']['ann_vol_pct']}% vol")
    if sim["deposit_monthly"]:
        print(f"  adding ${sim['deposit_monthly']:.0f}/mo -> ${sim['contributed_total']:,.0f} contributed")
    print(f"  ending value:   p5 ${t['p5']:,.0f}  |  p25 ${t['p25']:,.0f}  |  median ${t['p50']:,.0f}"
          f"  |  p75 ${t['p75']:,.0f}  |  p95 ${t['p95']:,.0f}")
    print(f"  median CAGR {sim['expected_cagr_pct']}%  ·  chance of a loss {sim['prob_loss_pct']}%"
          f"  ·  chance down >20% {sim['prob_down_20_pct']}%  ·  typical worst dip {sim['median_max_drawdown_pct']}%")


if __name__ == "__main__":
    main()

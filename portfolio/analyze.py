#!/usr/bin/env python3
"""
Read data/portfolio/snapshot.json and write a full portfolio analysis:
concentration, sector/factor exposure, winners and losers, realized track record,
trading cadence and churn, and a benchmark replay (your actual trades vs. dollar-cost
averaging the same money into VOO). Ends with a concrete, rule-based action list.

    python -m portfolio.analyze                       # reads the default snapshot
    python -m portfolio.analyze --benchmark VOO -o reports/portfolio_analysis.md

Runs on your machine so it uses your full trade history. Nothing is sent anywhere.
"""
from __future__ import annotations

import argparse
import json
import os
import statistics
import sys
from collections import defaultdict
from datetime import date, datetime

from .backtest import fmt_money, fmt_pct


def _d(s):
    return datetime.strptime(str(s)[:10], "%Y-%m-%d").date()


def load(path):
    with open(path, encoding="utf-8") as fh:
        return json.load(fh)


def concentration(holdings, equity):
    rows = sorted([h for h in holdings if h.get("market_value", 0) > 0],
                  key=lambda h: -h["market_value"])
    weights = [h["market_value"] / equity for h in rows] if equity else []
    hhi = sum(w * w for w in weights)
    eff_n = 1 / hhi if hhi else 0
    top1 = weights[0] * 100 if weights else 0
    top3 = sum(weights[:3]) * 100
    return rows, {"hhi": hhi, "effective_holdings": eff_n, "top1_pct": top1, "top3_pct": top3,
                  "n_positions": len(rows)}


# Rough sector buckets for common ETFs (Robinhood tags single stocks but not always ETFs).
ETF_BUCKET = {"VOO": "US large-cap index", "SPY": "US large-cap index", "IVV": "US large-cap index",
              "VTI": "US total market", "QQQ": "Nasdaq-100 (tech-heavy)", "XLV": "Health care sector",
              "XLE": "Energy sector", "XLF": "Financials sector", "XLK": "Technology sector",
              "HACK": "Cybersecurity (tech)", "SMH": "Semiconductors", "SOXX": "Semiconductors",
              "XLI": "Industrials sector", "SCHD": "Dividend equity", "VXUS": "International equity"}
TECH_LIKE = {"Technology", "Semiconductors", "Communication Services"}
SEMIS = {"MU", "NVDA", "AVGO", "AMD", "INTC", "TSM", "QCOM", "ASML", "SMH", "SOXX", "ARM", "TXN"}


def exposures(holdings, equity):
    sector = defaultdict(float)
    tech = semi = single = 0.0
    for h in holdings:
        mv = h.get("market_value", 0)
        if mv <= 0:
            continue
        sym, sec = h["symbol"], h.get("sector")
        if sym in ETF_BUCKET:
            bucket = ETF_BUCKET[sym]
            sector[bucket] += mv
            if "tech" in bucket.lower() or "Semiconductor" in bucket or "Nasdaq" in bucket:
                tech += mv
            if "Semiconductor" in bucket:
                semi += mv
        else:
            single += mv
            sector[sec or "Other"] += mv
            if sec in TECH_LIKE:
                tech += mv
        if sym in SEMIS:
            semi += mv
    return ({k: v / equity * 100 for k, v in sorted(sector.items(), key=lambda x: -x[1])},
            {"tech_pct": tech / equity * 100, "semi_pct": semi / equity * 100,
             "single_stock_pct": single / equity * 100, "etf_pct": (equity - single) / equity * 100})


def cadence(trades, transfers, equity):
    if not trades:
        return {}
    ds = sorted(_d(t["date"]) for t in trades)
    span_days = max(1, (ds[-1] - ds[0]).days)
    months = max(1, span_days / 30.44)
    buys = [t for t in trades if t["side"].lower().startswith("b") and not str(t.get("note", "")).startswith("reconciled")]
    sells = [t for t in trades if not t["side"].lower().startswith("b")]
    bought = sum(float(t["qty"]) * float(t["price"]) for t in buys)
    sold = sum(float(t["qty"]) * float(t["price"]) for t in sells)
    deposits = sum(float(x["amount"]) for x in (transfers or []))
    return {"fills": len(trades), "buys": len(buys), "sells": len(sells), "first": ds[0].isoformat(),
            "last": ds[-1].isoformat(), "months": months, "fills_per_month": len(trades) / months,
            "bought": bought, "sold": sold, "net_deposits": deposits,
            "turnover_x": bought / equity if equity else 0}


def benchmark_replay(snap, bench):
    """Actual trades TWR vs DCA of the same net contributions into `bench`."""
    try:
        from .backtest import replay, run, period_starts, LABELS
        from .prices import load_prices
    except Exception as e:  # noqa: BLE001
        return {"error": str(e)}
    trades = snap.get("trades") or []
    if not trades:
        return {"error": "no trades"}
    syms = sorted({t["symbol"] for t in trades})
    start = min(t["date"] for t in trades)
    pbs = {}
    for s in syms + [bench]:
        try:
            pbs[s] = load_prices(s, start, quiet=True)
        except Exception:  # noqa: BLE001
            pass
    tradeable = [t for t in trades if t["symbol"] in pbs]
    if not tradeable or bench not in pbs:
        return {"error": f"missing prices (have {sorted(pbs)})"}
    actual = replay(tradeable, pbs, snap.get("dividends"))
    # net dollars the user put to work = buys - sells; DCA that monthly into the benchmark
    net_invested = actual["contributed"]
    bench_prices = [p for p in pbs[bench] if p[0] >= start]
    n_m = len(period_starts([d for d, _ in bench_prices], "M"))
    per = net_invested / max(1, n_m)
    dca = run(bench_prices, "dca", per, "M", lump_total=net_invested)
    lump = run(bench_prices, "lump_sum", per, "M", lump_total=net_invested)
    return {"actual": actual, "bench_dca": dca, "bench_lump": lump, "benchmark": bench,
            "net_invested": net_invested, "months": n_m}


def report(snap, bench="VOO"):
    s = snap["summary"]
    equity = s["equity"]
    holdings = snap["holdings"]
    rows, conc = concentration(holdings, equity)
    sect, exp = exposures(holdings, equity)
    cad = cadence(snap.get("trades", []), snap.get("transfers"), equity)
    closed = snap.get("closed", [])
    ret = snap.get("returns", {})
    L = []
    L.append(f"# Portfolio analysis")
    L.append(f"\n*{snap.get('source','')}. As of {snap.get('as_of','')[:16].replace('T',' ')}. "
             f"Equity {fmt_money(equity)} across {conc['n_positions']} positions.*\n")

    # 1. headline
    L.append("## 1. Where you stand")
    if ret:
        order = [("1D", "Past day"), ("1W", "Past week"), ("1M", "Past month"), ("3M", "Past 3 months"),
                 ("YTD", "Year to date"), ("1Y", "Past year"), ("All", "All time")]
        L.append("\n| Period | Return (time-weighted) |\n|---|---:|")
        for k, lab in order:
            if k in ret:
                L.append(f"| {lab} | {fmt_pct(ret[k]['pct'], 2, sign=True)} |")
    L.append(f"\n- Market value {fmt_money(s['market_value'])}, cost basis {fmt_money(s['cost_basis'])}, "
             f"cash {fmt_money(s['cash'])}.")
    L.append(f"- Unrealized {fmt_money(s['unrealized'])} ({fmt_pct(s['unrealized_pct'],2,True)}), "
             f"realized to date {fmt_money(s['realized'])}, dividends {fmt_money(s.get('dividends',0))}.")

    # 2. concentration
    L.append("\n## 2. Concentration and diversification")
    L.append(f"\n- Largest position is **{rows[0]['symbol']} at {conc['top1_pct']:.1f}%**; "
             f"top three are **{conc['top3_pct']:.1f}%** of the account.")
    L.append(f"- Effective number of holdings is **{conc['effective_holdings']:.1f}** "
             f"(you hold {conc['n_positions']}, but weighting concentrates them).")
    flags = []
    if conc["top1_pct"] > 25:
        flags.append(f"{rows[0]['symbol']} alone is over a quarter of the account; a bad quarter there moves everything.")
    if conc["top3_pct"] > 55:
        flags.append("the top three are more than half the account.")
    L.append("- " + (" ".join("**Risk:** " + f for f in flags) if flags else "No single position dominates the account."))
    L.append("\n| Position | Weight | Market value | Avg cost | Price | Unrealized | vs avg cost |\n|---|---:|---:|---:|---:|---:|---:|")
    for h in rows:
        L.append(f"| {h['symbol']} | {h['market_value']/equity*100:.1f}% | {fmt_money(h['market_value'])} | "
                 f"{fmt_money(h['avg_cost'])} | {fmt_money(h['price'])} | {fmt_money(h['unrealized'])} | "
                 f"{fmt_pct(h['unrealized_pct'],1,True)} |")

    # 3. exposure
    L.append("\n## 3. What you are actually betting on")
    L.append(f"\n- **Technology / semiconductors:** about **{exp['tech_pct']:.0f}%** of the account leans tech, "
             f"of which **{exp['semi_pct']:.0f}%** is semiconductors specifically (the most cyclical corner of tech).")
    L.append(f"- **Single stocks vs funds:** {exp['single_stock_pct']:.0f}% in individual stocks, "
             f"{exp['etf_pct']:.0f}% in ETFs/index funds.")
    L.append("\n| Bucket | Weight |\n|---|---:|")
    for k, v in sect.items():
        L.append(f"| {k} | {v:.1f}% |")

    # 4. winners / losers
    L.append("\n## 4. Winners and losers right now")
    win = [h for h in rows if h["unrealized"] > 0]
    los = [h for h in rows if h["unrealized"] < 0]
    L.append("\n**Working:** " + (", ".join(f"{h['symbol']} {fmt_pct(h['unrealized_pct'],1,True)}" for h in sorted(win, key=lambda x:-x['unrealized_pct'])) or "none"))
    L.append("\n**Underwater:** " + (", ".join(f"{h['symbol']} {fmt_pct(h['unrealized_pct'],1,True)}" for h in sorted(los, key=lambda x:x['unrealized_pct'])) or "none"))

    # 5. realized track record
    if closed:
        wins = [c for c in closed if c.get("realized_avg", 0) > 0]
        L.append("\n## 5. Your realized track record (closed positions)")
        tot = sum(c.get("realized_avg", 0) for c in closed)
        L.append(f"\n- Closed **{len(closed)}** positions for a net realized **{fmt_money(tot)}**; "
                 f"**{len(wins)}/{len(closed)}** were winners ({len(wins)/len(closed)*100:.0f}% win rate).")
        L.append("\n| Symbol | Invested | Proceeds | Realized | Return |\n|---|---:|---:|---:|---:|")
        for c in sorted(closed, key=lambda x: x.get("realized_avg", 0)):
            inv = c.get("invested", 0)
            L.append(f"| {c['symbol']} | {fmt_money(inv)} | {fmt_money(c.get('proceeds',0))} | "
                     f"{fmt_money(c.get('realized_avg',0))} | {fmt_pct(c.get('realized_avg',0)/inv*100 if inv else 0,1,True)} |")

    # 6. trading behaviour
    if cad:
        L.append("\n## 6. How you have been trading")
        L.append(f"\n- **{cad['fills']} fills** between {cad['first']} and {cad['last']} "
                 f"(~**{cad['fills_per_month']:.1f} trades per month**).")
        L.append(f"- Bought {fmt_money(cad['bought'])}, sold {fmt_money(cad['sold'])}, "
                 f"on net deposits of {fmt_money(cad['net_deposits'])}.")
        L.append(f"- **Turnover ~{cad['turnover_x']:.1f}x** the account value: you have cycled roughly "
                 f"{cad['turnover_x']:.1f} times your balance through trades.")
        if cad["turnover_x"] > 1.5 or cad["fills_per_month"] > 6:
            L.append("- **Read:** that is a lot of activity for this size of account. High turnover on a small "
                     "taxable account is where returns quietly leak: every sell can realize a loss or a taxable "
                     "gain, and the evidence is overwhelming that frequent trading lowers returns for individuals.")

    # 7. benchmark replay
    L.append("\n## 7. Your trades vs. just buying the index")
    br = benchmark_replay(snap, bench)
    if br.get("error"):
        L.append(f"\n*(Could not run the replay: {br['error']}. It needs price history; re-run after a sync so "
                 f"prices are cached.)*")
    else:
        a, d, l = br["actual"], br["bench_dca"], br["bench_lump"]
        L.append(f"\nYou put **{fmt_money(br['net_invested'])}** to work over ~{br['months']} months. Here is how your "
                 f"actual timing did against simply feeding the same money into {bench}:")
        L.append("\n| Approach | Final value | Money-weighted return | Max drawdown |\n|---|---:|---:|---:|")
        L.append(f"| **Your actual trades** | {fmt_money(a['final_value'])} | {fmt_pct(a['xirr_pct'],1)} | {fmt_pct(a['max_drawdown_pct'],1)} |")
        L.append(f"| DCA the same $ into {bench} monthly | {fmt_money(d['final_value'])} | {fmt_pct(d['xirr_pct'],1)} | {fmt_pct(d['max_drawdown_pct'],1)} |")
        L.append(f"| Lump the same $ into {bench} day one | {fmt_money(l['final_value'])} | {fmt_pct(l['xirr_pct'],1)} | {fmt_pct(l['max_drawdown_pct'],1)} |")
        gap = a["final_value"] - d["final_value"]
        if gap >= 0:
            L.append(f"\n**Your picking and timing added about {fmt_money(gap)} versus a plain {bench} plan.** Keep what works, but see the rules below before sizing up.")
        else:
            L.append(f"\n**A plain {bench} plan would have left you about {fmt_money(-gap)} richer** for the same money and less risk. "
                     f"That is the single most important number here: your activity has cost you, and the fix is mechanical, not emotional.")

    # 8. recommendations
    L.append("\n## 8. A plan sized to this account")
    L += build_reco(rows, conc, exp, cad, equity, bench)
    L.append("\n---\n*Analysis only, not investment advice. Numbers are rebuilt from your own Robinhood order history.*")
    return "\n".join(L) + "\n"


def build_reco(rows, conc, exp, cad, equity, bench):
    r = []
    r.append(f"\n1. **Keep a broad-index core and make it the default.** Your {bench} position is the healthiest thing "
             f"in the account. New money should go here first unless you have a specific reason otherwise. A simple "
             f"target: at least half the account in {bench} or similar.")
    if conc["top1_pct"] > 20:
        r.append(f"2. **Cap any single stock at ~10-15%.** {rows[0]['symbol']} is {conc['top1_pct']:.0f}% today. "
                 f"You do not have to sell into a loss; you can freeze it and let new deposits into the core shrink "
                 f"its weight over time.")
    if exp["semi_pct"] > 20:
        r.append(f"3. **Dial down the semiconductor cluster.** ~{exp['semi_pct']:.0f}% in semis (MU, NVDA, AVGO and the "
                 f"like) means one industry cycle drives your whole result. Memory and chip names move together; treat "
                 f"them as one bet, not several, and keep that bet under ~20% combined.")
    if cad and (cad["turnover_x"] > 1.5 or cad["fills_per_month"] > 6):
        r.append("4. **Slow down.** Set a rule: buys on a schedule (say the 1st of the month), and no selling a "
                 "position at a loss inside 30 days of buying it. Most of your realized losses come from round-trips "
                 "that a cooling-off rule would have prevented.")
    r.append("5. **Write the rule down and let the tool grade you.** Pick a contribution (even $50-100/month), a core "
             "target, and a max single-stock size. The dashboard's replay and the backtest tab will then show, in "
             "dollars, whether sticking to it beats what you did before.")
    r.append("6. **Use the safest edge you actually have: contributions and time.** On a ~$3k account, adding "
             "$100/month is a far bigger lever than any stock pick. Automate the deposit; let compounding and the "
             "index do the heavy lifting while you learn.")
    return r


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--snapshot", default=os.path.join("data", "portfolio", "snapshot.json"))
    ap.add_argument("--benchmark", default="VOO")
    ap.add_argument("-o", "--out", default=None)
    args = ap.parse_args(argv)
    if not os.path.exists(args.snapshot):
        sys.exit(f"{args.snapshot} not found. Run `python -m portfolio.robinhood_sync` first.")
    snap = load(args.snapshot)
    body = report(snap, args.benchmark)
    out = args.out or os.path.join("reports", f"portfolio_analysis_{date.today().isoformat()}.md")
    os.makedirs(os.path.dirname(out), exist_ok=True)
    with open(out, "w", encoding="utf-8") as fh:
        fh.write(body)
    print(body)
    print(f"\nwrote {out}", file=sys.stderr)


if __name__ == "__main__":
    main()

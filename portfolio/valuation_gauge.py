#!/usr/bin/env python3
"""
Margin of safety: is a stock cheap, fairly priced, or expensive? Combines SEC-EDGAR fundamentals
(portfolio.edgar) with the cached price to value each holding three ways and report the discount.

    python -m portfolio.valuation_gauge MU NVDA AAPL
    python -m portfolio.valuation_gauge --portfolio -o reports/valuation.md

Lenses: (1) earnings — median historical P/E x latest EPS; (2) free cash flow yield vs a fair yield;
(3) book value (P/B). Margin of safety = fair value / price - 1. Cheap > +20%, expensive < -20%.
Fundamentals are from filings, not YCharts, so treat these as directional, not to the decimal.
"""
from __future__ import annotations

import argparse
import json
import os
import statistics
import sys
from datetime import date

from .backtest import fmt_money, fmt_pct

FUND = os.path.join("data", "fundamentals")


def _load_fund(ticker):
    p = os.path.join(FUND, f"{ticker.upper()}.json")
    if not os.path.exists(p):
        return None
    return json.load(open(p, encoding="utf-8"))


def _price_now(ticker):
    from .prices import load_prices
    try:
        rows = load_prices(ticker, "2015-01-01", quiet=True)
        return rows[-1][1], dict(rows)
    except Exception:  # noqa: BLE001
        return None, {}


def gauge(ticker: str) -> dict:
    f = _load_fund(ticker)
    if not f:
        return {"ticker": ticker, "error": "no EDGAR fundamentals — run: python -m portfolio.edgar " + ticker}
    price, px_by_date = _price_now(ticker)
    if not price:
        return {"ticker": ticker, "error": "no price history"}
    annual = [a for a in f.get("annual", []) if a.get("eps")]
    latest = annual[-1] if annual else {}
    eps = latest.get("eps")
    shares = latest.get("shares")
    equity = latest.get("equity")
    fcf = latest.get("fcf")
    lenses = {}

    # 1) earnings: median historical P/E (year-end price / that year's eps) x latest eps
    pes = []
    for a in annual:
        yr_end = f"{a['fy']}-12-31"
        # nearest price on/around fiscal year end
        cand = [d for d in px_by_date if d[:4] == str(a["fy"])]
        if cand and a["eps"] and a["eps"] > 0:
            yp = px_by_date[max(cand)]
            pes.append(yp / a["eps"])
    if pes and eps and eps > 0:
        med_pe = statistics.median(pes)
        fair = med_pe * eps
        lenses["earnings"] = {"fair": fair, "median_pe": med_pe, "current_pe": price / eps,
                              "margin_pct": (fair / price - 1) * 100}

    # 2) FCF yield: fair value where FCF yield = 5% (i.e., 20x FCF)
    if fcf and shares and fcf > 0:
        fcf_ps = fcf / shares
        fair_fcf = fcf_ps / 0.05
        lenses["fcf"] = {"fair": fair_fcf, "fcf_per_share": fcf_ps, "fcf_yield_pct": fcf_ps / price * 100,
                         "margin_pct": (fair_fcf / price - 1) * 100}

    # 3) book value
    if equity and shares and shares > 0:
        bvps = equity / shares
        lenses["book"] = {"bvps": bvps, "pb": price / bvps if bvps else None,
                          "margin_pct": (bvps / price - 1) * 100}

    margins = [l["margin_pct"] for l in lenses.values() if "margin_pct" in l]
    # weight earnings and fcf more than book for going concerns
    w = {"earnings": 0.45, "fcf": 0.4, "book": 0.15}
    num = sum(l["margin_pct"] * w.get(k, 0.2) for k, l in lenses.items() if "margin_pct" in l)
    den = sum(w.get(k, 0.2) for k in lenses if "margin_pct" in lenses[k])
    blended = num / den if den else (statistics.fmean(margins) if margins else None)
    verdict = ("Cheap" if blended is not None and blended > 20 else
               "Expensive" if blended is not None and blended < -20 else
               "Fair" if blended is not None else "Insufficient data")
    return {"ticker": ticker.upper(), "price": price, "eps": eps, "lenses": lenses,
            "blended_margin_pct": blended, "verdict": verdict,
            "fiscal_years": len(annual), "as_of": f.get("as_of")}


def report(results):
    L = ["# Margin of safety\n", f"*From SEC-EDGAR filings + cached prices, {date.today().isoformat()}. "
         "Directional, not to the decimal. Not investment advice.*\n",
         "| Ticker | Price | Verdict | Blended margin | Earnings (fair / P·E) | FCF yield | P/B |",
         "|---|---:|---|---:|---:|---:|---:|"]
    for r in results:
        if r.get("error"):
            L.append(f"| {r['ticker']} | -- | {r['error']} | -- | -- | -- | -- |"); continue
        e = r["lenses"].get("earnings", {}); fc = r["lenses"].get("fcf", {}); bk = r["lenses"].get("book", {})
        L.append(f"| {r['ticker']} | {fmt_money(r['price'])} | **{r['verdict']}** | "
                 f"{fmt_pct(r['blended_margin_pct'],0,True) if r['blended_margin_pct'] is not None else '--'} | "
                 f"{fmt_money(e['fair']) + ' / ' + format(e['current_pe'],'.1f') + 'x' if e else '--'} | "
                 f"{fmt_pct(fc['fcf_yield_pct'],1) if fc else '--'} | "
                 f"{format(bk['pb'],'.1f')+'x' if bk.get('pb') else '--'} |")
    return "\n".join(L) + "\n"


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("tickers", nargs="*")
    ap.add_argument("--portfolio", action="store_true")
    ap.add_argument("-o", "--out")
    args = ap.parse_args(argv)
    tickers = list(args.tickers)
    if args.portfolio:
        from ycharts_export.api import portfolio_tickers
        tickers += portfolio_tickers()
    tickers = sorted(set(t.upper() for t in tickers))
    results = [gauge(t) for t in tickers]
    body = report(results)
    if args.out:
        os.makedirs(os.path.dirname(args.out) or ".", exist_ok=True)
        open(args.out, "w", encoding="utf-8").write(body); print(f"wrote {args.out}")
    else:
        print(body)


if __name__ == "__main__":
    main()

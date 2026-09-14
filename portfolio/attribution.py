#!/usr/bin/env python3
"""
Return attribution: how much of a move was the market, the sector, earnings, or something the
fundamentals don't explain — the "sentiment/inefficiency" residual.

The Efficient Market Hypothesis says a stock already prices in everything known, so a day's move
should be explained by (a) the market, (b) the sector, and (c) genuinely new information landing
that day (an earnings surprise, a macro print). We approximate that with a two-factor model fit on
a trailing window:

    r_stock ≈ alpha + beta_mkt · r_market + beta_sec · r_sector + residual

- The part explained by beta·market and beta·sector is the "efficient / already-priced" component.
- On an earnings day, the residual is tagged as the earnings reaction (new information — still EMH).
- A large residual on a non-earnings day is the interesting part. If dated news sentiment lines up
  with its sign, it's information/sentiment being absorbed (semi-strong EMH in action, or an
  overreaction). If there's no news at all, it's flow/positioning — the least "efficient" move.

We roll this up into two portfolio-level readings: an EFFICIENCY score (share of variance the
factors explain) and a SENTIMENT tilt (how strongly residuals track news sentiment). Everything is
stdlib OLS via normal equations; unit-tested on synthetic factor data.

    python -m portfolio.attribution NVDA        # explain the latest big day + the rolling gauge
"""
from __future__ import annotations

import json
import statistics
import sys
from datetime import date

from . import events as events_mod
from .prices import load_prices


def _aligned_returns(*series):
    """Daily simple returns for each price series, aligned on their common dates. -> (dates, [rets...])."""
    dicts = [dict(s) for s in series]
    common = sorted(set.intersection(*[set(d) for d in dicts]))
    rets = [[] for _ in series]
    dates = []
    for i in range(1, len(common)):
        d0, d1 = common[i - 1], common[i]
        ok = all(dd[d0] > 0 for dd in dicts)
        if not ok:
            continue
        dates.append(d1)
        for k, dd in enumerate(dicts):
            rets[k].append(dd[d1] / dd[d0] - 1)
    return dates, rets


def _ols(y, X):
    """Ordinary least squares with intercept. X is list of columns. Returns (coeffs incl intercept, r2)."""
    n = len(y)
    cols = [[1.0] * n] + X  # intercept first
    p = len(cols)
    # normal equations (X'X) b = X'y
    XtX = [[sum(cols[i][k] * cols[j][k] for k in range(n)) for j in range(p)] for i in range(p)]
    Xty = [sum(cols[i][k] * y[k] for k in range(n)) for i in range(p)]
    b = _solve(XtX, Xty)
    if b is None:
        return None, None
    yhat = [sum(b[i] * cols[i][k] for i in range(p)) for k in range(n)]
    ybar = statistics.fmean(y)
    ss_tot = sum((yi - ybar) ** 2 for yi in y)
    ss_res = sum((y[k] - yhat[k]) ** 2 for k in range(n))
    r2 = 1 - ss_res / ss_tot if ss_tot else None
    return b, r2


def _solve(A, b):
    """Gaussian elimination for a small symmetric system."""
    n = len(A)
    M = [row[:] + [b[i]] for i, row in enumerate(A)]
    for c in range(n):
        piv = max(range(c, n), key=lambda r: abs(M[r][c]))
        if abs(M[piv][c]) < 1e-12:
            return None
        M[c], M[piv] = M[piv], M[c]
        pv = M[c][c]
        M[c] = [x / pv for x in M[c]]
        for r in range(n):
            if r != c and abs(M[r][c]) > 1e-15:
                f = M[r][c]
                M[r] = [M[r][k] - f * M[c][k] for k in range(n + 1)]
    return [M[i][n] for i in range(n)]


def loadings(stock_rows, market_rows, sector_rows=None, window=252):
    """Fit beta_mkt (and beta_sec if a sector series is given) on the trailing window."""
    series = [stock_rows, market_rows] + ([sector_rows] if sector_rows else [])
    dates, rets = _aligned_returns(*series)
    if len(dates) < 40:
        return None
    y = rets[0][-window:]
    X = [rets[1][-window:]] + ([rets[2][-window:]] if sector_rows else [])
    b, r2 = _ols(y, X)
    if b is None:
        return None
    out = {"alpha": b[0], "beta_mkt": b[1], "r2": r2, "n": len(y)}
    if sector_rows:
        out["beta_sec"] = b[2]
    return out


def explain_day(d, stock_rows, market_rows, sector_rows, load, timeline=None):
    """Decompose one day's stock return into market / sector / earnings / residual components."""
    px, mx = dict(stock_rows), dict(market_rows)
    sx = dict(sector_rows) if sector_rows else {}
    def ret(dd, day):
        ks = sorted(k for k in dd if k <= day)
        if len(ks) < 2 or ks[-1] != day:
            return None
        return dd[ks[-1]] / dd[ks[-2]] - 1
    r = ret(px, d); m = ret(mx, d); s = ret(sx, d) if sx else None
    if r is None or m is None:
        return None
    mkt_c = (load.get("beta_mkt", 1.0)) * m
    sec_c = (load.get("beta_sec", 0.0)) * s if (s is not None and "beta_sec" in load) else 0.0
    resid = r - mkt_c - sec_c
    day_evs = (timeline or {}).get("by_date", {}).get(d, [])
    is_earnings = any(e["type"] == "earnings" for e in day_evs)
    news = [e for e in day_evs if e["type"] == "news"]
    news_sent = round(statistics.fmean([e["sentiment"] for e in news]), 3) if news else None
    # classify the day
    if is_earnings:
        kind = "earnings — new information (EMH: priced on the print)"
    elif abs(resid) < abs(mkt_c) + abs(sec_c):
        kind = "market/sector — largely already priced (efficient)"
    elif news_sent is not None and (news_sent > 0) == (resid > 0) and abs(news_sent) > 0.1:
        kind = "news-driven — information being absorbed"
    elif news:
        kind = "news present but move disagrees — possible overreaction"
    else:
        kind = "unexplained — flow/positioning/sentiment (least efficient)"
    return {"date": d, "ret_pct": round(r * 100, 2),
            "components_pct": {"market": round(mkt_c * 100, 2), "sector": round(sec_c * 100, 2),
                               "residual": round(resid * 100, 2)},
            "explained_share": round((abs(mkt_c) + abs(sec_c)) / (abs(r) + 1e-9), 2),
            "is_earnings": is_earnings, "news_sentiment": news_sent, "classification": kind,
            "news": [{"title": e["detail"], "sentiment": e.get("sentiment"), "link": e.get("link")} for e in news]}


def gauge(stock_rows, market_rows, sector_rows, load, timeline, window=120):
    """
    Rolling readings over the last `window` trading days:
      efficiency = factor R² (share of variance the market+sector explain)
      sentiment_tilt = correlation between daily residual and that day's news sentiment
      unexplained_days = count of |residual| > |explained| with no news (pure flow)
    """
    dates, rets = _aligned_returns(stock_rows, market_rows, *([sector_rows] if sector_rows else []))
    dates, rets = dates[-window:], [c[-window:] for c in rets]
    if len(dates) < 30:
        return {"error": "not enough overlapping history"}
    resid, sset = [], []
    ds = timeline.get("day_sentiment", {})
    for i, d in enumerate(dates):
        mkt_c = load.get("beta_mkt", 1.0) * rets[1][i]
        sec_c = load.get("beta_sec", 0.0) * rets[2][i] if sector_rows else 0.0
        rr = rets[0][i] - mkt_c - sec_c
        resid.append((d, rr, rets[0][i], mkt_c + sec_c))
    pairs = [(r, ds[d]) for d, r, _, _ in resid if d in ds]
    tilt = None
    if len(pairs) >= 8:
        rs = [p[0] for p in pairs]; ss = [p[1] for p in pairs]
        sr, ssd = statistics.pstdev(rs), statistics.pstdev(ss)
        if sr and ssd:
            mr, ms = statistics.fmean(rs), statistics.fmean(ss)
            tilt = round(sum((rs[i] - mr) * (ss[i] - ms) for i in range(len(rs))) / len(rs) / (sr * ssd), 2)
    unexplained = sum(1 for d, r, tot, expl in resid if abs(r) > abs(expl) and d not in ds)
    return {"efficiency_r2": round(load.get("r2") or 0, 2), "beta_mkt": round(load.get("beta_mkt", 0), 2),
            "beta_sec": round(load["beta_sec"], 2) if "beta_sec" in load else None,
            "sentiment_tilt": tilt, "unexplained_days": unexplained, "window": len(dates),
            "residual_vol_pct": round(statistics.pstdev([r for _, r, _, _ in resid]) * 100, 2),
            "interpretation": _interpret(load.get("r2") or 0, tilt, unexplained, len(dates))}


def _interpret(r2, tilt, unexplained, n):
    parts = []
    parts.append(f"The market and sector explain about {round(r2 * 100)}% of the day-to-day variance — "
                 + ("most moves are already priced (efficient)." if r2 > 0.5 else
                    "a lot of the action is stock-specific, not the market." if r2 > 0.25 else
                    "very little is the market; this name trades on its own story."))
    if tilt is not None:
        parts.append("News sentiment " + ("lines up with the unexplained moves — information is being absorbed."
                     if tilt > 0.2 else "runs opposite the moves — signs of fading/overreaction."
                     if tilt < -0.2 else "barely relates to the moves — headlines aren't what's driving it."))
    if unexplained:
        parts.append(f"{unexplained} of the last {n} days moved on no news and beyond what the market did — "
                     "pure flow/positioning, the least efficient kind of move.")
    return " ".join(parts)


def build(ticker, sector=None, start="2019-01-01", quiet=True):
    ticker = ticker.upper()
    stock = load_prices(ticker, start, quiet=quiet)
    market = load_prices("SPY", start, quiet=quiet)
    sec_rows = None
    if sector:
        try:
            sec_rows = load_prices(sector, start, quiet=quiet)
        except Exception:  # noqa: BLE001
            sec_rows = None
    load = loadings(stock, market, sec_rows)
    tl = events_mod.load_cached(ticker) or events_mod.build(ticker, start, quiet=quiet)
    if not load:
        return {"ticker": ticker, "error": "insufficient history for a factor fit"}
    g = gauge(stock, market, sec_rows, load, tl)
    # explain the most recent unusual day
    moves = sorted([e for e in tl["events"] if e["type"] == "move"], key=lambda e: e["date"])
    recent = explain_day(moves[-1]["date"], stock, market, sec_rows, load, tl) if moves else None
    return {"ticker": ticker, "as_of": date.today().isoformat(), "sector": sector,
            "loadings": load, "gauge": g, "recent_big_day": recent}


if __name__ == "__main__":
    tk = sys.argv[1] if len(sys.argv) > 1 else "NVDA"
    sec = sys.argv[2] if len(sys.argv) > 2 else None
    r = build(tk, sec, quiet=False)
    print(json.dumps(r, indent=2))

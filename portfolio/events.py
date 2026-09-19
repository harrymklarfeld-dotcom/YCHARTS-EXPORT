#!/usr/bin/env python3
"""
A dated event timeline for a ticker — the data behind "click a day on the chart and see exactly
what happened." For each security we merge:

  - earnings dates + EPS estimate/actual/surprise   (yfinance get_earnings_dates)
  - dividends and stock splits                       (yfinance)
  - statistically unusual move days                  (daily return z-score vs a trailing window)
  - dated news headlines, each sentiment-scored      (yfinance get_news + portfolio.sentiment)

The core `assemble()` is pure and unit-tested; the yfinance fetchers are thin and degrade to
empty on any failure, so the timeline always builds from whatever is available (at minimum the
price-derived unusual-move days).

    python -m portfolio.events NVDA        # build + cache the timeline, print the big days
"""
from __future__ import annotations

import json
import os
import statistics
import sys
from datetime import date, datetime

from . import sentiment
from .prices import load_prices

CACHE = os.path.join("data", "events")


def _iso(d):
    if isinstance(d, str):
        return d[:10]
    if hasattr(d, "date"):
        return d.date().isoformat()
    if hasattr(d, "isoformat"):
        return d.isoformat()[:10]
    return str(d)[:10]


def unusual_moves(rows, z=2.0, window=60):
    """Days whose one-day return is a `z`-sigma outlier vs the trailing `window` of returns."""
    out = []
    rets = [(rows[i][0], rows[i][1] / rows[i - 1][1] - 1) for i in range(1, len(rows)) if rows[i - 1][1] > 0]
    for i in range(window, len(rets)):
        hist = [r for _, r in rets[i - window:i]]
        sd = statistics.pstdev(hist)
        mu = statistics.fmean(hist)
        d, r = rets[i]
        zsc = (r - mu) / sd if sd else 0.0
        if abs(zsc) >= z:
            out.append({"date": d, "ret_pct": round(r * 100, 2), "z": round(zsc, 1)})
    return out


def from_yf_earnings(ticker):
    import yfinance as yf
    t = yf.Ticker(ticker)
    df = t.get_earnings_dates(limit=24)
    if df is None or getattr(df, "empty", True):
        return []
    out = []
    for idx, row in df.iterrows():
        est = row.get("EPS Estimate"); act = row.get("Reported EPS"); sur = row.get("Surprise(%)")
        out.append({"date": _iso(idx),
                    "eps_estimate": None if est is None or est != est else float(est),
                    "eps_actual": None if act is None or act != act else float(act),
                    "surprise_pct": None if sur is None or sur != sur else round(float(sur), 1)})
    return out


def from_yf_corporate(ticker):
    import yfinance as yf
    t = yf.Ticker(ticker)
    ev = []
    try:
        for d, v in (t.dividends or {}).items():
            ev.append({"date": _iso(d), "type": "dividend", "amount": float(v)})
    except Exception:  # noqa: BLE001
        pass
    try:
        for d, v in (t.splits or {}).items():
            if v:
                ev.append({"date": _iso(d), "type": "split", "ratio": float(v)})
    except Exception:  # noqa: BLE001
        pass
    return ev


def from_yf_news(ticker):
    import yfinance as yf
    t = yf.Ticker(ticker)
    try:
        raw = t.get_news() if hasattr(t, "get_news") else (t.news or [])
    except Exception:  # noqa: BLE001
        raw = []
    out = []
    for it in raw:
        c = it.get("content", it) if isinstance(it, dict) else {}
        title = c.get("title") or it.get("title")
        if not title:
            continue
        d = c.get("pubDate") or it.get("providerPublishTime")
        if isinstance(d, (int, float)):
            d = datetime.utcfromtimestamp(d).isoformat()
        prov = c.get("provider", {}) if isinstance(c, dict) else {}
        out.append({"date": _iso(d), "title": title,
                    "publisher": (prov.get("displayName") if isinstance(prov, dict) else None) or it.get("publisher"),
                    "link": (c.get("canonicalUrl", {}) or {}).get("url") if isinstance(c.get("canonicalUrl"), dict) else it.get("link")})
    return out


def assemble(rows, earnings=None, corporate=None, news=None, z=2.0):
    """
    Merge all sources into one timeline and a per-date index. Pure — no network — so it's the
    unit-test surface. Each news item gets a sentiment score; earnings get a surprise label.
    """
    px = dict(rows)
    dates = [d for d, _ in rows]
    def ret_on(d):
        i = dates.index(d) if d in px else None
        if i and i > 0:
            return round((rows[i][1] / rows[i - 1][1] - 1) * 100, 2)
        return None

    events = []
    for e in earnings or []:
        sur = e.get("surprise_pct")
        events.append({"date": e["date"], "type": "earnings",
                       "detail": ("EPS " + (f"${e['eps_actual']}" if e.get("eps_actual") is not None else "?") +
                                  (f" vs ${e['eps_estimate']} est" if e.get("eps_estimate") is not None else "") +
                                  (f" · {sur:+.1f}% surprise" if sur is not None else "")),
                       "surprise_pct": sur, "ret_pct": ret_on(e["date"])})
    for c in corporate or []:
        if c["type"] == "dividend":
            events.append({"date": c["date"], "type": "dividend", "detail": f"Dividend ${c['amount']:.4f}"})
        else:
            events.append({"date": c["date"], "type": "split", "detail": f"Split {c['ratio']:g}:1"})
    for n in news or []:
        s = sentiment.score(n["title"])
        events.append({"date": n["date"], "type": "news", "detail": n["title"], "publisher": n.get("publisher"),
                       "link": n.get("link"), "sentiment": s["score"], "sentiment_label": sentiment.label(s["score"])})
    for m in unusual_moves(rows, z=z):
        events.append({"date": m["date"], "type": "move", "ret_pct": m["ret_pct"], "z": m["z"],
                       "detail": f"Unusual move {m['ret_pct']:+.1f}% ({m['z']:+.1f}σ)"})

    # index by date
    by_date = {}
    for e in events:
        by_date.setdefault(e["date"], []).append(e)
    # a day's headline sentiment (mean of its news)
    day_sentiment = {}
    for d, evs in by_date.items():
        ns = [e["sentiment"] for e in evs if e["type"] == "news" and e.get("sentiment") is not None]
        if ns:
            day_sentiment[d] = round(statistics.fmean(ns), 3)
    return {"events": sorted(events, key=lambda e: e["date"]), "by_date": by_date,
            "day_sentiment": day_sentiment,
            "counts": {k: sum(1 for e in events if e["type"] == k) for k in ("earnings", "news", "move", "dividend", "split")}}


def build(ticker, start="2019-01-01", quiet=True):
    ticker = ticker.upper()
    rows = load_prices(ticker, start, quiet=quiet)
    earnings, corporate, news = [], [], []
    for name, fn in (("earnings", from_yf_earnings), ("corporate", from_yf_corporate), ("news", from_yf_news)):
        try:
            got = fn(ticker)
            if name == "earnings":
                earnings = got
            elif name == "corporate":
                corporate = got
            else:
                news = got
        except Exception as e:  # noqa: BLE001
            if not quiet:
                print(f"{ticker}: {name} unavailable ({type(e).__name__})", file=sys.stderr)
    tl = assemble(rows, earnings, corporate, news)
    tl["ticker"] = ticker
    tl["as_of"] = date.today().isoformat()
    os.makedirs(CACHE, exist_ok=True)
    with open(os.path.join(CACHE, f"{ticker}.json"), "w", encoding="utf-8") as fh:
        json.dump(tl, fh)
    if not quiet:
        print(f"{ticker}: {len(tl['events'])} events  {tl['counts']}", file=sys.stderr)
    return tl


def load_cached(ticker):
    p = os.path.join(CACHE, f"{ticker.upper()}.json")
    if os.path.exists(p):
        with open(p, encoding="utf-8") as fh:
            return json.load(fh)
    return None


def _print_big(tk, tl):
    big = sorted([e for e in tl["events"] if e["type"] == "move"], key=lambda e: -abs(e["ret_pct"]))[:8]
    print(f"\nBiggest move days for {tk}:")
    for e in big:
        same = [x for x in tl["by_date"][e["date"]] if x["type"] != "move"]
        why = "; ".join(x["detail"] for x in same) or "no news/earnings on file"
        print(f"  {e['date']}  {e['ret_pct']:+6.1f}%  ->  {why}")


def main(argv=None):
    import argparse
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("tickers", nargs="*")
    ap.add_argument("--portfolio", action="store_true", help="build for every holding in the snapshot")
    ap.add_argument("--watchlist", metavar="NAME", help="build for a named watchlist (e.g. sl_model)")
    ap.add_argument("--start", default="2019-01-01")
    args = ap.parse_args(argv)

    syms = list(args.tickers)
    if args.portfolio:
        import json as _json
        p = os.path.join("data", "portfolio", "snapshot.json")
        if os.path.exists(p):
            syms += [h["symbol"] for h in _json.load(open(p, encoding="utf-8")).get("holdings", [])]
    if args.watchlist:
        from .watchlists import tickers as wl_tickers
        syms += wl_tickers(args.watchlist)
    if not syms:
        syms = ["NVDA"]
    for tk in dict.fromkeys(syms):
        try:
            tl = build(tk, args.start, quiet=False)
            if len(syms) == 1:
                _print_big(tk, tl)
        except Exception as e:  # noqa: BLE001
            print(f"{tk}: {type(e).__name__}: {e}", file=sys.stderr)


if __name__ == "__main__":
    main()

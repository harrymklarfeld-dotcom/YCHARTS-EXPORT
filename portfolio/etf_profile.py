#!/usr/bin/env python3
"""
YCharts-style ETF "quote page" data, assembled from free sources and cached as JSON.

For each fund we build one profile dict with the sections a YCharts fund page shows:
price header, key stats, a full risk panel, trailing + calendar returns, performance vs
the S&P and vs a category peer, asset allocation, sector weights, the top 10 holdings,
TTM distributions, recent news, and the strategy/basic-info blurb. A separate `overlap()`
computes holdings overlap between two funds (the shared-weight metric YCharts reports).

Sources (all free, all run on your Mac — the sandbox has no market access):
  - prices / trailing returns / risk  -> portfolio.prices.load_prices (yfinance-backed cache)
  - fund metadata / holdings / sectors -> yfinance Ticker.funds_data + .info + .get_news()
  - distributions                      -> yfinance Ticker.dividends

Everything degrades gracefully: whatever a source can't supply is left null so the page
still renders from the price-derived risk numbers alone.

    python -m portfolio.etf_profile SMH SDCI USFR       # build + cache each profile
    python -m portfolio.etf_profile --all               # every ticker in the S&L model
    python -m portfolio.etf_profile --overlap SMH QQQ    # holdings overlap between two funds
"""
from __future__ import annotations

import argparse
import json
import os
import sys
from datetime import date

from . import riskstats
from .prices import load_prices

CACHE = os.path.join("data", "etf_profiles")
BENCH = "SPY"  # S&P 500 proxy for beta/alpha and "vs S&P" performance

# Category peer used for "performance vs category". Falls back to SPY when a fund
# isn't in this map, which is fine for the equity sleeve.
CATEGORY_PEER = {
    "SMH": "XLK",    # semis vs broad tech
    "QQQ": "SPY",    # large growth vs S&P
    "QDPL": "SPY",
    "PATN": "EFA",   # ex-US growth vs developed intl
    "IAI": "XLF",    # broker-dealers vs financials
    "XAR": "ITA",    # A&D vs the other A&D fund
    "PAVE": "XLI",   # infrastructure vs industrials
    "USAI": "AMLP",  # midstream vs MLPs
    "SDCI": "DBC",   # commodities vs broad commodity peer
    "USFR": "BIL",   # floating T-bills vs 1-3mo bills
    "GLD": "IAU",
}


def _round(x, n=2):
    return round(x, n) if isinstance(x, (int, float)) else x


def _num(x):
    """Coerce anything numeric-ish (numpy/pandas scalars, strings) to float, else None."""
    try:
        if x is None or x == "":
            return None
        return float(x)
    except (TypeError, ValueError):
        return None


def _yf_ticker(sym):
    import yfinance as yf
    return yf.Ticker(sym)


def _price_header(sym, rows):
    """Last / previous close + 52-week range, from live quote when possible, else cache."""
    hdr = {"last": None, "prev_close": None, "change": None, "change_pct": None,
           "year_low": None, "year_high": None}
    try:
        t = _yf_ticker(sym)
        fi = t.fast_info
        hdr["last"] = _num(fi.get("last_price"))
        hdr["prev_close"] = _num(fi.get("previous_close"))
        hdr["year_low"] = _num(fi.get("year_low"))
        hdr["year_high"] = _num(fi.get("year_high"))
    except Exception:  # noqa: BLE001
        pass
    if hdr["last"] is None and rows:
        hdr["last"] = rows[-1][1]
        hdr["prev_close"] = rows[-2][1] if len(rows) > 1 else rows[-1][1]
    if hdr["year_low"] is None and rows:
        last_year = [v for d, v in rows if d >= (date.today().replace(year=date.today().year - 1)).isoformat()]
        if last_year:
            hdr["year_low"], hdr["year_high"] = min(last_year), max(last_year)
    if hdr["last"] is not None and hdr["prev_close"]:
        hdr["change"] = _round(hdr["last"] - hdr["prev_close"])
        hdr["change_pct"] = _round((hdr["last"] / hdr["prev_close"] - 1) * 100)
    return hdr


def _key_stats(t, info):
    """The YCharts 'key stats' tiles: expense ratio, AUM, volume, yield, PE, turnover, NAV, beta."""
    fo = {}
    try:
        fo = t.funds_data.fund_operations.to_dict() if t is not None else {}
    except Exception:  # noqa: BLE001
        fo = {}

    def _op(field):
        # fund_operations is a DataFrame with the fund and category columns; take the fund value.
        row = fo.get(field) if isinstance(fo, dict) else None
        if isinstance(row, dict):
            vals = [v for v in row.values() if _num(v) is not None]
            return _num(vals[0]) if vals else None
        return _num(row)

    exp = info.get("annualReportExpenseRatio") or info.get("netExpenseRatio")
    return {
        "expense_ratio": _round(_num(exp) * 100, 3) if _num(exp) is not None else None,
        "aum": _num(info.get("totalAssets")),
        "avg_volume": _num(info.get("averageVolume") or info.get("averageDailyVolume10Day")),
        "dividend_yield": _round(_num(info.get("yield")) * 100, 2) if _num(info.get("yield")) is not None else _num(info.get("yield")),
        "trailing_pe": _round(_num(info.get("trailingPE"))),
        "nav": _num(info.get("navPrice")),
        "beta_3y": _round(_num(info.get("beta3Year") or info.get("beta"))),
        "turnover": _op("Annual Report Turnover") or _op("annualReportTurnoverRate"),
        "inception": info.get("fundInceptionDate"),
        "category": info.get("category") or info.get("categoryName"),
    }


def _asset_allocation(t):
    try:
        ac = t.funds_data.asset_classes or {}
    except Exception:  # noqa: BLE001
        return {}
    return {k: _round(_num(v) * 100, 2) for k, v in ac.items() if _num(v)}


def _sector_weightings(t):
    try:
        sw = t.funds_data.sector_weightings or {}
    except Exception:  # noqa: BLE001
        return {}
    return {k: _round(_num(v) * 100, 2) for k, v in sw.items() if _num(v)}


def _top_holdings(t, n=10):
    """[{symbol, name, weight_pct}] — the holdings YCharts lists and what overlap() compares."""
    try:
        th = t.funds_data.top_holdings
    except Exception:  # noqa: BLE001
        return []
    if th is None or getattr(th, "empty", True):
        return []
    out = []
    for sym, row in th.iterrows():
        w = _num(row.get("Holding Percent") if hasattr(row, "get") else None)
        out.append({"symbol": str(sym), "name": str(row.get("Name", "")) if hasattr(row, "get") else "",
                    "weight_pct": _round(w * 100, 2) if w is not None else None})
        if len(out) >= n:
            break
    return out


def _distributions(t):
    """TTM distributions + the most recent payouts, from the dividend series."""
    try:
        div = t.dividends
    except Exception:  # noqa: BLE001
        return {"ttm": None, "recent": []}
    if div is None or getattr(div, "empty", True):
        return {"ttm": None, "recent": []}
    cutoff = date.today().replace(year=date.today().year - 1).isoformat()
    recent = [(d.date().isoformat(), _num(v)) for d, v in div.items()]
    ttm = sum(v for d, v in recent if d >= cutoff and v)
    return {"ttm": _round(ttm, 4) if ttm else None,
            "recent": [{"date": d, "amount": _round(v, 4)} for d, v in recent[-8:]]}


def _news(t, n=6):
    items = []
    try:
        raw = t.get_news() if hasattr(t, "get_news") else (t.news or [])
    except Exception:  # noqa: BLE001
        raw = []
    for it in raw[:n]:
        c = it.get("content", it) if isinstance(it, dict) else {}
        title = c.get("title") or it.get("title")
        if not title:
            continue
        prov = c.get("provider", {}) if isinstance(c, dict) else {}
        items.append({
            "title": title,
            "publisher": (prov.get("displayName") if isinstance(prov, dict) else None) or it.get("publisher"),
            "link": (c.get("canonicalUrl", {}) or {}).get("url") if isinstance(c.get("canonicalUrl"), dict) else it.get("link"),
            "date": c.get("pubDate") or it.get("providerPublishTime"),
        })
    return items


def _strategy(t, info):
    try:
        desc = t.funds_data.description
    except Exception:  # noqa: BLE001
        desc = None
    return desc or info.get("longBusinessSummary") or info.get("description")


def overlap(a_holdings, b_holdings):
    """
    Holdings overlap between two funds, YCharts-style.

    weight_overlap = sum over shared holdings of min(weight_a, weight_b) — the fraction of
    each fund that is duplicated in the other. Also returns the shared names and a simple
    count-based overlap. Inputs are top_holdings lists ([{symbol, weight_pct}]).
    """
    wa = {h["symbol"].upper(): (h.get("weight_pct") or 0) for h in a_holdings if h.get("symbol")}
    wb = {h["symbol"].upper(): (h.get("weight_pct") or 0) for h in b_holdings if h.get("symbol")}
    shared_syms = sorted(set(wa) & set(wb), key=lambda s: -min(wa[s], wb[s]))
    shared = [{"symbol": s, "weight_a": _round(wa[s]), "weight_b": _round(wb[s]),
               "min": _round(min(wa[s], wb[s]))} for s in shared_syms]
    weight_overlap = sum(min(wa[s], wb[s]) for s in shared_syms)
    union = set(wa) | set(wb)
    return {
        "weight_overlap_pct": _round(weight_overlap),
        "shared_count": len(shared_syms),
        "count_overlap_pct": _round(len(shared_syms) / len(union) * 100) if union else 0,
        "shared": shared,
        "note": "weight_overlap = sum of min(weight) across holdings both funds hold; "
                "based on top holdings only, so it is a floor on true overlap.",
    }


def build(sym, start="2015-01-01", quiet=True):
    """Assemble the full profile dict for one ETF and cache it under data/etf_profiles/."""
    sym = sym.upper()
    rows = load_prices(sym, start, quiet=quiet)
    try:
        bench = load_prices(BENCH, start, quiet=quiet)
    except Exception:  # noqa: BLE001
        bench = None

    t, info = None, {}
    try:
        t = _yf_ticker(sym)
        info = t.get_info() if hasattr(t, "get_info") else (t.info or {})
    except Exception as e:  # noqa: BLE001
        if not quiet:
            print(f"{sym}: no yfinance metadata ({type(e).__name__}); risk-only profile", file=sys.stderr)

    risk = riskstats.full(rows, bench)

    # Performance vs S&P and vs category peer, on matching trailing windows.
    vs = {}
    peer_sym = CATEGORY_PEER.get(sym, BENCH)
    for label, psym in (("sp500", BENCH), ("category", peer_sym)):
        try:
            pr = bench if psym == BENCH and bench else load_prices(psym, start, quiet=quiet)
            vs[label] = {"symbol": psym, "trailing": riskstats.trailing_returns(pr)}
        except Exception:  # noqa: BLE001
            vs[label] = {"symbol": psym, "trailing": {}}

    prof = {
        "ticker": sym,
        "name": info.get("longName") or info.get("shortName") or sym,
        "as_of": date.today().isoformat(),
        "price": _price_header(sym, rows),
        "key_stats": _key_stats(t, info),
        "risk": risk,
        "performance": {"fund": risk.get("trailing", {}), "vs": vs},
        "annual_returns": risk.get("annual", {}),
        "asset_allocation": _asset_allocation(t),
        "sector_weightings": _sector_weightings(t),
        "top_holdings": _top_holdings(t),
        "distributions": _distributions(t),
        "news": _news(t),
        "strategy": _strategy(t, info),
        "info": {
            "issuer": info.get("fundFamily") or info.get("family"),
            "legal_type": info.get("legalType"),
            "category": info.get("category"),
            "exchange": info.get("exchange"),
            "currency": info.get("currency"),
            "benchmark": BENCH,
        },
        "history": rows[-756:],  # ~3y daily closes for the price chart
    }
    os.makedirs(CACHE, exist_ok=True)
    with open(os.path.join(CACHE, f"{sym}.json"), "w", encoding="utf-8") as fh:
        json.dump(prof, fh)
    if not quiet:
        print(f"{sym}: profile cached ({len(rows)} price rows, {len(prof['top_holdings'])} holdings)", file=sys.stderr)
    return prof


def load_cached(sym):
    p = os.path.join(CACHE, f"{sym.upper()}.json")
    if os.path.exists(p):
        with open(p, encoding="utf-8") as fh:
            return json.load(fh)
    return None


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("symbols", nargs="*")
    ap.add_argument("--all", action="store_true", help="build every ticker in the S&L model")
    ap.add_argument("--overlap", nargs=2, metavar=("A", "B"), help="holdings overlap between two cached/built funds")
    ap.add_argument("--start", default="2015-01-01")
    args = ap.parse_args(argv)

    if args.overlap:
        a, b = args.overlap
        pa = load_cached(a) or build(a, args.start, quiet=False)
        pb = load_cached(b) or build(b, args.start, quiet=False)
        print(json.dumps(overlap(pa["top_holdings"], pb["top_holdings"]), indent=2))
        return

    syms = list(args.symbols)
    if args.all:
        from .watchlists import tickers
        syms += tickers("sl_model")
    if not syms:
        ap.error("give one or more tickers, --all, or --overlap A B")
    for s in dict.fromkeys(syms):
        p = build(s, args.start, quiet=False)
        r = p["risk"]
        print(f"{s.upper():<6} 1Y={r['trailing'].get('1Y'):>7.2f}%  vol={r.get('vol_pct'):>6.2f}  "
              f"beta={r.get('beta')}  maxDD={r.get('max_drawdown_pct'):>7.2f}%")


if __name__ == "__main__":
    main()

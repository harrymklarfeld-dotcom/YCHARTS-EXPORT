#!/usr/bin/env python3
"""
ETF prospect screener — ranks candidate ETFs by how well they FIT your current book.

The point of the whole project: turn research into an edge. A fund is only a good add if it does a
job your portfolio doesn't already have. So each candidate is scored on:

  * correlation to your book's daily returns    (lower = more diversification)   — 55%
  * risk-adjusted return (Sharpe)               (higher = better engine)         — 30%
  * holdings overlap with what you already own   (lower = less duplication)       — 15%

into a 0-100 fit score, with a plain-English verdict. Correlation and overlap are computed against
YOUR actual snapshot, so the ranking is personal, not generic.

Runs on live/cached prices via portfolio.prices and the cached etf_profiles for overlap. Pure-stdlib
math (correlation, scoring) is unit-tested offline. Writes data/prospects.json for the dashboard.

    python -m portfolio.prospects                    # rank the 'prospects' watchlist vs your book
    python -m portfolio.prospects --names DBMF AVUV SCHD
"""
from __future__ import annotations

import argparse
import json
import os
import statistics

from . import riskstats
from .prices import load_prices
from .simulate import load_holdings, portfolio_returns

ROLES = {
    "DBMF": ("managed futures", "hedge"), "USMV": ("low-volatility equity", "hedge"),
    "SDCI": ("broad commodities", "hedge"), "USFR": ("floating-rate T-bills", "cash"),
    "AVUV": ("small-cap value factor", "factor"), "COWZ": ("free-cash-flow value", "factor"),
    "SCHD": ("dividend quality", "income"), "XAR": ("aerospace & defense", "growth"),
    "IAI": ("broker-dealers/financials", "growth"), "USAI": ("midstream energy/MLPs", "income"),
}


def _corr(a_rets, b_rets):
    n = min(len(a_rets), len(b_rets))
    if n < 30:
        return None
    a, b = a_rets[-n:], b_rets[-n:]
    sa, sb = statistics.pstdev(a), statistics.pstdev(b)
    if not sa or not sb:
        return None
    ma, mb = statistics.fmean(a), statistics.fmean(b)
    return sum((a[i] - ma) * (b[i] - mb) for i in range(n)) / n / (sa * sb)


def _returns(rows):
    return [rows[i][1] / rows[i - 1][1] - 1 for i in range(1, len(rows)) if rows[i - 1][1] > 0]


def _overlap_with_book(ticker, book_syms):
    """Weight overlap of the candidate's top holdings with names you already hold (0..100)."""
    try:
        from .etf_profile import load_cached
    except Exception:  # noqa: BLE001
        return None
    prof = load_cached(ticker)
    if not prof:
        return None
    held = {s.upper() for s in book_syms}
    return round(sum((h.get("weight_pct") or 0) for h in prof.get("top_holdings", [])
                     if h.get("symbol", "").upper() in held), 1)


def _fit(corr, sharpe, overlap_pct):
    div = (1 - corr) / 2 if corr is not None else 0.5           # 0..1, low corr -> high
    sh = max(0.0, min(1.0, (sharpe or 0) / 2))                  # 0..1, Sharpe 2+ maxes out
    ov = 1 - (overlap_pct or 0) / 100                            # 0..1, low overlap -> high
    return round(100 * (0.55 * div + 0.30 * sh + 0.15 * ov), 1)


def _verdict(role, corr, fit, ret1y):
    if corr is not None and corr < 0.3 and role in ("hedge", "cash"):
        return "Strong diversifier — low correlation, real hedge"
    if corr is not None and corr > 0.85:
        return "Redundant — moves with what you already own"
    if role in ("factor", "income", "growth") and (ret1y or 0) > 10 and (corr or 1) < 0.8:
        return "Return engine — non-tech growth with some diversification"
    if fit >= 60:
        return "Worth a look — fills a gap"
    return "Marginal — doesn't add much your book lacks"


def evaluate(ticker, book_rets, book_syms, start="2019-01-01", quiet=True):
    ticker = ticker.upper()
    try:
        rows = load_prices(ticker, start, quiet=quiet)
    except Exception as e:  # noqa: BLE001
        return {"ticker": ticker, "error": f"{type(e).__name__}: {e}"}
    rets = _returns(rows)
    corr = _corr(rets, book_rets)
    tr = riskstats.trailing_returns(rows)
    sharpe = riskstats.sharpe(rows)
    overlap = _overlap_with_book(ticker, book_syms)
    role_name, role = ROLES.get(ticker, ("", "growth"))
    ret1y = tr.get("1Y")
    fit = _fit(corr, sharpe, overlap)
    return {
        "ticker": ticker, "role": role, "role_name": role_name,
        "corr_to_book": round(corr, 2) if corr is not None else None,
        "overlap_with_book_pct": overlap,
        "ret_1y_pct": round(ret1y, 1) if ret1y is not None else None,
        "ret_3y_pct": round(tr.get("3Y"), 1) if tr.get("3Y") is not None else None,
        "vol_pct": round(riskstats.volatility(rows), 1) if riskstats.volatility(rows) else None,
        "sharpe": round(sharpe, 2) if sharpe is not None else None,
        "max_dd_pct": round(riskstats.max_drawdown(rows), 1),
        "fit_score": fit, "verdict": _verdict(role, corr, fit, ret1y),
    }


def rank(snapshot=os.path.join("data", "portfolio", "snapshot.json"), names=None,
         start="2019-01-01", quiet=True, write=True):
    from .watchlists import load_user
    names = names or load_user("prospects")
    values, _ = load_holdings(snapshot)
    book_syms = list(values)
    dates, book_rets = portfolio_returns(values, start, quiet=quiet)
    rows = [evaluate(t, book_rets, book_syms, start, quiet) for t in names]
    ok = [r for r in rows if not r.get("error")]
    ok.sort(key=lambda r: -(r["fit_score"] or 0))
    out = {"as_of": __import__("datetime").date.today().isoformat(),
           "book": sorted(book_syms), "ranked": ok,
           "errors": [r for r in rows if r.get("error")]}
    if write:
        os.makedirs(os.path.join("data"), exist_ok=True)
        with open(os.path.join("data", "prospects.json"), "w", encoding="utf-8") as fh:
            json.dump(out, fh)
    return out


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--names", nargs="*")
    ap.add_argument("--snapshot", default=os.path.join("data", "portfolio", "snapshot.json"))
    ap.add_argument("--start", default="2019-01-01")
    args = ap.parse_args(argv)
    out = rank(args.snapshot, args.names, args.start, quiet=False)
    print(f"\nProspects ranked vs your book ({', '.join(out['book'])})\n")
    print(f"{'ETF':6}{'role':16}{'corr':>6}{'overlap':>9}{'1Y%':>7}{'Sharpe':>8}{'fit':>6}  verdict")
    for r in out["ranked"]:
        print(f"{r['ticker']:6}{r['role_name'][:15]:16}{_f(r['corr_to_book']):>6}"
              f"{_f(r['overlap_with_book_pct']):>8}%{_f(r['ret_1y_pct']):>7}{_f(r['sharpe']):>8}"
              f"{_f(r['fit_score']):>6}  {r['verdict']}")
    for e in out["errors"]:
        print(f"{e['ticker']:6} {e['error']}")


def _f(x):
    return f"{x:.2f}" if isinstance(x, float) else (str(x) if x is not None else "--")


if __name__ == "__main__":
    main()

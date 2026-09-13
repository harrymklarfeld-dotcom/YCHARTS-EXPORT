#!/usr/bin/env python3
"""
Return and risk statistics from a daily price series — the numbers on a YCharts risk panel:
trailing returns (1M..10Y), annualized volatility, Sharpe, Sortino, beta/alpha vs a benchmark,
value-at-risk, and max drawdown. Pure math (stdlib), unit-tested; the ETF profile builds on it.
"""
from __future__ import annotations

import math
import statistics
from datetime import date, timedelta

TRADING_DAYS = 252
RF = 0.04  # annual risk-free assumption for Sharpe/Sortino


def _on_or_before(prices: dict, d: str):
    ks = [k for k in prices if k <= d]
    return prices[max(ks)] if ks else None


def trailing_returns(rows: list[tuple[str, float]]) -> dict:
    """Total price return over standard windows, annualized beyond 1Y (YCharts convention)."""
    if len(rows) < 2:
        return {}
    px = dict(rows)
    end_d = date.fromisoformat(rows[-1][0]); end_v = rows[-1][1]
    windows = {"1M": 30, "3M": 91, "6M": 182, "1Y": 365, "3Y": 1095, "5Y": 1826, "10Y": 3652}
    out = {}
    for label, days in windows.items():
        start = (end_d - timedelta(days=days)).isoformat()
        sv = _on_or_before(px, start)
        if sv and sv > 0 and rows[0][0] <= start:
            r = end_v / sv - 1
            yrs = days / 365.25
            out[label] = ((1 + r) ** (1 / yrs) - 1) * 100 if yrs > 1 else r * 100
    # YTD
    ytd0 = _on_or_before(px, f"{end_d.year}-01-01")
    if ytd0:
        out["YTD"] = (end_v / ytd0 - 1) * 100
    return out


def annual_returns(rows: list[tuple[str, float]], years=7) -> dict:
    """Calendar-year total returns (last N years + YTD)."""
    px = {}
    for d, v in rows:
        px.setdefault(d[:4], []).append((d, v))
    yrs = sorted(px)
    out = {}
    for i, y in enumerate(yrs):
        first = px[y][0][1]; last = px[y][-1][1]
        prev = px[yrs[i - 1]][-1][1] if i > 0 else first
        out[y] = (last / prev - 1) * 100
    end_year = yrs[-1] if yrs else None
    return {y: out[y] for y in yrs[-(years + 1):]}


def daily_returns(rows):
    return [rows[i][1] / rows[i - 1][1] - 1 for i in range(1, len(rows)) if rows[i - 1][1] > 0]


def volatility(rows) -> float | None:
    dr = daily_returns(rows)
    return statistics.pstdev(dr) * math.sqrt(TRADING_DAYS) * 100 if len(dr) > 2 else None


def max_drawdown(rows) -> float:
    peak, mdd = -1e18, 0.0
    for _, v in rows:
        peak = max(peak, v)
        if peak > 0:
            mdd = min(mdd, v / peak - 1)
    return mdd * 100


def sharpe(rows) -> float | None:
    dr = daily_returns(rows)
    if len(dr) < 3:
        return None
    vol = statistics.pstdev(dr) * math.sqrt(TRADING_DAYS)
    return ((statistics.fmean(dr) * TRADING_DAYS - RF) / vol) if vol else None


def sortino(rows) -> float | None:
    dr = daily_returns(rows)
    if len(dr) < 3:
        return None
    downside = [d for d in dr if d < 0]
    dd = statistics.pstdev(downside) * math.sqrt(TRADING_DAYS) if len(downside) > 1 else None
    return ((statistics.fmean(dr) * TRADING_DAYS - RF) / dd) if dd else None


def value_at_risk(rows, pct=5) -> float | None:
    dr = sorted(daily_returns(rows))
    if len(dr) < 20:
        return None
    idx = max(0, int(len(dr) * pct / 100) - 1)
    return -dr[idx] * 100  # monthly-ish daily VaR magnitude


def beta_alpha(rows, bench_rows) -> tuple:
    """Beta and (annualized) alpha vs a benchmark, aligned on common dates."""
    a = dict(rows); b = dict(bench_rows)
    common = sorted(set(a) & set(b))
    if len(common) < 30:
        return None, None
    ra = [a[common[i]] / a[common[i - 1]] - 1 for i in range(1, len(common)) if a[common[i - 1]] > 0]
    rb = [b[common[i]] / b[common[i - 1]] - 1 for i in range(1, len(common)) if b[common[i - 1]] > 0]
    n = min(len(ra), len(rb)); ra, rb = ra[:n], rb[:n]
    if n < 30:
        return None, None
    mb = statistics.fmean(rb); ma = statistics.fmean(ra)
    var_b = statistics.pvariance(rb)
    cov = sum((ra[i] - ma) * (rb[i] - mb) for i in range(n)) / n
    beta = cov / var_b if var_b else None
    alpha = ((ma - RF / TRADING_DAYS) - (beta or 0) * (mb - RF / TRADING_DAYS)) * TRADING_DAYS * 100 if beta is not None else None
    return beta, alpha


def full(rows, bench_rows=None) -> dict:
    beta, alpha = beta_alpha(rows, bench_rows) if bench_rows else (None, None)
    return {"trailing": trailing_returns(rows), "annual": annual_returns(rows),
            "vol_pct": volatility(rows), "max_drawdown_pct": max_drawdown(rows),
            "sharpe": sharpe(rows), "sortino": sortino(rows), "var5_pct": value_at_risk(rows),
            "beta": beta, "alpha_pct": alpha,
            "start": rows[0][0] if rows else None, "end": rows[-1][0] if rows else None}


if __name__ == "__main__":
    import sys
    from .prices import load_prices
    rows = load_prices(sys.argv[1] if len(sys.argv) > 1 else "AGG", "2016-01-01")
    print(full(rows))

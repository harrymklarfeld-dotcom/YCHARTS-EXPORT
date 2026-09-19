#!/usr/bin/env python3
"""
Correlation Analysis — the first Quickflow. How much do 2-12 securities move together?

Given daily price series, we align them on their common trading days, turn prices into daily
returns, and compute the Pearson correlation of every pair. High positive correlation means two
holdings rise and fall together (little diversification); near zero or negative means one zigs
when the other zags (real diversification). The matrix is the raw material; insight() adds the
plain-English read — average pairwise correlation, the pair that moves most in lockstep, and the
best diversifier.

Pure and unit-tested: assemble() takes {symbol: [(date, price), ...]} and does no I/O.

    python -m portfolio.correlation NVDA MU VOO GLD
"""
from __future__ import annotations

import math
import sys
from datetime import date


def _returns_on(prices_by_date: dict, dates: list) -> list:
    """Daily simple returns across the given ordered common dates."""
    out = []
    for i in range(1, len(dates)):
        p0, p1 = prices_by_date[dates[i - 1]], prices_by_date[dates[i]]
        out.append(p1 / p0 - 1 if p0 else 0.0)
    return out


def pearson(a: list, b: list) -> float:
    n = min(len(a), len(b))
    if n < 2:
        return float("nan")
    a, b = a[:n], b[:n]
    ma, mb = sum(a) / n, sum(b) / n
    va = sum((x - ma) ** 2 for x in a)
    vb = sum((x - mb) ** 2 for x in b)
    if va <= 0 or vb <= 0:
        return float("nan")
    cov = sum((a[i] - ma) * (b[i] - mb) for i in range(n))
    return max(-1.0, min(1.0, cov / math.sqrt(va * vb)))


def assemble(series_map: dict) -> dict:
    """
    series_map: {symbol: [(iso_date, price), ...]}. Returns the correlation matrix over each
    symbol's daily returns on the common date window, plus that window's span and size.
    """
    symbols = [s for s in series_map if series_map[s]]
    by_date = {s: {d[:10] if isinstance(d, str) else str(d)[:10]: float(p)
                   for d, p in series_map[s]} for s in symbols}
    # common trading days across ALL symbols
    common = None
    for s in symbols:
        ds = set(by_date[s])
        common = ds if common is None else (common & ds)
    common = sorted(common or [])
    rets = {s: _returns_on(by_date[s], common) for s in symbols}

    n = len(symbols)
    matrix = [[1.0] * n for _ in range(n)]
    for i in range(n):
        for j in range(i + 1, n):
            c = pearson(rets[symbols[i]], rets[symbols[j]])
            matrix[i][j] = matrix[j][i] = None if c != c else round(c, 3)  # NaN -> None

    return {
        "symbols": symbols,
        "matrix": matrix,
        "n_obs": max(0, len(common) - 1),
        "from": common[0] if common else None,
        "to": common[-1] if common else None,
        "insight": insight(symbols, matrix),
    }


def _pairs(symbols: list, matrix: list):
    for i in range(len(symbols)):
        for j in range(i + 1, len(symbols)):
            c = matrix[i][j]
            if c is not None:
                yield symbols[i], symbols[j], c


def insight(symbols: list, matrix: list) -> dict:
    pairs = list(_pairs(symbols, matrix))
    if not pairs:
        return {"avg": None, "text": "Not enough overlapping history to compare."}
    avg = round(sum(c for _, _, c in pairs) / len(pairs), 3)
    hi = max(pairs, key=lambda p: p[2])
    lo = min(pairs, key=lambda p: p[2])
    # best diversifier: the symbol with the lowest average correlation to the rest
    avg_by_sym = {}
    for s in symbols:
        cs = [c for a, b, c in pairs if s in (a, b)]
        if cs:
            avg_by_sym[s] = sum(cs) / len(cs)
    diversifier = min(avg_by_sym, key=avg_by_sym.get) if avg_by_sym else None
    text = (f"Average pairwise correlation {avg:+.2f}. "
            f"{hi[0]} and {hi[1]} move most in lockstep ({hi[2]:+.2f}); "
            f"{lo[0]} and {lo[1]} least ({lo[2]:+.2f}).")
    if diversifier:
        text += f" {diversifier} is the best diversifier here (lowest average correlation to the rest)."
    return {"avg": avg, "most_correlated": [hi[0], hi[1], hi[2]],
            "least_correlated": [lo[0], lo[1], lo[2]], "best_diversifier": diversifier, "text": text}


def build(symbols, start="2022-01-01", quiet=True) -> dict:
    from .prices import load_prices
    series = {}
    for s in symbols:
        s = s.upper()
        try:
            rows = load_prices(s, start, quiet=quiet)
            if rows:
                series[s] = rows
        except Exception as e:  # noqa: BLE001
            if not quiet:
                print(f"{s}: prices unavailable ({type(e).__name__})", file=sys.stderr)
    return assemble(series)


def main(argv=None):
    import argparse
    ap = argparse.ArgumentParser(description="Correlation analysis across securities.")
    ap.add_argument("symbols", nargs="+")
    ap.add_argument("--start", default="2022-01-01")
    args = ap.parse_args(argv)
    res = build(args.symbols, args.start, quiet=False)
    syms = res["symbols"]
    if not syms:
        print("No price history for any symbol.", file=sys.stderr)
        return 1
    print(f"Correlation of daily returns, {res['from']} → {res['to']} ({res['n_obs']} days):\n")
    def cell(v):
        return "   .  " if v is None else f"{v:+.2f}"
    print("       " + "".join(f"{s:>7}" for s in syms))
    for i, s in enumerate(syms):
        print(f"{s:>6} " + "".join(f"{cell(res['matrix'][i][j]):>7}" for j in range(len(syms))))
    print("\n" + res["insight"]["text"])
    return 0


if __name__ == "__main__":
    sys.exit(main())

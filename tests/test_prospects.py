#!/usr/bin/env python3
"""Offline tests for portfolio.prospects: correlation, fit scoring, ranking order."""
import os
import random
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from datetime import date, timedelta
from portfolio import prospects as P


def test_corr_and_fit_monotonic():
    r = random.Random(1)
    book = [r.gauss(0, 0.01) for _ in range(400)]
    same = [x + r.gauss(0, 0.001) for x in book]      # highly correlated
    indep = [r.gauss(0, 0.01) for _ in range(400)]    # uncorrelated
    assert P._corr(same, book) > 0.9
    assert abs(P._corr(indep, book)) < 0.3
    # lower correlation -> higher fit (all else equal)
    hi = P._fit(0.95, 0.5, 10)
    lo = P._fit(0.10, 0.5, 10)
    assert lo > hi, (lo, hi)
    # more overlap -> lower fit
    assert P._fit(0.5, 0.5, 0) > P._fit(0.5, 0.5, 80)
    print("ok test_corr_and_fit_monotonic")


def test_verdict_labels():
    assert "diversifier" in P._verdict("hedge", 0.1, 70, 8)
    assert "Redundant" in P._verdict("growth", 0.92, 40, 20)
    assert "Return engine" in P._verdict("factor", 0.6, 65, 20)
    print("ok test_verdict_labels")


def test_rank_orders_by_fit(monkeypatch):
    # synthetic prices: HEDGE uncorrelated to book, TWIN tracks book
    days = [(date(2020, 1, 1) + timedelta(days=i)).isoformat() for i in range(500)]
    r = random.Random(5)
    book_daily = [r.gauss(0.0005, 0.012) for _ in days]

    def to_px(rets, s=100.0):
        v = s; out = [(days[0], v)]
        for i in range(1, len(days)):
            v *= 1 + rets[i]; out.append((days[i], round(v, 4)))
        return out
    TWIN = to_px([x + r.gauss(0, 0.0005) for x in book_daily])       # ~book
    HEDGE = to_px([r.gauss(0.0004, 0.01) for _ in days])             # independent
    px = {"TWIN": TWIN, "HEDGE": HEDGE, "VOO": to_px(book_daily)}

    monkeypatch.setattr(P, "load_prices", lambda t, start="2019-01-01", quiet=True: px[t.upper()])
    monkeypatch.setattr(P, "portfolio_returns", lambda w, start="2019-01-01", quiet=True: (days[1:], book_daily[1:]))
    monkeypatch.setattr(P, "load_holdings", lambda path=None: ({"VOO": 1000.0}, 1000.0))
    monkeypatch.setattr(P, "_overlap_with_book", lambda t, syms: 0.0)

    out = P.rank(names=["TWIN", "HEDGE"], write=False)
    order = [r["ticker"] for r in out["ranked"]]
    assert order[0] == "HEDGE", out["ranked"]          # low-corr hedge ranks first
    twin = next(r for r in out["ranked"] if r["ticker"] == "TWIN")
    assert twin["corr_to_book"] > 0.8
    print("ok test_rank_orders_by_fit")


def _run():
    class MP:
        def __init__(self): self._s = []
        def setattr(self, o, n, v): self._s.append((o, n, getattr(o, n))); setattr(o, n, v)
        def undo(self):
            for o, n, v in reversed(self._s): setattr(o, n, v)
    test_corr_and_fit_monotonic()
    test_verdict_labels()
    mp = MP()
    try:
        test_rank_orders_by_fit(mp)
    finally:
        mp.undo()


if __name__ == "__main__":
    _run()

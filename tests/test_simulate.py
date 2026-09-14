#!/usr/bin/env python3
"""Offline tests for portfolio.simulate: return series, MC bands ordering, deposit effect."""
import os
import random
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from datetime import date, timedelta
from portfolio import simulate as sim


def _daily(n=800, mu=0.0005, sd=0.011, seed=1):
    r = random.Random(seed)
    return [r.gauss(mu, sd) for _ in range(n)]


def test_bands_are_ordered_and_grow():
    daily = _daily()
    out = sim.simulate(1000.0, daily, days=252, paths=800, method="bootstrap", seed=3)
    t = out["terminal"]
    assert t["p5"] < t["p25"] < t["p50"] < t["p75"] < t["p95"], t
    # positive-drift book: median should end above start over a year
    assert t["p50"] > 1000, t
    # bands widen over time: last-day spread > early spread
    b = out["bands"]
    early = b[10]["p95"] - b[10]["p5"]; late = b[-1]["p95"] - b[-1]["p5"]
    assert late > early, (early, late)
    print("ok test_bands_are_ordered_and_grow")


def test_deposit_raises_ending_value():
    daily = _daily()
    base = sim.simulate(1000.0, daily, days=252, paths=600, deposit=0, seed=5)
    dca = sim.simulate(1000.0, daily, days=252, paths=600, deposit=100, seed=5)
    assert dca["terminal"]["p50"] > base["terminal"]["p50"], (base["terminal"], dca["terminal"])
    assert dca["contributed_total"] > base["contributed_total"]
    print("ok test_deposit_raises_ending_value")


def test_parametric_and_prob_loss_bounds():
    daily = _daily(mu=-0.0002, sd=0.02, seed=9)  # negative drift, high vol
    out = sim.simulate(1000.0, daily, days=252, paths=800, method="parametric", seed=1)
    assert 0 <= out["prob_loss_pct"] <= 100
    assert out["prob_loss_pct"] > 30, out["prob_loss_pct"]  # a bad book loses often
    assert out["hist"]["ann_vol_pct"] > 20
    print("ok test_parametric_and_prob_loss_bounds")


def test_portfolio_returns_fixed_weight(monkeypatch):
    days = [(date(2020, 1, 1) + timedelta(days=i)).isoformat() for i in range(300)]
    r = random.Random(2)
    A = [(days[i], 100 * (1.001) ** i) for i in range(300)]
    B = [(days[i], 50 * (1.0005) ** i) for i in range(300)]
    series = {"A": dict(A), "B": dict(B)}
    monkeypatch.setattr(sim, "load_prices", lambda tk, start="2018-01-01", quiet=True: sorted(series[tk].items()))
    d, rets = sim.portfolio_returns({"A": 600, "B": 400})
    assert len(rets) > 250 and all(abs(x) < 0.1 for x in rets)
    # 60/40 of two positive-drift assets -> positive mean daily return
    assert sum(rets) / len(rets) > 0
    print("ok test_portfolio_returns_fixed_weight")


def _run():
    class MP:
        def __init__(self): self._s = []
        def setattr(self, o, n, v): self._s.append((o, n, getattr(o, n))); setattr(o, n, v)
        def undo(self):
            for o, n, v in reversed(self._s): setattr(o, n, v)
    test_bands_are_ordered_and_grow()
    test_deposit_raises_ending_value()
    test_parametric_and_prob_loss_bounds()
    mp = MP()
    try:
        test_portfolio_returns_fixed_weight(mp)
    finally:
        mp.undo()


if __name__ == "__main__":
    _run()

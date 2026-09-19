#!/usr/bin/env python3
"""Offline tests for Correlation Analysis (portfolio.correlation)."""
import os
import random
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from portfolio import correlation as C


def _prices_from_returns(rets, p0=100.0):
    px, p = [], p0
    for i, r in enumerate(rets):
        p *= (1 + r)
        px.append((f"2024-{1 + i // 28:02d}-{1 + i % 28:02d}", round(p, 4)))
    return px


def test_known_correlations():
    rng = random.Random(7)
    base = [rng.gauss(0.001, 0.02) for _ in range(200)]
    noise = [rng.gauss(0.0, 0.02) for _ in range(200)]
    A = base
    B = base[:]                      # identical returns -> +1.00
    D = [-x for x in base]           # exact negation -> -1.00
    E = noise                        # independent -> ~0
    sm = {
        "A": _prices_from_returns(A), "B": _prices_from_returns(B),
        "D": _prices_from_returns(D), "E": _prices_from_returns(E),
    }
    r = C.assemble(sm)
    idx = {s: i for i, s in enumerate(r["symbols"])}
    m = r["matrix"]
    assert m[idx["A"]][idx["B"]] > 0.999, m[idx["A"]][idx["B"]]
    assert m[idx["A"]][idx["D"]] < -0.999, m[idx["A"]][idx["D"]]
    assert abs(m[idx["A"]][idx["E"]]) < 0.2, m[idx["A"]][idx["E"]]
    assert m[idx["A"]][idx["A"]] == 1.0            # diagonal
    assert r["n_obs"] == 199
    print("ok test_known_correlations")


def test_insight_picks_extremes_and_diversifier():
    rng = random.Random(11)
    base = [rng.gauss(0, 0.02) for _ in range(150)]
    sm = {
        "A": _prices_from_returns(base),
        "B": _prices_from_returns([x + rng.gauss(0, 0.001) for x in base]),  # ~ +1 with A
        "Z": _prices_from_returns([-x for x in base]),                        # ~ -1 with A and B
    }
    ins = C.assemble(sm)["insight"]
    assert set(ins["most_correlated"][:2]) == {"A", "B"}, ins
    assert ins["best_diversifier"] == "Z", ins        # Z is anti-correlated to both others
    assert ins["most_correlated"][2] > ins["least_correlated"][2]
    print("ok test_insight_picks_extremes_and_diversifier")


def test_no_overlap_is_graceful():
    sm = {"A": [("2024-01-01", 10), ("2024-01-02", 11)],
          "B": [("2023-01-01", 5), ("2023-01-02", 6)]}   # disjoint dates
    r = C.assemble(sm)
    assert r["n_obs"] == 0
    assert r["matrix"][0][1] is None                     # no common days -> undefined
    assert r["insight"]["avg"] is None
    print("ok test_no_overlap_is_graceful")


def _run():
    for fn in (test_known_correlations, test_insight_picks_extremes_and_diversifier, test_no_overlap_is_graceful):
        fn()


if __name__ == "__main__":
    _run()

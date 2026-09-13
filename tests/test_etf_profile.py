#!/usr/bin/env python3
"""Offline tests for portfolio.etf_profile: overlap math + risk-only profile assembly.

No network: load_prices and the yfinance ticker are monkeypatched so build() runs on a
synthetic price series and takes the graceful metadata-less path.
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from portfolio import etf_profile as ep


def _series(n=800, start=100.0, drift=0.0004):
    import math
    rows, v = [], start
    from datetime import date, timedelta
    d = date(2022, 1, 1)
    for i in range(n):
        v *= 1 + drift + 0.01 * math.sin(i / 9)
        rows.append(((d + timedelta(days=i)).isoformat(), round(v, 4)))
    return rows


def test_overlap_shared_weight():
    a = [{"symbol": "NVDA", "weight_pct": 20}, {"symbol": "AVGO", "weight_pct": 10}, {"symbol": "TSM", "weight_pct": 8}]
    b = [{"symbol": "NVDA", "weight_pct": 12}, {"symbol": "AVGO", "weight_pct": 15}, {"symbol": "AAPL", "weight_pct": 9}]
    o = ep.overlap(a, b)
    # shared NVDA + AVGO: min(20,12)+min(10,15) = 12 + 10 = 22
    assert o["shared_count"] == 2, o
    assert abs(o["weight_overlap_pct"] - 22) < 1e-6, o
    # union of 4 names, 2 shared -> 50%
    assert abs(o["count_overlap_pct"] - 50) < 1e-6, o
    assert o["shared"][0]["symbol"] == "NVDA", o  # sorted by min weight desc
    print("ok test_overlap_shared_weight")


def test_overlap_disjoint():
    a = [{"symbol": "GLD", "weight_pct": 100}]
    b = [{"symbol": "USFR", "weight_pct": 100}]
    o = ep.overlap(a, b)
    assert o["weight_overlap_pct"] == 0 and o["shared_count"] == 0, o
    print("ok test_overlap_disjoint")


def test_build_risk_only(monkeypatch):
    rows = _series()
    monkeypatch.setattr(ep, "load_prices", lambda sym, start="2015-01-01", quiet=True: rows)

    def _boom(sym):
        raise RuntimeError("no network in sandbox")
    monkeypatch.setattr(ep, "_yf_ticker", _boom)

    prof = ep.build("SDCI", quiet=True)
    for key in ("ticker", "name", "price", "key_stats", "risk", "performance",
                "annual_returns", "asset_allocation", "sector_weightings",
                "top_holdings", "distributions", "news", "strategy", "info", "history"):
        assert key in prof, f"missing {key}"
    assert prof["ticker"] == "SDCI"
    assert prof["risk"]["trailing"].get("1Y") is not None
    assert prof["risk"]["vol_pct"] is not None
    assert prof["price"]["last"] == rows[-1][1]  # fell back to cached close
    assert prof["top_holdings"] == []            # metadata source unavailable -> empty, no crash
    assert isinstance(prof["history"], list) and prof["history"]
    print("ok test_build_risk_only")


def _run():
    # minimal monkeypatch shim so this runs without pytest too
    class MP:
        def __init__(self):
            self._saved = []

        def setattr(self, obj, name, val):
            self._saved.append((obj, name, getattr(obj, name)))
            setattr(obj, name, val)

        def undo(self):
            for obj, name, val in reversed(self._saved):
                setattr(obj, name, val)

    test_overlap_shared_weight()
    test_overlap_disjoint()
    mp = MP()
    try:
        test_build_risk_only(mp)
    finally:
        mp.undo()


if __name__ == "__main__":
    _run()

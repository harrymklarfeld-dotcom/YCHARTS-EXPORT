#!/usr/bin/env python3
"""Offline tests for portfolio.hedge_strategy: diagnostics, sleeve classification, blend beta.

load_prices is monkeypatched to return synthetic funds built as beta*SPY + noise, so realized
beta is known and the sleeve classification and target-beta solve can be checked.
"""
import os
import random
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from datetime import date, timedelta
from portfolio import hedge_strategy as hs

R = random.Random(42)
DAYS = [(date(2018, 1, 1) + timedelta(days=i)).isoformat() for i in range(1400)]
SPY_R = [R.gauss(0.0004, 0.010) for _ in DAYS]


def _prices_from_returns(rets, start=100.0):
    rows, v = [], start
    for d, r in zip(DAYS, rets):
        v *= 1 + r
        rows.append((d, round(v, 4)))
    return rows


def _fund(beta, idio=0.006):
    return _prices_from_returns([beta * SPY_R[i] + R.gauss(0, idio) for i in range(len(DAYS))])


SPY = _prices_from_returns(SPY_R)
FUNDS = {"GROW": _fund(1.4), "THEME": _fund(0.7), "DIVA": _fund(0.15), "DIVB": _fund(0.05), "SPY": SPY}


def _patched_load(sym, start="2010-01-01", refresh=False, quiet=True):
    rows = FUNDS.get(sym.upper())
    if rows is None:
        raise RuntimeError("no data " + sym)
    return [r for r in rows if r[0] >= start]


def test_diagnose_and_classify(monkeypatch):
    monkeypatch.setattr(hs, "load_prices", _patched_load)
    monkeypatch.setattr(hs, "SL_MODEL", [{"ticker": t, "name": t, "sleeve": "x"} for t in ("GROW", "THEME", "DIVA", "DIVB")])
    diag = hs.diagnose(tickers=["GROW", "THEME", "DIVA", "DIVB"], start="2018-01-01")
    by = {f["ticker"]: f for f in diag["funds"]}
    assert by["GROW"]["beta"] > 1.1 and by["GROW"]["measured_sleeve"] == "growth", by["GROW"]
    assert by["THEME"]["measured_sleeve"] == "thematic", by["THEME"]
    assert by["DIVA"]["measured_sleeve"] == "diversifier", by["DIVA"]
    assert by["DIVA"]["corr_sp"] < 0.6, by["DIVA"]  # low-beta fund is low-correlation
    print("ok test_diagnose_and_classify")


def test_build_hits_target_beta(monkeypatch):
    monkeypatch.setattr(hs, "load_prices", _patched_load)
    diag = hs.diagnose(tickers=["GROW", "THEME", "DIVA", "DIVB"], start="2018-01-01")
    hedge = hs.build_hedge(diag, target_beta=0.6)
    assert abs(hedge["blended_beta_est"] - 0.6) < 0.15, hedge
    assert abs(sum(hedge["weights"].values()) - 100) < 1.5, hedge["weights"]
    print("ok test_build_hits_target_beta")


def test_verify_blend_lowers_beta(monkeypatch):
    monkeypatch.setattr(hs, "load_prices", _patched_load)
    diag = hs.diagnose(tickers=["GROW", "THEME", "DIVA", "DIVB"], start="2018-01-01")
    hedge = hs.build_hedge(diag, target_beta=0.6)
    ver = hs.verify(hedge["weights"], start="2018-01-01")
    assert "error" not in ver, ver
    assert ver["sleeve"]["beta"] < 0.9, ver          # sleeve is less market-exposed than SPY
    assert ver["sleeve"]["vol_pct"] < ver["sp500"]["vol_pct"], ver  # and less volatile
    print("ok test_verify_blend_lowers_beta")


def _run():
    class MP:
        def __init__(self): self._s = []
        def setattr(self, o, n, v): self._s.append((o, n, getattr(o, n))); setattr(o, n, v)
        def undo(self):
            for o, n, v in reversed(self._s): setattr(o, n, v)
    for fn in (test_diagnose_and_classify, test_build_hits_target_beta, test_verify_blend_lowers_beta):
        mp = MP()
        try:
            fn(mp)
        finally:
            mp.undo()


if __name__ == "__main__":
    _run()

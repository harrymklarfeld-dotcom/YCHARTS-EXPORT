#!/usr/bin/env python3
"""Offline tests for the combined money tracker (portfolio.accounts)."""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from portfolio import accounts as A

RH = {  # a minimal snapshot with no cost basis (like a hand-made screenshot)
    "account": "Robinhood",
    "holdings": [
        {"symbol": "VOO", "shares": 1.93, "market_value": 1347.68},
        {"symbol": "NVDA", "shares": 2.01, "market_value": 424.67},
    ],
    "summary": {"equity": 1772.35, "cash": 0.0},
}
RJ = {  # a second account with full cost basis
    "account": "Raymond James",
    "broker": "raymond_james",
    "holdings": [
        {"symbol": "QQQ", "shares": 2, "market_value": 1442.90, "cost_basis": 1008.73},
        {"symbol": "VOO", "shares": 2, "market_value": 1403.56, "cost_basis": 1088.78},
    ],
    "summary": {"equity": 2855.66, "cash": 9.20, "cost_basis": 2097.51, "unrealized_gain": 748.95},
}


def test_totals_and_weights():
    c = A.combine([A.normalize(RH, "Robinhood"), A.normalize(RJ)])
    assert c["n_accounts"] == 2
    assert abs(c["total_equity"] - (1772.35 + 2855.66)) < 0.01
    assert abs(c["total_cash"] - 9.20) < 0.01
    # one account lacks cost basis -> no combined gain, and cost_basis_complete is False
    assert c["cost_basis_complete"] is False
    assert c["total_unrealized_gain"] is None
    w = {a["name"]: a["weight"] for a in c["accounts"]}
    assert abs(w["Robinhood"] + w["Raymond James"] - 100) < 0.1
    print("ok test_totals_and_weights")


def test_by_symbol_rollup():
    c = A.combine([A.normalize(RH, "Robinhood"), A.normalize(RJ)])
    by = {h["symbol"]: h for h in c["holdings"]}
    # VOO is held in both accounts -> shares and value are summed, held_in == 2
    assert abs(by["VOO"]["shares"] - 3.93) < 1e-6
    assert abs(by["VOO"]["market_value"] - (1347.68 + 1403.56)) < 0.01
    assert by["VOO"]["held_in"] == 2
    # VOO cost basis is unknown in RH -> combined VOO cost basis/gain is None
    assert by["VOO"]["cost_basis"] is None and by["VOO"]["gain"] is None
    # QQQ only in RJ, full basis -> gain computed
    assert by["QQQ"]["held_in"] == 1
    assert abs(by["QQQ"]["gain"] - (1442.90 - 1008.73)) < 0.01
    # holdings sorted by market value, VOO first
    assert c["holdings"][0]["symbol"] == "VOO"
    print("ok test_by_symbol_rollup")


def test_normalize_infers_equity_from_holdings():
    snap = {"account": "X", "holdings": [{"symbol": "AAA", "shares": 2, "price": 10}], "summary": {"cash": 5}}
    n = A.normalize(snap, "X")
    assert abs(n["holdings"][0]["market_value"] - 20) < 1e-6   # value from shares*price
    assert abs(n["equity"] - 25) < 1e-6                        # holdings + cash
    print("ok test_normalize_infers_equity_from_holdings")


def _run():
    for fn in (test_totals_and_weights, test_by_symbol_rollup, test_normalize_infers_equity_from_holdings):
        fn()


if __name__ == "__main__":
    _run()

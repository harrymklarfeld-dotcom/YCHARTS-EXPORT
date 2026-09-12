import math, sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from portfolio.ledger import build_positions, summarize, xirr


def test_average_cost_and_fifo():
    trades = [
        {"symbol": "MU", "date": "2026-01-05", "side": "buy", "qty": 10, "price": 100},
        {"symbol": "MU", "date": "2026-02-05", "side": "buy", "qty": 10, "price": 200},
        {"symbol": "MU", "date": "2026-03-05", "side": "sell", "qty": 5, "price": 300},
    ]
    p = build_positions(trades)["MU"]
    assert p.qty == 15
    assert math.isclose(p.avg_cost, 150.0)
    assert math.isclose(p.realized_avg, 5 * (300 - 150))   # 750
    assert math.isclose(p.realized_fifo, 5 * (300 - 100))  # 1000
    assert len(p.lots) == 2 and math.isclose(p.lots[0].qty, 5)


def test_fees_flow_into_basis():
    p = build_positions([{"symbol": "X", "date": "2026-01-01", "side": "buy", "qty": 4, "price": 10, "fees": 2}])["X"]
    assert math.isclose(p.avg_cost, 10.5)


def test_summary_roll_up():
    trades = [{"symbol": "A", "date": "2026-01-01", "side": "buy", "qty": 10, "price": 10},
              {"symbol": "B", "date": "2026-01-01", "side": "buy", "qty": 1, "price": 100}]
    s = summarize(build_positions(trades), {"A": 12, "B": 90}, cash=50, prev_close={"A": 11, "B": 90})
    assert math.isclose(s["equity"], 120 + 90 + 50)
    assert math.isclose(s["unrealized"], 20 - 10)
    assert math.isclose(s["day_change"], 10)
    a = next(r for r in s["holdings"] if r["symbol"] == "A")
    assert math.isclose(a["weight_pct"], 120 / 260 * 100)


def test_xirr():
    r = xirr([("2025-01-01", -1000), ("2026-01-01", 1100)])
    assert abs(r - 0.10) < 1e-3


if __name__ == "__main__":
    for name, fn in list(globals().items()):
        if name.startswith("test_"):
            fn(); print("ok", name)

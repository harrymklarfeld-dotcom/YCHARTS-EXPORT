import math, sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from portfolio.backtest import run, replay, period_starts, STRATEGIES
from datetime import date, timedelta


def series(n=600, start=date(2020, 1, 1), fn=lambda i: 100 + i * 0.1):
    out, d, i = [], start, 0
    while len(out) < n:
        if d.weekday() < 5:
            out.append((d.isoformat(), fn(i))); i += 1
        d += timedelta(days=1)
    return out


def test_period_starts_monthly():
    s = series(60)
    m = period_starts([d for d, _ in s], "M")
    assert "2020-01-01" in m and "2020-02-03" in m and len(m) == 3


def test_dca_invests_everything_and_tracks_avg_cost():
    s = series()
    r = run(s, "dca", 100, "M")
    n = len(period_starts([d for d, _ in s], "M"))
    assert math.isclose(r["contributed"], 100 * n)
    assert r["cash_uninvested"] < 1e-6
    assert r["buys"] == n and r["sells"] == 0
    # rising series: avg cost below final price, lump sum beats DCA
    assert r["avg_cost"] < s[-1][1]
    assert run(s, "lump_sum", 100, "M")["final_value"] > r["final_value"]


def test_flat_series_all_strategies_break_even():
    s = series(fn=lambda i: 50.0)
    for k in STRATEGIES:
        r = run(s, k, 100, "M")
        assert abs(r["profit"]) < 1e-6, k


def test_falling_then_flat_dca_beats_lump():
    s = series(fn=lambda i: max(50, 100 - i * 0.2))
    assert run(s, "dca", 100, "M")["final_value"] > run(s, "lump_sum", 100, "M")["final_value"]


def test_replay_matches_ledger():
    s = series()
    idx = dict(s)
    trades = [{"symbol": "X", "date": s[10][0], "side": "buy", "qty": 2, "price": idx[s[10][0]]},
              {"symbol": "X", "date": s[200][0], "side": "sell", "qty": 1, "price": idx[s[200][0]]}]
    r = replay(trades, {"X": s})
    expected = 1 * s[-1][1] + 1 * idx[s[200][0]]
    assert math.isclose(r["final_value"], expected)
    assert math.isclose(r["contributed"], 2 * idx[s[10][0]])


if __name__ == "__main__":
    for name, fn in list(globals().items()):
        if name.startswith("test_"):
            fn(); print("ok", name)

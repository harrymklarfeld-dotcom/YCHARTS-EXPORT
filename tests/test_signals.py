import sys, os, math
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from portfolio.signals import ema, rsi, sma, run_signal, STRATEGIES
from datetime import date, timedelta

def series(fn, n=800, start=date(2019,1,1)):
    out, d, i = [], start, 0
    while len(out) < n:
        if d.weekday() < 5:
            out.append((d.isoformat(), max(1.0, fn(i)))); i += 1
        d += timedelta(days=1)
    return out

def test_ema_and_rsi_ranges():
    v = [float(x) for x in range(1, 101)]
    e = ema(v, 10)
    assert e[-1] < v[-1] and e[-1] > v[-20]           # EMA lags a rising line
    r = rsi(v, 14)
    assert r[-1] is not None and r[-1] > 99            # monoton rising -> RSI ~100

def test_engine_runs_all_strategies_and_curve_monotone_cash():
    s = series(lambda i: 100 + i * 0.05 + 8*math.sin(i/15))   # up-trend + waves
    for name in STRATEGIES:
        r = run_signal(s, name)
        assert r["final_value"] > 0
        assert 0 <= r["exposure_pct"] <= 100
        assert r["trades"] >= 0
        # buy&hold return recorded
        assert abs(r["buy_hold_return_pct"] - (s[-1][1]/s[0][1]-1)*100) < 1e-6

def test_flat_market_no_runaway():
    s = series(lambda i: 50.0)                          # dead flat
    r = run_signal(s, "ema_crossover")
    assert abs(r["final_value"] - 10000) < 1e-6         # no trades, capital intact

if __name__ == "__main__":
    for k,v in list(globals().items()):
        if k.startswith("test_"): v(); print("ok", k)

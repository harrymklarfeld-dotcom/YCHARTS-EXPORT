#!/usr/bin/env python3
"""
Technical-signal backtester for swing trading. Tests the setups people actually run
(EMA crossover, RSI pullback, MACD, Bollinger reversion, Donchian breakout) with an
ATR-style stop, long-only, one position at a time, and reports the honest scoreboard:
win rate, average win/loss, profit factor, expectancy per trade, CAGR, max drawdown,
exposure, and the all-important comparison to just buying and holding.

    python -m portfolio.signals MU --strategy ema_crossover
    python -m portfolio.signals MU NVDA VOO --strategy rsi_pullback --start 2018-01-01
    python -m portfolio.signals MU --all -o reports/signals_MU.md

Indicators are computed from daily CLOSES (what the price cache stores). ATR is therefore a
close-to-close proxy; VWAP/anchored VWAP needs volume and is noted where it would apply.
Nothing here places a trade. The point is to see whether a setup would have beaten buy-and-hold
BEFORE you trade it — most don't, which is exactly what a backtest is for.
"""
from __future__ import annotations

import argparse
import math
import os
import statistics
import sys
from datetime import date

from .backtest import fmt_money, fmt_pct


# ------------------------------------------------------------------ indicators
def ema(vals, period):
    k = 2 / (period + 1)
    out = [None] * len(vals)
    e = vals[0]
    for i, v in enumerate(vals):
        e = v if i == 0 else v * k + e * (1 - k)
        out[i] = e
    return out


def sma(vals, period):
    out = [None] * len(vals)
    for i in range(len(vals)):
        if i + 1 >= period:
            out[i] = sum(vals[i + 1 - period:i + 1]) / period
    return out


def rsi(vals, period=14):
    out = [None] * len(vals)
    gains, losses = 0.0, 0.0
    for i in range(1, len(vals)):
        ch = vals[i] - vals[i - 1]
        g, l = max(ch, 0), max(-ch, 0)
        if i <= period:
            gains += g; losses += l
            if i == period:
                ag, al = gains / period, losses / period
                out[i] = 100 - 100 / (1 + (ag / al if al else 1e9))
        else:
            ag = (ag * (period - 1) + g) / period
            al = (al * (period - 1) + l) / period
            out[i] = 100 - 100 / (1 + (ag / al if al else 1e9))
    return out


def macd(vals, fast=12, slow=26, sig=9):
    ef, es = ema(vals, fast), ema(vals, slow)
    line = [ (a - b) if a is not None and b is not None else None for a, b in zip(ef, es)]
    valid = [x if x is not None else 0.0 for x in line]
    signal = ema(valid, sig)
    hist = [ (l - s) if l is not None else None for l, s in zip(line, signal)]
    return line, signal, hist


def atr_close(vals, period=14):
    """Close-to-close ATR proxy: rolling mean of |daily change|. (True ATR needs high/low.)"""
    tr = [0.0] + [abs(vals[i] - vals[i - 1]) for i in range(1, len(vals))]
    return sma(tr, period)


def bollinger(vals, period=20, mult=2.0):
    mid = sma(vals, period)
    up, lo = [None] * len(vals), [None] * len(vals)
    for i in range(len(vals)):
        if i + 1 >= period:
            sd = statistics.pstdev(vals[i + 1 - period:i + 1])
            up[i] = mid[i] + mult * sd; lo[i] = mid[i] - mult * sd
    return lo, mid, up


# ------------------------------------------------------------------ strategies
# Each returns (entry[i]->bool, exit[i]->bool) given precomputed context.
def strat_ema_crossover(px, p):
    fast, slow = ema(px, p.get("fast", 9)), ema(px, p.get("slow", 21))
    entry = [i > 0 and fast[i] > slow[i] and fast[i - 1] <= slow[i - 1] for i in range(len(px))]
    exit_ = [i > 0 and fast[i] < slow[i] and fast[i - 1] >= slow[i - 1] for i in range(len(px))]
    return entry, exit_


def strat_rsi_pullback(px, p):
    """Uptrend (price>200MA), buy when RSI dips below 35 and turns up; exit RSI>70 or trend break."""
    r = rsi(px, p.get("rsi", 14)); ma = sma(px, p.get("trend", 200))
    entry, exit_ = [False] * len(px), [False] * len(px)
    for i in range(1, len(px)):
        up = ma[i] is not None and px[i] > ma[i]
        if r[i] is not None and r[i - 1] is not None:
            if up and r[i - 1] < 35 and r[i] >= r[i - 1] and r[i] < 45:
                entry[i] = True
            if r[i] > 70 or (ma[i] is not None and px[i] < ma[i]):
                exit_[i] = True
    return entry, exit_


def strat_macd(px, p):
    line, signal, hist = macd(px)
    entry = [i > 0 and hist[i] is not None and hist[i] > 0 and (hist[i - 1] or 0) <= 0 for i in range(len(px))]
    exit_ = [i > 0 and hist[i] is not None and hist[i] < 0 and (hist[i - 1] or 0) >= 0 for i in range(len(px))]
    return entry, exit_


def strat_bollinger(px, p):
    lo, mid, up = bollinger(px, p.get("period", 20), p.get("mult", 2.0))
    entry = [i > 0 and lo[i] is not None and lo[i - 1] is not None and px[i - 1] < lo[i - 1] and px[i] >= lo[i] for i in range(len(px))]
    exit_ = [mid[i] is not None and px[i] >= mid[i] for i in range(len(px))]
    return entry, exit_


def strat_donchian(px, p):
    n = p.get("lookback", 20)
    entry, exit_ = [False] * len(px), [False] * len(px)
    for i in range(n, len(px)):
        if px[i] >= max(px[i - n:i]):
            entry[i] = True
        if px[i] <= min(px[i - n // 2:i]):
            exit_[i] = True
    return entry, exit_


STRATEGIES = {"ema_crossover": strat_ema_crossover, "rsi_pullback": strat_rsi_pullback,
              "macd": strat_macd, "bollinger": strat_bollinger, "donchian": strat_donchian}
LABELS = {"ema_crossover": "EMA 9/21 crossover", "rsi_pullback": "RSI pullback in uptrend",
          "macd": "MACD histogram cross", "bollinger": "Bollinger reversion", "donchian": "Donchian breakout",
          "buy_hold": "Buy & hold"}


# ------------------------------------------------------------------ engine
def run_signal(prices, strategy, params=None, atr_mult=2.0, capital=10000.0):
    """Long-only, one position, close-to-close fills. Exit on opposite signal, an ATR stop
    (atr_mult x ATR below entry), or the last bar. Returns a metrics dict incl. the equity curve."""
    p = params or {}
    dates = [d for d, _ in prices]
    px = [v for _, v in prices]
    entry_sig, exit_sig = STRATEGIES[strategy](px, p)
    atr = atr_close(px, p.get("atr", 14))
    cash, shares, holding = capital, 0.0, False
    entry_px = entry_i = stop = 0.0
    trades, curve, invested_days = [], [], 0
    for i, price in enumerate(px):
        if holding:
            invested_days += 1
            hit_stop = price <= stop
            if hit_stop or exit_sig[i] or i == len(px) - 1:
                trades.append({"entry_date": dates[entry_i], "exit_date": dates[i], "entry": entry_px,
                               "exit": price, "ret": price / entry_px - 1, "bars": i - entry_i,
                               "reason": "stop" if hit_stop else ("signal" if exit_sig[i] else "end")})
                cash = shares * price; shares = 0.0; holding = False
        elif entry_sig[i] and atr[i]:
            shares = cash / price; cash = 0.0; holding = True
            entry_px = price; entry_i = i; stop = price - atr_mult * atr[i]
        curve.append((dates[i], round(cash + shares * price, 2)))
    return metrics(strategy, trades, curve, prices, invested_days, capital)


def metrics(strategy, trades, curve, prices, invested_days, capital):
    px = [v for _, v in prices]
    years = max(1e-9, (date.fromisoformat(curve[-1][0]) - date.fromisoformat(curve[0][0])).days / 365.25)
    final = curve[-1][1]
    rets = [t["ret"] for t in trades]
    wins = [r for r in rets if r > 0]; losses = [r for r in rets if r <= 0]
    gross_win = sum(wins); gross_loss = -sum(losses)
    bh_final = capital * (px[-1] / px[0])
    peak, mdd = -1, 0.0
    for _, v in curve:
        peak = max(peak, v); mdd = min(mdd, v / peak - 1) if peak > 0 else mdd
    return {"strategy": strategy, "start": curve[0][0], "end": curve[-1][0],
            "final_value": final, "total_return_pct": (final / capital - 1) * 100,
            "cagr_pct": ((final / capital) ** (1 / years) - 1) * 100 if final > 0 else None,
            "trades": len(trades), "win_rate_pct": (len(wins) / len(trades) * 100) if trades else None,
            "avg_win_pct": (statistics.fmean(wins) * 100) if wins else None,
            "avg_loss_pct": (statistics.fmean(losses) * 100) if losses else None,
            "profit_factor": (gross_win / gross_loss) if gross_loss else (math.inf if gross_win else None),
            "expectancy_pct": (statistics.fmean(rets) * 100) if rets else None,
            "max_drawdown_pct": mdd * 100, "exposure_pct": invested_days / len(curve) * 100,
            "avg_hold_days": (statistics.fmean([t["bars"] for t in trades])) if trades else None,
            "buy_hold_final": bh_final, "buy_hold_return_pct": (px[-1] / px[0] - 1) * 100,
            "beat_buy_hold": final > bh_final, "curve": curve}


def table(results):
    cols = [("Strategy", lambda r: LABELS.get(r["strategy"], r["strategy"])),
            ("Final", lambda r: fmt_money(r["final_value"])),
            ("Return", lambda r: fmt_pct(r["total_return_pct"], 1, True)),
            ("CAGR", lambda r: fmt_pct(r["cagr_pct"], 1)),
            ("Trades", lambda r: str(r["trades"])),
            ("Win rate", lambda r: fmt_pct(r["win_rate_pct"], 0) if r["win_rate_pct"] is not None else "--"),
            ("Avg win", lambda r: fmt_pct(r["avg_win_pct"], 1) if r["avg_win_pct"] is not None else "--"),
            ("Avg loss", lambda r: fmt_pct(r["avg_loss_pct"], 1) if r["avg_loss_pct"] is not None else "--"),
            ("Profit factor", lambda r: f"{r['profit_factor']:.2f}" if r["profit_factor"] not in (None, math.inf) else "--"),
            ("Expectancy/trade", lambda r: fmt_pct(r["expectancy_pct"], 2, True) if r["expectancy_pct"] is not None else "--"),
            ("Max DD", lambda r: fmt_pct(r["max_drawdown_pct"], 1)),
            ("Time in mkt", lambda r: fmt_pct(r["exposure_pct"], 0)),
            ("Beat B&H?", lambda r: ("yes" if r["beat_buy_hold"] else "no") + f" (B&H {fmt_pct(r['buy_hold_return_pct'],0,True)})")]
    lines = ["| " + " | ".join(c[0] for c in cols) + " |", "|" + "|".join(["---"] * len(cols)) + "|"]
    for r in results:
        lines.append("| " + " | ".join(str(c[1](r)) for c in cols) + " |")
    return "\n".join(lines)


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("symbols", nargs="+")
    ap.add_argument("--strategy", default="ema_crossover", choices=list(STRATEGIES))
    ap.add_argument("--all", action="store_true", help="run every strategy")
    ap.add_argument("--start", default="2016-01-01")
    ap.add_argument("--atr-mult", type=float, default=2.0)
    ap.add_argument("-o", "--out")
    args = ap.parse_args(argv)
    from .prices import load_prices
    blocks = []
    for sym in args.symbols:
        try:
            prices = [p for p in load_prices(sym, args.start, quiet=True) if p[0] >= args.start]
        except Exception as e:  # noqa: BLE001
            print(f"skip {sym}: {e}", file=sys.stderr); continue
        if len(prices) < 250:
            print(f"skip {sym}: need more history", file=sys.stderr); continue
        strat_list = list(STRATEGIES) if args.all else [args.strategy]
        results = [run_signal(prices, s, atr_mult=args.atr_mult) for s in strat_list]
        bh = dict(results[0]); bh["strategy"] = "buy_hold"; bh["final_value"] = bh["buy_hold_final"]
        bh.update({"total_return_pct": bh["buy_hold_return_pct"], "trades": 0, "win_rate_pct": None,
                   "avg_win_pct": None, "avg_loss_pct": None, "profit_factor": None, "expectancy_pct": None,
                   "exposure_pct": 100, "beat_buy_hold": False, "cagr_pct": None, "max_drawdown_pct": bh["max_drawdown_pct"]})
        blocks.append(f"## {sym}: {prices[0][0]} to {prices[-1][0]}\n\n" + table(results + [bh]) + "\n")
    body = ("# Swing-trading signal backtests\n\n*Long-only, one position, ATR stop. Close-based indicators; "
            "a stop or opposite signal exits. The last column is the only one that matters: did the setup beat "
            "just holding? Read research/backtesting_and_average_cost.md on why most don't.*\n\n" + "\n".join(blocks))
    if args.out:
        os.makedirs(os.path.dirname(args.out) or ".", exist_ok=True)
        open(args.out, "w", encoding="utf-8").write(body); print(f"wrote {args.out}")
    else:
        print(body)


if __name__ == "__main__":
    main()

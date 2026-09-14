#!/usr/bin/env python3
"""
Backtest accumulation / average-cost strategies on daily prices, and replay
your real trades against them.

    python -m portfolio.backtest MU --start 2016-01-01 --amount 500 --freq M
    python -m portfolio.backtest MU NVDA VOO --start 2018-01-01 -o reports/backtest.md
    python -m portfolio.backtest --replay data/portfolio/snapshot.json   # your actual trades vs DCA of the same dollars
    python -m portfolio.backtest DEMO_MU --start 2023-10-01               # synthetic series from portfolio.demo_data

Strategies (all fund from the same periodic contribution so they are comparable):
  lump_sum        everything on day one (the benchmark the literature says wins ~2/3 of the time)
  dca             buy the contribution every period, no matter what
  value_avg       Edleson value averaging: hold the position to a target path that grows
                  by the contribution each period; buy the shortfall, sell the excess
  dip_dca         DCA, plus spend banked cash when price is X% below your average cost
                  or Y% below the 52-week high
  below_avg_only  only buy when price is below your average cost (cash piles up otherwise);
                  the "never raise your average" rule
  avg_cost_bands  DCA, trim a slice when price runs 30%+ above average cost, redeploy below it
  ma200_filter    DCA only while price is above its 200-day average; sell everything on a
                  cross below and re-enter on a cross above (the trend-following version)

Metrics use money-weighted (XIRR) and time-weighted returns, max drawdown, Sharpe,
final average cost vs price, and cash drag. Tables are written YCharts-style.
"""
from __future__ import annotations

import argparse
import json
import math
import os
import statistics
import sys
from dataclasses import dataclass, field
from datetime import date, datetime

from .ledger import xirr

# ------------------------------------------------------------------ formatting (YCharts style)


def fmt_money(v, dec=2):
    if v is None or (isinstance(v, float) and math.isnan(v)):
        return "--"
    a = abs(v)
    for k, s in ((1e12, "T"), (1e9, "B"), (1e6, "M")):
        if a >= k:
            return f"{'-' if v < 0 else ''}{a / k:.3f}{s}"
    return f"{'-' if v < 0 else ''}${a:,.{dec}f}"


def fmt_pct(v, dec=2, sign=False):
    if v is None or (isinstance(v, float) and (math.isnan(v) or math.isinf(v))):
        return "--"
    return f"{v:+.{dec}f}%" if sign else f"{v:.{dec}f}%"


def fmt_date(s):
    return datetime.strptime(str(s)[:10], "%Y-%m-%d").strftime("%b %d, %Y")


# ------------------------------------------------------------------ engine


@dataclass
class State:
    cash: float = 0.0            # contributed but uninvested
    qty: float = 0.0
    avg_cost: float = 0.0
    contributed: float = 0.0
    realized: float = 0.0
    trades: list = field(default_factory=list)
    flows: list = field(default_factory=list)      # (date, amount) for XIRR, contributions negative
    high: float = 0.0            # trailing 52w high
    invested_days: int = 0

    def buy(self, d, px, dollars):
        dollars = min(dollars, self.cash)
        if dollars <= 0.005:
            return
        q = dollars / px
        self.avg_cost = (self.qty * self.avg_cost + dollars) / (self.qty + q)
        self.qty += q; self.cash -= dollars
        self.trades.append((d, "buy", q, px))

    def sell(self, d, px, qty):
        qty = min(qty, self.qty)
        if qty <= 1e-9:
            return
        self.realized += qty * (px - self.avg_cost)
        self.qty -= qty; self.cash += qty * px
        if self.qty < 1e-9:
            self.qty, self.avg_cost = 0.0, 0.0
        self.trades.append((d, "sell", qty, px))

    def value(self, px):
        return self.qty * px + self.cash


def period_starts(dates: list[str], freq: str) -> set[str]:
    """First trading day of each period. freq: D, W, 2W, M, Q."""
    out, last_key, wk = set(), None, 0
    for d in dates:
        y, m, dd = int(d[:4]), int(d[5:7]), int(d[8:10])
        iso = date(y, m, dd).isocalendar()
        key = {"D": d, "W": (iso[0], iso[1]), "2W": (iso[0], iso[1] // 2), "M": (y, m),
               "Q": (y, (m - 1) // 3)}[freq]
        if key != last_key:
            out.add(d); last_key = key
    return out


def run(prices: list[tuple[str, float]], strategy: str, amount: float, freq: str = "M", params: dict | None = None,
        lump_total: float | None = None) -> dict:
    p = {"dip_pct": 10.0, "dd_pct": 20.0, "dip_multiple": 2.0, "take_profit_pct": 30.0, "trim_frac": 0.25,
         "va_growth": 0.0, "va_allow_sell": True, "ma_days": 200}
    p.update(params or {})
    dates = [d for d, _ in prices]
    px = dict(prices)
    starts = period_starts(dates, freq)
    n_periods = len(starts)
    st = State()
    curve, ma_win, closes = [], [], []
    target = 0.0
    above_ma = None
    if strategy == "lump_sum":
        total = lump_total if lump_total is not None else amount * n_periods
        st.cash += total; st.contributed += total; st.flows.append((dates[0], -total))
        st.buy(dates[0], px[dates[0]], total)

    for i, d in enumerate(dates):
        price = px[d]
        closes.append(price)
        st.high = max(price, max(closes[-252:]))
        ma = statistics.fmean(closes[-p["ma_days"]:]) if len(closes) >= p["ma_days"] else None
        is_start = d in starts
        if strategy != "lump_sum" and is_start:
            st.cash += amount; st.contributed += amount; st.flows.append((d, -amount))

        if strategy == "dca" and is_start:
            st.buy(d, price, amount)
        elif strategy == "value_avg" and is_start:
            target += amount
            target *= (1 + p["va_growth"])
            gap = target - st.qty * price
            if gap > 0:
                st.buy(d, price, gap)
            elif p["va_allow_sell"]:
                st.sell(d, price, -gap / price)
        elif strategy == "dip_dca":
            if is_start:
                st.buy(d, price, amount / 2)  # half goes in regardless, half is banked for dips
            dip = st.avg_cost and price <= st.avg_cost * (1 - p["dip_pct"] / 100)
            dd = st.high and price <= st.high * (1 - p["dd_pct"] / 100)
            if (dip or dd) and st.cash >= amount:
                st.buy(d, price, amount * p["dip_multiple"])
        elif strategy == "below_avg_only":
            if st.qty == 0 and is_start:
                st.buy(d, price, amount)
            elif price < st.avg_cost and st.cash > 0:
                st.buy(d, price, st.cash)
        elif strategy == "avg_cost_bands":
            if is_start:
                if st.avg_cost and price < st.avg_cost:
                    st.buy(d, price, st.cash)          # below average: deploy everything banked
                else:
                    st.buy(d, price, amount)           # above average: just the regular contribution
            if st.avg_cost and price >= st.avg_cost * (1 + p["take_profit_pct"] / 100):
                last_trim = next((t for t in reversed(st.trades) if t[1] == "sell"), None)
                if not last_trim or (i - dates.index(last_trim[0])) >= 21:
                    st.sell(d, price, st.qty * p["trim_frac"])
        elif strategy == "ma200_filter":
            if ma is not None:
                now_above = price > ma
                if above_ma is None:
                    above_ma = now_above
                if now_above and not above_ma:
                    st.buy(d, price, st.cash)             # re-entry
                elif not now_above and above_ma:
                    st.sell(d, price, st.qty)             # exit
                above_ma = now_above
                if is_start and now_above:
                    st.buy(d, price, st.cash)
            elif is_start:
                st.buy(d, price, amount)                  # before MA exists, plain DCA
        if st.qty > 0:
            st.invested_days += 1
        curve.append((d, st.value(price), st.contributed, st.qty * price))
    return metrics(strategy, st, curve, prices)


def metrics(name: str, st: State, curve, prices) -> dict:
    d_end, v_end = curve[-1][0], curve[-1][1]
    contributed = st.contributed
    price_end = prices[-1][1]
    flows = st.flows + [(d_end, v_end)]
    irr = xirr(flows)
    # time-weighted: chain daily returns of the invested portion (cash included, contributions removed)
    twr = 1.0
    daily = []
    prev_v, prev_c = None, None
    for d, v, c, _ in curve:
        if prev_v is not None and prev_v > 0:
            r = (v - (c - prev_c)) / prev_v - 1
            twr *= 1 + r; daily.append(r)
        prev_v, prev_c = v, c
    years = max(1e-9, (date.fromisoformat(d_end) - date.fromisoformat(curve[0][0])).days / 365.25)
    cagr_twr = twr ** (1 / years) - 1 if twr > 0 else None
    peak, mdd = -1, 0.0
    for _, v, c, _ in curve:
        # drawdown on value net of contributions is noisy; use value vs running peak of value with same contributions
        peak = max(peak, v)
        if peak > 0:
            mdd = min(mdd, v / peak - 1)
    vol = statistics.pstdev(daily) * math.sqrt(252) if len(daily) > 2 else None
    sharpe = ((statistics.fmean(daily) * 252 - 0.04) / vol) if vol else None
    return {"strategy": name, "start": curve[0][0], "end": d_end, "contributed": contributed,
            "final_value": v_end, "profit": v_end - contributed,
            "total_return_pct": (v_end / contributed - 1) * 100 if contributed else None,
            "xirr_pct": irr * 100 if irr is not None else None,
            "cagr_twr_pct": cagr_twr * 100 if cagr_twr is not None else None,
            "max_drawdown_pct": mdd * 100, "vol_pct": vol * 100 if vol else None, "sharpe": sharpe,
            "shares": st.qty, "avg_cost": st.avg_cost, "price": price_end,
            "price_vs_avg_cost_pct": (price_end / st.avg_cost - 1) * 100 if st.avg_cost else None,
            "cash_uninvested": st.cash, "cash_drag_pct": st.cash / v_end * 100 if v_end else None,
            "time_invested_pct": st.invested_days / len(curve) * 100, "buys": sum(1 for t in st.trades if t[1] == "buy"),
            "sells": sum(1 for t in st.trades if t[1] == "sell"), "realized": st.realized,
            "curve": curve}


STRATEGIES = ["lump_sum", "dca", "value_avg", "dip_dca", "below_avg_only", "avg_cost_bands", "ma200_filter"]
LABELS = {"lump_sum": "Lump sum (day 1)", "dca": "Dollar-cost average", "value_avg": "Value averaging",
          "dip_dca": "DCA + buy the dip", "below_avg_only": "Buy below avg cost only",
          "avg_cost_bands": "Avg-cost bands (trim +30%)", "ma200_filter": "DCA w/ 200-day MA filter",
          "actual": "Your actual trades"}


# ------------------------------------------------------------------ replay real trades


def replay(trades: list[dict], prices_by_sym: dict[str, list[tuple[str, float]]], dividends=None) -> dict:
    """Mark your real trades to market every day. Contributions = buy dollars on the day; sells return cash."""
    syms = sorted({t["symbol"] for t in trades})
    dates = sorted(set().union(*[{d for d, _ in prices_by_sym[s]} for s in syms if s in prices_by_sym]))
    idx = {s: dict(prices_by_sym[s]) for s in syms if s in prices_by_sym}
    last = {s: None for s in syms}
    ti, held, avg, cash, contributed, flows, curve = 0, {s: 0.0 for s in syms}, {s: 0.0 for s in syms}, 0.0, 0.0, [], []
    tsorted = sorted(trades, key=lambda t: t["date"])
    start = tsorted[0]["date"]
    dates = [d for d in dates if d >= start]
    realized = 0.0
    for d in dates:
        while ti < len(tsorted) and tsorted[ti]["date"] <= d:
            t = tsorted[ti]; s = t["symbol"]; q = float(t["qty"]); p = float(t["price"]); ti += 1
            if s not in idx:
                continue
            if t["side"].lower().startswith("b"):
                cost = q * p + float(t.get("fees") or 0)
                avg[s] = (held[s] * avg[s] + cost) / (held[s] + q); held[s] += q
                contributed += cost; flows.append((t["date"], -cost))
            else:
                realized += q * (p - avg[s]); held[s] -= q
                cash += q * p - float(t.get("fees") or 0)
                if held[s] < 1e-9:
                    held[s], avg[s] = 0.0, 0.0
        for s in idx:
            last[s] = idx[s].get(d, last[s])
        mv = sum(held[s] * (last[s] or 0) for s in idx)
        curve.append((d, mv + cash, contributed, mv))
    st = State(cash=cash, qty=1.0, contributed=contributed, realized=realized, flows=flows)
    st.trades = [(t["date"], t["side"], t["qty"], t["price"]) for t in tsorted]
    st.invested_days = len(curve)
    m = metrics("actual", st, curve, [(d, 1.0) for d in dates])
    m.update({"shares": None, "avg_cost": None, "price": None, "price_vs_avg_cost_pct": None})
    return m


# ------------------------------------------------------------------ report


def table(results: list[dict], title: str) -> str:
    cols = [("Strategy", lambda r: LABELS.get(r["strategy"], r["strategy"]), "l"),
            ("Contributed", lambda r: fmt_money(r["contributed"]), "r"),
            ("Final Value", lambda r: fmt_money(r["final_value"]), "r"),
            ("Profit", lambda r: fmt_money(r["profit"]), "r"),
            ("Total Return", lambda r: fmt_pct(r["total_return_pct"]), "r"),
            ("Money-Weighted (XIRR)", lambda r: fmt_pct(r["xirr_pct"]), "r"),
            ("Time-Weighted CAGR", lambda r: fmt_pct(r["cagr_twr_pct"]), "r"),
            ("Max Drawdown", lambda r: fmt_pct(r["max_drawdown_pct"]), "r"),
            ("Sharpe", lambda r: "--" if r["sharpe"] is None else f"{r['sharpe']:.2f}", "r"),
            ("Avg Cost", lambda r: "--" if r["avg_cost"] is None else fmt_money(r["avg_cost"]), "r"),
            ("Price vs Avg Cost", lambda r: fmt_pct(r["price_vs_avg_cost_pct"], sign=True), "r"),
            ("Cash Drag", lambda r: fmt_pct(r["cash_drag_pct"]), "r"),
            ("Time Invested", lambda r: fmt_pct(r["time_invested_pct"], 0), "r"),
            ("Buys / Sells", lambda r: f"{r['buys']} / {r['sells']}", "r")]
    lines = [f"### {title}", "", "| " + " | ".join(c[0] for c in cols) + " |",
             "|" + "|".join("---:" if c[2] == "r" else "---" for c in cols) + "|"]
    for r in results:
        lines.append("| " + " | ".join(str(c[1](r)) for c in cols) + " |")
    return "\n".join(lines) + "\n"


def yearly_table(results: list[dict]) -> str:
    """Calendar-year profit by strategy, YCharts timeseries style (newest first)."""
    years = sorted({c[0][:4] for c in results[0]["curve"]}, reverse=True)
    lines = ["| Year | " + " | ".join(LABELS.get(r["strategy"], r["strategy"]) for r in results) + " |",
             "|---|" + "---:|" * len(results)]
    for y in years:
        cells = []
        for r in results:
            pts = [c for c in r["curve"] if c[0].startswith(y)]
            prev = [c for c in r["curve"] if c[0] < y]
            v0, c0 = (prev[-1][1], prev[-1][2]) if prev else (0.0, 0.0)
            v1, c1 = pts[-1][1], pts[-1][2]
            profit = (v1 - c1) - (v0 - c0)
            cells.append(fmt_money(profit))
        lines.append(f"| {y} | " + " | ".join(cells) + " |")
    return "\n".join(lines) + "\n"


def report(sym: str, prices, results: list[dict], amount: float, freq: str) -> str:
    fr = {"D": "daily", "W": "weekly", "2W": "every two weeks", "M": "monthly", "Q": "quarterly"}[freq]
    first, last = prices[0], prices[-1]
    hdr = [f"## {sym}: {fmt_date(first[0])} to {fmt_date(last[0])}", "",
           f"*Price {fmt_money(first[1])} -> {fmt_money(last[1])} "
           f"({fmt_pct((last[1] / first[1] - 1) * 100, sign=True)}). Contribution {fmt_money(amount)} {fr}; "
           f"lump sum invests the same total on day one. Sharpe uses a 4% risk-free rate. "
           f"No taxes or commissions; dividends not reinvested unless the price series is total-return.*", ""]
    best = max(results, key=lambda r: r["final_value"])
    hdr.append(f"**Best final value: {LABELS.get(best['strategy'])} ({fmt_money(best['final_value'])}).** "
               f"Lowest drawdown: {LABELS.get(min(results, key=lambda r: abs(r['max_drawdown_pct']))['strategy'])}. "
               f"Highest money-weighted return: {LABELS.get(max(results, key=lambda r: r['xirr_pct'] or -1e9)['strategy'])}.")
    hdr.append("")
    return "\n".join(hdr) + table(results, "Strategy comparison") + "\n#### Profit by calendar year\n\n" + yearly_table(results)


def load_prices_any(sym: str, start: str):
    from .prices import load_prices
    return load_prices(sym, start)


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("symbols", nargs="*")
    ap.add_argument("--start", default="2016-01-01")
    ap.add_argument("--end", default=None)
    ap.add_argument("--amount", type=float, default=500.0, help="contribution per period")
    ap.add_argument("--freq", default="M", choices=["D", "W", "2W", "M", "Q"])
    ap.add_argument("--strategies", default="all")
    ap.add_argument("--dip-pct", type=float, default=10.0)
    ap.add_argument("--dd-pct", type=float, default=20.0)
    ap.add_argument("--take-profit-pct", type=float, default=30.0)
    ap.add_argument("--replay", help="snapshot.json: replay your real trades and compare with DCA of the same dollars")
    ap.add_argument("-o", "--out", help="write markdown report here")
    ap.add_argument("--json", help="write raw results (with curves) here")
    args = ap.parse_args(argv)

    strategies = STRATEGIES if args.strategies == "all" else args.strategies.split(",")
    params = {"dip_pct": args.dip_pct, "dd_pct": args.dd_pct, "take_profit_pct": args.take_profit_pct}
    sections, raw = [], {}

    if args.replay:
        with open(args.replay, encoding="utf-8") as fh:
            snap = json.load(fh)
        trades = snap.get("trades") or []
        if not trades:
            sys.exit("snapshot has no trades; re-run robinhood_sync without --no-orders or use csv_import")
        syms = sorted({t["symbol"] for t in trades})
        start = min(t["date"] for t in trades)
        pbs = {}
        for s in syms:
            try:
                pbs[s] = load_prices_any(s, start)
            except Exception as e:  # noqa: BLE001
                print(f"skip {s}: {e}", file=sys.stderr)
        actual = replay([t for t in trades if t["symbol"] in pbs], pbs, snap.get("dividends"))
        sections.append("## Your actual trades, marked to market\n\n" + table([actual], "Actual"))
        raw["actual"] = actual
        # per-symbol: what if the same dollars had been DCA'd monthly?
        for s in syms:
            if s not in pbs:
                continue
            st = [t for t in trades if t["symbol"] == s]
            spent = sum(float(t["qty"]) * float(t["price"]) for t in st if t["side"].lower().startswith("b"))
            prices = [p for p in pbs[s] if p[0] >= st[0]["date"]]
            n_m = len(period_starts([d for d, _ in prices], "M"))
            per = spent / max(1, n_m)
            act = replay(st, {s: pbs[s]})
            res = [act] + [run(prices, k, per, "M", params, lump_total=spent) for k in ("lump_sum", "dca", "dip_dca", "below_avg_only")]
            sections.append(report(s, prices, res, per, "M"))
            raw[s] = res

    for sym in args.symbols:
        prices = load_prices_any(sym, args.start)
        if args.end:
            prices = [p for p in prices if p[0] <= args.end]
        if len(prices) < 60:
            print(f"{sym}: not enough data", file=sys.stderr); continue
        res = [run(prices, k, args.amount, args.freq, params) for k in strategies]
        sections.append(report(sym, prices, res, args.amount, args.freq))
        raw[sym] = res

    body = ("# Backtest: accumulation strategies\n\n*Generated " + date.today().strftime("%b %d, %Y") +
            ". See research/backtesting_and_average_cost.md for what these strategies are and the evidence behind them.*\n\n"
            + "\n".join(sections))
    if args.out:
        os.makedirs(os.path.dirname(args.out) or ".", exist_ok=True)
        with open(args.out, "w", encoding="utf-8") as fh:
            fh.write(body)
        print(f"wrote {args.out}")
    else:
        print(body)
    if args.json:
        with open(args.json, "w", encoding="utf-8") as fh:
            json.dump({k: [{kk: vv for kk, vv in r.items()} for r in v] if isinstance(v, list) else v
                       for k, v in raw.items()}, fh)
        print(f"wrote {args.json}")


if __name__ == "__main__":
    main()

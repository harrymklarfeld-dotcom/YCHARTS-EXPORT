#!/usr/bin/env python3
"""
Trade ledger -> positions, average cost, realized / unrealized P&L.

This is the one piece of arithmetic everything else (Robinhood sync, CSV
import, the backtester, the dashboard) shares, so it is pure Python with no
dependencies and is unit-tested in tests/test_ledger.py.

Two cost-basis views are produced from the same trades:

  * average cost  - what Robinhood shows on the position screen and what the
                    "buy below your average" strategies key off.
  * FIFO lots     - what the IRS assumes unless you pick lots; used for the
                    realized-gain / holding-period table.

A Trade is a dict with: symbol, date (YYYY-MM-DD), side ('buy'|'sell'),
qty (float), price (float), fees (float, optional), note (optional).
"""
from __future__ import annotations

from collections import defaultdict
from dataclasses import dataclass, field
from datetime import date, datetime


def _d(s) -> date:
    if isinstance(s, date):
        return s
    return datetime.strptime(str(s)[:10], "%Y-%m-%d").date()


@dataclass
class Lot:
    date: date
    qty: float
    price: float          # per-share cost including fees


@dataclass
class Position:
    symbol: str
    qty: float = 0.0
    avg_cost: float = 0.0            # average-cost basis per share (fees included)
    realized_avg: float = 0.0        # realized P&L under the average-cost method
    realized_fifo: float = 0.0       # realized P&L under FIFO
    lots: list[Lot] = field(default_factory=list)
    buys: int = 0
    sells: int = 0
    invested: float = 0.0            # gross $ of buys
    proceeds: float = 0.0            # gross $ of sells
    first_buy: date | None = None
    last_trade: date | None = None
    dividends: float = 0.0
    untracked_sold: float = 0.0      # shares sold that no buy in the ledger accounts for (DRIP/transfer/split)
    realized_log: list = field(default_factory=list)   # (date, qty, realized_avg, realized_fifo, proceeds) per sell

    @property
    def cost_basis(self) -> float:
        return self.qty * self.avg_cost

    def market(self, price: float) -> dict:
        mv = self.qty * price
        unreal = mv - self.cost_basis
        pct = (price / self.avg_cost - 1.0) * 100 if self.avg_cost else 0.0
        return {"market_value": mv, "unrealized": unreal, "unrealized_pct": pct,
                "vs_avg_cost_pct": pct}

    def apply(self, t: dict) -> None:
        qty, price = float(t["qty"]), float(t["price"])
        fees = float(t.get("fees") or 0.0)
        when = _d(t["date"])
        self.last_trade = when
        if t["side"].lower().startswith("b"):
            eff = price + (fees / qty if qty else 0.0)
            total_cost = self.cost_basis + qty * eff
            self.qty += qty
            self.avg_cost = total_cost / self.qty if self.qty else 0.0
            self.lots.append(Lot(when, qty, eff))
            self.buys += 1
            self.invested += qty * price + fees
            self.first_buy = self.first_buy or when
        else:
            if qty > self.qty + 1e-9:
                # Shares we never saw bought (dividend reinvestment, ACATS transfer, split not in the
                # order feed). Treat the excess as acquired at the current average cost so realized P&L
                # is not inflated; robinhood_sync reconciles this against Robinhood's position first.
                excess = qty - self.qty
                self.untracked_sold += excess
                basis = self.avg_cost or price
                total_cost = self.cost_basis + excess * basis
                self.qty += excess
                self.avg_cost = total_cost / self.qty if self.qty else 0.0
                self.lots.insert(0, Lot(when, excess, basis))
            net = price - (fees / qty if qty else 0.0)
            r_avg = qty * (net - self.avg_cost)
            fifo_before = self.realized_fifo
            # average cost
            self.realized_avg += r_avg
            self.qty -= qty
            if self.qty < 1e-9:
                self.qty, self.avg_cost = 0.0, 0.0
            # FIFO
            remaining = qty
            while remaining > 1e-9 and self.lots:
                lot = self.lots[0]
                take = min(lot.qty, remaining)
                self.realized_fifo += take * (net - lot.price)
                lot.qty -= take
                remaining -= take
                if lot.qty < 1e-9:
                    self.lots.pop(0)
            self.sells += 1
            self.proceeds += qty * price - fees
            self.realized_log.append((when.isoformat(), qty, r_avg, self.realized_fifo - fifo_before, qty * price - fees))
            if self.qty == 0.0:
                self.lots = []

    def to_dict(self) -> dict:
        return {"symbol": self.symbol, "qty": round(self.qty, 6), "avg_cost": round(self.avg_cost, 4),
                "cost_basis": round(self.cost_basis, 2), "realized_avg": round(self.realized_avg, 2),
                "realized_fifo": round(self.realized_fifo, 2), "buys": self.buys, "sells": self.sells,
                "invested": round(self.invested, 2), "proceeds": round(self.proceeds, 2),
                "first_buy": self.first_buy.isoformat() if self.first_buy else None,
                "last_trade": self.last_trade.isoformat() if self.last_trade else None,
                "dividends": round(self.dividends, 2), "untracked_sold": round(self.untracked_sold, 6),
                "lots": [{"date": l.date.isoformat(), "qty": round(l.qty, 6), "price": round(l.price, 4)}
                         for l in self.lots]}


def build_positions(trades: list[dict], dividends: list[dict] | None = None) -> dict[str, Position]:
    """Replay trades in date order. dividends: [{symbol, date, amount}]."""
    pos: dict[str, Position] = {}
    for t in sorted(trades, key=lambda x: (str(x["date"]), 0 if x["side"].lower().startswith("b") else 1)):
        p = pos.setdefault(t["symbol"].upper(), Position(t["symbol"].upper()))
        p.apply(t)
    for dv in dividends or []:
        s = dv["symbol"].upper()
        if s in pos:
            pos[s].dividends += float(dv["amount"])
    return pos


def summarize(positions: dict[str, Position], prices: dict[str, float], cash: float = 0.0,
              prev_close: dict[str, float] | None = None) -> dict:
    """Portfolio-level roll-up with per-holding rows, YCharts-style field names."""
    rows, tot_mv, tot_cost, tot_day = [], 0.0, 0.0, 0.0
    prev_close = prev_close or {}
    for s, p in sorted(positions.items()):
        if p.qty <= 0:
            continue
        px = float(prices.get(s, p.avg_cost))
        m = p.market(px)
        pc = float(prev_close.get(s) or px)
        day = (px - pc) * p.qty
        rows.append({"symbol": s, "qty": p.qty, "avg_cost": p.avg_cost, "price": px,
                     "prev_close": pc, "day_change": day,
                     "day_change_pct": (px / pc - 1) * 100 if pc else 0.0,
                     "market_value": m["market_value"], "cost_basis": p.cost_basis,
                     "unrealized": m["unrealized"], "unrealized_pct": m["unrealized_pct"],
                     "realized": p.realized_avg, "dividends": p.dividends,
                     "first_buy": p.first_buy.isoformat() if p.first_buy else None,
                     "buys": p.buys, "sells": p.sells})
        tot_mv += m["market_value"]; tot_cost += p.cost_basis; tot_day += day
    for r in rows:
        r["weight_pct"] = (r["market_value"] / (tot_mv + cash) * 100) if (tot_mv + cash) else 0.0
    realized = sum(p.realized_avg for p in positions.values())
    divs = sum(p.dividends for p in positions.values())
    return {"holdings": rows, "cash": cash, "equity": tot_mv + cash, "market_value": tot_mv,
            "cost_basis": tot_cost, "unrealized": tot_mv - tot_cost,
            "unrealized_pct": ((tot_mv / tot_cost - 1) * 100) if tot_cost else 0.0,
            "day_change": tot_day,
            "day_change_pct": (tot_day / (tot_mv - tot_day) * 100) if (tot_mv - tot_day) else 0.0,
            "realized": realized, "dividends": divs,
            "total_return": (tot_mv - tot_cost) + realized + divs}


def ytd_summary(positions: dict, trades: list[dict], dividends: list[dict] | None, transfers: list[dict] | None,
                curve: list[dict] | None, equity_now: float, year: int | None = None) -> dict:
    """Calendar-year roll-up. transfers: [{date, amount}] deposits positive. curve: [{t, equity}] daily."""
    year = year or date.today().year
    y0 = f"{year}-01-01"
    buys = sum(float(t["qty"]) * float(t["price"]) + float(t.get("fees") or 0) for t in trades
               if t["date"] >= y0 and t["side"].lower().startswith("b") and not str(t.get("note", "")).startswith("reconciled"))
    sells = sum(float(t["qty"]) * float(t["price"]) - float(t.get("fees") or 0) for t in trades
                if t["date"] >= y0 and not t["side"].lower().startswith("b"))
    divs = sum(float(d["amount"]) for d in (dividends or []) if d["date"] >= y0)
    deps = sum(float(x["amount"]) for x in (transfers or []) if x["date"] >= y0)
    realized = sum(r[2] for p in positions.values() for r in p.realized_log if r[0] >= y0)
    realized_fifo = sum(r[3] for p in positions.values() for r in p.realized_log if r[0] >= y0)
    start_eq, start_t = None, None
    prev = None
    for pt in curve or []:
        t = str(pt["t"])[:10]
        if t >= y0:
            start_eq, start_t = (prev or pt)["equity"], (prev or pt)["t"]
            break
        prev = pt
    ret = (equity_now - start_eq - deps) if start_eq is not None else None
    return {"year": year, "buys": buys, "sells": sells, "net_invested": buys - sells, "dividends": divs,
            "net_deposits": deps, "realized": realized, "realized_fifo": realized_fifo,
            "equity_start": start_eq, "equity_start_date": str(start_t)[:10] if start_t else None,
            "equity_now": equity_now, "return": ret,
            "return_pct": (ret / (start_eq + max(0.0, deps)) * 100) if ret is not None and (start_eq + max(0.0, deps)) else None}


def _twr(curve, deposits_by_date):
    """Time-weighted return over the given daily [{t,equity}] points, removing deposits/withdrawals.
    This is the 'how did my investments do' number Robinhood shows for each period."""
    tw, prev = 1.0, None
    for pt in curve:
        v = pt.get("equity")
        if v is None:
            continue
        d = str(pt["t"])[:10]
        if prev is not None and prev > 0:
            flow = deposits_by_date.get(d, 0.0)
            tw *= (v - flow) / prev
        prev = v
    return tw - 1.0


def period_returns(curve: list[dict], transfers: list[dict] | None) -> dict:
    """Robinhood-style returns for 1D/1W/1M/3M/YTD/1Y/All from the daily equity curve."""
    from datetime import timedelta
    pts = [{"t": str(p["t"])[:10], "equity": p.get("equity")} for p in (curve or []) if p.get("equity") is not None]
    if len(pts) < 2:
        return {}
    dep = {}
    for x in transfers or []:
        dep[x["date"]] = dep.get(x["date"], 0.0) + float(x["amount"])
    end = date.fromisoformat(pts[-1]["t"])
    windows = {"1D": pts[-2]["t"], "1W": (end - timedelta(days=7)).isoformat(),
               "1M": (end - timedelta(days=30)).isoformat(), "3M": (end - timedelta(days=91)).isoformat(),
               "YTD": f"{end.year}-01-01", "1Y": (end - timedelta(days=365)).isoformat(), "All": pts[0]["t"]}
    out = {}
    for label, start in windows.items():
        seg = [p for p in pts if p["t"] >= start]
        if len(seg) < 2 and label != "1D":
            seg = pts[-2:] if label == "1D" else seg
        if len(seg) >= 2:
            out[label] = {"pct": _twr(seg, dep) * 100, "from": seg[0]["t"], "to": seg[-1]["t"],
                          "equity_from": seg[0]["equity"], "equity_to": seg[-1]["equity"]}
    return out


def xirr(cashflows: list[tuple], guess: float = 0.1) -> float | None:
    """Money-weighted annual return. cashflows: [(date, amount)] with deposits negative,
    ending value positive. Newton with bisection fallback; None if it can't converge."""
    if len(cashflows) < 2:
        return None
    cf = [(_d(d), float(a)) for d, a in cashflows]
    t0 = cf[0][0]
    yrs = [((d - t0).days / 365.25, a) for d, a in cf]
    if not any(a > 0 for _, a in yrs) or not any(a < 0 for _, a in yrs):
        return None

    def f(r):
        return sum(a / (1 + r) ** t for t, a in yrs)

    lo, hi = -0.9999, 10.0
    flo, fhi = f(lo), f(hi)
    if flo * fhi > 0:
        return None
    for _ in range(200):
        mid = (lo + hi) / 2
        fm = f(mid)
        if abs(fm) < 1e-7:
            return mid
        if flo * fm < 0:
            hi, fhi = mid, fm
        else:
            lo, flo = mid, fm
    return (lo + hi) / 2

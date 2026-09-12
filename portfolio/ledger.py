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
                raise ValueError(f"{self.symbol}: selling {qty} but only hold {self.qty} on {when}")
            net = price - (fees / qty if qty else 0.0)
            # average cost
            self.realized_avg += qty * (net - self.avg_cost)
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
            if self.qty == 0.0:
                self.lots = []

    def to_dict(self) -> dict:
        return {"symbol": self.symbol, "qty": round(self.qty, 6), "avg_cost": round(self.avg_cost, 4),
                "cost_basis": round(self.cost_basis, 2), "realized_avg": round(self.realized_avg, 2),
                "realized_fifo": round(self.realized_fifo, 2), "buys": self.buys, "sells": self.sells,
                "invested": round(self.invested, 2), "proceeds": round(self.proceeds, 2),
                "first_buy": self.first_buy.isoformat() if self.first_buy else None,
                "last_trade": self.last_trade.isoformat() if self.last_trade else None,
                "dividends": round(self.dividends, 2),
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

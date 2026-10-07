"""Read-only view over one company record from companies.json."""
from __future__ import annotations

import math
from typing import Any

from .fmt import short_name


def _num(v: Any) -> float | None:
    if isinstance(v, bool) or v is None:
        return None
    if isinstance(v, (int, float)) and math.isfinite(v):
        return float(v)
    return None


class Co:
    def __init__(self, raw: dict):
        self.raw = raw
        self.ticker: str = raw["ticker"]
        self.name: str = short_name(raw.get("name") or raw["ticker"])
        self.label = f"{self.name} ({self.ticker})"
        self.fy: int | None = raw.get("latest_fy")
        self.price = _num(raw.get("price"))
        self._f = raw.get("fundamentals") or {}
        self._m = raw.get("metrics") or {}
        self._h = raw.get("history") or {}

    def f(self, key: str) -> float | None:
        return _num(self._f.get(key))

    def m(self, key: str) -> float | None:
        return _num(self._m.get(key))

    def hist(self, key: str) -> list[tuple[int, float]]:
        out = []
        for row in self._h.get(key) or []:
            if isinstance(row, (list, tuple)) and len(row) == 2:
                v = _num(row[1])
                if isinstance(row[0], int) and v is not None:
                    out.append((row[0], v))
        return sorted(out)

    def hist_at(self, key: str, fy: int) -> float | None:
        return dict(self.hist(key)).get(fy)

    def gross_profit(self) -> float | None:
        gp = self.f("gross_profit")
        if gp is not None:
            return gp
        rev, cost = self.f("revenue"), self.f("cost_of_revenue")
        return rev - cost if rev is not None and cost is not None else None

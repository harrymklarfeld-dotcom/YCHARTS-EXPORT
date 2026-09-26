"""Look-through metrics: "if this fund were one company".

Inputs are (weight, company metrics) pairs for the holdings that map to companies.json.
Weights are re-normalised over the holdings that have each metric.

- weighted_pe: harmonic. P/E_fund = 1 / Σ(wᵢ · Eᵢ/Pᵢ) / Σwᵢ. Using earnings yields (E/P)
  lets loss-makers pull the P/E up instead of being dropped, and avoids one huge P/E
  dominating. Uses ``earnings_yield`` when present, else 1/``pe``. Null if the weighted
  earnings yield is ≤ 0.
- weighted_fcf_yield, weighted_roic: plain weighted averages.
- coverage_pct: share of the fund's net assets (decimal) held in companies we have data for.
"""
from __future__ import annotations

import math


def _finite(v) -> bool:
    return isinstance(v, (int, float)) and not isinstance(v, bool) and math.isfinite(v)


def earnings_yield_of(metrics: dict) -> float | None:
    ey = metrics.get("earnings_yield")
    if _finite(ey):
        return float(ey)
    pe = metrics.get("pe")
    if _finite(pe) and pe > 0:
        return 1.0 / float(pe)
    return None


def _weighted_mean(pairs: list[tuple[float, float]]) -> tuple[float | None, float]:
    tw = sum(w for w, _ in pairs)
    if tw <= 0:
        return None, 0.0
    return sum(w * v for w, v in pairs) / tw, tw


def look_through(rows: list[tuple[float, dict]]) -> dict:
    """rows: [(weight_decimal, metrics_dict)] for mapped holdings only."""
    rows = [(float(w), m or {}) for w, m in rows if _finite(w) and w > 0]
    ey, _ = _weighted_mean([(w, e) for w, m in rows if (e := earnings_yield_of(m)) is not None])
    fcf, _ = _weighted_mean([(w, float(m["fcf_yield"])) for w, m in rows if _finite(m.get("fcf_yield"))])
    roic, _ = _weighted_mean([(w, float(m["roic"])) for w, m in rows if _finite(m.get("roic"))])
    coverage = sum(w for w, _ in rows)
    return {
        "weighted_pe": round(1.0 / ey, 4) if ey is not None and ey > 0 else None,
        "weighted_fcf_yield": round(fcf, 6) if fcf is not None else None,
        "weighted_roic": round(roic, 6) if roic is not None else None,
        "coverage_pct": round(min(coverage, 1.0), 6),
    }

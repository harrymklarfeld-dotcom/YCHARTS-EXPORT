"""Contract `metrics`, implemented exactly per tenbagger/CONTRACT.md. Null-safe:
anything not computable is None (never NaN / inf)."""
from __future__ import annotations

import math

DEFAULT_TAX_RATE = 0.21
MAX_TAX_RATE = 0.35

METRIC_FIELDS = [
    "market_cap", "enterprise_value", "pe", "ps", "pb", "ev_ebitda",
    "fcf_yield", "earnings_yield", "dividend_yield",
    "gross_margin", "operating_margin", "net_margin", "fcf_margin",
    "roe", "roa", "roic",
    "debt_to_equity", "current_ratio", "net_cash",
    "revenue_growth_yoy", "eps_growth_yoy", "revenue_cagr_3y",
]


def _ok(x) -> bool:
    return x is not None and isinstance(x, (int, float)) and math.isfinite(x)


def div(a, b, positive_denominator: bool = True):
    """a / b, or None if either is missing, b == 0, or (by default) b <= 0."""
    if not (_ok(a) and _ok(b)) or b == 0 or (positive_denominator and b < 0):
        return None
    r = a / b
    return r if math.isfinite(r) else None


def tax_rate(income_tax, pretax_income) -> float:
    """income_tax / pretax_income clamped to [0, 0.35]; 0.21 if not computable."""
    r = div(income_tax, pretax_income)
    if r is None:
        return DEFAULT_TAX_RATE
    return min(max(r, 0.0), MAX_TAX_RATE)


def free_cash_flow(operating_cash_flow, capex):
    if not (_ok(operating_cash_flow) and _ok(capex)):
        return None
    return operating_cash_flow - abs(capex)


def growth(this, prior):
    """this / prior − 1; None if prior <= 0 (growth off a negative base is meaningless)."""
    r = div(this, prior)
    return None if r is None else r - 1


def cagr(end, start, years: int):
    """(end / start)^(1/years) − 1; None unless both are positive."""
    if not (_ok(end) and _ok(start)) or end <= 0 or start <= 0:
        return None
    return (end / start) ** (1.0 / years) - 1


def compute_metrics(f: dict, price, prior: dict | None = None, prior3: dict | None = None) -> dict:
    """f = latest-FY fundamentals; prior = FY-1 fundamentals; prior3 = FY-3 fundamentals."""
    g = lambda k: f.get(k)  # noqa: E731
    prior = prior or {}
    prior3 = prior3 or {}

    market_cap = price * g("shares_diluted") if _ok(price) and _ok(g("shares_diluted")) else None
    debt, cash = g("total_debt"), g("cash")
    ev = None
    if _ok(market_cap):
        ev = market_cap + (debt if _ok(debt) else 0) - (cash if _ok(cash) else 0)

    eps = g("eps_diluted")
    pe = div(price, eps) if _ok(eps) and eps > 0 else None

    ebitda = g("operating_income") + g("d_and_a") if _ok(g("operating_income")) and _ok(g("d_and_a")) else None
    ev_ebitda = div(ev, ebitda) if _ok(ev) else None

    fcf = g("free_cash_flow")
    if not _ok(fcf):
        fcf = free_cash_flow(g("operating_cash_flow"), g("capex"))

    rev, equity = g("revenue"), g("total_equity")
    invested = None
    if _ok(equity):
        invested = (debt if _ok(debt) else 0) + equity - (cash if _ok(cash) else 0)
    roic = None
    if _ok(g("operating_income")) and _ok(invested) and invested > 0:
        roic = g("operating_income") * (1 - tax_rate(g("income_tax"), g("pretax_income"))) / invested

    m = {
        "market_cap": market_cap,
        "enterprise_value": ev,
        "pe": pe,
        "ps": div(market_cap, rev),
        "pb": div(market_cap, equity),
        "ev_ebitda": ev_ebitda,
        "fcf_yield": div(fcf, market_cap),
        "earnings_yield": div(eps, price),
        "dividend_yield": div(g("dividends_paid"), market_cap),
        "gross_margin": div(g("gross_profit"), rev),
        "operating_margin": div(g("operating_income"), rev),
        "net_margin": div(g("net_income"), rev),
        "fcf_margin": div(fcf, rev),
        "roe": div(g("net_income"), equity),
        "roa": div(g("net_income"), g("total_assets")),
        "roic": roic,
        "debt_to_equity": div(debt, equity),
        "current_ratio": div(g("current_assets"), g("current_liabilities")),
        "net_cash": cash - debt if _ok(cash) and _ok(debt) else None,
        "revenue_growth_yoy": growth(rev, prior.get("revenue")),
        "eps_growth_yoy": growth(eps, prior.get("eps_diluted")),
        "revenue_cagr_3y": cagr(rev, prior3.get("revenue"), 3),
    }
    return {k: clean(m[k]) for k in METRIC_FIELDS}


def clean(v, ndigits: int = 6):
    """Round ratios, keep large USD values as ints, map NaN/inf to None."""
    if v is None or not isinstance(v, (int, float)) or not math.isfinite(v):
        return None
    if abs(v) >= 1e6:
        return int(round(v))
    return round(float(v), ndigits)

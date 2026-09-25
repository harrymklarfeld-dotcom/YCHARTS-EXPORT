import math

import pytest

from pipeline.metrics import METRIC_FIELDS, cagr, clean, compute_metrics, div, growth, tax_rate

F = {  # simple round numbers so each formula is checkable by hand
    "revenue": 1000.0, "gross_profit": 400.0, "operating_income": 200.0, "net_income": 150.0,
    "eps_diluted": 1.5, "shares_diluted": 100.0, "operating_cash_flow": 250.0, "capex": 50.0,
    "free_cash_flow": 200.0, "dividends_paid": 40.0, "cash": 300.0, "total_assets": 2000.0,
    "total_equity": 1000.0, "total_debt": 500.0, "current_assets": 600.0, "current_liabilities": 300.0,
    "d_and_a": 100.0, "income_tax": 40.0, "pretax_income": 200.0,
}
PRICE = 30.0


def approx(x):
    return pytest.approx(x, rel=1e-6, abs=1e-6)  # metrics are rounded to 6 dp

PRIOR = {"revenue": 800.0, "eps_diluted": 1.2}
PRIOR3 = {"revenue": 512.0}


def m(f=None, price=PRICE, prior=PRIOR, prior3=PRIOR3):
    return compute_metrics({**F, **(f or {})}, price, prior, prior3)


def test_all_formulas():
    r = m()
    assert set(r) == set(METRIC_FIELDS)
    assert r["market_cap"] == approx(3000)                       # price × shares
    assert r["enterprise_value"] == approx(3000 + 500 - 300)       # mc + debt − cash
    assert r["pe"] == approx(30 / 1.5)
    assert r["ps"] == approx(3000 / 1000)
    assert r["pb"] == approx(3000 / 1000)
    assert r["ev_ebitda"] == approx(3200 / (200 + 100))
    assert r["fcf_yield"] == approx(200 / 3000)
    assert r["earnings_yield"] == approx(1.5 / 30)
    assert r["dividend_yield"] == approx(40 / 3000)
    assert r["gross_margin"] == approx(0.4)
    assert r["operating_margin"] == approx(0.2)
    assert r["net_margin"] == approx(0.15)
    assert r["fcf_margin"] == approx(0.2)
    assert r["roe"] == approx(0.15)
    assert r["roa"] == approx(0.075)
    assert r["roic"] == approx(200 * (1 - 0.2) / (500 + 1000 - 300))
    assert r["debt_to_equity"] == approx(0.5)
    assert r["current_ratio"] == approx(2.0)
    assert r["net_cash"] == approx(-200)
    assert r["revenue_growth_yoy"] == approx(0.25)
    assert r["eps_growth_yoy"] == approx(0.25)
    assert r["revenue_cagr_3y"] == approx((1000 / 512) ** (1 / 3) - 1)


def test_fcf_computed_when_missing():
    r = m({"free_cash_flow": None})
    assert r["fcf_yield"] == approx((250 - 50) / 3000)


def test_negative_eps_nulls_pe_but_keeps_earnings_yield():
    r = m({"eps_diluted": -2.0})
    assert r["pe"] is None
    assert r["earnings_yield"] == approx(-2 / 30)
    assert m({"eps_diluted": 0})["pe"] is None


@pytest.mark.parametrize("equity", [0, -10.0, None])
def test_nonpositive_or_missing_equity(equity):
    r = m({"total_equity": equity})
    assert r["pb"] is None and r["roe"] is None and r["debt_to_equity"] is None


def test_ev_ebitda_null_when_ebitda_nonpositive_or_missing():
    assert m({"operating_income": -150.0, "d_and_a": 100.0})["ev_ebitda"] is None
    assert m({"operating_income": -100.0, "d_and_a": 100.0})["ev_ebitda"] is None
    assert m({"d_and_a": None})["ev_ebitda"] is None


def test_no_price_nulls_market_metrics_only():
    r = m(price=None)
    for k in ("market_cap", "enterprise_value", "pe", "ps", "pb", "ev_ebitda", "fcf_yield",
              "earnings_yield", "dividend_yield"):
        assert r[k] is None, k
    assert r["gross_margin"] == approx(0.4)


def test_zero_revenue_nulls_margins_and_ps():
    r = m({"revenue": 0})
    for k in ("ps", "gross_margin", "operating_margin", "net_margin", "fcf_margin"):
        assert r[k] is None, k


def test_missing_debt_and_cash_treated_as_zero_in_ev_only():
    r = m({"total_debt": None, "cash": None})
    assert r["enterprise_value"] == approx(3000)
    assert r["net_cash"] is None and r["debt_to_equity"] is None


def test_roic_null_when_invested_capital_nonpositive():
    assert m({"cash": 5000.0})["roic"] is None
    assert m({"operating_income": None})["roic"] is None


def test_tax_rate_clamp_and_default():
    assert tax_rate(40, 200) == approx(0.2)
    assert tax_rate(-50, 200) == 0.0
    assert tax_rate(150, 200) == 0.35
    assert tax_rate(10, -100) == 0.21
    assert tax_rate(None, 100) == 0.21
    assert tax_rate(10, 0) == 0.21
    r = m({"income_tax": None})
    assert r["roic"] == approx(200 * 0.79 / 1200)


def test_growth_and_cagr_null_cases():
    assert growth(10, None) is None and growth(10, 0) is None and growth(10, -5) is None
    assert growth(-5, 10) == approx(-1.5)
    assert cagr(100, 0, 3) is None and cagr(-1, 10, 3) is None and cagr(100, None, 3) is None
    r = m(prior={}, prior3={})
    assert r["revenue_growth_yoy"] is None and r["eps_growth_yoy"] is None and r["revenue_cagr_3y"] is None
    assert m(prior={"revenue": 800, "eps_diluted": -1.0})["eps_growth_yoy"] is None


def test_no_nan_or_inf_ever():
    r = m({k: float("nan") for k in F}, price=float("inf"))
    assert all(v is None for v in r.values())
    assert div(1, 0) is None and div(float("nan"), 1) is None
    assert clean(float("inf")) is None and clean(float("nan")) is None
    for v in m().values():
        assert v is None or math.isfinite(v)


def test_clean_rounding():
    assert clean(1234567.8) == 1234568 and isinstance(clean(3e9), int)
    assert clean(0.1234567891) == 0.123457

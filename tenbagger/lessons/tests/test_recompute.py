"""Every answer is recomputed here, independently of lessons/formulas.py, straight from companies.json."""
import math
import re
from statistics import mean

import pytest

from .conftest import all_questions


def F(c, k):
    return c["fundamentals"].get(k)


def H(c, k, fy):
    return dict((y, v) for y, v in c["history"].get(k, [])).get(fy)


def gp(c):
    return F(c, "gross_profit") if F(c, "gross_profit") is not None else F(c, "revenue") - F(c, "cost_of_revenue")


def mcap(c):
    return c["price"] * F(c, "shares_diluted")


def fcf(c):
    return F(c, "operating_cash_flow") - F(c, "capex")


def net_cash(c):
    return F(c, "cash") - F(c, "total_debt")


def tax_rate(c):
    p, t = F(c, "pretax_income"), F(c, "income_tax")
    return min(max(t / p, 0.0), 0.35) if p and p > 0 and t is not None else 0.21


def perp(c, r, g):
    return fcf(c) * (1 + g) / (r - g) + net_cash(c)


def two_stage(c, p):
    r, g, g1, n = p["discount_rate"], p["terminal_growth"], p["stage1_growth"], p["stage1_years"]
    f0 = fcf(c)
    pv = sum(f0 * (1 + g1) ** t / (1 + r) ** t for t in range(1, n + 1))
    tv = f0 * (1 + g1) ** n * (1 + g) / (r - g) / (1 + r) ** n
    return (pv + tv + net_cash(c)) / F(c, "shares_diluted")


EXPECTED = {
    "revenue": lambda c, p: F(c, "revenue"),
    "revenue_growth_yoy": lambda c, p: H(c, "revenue", c["latest_fy"]) / H(c, "revenue", c["latest_fy"] - 1) - 1,
    "revenue_cagr_3y": lambda c, p: (H(c, "revenue", c["latest_fy"]) / H(c, "revenue", c["latest_fy"] - 3)) ** (1 / 3) - 1,
    "gross_profit": lambda c, p: F(c, "revenue") - F(c, "cost_of_revenue"),
    "gross_margin": lambda c, p: gp(c) / F(c, "revenue"),
    "operating_margin": lambda c, p: F(c, "operating_income") / F(c, "revenue"),
    "net_margin": lambda c, p: F(c, "net_income") / F(c, "revenue"),
    "opex_ratio": lambda c, p: (gp(c) - F(c, "operating_income")) / F(c, "revenue"),
    "net_income": lambda c, p: F(c, "net_income"),
    "profitable": lambda c, p: F(c, "net_income") > 0,
    "eps_calc": lambda c, p: F(c, "net_income") / F(c, "shares_diluted"),
    "eps_growth_yoy": lambda c, p: H(c, "eps_diluted", c["latest_fy"]) / H(c, "eps_diluted", c["latest_fy"] - 1) - 1,
    "tax_rate": lambda c, p: F(c, "income_tax") / F(c, "pretax_income"),
    "cash_conversion": lambda c, p: F(c, "operating_cash_flow") / F(c, "net_income"),
    "ocf_gt_ni": lambda c, p: F(c, "operating_cash_flow") > F(c, "net_income"),
    "free_cash_flow": lambda c, p: fcf(c),
    "fcf_margin": lambda c, p: fcf(c) / F(c, "revenue"),
    "capex_intensity": lambda c, p: F(c, "capex") / F(c, "revenue"),
    "equity_calc": lambda c, p: F(c, "total_assets") - F(c, "total_liabilities"),
    "net_cash": lambda c, p: net_cash(c),
    "net_cash_positive": lambda c, p: F(c, "cash") > F(c, "total_debt"),
    "debt_to_equity": lambda c, p: F(c, "total_debt") / F(c, "total_equity"),
    "current_ratio": lambda c, p: F(c, "current_assets") / F(c, "current_liabilities"),
    "roe": lambda c, p: F(c, "net_income") / F(c, "total_equity"),
    "roa": lambda c, p: F(c, "net_income") / F(c, "total_assets"),
    "invested_capital": lambda c, p: F(c, "total_debt") + F(c, "total_equity") - F(c, "cash"),
    "roic": lambda c, p: F(c, "operating_income") * (1 - tax_rate(c)) / (F(c, "total_debt") + F(c, "total_equity") - F(c, "cash")),
    "equity_multiplier": lambda c, p: F(c, "total_assets") / F(c, "total_equity"),
    "roe_gt_roic": lambda c, p: EXPECTED["roe"](c, p) > EXPECTED["roic"](c, p),
    "market_cap": lambda c, p: mcap(c),
    "enterprise_value": lambda c, p: mcap(c) + F(c, "total_debt") - F(c, "cash"),
    "pe": lambda c, p: c["price"] / F(c, "eps_diluted"),
    "earnings_yield": lambda c, p: F(c, "eps_diluted") / c["price"],
    "ps": lambda c, p: mcap(c) / F(c, "revenue"),
    "ev_ebitda": lambda c, p: (mcap(c) + F(c, "total_debt") - F(c, "cash")) / (F(c, "operating_income") + F(c, "d_and_a")),
    "fcf_yield": lambda c, p: fcf(c) / mcap(c),
    "dividend_yield": lambda c, p: F(c, "dividends_paid") / mcap(c),
    "implied_growth": lambda c, p: p["required_return"] - F(c, "eps_diluted") / c["price"],
    "implied_gt_cagr": lambda c, p: EXPECTED["implied_growth"](c, p) > EXPECTED["revenue_cagr_3y"](c, p),
    "dcf_equity": lambda c, p: perp(c, p["discount_rate"], p["terminal_growth"]),
    "dcf_per_share": lambda c, p: perp(c, p["discount_rate"], p["terminal_growth"]) / F(c, "shares_diluted"),
    "dcf2_per_share": lambda c, p: two_stage(c, p),
    "price_vs_dcf": lambda c, p: c["price"] / (perp(c, p["discount_rate"], p["terminal_growth"]) / F(c, "shares_diluted")) - 1,
    "dcf_rate_sensitivity": lambda c, p: perp(c, p["discount_rate_low"], p["terminal_growth"]) / perp(c, p["discount_rate_high"], p["terminal_growth"]),
    "gm_range": lambda c, p: max(v for _, v in c["history"]["gross_margin"]) - min(v for _, v in c["history"]["gross_margin"]),
    "fcf_peak_to_avg": lambda c, p: max(v for _, v in c["history"]["free_cash_flow"]) / mean(v for _, v in c["history"]["free_cash_flow"]),
    "had_loss_year": lambda c, p: any(v < 0 for _, v in c["history"]["net_income"]),
}

_NUM = re.compile(r"^(-)?\$?([\d,]+(?:\.(\d+))?)([KMBT%x])?$")
_SCALE = {"K": 1e3, "M": 1e6, "B": 1e9, "T": 1e12, "%": 0.01, "x": 1, None: 1}


def parse_display(s):
    """'$254.5B' -> (254.5e9, half-unit of the last shown digit)."""
    m = _NUM.match(s.strip())
    assert m, f"unparseable choice {s!r}"
    sign, num, dec, suf = m.groups()
    scale = _SCALE[suf]
    v = float(num.replace(",", "")) * scale * (-1 if sign else 1)
    half = 0.5 * 10 ** -(len(dec) if dec else 0) * scale
    return v, half


def generated_questions(doc):
    return [(l, q) for _, l, q in all_questions(doc) if not l.get("personalizable")]


def by_ticker(companies):
    return {c["ticker"]: c for c in companies["companies"]}


def expected(companies, ticker, key, params):
    return EXPECTED[key](by_ticker(companies)[ticker], params or {})


def test_every_metric_key_has_independent_formula(built):
    _, doc, _ = built
    keys = {q["source"]["metrics"][0] for _, q in generated_questions(doc)}
    assert keys <= set(EXPECTED), keys - set(EXPECTED)


def test_single_company_answers(built):
    companies, doc, _ = built
    checked = 0
    for l, q in generated_questions(doc):
        if q["type"] in ("compare", "order"):
            continue
        src = q["source"]
        exp = expected(companies, src["ticker"], src["metrics"][0], src.get("params"))
        assert src["fy"] == by_ticker(companies)[src["ticker"]]["latest_fy"]
        if q["type"] == "numeric":
            assert math.isclose(q["answer"], exp, rel_tol=1e-6, abs_tol=1e-5), (q["id"], q["answer"], exp)
            assert abs(q["answer"] - exp) <= q["tolerance"]
        elif q["type"] == "multiple_choice":
            v, half = parse_display(q["choices"][q["answer"]])
            assert abs(v - exp) <= half * 1.0001 + 1e-9, (q["id"], q["choices"][q["answer"]], exp)
        elif q["type"] == "true_false":
            if "threshold" in src:
                assert (exp > src["threshold"]) == q["answer"], q["id"]
            else:
                assert bool(exp) == q["answer"], q["id"]
        checked += 1
    assert checked > 100


def test_compare_and_order_answers(built):
    companies, doc, _ = built
    for l, q in generated_questions(doc):
        src = q["source"]
        if q["type"] == "compare":
            vals = [expected(companies, t, src["metrics"][0], src.get("params")) for t in src["tickers"]]
            pick = max if src["direction"] == "higher" else min
            assert vals.index(pick(vals)) == q["answer"], q["id"]
            assert src["ticker"] == src["tickers"][q["answer"]]
            assert [c.endswith(f"({t})") for c, t in zip(q["choices"], src["tickers"])] == [True, True]
        elif q["type"] == "order":
            vals = [expected(companies, t, src["metrics"][0], src.get("params")) for t in src["tickers"]]
            assert sorted(range(len(vals)), key=lambda i: -vals[i]) == q["answer"], q["id"]
            for v, sv in zip(vals, src["values"]):
                assert math.isclose(v, sv, rel_tol=1e-6, abs_tol=1e-5)


def test_explanations_quote_the_answer(built):
    """The explanation's arithmetic must end in the same displayed value as the correct choice."""
    _, doc, _ = built
    for l, q in generated_questions(doc):
        if q["type"] == "multiple_choice":
            assert q["choices"][q["answer"]] in q["explanation"], q["id"]


@pytest.mark.parametrize("s,v", [("$254.5B", 254.5e9), ("12.6%", 0.126), ("18.2x", 18.2), ("-$4.3B", -4.3e9),
                                 ("$7.46", 7.46), ("$3.81T", 3.81e12)])
def test_parse_display(s, v):
    assert math.isclose(parse_display(s)[0], v)

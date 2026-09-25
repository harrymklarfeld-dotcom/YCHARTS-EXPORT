"""Our metric math must agree with the pipeline's `metrics` block (CONTRACT.md formulas)."""
import math

from lessons.company import Co
from lessons.formulas import REGISTRY

SHARED = ["gross_margin", "operating_margin", "net_margin", "fcf_margin", "roe", "roa", "roic", "debt_to_equity",
          "current_ratio", "net_cash", "market_cap", "enterprise_value", "pe", "ps", "ev_ebitda", "fcf_yield",
          "earnings_yield", "dividend_yield", "revenue_growth_yoy", "revenue_cagr_3y", "eps_growth_yoy"]


def test_metrics_match_pipeline(built):
    companies, _, _ = built
    mismatches = []
    for raw in companies["companies"]:
        co = Co(raw)
        for key in SHARED:
            ours, theirs = REGISTRY[key].compute(co), co.m(key)
            if ours is None or theirs is None:
                continue  # our guards are stricter than the pipeline's; skipping is fine
            if not math.isclose(ours.value, theirs, rel_tol=5e-3, abs_tol=5e-4):
                mismatches.append((co.ticker, key, ours.value, theirs))
    assert not mismatches, mismatches

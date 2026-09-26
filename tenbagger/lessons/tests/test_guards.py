"""Missing / negative / meaningless inputs are skipped, never turned into questions."""
import copy
import json

from lessons.company import Co
from lessons.formulas import REGISTRY
from lessons.generator import build


def test_nulls_everywhere_do_not_crash(fixture_companies):
    doc = copy.deepcopy(fixture_companies)
    for c in doc["companies"][::2]:
        for k in list(c["fundamentals"])[::3]:
            c["fundamentals"][k] = None
        c["history"] = {}
    out, report = build(doc, seed=1)
    json.dumps(out, allow_nan=False)
    assert report["counts"]["questions"] > 100


def test_negative_eps_has_no_pe(fixture_companies):
    intc = next(c for c in fixture_companies["companies"] if c["ticker"] == "INTC")
    co = Co(intc)
    for key in ("pe", "implied_growth", "tax_rate", "cash_conversion", "dcf_per_share", "eps_growth_yoy"):
        assert REGISTRY[key].compute(co) is None, key


def test_pe_questions_never_use_loss_makers(fixture_companies):
    out, _ = build(fixture_companies, seed=42)
    for u in out["units"]:
        for l in u["lessons"]:
            for q in l["questions"]:
                if q["source"]["metrics"][0] in ("pe", "implied_growth"):
                    assert "INTC" not in (q["source"].get("tickers") or [q["source"]["ticker"]])


def test_empty_companies_is_an_error():
    import pytest
    from lessons.generator import BuildError
    with pytest.raises(BuildError):
        build({"companies": []})

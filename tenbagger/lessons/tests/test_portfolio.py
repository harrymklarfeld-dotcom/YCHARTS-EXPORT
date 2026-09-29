"""Personalizable lessons: placeholders resolve and answers follow their expressions."""
import math

from lessons.portfolio import PLACEHOLDERS, evaluate, render

from .conftest import all_questions


def test_placeholders_declared_and_renderable(built):
    companies, doc, _ = built
    tick = {c["ticker"]: c for c in companies["companies"]}
    n = 0
    for _, l, q in all_questions(doc):
        if not l.get("personalizable"):
            continue
        p = q["personalization"]
        ex = tick[p["example"]["ticker"]]
        for text in (q["prompt"], q["explanation"]):
            import re
            for name in re.findall(r"\{holding\.(\w+)\}", text):
                assert name in PLACEHOLDERS
                assert f"holding.{name}" in p["placeholders"]
        assert "{" not in p["example"]["prompt"] and "{" not in p["example"]["explanation"]
        assert render(q["prompt"], ex) == p["example"]["prompt"]
        if p["answer_rule"] == "expr":
            v = evaluate(p["answer_expr"], ex)
            if q["type"] == "true_false":
                assert q["answer"] is bool(v)
            else:
                assert math.isclose(q["answer"], v, rel_tol=1e-6, abs_tol=1e-5)
        n += 1
    assert n >= 15


def test_evaluator_is_safe():
    import pytest
    with pytest.raises(ValueError):
        evaluate("__import__('os')", {})
    assert evaluate("fundamentals.x / fundamentals.y", {"fundamentals": {"x": 1, "y": 0}}) is None
    assert evaluate("price * 2", {"price": 3}) == 6

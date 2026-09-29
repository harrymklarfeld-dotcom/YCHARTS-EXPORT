"""Education, not advice: scan every piece of generated prose for banned phrases."""
import pytest

from lessons.curriculum import UNITS
from lessons.portfolio import PORTFOLIO_UNIT, TEMPLATES
from lessons.safety import scan


def test_generated_output_is_clean(built):
    _, doc, _ = built
    assert scan(doc) == []


def test_raw_templates_and_intros_are_clean():
    texts = [u.summary for u in UNITS + [PORTFOLIO_UNIT]] + [l.intro for u in UNITS + [PORTFOLIO_UNIT] for l in u.lessons]
    texts += [l.title for u in UNITS for l in u.lessons]
    for ts in TEMPLATES.values():
        for t in ts:
            texts += [t["prompt"], t["explanation"], *t.get("choices", [])]
    assert scan(texts) == []


@pytest.mark.parametrize("bad", ["You should buy MU now", "Strong Buy rating", "12-month price target of $150",
                                 "NVDA looks undervalued", "time to sell", "HOLD", "we recommend it",
                                 "this stock is cheap", "guaranteed returns", "it will outperform"])
def test_scanner_catches_advice(bad):
    assert scan({"prompt": bad})


@pytest.mark.parametrize("ok", ["What a company sells", "your largest holding", "shareholders' equity",
                                "margin of safety", "buybacks shrink the share count", "threshold"])
def test_scanner_allows_education(ok):
    assert scan({"prompt": ok}) == []

"""No ambiguous choices: distinct, and distractors clearly apart from the answer."""
from .conftest import all_questions
from .test_recompute import parse_display


def test_choices_unique(built):
    _, doc, _ = built
    for _, _, q in all_questions(doc):
        if "choices" in q:
            assert len(set(q["choices"])) == len(q["choices"]), (q["id"], q["choices"])


def test_numeric_distractors_meaningfully_different(built):
    _, doc, _ = built
    n = 0
    for _, l, q in all_questions(doc):
        if q["type"] != "multiple_choice" or l.get("personalizable"):
            continue
        vals = [parse_display(c)[0] for c in q["choices"]]
        ans = vals[q["answer"]]
        for i, v in enumerate(vals):
            if i == q["answer"]:
                continue
            gap, scale = abs(v - ans), max(abs(v), abs(ans))
            if q["unit"] == "percent":
                assert gap >= max(0.015, 0.14 * scale), (q["id"], q["choices"])
            else:
                assert gap >= 0.14 * scale, (q["id"], q["choices"])
        # distractors also differ from each other
        for i in range(4):
            for j in range(i + 1, 4):
                assert abs(vals[i] - vals[j]) > 0.05 * max(abs(vals[i]), abs(vals[j])) or (
                    q["unit"] == "percent" and abs(vals[i] - vals[j]) >= 0.009), (q["id"], q["choices"])
        n += 1
    assert n > 40


def test_compare_and_order_gaps(built):
    _, doc, _ = built
    for _, l, q in all_questions(doc):
        if q["type"] == "order":
            vals = sorted(q["source"]["values"], reverse=True)
            for a, b in zip(vals, vals[1:]):
                assert a - b >= (0.02 if q["unit"] == "percent" else 0.14 * max(abs(a), abs(b))), q["id"]


def test_true_false_threshold_not_razor_thin(built):
    companies, doc, _ = built
    from .test_recompute import expected
    for _, l, q in all_questions(doc):
        src = q["source"]
        if q["type"] == "true_false" and "threshold" in src:
            v = expected(companies, src["ticker"], src["metrics"][0], src.get("params"))
            t = src["threshold"]
            assert abs(v - t) >= 0.09 * max(abs(v), abs(t)), q["id"]
            assert t != 0 and (t > 0) == (v > 0), q["id"]

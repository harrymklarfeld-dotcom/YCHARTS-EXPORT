"""lessons.json must match the CONTRACT.md shape."""
from collections import Counter

from .conftest import all_questions

TYPES = {"multiple_choice", "numeric", "true_false", "compare", "order"}
UNITS = {"percent", "usd", "multiple", "none"}


def test_top_level(built):
    _, doc, _ = built
    assert doc["schema_version"] == 1
    assert isinstance(doc["units"], list) and len(doc["units"]) >= 8
    assert [u["order"] for u in doc["units"]] == sorted(u["order"] for u in doc["units"])


def test_units_and_lessons(built):
    _, doc, _ = built
    unit_ids, lesson_ids = set(), set()
    for u in doc["units"]:
        for k, t in (("id", str), ("title", str), ("summary", str), ("order", int), ("lessons", list)):
            assert isinstance(u[k], t), (u.get("id"), k)
        assert u["id"] not in unit_ids
        unit_ids.add(u["id"])
        assert 3 <= len(u["lessons"]) <= 5, u["id"]
        for l in u["lessons"]:
            for k, t in (("id", str), ("title", str), ("xp", int), ("intro", str), ("questions", list)):
                assert isinstance(l[k], t), (l.get("id"), k)
            assert l["id"] not in lesson_ids
            lesson_ids.add(l["id"])
            words = len(l["intro"].split())
            assert 60 <= words <= 120, (l["id"], words)


def test_lesson_sizes_on_fixture(built, request):
    _, doc, report = built
    if "fixture" not in request.node.callspec.id:
        return
    for u in doc["units"]:
        for l in u["lessons"]:
            assert 5 <= len(l["questions"]) <= 8, (l["id"], len(l["questions"]))
    assert not report["dropped_lessons"]


def test_questions_shape(built):
    _, doc, _ = built
    ids = set()
    for _, l, q in all_questions(doc):
        assert q["id"] not in ids
        ids.add(q["id"])
        assert q["type"] in TYPES
        assert isinstance(q["prompt"], str) and q["prompt"].strip()
        assert isinstance(q["explanation"], str) and q["explanation"].strip()
        assert q["unit"] in UNITS
        src = q["source"]
        assert isinstance(src["ticker"], str) and isinstance(src["fy"], int)
        assert isinstance(src["metrics"], list) and src["metrics"] and isinstance(src["formula"], str)
        t = q["type"]
        if t in ("multiple_choice", "compare"):
            assert isinstance(q["answer"], int) and not isinstance(q["answer"], bool)
            assert 0 <= q["answer"] < len(q["choices"])
            assert len(q["choices"]) == (2 if t == "compare" else 4) or (t == "multiple_choice" and len(q["choices"]) >= 3)
        elif t == "numeric":
            assert isinstance(q["answer"], (int, float)) and not isinstance(q["answer"], bool)
            assert isinstance(q["tolerance"], (int, float)) and q["tolerance"] > 0
            assert "choices" not in q
        elif t == "true_false":
            assert isinstance(q["answer"], bool)
        elif t == "order":
            assert sorted(q["answer"]) == list(range(len(q["choices"])))
            assert 3 <= len(q["choices"]) <= 4


def test_type_mix(built):
    _, doc, _ = built
    counts = Counter(q["type"] for _, _, q in all_questions(doc))
    assert all(counts[t] > 0 for t in TYPES), counts


def test_personalizable_lessons_flagged(built):
    _, doc, _ = built
    flagged = [l for u in doc["units"] for l in u["lessons"] if l.get("personalizable")]
    assert len(flagged) >= 3
    for l in flagged:
        assert all("{holding." in q["prompt"] for q in l["questions"])

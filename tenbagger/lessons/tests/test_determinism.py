import json

from lessons.generator import build


def dump(d):
    return json.dumps(d, sort_keys=True)


def test_same_seed_same_output(fixture_companies):
    a, _ = build(fixture_companies, seed=42)
    b, _ = build(json.loads(json.dumps(fixture_companies)), seed=42)
    assert dump(a) == dump(b)


def test_different_seed_changes_selection(fixture_companies):
    a, _ = build(fixture_companies, seed=42)
    b, _ = build(fixture_companies, seed=7)
    assert dump(a) != dump(b)


def test_company_order_does_not_matter(fixture_companies):
    shuffled = dict(fixture_companies, companies=list(reversed(fixture_companies["companies"])))
    a, _ = build(fixture_companies, seed=42)
    b, _ = build(shuffled, seed=42)
    assert dump(a) == dump(b)

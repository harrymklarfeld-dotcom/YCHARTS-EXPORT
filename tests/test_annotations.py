#!/usr/bin/env python3
"""Offline tests for the curated chart-memory store (portfolio.annotations)."""
import os
import sys
import tempfile

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from portfolio import annotations as A


def _isolate(tmp):
    """Point the store at a temp dir so tests never touch the real data/annotations/."""
    A.STORE = os.path.join(tmp, "annotations")


def test_add_is_idempotent_upsert():
    with tempfile.TemporaryDirectory() as tmp:
        _isolate(tmp)
        A.add({"scope": "NVDA", "date": "2025-01-27", "title": "DeepSeek shock", "note": "v1"})
        A.add({"scope": "NVDA", "date": "2025-01-27", "title": "DeepSeek shock", "note": "v2"})  # same id
        notes = A.load("NVDA")
        assert len(notes) == 1, notes                 # replaced, not duplicated
        assert notes[0]["note"] == "v2"
        assert notes[0]["author"] == "harry"          # default
        assert notes[0]["category"] == "other"        # default
        print("ok test_add_is_idempotent_upsert")


def test_add_requires_title_and_normalizes():
    with tempfile.TemporaryDirectory() as tmp:
        _isolate(tmp)
        try:
            A.add({"scope": "NVDA", "date": "2025-01-01", "title": "   "})
            assert False, "empty title should raise"
        except ValueError:
            pass
        rec = A.add({"scope": "nvda", "date": "2025-05-02T00:00:00", "title": "x", "category": "bogus", "source": "http://a"})
        assert rec["scope"] == "NVDA"                  # upper-cased
        assert rec["date"] == "2025-05-02"            # date truncated to day
        assert rec["category"] == "other"             # unknown category falls back
        assert rec["sources"] == ["http://a"]         # single `source` -> list
        print("ok test_add_requires_title_and_normalizes")


def test_merge_folds_ticker_and_macro():
    with tempfile.TemporaryDirectory() as tmp:
        _isolate(tmp)
        A.add({"scope": "NVDA", "date": "2025-01-27", "title": "DeepSeek", "category": "product"})
        A.add({"scope": "MACRO", "date": "2025-04-09", "title": "Tariff pause", "category": "geopolitical"})
        tl = {"events": [{"date": "2025-01-27", "type": "move", "detail": "m"}],
              "by_date": {"2025-01-27": [{"date": "2025-01-27", "type": "move", "detail": "m"}]},
              "counts": {}}
        A.merge_into_timeline(tl, "NVDA")
        types_127 = [e["type"] for e in tl["by_date"]["2025-01-27"]]
        assert types_127 == ["move", "note"], types_127          # note added alongside the move
        assert "2025-04-09" in tl["by_date"]                     # macro note painted on this ticker
        assert tl["counts"]["note"] == 2
        # a symbol with no own notes still gets the macro note
        empty = {"events": [], "by_date": {}, "counts": {}}
        A.merge_into_timeline(empty, "VOO")
        assert len([e for e in empty["events"] if e["type"] == "note"]) == 1
        print("ok test_merge_folds_ticker_and_macro")


def _run():
    for fn in (test_add_is_idempotent_upsert, test_add_requires_title_and_normalizes,
               test_merge_folds_ticker_and_macro):
        fn()


if __name__ == "__main__":
    _run()

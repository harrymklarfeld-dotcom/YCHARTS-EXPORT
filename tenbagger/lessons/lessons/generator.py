"""Build the lessons.json document from a companies.json document (deterministic per seed)."""
from __future__ import annotations

import math
import random

from . import portfolio
from .company import Co
from .curriculum import UNITS, LessonSpec
from .formulas import get
from .questions import MULTI, SINGLE
from .safety import scan

MAX_Q, MIN_Q = 8, 5


class BuildError(RuntimeError):
    pass


def load_companies(doc: dict) -> list[Co]:
    seen, out = set(), []
    for raw in doc.get("companies") or []:
        t = raw.get("ticker")
        if not t or t in seen or not isinstance(raw.get("fundamentals"), dict):
            continue
        seen.add(t)
        out.append(Co(raw))
    return sorted(out, key=lambda c: c.ticker)


def build_lesson(spec: LessonSpec, cos: list[Co], seed: int) -> tuple[dict, list[str]]:
    rng = random.Random(f"{seed}:{spec.id}")
    questions, used, prompts, skipped = [], set(), set(), []
    for kind, key in spec.slots:
        if len(questions) >= MAX_Q:
            break
        m = get(key)
        pool = [(c, k) for c in cos if (k := m.compute(c)) is not None]
        q = None
        if kind in SINGLE:
            fresh = [p for p in pool if p[0].ticker not in used]
            cands = fresh[:] or pool[:]
            rng.shuffle(cands)
            for c, k in cands:
                q = SINGLE[kind](m, c, k, rng)
                if q and q["prompt"] not in prompts:
                    break
                q = None
        else:
            q = MULTI[kind](m, pool, rng, used)
            if q and q["prompt"] in prompts and q["source"].get("tickers") is None:
                q = None
        if q is None:
            skipped.append(f"{spec.id}:{kind}:{key}")
            continue
        q = {"id": f"q-{spec.id}-{len(questions) + 1:02d}", **q}
        prompts.add(q["prompt"])
        used.update(q["source"].get("tickers") or [q["source"]["ticker"]])
        questions.append(q)
    return ({"id": spec.id, "title": spec.title, "xp": spec.xp, "intro": spec.intro, "questions": questions},
            skipped)


def _check_finite(node, path="$"):
    if isinstance(node, float) and not math.isfinite(node):
        raise BuildError(f"non-finite number at {path}")
    if isinstance(node, dict):
        for k, v in node.items():
            _check_finite(v, f"{path}.{k}")
    elif isinstance(node, list):
        for i, v in enumerate(node):
            _check_finite(v, f"{path}[{i}]")


def build(companies_doc: dict, seed: int = 42, include_portfolio: bool = True) -> tuple[dict, dict]:
    cos = load_companies(companies_doc)
    if not cos:
        raise BuildError("companies.json has no usable companies")
    units, report = [], {"skipped_slots": [], "short_lessons": [], "dropped_lessons": []}
    for u in UNITS:
        lessons = []
        for spec in u.lessons:
            lesson, skipped = build_lesson(spec, cos, seed)
            report["skipped_slots"] += skipped
            n = len(lesson["questions"])
            if n < 3:
                report["dropped_lessons"].append(spec.id)
                continue
            if n < MIN_Q:
                report["short_lessons"].append(f"{spec.id} ({n} questions)")
            lessons.append(lesson)
        if lessons:
            units.append({"id": u.id, "title": u.title, "summary": u.summary, "order": u.order, "lessons": lessons})
    if include_portfolio:
        pu = portfolio.build_unit([c.raw for c in cos], seed)
        if pu["lessons"]:
            units.append(pu)
    doc = {
        "schema_version": 1,
        "generated_from": {"companies_source": companies_doc.get("source"),
                           "companies_generated_at": companies_doc.get("generated_at"),
                           "tickers": [c.ticker for c in cos], "seed": seed},
        "disclaimer": "Educational content built from reported financials. Not investment advice.",
        "units": units,
    }
    _check_finite(doc)
    hits = scan(doc)
    if hits:
        raise BuildError(f"banned phrases in output: {hits[:5]}")
    report["counts"] = {
        "units": len(units), "lessons": sum(len(u["lessons"]) for u in units),
        "questions": sum(len(l["questions"]) for u in units for l in u["lessons"]),
    }
    return doc, report

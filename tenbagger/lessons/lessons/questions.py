"""Question builders: turn a Metric + real companies into contract-shaped questions.

Guards live here: a builder returns None (and the generator moves on) whenever the
inputs are missing/meaningless or the question would be ambiguous.
"""
from __future__ import annotations

import math
import random
from typing import Optional

from .company import Co
from .fmt import fmt
from .formulas import Calc, Metric

# minimum separation between an answer and any distractor / between compared values
DISTRACTOR_REL = 0.15
COMPARE_REL = 0.10
PCT_ABS = {"distractor": 0.015, "compare": 0.01}


def _finite(v) -> bool:
    return isinstance(v, (int, float)) and not isinstance(v, bool) and math.isfinite(v)


def far_enough(a: float, b: float, unit: str, rel: float, pct_abs: float) -> bool:
    """True when a and b are clearly different to a learner (value and display)."""
    if fmt(a, unit) == fmt(b, unit):
        return False
    gap = abs(a - b)
    scale = max(abs(a), abs(b))
    if unit == "percent":
        return gap >= max(pct_abs, rel * scale)
    return scale > 0 and gap >= rel * scale


def cap(s: str) -> str:
    return s[:1].upper() + s[1:]


def rounded(v: float, unit: str) -> float:
    if unit in ("usd",):
        return round(v, 2)
    return round(v, 6)


def tolerance(v: float, unit: str) -> float:
    if unit == "percent":
        return 0.005
    if unit == "multiple":
        return round(max(0.1, 0.02 * abs(v)), 3)
    if unit == "usd_share":
        return round(max(0.05, 0.02 * abs(v)), 2)
    return round(0.02 * abs(v), 2)  # usd: 2% of the answer


ANSWER_HINT = {
    "percent": "Answer as a percentage (e.g. 12.5%).",
    "multiple": "Answer as a multiple (e.g. 18.2x).",
    "usd": "Answer in dollars (e.g. $12.3B).",
    "usd_share": "Answer in dollars per share (e.g. $4.20).",
}


def source(m: Metric, co: Co, k: Calc, **extra) -> dict:
    src = {"ticker": co.ticker, "fy": co.fy, "metrics": [m.key], "formula": m.formula,
           "inputs": {kk: vv for kk, vv in k.inputs.items() if vv is not None}}
    if k.params:
        src["params"] = k.params
    src.update(extra)
    return src


def explain(m: Metric, co: Co, k: Calc) -> str:
    g = m.gloss(co, k)
    return f"{cap(m.label)} = {m.pretty} = {k.arith}." + (f" {g}" if g else "")


# ------------------------------------------------------------------ builders
def multiple_choice(m: Metric, co: Co, k: Calc, rng: random.Random) -> Optional[dict]:
    if m.unit == "bool":
        return None
    ans = k.value
    picked: list[tuple[str | None, float]] = []

    def ok(v):
        return _finite(v) and far_enough(v, ans, m.unit, DISTRACTOR_REL, PCT_ABS["distractor"]) and all(
            far_enough(v, p, m.unit, COMPARE_REL, PCT_ABS["compare"]) for _, p in picked)

    for desc, v in m.mistakes(co, k):
        if len(picked) < 3 and ok(v):
            picked.append((desc, v))
    for factor in (0.5, 1.5, 2.0, 0.75, 3.0, 0.25):
        if len(picked) >= 3:
            break
        v = ans * factor if ans != 0 else factor / 10
        if ok(v):
            picked.append((None, v))
    if len(picked) < 3:
        return None
    vals = [ans] + [v for _, v in picked]
    order = list(range(4))
    rng.shuffle(order)
    choices = [m.f(vals[i]) for i in order]
    if len(set(choices)) != 4:
        return None
    slip = next(((d, v) for d, v in picked if d), None)
    expl = explain(m, co, k)
    if slip:
        expl += f" Common slip: {slip[0]} gives {m.f(slip[1])}."
    return {"type": "multiple_choice", "prompt": f"{m.given(co, k)} {m.ask}".strip(), "choices": choices,
            "answer": order.index(0), "unit": m.json_unit, "explanation": expl, "source": source(m, co, k)}


def numeric(m: Metric, co: Co, k: Calc, rng: random.Random) -> Optional[dict]:
    if m.unit == "bool":
        return None
    hint = ANSWER_HINT.get(m.unit, "")
    return {"type": "numeric", "prompt": f"{m.given(co, k)} {m.ask} {hint}".strip(),
            "answer": rounded(k.value, m.unit), "tolerance": tolerance(k.value, m.unit), "unit": m.json_unit,
            "explanation": explain(m, co, k), "source": source(m, co, k)}


def _nice(t: float, unit: str) -> float:
    if t == 0:
        return 0.0
    if unit == "percent":
        step = 0.01 if abs(t) < 0.2 else 0.05
        return round(round(t / step) * step, 4)
    if unit == "multiple":
        step = 0.1 if abs(t) < 2 else (1 if abs(t) < 20 else 5)
        return round(round(t / step) * step, 2)
    mag = 10 ** (math.floor(math.log10(abs(t))) - 1)  # 2 significant figures
    return round(t / mag) * mag


def true_false(m: Metric, co: Co, k: Calc, rng: random.Random) -> Optional[dict]:
    if m.unit == "bool":
        return {"type": "true_false", "prompt": f"True or false? {m.statement(co, k)}", "answer": bool(k.value),
                "unit": "none",
                "explanation": f"{'True' if k.value else 'False'}: {k.arith}. {m.gloss(co, k)}".strip(),
                "source": source(m, co, k)}
    v = k.value
    want_true = rng.random() < 0.5
    for mult_ in (0.3, 0.45, 0.6):
        delta = max(abs(v) * mult_, 0.03 if m.unit == "percent" else 0)
        if delta == 0:
            return None
        t = _nice(v - delta if want_true else v + delta, m.unit)
        if (v > t) == want_true and far_enough(v, t, m.unit, COMPARE_REL, 0.02):
            break
    else:
        return None
    truth = v > t
    return {"type": "true_false",
            "prompt": f"True or false? {co.label}'s {m.label} in FY{co.fy} was above {m.f(t)}.",
            "answer": truth, "unit": "none",
            "explanation": (f"{'True' if truth else 'False'}. {cap(m.label)} = {m.pretty} = {k.arith}, which is "
                            f"{'above' if truth else 'below'} {m.f(t)}. {m.gloss(co, k)}").strip(),
            "source": source(m, co, k, threshold=t)}


def _pair_line(m: Metric, co: Co, k: Calc) -> str:
    return f"{co.label}, FY{co.fy}: {k.arith}"


def _fy_note(cos: list[Co]) -> str:
    fys = sorted({c.fy for c in cos})
    return " (Latest fiscal years differ, so the periods don't line up exactly.)" if len(fys) > 1 else ""


def compare(m: Metric, pool: list[tuple[Co, Calc]], rng: random.Random, prefer: set) -> Optional[dict]:
    if m.unit == "bool" or not m.comparable or len(pool) < 2:
        return None
    pairs = [(a, b) for i, a in enumerate(pool) for b in pool[i + 1:]
             if far_enough(a[1].value, b[1].value, m.unit, COMPARE_REL * 1.5, 0.02)]
    if not pairs:
        return None
    fresh = [p for p in pairs if p[0][0].ticker not in prefer and p[1][0].ticker not in prefer]
    a, b = rng.choice(fresh or pairs)
    if rng.random() < 0.5:
        a, b = b, a
    higher = rng.random() < 0.7
    win = max((a, b), key=lambda x: x[1].value) if higher else min((a, b), key=lambda x: x[1].value)
    word = "higher" if higher else "lower"
    return {"type": "compare",
            "prompt": f"Which company had the {word} {m.label} in its latest fiscal year?",
            "choices": [a[0].label, b[0].label], "answer": 0 if win is a else 1, "unit": m.json_unit,
            "explanation": (f"{cap(m.label)} = {m.pretty}. {_pair_line(m, *a)}. {_pair_line(m, *b)}. "
                            f"So {win[0].label} is {word}.{_fy_note([a[0], b[0]])}"),
            "source": source(m, win[0], win[1], tickers=[a[0].ticker, b[0].ticker], fys=[a[0].fy, b[0].fy],
                             direction=word)}


def order(m: Metric, pool: list[tuple[Co, Calc]], rng: random.Random, prefer: set) -> Optional[dict]:
    if m.unit == "bool" or not m.comparable or len(pool) < 3:
        return None
    best = None
    for n in (4, 3):
        if len(pool) < n:
            continue
        for _ in range(300):
            pick = rng.sample(pool, n)
            s = sorted(pick, key=lambda x: -x[1].value)
            if all(far_enough(s[i][1].value, s[i + 1][1].value, m.unit, COMPARE_REL * 1.5, 0.02) for i in range(n - 1)):
                best = pick
                break
        if best:
            break
    if not best:
        return None
    ranked = sorted(range(len(best)), key=lambda i: -best[i][1].value)
    lines = "; ".join(f"{best[i][0].label} {m.f(best[i][1].value)}" for i in ranked)
    return {"type": "order",
            "prompt": f"Rank these companies from highest to lowest {m.label} (latest fiscal year).",
            "choices": [c.label for c, _ in best], "answer": ranked, "unit": m.json_unit,
            "explanation": f"{cap(m.label)} = {m.pretty}. Highest to lowest: {lines}.{_fy_note([c for c, _ in best])}",
            "source": {"ticker": best[ranked[0]][0].ticker, "fy": best[ranked[0]][0].fy, "metrics": [m.key],
                       "formula": m.formula, "tickers": [c.ticker for c, _ in best], "fys": [c.fy for c, _ in best],
                       "values": [rounded(k.value, m.unit) for _, k in best]}}


SINGLE = {"mc": multiple_choice, "num": numeric, "tf": true_false}
MULTI = {"cmp": compare, "ord": order}

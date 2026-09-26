"""Expense ratios from a fund prospectus' risk/return inline XBRL (485BPOS / 497K).

Fund prospectuses tag the fee table with the risk/return taxonomy (prefix ``rr:`` in older
filings, ``oef:`` in newer ones). We read:
- ``NetExpensesOverAssets``  (after fee waivers, preferred when present)
- ``ExpensesOverAssets``     (gross total annual fund operating expenses)

Values are percentages in the document and usually carry ``scale="-2"`` so that XBRL value =
displayed × 10^scale. We return decimals (0.0003 = 0.03%).

This is a regex reader rather than a full XML parse because prospectus iXBRL is large
XHTML that is not always well-formed. It never raises on odd input; it returns ``None``.
"""
from __future__ import annotations

import html
import re
from collections import Counter
from dataclasses import dataclass

CONCEPTS = ("NetExpensesOverAssets", "ExpensesOverAssets")

_FACT_RE = re.compile(
    r"<ix:nonFraction\b(?P<attrs>[^>]*)>(?P<body>.*?)</ix:nonFraction>",
    re.IGNORECASE | re.DOTALL,
)
_ATTR_RE = re.compile(r'([\w:.-]+)\s*=\s*"([^"]*)"')
_CONTEXT_RE = re.compile(
    r"<xbrli:context\b[^>]*\bid=\"(?P<id>[^\"]+)\"[^>]*>(?P<body>.*?)</xbrli:context>",
    re.IGNORECASE | re.DOTALL,
)
_MEMBER_RE = re.compile(r"<xbrldi:explicitMember\b[^>]*>(?P<m>[^<]+)</xbrldi:explicitMember>", re.IGNORECASE)
_TAG_RE = re.compile(r"<[^>]+>")


@dataclass
class RrFact:
    concept: str          # local name, e.g. "ExpensesOverAssets"
    value: float          # decimal ratio
    context_id: str
    members: tuple[str, ...]


def _to_number(body: str, attrs: dict[str, str]) -> float | None:
    fmt = attrs.get("format", "").lower()
    text = html.unescape(_TAG_RE.sub("", body)).strip()
    if "fixed-zero" in fmt or text in {"-", "—", "–", "None", "none"}:
        num = 0.0
    else:
        cleaned = re.sub(r"[^0-9.,]", "", text)
        if "comma-decimal" in fmt or "numcommadecimal" in fmt:
            cleaned = cleaned.replace(".", "").replace(",", ".")
        else:
            cleaned = cleaned.replace(",", "")
        if not cleaned or cleaned == ".":
            return None
        try:
            num = float(cleaned)
        except ValueError:
            return None
    try:
        scale = int(attrs.get("scale", "0") or 0)
    except ValueError:
        scale = 0
    num = num * (10 ** scale)
    if attrs.get("sign") == "-":
        num = -num
    return num


def parse_rr_facts(doc: str) -> list[RrFact]:
    contexts: dict[str, tuple[str, ...]] = {}
    for m in _CONTEXT_RE.finditer(doc):
        contexts[m.group("id")] = tuple(x.strip() for x in _MEMBER_RE.findall(m.group("body")))
    out: list[RrFact] = []
    for m in _FACT_RE.finditer(doc):
        attrs = dict(_ATTR_RE.findall(m.group("attrs")))
        name = attrs.get("name", "")
        local = name.split(":")[-1]
        if local not in CONCEPTS:
            continue
        val = _to_number(m.group("body"), attrs)
        if val is None or not (0 <= val < 0.2):      # sanity: expense ratios are 0–20%
            continue
        ctx = attrs.get("contextRef", "")
        out.append(RrFact(local, val, ctx, contexts.get(ctx, ())))
    return out


def expense_ratio(doc: str, class_id: str | None = None) -> float | None:
    """Best expense ratio for a share class (decimal), or None.

    Preference: facts whose context names ``class_id`` (e.g. ``C000092055``), then the net
    figure over the gross one. Without a class id the most common value wins (a multi-class
    prospectus lists one row per class).
    """
    if not doc:
        return None
    facts = parse_rr_facts(doc)
    if class_id:
        cid = class_id.lower()
        scoped = [f for f in facts if any(cid in m.lower() for m in f.members) or cid in f.context_id.lower()]
        if scoped:
            facts = scoped
    for concept in CONCEPTS:
        vals = [round(f.value, 6) for f in facts if f.concept == concept]
        if vals:
            return Counter(vals).most_common(1)[0][0]
    return None

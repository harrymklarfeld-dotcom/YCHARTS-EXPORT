"""Education-not-advice guard: phrases that must never appear in generated content."""
from __future__ import annotations

import re
from typing import Iterator

BANNED = [
    r"\bbuy(s|ing)?\b", r"\bsell\b", r"\bselling (the|your|shares|stock)\b", r"\bhold\b",
    r"\bstrong buy\b", r"\b(price|share) target\b", r"\btarget price\b", r"\bprice objective\b",
    r"\bunder-?valued\b", r"\bover-?valued\b", r"\bcheap\b", r"\bbargain\b", r"\bsteal\b",
    r"\bout-?perform", r"\bunder-?perform", r"\brecommend", r"\bshould (you )?(buy|sell|own|invest|add|trim)\b",
    r"\byou should\b", r"\bguarantee", r"\bcan'?t lose\b", r"\bsure thing\b", r"\bget rich\b",
    r"\bto the moon\b", r"\bupside of\b", r"\bfair value target\b", r"\baccumulate\b", r"\bload up\b",
]
_RX = re.compile("|".join(f"(?:{p})" for p in BANNED), re.IGNORECASE)


def iter_text(node, path="$") -> Iterator[tuple[str, str]]:
    if isinstance(node, str):
        yield path, node
    elif isinstance(node, dict):
        for k, v in node.items():
            if k in ("source", "inputs"):  # data, not prose
                continue
            yield from iter_text(v, f"{path}.{k}")
    elif isinstance(node, list):
        for i, v in enumerate(node):
            yield from iter_text(v, f"{path}[{i}]")


def scan(doc) -> list[tuple[str, str]]:
    """Return (json-path, matched phrase) for every banned phrase in the document's prose."""
    hits = []
    for path, text in iter_text(doc):
        for m in _RX.finditer(text):
            hits.append((path, m.group(0)))
    return hits

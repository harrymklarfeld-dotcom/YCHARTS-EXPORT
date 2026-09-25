"""Human formatting for money, percents and multiples ($254.5B, 12.6%, 18.2x)."""
from __future__ import annotations

import re

MINUS = "-"


def usd(v: float, per_share: bool = False) -> str:
    sign = MINUS if v < 0 else ""
    a = abs(v)
    if per_share or a < 1e4:
        return f"{sign}${a:,.2f}"
    for div, suf in ((1e12, "T"), (1e9, "B"), (1e6, "M"), (1e3, "K")):
        if a >= div:
            x = a / div
            s = f"{x:,.2f}" if x < 10 and suf == "T" else f"{x:,.1f}"
            return f"{sign}${s}{suf}"
    return f"{sign}${a:,.0f}"


def pct(v: float, digits: int = 1) -> str:
    return f"{v * 100:.{digits}f}%".replace("-", MINUS)


def mult(v: float) -> str:
    return f"{v:.2f}x" if abs(v) < 10 else f"{v:.1f}x"


def fmt(v: float, unit: str) -> str:
    if unit == "percent":
        return pct(v)
    if unit == "multiple":
        return mult(v)
    if unit == "usd":
        return usd(v)
    if unit == "usd_share":
        return usd(v, per_share=True)
    if unit == "raw_usd":
        return f"${v:,.0f}"
    return f"{v:,.2f}"


_SUFFIXES = re.compile(
    r",?\s+(Inc\.?|Incorporated|Corporation|Corp\.?|Company|Co\.?|Ltd\.?|Limited|plc|PLC|N\.V\.|S\.A\.|Holdings?)$"
)


def short_name(name: str) -> str:
    n = (name or "").strip()
    for _ in range(3):
        m = _SUFFIXES.search(n)
        if not m:
            break
        n = n[: m.start()].rstrip(", ")
        n = re.sub(r"\s+(&|and)$", "", n)
    if n.startswith("The "):
        n = n[4:]
    # "NVIDIA" -> "Nvidia"-style casing is a product call; keep issuer spelling.
    return n or name

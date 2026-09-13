#!/usr/bin/env python3
"""
A small, dependency-free financial sentiment scorer.

Rates a headline or short text on [-1, +1] using a finance-tuned lexicon (Loughran-McDonald
in spirit: words that are negative in a market context, not general English), with negation
and intensifier handling. It is deliberately transparent — no black-box model — so you can see
exactly which words drove a score, which matters when you're using it to argue that a move was
sentiment-driven rather than fundamental.

This is a rough signal, not truth: a lexicon can't read sarcasm or context. Use it as one input
to the attribution engine, alongside the size of the price move and whether earnings/macro landed.

    python -m portfolio.sentiment "Nvidia crushes earnings, guidance raised sharply"
"""
from __future__ import annotations

import re
import sys

# Finance-context polarity words. Positive = bullish/constructive; negative = bearish/risk.
POS = {
    "beat", "beats", "tops", "surpass", "surpasses", "record", "surge", "surges", "soar", "soars",
    "rally", "rallies", "jump", "jumps", "gain", "gains", "rise", "rises", "climb", "climbs",
    "upgrade", "upgraded", "outperform", "outperforms", "strong", "strength", "growth", "grew",
    "raised", "raises", "boost", "boosts", "bullish", "profit", "profits", "profitable", "wins",
    "win", "approval", "approved", "breakthrough", "expansion", "expands", "accelerate", "robust",
    "optimistic", "beat estimates", "exceeds", "exceeded", "higher", "rebound", "recovers", "buyback",
    "dividend increase", "guidance raised", "beats expectations", "momentum", "demand", "tailwind",
}
NEG = {
    "miss", "misses", "missed", "cut", "cuts", "slash", "slashes", "plunge", "plunges", "plummet",
    "drop", "drops", "fall", "falls", "sink", "sinks", "slump", "tumble", "tumbles", "decline",
    "declines", "downgrade", "downgraded", "underperform", "weak", "weakness", "loss", "losses",
    "warns", "warning", "warned", "bearish", "recall", "lawsuit", "probe", "investigation", "fraud",
    "layoffs", "layoff", "bankruptcy", "default", "selloff", "sell-off", "crash", "crashes", "fear",
    "fears", "concern", "concerns", "risk", "risks", "headwind", "headwinds", "disappoint",
    "disappointing", "disappoints", "shortfall", "guidance cut", "lower", "lowered", "delay",
    "delayed", "halts", "halt", "slowdown", "recession", "downturn", "volatile", "uncertainty",
}
INTENSIFIERS = {"sharply": 1.6, "significantly": 1.5, "massive": 1.7, "record": 1.5, "steep": 1.5,
                "surprise": 1.4, "unexpected": 1.4, "strongly": 1.5, "deeply": 1.5, "dramatically": 1.7}
NEGATORS = {"not", "no", "never", "without", "fails", "fail", "failed", "despite", "less"}

_WORD = re.compile(r"[a-z][a-z'-]*")


def _tokens(text: str) -> list[str]:
    return _WORD.findall((text or "").lower())


def score(text: str) -> dict:
    """
    Return {score, magnitude, hits}. `score` in [-1, 1] is net polarity; `magnitude` is total
    polarity weight (how loaded the text is); `hits` lists the words that fired, with sign.
    """
    toks = _tokens(text)
    # also catch two-word phrases from the lexicon
    text_l = " ".join(toks)
    net = 0.0
    mag = 0.0
    hits = []
    for phrase in [p for p in (POS | NEG) if " " in p]:
        if phrase in text_l:
            s = 1.0 if phrase in POS else -1.0
            net += s; mag += 1.0
            hits.append((phrase, round(s, 2)))
    for i, w in enumerate(toks):
        base = 1.0 if w in POS else -1.0 if w in NEG else 0.0
        if base == 0.0:
            continue
        mult = 1.0
        # look back up to 2 words for negation / intensifier
        for j in range(max(0, i - 2), i):
            if toks[j] in NEGATORS:
                mult *= -1.0
            if toks[j] in INTENSIFIERS:
                mult *= INTENSIFIERS[toks[j]]
        if w in INTENSIFIERS:
            mult *= INTENSIFIERS[w]
        val = base * mult
        net += val
        mag += abs(val)
        hits.append((w, round(val, 2)))
    # squash net into [-1, 1] softly by its own magnitude
    norm = net / (mag + 1e-9) if mag else 0.0
    return {"score": round(norm, 3), "magnitude": round(mag, 2), "hits": hits}


def score_many(texts) -> dict:
    """Aggregate sentiment over a list of headlines: mean score weighted by magnitude."""
    rs = [score(t) for t in texts if t]
    if not rs:
        return {"score": 0.0, "n": 0, "magnitude": 0.0}
    wsum = sum(r["magnitude"] for r in rs)
    mean = sum(r["score"] * r["magnitude"] for r in rs) / wsum if wsum else 0.0
    return {"score": round(mean, 3), "n": len(rs), "magnitude": round(wsum, 2)}


def label(s: float) -> str:
    return ("Very bullish" if s >= 0.5 else "Bullish" if s >= 0.15 else
            "Very bearish" if s <= -0.5 else "Bearish" if s <= -0.15 else "Neutral")


if __name__ == "__main__":
    txt = " ".join(sys.argv[1:]) or "Stock plunges after company warns on weak guidance"
    r = score(txt)
    print(f"{r['score']:+.3f}  {label(r['score'])}   (magnitude {r['magnitude']})")
    print("  drivers:", ", ".join(f"{w}{'+' if v>0 else ''}{v}" for w, v in r["hits"]) or "none")

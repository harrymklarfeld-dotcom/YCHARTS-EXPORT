"""Ticker universes shipped with datasources (ticker, SEC CIK, name only).

universes/sp500.csv: US large-cap list derived from the public github.com/datasets/
s-and-p-500-companies dataset (fetched 2026-09-25). Only ticker/CIK/name are kept; GICS
sector columns were dropped because GICS is proprietary. Index membership changes: refresh
quarterly, and do not market the list as "the S&P 500" in-app without an S&P DJI licence.
Tickers use SEC's dash form (BRK-B).
"""
from __future__ import annotations

import csv
from pathlib import Path

UNIVERSE_DIR = Path(__file__).resolve().parent / "universes"


def available() -> list[str]:
    return sorted(p.stem for p in UNIVERSE_DIR.glob("*.csv"))


def load(name_or_path: str) -> dict[str, dict]:
    p = Path(name_or_path)
    if not p.exists():
        p = UNIVERSE_DIR / f"{name_or_path}.csv"
    if not p.exists():
        raise FileNotFoundError(f"universe {name_or_path!r} not found (have {available()})")
    out: dict[str, dict] = {}
    with open(p, newline="", encoding="utf-8") as fh:
        rows = (r for r in fh if r.strip() and not r.lstrip().startswith("#"))
        for r in csv.DictReader(rows):
            t = r["ticker"].strip().upper().replace(".", "-")
            out[t] = {"cik": int(r["cik"]), "name": r.get("name", "").strip()}
    return out

"""Price input. EDGAR has no prices, so they come from a CSV:

    ticker,price,price_date[,is_sample]

A user-supplied file is treated as real (price_is_sample=false) unless its row sets
is_sample=true. Without --prices, the bundled sample fixture
data/fixtures/prices_sample.csv is used and every price is flagged sample.
"""
from __future__ import annotations

import csv
from pathlib import Path

from .sec import TENBAGGER_DIR

SAMPLE_PRICES = TENBAGGER_DIR / "data" / "fixtures" / "prices_sample.csv"

TRUE = {"1", "true", "yes", "y", "t"}


def load_prices(path: str | Path | None) -> dict[str, dict]:
    """Return {TICKER: {"price": float, "price_date": str|None, "price_is_sample": bool}}."""
    forced_sample = path is None
    path = Path(path) if path else SAMPLE_PRICES
    if not path.exists():
        return {}
    out = {}
    with open(path, newline="", encoding="utf-8") as fh:
        rows = (r for r in fh if r.strip() and not r.lstrip().startswith("#"))
        for row in csv.DictReader(rows):
            t = (row.get("ticker") or "").strip().upper()
            try:
                price = float(row.get("price") or "")
            except ValueError:
                continue
            if not t or price <= 0:
                continue
            flag = (row.get("is_sample") or "").strip().lower() in TRUE
            out[t] = {"price": price, "price_date": (row.get("price_date") or "").strip() or None,
                      "price_is_sample": forced_sample or flag}
    return out

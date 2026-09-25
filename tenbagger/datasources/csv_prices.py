"""Prices from a local CSV (``ticker,price,price_date[,is_sample]``, '#' comments allowed).

This is the same format ``python -m pipeline build --prices`` reads. A CSV has no inherent
licence: the caller states where the numbers came from via ``license_ref``. Without one the
file is treated as not displayable (e.g. hand-typed or scraped numbers).
"""
from __future__ import annotations

import csv
from pathlib import Path
from typing import Iterable

from .base import LicenseInfo, PriceQuote, PriceSource, SourceError, norm_tickers

TRUE = {"1", "true", "yes", "y", "t"}
HEADER = ["ticker", "price", "price_date", "is_sample"]


class CsvPriceSource(PriceSource):
    name = "csv"

    def __init__(self, path: str | Path, license_ref: str = "", display_allowed: bool = False):
        self.path = Path(path)
        self._license = LicenseInfo(
            source=f"csv:{self.path.name}", display_allowed=bool(display_allowed and license_ref),
            license_ref=license_ref,
            notes="caller-attested licence" if license_ref else "no licence attested for this file")

    @property
    def license(self) -> LicenseInfo:
        return self._license

    def read_all(self) -> dict[str, PriceQuote]:
        if not self.path.exists():
            raise SourceError(f"price CSV not found: {self.path}")
        out: dict[str, PriceQuote] = {}
        with open(self.path, newline="", encoding="utf-8") as fh:
            rows = (r for r in fh if r.strip() and not r.lstrip().startswith("#"))
            for row in csv.DictReader(rows):
                t = (row.get("ticker") or "").strip().upper()
                try:
                    q = PriceQuote(t, float(row.get("price") or "nan"), (row.get("price_date") or "").strip(),
                                   source=self._license.source,
                                   is_sample=(row.get("is_sample") or "").strip().lower() in TRUE)
                except (ValueError, SourceError):
                    continue  # skip malformed rows rather than poison the batch
                if t:
                    out[t] = q
        return out

    def latest_prices(self, tickers: Iterable[str]) -> dict[str, PriceQuote]:
        allq = self.read_all()
        return {t: allq[t] for t in norm_tickers(tickers) if t in allq}


def write_prices_csv(quotes: dict[str, PriceQuote], path: str | Path, comment: str = "") -> Path:
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w", newline="", encoding="utf-8") as fh:
        for line in comment.splitlines():
            fh.write(f"# {line}\n")
        w = csv.writer(fh)
        w.writerow(HEADER)
        for t in sorted(quotes):
            q = quotes[t]
            w.writerow([q.ticker, repr(float(q.price)), q.price_date, "true" if q.is_sample else "false"])
    return path

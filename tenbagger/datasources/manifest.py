"""Provenance manifest + the publish gate.

``prices`` writes ``<prices>.manifest.json`` describing which source produced every price
and whether that source's licence allows display. ``gate`` refuses to publish a
companies.json unless every *real* (price_is_sample=false) price is covered by a
displayable source. Sample prices are allowed only because the app must label them
(price_is_sample=true); fundamentals come from SEC public data.
"""
from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path

from .base import LicenseError, LicenseInfo, PriceQuote

MANIFEST_VERSION = 1


def build_manifest(quotes: dict[str, PriceQuote], licenses: list[LicenseInfo],
                   fundamentals: LicenseInfo | None = None) -> dict:
    by_source = {l.source: l for l in licenses}
    return {
        "manifest_version": MANIFEST_VERSION,
        "generated_at": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "price_sources": [l.to_dict() for l in licenses],
        "fundamentals_source": (fundamentals or LicenseInfo(
            "sec-edgar-xbrl", True, "public domain (US government work, SEC EDGAR)",
            "https://www.sec.gov/search-filings/edgar-application-programming-interfaces")).to_dict(),
        "prices": {t: {"source": q.source, "price_date": q.price_date, "is_sample": q.is_sample,
                       "display_allowed": bool(by_source.get(q.source) and by_source[q.source].display_allowed)}
                   for t, q in sorted(quotes.items())},
    }


def write_manifest(manifest: dict, path: str | Path) -> Path:
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(manifest, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    return path


def check_publishable(companies_doc: dict, manifest: dict | None) -> list[str]:
    """Return a list of blocking problems (empty list = OK to publish)."""
    problems: list[str] = []
    fsrc = (manifest or {}).get("fundamentals_source")
    if manifest is not None and fsrc and not fsrc.get("display_allowed"):
        problems.append(f"fundamentals source {fsrc.get('source')} has no display licence")
    prices = (manifest or {}).get("prices", {})
    for c in companies_doc.get("companies", []):
        if c.get("price") is None or c.get("price_is_sample", True):
            continue
        t = c["ticker"]
        p = prices.get(t)
        if p is None:
            problems.append(f"{t}: real price with no provenance in manifest")
        elif not p.get("display_allowed"):
            problems.append(f"{t}: price from '{p.get('source')}' lacks a display/redistribution licence")
        elif p.get("price_date") != c.get("price_date"):
            problems.append(f"{t}: price_date {c.get('price_date')} does not match manifest {p.get('price_date')}")
    return problems


def assert_publishable(companies_doc: dict, manifest: dict | None) -> None:
    probs = check_publishable(companies_doc, manifest)
    if probs:
        head = "\n  ".join(probs[:25]) + (f"\n  ... and {len(probs) - 25} more" if len(probs) > 25 else "")
        raise LicenseError("refusing to publish companies.json:\n  " + head)

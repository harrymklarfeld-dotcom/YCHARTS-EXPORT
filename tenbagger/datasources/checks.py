"""Output validation for data/companies.json: contract schema + sanity checks."""
from __future__ import annotations

import json
import math
from datetime import datetime, timezone
from pathlib import Path


def _reject_constant(name):
    raise ValueError(f"non-JSON number {name} in file")


def load_strict(path: str | Path) -> dict:
    """json.load that rejects NaN / Infinity (which Python would otherwise accept)."""
    with open(path, encoding="utf-8") as fh:
        return json.load(fh, parse_constant=_reject_constant)


def _schema_errors(doc: dict) -> list[str]:
    try:  # canonical checker lives in the pipeline package (owned by the pipeline agent)
        from pipeline.schema import validate_document  # type: ignore
    except Exception:  # pragma: no cover - fallback when run without the pipeline on sys.path
        validate_document = None
    if validate_document is not None:
        return validate_document(doc)
    errs = []
    if doc.get("schema_version") != 1:
        errs.append("schema_version must be 1")
    if not isinstance(doc.get("companies"), list):
        errs.append("companies must be a list")
    return errs


def _walk_numbers(obj, path=""):
    if isinstance(obj, dict):
        for k, v in obj.items():
            yield from _walk_numbers(v, f"{path}.{k}" if path else k)
    elif isinstance(obj, list):
        for i, v in enumerate(obj):
            yield from _walk_numbers(v, f"{path}[{i}]")
    elif isinstance(obj, float):
        yield path, obj


def sanity_errors(doc: dict, min_count: int = 1, max_age_hours: float | None = None,
                  min_price_coverage: float = 0.0) -> list[str]:
    errs: list[str] = []
    comps = doc.get("companies") or []
    if len(comps) < min_count:
        errs.append(f"only {len(comps)} companies (< threshold {min_count})")
    tickers = [c.get("ticker") for c in comps]
    dupes = sorted({t for t in tickers if tickers.count(t) > 1})
    if dupes:
        errs.append(f"duplicate tickers: {dupes}")
    for p, v in _walk_numbers(doc):
        if not math.isfinite(v):
            errs.append(f"non-finite number at {p}")
    priced = 0
    for c in comps:
        t = c.get("ticker", "?")
        m, f = c.get("metrics") or {}, c.get("fundamentals") or {}
        if c.get("price") is not None:
            priced += 1
            if not c["price"] > 0:
                errs.append(f"{t}: price must be > 0")
            mc = m.get("market_cap")
            if mc is not None and not mc > 0:
                errs.append(f"{t}: market_cap must be > 0 (got {mc})")
            if f.get("shares_diluted") and mc is None:
                errs.append(f"{t}: has price and shares but no market_cap")
        if f.get("revenue") is not None and f["revenue"] < 0:
            errs.append(f"{t}: negative revenue")
        if f.get("total_assets") is not None and f["total_assets"] <= 0:
            errs.append(f"{t}: total_assets must be > 0")
        gm = m.get("gross_margin")
        if gm is not None and not -5 <= gm <= 1.0000001:
            errs.append(f"{t}: implausible gross_margin {gm}")
    if comps and priced / len(comps) < min_price_coverage:
        errs.append(f"price coverage {priced}/{len(comps)} below {min_price_coverage:.0%}")
    if max_age_hours is not None and doc.get("generated_at"):
        try:
            gen = datetime.strptime(doc["generated_at"], "%Y-%m-%dT%H:%M:%SZ").replace(tzinfo=timezone.utc)
            age = (datetime.now(timezone.utc) - gen).total_seconds() / 3600
            if age > max_age_hours:
                errs.append(f"generated_at is {age:.1f}h old (> {max_age_hours}h)")
        except ValueError:
            errs.append("generated_at not in YYYY-MM-DDTHH:MM:SSZ form")
    return errs


def validate_file(path: str | Path, **kw) -> list[str]:
    try:
        doc = load_strict(path)
    except (OSError, ValueError) as e:
        return [f"cannot load {path}: {e}"]
    return _schema_errors(doc) + sanity_errors(doc, **kw)

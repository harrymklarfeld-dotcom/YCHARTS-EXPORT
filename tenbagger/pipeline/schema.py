"""Shape check for data/companies.json (schema_version 1, see CONTRACT.md)."""
from __future__ import annotations

import json
import math

from .metrics import METRIC_FIELDS
from .tags import FUNDAMENTAL_FIELDS

SCHEMA_VERSION = 1
HISTORY_FIELDS = ["revenue", "net_income", "free_cash_flow", "eps_diluted",
                  "gross_margin", "operating_margin", "total_debt", "cash"]
COMPANY_KEYS = {
    "ticker": str, "cik": int, "name": str, "sector": str, "industry": str,
    "fiscal_year_end": str, "price": (int, float, type(None)), "price_date": (str, type(None)),
    "price_is_sample": bool, "latest_fy": int, "fundamentals": dict, "metrics": dict, "history": dict,
}
_NUM = (int, float, type(None))


def _finite(v) -> bool:
    return not (isinstance(v, float) and not math.isfinite(v))


def validate_document(doc: dict) -> list[str]:
    errs: list[str] = []
    if doc.get("schema_version") != SCHEMA_VERSION:
        errs.append("schema_version must be 1")
    if not isinstance(doc.get("generated_at"), str) or not doc["generated_at"].endswith("Z"):
        errs.append("generated_at must be an ISO-8601 UTC string ending in Z")
    if doc.get("source") not in ("sec-edgar-xbrl", "fixture"):
        errs.append("source must be 'sec-edgar-xbrl' or 'fixture'")
    comps = doc.get("companies")
    if not isinstance(comps, list):
        return errs + ["companies must be a list"]
    for c in comps:
        t = c.get("ticker", "?")
        for k, typ in COMPANY_KEYS.items():
            if k not in c:
                errs.append(f"{t}: missing {k}")
            elif not isinstance(c[k], typ) or (typ is int and isinstance(c[k], bool)):
                errs.append(f"{t}: {k} has type {type(c[k]).__name__}")
        f, m, h = c.get("fundamentals", {}), c.get("metrics", {}), c.get("history", {})
        if set(f) != set(FUNDAMENTAL_FIELDS):
            errs.append(f"{t}: fundamentals keys mismatch {sorted(set(f) ^ set(FUNDAMENTAL_FIELDS))}")
        if set(m) != set(METRIC_FIELDS):
            errs.append(f"{t}: metrics keys mismatch {sorted(set(m) ^ set(METRIC_FIELDS))}")
        for k, v in list(f.items()) + list(m.items()):
            if not isinstance(v, _NUM) or isinstance(v, bool) or not _finite(v):
                errs.append(f"{t}: {k} not a finite number/null: {v!r}")
        if set(h) != set(HISTORY_FIELDS):
            errs.append(f"{t}: history keys mismatch {sorted(set(h) ^ set(HISTORY_FIELDS))}")
        for k, series in h.items():
            if not isinstance(series, list) or len(series) > 10:
                errs.append(f"{t}: history.{k} must be a list of <= 10 pairs")
                continue
            years = [p[0] for p in series if isinstance(p, list) and len(p) == 2]
            if len(years) != len(series) or years != sorted(set(years)):
                errs.append(f"{t}: history.{k} must be [fy, value] pairs ascending by fy")
            if any(not isinstance(p[1], (int, float)) or not _finite(p[1]) for p in series):
                errs.append(f"{t}: history.{k} has non-finite values")
    try:
        json.dumps(doc, allow_nan=False)
    except ValueError as e:
        errs.append(f"not strict JSON: {e}")
    return errs

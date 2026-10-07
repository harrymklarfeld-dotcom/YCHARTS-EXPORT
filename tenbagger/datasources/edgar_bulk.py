"""SEC Financial Statement Data Sets (FSDS) -> fundamentals.

Bulk alternative to calling data.sec.gov/api/xbrl/companyfacts once per company.
Each quarterly zip (https://www.sec.gov/files/dera/data/financial-statement-data-sets/2025q2.zip)
holds tab-delimited sub.txt / num.txt / tag.txt / pre.txt for every XBRL filing in that
quarter. SEC data is US-government work, not subject to copyright: safe to display.

Two outputs:
1. ``write_companyfacts_cache`` emits companyfacts-shaped JSON
   (``<dir>/companyfacts/CIK##########.json`` + ``company_tickers.json``) so the pipeline's
   SecClient (env TENBAGGER_CACHE_DIR) reads bulk data as if it came from the per-company API.
2. ``EdgarBulkFundamentals`` implements ``FundamentalsSource`` directly (a simpler
   cross-check / fallback that does not depend on the pipeline package).

Only primary-entity, non-segment facts (empty ``coreg`` / ``segments``) of standard
taxonomies (us-gaap, dei, ifrs-full) are used; company-custom tags are skipped.
"""
from __future__ import annotations

import csv
import io
import json
import sys
import zipfile
from datetime import date, timedelta
from pathlib import Path
from typing import Iterable, Iterator

from .base import FundamentalsSource, LicenseInfo, SourceError
from .http import http_get

FSDS_URL = "https://www.sec.gov/files/dera/data/financial-statement-data-sets/{period}.zip"
ANNUAL_FORMS = {"10-K", "10-K/A", "10-KT", "10-KT/A", "20-F", "20-F/A", "40-F", "40-F/A"}
QUARTERLY_FORMS = {"10-Q", "10-Q/A"}
STD_NAMESPACES = ("us-gaap", "dei", "ifrs-full", "srt")
SEC_LICENSE = LicenseInfo(
    source="sec-fsds", display_allowed=True, license_ref="public domain (US government work, SEC EDGAR)",
    terms_url="https://www.sec.gov/data-research/sec-markets-data/financial-statement-data-sets",
    notes="Must send a descriptive User-Agent and stay <= 10 req/s (SEC fair-access policy).")

csv.field_size_limit(min(sys.maxsize, 2**31 - 1))

# Minimal tag priority list for EdgarBulkFundamentals (pipeline/tags.py is the canonical one).
FIELD_TAGS: dict[str, tuple[str, str, list[str]]] = {
    # field: (kind, unit, tags in priority order)
    "revenue": ("flow", "USD", ["Revenues", "RevenueFromContractWithCustomerExcludingAssessedTax",
                                "RevenueFromContractWithCustomerIncludingAssessedTax", "SalesRevenueNet"]),
    "cost_of_revenue": ("flow", "USD", ["CostOfRevenue", "CostOfGoodsAndServicesSold", "CostOfGoodsSold"]),
    "gross_profit": ("flow", "USD", ["GrossProfit"]),
    "operating_income": ("flow", "USD", ["OperatingIncomeLoss"]),
    "net_income": ("flow", "USD", ["NetIncomeLoss", "ProfitLoss"]),
    "eps_diluted": ("flow", "USD/shares", ["EarningsPerShareDiluted", "EarningsPerShareBasicAndDiluted"]),
    "shares_diluted": ("flow", "shares", ["WeightedAverageNumberOfDilutedSharesOutstanding"]),
    "operating_cash_flow": ("flow", "USD", ["NetCashProvidedByUsedInOperatingActivities"]),
    "capex": ("flow", "USD", ["PaymentsToAcquirePropertyPlantAndEquipment",
                              "PaymentsToAcquireProductiveAssets"]),
    "dividends_paid": ("flow", "USD", ["PaymentsOfDividends", "PaymentsOfDividendsCommonStock"]),
    "d_and_a": ("flow", "USD", ["DepreciationDepletionAndAmortization", "DepreciationAndAmortization",
                                "DepreciationAmortizationAndAccretionNet"]),
    "income_tax": ("flow", "USD", ["IncomeTaxExpenseBenefit"]),
    "pretax_income": ("flow", "USD", [
        "IncomeLossFromContinuingOperationsBeforeIncomeTaxesExtraordinaryItemsNoncontrollingInterest",
        "IncomeLossFromContinuingOperationsBeforeIncomeTaxesMinorityInterestAndIncomeLossFromEquityMethodInvestments"]),
    "cash": ("instant", "USD", ["CashAndCashEquivalentsAtCarryingValue",
                                "CashCashEquivalentsRestrictedCashAndRestrictedCashEquivalents"]),
    "total_assets": ("instant", "USD", ["Assets"]),
    "total_liabilities": ("instant", "USD", ["Liabilities"]),
    "total_equity": ("instant", "USD", ["StockholdersEquity",
                                        "StockholdersEquityIncludingPortionAttributableToNoncontrollingInterest"]),
    "total_debt": ("instant", "USD", ["LongTermDebt", "LongTermDebtNoncurrent"]),
    "current_assets": ("instant", "USD", ["AssetsCurrent"]),
    "current_liabilities": ("instant", "USD", ["LiabilitiesCurrent"]),
    "inventory": ("instant", "USD", ["InventoryNet"]),
}


# ---------------------------------------------------------------- download

def quarter_ids(last: str, n: int) -> list[str]:
    """quarter_ids("2026q2", 3) -> ["2025q4", "2026q1", "2026q2"]."""
    y, q = int(last[:4]), int(last[-1])
    out = []
    for _ in range(n):
        out.append(f"{y}q{q}")
        y, q = (y, q - 1) if q > 1 else (y - 1, 4)
    return out[::-1]


def latest_published_quarter(today: date | None = None) -> str:
    """FSDS for quarter Q is posted early in the following quarter; assume the previous one."""
    today = today or date.today()
    q = (today.month - 1) // 3 + 1
    y, q = (today.year, q - 1) if q > 1 else (today.year - 1, 4)
    return f"{y}q{q}"


def download_quarters(periods: Iterable[str], dest: str | Path, user_agent: str, fetch=http_get,
                      skip_missing: bool = True) -> list[Path]:
    if "@" not in user_agent:
        raise SourceError("SEC requires a User-Agent with contact email, e.g. 'Tenbagger ops@example.com'")
    dest = Path(dest)
    dest.mkdir(parents=True, exist_ok=True)
    got = []
    for p in periods:
        path = dest / f"{p}.zip"
        if path.exists() and path.stat().st_size > 0:
            got.append(path)
            continue
        try:
            body = fetch(FSDS_URL.format(period=p), headers={"User-Agent": user_agent}, as_json=False)
        except SourceError as e:
            if skip_missing:
                print(f"warning: FSDS {p} unavailable: {e}", file=sys.stderr)
                continue
            raise
        path.write_bytes(body)
        got.append(path)
    return got


# ---------------------------------------------------------------- parse

def _rows(zf: zipfile.ZipFile, name: str) -> Iterator[dict]:
    member = next((n for n in zf.namelist() if n.lower().endswith(name)), None)
    if member is None:
        raise SourceError(f"{name} missing from {zf.filename}")
    with zf.open(member) as raw:
        text = io.TextIOWrapper(raw, encoding="utf-8", errors="replace", newline="")
        yield from csv.DictReader(text, delimiter="\t", quoting=csv.QUOTE_NONE)


def _iso(yyyymmdd: str) -> str:
    s = (yyyymmdd or "").strip()
    return f"{s[:4]}-{s[4:6]}-{s[6:8]}" if len(s) >= 8 else s


def _minus_months(d: date, months: int) -> date:
    y, m = divmod(d.year * 12 + (d.month - 1) - months, 12)
    m += 1
    # clamp day to month length
    for day in (d.day, 30, 29, 28):
        try:
            return date(y, m, day)
        except ValueError:
            continue
    raise ValueError(d)


def _namespace(version: str) -> str | None:
    ns = (version or "").split("/")[0]
    return ns if ns in STD_NAMESPACES else None


def _unit(uom: str) -> str:
    u = (uom or "").strip()
    return "USD/shares" if u.lower() in {"usd/shares", "usd/share", "usdpershare"} else u


def read_fsds(zip_path: str | Path, ciks: set[int] | None = None, forms: set[str] | None = None) -> dict:
    """Parse one FSDS zip -> {"subs": {adsh: sub}, "facts": [fact...]} (filtered)."""
    forms = forms or ANNUAL_FORMS
    subs: dict[str, dict] = {}
    with zipfile.ZipFile(zip_path) as zf:
        for r in _rows(zf, "sub.txt"):
            try:
                cik = int(r["cik"])
            except (KeyError, ValueError):
                continue
            if r.get("form") not in forms or (ciks is not None and cik not in ciks):
                continue
            subs[r["adsh"]] = {"adsh": r["adsh"], "cik": cik, "name": r.get("name", ""),
                               "sic": r.get("sic") or None, "form": r["form"], "period": r.get("period", ""),
                               "fy": int(r["fy"]) if (r.get("fy") or "").isdigit() else None,
                               "fp": r.get("fp") or "", "filed": _iso(r.get("filed", "")),
                               "fye": r.get("fye") or ""}
        facts = []
        for r in _rows(zf, "num.txt"):
            s = subs.get(r.get("adsh", ""))
            if s is None or (r.get("coreg") or "").strip() or (r.get("segments") or "").strip():
                continue
            ns = _namespace(r.get("version", ""))
            val = (r.get("value") or "").strip()
            if ns is None or not val:
                continue
            try:
                facts.append({"adsh": s["adsh"], "ns": ns, "tag": r["tag"], "ddate": r["ddate"],
                              "qtrs": int(r["qtrs"]), "uom": _unit(r.get("uom", "")), "value": float(val)})
            except (KeyError, ValueError):
                continue
    return {"subs": subs, "facts": facts}


def to_companyfacts(parsed: Iterable[dict], names: dict[int, str] | None = None) -> dict[int, dict]:
    """Merge parsed FSDS zips into {cik: companyfacts-shaped document}."""
    docs: dict[int, dict] = {}
    seen: set[tuple] = set()
    for p in parsed:
        subs = p["subs"]
        for f in p["facts"]:
            s = subs[f["adsh"]]
            end = date.fromisoformat(_iso(f["ddate"]))
            entry = {"end": end.isoformat(), "val": int(f["value"]) if f["value"].is_integer() and
                     f["uom"] != "USD/shares" else f["value"],
                     "accn": s["adsh"], "fy": s["fy"], "fp": s["fp"] or ("FY" if s["form"] in ANNUAL_FORMS else ""),
                     "form": s["form"], "filed": s["filed"]}
            if f["qtrs"] > 0:
                entry = {"start": (_minus_months(end, 3 * f["qtrs"]) + timedelta(days=1)).isoformat(), **entry}
            key = (s["cik"], f["ns"], f["tag"], f["uom"], entry.get("start"), entry["end"], s["adsh"])
            if key in seen:
                continue
            seen.add(key)
            doc = docs.setdefault(s["cik"], {"cik": s["cik"],
                                             "entityName": (names or {}).get(s["cik"]) or s["name"],
                                             "facts": {}, "_sic": s["sic"]})
            units = doc["facts"].setdefault(f["ns"], {}).setdefault(
                f["tag"], {"label": f["tag"], "description": "from SEC Financial Statement Data Sets",
                           "units": {}})["units"]
            units.setdefault(f["uom"], []).append(entry)
            if s["sic"]:
                doc["_sic"] = s["sic"]
    return docs


def write_companyfacts_cache(zips: Iterable[str | Path], cache_dir: str | Path,
                             universe: dict[str, dict] | None = None) -> dict:
    """Emit <cache_dir>/companyfacts/CIK##########.json (+ company_tickers.json, sic.json).

    universe: {TICKER: {"cik": int, "name": str}} limits output and writes the ticker map.
    Point the pipeline at it with TENBAGGER_CACHE_DIR=<cache_dir> (and a TTL large enough).
    """
    cache_dir = Path(cache_dir)
    ciks = {int(v["cik"]) for v in universe.values()} if universe else None
    names = {int(v["cik"]): v.get("name") for v in (universe or {}).values()}
    docs = to_companyfacts((read_fsds(z, ciks) for z in zips), names)
    out = cache_dir / "companyfacts"
    out.mkdir(parents=True, exist_ok=True)
    sic = {}
    for cik, doc in docs.items():
        s = doc.pop("_sic", None)
        if s:
            sic[str(cik)] = int(s)
        with open(out / f"CIK{cik:010d}.json", "w", encoding="utf-8") as fh:
            json.dump(doc, fh, allow_nan=False)
    if universe:
        tmap = {str(i): {"cik_str": int(v["cik"]), "ticker": t, "title": v.get("name") or t}
                for i, (t, v) in enumerate(sorted(universe.items()))}
        with open(cache_dir / "company_tickers.json", "w", encoding="utf-8") as fh:
            json.dump(tmap, fh)
    with open(cache_dir / "sic.json", "w", encoding="utf-8") as fh:
        json.dump(sic, fh, sort_keys=True)
    missing = sorted(t for t, v in (universe or {}).items() if int(v["cik"]) not in docs)
    return {"companies": len(docs), "missing": missing, "dir": str(cache_dir)}


# ---------------------------------------------------------------- FundamentalsSource

def _fiscal_year(end: date) -> int:
    return end.year - 1 if (end.month == 1 and end.day <= 7) else end.year


class EdgarBulkFundamentals(FundamentalsSource):
    """Annual fundamentals straight from FSDS zips (annual forms only)."""
    name = "edgar_bulk"

    def __init__(self, zips: Iterable[str | Path], ciks: Iterable[int] | None = None):
        ciks_set = {int(c) for c in ciks} if ciks is not None else None
        self._docs = to_companyfacts(read_fsds(z, ciks_set) for z in zips)

    @property
    def license(self) -> LicenseInfo:
        return SEC_LICENSE

    def sic(self, cik: int) -> int | None:
        s = self._docs.get(int(cik), {}).get("_sic")
        return int(s) if s else None

    def ciks(self) -> list[int]:
        return sorted(self._docs)

    def annual_fundamentals(self, cik: int) -> dict[int, dict[str, float]]:
        doc = self._docs.get(int(cik))
        if doc is None:
            return {}
        gaap = doc["facts"].get("us-gaap", {})
        years: dict[int, dict[str, float]] = {}
        for field, (kind, unit, tags) in FIELD_TAGS.items():
            for tag in tags:
                best: dict[int, dict] = {}
                for e in gaap.get(tag, {}).get("units", {}).get(unit, []):
                    if e["form"] not in ANNUAL_FORMS:
                        continue
                    if kind == "flow":
                        if "start" not in e:
                            continue
                        days = (date.fromisoformat(e["end"]) - date.fromisoformat(e["start"])).days + 1
                        if not 350 <= days <= 380:
                            continue
                    elif "start" in e:
                        continue
                    fy = _fiscal_year(date.fromisoformat(e["end"]))
                    cur = best.get(fy)
                    if cur is None or (e["filed"], e["end"]) >= (cur["filed"], cur["end"]):
                        best[fy] = e
                for fy, e in best.items():
                    years.setdefault(fy, {}).setdefault(field, e["val"])
        for f in years.values():
            if "gross_profit" not in f and "revenue" in f and "cost_of_revenue" in f:
                f["gross_profit"] = f["revenue"] - f["cost_of_revenue"]
            if "operating_cash_flow" in f and "capex" in f:
                f["free_cash_flow"] = f["operating_cash_flow"] - f["capex"]
        return dict(sorted(years.items()))

"""Generate offline EDGAR companyfacts fixtures (real companyfacts JSON structure).

    python -m pipeline make-fixtures

Writes tenbagger/data/fixtures/edgar/CIK##########.json + company_tickers.json.

Each synthetic 10-K filing carries the current year plus two prior years for flow
items and current + prior year-end for balance-sheet items, tagged with the
*filing's* fy (exactly like real companyfacts), so the extractor's period logic,
restatement dedupe and tag fallback are exercised.

- MU: built from the real YCharts statement exports in <repo>/data/ycharts/ (real data).
- Everyone else: fixture_data.COMPANIES, APPROXIMATE values typed from memory.
"""
from __future__ import annotations

import json
import sys
from datetime import date, timedelta
from pathlib import Path

from . import fixture_data as FD
from .sec import FIXTURE_EDGAR_DIR, TENBAGGER_DIR, cik_file

REPO_ROOT = TENBAGGER_DIR.parent
YCHARTS_DIR = REPO_ROOT / "data" / "ycharts"
INSTANT_COLS = {"cash", "total_assets", "total_liabilities", "total_equity", "lt_debt_noncurrent",
                "debt_current", "short_term_debt", "current_assets", "current_liabilities", "inventory"}
UNITS = {"eps_diluted": "USD/shares", "shares_diluted": "shares"}
SCALE = {"eps_diluted": 1, "shares_diluted": 1_000_000}
DISCLAIMER = "SYNTHETIC FIXTURE: approximate values typed from memory; replace with a live EDGAR pull."


def _scaled(col, v):
    if v is None:
        return None
    s = SCALE.get(col, 1_000_000)
    x = v * s
    return round(x, 4) if col == "eps_diluted" else int(round(x))


def _tag_for(tags, col, filing_fy):
    t = tags.get(col, FD.DEFAULT_TAGS.get(col))
    if isinstance(t, list):  # [(first_filing_fy, tag), ...] ascending
        chosen = None
        for first, name in t:
            if filing_fy >= first:
                chosen = name
        return chosen
    return t


def synth_companyfacts(cik: int, name: str, ends: list[str], years: dict[int, dict],
                       tags: dict | None = None, restatements: dict | None = None,
                       filing_lag_days: int = 45, description: str = DISCLAIMER,
                       extra: list[tuple[str, str, dict]] | None = None) -> dict:
    """years: {fy: {col: value (USD millions / EPS / shares millions)}}.
    ends: fiscal-year end dates ascending; the first one only supplies the first start date.
    extra: additional raw facts [(tag, unit, fact_dict)]."""
    tags = tags or {}
    restatements = restatements or {}
    end_by_fy = {}
    start_by_fy = {}
    for prev, cur in zip(ends, ends[1:]):
        fy = cur[:4] if not (cur[5:7] == "01" and int(cur[8:10]) <= 7) else str(int(cur[:4]) - 1)
        end_by_fy[int(fy)] = cur
        start_by_fy[int(fy)] = (date.fromisoformat(prev) + timedelta(days=1)).isoformat()

    usgaap: dict[str, dict] = {}
    dei_rows = []

    def add(tag, unit, fact):
        node = usgaap.setdefault(tag, {"label": tag, "description": description, "units": {}})
        node["units"].setdefault(unit, []).append(fact)

    def value(col, period_fy, filing_fy):
        v = years.get(period_fy, {}).get(col)
        for first, periods in sorted(restatements.items()):
            if filing_fy >= first and col in periods.get(period_fy, {}):
                v = periods[period_fy][col]
        return v

    for seq, filing_fy in enumerate(sorted(years), start=1):
        if filing_fy not in end_by_fy:
            continue
        filed = (date.fromisoformat(end_by_fy[filing_fy]) + timedelta(days=filing_lag_days)).isoformat()
        accn = f"{cik:010d}-{str(int(filed[:4]))[2:]}-{seq:06d}"
        for col in FD.COLS:
            tag = _tag_for(tags, col, filing_fy)
            if not tag:
                continue
            instant = col in INSTANT_COLS
            periods = [filing_fy, filing_fy - 1] if instant else [filing_fy, filing_fy - 1, filing_fy - 2]
            for p in periods:
                v = _scaled(col, value(col, p, filing_fy))
                if v is None or p not in end_by_fy:
                    continue
                fact = {"end": end_by_fy[p], "val": v, "accn": accn, "fy": filing_fy, "fp": "FY",
                        "form": "10-K", "filed": filed}
                if not instant:
                    fact = {"start": start_by_fy[p], **fact}
                add(tag, UNITS.get(col, "USD"), fact)
        sh = years[filing_fy].get("shares_diluted")
        if sh:
            dei_rows.append({"end": filed, "val": int(sh * 1_000_000), "accn": accn, "fy": filing_fy,
                             "fp": "FY", "form": "10-K", "filed": filed})
    for tag, unit, fact in extra or []:
        add(tag, unit, fact)
    doc = {"cik": cik, "entityName": name, "facts": {"us-gaap": usgaap}}
    if dei_rows:
        doc["facts"]["dei"] = {"EntityCommonStockSharesOutstanding": {
            "label": "Entity Common Stock, Shares Outstanding", "description": description,
            "units": {"shares": dei_rows}}}
    return doc


# ---------------------------------------------------------------- MU from YCharts
MU_ENDS = ["2014-08-28", "2015-09-03", "2016-09-01", "2017-08-31", "2018-08-30", "2019-08-29",
           "2020-09-03", "2021-09-02", "2022-09-01", "2023-08-31", "2024-08-29", "2025-08-28"]
MU_TAGS = {
    # ASC 606 adopted in FY2019: earlier 10-Ks used SalesRevenueNet.
    "revenue": [(0, "SalesRevenueNet"), (2019, "RevenueFromContractWithCustomerExcludingAssessedTax")],
    "cost_of_revenue": "CostOfGoodsAndServicesSold",
    "debt_current": "DebtCurrent",
}
YC_FLOW = {"revenue": ("inc", "Revenue"), "cost_of_revenue": ("inc", "Cost of Goods Sold"),
           "gross_profit": ("inc", "Gross Profit"), "operating_income": ("inc", "Operating Income"),
           "pretax_income": ("inc", "Pre-Tax Income"), "income_tax": ("inc", "Provision for Income Taxes"),
           # NetIncomeLoss is attributable to the parent, so use YCharts' attributable line
           # (its "Net Income" row includes noncontrolling interests: +$45M in FY2019).
           "net_income": ("inc", "Net Income Attr to Common Stockholders"), "operating_cash_flow": ("cf", "Cash from Operations"),
           "capex": ("cf", "Capital Expenditures - Total"), "dividends_paid": ("cf", "Total Dividends Paid"),
           "d_and_a": ("cf", "Total Depreciation and Amortization")}
YC_INSTANT = {"cash": "Cash Only", "total_assets": "Total Assets", "total_liabilities": "Total Liabilities",
              "total_equity": "Shareholders Equity", "lt_debt_noncurrent": "Non-Current Portion of Long Term Debt",
              "debt_current": "ST Debt & Current Portion Of LT Debt", "current_assets": "Total Current Assets",
              "current_liabilities": "Total Current Liabilities", "inventory": "Inventories",
              "total_debt": "Total Debt"}


def load_ycharts(folder: Path = YCHARTS_DIR, ticker: str = "MU", fye_month: int = 8) -> dict[int, dict]:
    """Annual values ($M; EPS $; shares M) per fiscal year from YCharts quarterly exports.
    Flow items = sum of the fiscal year's 4 quarters; balance sheet = fiscal-year-end quarter."""
    if str(REPO_ROOT) not in sys.path:
        sys.path.insert(0, str(REPO_ROOT))
    try:
        import openpyxl  # noqa: F401
    except ImportError as e:  # pragma: no cover
        raise RuntimeError("openpyxl is required for YCharts files: pip install openpyxl") from e
    from ycharts_export.load_xlsx import find, load_statement

    d_inc, inc = load_statement(find(str(folder), ticker, "Income"))
    _, bs = load_statement(find(str(folder), ticker, "Balance"))
    _, cf = load_statement(find(str(folder), ticker, "Cash"))
    tables = {"inc": inc, "cf": cf}

    def fy_of(d):
        return d.year if d.month <= fye_month else d.year + 1

    out: dict[int, dict] = {}
    groups: dict[int, list] = {}
    for d in d_inc:
        if inc.get("Revenue", {}).get(d) is not None:
            groups.setdefault(fy_of(d), []).append(d)
    for fy, qs in groups.items():
        if len(qs) != 4:
            continue
        a: dict = {"quarters": len(qs)}
        for col, (tbl, label) in YC_FLOW.items():
            vals = [tables[tbl].get(label, {}).get(q) for q in qs]
            a[col] = None if any(v is None for v in vals) else float(sum(vals))
        if a.get("capex") is not None:
            a["capex"] = abs(a["capex"])
        if a.get("dividends_paid") is not None:
            a["dividends_paid"] = abs(a["dividends_paid"]) or None
        sh = [inc.get("Average Diluted Shares Outstanding", {}).get(q) for q in qs]
        a["shares_diluted"] = sum(sh) / 4 if all(s is not None for s in sh) else None
        a["eps_diluted"] = round(a["net_income"] / a["shares_diluted"], 2) \
            if a.get("net_income") is not None and a["shares_diluted"] else None
        a["eps_diluted_sum_of_quarters"] = sum(inc.get("EPS Diluted", {}).get(q) or 0 for q in qs)
        ye = max(qs)
        for col, label in YC_INSTANT.items():
            v = bs.get(label, {}).get(ye)
            a[col] = None if v is None else float(v)
        a["free_cash_flow"] = a["operating_cash_flow"] - a["capex"] \
            if a.get("operating_cash_flow") is not None and a.get("capex") is not None else None
        out[fy] = a
    return out


def build_mu_from_ycharts(folder: Path = YCHARTS_DIR) -> dict:
    yc = load_ycharts(folder)
    fys = [fy for fy in range(2015, 2026) if fy in yc]
    years = {fy: {c: yc[fy].get(c) for c in FD.COLS} for fy in fys}
    # 10-Q facts for FY2026 Q1-Q3 (real quarterly values) + a 3-month Q4 fact inside the
    # FY2025 10-K: both must be ignored by the annual extractor.
    q = [("2025-08-29", "2025-11-27", "Q1", 13643, 5240, 4.60, "2025-12-19"),
         ("2025-11-28", "2026-02-26", "Q2", 23860, 13785, 12.07, "2026-03-20"),
         ("2026-02-27", "2026-05-28", "Q3", 41456, 28243, 24.67, "2026-06-26")]
    extra = []
    for start, end, fp, rev, ni, eps, filed in q:
        base = {"start": start, "end": end, "accn": f"0000723125-26-0000{fp[1]}0", "fy": 2026,
                "fp": fp, "form": "10-Q", "filed": filed}
        extra += [("RevenueFromContractWithCustomerExcludingAssessedTax", "USD", {**base, "val": rev * 1_000_000}),
                  ("NetIncomeLoss", "USD", {**base, "val": ni * 1_000_000}),
                  ("EarningsPerShareDiluted", "USD/shares", {**base, "val": eps})]
    extra.append(("RevenueFromContractWithCustomerExcludingAssessedTax", "USD",
                  {"start": "2025-05-30", "end": "2025-08-28", "val": 11315 * 1_000_000,
                   "accn": "0000723125-25-000011", "fy": 2025, "fp": "FY", "form": "10-K",
                   "filed": "2025-10-12"}))
    return synth_companyfacts(723125, "MICRON TECHNOLOGY INC", MU_ENDS, years, MU_TAGS,
                              description="Built from YCharts statement exports in data/ycharts/ "
                                          "(real reported values; annual = sum of fiscal quarters).",
                              extra=extra)


def write_fixtures(out_dir: Path = FIXTURE_EDGAR_DIR, include_mu: bool = True) -> list[Path]:
    out_dir.mkdir(parents=True, exist_ok=True)
    written = []
    tickers = {}
    docs = {}
    for t, spec in FD.COMPANIES.items():
        years = {fy: dict(zip(FD.COLS, row)) for fy, row in spec["years"].items()}
        docs[t] = synth_companyfacts(spec["cik"], spec["name"], spec["ends"], years,
                                     spec.get("tags"), spec.get("restatements"))
    if include_mu:
        docs["MU"] = build_mu_from_ycharts()
    for i, (t, doc) in enumerate(sorted(docs.items())):
        p = out_dir / cik_file(doc["cik"])
        with open(p, "w", encoding="utf-8") as fh:
            json.dump(doc, fh, indent=1)
        written.append(p)
        tickers[str(i)] = {"cik_str": doc["cik"], "ticker": t, "title": doc["entityName"]}
    p = out_dir / "company_tickers.json"
    with open(p, "w", encoding="utf-8") as fh:
        json.dump(tickers, fh, indent=1)
    written.append(p)
    return written

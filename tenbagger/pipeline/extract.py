"""Pick annual 10-K facts out of an EDGAR companyfacts document.

Rules
- Only form 10-K / 10-K/A (and 10-KT) facts with fp == "FY".
- Flow items (income / cash-flow) need a start date and a 350-380 day duration,
  which drops the 3-month Q4 and 9-month YTD values some filers put in a 10-K.
- The companyfacts `fy` field is the fiscal year of the *filing*, not of the
  period (a FY2025 10-K also carries FY2024 and FY2023 comparatives tagged fy=2025),
  so the period's fiscal year is derived from its `end` date.
- Restatements: the same period is reported by several filings; the value from
  the latest `filed` date wins.
- Instant (balance-sheet) facts are kept only when they fall on (within 10 days of)
  a fiscal-year-end found in the flow facts, which drops beginning-of-period
  equity balances and other off-cycle instants.
"""
from __future__ import annotations

from datetime import date

from .tags import ALL_TAGS, FIELD_TAGS

ANNUAL_FORMS = {"10-K", "10-K/A", "10-KT", "10-KT/A"}
MIN_DAYS, MAX_DAYS = 350, 380
INSTANT_TOLERANCE_DAYS = 10


def _d(s: str) -> date:
    return date.fromisoformat(s[:10])


def fiscal_year_of(end: date | str) -> int:
    """Fiscal year = the calendar year the period ends in.

    52/53-week years that end in the first week of January (e.g. J&J's FY2020
    ended 2021-01-03) belong to the prior year.
    """
    if isinstance(end, str):
        end = _d(end)
    if end.month == 1 and end.day <= 7:
        return end.year - 1
    return end.year


def is_annual(entry: dict, kind: str) -> bool:
    if entry.get("form") not in ANNUAL_FORMS or entry.get("fp") != "FY":
        return False
    if entry.get("val") is None or "end" not in entry:
        return False
    if kind == "flow":
        if not entry.get("start"):
            return False
        days = (_d(entry["end"]) - _d(entry["start"])).days + 1
        return MIN_DAYS <= days <= MAX_DAYS
    return not entry.get("start")


def dedupe_latest(entries: list[dict]) -> list[dict]:
    """Keep one fact per (start, end) period: the most recently filed one."""
    best: dict[tuple, dict] = {}
    for e in entries:
        key = (e.get("start"), e["end"])
        cur = best.get(key)
        rank = (e.get("filed", ""), e.get("form", "").endswith("/A"))
        if cur is None or rank >= (cur.get("filed", ""), cur.get("form", "").endswith("/A")):
            best[key] = e
    return list(best.values())


def tag_entries(facts: dict, tag: str, unit: str, namespace: str = "us-gaap") -> list[dict]:
    return (facts.get("facts", {}).get(namespace, {}).get(tag, {})
            .get("units", {}).get(unit, []) or [])


def annual_series(facts: dict, tag: str, unit: str, kind: str,
                  fy_ends: dict[int, date] | None = None) -> dict[int, dict]:
    """Return {fiscal_year: fact} for one tag, annual + deduped."""
    rows = dedupe_latest([e for e in tag_entries(facts, tag, unit) if is_annual(e, kind)])
    out: dict[int, dict] = {}
    for e in rows:
        end = _d(e["end"])
        fy = fiscal_year_of(end)
        if kind == "instant" and fy_ends:
            target = fy_ends.get(fy)
            if target is None or abs((end - target).days) > INSTANT_TOLERANCE_DAYS:
                continue
        cur = out.get(fy)
        if cur is None or (e["end"], e.get("filed", "")) > (cur["end"], cur.get("filed", "")):
            out[fy] = e
    return out


def resolve_field(facts: dict, tags: list[str], unit: str, kind: str,
                  fy_ends: dict[int, date] | None = None) -> dict[int, tuple[float, str, dict]]:
    """Per-FY ordered fallback: {fy: (value, tag_used, fact)}."""
    out: dict[int, tuple[float, str, dict]] = {}
    for tag in tags:
        for fy, e in annual_series(facts, tag, unit, kind, fy_ends).items():
            if fy not in out:
                out[fy] = (e["val"], tag, e)
    return out


def _fy_ends(facts: dict) -> dict[int, date]:
    """Fiscal-year end dates, taken from the core flow items."""
    ends: dict[int, date] = {}
    for field in ("revenue", "net_income", "operating_cash_flow"):
        kind, unit, tags = FIELD_TAGS[field]
        for fy, (_, _, e) in resolve_field(facts, tags, unit, kind).items():
            end = _d(e["end"])
            if fy not in ends or end > ends[fy]:
                ends[fy] = end
    return ends


def _num(v):
    if v is None:
        return None
    return int(v) if float(v).is_integer() else float(v)


def _total_debt(h: dict) -> float | None:
    """total_debt = noncurrent long-term debt + current debt.

    current debt = DebtCurrent if tagged (it already includes short-term borrowings),
    else LongTermDebtCurrent + (CommercialPaper | ShortTermBorrowings).
    When only LongTermDebt (which includes current maturities) is tagged, it is used as
    the long-term total and only short-term borrowings are added on top."""
    lt_cur, st, dcur = h.get("lt_debt_current"), h.get("short_term_debt"), h.get("debt_current")
    noncur = h.get("lt_debt_noncurrent")
    if noncur is None and h.get("lt_debt_total") is not None:
        if lt_cur is not None:
            noncur = h["lt_debt_total"] - lt_cur
        else:
            return h["lt_debt_total"] + (st or 0)
    if dcur is not None:
        current = dcur
    elif lt_cur is not None or st is not None:
        current = (lt_cur or 0) + (st or 0)
    else:
        current = None
    if noncur is None and current is None:
        return None
    return (noncur or 0) + (current or 0)


def extract_annuals(facts: dict) -> dict:
    """Return {"years": {fy: {field: value}}, "fy_end": {fy: 'YYYY-MM-DD'},
    "tags": {fy: {field: tag}}}. Values are raw USD / raw share counts."""
    fy_ends = _fy_ends(facts)
    raw: dict[str, dict[int, tuple]] = {}
    for name, (kind, unit, tags) in ALL_TAGS.items():
        raw[name] = resolve_field(facts, tags, unit, kind, fy_ends if kind == "instant" else None)

    years: dict[int, dict] = {}
    used: dict[int, dict] = {}
    for fy in sorted(fy_ends):
        h = {k: (v[fy][0] if fy in v else None) for k, v in raw.items()}
        used[fy] = {k: v[fy][1] for k, v in raw.items() if fy in v}
        f: dict = {k: h.get(k) for k in FIELD_TAGS}
        # derived / composite fields
        if f["gross_profit"] is None and f["revenue"] is not None and f["cost_of_revenue"] is not None:
            f["gross_profit"] = f["revenue"] - f["cost_of_revenue"]
            used[fy]["gross_profit"] = "derived:revenue-cost_of_revenue"
        if f["total_liabilities"] is None and h.get("liab_and_equity") is not None:
            eq = h.get("equity_incl_nci") if h.get("equity_incl_nci") is not None else f["total_equity"]
            if eq is not None:
                f["total_liabilities"] = h["liab_and_equity"] - eq
                used[fy]["total_liabilities"] = "derived:LiabilitiesAndStockholdersEquity-equity"
        f["total_debt"] = _total_debt(h)
        if f["capex"] is not None:
            f["capex"] = abs(f["capex"])
        if f["dividends_paid"] is not None:
            f["dividends_paid"] = abs(f["dividends_paid"])
        f["free_cash_flow"] = (f["operating_cash_flow"] - f["capex"]
                               if f["operating_cash_flow"] is not None and f["capex"] is not None else None)
        years[fy] = {k: _num(v) for k, v in f.items()}
    return {"years": years, "fy_end": {fy: d.isoformat() for fy, d in fy_ends.items()}, "tags": used}


def fill_imputations(f: dict) -> list[str]:
    """Impute zero for items that are usually simply absent when zero.

    dividends_paid -> 0 when the cash-flow statement exists but no dividend tag;
    total_debt -> 0 when the balance sheet exists but no debt tag.
    Returns the list of imputed field names (for the record's data_notes)."""
    notes = []
    if f.get("dividends_paid") is None and f.get("operating_cash_flow") is not None:
        f["dividends_paid"] = 0
        notes.append("dividends_paid imputed 0 (no dividend tag in 10-K)")
    if f.get("total_debt") is None and f.get("total_assets") is not None:
        f["total_debt"] = 0
        notes.append("total_debt imputed 0 (no debt tags in 10-K)")
    return notes


def entity_shares_outstanding(facts: dict) -> float | None:
    """Latest dei:EntityCommonStockSharesOutstanding (cover page), a fallback share count."""
    rows = tag_entries(facts, "EntityCommonStockSharesOutstanding", "shares", "dei")
    if not rows:
        return None
    return max(rows, key=lambda e: (e.get("end", ""), e.get("filed", "")))["val"]


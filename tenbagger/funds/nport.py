"""Parse SEC Form N-PORT-P XML (``primary_doc.xml``).

Only the public parts of the form are read:
- ``formData/genInfo``: registrant, series name/id, reporting period
- ``formData/fundInfo``: total assets, liabilities, net assets
- ``formData/invstOrSecs/invstOrSec``: one element per position

The parser ignores XML namespaces (EDGAR has used several prefixes over the years) and
never raises on missing optional fields: anything absent becomes ``None``.

Units follow CONTRACT.md: USD raw, ratios as decimals. N-PORT reports ``pctVal`` in
percent (7.35 = 7.35%), which we convert to a decimal weight (0.0735).
"""
from __future__ import annotations

import xml.etree.ElementTree as ET
from dataclasses import dataclass, field
from pathlib import Path


def _local(tag: str) -> str:
    return tag.rsplit("}", 1)[-1] if "}" in tag else tag


def _child(el: ET.Element | None, name: str) -> ET.Element | None:
    if el is None:
        return None
    for c in el:
        if _local(c.tag) == name:
            return c
    return None


def _find(el: ET.Element | None, *path: str) -> ET.Element | None:
    cur = el
    for p in path:
        cur = _child(cur, p)
        if cur is None:
            return None
    return cur


def _text(el: ET.Element | None, *path: str) -> str | None:
    node = _find(el, *path) if path else el
    if node is None or node.text is None:
        return None
    t = node.text.strip()
    return t or None


def _num(s: str | None) -> float | None:
    if s is None:
        return None
    try:
        v = float(s.replace(",", ""))
    except ValueError:
        return None
    if v != v or v in (float("inf"), float("-inf")):
        return None
    return v


@dataclass
class Holding:
    name: str
    title: str | None = None
    cusip: str | None = None
    isin: str | None = None
    ticker: str | None = None
    lei: str | None = None
    balance: float | None = None
    units: str | None = None
    value_usd: float | None = None
    weight: float | None = None          # decimal share of net assets (pctVal / 100)
    payoff: str | None = None            # Long / Short / N/A
    asset_cat: str | None = None         # EC, EP, DBT, STIV, COMM, ...
    asset_cat_desc: str | None = None    # for assetConditional / OTHER
    issuer_cat: str | None = None        # CORP, UST, RF, ...
    country: str | None = None


@dataclass
class NportFiling:
    reg_name: str | None = None
    reg_cik: str | None = None
    series_name: str | None = None
    series_id: str | None = None
    class_ids: list[str] = field(default_factory=list)
    period_end: str | None = None        # repPdDate: the "as of" date of the holdings
    fiscal_year_end: str | None = None   # repPdEnd
    total_assets: float | None = None
    total_liabilities: float | None = None
    net_assets: float | None = None
    holdings: list[Holding] = field(default_factory=list)


def _parse_holding(el: ET.Element) -> Holding:
    ids = _child(el, "identifiers")
    isin = ticker = None
    if ids is not None:
        for c in ids:
            nm = _local(c.tag)
            val = (c.get("value") or "").strip() or None
            if nm == "isin":
                isin = val
            elif nm == "ticker":
                ticker = val
            elif nm == "other" and (c.get("otherDesc") or "").strip().lower() == "ticker" and not ticker:
                ticker = val
    asset_cat = _text(el, "assetCat")
    asset_desc = None
    if asset_cat is None:
        cond = _child(el, "assetConditional")
        if cond is not None:
            asset_cat = (cond.get("assetCat") or "").strip() or None
            asset_desc = (cond.get("desc") or "").strip() or None
    issuer_cat = _text(el, "issuerCat")
    if issuer_cat is None:
        cond = _child(el, "issuerConditional")
        if cond is not None:
            issuer_cat = (cond.get("issuerCat") or "").strip() or None
    pct = _num(_text(el, "pctVal"))
    cusip = _text(el, "cusip")
    if cusip and set(cusip) <= {"0", "N", "A", "/"}:   # "000000000" / "N/A" placeholders
        cusip = None
    return Holding(
        name=_text(el, "name") or _text(el, "title") or "Unnamed position",
        title=_text(el, "title"),
        cusip=cusip,
        isin=isin,
        ticker=ticker.upper() if ticker else None,
        lei=_text(el, "lei"),
        balance=_num(_text(el, "balance")),
        units=_text(el, "units"),
        value_usd=_num(_text(el, "valUSD")),
        weight=None if pct is None else pct / 100.0,
        payoff=_text(el, "payoffProfile"),
        asset_cat=asset_cat.upper() if asset_cat else None,
        asset_cat_desc=asset_desc,
        issuer_cat=issuer_cat.upper() if issuer_cat else None,
        country=_text(el, "invCountry"),
    )


def parse_nport(xml: str | bytes) -> NportFiling:
    """Parse one N-PORT-P primary document. Raises ValueError on non-XML input."""
    try:
        root = ET.fromstring(xml)
    except ET.ParseError as e:
        raise ValueError(f"not valid N-PORT XML: {e}") from e
    form = _child(root, "formData")
    gen = _child(form, "genInfo")
    info = _child(form, "fundInfo")
    header = _child(root, "headerData")
    sc = _find(header, "filerInfo", "seriesClassInfo")
    class_ids = []
    if sc is not None:
        class_ids = [c.text.strip() for c in sc if _local(c.tag) == "classId" and c.text]
    out = NportFiling(
        reg_name=_text(gen, "regName"),
        reg_cik=_text(gen, "regCik"),
        series_name=_text(gen, "seriesName"),
        series_id=_text(gen, "seriesId") or _text(sc, "seriesId"),
        class_ids=class_ids,
        period_end=_text(gen, "repPdDate"),
        fiscal_year_end=_text(gen, "repPdEnd"),
        total_assets=_num(_text(info, "totAssets")),
        total_liabilities=_num(_text(info, "totLiabs")),
        net_assets=_num(_text(info, "netAssets")),
    )
    secs = _child(form, "invstOrSecs")
    if secs is not None:
        out.holdings = [_parse_holding(e) for e in secs if _local(e.tag) == "invstOrSec"]
    return out


def parse_nport_file(path: str | Path) -> NportFiling:
    return parse_nport(Path(path).read_bytes())


# ---------------------------------------------------------------- allocation

STOCK_CATS = {"EC", "EP"}
BOND_CATS = {"DBT", "ABS-MBS", "ABS-ASBS", "ABS-CBDO", "ABS-O", "LON", "SN"}
CASH_CATS = {"STIV"}
COMMODITY_CATS = {"COMM"}


def bucket_for(h: Holding) -> str:
    cat = (h.asset_cat or "").upper()
    if cat in STOCK_CATS:
        return "stock"
    if cat in BOND_CATS or cat.startswith("ABS"):
        return "bond"
    if cat in CASH_CATS:
        return "cash"
    if cat in COMMODITY_CATS:
        return "commodity"
    if cat == "OTHER" and h.asset_cat_desc and "gold" in h.asset_cat_desc.lower():
        return "commodity"
    return "other"


def allocation(filing: NportFiling) -> dict[str, float]:
    """Asset mix as decimals summing to 1.0 (±rounding).

    N-PORT lists securities only; uninvested cash and other net assets are the gap between
    the sum of ``pctVal`` and 100%. A positive gap is counted as cash. If positions add up to
    more than 100% (liabilities, leverage), buckets are scaled so the mix still sums to 1.
    """
    buckets = {"stock": 0.0, "bond": 0.0, "cash": 0.0, "commodity": 0.0, "other": 0.0}
    for h in filing.holdings:
        if h.weight is None:
            continue
        buckets[bucket_for(h)] += h.weight
    total = sum(buckets.values())
    if total <= 0:
        return buckets  # nothing usable: all zeros (caller treats as unknown)
    if total < 1.0:
        buckets["cash"] += 1.0 - total
    else:
        buckets = {k: v / total for k, v in buckets.items()}
    # Negative buckets (net short) are folded into "other" and re-normalised.
    if any(v < 0 for v in buckets.values()):
        neg = sum(v for v in buckets.values() if v < 0)
        buckets = {k: max(v, 0.0) for k, v in buckets.items()}
        buckets["other"] = max(0.0, buckets["other"] + neg)
        s = sum(buckets.values()) or 1.0
        buckets = {k: v / s for k, v in buckets.items()}
    return {k: round(v, 6) for k, v in buckets.items()}

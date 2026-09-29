"""Assemble contract company records and write data/companies.json."""
from __future__ import annotations

import json
import sys
from datetime import datetime, timezone
from pathlib import Path

from . import universe
from .extract import entity_shares_outstanding, extract_annuals, fill_imputations
from .metrics import clean, compute_metrics, div
from .prices import load_prices
from .schema import HISTORY_FIELDS, SCHEMA_VERSION, validate_document
from .sec import TENBAGGER_DIR, SecClient, SecError
from .tags import FUNDAMENTAL_FIELDS

DEFAULT_OUT = TENBAGGER_DIR / "data" / "companies.json"
MAX_HISTORY = 10


def _latest_fy(years: dict[int, dict]) -> int | None:
    good = [fy for fy, f in years.items() if f.get("net_income") is not None
            and (f.get("revenue") is not None or f.get("total_assets") is not None)]
    return max(good) if good else None


def build_history(years: dict[int, dict], latest_fy: int) -> dict[str, list]:
    fys = sorted(fy for fy in years if fy <= latest_fy)[-MAX_HISTORY:]
    hist: dict[str, list] = {k: [] for k in HISTORY_FIELDS}
    for fy in fys:
        f = years[fy]
        vals = {
            "revenue": f.get("revenue"), "net_income": f.get("net_income"),
            "free_cash_flow": f.get("free_cash_flow"), "eps_diluted": f.get("eps_diluted"),
            "gross_margin": div(f.get("gross_profit"), f.get("revenue")),
            "operating_margin": div(f.get("operating_income"), f.get("revenue")),
            "total_debt": f.get("total_debt"), "cash": f.get("cash"),
        }
        for k, v in vals.items():
            v = clean(v)
            if v is not None:  # years with no value are omitted rather than null
                hist[k].append([fy, v])
    return hist


def build_company(ticker: str, facts: dict, meta: dict, price_info: dict | None) -> dict | None:
    """meta: {cik, name, sector, industry}. Returns a contract company record or None."""
    ann = extract_annuals(facts)
    years = ann["years"]
    fy = _latest_fy(years)
    if fy is None:
        return None
    f = dict(years[fy])
    notes = fill_imputations(f)
    if f.get("free_cash_flow") is None and f.get("operating_cash_flow") is not None and f.get("capex") is not None:
        f["free_cash_flow"] = f["operating_cash_flow"] - f["capex"]
    if f.get("shares_diluted") is None:
        so = entity_shares_outstanding(facts)
        if so:
            f["shares_diluted"] = so
            notes.append("shares_diluted from dei:EntityCommonStockSharesOutstanding")
    price_info = price_info or {}
    price = price_info.get("price")
    metrics = compute_metrics(f, price, years.get(fy - 1), years.get(fy - 3))
    rec = {
        "ticker": ticker.upper(),
        "cik": int(meta.get("cik") or facts.get("cik")),
        "name": meta.get("name") or facts.get("entityName") or ticker.upper(),
        "sector": meta.get("sector") or "Unknown",
        "industry": meta.get("industry") or "Unknown",
        "fiscal_year_end": ann["fy_end"][fy][5:],
        "price": price,
        "price_date": price_info.get("price_date"),
        "price_is_sample": bool(price_info.get("price_is_sample", True)),
        "latest_fy": fy,
        "fundamentals": {k: clean(f.get(k), 4) if k == "eps_diluted" else clean(f.get(k))
                         for k in FUNDAMENTAL_FIELDS},
        "metrics": metrics,
        "history": build_history(years, fy),
    }
    if notes:
        rec["data_notes"] = notes  # additive, optional field
    return rec


def resolve_meta(tickers: list[str], client: SecClient) -> dict[str, dict]:
    metas: dict[str, dict] = {}
    need_map = [t for t in tickers if universe.lookup(t) is None]
    tmap = {}
    if need_map:
        try:
            tmap = client.ticker_map()
        except SecError as e:
            print(f"warning: ticker map unavailable: {e}", file=sys.stderr)
    for t in tickers:
        u = universe.lookup(t)
        if u:
            metas[t] = {"cik": u[0], "name": u[1], "sector": u[2], "industry": u[3]}
        elif t in tmap:
            metas[t] = {"cik": tmap[t]["cik"], "name": tmap[t]["name"]}
        else:
            print(f"warning: unknown ticker {t} (not in bundled universe or ticker map)", file=sys.stderr)
    return metas


def build_dataset(tickers: list[str], offline: bool = False, prices_path: str | None = None,
                  client: SecClient | None = None) -> dict:
    client = client or SecClient(offline=offline)
    tickers = [t.strip().upper() for t in tickers if t.strip()]
    prices = load_prices(None)                 # sample fallback
    if prices_path:
        prices.update(load_prices(prices_path))  # user file overrides
    companies = []
    for t, meta in resolve_meta(tickers, client).items():
        try:
            facts = client.companyfacts(meta["cik"])
        except SecError as e:
            print(f"warning: {t}: {e}", file=sys.stderr)
            continue
        rec = build_company(t, facts, meta, prices.get(t))
        if rec is None:
            print(f"warning: {t}: no annual 10-K facts found", file=sys.stderr)
            continue
        companies.append(rec)
    return {
        "schema_version": SCHEMA_VERSION,
        "generated_at": datetime.now(timezone.utc).replace(microsecond=0).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "source": "fixture" if client.offline else "sec-edgar-xbrl",
        "companies": companies,
    }


def write_dataset(doc: dict, out: str | Path = DEFAULT_OUT) -> Path:
    errs = validate_document(doc)
    if errs:
        raise ValueError("companies.json failed schema check:\n  " + "\n  ".join(errs))
    out = Path(out)
    out.parent.mkdir(parents=True, exist_ok=True)
    with open(out, "w", encoding="utf-8") as fh:
        json.dump(doc, fh, indent=2, allow_nan=False)
        fh.write("\n")
    return out

"""Build ``data/funds.json`` from N-PORT filings (live) or sample fixtures (offline)."""
from __future__ import annotations

import json
import math
import sys
from datetime import datetime, timezone
from pathlib import Path

from .lookthrough import look_through
from .mapping import Mapper
from .nport import NportFiling, allocation, bucket_for, parse_nport_file
from .reference import FUNDS, SECTOR_HINTS, FundSpec
from .rr import expense_ratio as rr_expense_ratio

SCHEMA_VERSION = 1
TENBAGGER_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = TENBAGGER_DIR / "data"
FIXTURE_DIR = DATA_DIR / "fixtures" / "nport"
DEFAULT_OUT = DATA_DIR / "funds.json"
DEFAULT_COMPANIES = DATA_DIR / "companies.json"
TOP_N = 25
UNCLASSIFIED = "Unclassified"


def _r(v: float | None, nd: int = 6) -> float | None:
    if v is None or not isinstance(v, (int, float)) or not math.isfinite(v):
        return None
    return round(float(v), nd)


def load_companies(path: Path = DEFAULT_COMPANIES) -> list[dict]:
    try:
        with open(path, encoding="utf-8") as fh:
            return list(json.load(fh).get("companies", []))
    except (OSError, ValueError):
        return []


def load_fixture_meta(fixture_dir: Path = FIXTURE_DIR) -> dict:
    try:
        return json.loads((fixture_dir / "meta.json").read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return {}


def fund_record(spec: FundSpec, filing: NportFiling, companies: list[dict], *,
                expense_ratio: float | None, is_sample: bool, sources: list[dict],
                holdings_count: int | None = None, aggregate_prefix: str | None = None) -> dict:
    """Pure: one funds.json entry from a parsed filing + companies.json rows."""
    mapper = Mapper.from_companies(companies)
    by_ticker = {str(c.get("ticker", "")).upper(): c for c in companies}

    def is_aggregate(name: str) -> bool:
        return bool(aggregate_prefix) and name.upper().startswith(aggregate_prefix.upper())

    positions = [h for h in filing.holdings if not is_aggregate(h.name)]
    # Merge rows for the same company (e.g. two share-class lines) by best ticker.
    merged: dict[str, dict] = {}
    for h in positions:
        if h.weight is None:
            continue
        bucket = bucket_for(h)
        if bucket == "cash":
            continue
        tk = mapper.ticker_for(h)
        comp_tk = mapper.company_ticker(h)
        key = comp_tk or tk or f"name:{h.name.upper()}"
        row = merged.setdefault(key, {"name": h.name, "ticker": comp_tk or tk, "weight": 0.0,
                                      "mapped": comp_tk is not None, "bucket": bucket})
        row["weight"] += h.weight

    top = sorted(merged.values(), key=lambda r: -r["weight"])[:TOP_N]
    top_holdings = [{"name": r["name"], "ticker": r["ticker"], "weight": _r(r["weight"]),
                     "mapped": r["mapped"]} for r in top]

    # Sector weights over stock positions (decimals of NAV); aggregate lines → Unclassified.
    sectors: dict[str, float] = {}
    for h in filing.holdings:
        if h.weight is None or bucket_for(h) != "stock":
            continue
        sector = spec.default_sector or UNCLASSIFIED
        if not is_aggregate(h.name):
            ct = mapper.company_ticker(h)
            tk = mapper.ticker_for(h)
            if ct and by_ticker.get(ct, {}).get("sector"):
                sector = by_ticker[ct]["sector"]
            elif tk and tk in SECTOR_HINTS:
                sector = SECTOR_HINTS[tk]
        sectors[sector] = sectors.get(sector, 0.0) + h.weight
    sector_weights = {k: _r(v) for k, v in sorted(sectors.items(), key=lambda kv: (kv[0] == UNCLASSIFIED, -kv[1]))}

    lt_rows = [(r["weight"], by_ticker[r["ticker"]].get("metrics") or {})
               for r in merged.values() if r["mapped"] and r["ticker"] in by_ticker]
    lt = look_through(lt_rows)

    alloc = allocation(filing) if filing.holdings else None
    return {
        "ticker": spec.ticker,
        "name": spec.name,
        "issuer": spec.issuer,
        "category": spec.category,
        "expense_ratio": _r(expense_ratio),
        "total_net_assets": _r(filing.net_assets, 2),
        "as_of": filing.period_end,
        "holdings_count": holdings_count if holdings_count is not None else len(positions),
        "top_holdings": top_holdings,
        "allocation": alloc,
        "sector_weights": sector_weights,
        "look_through": lt,
        "is_sample": is_sample,
        "note": spec.note,
        "sources": sources,
    }


def _offline_fund(spec: FundSpec, companies: list[dict], meta: dict, fixture_dir: Path) -> dict | None:
    path = fixture_dir / f"{spec.ticker}.xml"
    if not path.exists():
        return None
    filing = parse_nport_file(path)
    fmeta = meta.get("funds", {}).get(spec.ticker, {})
    rr_path = fixture_dir / f"{spec.ticker}.rr.htm"
    er, er_src = None, None
    if rr_path.exists():
        er = rr_expense_ratio(rr_path.read_text(encoding="utf-8"), fmeta.get("class_id"))
        if er is not None:
            er_src = {"type": "prospectus-ixbrl", "ref": f"data/fixtures/nport/{rr_path.name}", "sample": True}
    if er is None and spec.sample_expense_ratio is not None:
        er, er_src = spec.sample_expense_ratio, {"type": "sample-expense-ratio", "ref": "funds/reference.py", "sample": True}
    sources = [{"type": "nport-p-fixture", "ref": f"data/fixtures/nport/{path.name}", "sample": True}]
    if er_src:
        sources.append(er_src)
    sources.append({"type": "companies.json", "ref": "data/companies.json"})
    return fund_record(spec, filing, companies, expense_ratio=er, is_sample=True, sources=sources,
                       holdings_count=fmeta.get("holdings_count"),
                       aggregate_prefix=meta.get("aggregate_prefix"))


def _live_fund(spec: FundSpec, companies: list[dict], client) -> dict:
    lookup = spec.nport_proxy or spec.ticker
    if not spec.files_nport and not spec.nport_proxy:
        raise LookupError(f"{spec.ticker} does not file N-PORT")
    ids = client.fund_ids(lookup)
    if not ids:
        raise LookupError(f"{lookup} not in SEC company_tickers_mf.json")
    got = client.latest_nport(ids["cik"], ids["series_id"])
    if not got:
        raise LookupError(f"no NPORT-P found for {lookup} ({ids['series_id']})")
    filing, url = got
    sources = [{"type": "nport-p", "ref": url, "as_of": filing.period_end,
                **({"proxy_for": spec.ticker, "proxy": lookup} if spec.nport_proxy else {})}]
    er = None
    pro = client.latest_prospectus(ids["cik"])
    if pro:
        er = rr_expense_ratio(pro[0], ids.get("class_id"))
        if er is not None:
            sources.append({"type": "prospectus-ixbrl", "ref": pro[1]})
    sources.append({"type": "companies.json", "ref": "data/companies.json"})
    return fund_record(spec, filing, companies, expense_ratio=er, is_sample=False, sources=sources)


def build(offline: bool = True, tickers: list[str] | None = None, out: Path = DEFAULT_OUT,
          companies_path: Path = DEFAULT_COMPANIES, fixture_dir: Path = FIXTURE_DIR,
          client=None, log=print) -> dict:
    companies = load_companies(companies_path)
    meta = load_fixture_meta(fixture_dir)
    want = {t.upper() for t in tickers} if tickers else None
    funds = []
    for spec in FUNDS:
        if want and spec.ticker not in want:
            continue
        rec = None
        if not offline:
            try:
                if client is None:
                    from .sec import FundSecClient
                    client = FundSecClient()
                rec = _live_fund(spec, companies, client)
            except Exception as e:  # noqa: BLE001 - any live failure falls back to the fixture
                log(f"[funds] {spec.ticker}: live N-PORT unavailable ({e}); using sample fixture", file=sys.stderr)
        if rec is None:
            rec = _offline_fund(spec, companies, meta, fixture_dir)
        if rec is None:
            log(f"[funds] {spec.ticker}: no data, skipped", file=sys.stderr)
            continue
        funds.append(rec)
    kinds = {f["is_sample"] for f in funds}
    doc = {
        "schema_version": SCHEMA_VERSION,
        "generated_at": datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z"),
        "source": "fixture" if kinds == {True} else "sec-nport" if kinds == {False} else "mixed",
        "funds": funds,
    }
    if funds:
        out.parent.mkdir(parents=True, exist_ok=True)
        tmp = out.with_suffix(".tmp")
        tmp.write_text(json.dumps(doc, indent=2, ensure_ascii=False, allow_nan=False) + "\n", encoding="utf-8")
        tmp.replace(out)
    return doc

"""python -m datasources <command>   (run from tenbagger/)

  universe         print a bundled universe as comma-separated tickers
  prices           fetch prices -> pipeline-compatible CSV + provenance manifest
  edgar-bulk       SEC Financial Statement Data Sets zips -> companyfacts cache for the pipeline
  enrich           fill Unknown sector/industry from public SEC SIC codes
  validate         schema + sanity checks on companies.json (exit 1 on failure)
  gate             licence check: refuse to publish undisplayable prices (exit 3)
  supabase-upsert  push companies.json to Supabase (load_companies RPC)
"""
from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path

from . import universe as uni
from .base import LicenseError, SourceError, norm_tickers


def _tickers(a) -> list[str]:
    ts: list[str] = []
    if getattr(a, "universe", None):
        ts += list(uni.load(a.universe))
    if getattr(a, "tickers", None):
        ts += a.tickers.split(",")
    return norm_tickers(ts)


def cmd_universe(a) -> int:
    u = uni.load(a.name)
    ts = list(u)[: a.limit] if a.limit else list(u)
    print(",".join(ts) if a.format == "csv" else "\n".join(ts))
    return 0


def cmd_prices(a) -> int:
    from .csv_prices import CsvPriceSource, write_prices_csv
    from .manifest import build_manifest, write_manifest
    from .registry import price_source
    tickers = _tickers(a)
    if not tickers:
        print("give --tickers and/or --universe", file=sys.stderr)
        return 2
    if a.source == "csv":
        if not a.csv:
            print("--source csv needs --csv PATH", file=sys.stderr)
            return 2
        src = CsvPriceSource(a.csv, license_ref=a.csv_license_ref or "",
                             display_allowed=bool(a.csv_license_ref))
    else:
        src = price_source(a.source)
    try:
        quotes = src.latest_prices(tickers)
    except SourceError as e:
        print(f"error: {src.name}: {e}", file=sys.stderr)
        return 1
    cov = len(quotes) / len(tickers)
    lic = src.license
    comment = (f"prices from {lic.source}; display_allowed={lic.display_allowed}; "
               f"{len(quotes)}/{len(tickers)} tickers")
    out = write_prices_csv(quotes, a.out, comment=comment)
    man = write_manifest(build_manifest(quotes, [lic]), a.manifest or f"{a.out}.manifest.json")
    print(f"wrote {out} ({len(quotes)}/{len(tickers)} = {cov:.0%}) and {man}")
    if not lic.display_allowed:
        print(f"NOTE: {lic.source} is NOT licensed for display ({lic.notes}); "
              "`gate` will block publishing these prices.", file=sys.stderr)
    return 0 if cov >= a.min_coverage else 1


def cmd_edgar_bulk(a) -> int:
    from .edgar_bulk import (download_quarters, latest_published_quarter, quarter_ids,
                             write_companyfacts_cache)
    zips = [Path(z) for z in (a.zip or [])]
    if a.download:
        ua = a.user_agent or os.environ.get("TENBAGGER_SEC_UA") or os.environ.get("SEC_USER_AGENT") or ""
        periods = quarter_ids(a.last_quarter or latest_published_quarter(), a.download)
        try:
            zips += download_quarters(periods, a.dest, ua)
        except SourceError as e:
            print(f"error: {e}", file=sys.stderr)
            return 1
    if not zips:
        print("no FSDS zips (give --zip and/or --download N)", file=sys.stderr)
        return 2
    u = uni.load(a.universe) if a.universe else None
    res = write_companyfacts_cache(zips, a.cache_dir, u)
    print(f"companyfacts for {res['companies']} companies -> {res['dir']}"
          + (f"; {len(res['missing'])} universe tickers missing: {','.join(res['missing'][:20])}"
             if res["missing"] else ""))
    return 0 if res["companies"] else 1


def cmd_enrich(a) -> int:
    from .checks import load_strict
    from .enrich import enrich_sectors
    doc = load_strict(a.companies)
    sic = json.loads(Path(a.sic_json).read_text()) if a.sic_json and Path(a.sic_json).exists() else {}
    n = enrich_sectors(doc, sic)
    Path(a.companies).write_text(json.dumps(doc, indent=2, allow_nan=False) + "\n", encoding="utf-8")
    print(f"enriched sector for {n} companies")
    return 0


def cmd_validate(a) -> int:
    from .checks import validate_file
    errs = validate_file(a.companies, min_count=a.min_count, max_age_hours=a.max_age_hours,
                         min_price_coverage=a.min_price_coverage)
    for e in errs[:50]:
        print(f"FAIL {e}", file=sys.stderr)
    if len(errs) > 50:
        print(f"... {len(errs) - 50} more", file=sys.stderr)
    print("validate: " + ("OK" if not errs else f"{len(errs)} problem(s)"))
    return 1 if errs else 0


def cmd_gate(a) -> int:
    from .checks import load_strict
    from .manifest import assert_publishable
    doc = load_strict(a.companies)
    man = json.loads(Path(a.manifest).read_text()) if a.manifest and Path(a.manifest).exists() else None
    try:
        assert_publishable(doc, man)
    except LicenseError as e:
        print(str(e), file=sys.stderr)
        return 3
    real = sum(1 for c in doc["companies"] if c.get("price") is not None and not c.get("price_is_sample"))
    print(f"gate: OK ({len(doc['companies'])} companies, {real} licensed real prices, "
          f"{len(doc['companies']) - real} sample/missing prices)")
    return 0


def cmd_supabase(a) -> int:
    from .checks import load_strict
    from .supabase import upsert_companies
    try:
        res = upsert_companies(load_strict(a.companies))
    except SourceError as e:
        print(f"error: {e}", file=sys.stderr)
        return 1
    print(f"supabase load_companies -> {res}")
    return 0


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(prog="python -m datasources", description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = ap.add_subparsers(dest="cmd", required=True)

    u = sub.add_parser("universe")
    u.add_argument("--name", default="sp500")
    u.add_argument("--format", choices=["csv", "lines"], default="csv")
    u.add_argument("--limit", type=int, default=0)
    u.set_defaults(fn=cmd_universe)

    p = sub.add_parser("prices")
    p.add_argument("--source", required=True, choices=["csv", "alpaca", "eodhd", "intrinio", "fmp"])
    p.add_argument("--tickers")
    p.add_argument("--universe", help="bundled universe name or CSV path (ticker,cik,name)")
    p.add_argument("--csv", help="input CSV for --source csv")
    p.add_argument("--csv-license-ref", help="attest the CSV's display licence (recorded in manifest)")
    p.add_argument("--out", required=True)
    p.add_argument("--manifest")
    p.add_argument("--min-coverage", type=float, default=0.0)
    p.set_defaults(fn=cmd_prices)

    e = sub.add_parser("edgar-bulk")
    e.add_argument("--zip", action="append", help="local FSDS zip (repeatable)")
    e.add_argument("--download", type=int, default=0, help="download the last N quarters")
    e.add_argument("--last-quarter", help="e.g. 2026q2 (default: previous calendar quarter)")
    e.add_argument("--dest", default=".cache/fsds")
    e.add_argument("--user-agent")
    e.add_argument("--universe")
    e.add_argument("--cache-dir", required=True)
    e.set_defaults(fn=cmd_edgar_bulk)

    n = sub.add_parser("enrich")
    n.add_argument("--companies", required=True)
    n.add_argument("--sic-json")
    n.set_defaults(fn=cmd_enrich)

    v = sub.add_parser("validate")
    v.add_argument("--companies", required=True)
    v.add_argument("--min-count", type=int, default=1)
    v.add_argument("--min-price-coverage", type=float, default=0.0)
    v.add_argument("--max-age-hours", type=float)
    v.set_defaults(fn=cmd_validate)

    g = sub.add_parser("gate")
    g.add_argument("--companies", required=True)
    g.add_argument("--manifest")
    g.set_defaults(fn=cmd_gate)

    s = sub.add_parser("supabase-upsert")
    s.add_argument("--companies", required=True)
    s.set_defaults(fn=cmd_supabase)

    a = ap.parse_args(argv)
    return a.fn(a)

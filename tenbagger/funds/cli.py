from __future__ import annotations

import argparse
from pathlib import Path

from .build import DEFAULT_COMPANIES, DEFAULT_OUT, build
from .fixturegen import write_fixtures


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(prog="python -m funds", description="Tenbagger fund/ETF data builder")
    sub = ap.add_subparsers(dest="cmd", required=True)
    b = sub.add_parser("build", help="write data/funds.json")
    b.add_argument("--offline", action="store_true", help="use sample fixtures in data/fixtures/nport")
    b.add_argument("--tickers", help="comma-separated subset, e.g. VOO,QQQ")
    b.add_argument("--out", type=Path, default=DEFAULT_OUT)
    b.add_argument("--companies", type=Path, default=DEFAULT_COMPANIES)
    sub.add_parser("make-fixtures", help="regenerate SAMPLE N-PORT fixtures")
    args = ap.parse_args(argv)

    if args.cmd == "make-fixtures":
        for p in write_fixtures():
            print(f"wrote {p}")
        return 0
    tickers = [t.strip() for t in args.tickers.split(",")] if args.tickers else None
    doc = build(offline=args.offline, tickers=tickers, out=args.out, companies_path=args.companies)
    for f in doc["funds"]:
        lt = f["look_through"]
        print(f"{f['ticker']:5} {f['category']:22} holdings={f['holdings_count']:>5} "
              f"ER={f['expense_ratio']} P/E={lt['weighted_pe']} coverage={lt['coverage_pct']:.1%} "
              f"{'SAMPLE' if f['is_sample'] else 'live'}")
    print(f"wrote {args.out} ({len(doc['funds'])} funds, source={doc['source']})")
    return 0 if doc["funds"] else 1

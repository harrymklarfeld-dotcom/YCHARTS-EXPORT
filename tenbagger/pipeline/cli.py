"""Command line: python -m pipeline {build,validate,make-fixtures}  (run from tenbagger/)."""
from __future__ import annotations

import argparse
import sys

from . import universe


def cmd_build(a) -> int:
    from .build import DEFAULT_OUT, build_dataset, write_dataset
    tickers: list[str] = []
    if a.universe:
        if a.universe not in universe.UNIVERSES:
            print(f"unknown universe {a.universe}; choose from {sorted(universe.UNIVERSES)}", file=sys.stderr)
            return 2
        tickers += list(universe.UNIVERSES[a.universe])
    if a.tickers:
        tickers += [t for t in a.tickers.split(",") if t.strip()]
    if not tickers:
        print("give --tickers and/or --universe", file=sys.stderr)
        return 2
    tickers = list(dict.fromkeys(t.strip().upper() for t in tickers))
    doc = build_dataset(tickers, offline=a.offline, prices_path=a.prices)
    n = len(doc["companies"])
    if n == 0:
        print("no companies built; output not written (offline? try --offline)", file=sys.stderr)
        return 1
    out = write_dataset(doc, a.out or DEFAULT_OUT)
    print(f"wrote {n}/{len(tickers)} companies ({doc['source']}) -> {out}")
    for c in doc["companies"]:
        m = c["metrics"]
        pe = "-" if m["pe"] is None else f"{m['pe']:.1f}"
        gm = "-" if m["gross_margin"] is None else f"{100 * m['gross_margin']:.1f}%"
        rev = c["fundamentals"]["revenue"]
        rev = "-" if rev is None else f"${rev / 1e9:,.1f}B"
        print(f"  {c['ticker']:<5} FY{c['latest_fy']}  rev {rev:>8}"
              f"  GM {gm:>6}  P/E {pe:>6}{'  (sample price)' if c['price_is_sample'] else ''}")
    return 0


def cmd_validate(a) -> int:
    from .validate import run
    return run(a.ticker.upper(), offline=a.offline, ycharts_dir=a.ycharts) if a.ycharts else \
        run(a.ticker.upper(), offline=a.offline)


def cmd_fixtures(a) -> int:
    from .fixturegen import write_fixtures
    for p in write_fixtures(include_mu=not a.skip_mu):
        print(f"wrote {p}")
    return 0


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(prog="python -m pipeline", description="Tenbagger SEC EDGAR data pipeline")
    sub = ap.add_subparsers(dest="cmd", required=True)

    b = sub.add_parser("build", help="build data/companies.json")
    b.add_argument("--tickers", help="comma-separated, e.g. MU,AAPL,COST")
    b.add_argument("--universe", help="bundled list: " + ", ".join(universe.UNIVERSES))
    b.add_argument("--offline", action="store_true", help="read data/fixtures/edgar instead of data.sec.gov")
    b.add_argument("--prices", help="CSV ticker,price,price_date[,is_sample] (default: sample fixture)")
    b.add_argument("--out", help="output path (default tenbagger/data/companies.json)")
    b.set_defaults(fn=cmd_build)

    v = sub.add_parser("validate", help="compare pipeline output vs YCharts exports")
    v.add_argument("--ticker", default="MU")
    v.add_argument("--offline", action="store_true")
    v.add_argument("--ycharts", help="folder with <TICKER>_*.xlsx exports (default <repo>/data/ycharts)")
    v.set_defaults(fn=cmd_validate)

    f = sub.add_parser("make-fixtures", help="regenerate data/fixtures/edgar/*.json")
    f.add_argument("--skip-mu", action="store_true", help="don't rebuild MU from YCharts (needs openpyxl)")
    f.set_defaults(fn=cmd_fixtures)

    a = ap.parse_args(argv)
    return a.fn(a)

"""CLI: python -m lessons build --companies ../data/companies.json --out ../data/lessons.json --seed 42"""
from __future__ import annotations

import argparse
import json
import sys
from collections import Counter
from pathlib import Path

from .generator import BuildError, build


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(prog="python -m lessons")
    sub = ap.add_subparsers(dest="cmd", required=True)
    b = sub.add_parser("build", help="generate lessons.json from companies.json")
    b.add_argument("--companies", required=True, type=Path)
    b.add_argument("--out", required=True, type=Path)
    b.add_argument("--seed", type=int, default=42)
    b.add_argument("--no-portfolio", action="store_true", help="omit the personalizable 'Your portfolio' unit")
    b.add_argument("-v", "--verbose", action="store_true", help="list skipped template slots")
    args = ap.parse_args(argv)

    try:
        companies = json.loads(args.companies.read_text())
        doc, report = build(companies, seed=args.seed, include_portfolio=not args.no_portfolio)
    except (OSError, json.JSONDecodeError, BuildError) as e:
        print(f"error: {e}", file=sys.stderr)
        return 1
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(json.dumps(doc, indent=1, ensure_ascii=False, allow_nan=False) + "\n")
    c = report["counts"]
    types = Counter(q["type"] for u in doc["units"] for l in u["lessons"] for q in l["questions"])
    print(f"wrote {args.out}: {c['units']} units, {c['lessons']} lessons, {c['questions']} questions "
          f"({', '.join(f'{k} {v}' for k, v in sorted(types.items()))}) from "
          f"{len(doc['generated_from']['tickers'])} companies [{companies.get('source')}], seed {args.seed}")
    if report["short_lessons"]:
        print("short lessons:", ", ".join(report["short_lessons"]))
    if report["dropped_lessons"]:
        print("dropped lessons:", ", ".join(report["dropped_lessons"]))
    if args.verbose and report["skipped_slots"]:
        print("skipped slots:", ", ".join(report["skipped_slots"]))
    return 0

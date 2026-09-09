#!/usr/bin/env python3
"""Flatten a fundamentals JSON into a long-format CSV (section,key,period,value)."""
import csv
import json
import sys


def rows(data):
    for x in data.get("quarters", []):
        for k, v in x.items():
            if k not in ("fq", "end"):
                yield ("quarter", k, x["fq"], v)
    for x in data.get("annual_history", []):
        for k, v in x.items():
            if k != "fy":
                yield ("annual", k, f"FY{x['fy']}", v)
    for sec in ("market", "balance_sheet_2026-05-28", "guidance_Q4FY26", "consensus", "industry"):
        for k, v in data.get(sec, {}).items():
            if isinstance(v, (int, float, str)):
                yield (sec, k, data.get("as_of", ""), v)


def main(argv):
    src, dst = (argv + ["data/mu_fundamentals.json", "data/mu_fundamentals.csv"])[:2]
    with open(src, encoding="utf-8") as fh:
        data = json.load(fh)
    with open(dst, "w", newline="", encoding="utf-8") as fh:
        w = csv.writer(fh)
        w.writerow(["section", "metric", "period", "value"])
        n = 0
        for r in rows(data):
            w.writerow(r); n += 1
    print(f"wrote {n} rows to {dst}")


if __name__ == "__main__":
    main(sys.argv[1:])

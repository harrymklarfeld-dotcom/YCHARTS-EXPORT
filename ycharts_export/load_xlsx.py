#!/usr/bin/env python3
"""
Parse YCharts "Financial Statement" Excel exports (Income Statement, Balance
Sheet, Cash Flow; quarterly, newest column first, $ millions) into the
fundamentals JSON consumed by valuation.py.

Usage:
    python -m ycharts_export.load_xlsx data/ycharts MU --merge data/mu_fundamentals.json

Writes/updates the "ycharts" block:
    ycharts.quarters  - last N quarters, all key line items ($B)
    ycharts.annual    - fiscal-year aggregates back to FY2005 ($B)
Requires openpyxl (pip install openpyxl).
"""
from __future__ import annotations

import argparse
import glob
import json
import os
import sys

try:
    import openpyxl
except ImportError:  # pragma: no cover
    sys.exit("openpyxl is required: pip install openpyxl")

INC = {"revenue": "Revenue", "cogs": "Cost of Goods Sold", "gross_profit": "Gross Profit",
       "rd": "Research and Development Expense", "sga": "SG&A", "op_income": "Operating Income",
       "da": "Depreciation, Depletion And Amortization", "pretax": "Pre-Tax Income",
       "tax": "Provision for Income Taxes", "net_income": "Net Income", "ebitda": "EBITDA Q",
       "eps_diluted": "EPS Diluted", "dil_shares": "Average Diluted Shares Outstanding",
       "shares_out": "Shares Outstanding", "dps": "Dividend Per Share"}
BS = {"cash_st": "Cash and Short Term Investments", "lt_inv": "Long Term Investments",
      "receivables": "Accounts Receivable", "inventory": "Inventories",
      "current_assets": "Total Current Assets", "net_ppe": "Net PP&E", "total_assets": "Total Assets",
      "current_liab": "Total Current Liabilities", "total_liab": "Total Liabilities",
      "equity": "Shareholders Equity", "bvps": "Book Value Per Share", "total_debt": "Total Debt",
      "net_debt": "Net Debt", "inv_days": "Inventories - Days Held", "dso": "Receivables Days",
      "sbc": "Stock-Based Compensation Expense"}
CF = {"ocf": "Cash from Operations", "capex": "Capital Expenditures - Total",
      "wc_change": "Changes in Working Capital", "dividends": "Total Dividends Paid",
      "buyback": "Repurchase of Capital Stock", "net_debt_issuance": "Net Debt Issuance",
      "ending_cash": "Ending Cash", "fcf_per_share": "Cash Flow Per Share (Diluted) - Free"}
PER_SHARE = {"eps_diluted", "bvps", "dps", "fcf_per_share", "inv_days", "dso", "dil_shares", "shares_out"}


def load_statement(path: str):
    ws = openpyxl.load_workbook(path, data_only=True).worksheets[0]
    rows = [list(r) for r in ws.iter_rows(values_only=True)]
    hdr_i = next(i for i, r in enumerate(rows[:10])
                 if sum(1 for c in r[1:] if c is not None) > 5)
    dates = [d for d in rows[hdr_i][1:] if d is not None]
    table = {}
    for r in rows[hdr_i + 1:]:
        if r[0] and r[0] not in table:
            table[r[0]] = dict(zip(dates, r[1:]))
    return dates, table


def find(folder: str, ticker: str, kind: str) -> str:
    pats = [f"*{ticker}*{kind}*.xlsx", f"*{kind}*.xlsx"]
    for p in pats:
        hits = glob.glob(os.path.join(folder, p))
        if hits:
            return hits[0]
    raise FileNotFoundError(f"no {kind} export for {ticker} in {folder}")


def fiscal_year(d) -> int:
    """Micron's FY ends late Aug/early Sep; YCharts labels quarters by month-end."""
    return d.year if d.month <= 8 else d.year + 1


def build(folder: str, ticker: str, n_quarters: int = 16, first_fy: int = 2005) -> dict:
    d_inc, inc = load_statement(find(folder, ticker, "Income"))
    _, bs = load_statement(find(folder, ticker, "Balance"))
    _, cf = load_statement(find(folder, ticker, "Cash"))

    def val(tbl, key, d):
        v = tbl.get(key, {}).get(d)
        return None if v is None else (float(v) if key in () else float(v))

    def scaled(k, v):
        return v if (v is None or k in PER_SHARE) else v / 1000.0  # $M -> $B

    quarters = []
    for d in d_inc[:n_quarters]:
        q = {"end": d.strftime("%Y-%m-%d"), "fy": fiscal_year(d)}
        for k, lab in INC.items():
            q[k] = scaled(k, val(inc, lab, d))
        for k, lab in BS.items():
            q[k] = scaled(k, val(bs, lab, d))
        for k, lab in CF.items():
            q[k] = scaled(k, val(cf, lab, d))
        if q.get("ocf") is not None and q.get("capex") is not None:
            q["fcf"] = q["ocf"] - q["capex"]
        if q.get("revenue"):
            q["gross_margin_pct"] = 100 * q["gross_profit"] / q["revenue"]
        quarters.append(q)

    annual: dict[int, dict] = {}
    for d in d_inc:
        fy = fiscal_year(d)
        if fy < first_fy or inc["Revenue"].get(d) is None:
            continue
        a = annual.setdefault(fy, {"fy": fy, "quarters": 0, "revenue": 0.0, "net_income": 0.0,
                                   "ocf": 0.0, "capex": 0.0, "eps_diluted": 0.0})
        a["quarters"] += 1
        a["revenue"] += inc["Revenue"][d] / 1000
        a["net_income"] += (inc["Net Income"].get(d) or 0) / 1000
        a["ocf"] += (cf["Cash from Operations"].get(d) or 0) / 1000
        a["capex"] += (cf["Capital Expenditures - Total"].get(d) or 0) / 1000
        a["eps_diluted"] += inc["EPS Diluted"].get(d) or 0
        if d.month == 8:  # fiscal year-end balance sheet
            a["equity"] = (bs["Shareholders Equity"].get(d) or 0) / 1000
            a["bvps"] = bs["Book Value Per Share"].get(d)
            a["net_debt"] = (bs["Net Debt"].get(d) or 0) / 1000
    for a in annual.values():
        a["fcf"] = a["ocf"] - a["capex"]
        a["net_margin_pct"] = 100 * a["net_income"] / a["revenue"] if a["revenue"] else None
    return {"source": "YCharts Financial Statement exports (quarterly, $M -> $B)",
            "files": sorted(os.path.basename(p) for p in glob.glob(os.path.join(folder, "*.xlsx"))),
            "latest_quarter": quarters[0]["end"],
            "quarters": quarters,
            "annual": [annual[k] for k in sorted(annual)]}


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("folder")
    ap.add_argument("ticker")
    ap.add_argument("--merge", help="fundamentals JSON to update in place (adds/replaces 'ycharts' block)")
    ap.add_argument("-n", "--quarters", type=int, default=16)
    args = ap.parse_args(argv)
    block = build(args.folder, args.ticker, args.quarters)
    if args.merge:
        with open(args.merge, encoding="utf-8") as fh:
            data = json.load(fh)
        data["ycharts"] = block
        with open(args.merge, "w", encoding="utf-8") as fh:
            json.dump(data, fh, indent=2)
        print(f"merged {len(block['quarters'])} quarters / {len(block['annual'])} fiscal years into {args.merge}")
    else:
        print(json.dumps(block, indent=2))


if __name__ == "__main__":
    main()

#!/usr/bin/env python3
"""
Fundamentals from SEC EDGAR — free, official, no key. This is the same source data YCharts
repackages: real revenue, margins, net income, cash flow, EPS and book value from company filings.

    python -m portfolio.edgar AAPL MU NVDA
    python -m portfolio.edgar --watchlist sl_model --portfolio

Writes data/fundamentals/<TICKER>.json:
    { annual: [{fy, revenue, net_income, gross_margin, op_margin, fcf, eps, equity, shares, ...}],
      ttm: {revenue, net_income, fcf, eps, ...}, latest_quarter: ... }
SEC asks for a descriptive User-Agent with contact info; set SEC_UA or it defaults to your email.
"""
from __future__ import annotations

import argparse
import json
import os
import sys
import time
import urllib.request

CACHE = os.path.join("data", "fundamentals")
UA = os.environ.get("SEC_UA", "portfolio-research harrymklarfeld@gmail.com")
TICKERS_URL = "https://www.sec.gov/files/company_tickers.json"
FACTS_URL = "https://data.sec.gov/api/xbrl/companyfacts/CIK{cik:010d}.json"

# XBRL concept -> our field. First concept that exists wins (companies tag differently).
CONCEPTS = {
    "revenue": ["RevenueFromContractWithCustomerExcludingAssessedTax", "Revenues", "SalesRevenueNet"],
    "net_income": ["NetIncomeLoss"],
    "gross_profit": ["GrossProfit"],
    "op_income": ["OperatingIncomeLoss"],
    "equity": ["StockholdersEquity", "StockholdersEquityIncludingPortionAttributableToNoncontrollingInterest"],
    "eps": ["EarningsPerShareDiluted", "EarningsPerShareBasic"],
    "shares": ["WeightedAverageNumberOfDilutedSharesOutstanding", "CommonStockSharesOutstanding"],
    "ocf": ["NetCashProvidedByUsedInOperatingActivities",
            "NetCashProvidedByUsedInOperatingActivitiesContinuingOperations"],
    "capex": ["PaymentsToAcquirePropertyPlantAndEquipment", "PaymentsToAcquireProductiveAssets"],
    "cash": ["CashAndCashEquivalentsAtCarryingValue"],
    "debt": ["LongTermDebtNoncurrent", "LongTermDebt"],
}


def _get(url):
    req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": "application/json"})
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.loads(r.read().decode("utf-8", "replace"))


_TMAP = None
def ticker_to_cik(ticker: str):
    global _TMAP
    if _TMAP is None:
        cache = os.path.join(CACHE, "_tickers.json")
        if os.path.exists(cache) and time.time() - os.path.getmtime(cache) < 7 * 86400:
            data = json.load(open(cache, encoding="utf-8"))
        else:
            data = _get(TICKERS_URL)
            os.makedirs(CACHE, exist_ok=True)
            json.dump(data, open(cache, "w", encoding="utf-8"))
        _TMAP = {row["ticker"].upper(): int(row["cik_str"]) for row in data.values()}
    return _TMAP.get(ticker.upper())


def _annual(facts, concepts):
    """Latest annual (FY) value per fiscal year for the first matching concept."""
    gaap = facts.get("facts", {}).get("us-gaap", {})
    for c in concepts:
        node = gaap.get(c)
        if not node:
            continue
        rows = {}
        for unit, arr in node.get("units", {}).items():
            for it in arr:
                if it.get("form") in ("10-K", "20-F") and it.get("fp") == "FY" and it.get("fy"):
                    rows[int(it["fy"])] = it["val"]
        if rows:
            return rows
    return {}


def _latest(facts, concepts):
    gaap = facts.get("facts", {}).get("us-gaap", {})
    for c in concepts:
        node = gaap.get(c)
        if not node:
            continue
        best = None
        for unit, arr in node.get("units", {}).items():
            for it in arr:
                if it.get("end") and it.get("val") is not None:
                    if best is None or it["end"] > best[0]:
                        best = (it["end"], it["val"])
        if best:
            return best[1]
    return None


def build(ticker: str) -> dict:
    cik = ticker_to_cik(ticker)
    if not cik:
        raise ValueError(f"{ticker}: not found in SEC ticker list (foreign/ETF tickers often aren't in EDGAR)")
    facts = _get(FACTS_URL.format(cik=cik))
    cols = {k: _annual(facts, v) for k, v in CONCEPTS.items()}
    years = sorted(set().union(*[set(d) for d in cols.values() if d]))
    annual = []
    for fy in years:
        g = lambda k: cols[k].get(fy)
        rev, ni, gp, oi, ocf, capex = g("revenue"), g("net_income"), g("gross_profit"), g("op_income"), g("ocf"), g("capex")
        annual.append({"fy": fy, "revenue": rev, "net_income": ni,
                       "gross_margin": (100 * gp / rev) if gp and rev else None,
                       "op_margin": (100 * oi / rev) if oi and rev else None,
                       "net_margin": (100 * ni / rev) if ni and rev else None,
                       "fcf": (ocf - capex) if (ocf is not None and capex is not None) else None,
                       "eps": g("eps"), "equity": g("equity"), "shares": g("shares"),
                       "cash": g("cash"), "debt": g("debt")})
    return {"ticker": ticker.upper(), "cik": cik, "source": "SEC EDGAR (company filings)",
            "as_of": time.strftime("%Y-%m-%d"), "annual": annual,
            "latest": {k: _latest(facts, v) for k, v in CONCEPTS.items()}}


def write(rec: dict):
    os.makedirs(CACHE, exist_ok=True)
    with open(os.path.join(CACHE, f"{rec['ticker']}.json"), "w", encoding="utf-8") as fh:
        json.dump(rec, fh, indent=1)


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("tickers", nargs="*")
    ap.add_argument("--watchlist")
    ap.add_argument("--portfolio", action="store_true")
    args = ap.parse_args(argv)
    tickers = list(args.tickers)
    if args.watchlist:
        from .watchlists import load_user
        tickers += load_user(args.watchlist)
    if args.portfolio:
        from ycharts_export.api import portfolio_tickers
        tickers += portfolio_tickers()
    tickers = sorted(set(t.upper() for t in tickers))
    ok = 0
    for t in tickers:
        try:
            rec = build(t); write(rec)
            n = len([a for a in rec["annual"] if a["revenue"]])
            print(f"  {t:6} {n} fiscal years of filings", file=sys.stderr); ok += 1
        except Exception as e:  # noqa: BLE001
            print(f"  {t:6} {type(e).__name__}: {e}", file=sys.stderr)
        time.sleep(0.2)   # SEC fair-use
    print(f"wrote {ok}/{len(tickers)} to {CACHE}/", file=sys.stderr)


if __name__ == "__main__":
    main()

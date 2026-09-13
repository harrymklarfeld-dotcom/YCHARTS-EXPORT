#!/usr/bin/env python3
"""
YCharts API ingestion — the data layer for the research engine.

Uses YCharts' official Python client (pycharts). It needs an **API key**, which is
a YCharts API/Enterprise entitlement (a normal login / Professional seat gives the
Excel Add-in, not necessarily the REST API — check Account > API or ask your YCharts
rep for a key). The key stays on your machine; never paste it into a chat.

    pip install git+https://github.com/ycharts/pycharts.git
    export YCHARTS_API_KEY=xxxxxxxxxxxxxxxxxxxx        # your key, on your machine
    python -m ycharts_export.api MU NVDA AAPL AVGO META --years 15
    python -m ycharts_export.api --portfolio            # every ticker in data/portfolio/snapshot.json
    python -m ycharts_export.api VOO XLV XLE HACK --metrics price,pe_ratio,dividend_yield

Writes one JSON per ticker to data/ycharts_cache/<TICKER>.json:
    { "as_of":..., "points": {metric: {value, date}}, "series": {metric: [[date,value],...]} }
plus a flat prices CSV to data/prices/<TICKER>.csv so the dashboard/backtester use it
with zero changes. Read from the cache in the research agents; this is the only place
that talks to YCharts, so credentials and rate limits live in one spot.
"""
from __future__ import annotations

import argparse
import csv
import json
import os
import sys
import time
from datetime import date, datetime, timedelta

CACHE = os.path.join("data", "ycharts_cache")
PRICES = os.path.join("data", "prices")

# The metric slugs an equity research agent needs. YCharts exposes 4,000+; this is the
# working set for valuation + trend + quality. Extend freely — the client passes them through.
SERIES_METRICS = [
    "price", "pe_ratio", "forward_pe_ratio", "ev_to_ebitda", "price_to_book_value",
    "price_to_sales_ratio", "peg_ratio", "dividend_yield", "revenues", "net_income",
    "eps_diluted", "free_cash_flow", "gross_profit_margin", "operating_margin",
    "profit_margin", "return_on_equity", "return_on_invested_capital", "total_debt",
    "cash_and_st_investments", "shares_outstanding",
]
POINT_METRICS = [
    "price", "market_cap", "pe_ratio", "forward_pe_ratio", "price_to_book_value",
    "dividend_yield", "ev_to_ebitda", "beta_5y", "short_interest_percent_of_float",
    "analyst_target_price_mean", "analyst_recommendation",
]


def _client(api_key: str):
    try:
        from pycharts import CompanyClient
    except ImportError:
        sys.exit("pycharts is not installed. Run:\n"
                 "  pip install git+https://github.com/ycharts/pycharts.git")
    return CompanyClient(api_key)


def _unwrap(rsp: dict) -> dict:
    """YCharts v2 nests: {'meta':.., 'response': {SYM: {'results': {calc: {'meta':.., 'data': [[date,val],..]}}}}}.
    Some shapes drop the 'results' layer. Return {SYM: {calc: <blob>}} either way."""
    resp = (rsp or {}).get("response", rsp) or {}
    out = {}
    for sym, sec in resp.items():
        if isinstance(sec, dict) and "results" in sec and isinstance(sec["results"], dict):
            out[sym] = sec["results"]
        else:
            out[sym] = sec if isinstance(sec, dict) else {}
    return out


def _blob_data(blob):
    """A metric blob is {'data': [[date,val],...]} or the data list/pair itself."""
    if isinstance(blob, dict):
        return blob.get("data")
    return blob


def pull(tickers: list[str], api_key: str, years: int = 15,
         series_metrics=None, point_metrics=None, sleep: float = 0.4) -> dict:
    client = _client(api_key)
    series_metrics = series_metrics or SERIES_METRICS
    point_metrics = point_metrics or POINT_METRICS
    end_dt = datetime.now()
    start_dt = end_dt - timedelta(days=int(years * 365.25))
    out = {}
    for i in range(0, len(tickers), 10):          # batch to be polite to the API
        batch = tickers[i:i + 10]
        try:
            s_rsp = _unwrap(client.get_series(batch, series_metrics,
                                              query_start_date=start_dt, query_end_date=end_dt))
        except Exception as e:  # noqa: BLE001
            print(f"series pull failed for {batch}: {e}", file=sys.stderr); s_rsp = {}
        try:
            p_rsp = _unwrap(client.get_points(batch, point_metrics))
        except Exception as e:  # noqa: BLE001
            print(f"points pull failed for {batch}: {e}", file=sys.stderr); p_rsp = {}
        for sym in batch:
            rec = {"symbol": sym, "as_of": datetime.now().isoformat(timespec="seconds"),
                   "series": {}, "points": {}}
            for m, blob in (s_rsp.get(sym, {}) or {}).items():
                data = _blob_data(blob)
                if data and isinstance(data, (list, tuple)):
                    pts = []
                    for row in data:
                        if isinstance(row, (list, tuple)) and len(row) == 2 and row[1] is not None:
                            pts.append([str(row[0])[:10], row[1]])
                    if pts:
                        rec["series"][m] = pts
            for m, blob in (p_rsp.get(sym, {}) or {}).items():
                data = _blob_data(blob)
                if isinstance(data, (list, tuple)) and len(data) == 2:
                    rec["points"][m] = {"date": str(data[0])[:10], "value": data[1]}
                elif isinstance(data, (int, float)):
                    rec["points"][m] = {"value": data}
            out[sym] = rec
        time.sleep(sleep)
    return out


def write(records: dict) -> None:
    os.makedirs(CACHE, exist_ok=True)
    os.makedirs(PRICES, exist_ok=True)
    for sym, rec in records.items():
        with open(os.path.join(CACHE, f"{sym}.json"), "w", encoding="utf-8") as fh:
            json.dump(rec, fh, indent=1)
        px = rec.get("series", {}).get("price")
        if px:
            with open(os.path.join(PRICES, f"{sym}.csv"), "w", newline="", encoding="utf-8") as fh:
                w = csv.writer(fh); w.writerow(["date", "adj_close"]); w.writerows(px)
        n_s = len(rec.get("series", {})); n_p = len(rec.get("points", {}))
        print(f"  {sym:6} {n_s} series, {n_p} points"
              f"{', ' + str(len(px)) + ' price rows' if px else ''}", file=sys.stderr)


def portfolio_tickers(snapshot="data/portfolio/snapshot.json") -> list[str]:
    if not os.path.exists(snapshot):
        return []
    with open(snapshot, encoding="utf-8") as fh:
        snap = json.load(fh)
    return sorted({h["symbol"] for h in snap.get("holdings", [])})


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("tickers", nargs="*")
    ap.add_argument("--portfolio", action="store_true", help="pull every ticker in your snapshot")
    ap.add_argument("--watchlist", help="pull a named watchlist (e.g. sl_model) from portfolio.watchlists / config/watchlists.json")
    ap.add_argument("--probe", action="store_true", help="quick key test: pull price+P/E for AAPL only, print result")
    ap.add_argument("--years", type=int, default=15)
    ap.add_argument("--metrics", help="comma-separated series metrics (default: the research set)")
    ap.add_argument("--key", default=None, help="API key (else $YCHARTS_API_KEY)")
    args = ap.parse_args(argv)
    key = args.key or os.environ.get("YCHARTS_API_KEY")
    if not key:
        sys.exit("No API key. Set it on your machine:  export YCHARTS_API_KEY=...\n"
                 "If your YCharts plan has no API key, use the Excel Add-in export route instead "
                 "(see research/ycharts_formatting.md).")
    if args.probe:
        recs = pull(["AAPL"], key, years=1, series_metrics=["price"], point_metrics=["price", "pe_ratio"], sleep=0)
        r = recs.get("AAPL", {})
        n = len(r.get("series", {}).get("price", []))
        print(f"Key works. AAPL: {n} price rows, points {r.get('points')}" if n or r.get("points")
              else "Connected, but no data returned — check the metric IDs or your API entitlement.", file=sys.stderr)
        return 0
    tickers = list(args.tickers) + (portfolio_tickers() if args.portfolio else [])
    if args.watchlist:
        from portfolio.watchlists import load_user
        tickers += load_user(args.watchlist)
    tickers = sorted(set(t.upper() for t in tickers))
    if not tickers:
        sys.exit("Give tickers, or --portfolio.")
    metrics = args.metrics.split(",") if args.metrics else None
    print(f"Pulling {len(tickers)} tickers from YCharts: {', '.join(tickers)}", file=sys.stderr)
    records = pull(tickers, key, years=args.years, series_metrics=metrics)
    write(records)
    print(f"wrote {len(records)} files to {CACHE}/ and prices to {PRICES}/", file=sys.stderr)


if __name__ == "__main__":
    main()

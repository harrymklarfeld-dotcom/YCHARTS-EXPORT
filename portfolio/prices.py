#!/usr/bin/env python3
"""
Daily price history for the backtester, with a local CSV cache in data/prices/.

Sources, tried in order:
  1. data/prices/<SYM>.csv               (cache, or a YCharts Timeseries export you dropped in)
  2. yfinance                             (pip install yfinance; free, adjusted closes)
  3. Robinhood historicals via robin_stocks if you are logged in (5y daily max)
  4. ycharts.com/companies/<SYM>/price    (public page; ~last 10 rows only, via ycharts_export.scrape)

YCharts exports: in YCharts, Timeseries Analysis -> Export -> CSV/XLSX, save as
data/prices/<SYM>.csv or .xlsx. Any file with a date column and a price/close column works.

    python -m portfolio.prices MU NVDA --start 2015-01-01     # fetch + cache, print summary
"""
from __future__ import annotations

import argparse
import csv
import os
import sys
from datetime import date

CACHE = os.path.join("data", "prices")


def _read_csv(path: str) -> list[tuple[str, float]]:
    rows = []
    with open(path, newline="", encoding="utf-8-sig") as fh:
        rdr = csv.reader(fh)
        header = next(rdr, None)
        if not header:
            return rows
        hl = [h.strip().lower() for h in header]
        di = next((i for i, h in enumerate(hl) if h in ("date", "period", "as of")), 0)
        ci = next((i for i, h in enumerate(hl) if h in ("adj close", "adj_close", "close", "price", "value")), None)
        if ci is None:
            ci = next((i for i, h in enumerate(hl) if "price" in h or "close" in h or "value" in h), 1)
        for r in rdr:
            if len(r) <= max(di, ci):
                continue
            d, v = r[di].strip(), r[ci].strip().replace(",", "").replace("$", "")
            try:
                rows.append((_norm_date(d), float(v)))
            except ValueError:
                continue
    rows.sort()
    return rows


def _norm_date(s: str) -> str:
    from datetime import datetime
    for fmt in ("%Y-%m-%d", "%m/%d/%Y", "%b %d, %Y", "%B %d, %Y", "%Y-%m-%d %H:%M:%S", "%m/%d/%y"):
        try:
            return datetime.strptime(s[:len(datetime.now().strftime(fmt))] if False else s, fmt).date().isoformat()
        except ValueError:
            continue
    return s[:10]


def _read_xlsx(path: str) -> list[tuple[str, float]]:
    import openpyxl
    ws = openpyxl.load_workbook(path, data_only=True).worksheets[0]
    rows = []
    for r in ws.iter_rows(values_only=True):
        if not r or r[0] is None:
            continue
        d, v = r[0], next((c for c in r[1:] if isinstance(c, (int, float))), None)
        if v is None:
            continue
        d = d.date().isoformat() if hasattr(d, "date") else _norm_date(str(d))
        if d[:4].isdigit():
            rows.append((d, float(v)))
    rows.sort()
    return rows


def _write_cache(sym: str, rows: list[tuple[str, float]]) -> None:
    os.makedirs(CACHE, exist_ok=True)
    with open(os.path.join(CACHE, f"{sym}.csv"), "w", newline="", encoding="utf-8") as fh:
        w = csv.writer(fh)
        w.writerow(["date", "adj_close"])
        w.writerows(rows)


def from_yfinance(sym: str, start: str) -> list[tuple[str, float]]:
    import yfinance as yf
    df = yf.download(sym, start=start, auto_adjust=True, progress=False)
    if df is None or df.empty:
        return []
    col = df["Close"]
    if hasattr(col, "columns"):  # MultiIndex when a single ticker is passed as list
        col = col.iloc[:, 0]
    return [(d.date().isoformat(), float(v)) for d, v in col.dropna().items()]


def from_robinhood(sym: str) -> list[tuple[str, float]]:
    import robin_stocks.robinhood as rh
    data = rh.get_stock_historicals(sym, interval="day", span="5year") or []
    return [(d["begins_at"][:10], float(d["close_price"])) for d in data if d]


def from_ycharts_page(sym: str) -> list[tuple[str, float]]:
    from ycharts_export.scrape import fetch, parse_metric_page, BASE
    from datetime import datetime
    body = fetch(BASE.format(ticker=sym, metric="price"))
    parsed = parse_metric_page(body)
    out = []
    for h in parsed["history"]:
        try:
            out.append((datetime.strptime(h["date"].replace(".", ""), "%b %d, %Y").date().isoformat(), h["value"]))
        except ValueError:
            continue
    return sorted(out)


def _stale(rows, max_age_days: int = 4) -> bool:
    last = date.fromisoformat(rows[-1][0])
    return (date.today() - last).days > max_age_days


def load_prices(sym: str, start: str = "2010-01-01", refresh: bool = False, quiet: bool = False) -> list[tuple[str, float]]:
    sym = sym.upper()
    cached = None
    for ext, reader in ((".csv", _read_csv), (".xlsx", _read_xlsx)):
        p = os.path.join(CACHE, sym + ext)
        if os.path.exists(p):
            cached = reader(p)
            break
    if cached and (sym.startswith("DEMO_") or (not refresh and not _stale(cached))):
        return [r for r in cached if r[0] >= start]
    errors = []
    for name, fn in (("yfinance", lambda: from_yfinance(sym, start)), ("robinhood", lambda: from_robinhood(sym)),
                     ("ycharts", lambda: from_ycharts_page(sym))):
        try:
            rows = fn()
            if rows:
                if cached:  # merge, prefer fresh
                    merged = dict(cached); merged.update(dict(rows)); rows = sorted(merged.items())
                _write_cache(sym, rows)
                if not quiet:
                    print(f"{sym}: {len(rows)} rows from {name} ({rows[0][0]} .. {rows[-1][0]})", file=sys.stderr)
                return [r for r in rows if r[0] >= start]
        except Exception as e:  # noqa: BLE001
            errors.append(f"{name}: {type(e).__name__}: {e}")
    if cached:
        if not quiet:
            print(f"{sym}: using stale cache; fetch errors: {errors}", file=sys.stderr)
        return [r for r in cached if r[0] >= start]
    raise RuntimeError(f"no price data for {sym}: {errors}")


def latest_quotes(symbols: list[str]) -> dict[str, dict]:
    """{sym: {price, prev_close}} via yfinance fast_info."""
    import yfinance as yf
    out = {}
    for s in symbols:
        t = yf.Ticker(s)
        fi = t.fast_info
        out[s] = {"price": float(fi["last_price"]), "prev_close": float(fi["previous_close"])}
    return out


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("symbols", nargs="+")
    ap.add_argument("--start", default="2010-01-01")
    ap.add_argument("--refresh", action="store_true")
    args = ap.parse_args(argv)
    for s in args.symbols:
        rows = load_prices(s, args.start, args.refresh)
        print(f"{s.upper():<6} {len(rows):>6} rows  {rows[0][0]} -> {rows[-1][0]}  last {rows[-1][1]:.2f}")


if __name__ == "__main__":
    main()

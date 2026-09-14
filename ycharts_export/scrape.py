#!/usr/bin/env python3
"""
Pull fundamentals for a ticker from YCharts' *public* company pages
(https://ycharts.com/companies/<TICKER>/<metric>) without using the paid API.

Each metric page renders the current value in a `key-stat-title` element and
a small history table of (date, value) rows. That is enough to reconstruct the
fundamental snapshot that valuation.py consumes.

Usage:
    python -m ycharts_export.scrape MU                 # print JSON
    python -m ycharts_export.scrape MU -o data/mu_ycharts.json
    python -m ycharts_export.scrape MU --metrics pe_ratio,market_cap

Notes:
  * Only the metrics YCharts exposes without a login are reachable; deeper
    history needs a subscription. The scraper is polite (1 req/s) and caches
    each page under .cache/ so re-runs don't re-hit the site.
  * Respect ycharts.com terms of use; this is for personal research.
"""
from __future__ import annotations

import argparse
import html
import json
import os
import re
import sys
import time
import urllib.error
import urllib.request

BASE = "https://ycharts.com/companies/{ticker}/{metric}"
UA = ("Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/128.0 Safari/537.36")

# metric slug -> (label, units hint)
DEFAULT_METRICS = {
    "price": ("Price", "$"),
    "market_cap": ("Market Cap", "$"),
    "enterprise_value": ("Enterprise Value", "$"),
    "pe_ratio": ("PE Ratio (TTM)", "x"),
    "forward_pe_ratio": ("Forward PE Ratio", "x"),
    "ev_ebitda": ("EV / EBITDA (TTM)", "x"),
    "price_to_book_value": ("Price / Book", "x"),
    "ps_ratio": ("Price / Sales (TTM)", "x"),
    "peg_ratio": ("PEG Ratio", "x"),
    "revenues_ttm": ("Revenue (TTM)", "$"),
    "net_income_ttm": ("Net Income (TTM)", "$"),
    "eps_diluted_ttm": ("EPS Diluted (TTM)", "$/sh"),
    "free_cash_flow_ttm": ("Free Cash Flow (TTM)", "$"),
    "cash_from_operations_ttm": ("Operating Cash Flow (TTM)", "$"),
    "capital_expenditures_ttm": ("Capex (TTM)", "$"),
    "gross_profit_margin": ("Gross Margin", "%"),
    "profit_margin": ("Net Margin", "%"),
    "return_on_equity": ("ROE", "%"),
    "return_on_invested_capital": ("ROIC", "%"),
    "total_long_term_debt_quarterly": ("Long-Term Debt", "$"),
    "cash_and_short_term_investments_quarterly": ("Cash & ST Investments", "$"),
    "shares_outstanding": ("Shares Outstanding", "sh"),
    "book_value_per_share": ("Book Value / Share", "$/sh"),
    "dividend_yield": ("Dividend Yield", "%"),
    "beta": ("Beta", ""),
    "52_week_high": ("52-Week High", "$"),
    "52_week_low": ("52-Week Low", "$"),
}

_KEY_STAT = re.compile(
    r'class="key-stat-title"[^>]*>\s*([^<]+?)\s*(?:for|on)\s+([A-Z][a-z]{2,8}\.? \d{1,2},? \d{4})',
    re.S)
_ROW = re.compile(
    r"<tr[^>]*>\s*<td[^>]*>\s*([A-Z][a-z]{2,8}\.? \d{1,2},? \d{4})\s*</td>\s*<td[^>]*>\s*([^<]+?)\s*</td>",
    re.S)

_MULT = {"T": 1e12, "B": 1e9, "M": 1e6, "K": 1e3}


def parse_number(txt: str):
    """'1.151T' -> 1.151e12 ; '22.33' -> 22.33 ; '84.6%' -> 84.6 ; '--' -> None."""
    t = html.unescape(txt).strip().replace(",", "").replace("USD", "").strip()
    if t in ("", "--", "N/A", "NA"):
        return None
    neg = t.startswith("(") and t.endswith(")")
    t = t.strip("()").lstrip("$").rstrip("%").strip()
    m = re.fullmatch(r"(-?\d+(?:\.\d+)?)\s*([TBMK])?", t)
    if not m:
        return None
    val = float(m.group(1)) * _MULT.get(m.group(2) or "", 1.0)
    return -val if neg else val


def fetch(url: str, cache_dir: str = ".cache", sleep: float = 1.0) -> str:
    os.makedirs(cache_dir, exist_ok=True)
    key = re.sub(r"[^A-Za-z0-9]+", "_", url)[-120:]
    path = os.path.join(cache_dir, key + ".html")
    if os.path.exists(path):
        with open(path, encoding="utf-8") as fh:
            return fh.read()
    req = urllib.request.Request(url, headers={"User-Agent": UA,
                                               "Accept": "text/html",
                                               "Accept-Language": "en-US,en;q=0.9"})
    with urllib.request.urlopen(req, timeout=30) as resp:  # honours HTTPS_PROXY
        body = resp.read().decode("utf-8", errors="replace")
    with open(path, "w", encoding="utf-8") as fh:
        fh.write(body)
    time.sleep(sleep)
    return body


def parse_metric_page(body: str) -> dict:
    out: dict = {"current": None, "as_of": None, "history": []}
    m = _KEY_STAT.search(body)
    if m:
        out["current"] = parse_number(m.group(1))
        out["as_of"] = m.group(2)
    for date, val in _ROW.findall(body):
        v = parse_number(val)
        if v is not None:
            out["history"].append({"date": date, "value": v})
    return out


def scrape(ticker: str, metrics: dict[str, tuple[str, str]] | None = None,
           cache_dir: str = ".cache", verbose: bool = True) -> dict:
    metrics = metrics or DEFAULT_METRICS
    result = {"ticker": ticker.upper(), "source": "ycharts.com public pages",
              "fetched_at": time.strftime("%Y-%m-%d %H:%M:%S"), "metrics": {},
              "errors": {}}
    for slug, (label, unit) in metrics.items():
        url = BASE.format(ticker=ticker.upper(), metric=slug)
        try:
            body = fetch(url, cache_dir=cache_dir)
            parsed = parse_metric_page(body)
            parsed.update({"label": label, "unit": unit, "url": url})
            result["metrics"][slug] = parsed
            if verbose:
                print(f"  {label:<28} {parsed['current']!s:>18}  ({parsed['as_of']})",
                      file=sys.stderr)
        except urllib.error.HTTPError as e:
            result["errors"][slug] = f"HTTP {e.code}"
        except Exception as e:  # noqa: BLE001 - report and continue
            result["errors"][slug] = f"{type(e).__name__}: {e}"
            if verbose:
                print(f"  {label:<28} ERROR {e}", file=sys.stderr)
    return result


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("ticker")
    ap.add_argument("-o", "--out", help="write JSON here instead of stdout")
    ap.add_argument("--metrics", help="comma-separated metric slugs (default: all)")
    ap.add_argument("--cache-dir", default=".cache")
    args = ap.parse_args(argv)

    metrics = DEFAULT_METRICS
    if args.metrics:
        metrics = {s: DEFAULT_METRICS.get(s, (s, "")) for s in args.metrics.split(",")}
    print(f"Scraping ycharts.com for {args.ticker.upper()} ...", file=sys.stderr)
    data = scrape(args.ticker, metrics, cache_dir=args.cache_dir)
    text = json.dumps(data, indent=2)
    if args.out:
        with open(args.out, "w", encoding="utf-8") as fh:
            fh.write(text)
        print(f"wrote {args.out}", file=sys.stderr)
    else:
        print(text)
    if data["errors"] and not data["metrics"]:
        print("No metrics retrieved. If every error is a proxy 403/CONNECT failure, "
              "ycharts.com is blocked on this network; run from another machine.",
              file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())

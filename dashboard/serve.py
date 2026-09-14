#!/usr/bin/env python3
"""
Local dashboard server (stdlib only). Serves dashboard/index.html and a small JSON API
over the snapshot files written by portfolio.robinhood_sync / portfolio.csv_import.

    python -m dashboard.serve                  # http://127.0.0.1:8765, uses data/portfolio/snapshot.json
    python -m dashboard.serve --demo           # synthetic sample data, no login needed
    python -m dashboard.serve --refresh 60     # re-sync from Robinhood every 60s while the market is open

Endpoints:
    GET  /api/snapshot     current snapshot (holdings, summary, trades, dividends, equity curve)
    GET  /api/history      one row per day from data/portfolio/history/*.json (your own equity over time)
    GET  /api/prices/SYM   cached daily closes for SYM from data/prices (for the per-holding chart)
    POST /api/refresh      run portfolio.robinhood_sync now (uses the cached session token)
    GET  /api/backtest?symbol=MU&amount=500&freq=M   strategy comparison JSON for the backtest tab
    GET  /api/etf                                    roster of the S&L model funds (+ which are cached)
    GET  /api/etf/SMH                                full YCharts-style profile for one ETF
    GET  /api/overlap?a=SMH&b=QQQ                    holdings overlap between two funds
    GET  /api/prospects                              candidate ETFs ranked by fit to your book
    GET  /api/events/NVDA                            dated event timeline (earnings, news, big moves)
    GET  /api/attribution/NVDA                       market/sector/residual attribution + sentiment gauge

Binds to 127.0.0.1 only: this is your brokerage data. Do not expose it.
"""
from __future__ import annotations

import argparse
import glob
import json
import os
import subprocess
import sys
import threading
import time
from datetime import datetime, timezone
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlparse, parse_qs

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(ROOT, "data", "portfolio")
STATE = {"snapshot_path": os.path.join(DATA, "snapshot.json"), "refreshing": False, "last_refresh": None,
         "last_error": None, "demo": False}


def read_snapshot() -> dict:
    p = STATE["snapshot_path"]
    if not os.path.exists(p):
        return {"error": f"{os.path.relpath(p, ROOT)} not found. Run `python -m portfolio.robinhood_sync` "
                         f"(or `python -m portfolio.csv_import <activity.csv>`), or start with --demo.",
                "holdings": [], "summary": {}, "trades": [], "dividends": [], "equity_curve": {}}
    with open(p, encoding="utf-8") as fh:
        snap = json.load(fh)
    snap["_server"] = {"refreshing": STATE["refreshing"], "last_refresh": STATE["last_refresh"],
                       "last_error": STATE["last_error"], "demo": STATE["demo"],
                       "file_mtime": datetime.fromtimestamp(os.path.getmtime(p), tz=timezone.utc).isoformat(timespec="seconds")}
    return snap


def read_history() -> list[dict]:
    rows = []
    for p in sorted(glob.glob(os.path.join(DATA, "history", "*.json"))):
        try:
            with open(p, encoding="utf-8") as fh:
                d = json.load(fh)
            s = d.get("summary", {})
            rows.append({"date": os.path.basename(p)[:10], "equity": s.get("equity"), "cost_basis": s.get("cost_basis"),
                         "unrealized": s.get("unrealized"), "cash": s.get("cash"), "realized": s.get("realized")})
        except Exception:  # noqa: BLE001
            continue
    return rows


def read_prices(sym: str) -> list:
    sys.path.insert(0, ROOT)
    from portfolio.prices import _read_csv, CACHE
    p = os.path.join(ROOT, CACHE, f"{sym.upper()}.csv")
    return _read_csv(p) if os.path.exists(p) else []


def read_all_prices(symbols, start="2015-01-01"):
    sys.path.insert(0, ROOT)
    from portfolio.prices import load_prices, _read_csv, CACHE
    out = {}
    for s in symbols:
        # cache first (fast, no network) — try the symbol and its DEMO_ twin
        for name in (s, "DEMO_" + s):
            fp = os.path.join(ROOT, CACHE, name + ".csv")
            if os.path.exists(fp):
                rows = _read_csv(fp)
                if rows:
                    out[s] = rows
                    break
        if s in out:
            continue
        try:
            rows = load_prices(s, start, quiet=True)
            if rows:
                out[s] = rows
        except Exception:  # noqa: BLE001
            pass
    return out


def ycharts_metric(sym, metric):
    """Pull one metric's history from ycharts.com public pages (cached). Graceful on failure."""
    sys.path.insert(0, ROOT)
    from ycharts_export.scrape import fetch, parse_metric_page, BASE
    from datetime import datetime
    url = BASE.format(ticker=sym.upper(), metric=metric)
    body = fetch(url)
    parsed = parse_metric_page(body)
    out = []
    for h in parsed.get("history", []):
        for fmt in ("%b %d, %Y", "%b. %d, %Y", "%B %d, %Y"):
            try:
                out.append([datetime.strptime(h["date"].replace(".", ""), fmt.replace(".", "")).date().isoformat(), h["value"]])
                break
            except ValueError:
                continue
    return {"symbol": sym.upper(), "metric": metric, "current": parsed.get("current"),
            "as_of": parsed.get("as_of"), "history": sorted(out)}


YC_CACHE = os.path.join(ROOT, "data", "ycharts_cache")


def list_research() -> dict:
    """Summarize every ticker pulled from YCharts into the local cache."""
    out = []
    if os.path.isdir(YC_CACHE):
        for fn in sorted(glob.glob(os.path.join(YC_CACHE, "*.json"))):
            try:
                with open(fn, encoding="utf-8") as fh:
                    rec = json.load(fh)
            except Exception:  # noqa: BLE001
                continue
            pts = rec.get("points", {})
            def pv(k):
                v = pts.get(k, {})
                return v.get("value") if isinstance(v, dict) else v
            out.append({"symbol": rec.get("symbol", os.path.basename(fn)[:-5]),
                        "as_of": rec.get("as_of"), "price": pv("price"), "market_cap": pv("market_cap"),
                        "pe_ratio": pv("pe_ratio"), "dividend_yield": pv("dividend_yield"),
                        "n_series": len(rec.get("series", {}))})
    return {"cache_dir": os.path.relpath(YC_CACHE, ROOT), "count": len(out), "tickers": out}


def read_research(sym: str) -> dict:
    fn = os.path.join(YC_CACHE, f"{sym.upper()}.json")
    if not os.path.exists(fn):
        return {"error": f"{sym} not in YCharts cache. Run: python -m ycharts_export.api {sym}"}
    with open(fn, encoding="utf-8") as fh:
        return json.load(fh)


ETF_CACHE = os.path.join(ROOT, "data", "etf_profiles")


def read_prospects() -> dict:
    """Ranked ETF prospects vs the user's book. Reads the cached ranking, builds it if missing."""
    sys.path.insert(0, ROOT)
    fp = os.path.join(ROOT, "data", "prospects.json")
    if os.path.exists(fp):
        with open(fp, encoding="utf-8") as fh:
            return json.load(fh)
    try:
        from portfolio.prospects import rank
        return rank()
    except Exception as e:  # noqa: BLE001
        return {"error": f"{type(e).__name__}: {e}. On your Mac run: python3 -m portfolio.prospects",
                "ranked": [], "book": []}


def list_etf_profiles() -> dict:
    """Cached ETF quote-page profiles + the S&L model roster (so the tab has a picker)."""
    sys.path.insert(0, ROOT)
    from portfolio.watchlists import SL_MODEL
    cached = set()
    if os.path.isdir(ETF_CACHE):
        for fn in glob.glob(os.path.join(ETF_CACHE, "*.json")):
            cached.add(os.path.basename(fn)[:-5])
    model = [{"ticker": e["ticker"], "name": e["name"], "sleeve": e["sleeve"],
              "role": e["role"], "sp_corr": e["sp_corr"], "cached": e["ticker"] in cached}
             for e in SL_MODEL]
    return {"model": model, "cached": sorted(cached),
            "hint": "Build/refresh on your Mac: python -m portfolio.etf_profile --all"}


def etf_profile(sym: str, build: bool = False) -> dict:
    sys.path.insert(0, ROOT)
    from portfolio.etf_profile import load_cached, build as build_profile
    prof = None if build else load_cached(sym)
    if prof is None:
        prof = build_profile(sym)  # runs yfinance on this machine; risk-only if offline
    return prof


def etf_overlap(a: str, b: str) -> dict:
    sys.path.insert(0, ROOT)
    from portfolio.etf_profile import load_cached, build as build_profile, overlap
    if not a or not b:
        return {"error": "need ?a=TICKER&b=TICKER"}
    pa = load_cached(a) or build_profile(a)
    pb = load_cached(b) or build_profile(b)
    return {"a": pa["ticker"], "b": pb["ticker"],
            "a_holdings": pa.get("top_holdings", []), "b_holdings": pb.get("top_holdings", []),
            **overlap(pa.get("top_holdings", []), pb.get("top_holdings", []))}


SECTOR_MAP = {  # rough sector ETF per ticker for the attribution factor model
    "NVDA": "SMH", "MU": "SMH", "AVGO": "SMH", "AMD": "SMH", "SMH": "XLK", "QQQ": "XLK",
    "AAPL": "XLK", "MSFT": "XLK", "GOOGL": "XLK", "META": "XLK", "TSLA": "XLY",
    "VOO": "SPY", "QDPL": "SPY", "PATN": "EFA", "IAI": "XLF", "XAR": "ITA", "PAVE": "XLI",
    "USAI": "XLE", "SDCI": "DBC", "USFR": "BIL", "GLD": "GLD", "XLV": "SPY", "XLE": "SPY",
}


def events_timeline(sym: str) -> dict:
    sys.path.insert(0, ROOT)
    from portfolio.events import load_cached, build
    return load_cached(sym) or build(sym)


def attribution_for(sym: str, sector: str = None) -> dict:
    sys.path.insert(0, ROOT)
    from portfolio.attribution import build
    sec = sector or SECTOR_MAP.get(sym.upper())
    return build(sym, sec)


def run_backtest(q: dict) -> dict:
    sys.path.insert(0, ROOT)
    from portfolio.backtest import run, STRATEGIES, LABELS
    from portfolio.prices import load_prices
    sym = (q.get("symbol") or ["MU"])[0].upper()
    amount = float((q.get("amount") or ["500"])[0])
    freq = (q.get("freq") or ["M"])[0]
    start = (q.get("start") or ["2016-01-01"])[0]
    prices = load_prices(sym, start, quiet=True)
    res = []
    for k in STRATEGIES:
        r = run(prices, k, amount, freq)
        r["label"] = LABELS[k]
        r["curve"] = [(c[0], round(c[1], 2), round(c[2], 2)) for c in r["curve"][::max(1, len(r["curve"]) // 400)]]
        res.append(r)
    return {"symbol": sym, "amount": amount, "freq": freq, "results": res,
            "price": [(d, v) for d, v in prices[::max(1, len(prices) // 400)]]}


def refresh(no_orders: bool = False) -> None:
    if STATE["refreshing"] or STATE["demo"]:
        return
    STATE["refreshing"] = True
    try:
        cmd = [sys.executable, "-m", "portfolio.robinhood_sync"] + (["--no-orders"] if no_orders else [])
        out = subprocess.run(cmd, cwd=ROOT, capture_output=True, text=True, timeout=600)
        if out.returncode != 0:
            STATE["last_error"] = (out.stderr or out.stdout)[-2000:]
        else:
            STATE["last_error"] = None
            STATE["last_refresh"] = datetime.now(timezone.utc).isoformat(timespec="seconds")
    except Exception as e:  # noqa: BLE001
        STATE["last_error"] = str(e)
    finally:
        STATE["refreshing"] = False


def market_open_now() -> bool:
    """Rough NYSE hours check in US/Eastern without pytz: Mon-Fri 9:30-16:00 ET."""
    try:
        from zoneinfo import ZoneInfo
        now = datetime.now(ZoneInfo("America/New_York"))
    except Exception:  # noqa: BLE001
        now = datetime.now()
    return now.weekday() < 5 and (9, 30) <= (now.hour, now.minute) < (16, 0)


class Handler(SimpleHTTPRequestHandler):
    def handle_one_request(self):
        try:
            super().handle_one_request()
        except (BrokenPipeError, ConnectionResetError):
            self.close_connection = True
    def __init__(self, *a, **kw):
        super().__init__(*a, directory=os.path.join(ROOT, "dashboard"), **kw)

    def log_message(self, fmt, *args):  # quieter
        if args and "/api/" in str(args[0]):
            return
        super().log_message(fmt, *args)

    def _json(self, obj, code=200):
        body = json.dumps(obj).encode()
        try:
            self.send_response(code)
            self.send_header("Content-Type", "application/json")
            self.send_header("Cache-Control", "no-store")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
        except (BrokenPipeError, ConnectionResetError):
            pass   # browser navigated away mid-response; harmless

    def do_GET(self):
        u = urlparse(self.path)
        if u.path == "/" or u.path == "/index.html":
            self.path = "/index.html"
            return super().do_GET()
        if u.path == "/favicon.ico":
            self.send_response(204); self.end_headers(); return
        if u.path == "/api/snapshot":
            return self._json(read_snapshot())
        if u.path == "/api/history":
            return self._json(read_history())
        if u.path == "/api/prices":
            snap = read_snapshot()
            syms = [h["symbol"] for h in snap.get("holdings", [])]
            bench = parse_qs(u.query).get("benchmark", ["VOO"])[0]
            if bench and bench not in syms:
                syms.append(bench)
            return self._json(read_all_prices(syms))
        if u.path.startswith("/api/prices/"):
            return self._json(read_prices(u.path.rsplit("/", 1)[1]))
        if u.path == "/api/macro":
            fp = os.path.join(ROOT, "data", "macro", "macro.json")
            if os.path.exists(fp):
                return self._json(json.load(open(fp, encoding="utf-8")))
            return self._json({"error": "No macro data yet. Run: python -m portfolio.macro"})
        if u.path == "/api/valuation":
            try:
                sys.path.insert(0, ROOT)
                from portfolio.valuation_gauge import gauge
                snap = read_snapshot()
                syms = [h["symbol"] for h in snap.get("holdings", [])]
                return self._json({"results": [gauge(x) for x in syms]})
            except Exception as e:  # noqa: BLE001
                return self._json({"error": f"{type(e).__name__}: {e}", "results": []})
        if u.path == "/api/research":
            return self._json(list_research())
        if u.path.startswith("/api/research/"):
            return self._json(read_research(u.path.rsplit("/", 1)[1]))
        if u.path == "/api/prospects":
            return self._json(read_prospects())
        if u.path == "/api/etf":
            return self._json(list_etf_profiles())
        if u.path == "/api/overlap":
            q = parse_qs(u.query)
            try:
                return self._json(etf_overlap(q.get("a", [""])[0], q.get("b", [""])[0]))
            except Exception as e:  # noqa: BLE001
                return self._json({"error": f"{type(e).__name__}: {e}"}, 200)
        if u.path.startswith("/api/etf/"):
            sym = u.path.rsplit("/", 1)[1]
            build = parse_qs(u.query).get("build", ["0"])[0] == "1"
            try:
                return self._json(etf_profile(sym, build=build))
            except Exception as e:  # noqa: BLE001
                return self._json({"error": f"{type(e).__name__}: {e}", "ticker": sym.upper()}, 200)
        if u.path.startswith("/api/events/"):
            sym = u.path.rsplit("/", 1)[1]
            try:
                return self._json(events_timeline(sym))
            except Exception as e:  # noqa: BLE001
                return self._json({"error": f"{type(e).__name__}: {e}", "ticker": sym.upper(), "events": []}, 200)
        if u.path.startswith("/api/attribution/"):
            sym = u.path.rsplit("/", 1)[1]
            sector = parse_qs(u.query).get("sector", [None])[0]
            try:
                return self._json(attribution_for(sym, sector))
            except Exception as e:  # noqa: BLE001
                return self._json({"error": f"{type(e).__name__}: {e}", "ticker": sym.upper()}, 200)
        if u.path == "/api/ycharts":
            q = parse_qs(u.query)
            try:
                return self._json(ycharts_metric(q.get("symbol", ["MU"])[0], q.get("metric", ["pe_ratio"])[0]))
            except Exception as e:  # noqa: BLE001
                return self._json({"error": f"{type(e).__name__}: {e}", "history": []}, 200)
        if u.path == "/api/backtest":
            try:
                return self._json(run_backtest(parse_qs(u.query)))
            except Exception as e:  # noqa: BLE001
                return self._json({"error": f"{type(e).__name__}: {e}"}, 500)
        return super().do_GET()

    def do_POST(self):
        u = urlparse(self.path)
        if u.path == "/api/refresh":
            if STATE["demo"]:
                return self._json({"ok": False, "error": "demo mode: no Robinhood refresh"})
            threading.Thread(target=refresh, kwargs={"no_orders": "fast" in u.query}, daemon=True).start()
            return self._json({"ok": True, "started": True})
        self.send_error(404)


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--port", type=int, default=8765)
    ap.add_argument("--demo", action="store_true", help="serve data/portfolio/sample_snapshot.json")
    ap.add_argument("--snapshot", help="path to a snapshot.json to serve")
    ap.add_argument("--refresh", type=int, default=0, help="seconds between automatic Robinhood re-syncs (market hours only)")
    ap.add_argument("--sync-now", action="store_true", help="run a Robinhood sync before serving")
    ap.add_argument("--open", action="store_true", help="open the dashboard in your browser")
    args = ap.parse_args(argv)
    if args.demo:
        STATE["demo"] = True
        STATE["snapshot_path"] = os.path.join(DATA, "sample_snapshot.json")
        if not os.path.exists(STATE["snapshot_path"]):
            subprocess.run([sys.executable, "-m", "portfolio.demo_data"], cwd=ROOT, check=True)
    if args.snapshot:
        STATE["snapshot_path"] = os.path.abspath(args.snapshot)
    if args.sync_now:
        refresh()
    if args.refresh and not args.demo:
        def loop():
            while True:
                time.sleep(args.refresh)
                if market_open_now():
                    refresh(no_orders=True)
        threading.Thread(target=loop, daemon=True).start()
    srv = ThreadingHTTPServer(("127.0.0.1", args.port), Handler)
    print(f"Dashboard: http://127.0.0.1:{args.port}/  (snapshot: {os.path.relpath(STATE['snapshot_path'], ROOT)}"
          f"{', demo' if args.demo else ''}{f', auto-refresh {args.refresh}s' if args.refresh else ''})")
    if args.open:
        import webbrowser
        threading.Timer(1.0, lambda: webbrowser.open(f"http://127.0.0.1:{args.port}/")).start()
    try:
        srv.serve_forever()
    except KeyboardInterrupt:
        pass


if __name__ == "__main__":
    main()

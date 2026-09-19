#!/usr/bin/env python3
"""
Macro / volatility regime from FRED (St. Louis Fed) — free, no key. The instruments you named:
the VIX, the dollar, the 10-year yield, credit spreads, oil. Reads them, then computes a simple
risk-on / risk-off read so the dashboard can flag when to be cautious.

    python -m portfolio.macro          # fetch + print the regime, write data/macro/macro.json
"""
from __future__ import annotations

import csv
import io
import json
import os
import statistics
import sys
import urllib.request

CACHE = os.path.join("data", "macro")
FRED = "https://fred.stlouisfed.org/graph/fredgraph.csv?id={id}"

SERIES = {
    "VIX": {"id": "VIXCLS", "label": "Volatility (VIX)", "risk": "high", "watch": 20},
    "DOLLAR": {"id": "DTWEXBGS", "label": "US Dollar (broad)", "risk": "high"},
    "US10Y": {"id": "DGS10", "label": "10-Year Treasury yield", "risk": "neutral"},
    "HY_SPREAD": {"id": "BAMLH0A0HYM2", "label": "High-yield credit spread", "risk": "high", "watch": 5},
    "OIL": {"id": "DCOILWTICO", "label": "WTI crude oil", "risk": "neutral"},
}


def fetch_fred(series_id: str) -> list[tuple[str, float]]:
    req = urllib.request.Request(FRED.format(id=series_id), headers={"User-Agent": "portfolio-research"})
    with urllib.request.urlopen(req, timeout=30) as r:
        text = r.read().decode("utf-8", "replace")
    rows = []
    rdr = csv.reader(io.StringIO(text))
    header = next(rdr, None)
    for row in rdr:
        if len(row) < 2 or row[1] in (".", ""):
            continue
        try:
            rows.append((row[0], float(row[1])))
        except ValueError:
            continue
    return rows


def _stats(rows):
    if not rows:
        return {}
    vals = [v for _, v in rows]
    last = vals[-1]
    yr = vals[-252:] if len(vals) > 252 else vals
    lo, hi = min(yr), max(yr)
    pctile = 100 * (last - lo) / (hi - lo) if hi > lo else 50.0
    mo = rows[-22][1] if len(rows) > 22 else rows[0][1]
    return {"last": last, "date": rows[-1][0], "chg_1m": last - mo,
            "chg_1m_pct": (last / mo - 1) * 100 if mo else 0.0,
            "pctile_1y": pctile, "yr_low": lo, "yr_high": hi}


def regime() -> dict:
    out, risk_flags = {}, []
    for key, meta in SERIES.items():
        try:
            rows = fetch_fred(meta["id"])
            s = _stats(rows)
            s.update({"label": meta["label"], "series_id": meta["id"], "history": rows[-260:]})
            out[key] = s
            if meta.get("watch") and s.get("last", 0) >= meta["watch"]:
                risk_flags.append(f"{meta['label']} elevated at {s['last']:.1f}")
        except Exception as e:  # noqa: BLE001
            out[key] = {"error": f"{type(e).__name__}: {e}", "label": meta["label"]}
    # risk-on/off score: VIX high & rising, dollar rising, spreads widening -> risk-off
    score = 0
    v = out.get("VIX", {})
    if v.get("last"):
        score += 2 if v["last"] > 25 else (1 if v["last"] > 20 else (-1 if v["last"] < 15 else 0))
    if v.get("chg_1m", 0) > 2:
        score += 1
    d = out.get("DOLLAR", {})
    if d.get("chg_1m_pct", 0) > 1.5:
        score += 1
    hy = out.get("HY_SPREAD", {})
    if hy.get("last") and hy["last"] > 5:
        score += 2
    if hy.get("chg_1m", 0) > 0.5:
        score += 1
    label = ("Risk-OFF" if score >= 3 else "Leaning cautious" if score >= 1
             else "Risk-ON" if score <= -1 else "Neutral")
    return {"as_of": out.get("VIX", {}).get("date"), "score": score, "regime": label,
            "flags": risk_flags, "series": out}


def main(argv=None):
    r = regime()
    os.makedirs(CACHE, exist_ok=True)
    json.dump(r, open(os.path.join(CACHE, "macro.json"), "w", encoding="utf-8"), indent=1)
    print(f"Regime: {r['regime']} (score {r['score']})  as of {r['as_of']}")
    for k, s in r["series"].items():
        if "error" in s:
            print(f"  {s['label']:26} ERROR {s['error']}"); continue
        print(f"  {s['label']:26} {s['last']:>10.2f}  1m {s['chg_1m']:+.2f}  ({s['pctile_1y']:.0f}%ile of 1y)")
    for f in r["flags"]:
        print(f"  ! {f}")
    print(f"wrote {CACHE}/macro.json", file=sys.stderr)


if __name__ == "__main__":
    main()

"""Compare pipeline output against YCharts statement exports (and the press-release
annual history in data/mu_fundamentals.json) for overlapping fiscal years.

    python -m pipeline validate --ticker MU [--offline]

Offline, the MU fixture is itself built from YCharts, so this mainly proves the
extraction path (tag fallback, period selection, dedupe, fiscal-year mapping) is
lossless; the press-release columns are an independent check. Run it without
--offline once data.sec.gov is reachable to validate real EDGAR XBRL against YCharts.
"""
from __future__ import annotations

import json
from pathlib import Path

from .extract import extract_annuals
from .fixturegen import REPO_ROOT, YCHARTS_DIR, load_ycharts
from .sec import SecClient
from .universe import lookup

FIELDS = ["revenue", "cost_of_revenue", "gross_profit", "operating_income", "pretax_income", "income_tax",
          "net_income", "eps_diluted", "operating_cash_flow", "capex", "free_cash_flow", "d_and_a",
          "cash", "total_assets", "total_liabilities", "total_equity", "total_debt",
          "current_assets", "current_liabilities", "inventory"]
REL_TOL = 0.01        # 1 %
ABS_TOL_USD = 5e6     # $5M floor for near-zero items
ABS_TOL_EPS = 0.02


def _cmp(field, ours, ref):
    if ours is None or ref is None:
        return None, "n/a"
    diff = ours - ref
    pct = diff / abs(ref) if ref else (0.0 if diff == 0 else float("inf"))
    floor = ABS_TOL_EPS if field == "eps_diluted" else ABS_TOL_USD
    ok = abs(diff) <= max(REL_TOL * abs(ref), floor)
    return pct, "PASS" if ok else "FAIL"


def compare(ours: dict[int, dict], ref: dict[int, dict], fields=FIELDS) -> list[dict]:
    rows = []
    for fy in sorted(set(ours) & set(ref)):
        for f in fields:
            o, r = ours[fy].get(f), ref[fy].get(f)
            if r is not None and f != "eps_diluted":
                r = r * 1_000_000  # YCharts $M -> raw USD
            pct, status = _cmp(f, o, r)
            rows.append({"fy": fy, "field": f, "pipeline": o, "reference": r, "pct": pct, "status": status})
    return rows


def press_release_reference(path: Path) -> dict[int, dict]:
    if not path.exists():
        return {}
    with open(path, encoding="utf-8") as fh:
        d = json.load(fh)
    out = {}
    for row in d.get("annual_history", []):
        out[row["fy"]] = {"revenue": row.get("revenue"), "net_income": row.get("gaap_ni")}
    return out


def _fmt(v, field):
    if v is None:
        return "-"
    if field == "eps_diluted":
        return f"{v:,.2f}"
    return f"{v / 1e6:,.0f}"


def print_table(rows, title) -> tuple[int, int]:
    print(f"\n{title}")
    print(f"{'FY':<6}{'field':<22}{'pipeline($M)':>14}{'reference($M)':>15}{'diff %':>9}  status")
    npass = nfail = 0
    for r in rows:
        if r["status"] == "n/a":
            continue
        pct = "-" if r["pct"] is None else f"{100 * r['pct']:+.2f}"
        print(f"{r['fy']:<6}{r['field']:<22}{_fmt(r['pipeline'], r['field']):>14}"
              f"{_fmt(r['reference'], r['field']):>15}{pct:>9}  {r['status']}")
        npass += r["status"] == "PASS"
        nfail += r["status"] == "FAIL"
    print(f"-> {npass} pass, {nfail} fail")
    return npass, nfail


def run(ticker: str = "MU", offline: bool = False, ycharts_dir: Path = YCHARTS_DIR,
        client: SecClient | None = None, years: int = 10) -> int:
    client = client or SecClient(offline=offline)
    meta = lookup(ticker)
    cik = meta[0] if meta else client.ticker_map()[ticker.upper()]["cik"]
    ann = extract_annuals(client.companyfacts(cik))
    fye = ann["fy_end"][max(ann["fy_end"])]
    month, day = int(fye[5:7]), int(fye[8:10])
    if day <= 7:  # 52/53-week year ending in the first days of a month -> previous month-end label
        month = 12 if month == 1 else month - 1
    ours = ann["years"]
    keep = sorted(ours)[-years:]
    ours = {fy: ours[fy] for fy in keep}
    yc = load_ycharts(Path(ycharts_dir), ticker, fye_month=month)
    src = "live EDGAR" if not client.offline else "offline fixture"
    _, f1 = print_table(compare(ours, yc), f"{ticker}: pipeline ({src}) vs YCharts statement exports "
                                           f"(tolerance max(1%, $5M / $0.02 EPS))")
    rc = 1 if f1 else 0
    if ticker.upper() == "MU":
        pr = press_release_reference(REPO_ROOT / "data" / "mu_fundamentals.json")
        rows = []
        for fy in sorted(set(ours) & set(pr)):
            for f in ("revenue", "net_income"):
                o, r = ours[fy].get(f), pr[fy].get(f)
                r = None if r is None else r * 1e9
                if o is None or r is None:
                    continue
                ok = abs(o - r) <= 0.0051e9 + 1e6  # reference rounded to $0.01B
                rows.append({"fy": fy, "field": f, "pipeline": o, "reference": r,
                             "pct": (o - r) / abs(r) if r else None, "status": "PASS" if ok else "FAIL"})
        _, f2 = print_table(rows, "MU: pipeline vs press-release annual history in data/mu_fundamentals.json "
                                  "(reference rounded to $0.01B)")
        rc = rc or (1 if f2 else 0)
    return rc

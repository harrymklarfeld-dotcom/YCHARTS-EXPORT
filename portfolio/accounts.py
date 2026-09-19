#!/usr/bin/env python3
"""
The "overall money tracker" — roll every brokerage account you own into one net-worth view.

Your primary snapshot (Robinhood, via robinhood_sync/csv_import) is the anchor. Any other account
is a sibling file in data/portfolio/ that carries an "account" marker, e.g. raymond_james.json:

    {"account": "Raymond James xxxx7781", "broker": "raymond_james",
     "holdings": [{"symbol": "QQQ", "shares": 2, "market_value": 1442.90, "avg_cost": 504.37}, ...],
     "summary": {"equity": 2855.66, "cash": 9.20}}

combine() returns totals, a per-account breakdown, and a by-symbol roll-up across accounts (so VOO
held in two places shows your true combined exposure). All of it stays local — these files are
gitignored (data/portfolio/*), so real balances never touch the public repo.

    python -m portfolio.accounts            # print the combined picture
"""
from __future__ import annotations

import glob
import json
import os
import sys

DATA = os.path.join("data", "portfolio")
# never treat these as brokerage accounts even though they live in data/portfolio/
_SKIP = {"snapshot.json", "sample_snapshot.json"}


def _num(x):
    try:
        return float(x)
    except (TypeError, ValueError):
        return 0.0


def normalize(snap: dict, default_name: str = "Account") -> dict:
    """Reduce any snapshot to a common shape: name, broker, equity, cash, cost_basis, holdings."""
    holdings = []
    for h in snap.get("holdings", []) or []:
        mv = _num(h.get("market_value"))
        if mv == 0 and h.get("shares") and h.get("price"):
            mv = _num(h["shares"]) * _num(h["price"])
        holdings.append({
            "symbol": (h.get("symbol") or "").upper(),
            "shares": _num(h.get("shares")),
            "market_value": round(mv, 2),
            "cost_basis": round(_num(h["cost_basis"]), 2) if h.get("cost_basis") is not None else None,
            "avg_cost": _num(h["avg_cost"]) if h.get("avg_cost") is not None else None,
        })
    summ = snap.get("summary", {}) or {}
    equity = _num(summ.get("equity")) or round(sum(h["market_value"] for h in holdings) + _num(summ.get("cash")), 2)
    cb = summ.get("cost_basis")
    if cb is None:
        parts = [h["cost_basis"] for h in holdings if h["cost_basis"] is not None]
        cb = round(sum(parts), 2) if parts and len(parts) == len(holdings) and holdings else None
    return {
        "name": snap.get("account") or default_name,
        "broker": snap.get("broker") or default_name.lower().replace(" ", "_"),
        "as_of": snap.get("as_of"),
        "source": snap.get("source"),
        "equity": round(equity, 2),
        "cash": round(_num(summ.get("cash")), 2),
        "cost_basis": None if cb is None else round(_num(cb), 2),
        "unrealized_gain": round(_num(summ["unrealized_gain"]), 2) if summ.get("unrealized_gain") is not None else None,
        "holdings": holdings,
    }


def discover_extra(exclude_paths=(), data_dir: str = DATA) -> list:
    """Sibling account files: any data/portfolio/*.json with an 'account' key and holdings."""
    excl = {os.path.abspath(p) for p in exclude_paths}
    out = []
    for p in sorted(glob.glob(os.path.join(data_dir, "*.json"))):
        if os.path.basename(p) in _SKIP or os.path.abspath(p) in excl:
            continue
        try:
            with open(p, encoding="utf-8") as fh:
                d = json.load(fh)
        except Exception:  # noqa: BLE001
            continue
        if isinstance(d, dict) and d.get("account") and d.get("holdings"):
            out.append(d)
    return out


def load_all(primary_snap: dict = None, primary_path: str = None) -> list:
    """Normalized list of accounts: the primary snapshot first, then any marked siblings."""
    accounts = []
    if primary_snap is None:
        p = primary_path or os.path.join(DATA, "snapshot.json")
        if os.path.exists(p):
            with open(p, encoding="utf-8") as fh:
                primary_snap = json.load(fh)
            primary_path = p
    if primary_snap and primary_snap.get("holdings"):
        accounts.append(normalize(primary_snap, primary_snap.get("account") or "Robinhood"))
    for extra in discover_extra(exclude_paths=[primary_path] if primary_path else []):
        accounts.append(normalize(extra))
    return accounts


def combine(accounts: list) -> dict:
    """Totals, per-account weights, and a by-symbol roll-up across all accounts."""
    total_equity = round(sum(a["equity"] for a in accounts), 2)
    total_cash = round(sum(a["cash"] for a in accounts), 2)
    cbs = [a["cost_basis"] for a in accounts if a["cost_basis"] is not None]
    total_cost_basis = round(sum(cbs), 2) if cbs else None
    cost_basis_complete = bool(accounts) and len(cbs) == len(accounts)

    per_account = [{
        "name": a["name"], "broker": a["broker"], "as_of": a["as_of"],
        "equity": a["equity"], "cash": a["cash"],
        "cost_basis": a["cost_basis"], "unrealized_gain": a["unrealized_gain"],
        "weight": round(a["equity"] / total_equity * 100, 2) if total_equity else 0.0,
        "n_holdings": len(a["holdings"]),
    } for a in accounts]

    by_symbol = {}
    for a in accounts:
        for h in a["holdings"]:
            s = h["symbol"]
            if not s:
                continue
            row = by_symbol.setdefault(s, {"symbol": s, "shares": 0.0, "market_value": 0.0,
                                           "cost_basis": 0.0, "_cb_known": True, "accounts": []})
            row["shares"] = round(row["shares"] + h["shares"], 6)
            row["market_value"] = round(row["market_value"] + h["market_value"], 2)
            if h["cost_basis"] is None:
                row["_cb_known"] = False
            else:
                row["cost_basis"] = round(row["cost_basis"] + h["cost_basis"], 2)
            if a["name"] not in row["accounts"]:
                row["accounts"].append(a["name"])

    holdings = []
    for row in by_symbol.values():
        row["weight"] = round(row["market_value"] / total_equity * 100, 2) if total_equity else 0.0
        row["held_in"] = len(row["accounts"])
        if not row.pop("_cb_known"):
            row["cost_basis"] = None
            row["gain"] = None
        else:
            row["gain"] = round(row["market_value"] - row["cost_basis"], 2)
        holdings.append(row)
    holdings.sort(key=lambda r: -r["market_value"])

    return {
        "total_equity": total_equity,
        "total_cash": total_cash,
        "total_cost_basis": total_cost_basis,
        "cost_basis_complete": cost_basis_complete,
        "total_unrealized_gain": round(total_equity - total_cost_basis, 2) if (total_cost_basis and cost_basis_complete) else None,
        "n_accounts": len(accounts),
        "accounts": per_account,
        "holdings": holdings,
    }


def networth(primary_snap: dict = None, primary_path: str = None) -> dict:
    return combine(load_all(primary_snap, primary_path))


def main(argv=None):
    combo = networth()
    if not combo["n_accounts"]:
        print("No accounts found. Add data/portfolio/snapshot.json (robinhood_sync) and/or a marked sibling.")
        return
    print(f"Net worth across {combo['n_accounts']} account(s): ${combo['total_equity']:,.2f} "
          f"(cash ${combo['total_cash']:,.2f})")
    for a in combo["accounts"]:
        g = "" if a["unrealized_gain"] is None else f"  gain ${a['unrealized_gain']:,.2f}"
        print(f"  {a['weight']:5.1f}%  {a['name']:<28} ${a['equity']:>10,.2f}{g}")
    print("\nCombined holdings:")
    for h in combo["holdings"]:
        where = "×".join(str(h["held_in"])) if h["held_in"] > 1 else ""
        tag = f"  (in {h['held_in']} accts)" if h["held_in"] > 1 else ""
        print(f"  {h['weight']:5.1f}%  {h['symbol']:<6} ${h['market_value']:>10,.2f}{tag}")


if __name__ == "__main__":
    sys.exit(main())

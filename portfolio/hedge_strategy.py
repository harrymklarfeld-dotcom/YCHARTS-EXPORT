#!/usr/bin/env python3
"""
A realistic hedge-overlay strategy built from the S&L model ETFs, plus the diagnostics
that justify it — the "run diagnostics" step before you put a dollar on it.

The thesis (yours): a tech/semiconductor-heavy book needs a sleeve that keeps most of the
upside but cuts the drawdown when the S&P rolls over. So we:

  1. DIAGNOSE every candidate against the S&P (SPY): realized beta, correlation, annualized
     volatility, max drawdown, and how it actually behaved in the two stress windows that
     matter — the 2022 rate bear and the 2020 COVID crash. Correlation is the whole game:
     a "hedge" that falls with the S&P is not a hedge.
  2. CLASSIFY by measured beta into growth / thematic / diversifier sleeves (data, not labels).
  3. BUILD weights: cap the growth sleeve, risk-parity (inverse-vol) the diversifiers so the
     genuinely low-correlation funds do real work, and target a blended beta near `target_beta`.
  4. VERIFY the blend: realized beta, vol, max drawdown, and down-month capture vs holding SPY.

Pure math over daily prices (portfolio.riskstats); everything runs offline on cached prices.

    python -m portfolio.hedge_strategy --diagnose            # the diagnostics table
    python -m portfolio.hedge_strategy --build --target-beta 0.6
    python -m portfolio.hedge_strategy --corr                # correlation matrix to the S&P + peers
    python -m portfolio.hedge_strategy --json report.json    # everything, machine-readable
"""
from __future__ import annotations

import argparse
import json
import statistics
import sys
from datetime import date

from . import riskstats
from .prices import load_prices
from .watchlists import SL_MODEL

BENCH = "SPY"
STRESS = {
    "2022 rate bear": ("2022-01-01", "2022-10-12"),
    "2020 COVID crash": ("2020-02-19", "2020-03-23"),
}


def _corr(a_rows, b_rows):
    a, b = dict(a_rows), dict(b_rows)
    common = sorted(set(a) & set(b))
    if len(common) < 30:
        return None
    ra = [a[common[i]] / a[common[i - 1]] - 1 for i in range(1, len(common)) if a[common[i - 1]] > 0]
    rb = [b[common[i]] / b[common[i - 1]] - 1 for i in range(1, len(common)) if b[common[i - 1]] > 0]
    n = min(len(ra), len(rb)); ra, rb = ra[:n], rb[:n]
    sa, sb = statistics.pstdev(ra), statistics.pstdev(rb)
    if not sa or not sb:
        return None
    ma, mb = statistics.fmean(ra), statistics.fmean(rb)
    cov = sum((ra[i] - ma) * (rb[i] - mb) for i in range(n)) / n
    return cov / (sa * sb)


def _window_return(rows, start, end):
    px = dict(rows)
    def on_or_before(d):
        ks = [k for k in px if k <= d]
        return px[max(ks)] if ks else None
    s, e = on_or_before(start), on_or_before(end)
    if s and e and s > 0 and rows[0][0] <= start:
        return (e / s - 1) * 100
    return None


def diagnose(tickers=None, start="2018-01-01", quiet=True):
    """Per-fund diagnostics vs the S&P, including the stress-window drawdowns."""
    tickers = tickers or [e["ticker"] for e in SL_MODEL]
    meta = {e["ticker"]: e for e in SL_MODEL}
    bench = load_prices(BENCH, start, quiet=quiet)
    out = []
    for tk in tickers:
        try:
            rows = load_prices(tk, start, quiet=quiet)
        except Exception as e:  # noqa: BLE001
            out.append({"ticker": tk, "error": f"{type(e).__name__}: {e}"})
            continue
        beta, alpha = riskstats.beta_alpha(rows, bench)
        rec = {
            "ticker": tk,
            "name": meta.get(tk, {}).get("name"),
            "sleeve_label": meta.get(tk, {}).get("sleeve"),
            "beta": round(beta, 2) if beta is not None else None,
            "corr_sp": round(_corr(rows, bench), 2) if _corr(rows, bench) is not None else None,
            "vol_pct": round(riskstats.volatility(rows), 1) if riskstats.volatility(rows) else None,
            "max_dd_pct": round(riskstats.max_drawdown(rows), 1),
            "ret_1y_pct": round(riskstats.trailing_returns(rows).get("1Y"), 1) if riskstats.trailing_returns(rows).get("1Y") is not None else None,
            "stress": {k: (round(_window_return(rows, s, e), 1) if _window_return(rows, s, e) is not None else None)
                       for k, (s, e) in STRESS.items()},
        }
        # data-driven sleeve: what the numbers say, not the label
        b = rec["beta"]
        rec["measured_sleeve"] = ("diversifier" if b is not None and b < 0.5
                                  else "thematic" if b is not None and b < 0.9
                                  else "growth")
        out.append(rec)
    return {"as_of": date.today().isoformat(), "benchmark": BENCH, "start": start, "funds": out,
            "sp_stress": {k: round(_window_return(bench, s, e), 1) for k, (s, e) in STRESS.items()}}


def build_hedge(diag, target_beta=0.6, growth_cap=0.45):
    """
    Weights for a realistic hedge sleeve from the diagnostics.

    Growth sleeve is capped (you already own plenty of beta in your core book); the diversifier
    sleeve is inverse-vol weighted (risk parity) so the low-correlation funds carry real weight;
    thematics fill the middle. We then scale growth vs diversifiers to hit `target_beta`.
    """
    funds = [f for f in diag["funds"] if not f.get("error") and f.get("beta") is not None]
    groups = {"growth": [], "thematic": [], "diversifier": []}
    for f in funds:
        groups[f["measured_sleeve"]].append(f)

    def inv_vol(members):
        if not members:
            return {}
        inv = {f["ticker"]: 1.0 / (f["vol_pct"] or 1) for f in members}
        tot = sum(inv.values())
        return {k: v / tot for k, v in inv.items()}

    w_growth = inv_vol(groups["growth"])
    w_them = inv_vol(groups["thematic"])
    w_div = inv_vol(groups["diversifier"])

    beta_of = {f["ticker"]: f["beta"] for f in funds}

    def sleeve_beta(w):
        return sum(beta_of[t] * x for t, x in w.items()) if w else 0.0

    bg, bt, bd = sleeve_beta(w_growth), sleeve_beta(w_them), sleeve_beta(w_div)
    # Allocate: cap growth, give the rest to thematic+diversifier, then solve the split that
    # lands blended beta on target. g*bg + m*bt_div = target, with g <= growth_cap.
    g = min(growth_cap, 0.45)
    rest = 1 - g
    # split 'rest' between thematic (bt) and diversifier (bd) to hit target beta
    # g*bg + a*bt + (rest-a)*bd = target  ->  a = (target - g*bg - rest*bd) / (bt - bd)
    denom = (bt - bd) if (bt is not None and bd is not None and bt != bd) else None
    if denom:
        a = (target_beta - g * bg - rest * bd) / denom
        a = max(0.0, min(rest, a))
    else:
        a = rest * 0.5
    them_alloc, div_alloc = a, rest - a
    if not groups["thematic"]:
        them_alloc, div_alloc = 0.0, rest
    if not groups["diversifier"]:
        them_alloc, div_alloc = rest, 0.0

    weights = {}
    for t, x in w_growth.items():
        weights[t] = round(g * x * 100, 1)
    for t, x in w_them.items():
        weights[t] = round(them_alloc * x * 100, 1)
    for t, x in w_div.items():
        weights[t] = round(div_alloc * x * 100, 1)
    blended_beta = round(g * bg + them_alloc * bt + div_alloc * bd, 2)

    return {"target_beta": target_beta, "growth_cap_pct": round(g * 100),
            "sleeve_alloc_pct": {"growth": round(g * 100), "thematic": round(them_alloc * 100),
                                  "diversifier": round(div_alloc * 100)},
            "sleeve_betas": {"growth": round(bg, 2), "thematic": round(bt, 2), "diversifier": round(bd, 2)},
            "weights": {k: v for k, v in sorted(weights.items(), key=lambda kv: -kv[1]) if v > 0},
            "blended_beta_est": blended_beta}


def verify(weights, start="2018-01-01", quiet=True):
    """Backtest the blended sleeve as a fixed-weight, rebalanced-daily index vs SPY."""
    bench = load_prices(BENCH, start, quiet=quiet)
    series = {}
    for tk in weights:
        try:
            series[tk] = dict(load_prices(tk, start, quiet=quiet))
        except Exception:  # noqa: BLE001
            pass
    if not series:
        return {"error": "no price data for the sleeve"}
    common = sorted(set.intersection(*[set(s) for s in series.values()]) & set(dict(bench)))
    if len(common) < 60:
        return {"error": "insufficient overlapping history"}
    wsum = sum(weights[t] for t in series)
    w = {t: weights[t] / wsum for t in series}
    # daily portfolio return = weighted sum of constituent daily returns (daily rebalance)
    port = [(common[0], 100.0)]
    for i in range(1, len(common)):
        r = sum(w[t] * (series[t][common[i]] / series[t][common[i - 1]] - 1)
                for t in series if series[t][common[i - 1]] > 0)
        port.append((common[i], port[-1][1] * (1 + r)))
    b = [(d, dict(bench)[d]) for d in common]
    return {
        "start": common[0], "end": common[-1],
        "sleeve": {"return_pct": round((port[-1][1] / port[0][1] - 1) * 100, 1),
                   "vol_pct": round(riskstats.volatility(port), 1),
                   "max_dd_pct": round(riskstats.max_drawdown(port), 1),
                   "beta": round(riskstats.beta_alpha(port, b)[0], 2),
                   "sharpe": round(riskstats.sharpe(port), 2) if riskstats.sharpe(port) else None},
        "sp500": {"return_pct": round((b[-1][1] / b[0][1] - 1) * 100, 1),
                  "vol_pct": round(riskstats.volatility(b), 1),
                  "max_dd_pct": round(riskstats.max_drawdown(b), 1)},
    }


def report(target_beta=0.6, start="2018-01-01", quiet=True):
    diag = diagnose(start=start, quiet=quiet)
    hedge = build_hedge(diag, target_beta=target_beta)
    ver = verify(hedge["weights"], start=start, quiet=quiet)
    return {"diagnostics": diag, "strategy": hedge, "verification": ver}


def _print_diag(diag):
    print(f"\nDIAGNOSTICS vs {diag['benchmark']}  (since {diag['start']})")
    print(f"{'Fund':<6}{'beta':>6}{'corr':>6}{'vol%':>7}{'maxDD%':>8}{'1Y%':>7}   sleeve      stress: 2022 / COVID")
    for f in diag["funds"]:
        if f.get("error"):
            print(f"{f['ticker']:<6}  {f['error']}"); continue
        st = f["stress"]
        print(f"{f['ticker']:<6}{_f(f['beta']):>6}{_f(f['corr_sp']):>6}{_f(f['vol_pct']):>7}"
              f"{_f(f['max_dd_pct']):>8}{_f(f['ret_1y_pct']):>7}   {f['measured_sleeve']:<11} "
              f"{_f(st.get('2022 rate bear')):>7} / {_f(st.get('2020 COVID crash')):>7}")
    print(f"{'SPY':<6}{'1.00':>6}{'1.00':>6}     .     .      .   benchmark   "
          f"{_f(diag['sp_stress'].get('2022 rate bear')):>7} / {_f(diag['sp_stress'].get('2020 COVID crash')):>7}")


def _f(x):
    return f"{x:.1f}" if isinstance(x, (int, float)) else "--"


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--diagnose", action="store_true")
    ap.add_argument("--build", action="store_true")
    ap.add_argument("--corr", action="store_true")
    ap.add_argument("--target-beta", type=float, default=0.6)
    ap.add_argument("--start", default="2018-01-01")
    ap.add_argument("--json", metavar="PATH", help="write the full report as JSON")
    args = ap.parse_args(argv)

    if args.json:
        rep = report(args.target_beta, args.start, quiet=True)
        with open(args.json, "w", encoding="utf-8") as fh:
            json.dump(rep, fh, indent=2)
        print(f"wrote {args.json}")
        return

    diag = diagnose(start=args.start, quiet=False)
    if args.diagnose or not (args.build or args.corr):
        _print_diag(diag)
    if args.corr:
        bench = load_prices(BENCH, args.start, quiet=True)
        print("\nCORRELATION TO S&P (daily returns):")
        for f in diag["funds"]:
            if not f.get("error"):
                print(f"  {f['ticker']:<6} {_f(f['corr_sp'])}")
    if args.build or not (args.diagnose or args.corr):
        hedge = build_hedge(diag, target_beta=args.target_beta)
        print(f"\nHEDGE SLEEVE  (target beta {hedge['target_beta']}, est blended beta {hedge['blended_beta_est']})")
        print(f"  sleeve alloc: {hedge['sleeve_alloc_pct']}")
        for t, w in hedge["weights"].items():
            print(f"  {t:<6} {w:>5.1f}%")
        ver = verify(hedge["weights"], args.start, quiet=True)
        if not ver.get("error"):
            s, sp = ver["sleeve"], ver["sp500"]
            print(f"\nVERIFY {ver['start']}..{ver['end']}  (daily-rebalanced blend)")
            print(f"  sleeve : return {s['return_pct']:>6}%  vol {s['vol_pct']}  maxDD {s['max_dd_pct']}%  beta {s['beta']}  sharpe {s['sharpe']}")
            print(f"  SPY    : return {sp['return_pct']:>6}%  vol {sp['vol_pct']}  maxDD {sp['max_dd_pct']}%  beta 1.00")
        else:
            print("  verify:", ver["error"])


if __name__ == "__main__":
    main()

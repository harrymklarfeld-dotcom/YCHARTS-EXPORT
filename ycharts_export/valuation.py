#!/usr/bin/env python3
"""
Intrinsic-value / margin-of-safety model for a cyclical semiconductor
(built for Micron, MU). Reads data/<ticker>_fundamentals.json, writes a
markdown report.

Four lenses, because a single DCF on a memory company at a cycle peak is
worthless:
  1. Multiples snapshot (trailing, forward, EV-based).
  2. Through-cycle earnings power  -> Graham-style value = normalized EPS x multiple + net cash.
  3. Scenario DCF (bear / base / bull) with an explicit down-cycle, terminal
     value struck on *mid-cycle* FCF, probability-weighted.
  4. Asset floor: book value and net cash per share, projected forward.

Margin of safety (MoS) = 1 - price / intrinsic value.  Buy-below prices are
reported for 25%, 35% and 50% required MoS.

Usage:  python -m ycharts_export.valuation [--ticker MU] [--price 1000]
                                            [--discount 0.10] [--out reports/x.md]
"""
from __future__ import annotations

import argparse
import json
import os
import sys
from dataclasses import dataclass, field

# ---------------------------------------------------------------- scenarios
# Revenue ($B) and free cash flow ($B) for FY27..FY31 plus a terminal
# mid-cycle FCF. FY26 is essentially known (three quarters reported + guide).
# The bear case assumes 2027 is still strong (2027 output is contracted /
# sold out) but oversupply from new fabs + China hits in 2028-29.


@dataclass
class Scenario:
    name: str
    prob: float
    revenue: list[float]        # FY27..FY31
    fcf: list[float]            # FY27..FY31
    terminal_fcf: float         # sustainable mid-cycle FCF after FY31
    terminal_growth: float
    midcycle_ni: float          # normalized GAAP net income for the earnings-power lens
    midcycle_pe: float          # multiple a through-cycle investor would pay
    story: str


SCENARIOS = [
    Scenario(
        "Bear: classic cycle, oversupply in CY2028", 0.25,
        revenue=[190, 120, 100, 120, 140], fcf=[75, 20, 5, 20, 30],
        terminal_fcf=35, terminal_growth=0.03, midcycle_ni=35, midcycle_pe=12,
        story=("Contracts hold FY27, then Idaho/Korea/China capacity lands into "
               "slowing AI capex. Pricing gives back most of the 2025-27 gains; "
               "margins revert toward the FY22 level. Still a far larger "
               "business than the FY17-25 cycle.")),
    Scenario(
        "Base: peak mid-CY2027, higher plateau", 0.50,
        revenue=[250, 220, 170, 180, 195], fcf=[130, 95, 50, 60, 70],
        terminal_fcf=70, terminal_growth=0.03, midcycle_ni=70, midcycle_pe=13,
        story=("Roughly the Citi view: DRAM/NAND prices crest around Q2 CY2027, "
               "FY28 is down but still huge, FY29 is the trough. HBM share and "
               "strategic customer agreements keep mid-cycle FCF ~$70B.")),
    Scenario(
        "Bull: the cycle is dead", 0.25,
        revenue=[270, 300, 280, 300, 320], fcf=[150, 165, 140, 150, 160],
        terminal_fcf=160, terminal_growth=0.03, midcycle_ni=150, midcycle_pe=12,
        story=("AI memory demand compounds faster than the three-supplier "
               "oligopoly adds wafers; contracted pricing turns memory into a "
               "utility-like cash machine. FY27 consensus ($155 EPS) becomes "
               "the new normal, not the peak.")),
]


# ---------------------------------------------------------------- helpers
def pv(cashflows, r, t0=1.0):
    return sum(cf / (1 + r) ** (t0 + i) for i, cf in enumerate(cashflows))


def fmt(x, nd=0):
    return f"{x:,.{nd}f}"


@dataclass
class Result:
    label: str
    value_per_share: float
    detail: dict = field(default_factory=dict)


# ---------------------------------------------------------------- model
def run(data: dict, price: float, r: float, shares_m: float):
    yc = data.get("ycharts")
    if yc:
        # newest-first in YCharts; model wants oldest-first, last 4 = TTM
        yq = list(reversed(yc["quarters"][:4]))
        q = [{"fq": f"Q{((i+3)%4)+1}FY{x['fy'] % 100}", "end": x["end"], "revenue": x["revenue"],
              "gaap_ni": x["net_income"], "gaap_eps": x["eps_diluted"],
              "non_gaap_eps": data["quarters"][i]["non_gaap_eps"], "ocf": x["ocf"],
              "capex": x["capex"], "fcf": x["fcf"], "gross_margin_pct": x["gross_margin_pct"]}
             for i, x in enumerate(yq)]
    else:
        q = data["quarters"]
    bs = data["balance_sheet_2026-05-28"]
    g = data["guidance_Q4FY26"]
    mkt = data["market"]
    hist = data["annual_history"]
    cons = data["consensus"]

    ttm = {k: sum(x[k] for x in q) for k in ("revenue", "gaap_ni", "gaap_eps",
                                             "non_gaap_eps", "ocf", "capex", "fcf")}
    fy26 = {
        "revenue": sum(x["revenue"] for x in q[1:]) + g["revenue"],
        "non_gaap_eps": sum(x["non_gaap_eps"] for x in q[1:]) + g["non_gaap_eps"],
        "fcf": sum(x["fcf"] for x in q[1:]) + g["fcf_min"],
    }
    # GAAP FY26 net income: 9M actual + Q4 approx (non-GAAP EPS less ~$0.45 SBC/other) x diluted shares
    fy26["gaap_ni"] = sum(x["gaap_ni"] for x in q[1:]) + (g["non_gaap_eps"] - 0.45) * shares_m / 1000

    mcap = price * shares_m / 1000                         # $B
    net_cash_now = bs["net_cash"]
    # cash generated in Q4FY26 is essentially in hand by valuation date
    net_cash_aug26 = net_cash_now + g["fcf_min"] - 0.15 * shares_m / 1000 - 0.3
    ev = mcap - net_cash_aug26

    multiples = {
        "Market cap ($B)": mcap,
        "Net cash, est. Aug-2026 ($B)": net_cash_aug26,
        "Enterprise value ($B)": ev,
        "P/E trailing GAAP": price / ttm["gaap_eps"],
        "P/E FY26E (non-GAAP, 3Q actual + guide)": price / fy26["non_gaap_eps"],
        "P/E FY27E consensus": price / cons["fy27_eps"],
        "P/E FY27E if EPS stalls at Q4 run-rate (4 x $30.7)": price / (4 * g["non_gaap_eps"]),
        "EV / TTM revenue": ev / ttm["revenue"],
        "EV / FY26E FCF": ev / fy26["fcf"],
        "EV / TTM FCF": ev / ttm["fcf"],
        "Price / book (May-26)": price / bs["book_value_per_share"],
        "FCF yield FY26E": fy26["fcf"] / mcap,
        "Dividend yield": mkt["annual_dividend_per_share"] / price,
    }

    # ---- lens 2: through-cycle earnings power
    if yc:
        hist = [{"fy": a["fy"], "revenue": a["revenue"], "gaap_ni": a["net_income"], "fcf": a["fcf"]}
                for a in yc["annual"] if a["quarters"] == 4]
    old = [h for h in hist if 2017 <= h["fy"] <= 2025]
    old_avg_ni = sum(h["gaap_ni"] for h in old) / len(old)
    old_avg_rev = sum(h["revenue"] for h in old) / len(old)
    old_peak_ni = max(h["gaap_ni"] for h in old)
    ncps = net_cash_aug26 / shares_m * 1000
    earnings_power = [Result(
        "Old regime (FY17-25 avg NI x 15 + net cash)",
        old_avg_ni / shares_m * 1000 * 15 + ncps,
        {"avg_ni": old_avg_ni, "avg_rev": old_avg_rev, "peak_ni": old_peak_ni})]
    for s in SCENARIOS:
        eps = s.midcycle_ni / shares_m * 1000
        earnings_power.append(Result(
            f"{s.name.split(':')[0]}: mid-cycle NI ${s.midcycle_ni:.0f}B x {s.midcycle_pe}x + net cash",
            eps * s.midcycle_pe + ncps, {"eps": eps, "pe": s.midcycle_pe}))
    ep_weighted = sum(res.value_per_share * s.prob
                      for res, s in zip(earnings_power[1:], SCENARIOS))

    # ---- lens 3: scenario DCF
    dcf = []
    for s in SCENARIOS:
        pv_explicit = pv(s.fcf, r)
        tv = s.terminal_fcf * (1 + s.terminal_growth) / (r - s.terminal_growth)
        pv_tv = tv / (1 + r) ** len(s.fcf)
        equity = pv_explicit + pv_tv + net_cash_aug26
        dcf.append(Result(s.name, equity / shares_m * 1000,
                          {"pv_explicit": pv_explicit, "pv_tv": pv_tv, "tv": tv,
                           "equity": equity, "prob": s.prob,
                           "tv_share": pv_tv / (pv_explicit + pv_tv)}))
    dcf_weighted = sum(res.value_per_share * res.detail["prob"] for res in dcf)

    # discount-rate sensitivity on the base case
    base = SCENARIOS[1]
    sens = {}
    for rr in (0.08, 0.09, 0.10, 0.11, 0.12):
        tv = base.terminal_fcf * (1 + base.terminal_growth) / (rr - base.terminal_growth)
        eq = pv(base.fcf, rr) + tv / (1 + rr) ** len(base.fcf) + net_cash_aug26
        sens[rr] = eq / shares_m * 1000

    # ---- lens 4: asset floor
    bv_now = bs["shareholders_equity"]
    bv_aug26 = bv_now + (g["non_gaap_eps"] - 0.45) * shares_m / 1000 - 0.15 * shares_m / 1000
    bv_aug27 = bv_aug26 + cons["fy27_eps"] * 0.97 * shares_m / 1000 - 0.6 * shares_m / 1000
    net_cash_aug27 = net_cash_aug26 + base.fcf[0] - 0.6 * shares_m / 1000 - 3.0
    floor = {
        "Book value / share, May-2026 (reported)": bs["book_value_per_share"],
        "Book value / share, Aug-2026E": bv_aug26 / shares_m * 1000,
        "Book value / share, Aug-2027E (consensus EPS retained)": bv_aug27 / shares_m * 1000,
        "Net cash / share, Aug-2026E": ncps,
        "Net cash / share, Aug-2027E (base-case FCF)": net_cash_aug27 / shares_m * 1000,
    }

    # ---- operating diagnostics from YCharts statements
    diag = None
    if yc:
        yq8 = yc["quarters"][:8]
        diag = [{"end": x["end"], "revenue": x["revenue"], "receivables": x["receivables"], "dso": x["dso"],
                 "inventory": x["inventory"], "inv_days": x["inv_days"], "wc_change": x["wc_change"],
                 "ni": x["net_income"], "ocf": x["ocf"], "capex": x["capex"], "da": x["da"],
                 "net_debt": x["net_debt"], "buyback": x["buyback"], "total_debt": x["total_debt"]} for x in yq8]

    # ---- margin of safety
    blended_iv = 0.5 * dcf_weighted + 0.5 * ep_weighted
    ivs = {
        "DCF, probability-weighted": dcf_weighted,
        "Earnings power, probability-weighted": ep_weighted,
        "Blended intrinsic value": blended_iv,
        "DCF base case": dcf[1].value_per_share,
        "DCF bear case": dcf[0].value_per_share,
        "DCF bull case": dcf[2].value_per_share,
    }
    mos = {k: 1 - price / v for k, v in ivs.items()}
    buy_below = {m: blended_iv * (1 - m) for m in (0.25, 0.35, 0.50)}

    return dict(ttm=ttm, fy26=fy26, multiples=multiples, earnings_power=earnings_power,
                ep_weighted=ep_weighted, dcf=dcf, dcf_weighted=dcf_weighted, sens=sens,
                floor=floor, ivs=ivs, mos=mos, buy_below=buy_below, old=old,
                net_cash_aug26=net_cash_aug26, mcap=mcap, ev=ev, ncps=ncps, diag=diag, q=q)


# ---------------------------------------------------------------- report
def report(data, res, price, r, shares_m) -> str:
    mkt, g, cons, ind = data["market"], data["guidance_Q4FY26"], data["consensus"], data["industry"]
    L = []
    P = L.append
    P(f"# Micron (MU) intrinsic value and margin of safety\n")
    P(f"*Valuation date {data['as_of']}. Price ${price:,.2f} ({mkt['price_date']} close). "
      f"Diluted shares {shares_m:,.0f}M. Discount rate {r:.0%}. $ in billions unless per share.*\n")
    if data.get("ycharts"):
        P(f"> Financial statements are from the YCharts exports in `data/ycharts/` (quarterly, through "
          f"{data['ycharts']['latest_quarter']}). Guidance, consensus, pricing data and the pre-earnings context come from "
          "Micron's press releases, TrendForce and sell-side coverage; every input is listed in `data/mu_fundamentals.json`.\n")
    else:
        P("> ycharts.com was unreachable from the analysis environment (blocked at the network "
          "egress proxy), so the inputs below come from Micron's SEC-filed press releases and 10-Qs, "
          "TrendForce, and sell-side notes. See `data/mu_fundamentals.json` for every input and its source. "
          "Run `python -m ycharts_export.scrape MU` on an unrestricted network to pull the same fields from YCharts.\n")

    P("## 1. What the business is doing right now\n")
    P("| Quarter | Revenue | Gross margin | GAAP net income | GAAP EPS | Op. cash flow | Capex | FCF |")
    P("|---|---:|---:|---:|---:|---:|---:|---:|")
    for x in res["q"]:
        P(f"| {x['fq']} ({x['end']}) | {x['revenue']:.2f} | {x['gross_margin_pct']:.1f}% | {x['gaap_ni']:.2f} | "
          f"{x['gaap_eps']:.2f} | {x['ocf']:.2f} | {x['capex']:.2f} | {x['fcf']:.2f} |")
    P(f"| Q4FY26 guide | {g['revenue']:.0f} ± {g['revenue_range']:.0f} | — | — | ~{g['non_gaap_eps']:.2f} (non-GAAP) | — | ~{g['capex']:.0f} | >{g['fcf_min']:.0f} |")
    t = res["ttm"]; f = res["fy26"]
    P(f"| **TTM (to May-26)** | **{t['revenue']:.1f}** | | **{t['gaap_ni']:.1f}** | **{t['gaap_eps']:.2f}** | **{t['ocf']:.1f}** | **{t['capex']:.1f}** | **{t['fcf']:.1f}** |")
    P(f"| **FY26E (3Q actual + guide)** | **{f['revenue']:.0f}** | | **~{f['gaap_ni']:.0f}** | **~{f['non_gaap_eps']:.0f} (non-GAAP)** | | ~{g['fy26_capex_net']:.0f} | **~{f['fcf']:.0f}** |")
    P("")
    if data.get("ycharts"):
        P("*Quarterly figures are from the YCharts income statement, balance sheet and cash-flow exports "
          "(`data/ycharts/`). Capex is gross; Micron's press releases report capex net of government "
          "incentives, which is why its 'adjusted FCF' runs ~$0.5–0.7B/quarter higher than the FCF shown here.*\n")
    P("Revenue has more than quadrupled year over year and gross margin has gone from the mid-40s to 85%. "
      "That is not volume: it is price. Every dollar of memory price increase drops almost straight to "
      "operating income, which is why net income is compounding faster than revenue. The balance sheet "
      "(May 28, 2026) shows $30.2B cash against $5.7B debt, $100.7B equity, and management points to "
      "16 strategic customer agreements worth roughly $100B of minimum contracted revenue with HBM sold "
      "out through 2026 and 2027 capacity already allocated.\n")

    P("## 2. Where the stock is priced\n")
    P("| Metric | Value |")
    P("|---|---:|")
    for k, v in res["multiples"].items():
        if "yield" in k.lower():
            P(f"| {k} | {v:.1%} |")
        elif "($B)" in k:
            P(f"| {k} | {v:,.0f} |")
        else:
            P(f"| {k} | {v:.1f}x |")
    P("")
    P(f"Sell-side mean targets sit at ${mkt['sellside_mean_target_range'][0]:,}–${mkt['sellside_mean_target_range'][1]:,} "
      f"(high ${mkt['sellside_high_target']:,}); the 52-week range is ${mkt['week52_low']:,.0f}–${mkt['week52_high']:,.0f}, "
      f"so the stock is already ~20% off its high. Peers trade at forward P/Es of ~{ind['peer_forward_pe']['SK_Hynix']}x (SK Hynix) "
      f"and ~{ind['peer_forward_pe']['Samsung']}x (Samsung), so Micron at ~{res['multiples']['P/E FY27E consensus']:.1f}x FY27 consensus is not out of line with the group.\n")
    P("The trap here is the low forward multiple. Memory stocks always look cheapest on next-year earnings "
      "at the top of the cycle, because next-year earnings are the peak. In FY2018 Micron earned $14.1B and "
      "traded at ~5x; two years later it earned $2.7B. In FY2022 it earned $8.7B; the next year it lost $5.8B. "
      "The relevant question is not what FY27 earnings are, it is what earnings look like averaged across the next "
      "full cycle, and what the market will pay for that.\n")

    P("## 3. Lens A: through-cycle earnings power\n")
    old = res["old"]
    d = res["earnings_power"][0].detail
    yc = data.get("ycharts")
    hist_rows = ([{"fy": a["fy"], "revenue": a["revenue"], "gaap_ni": a["net_income"], "fcf": a["fcf"]}
                  for a in yc["annual"] if a["quarters"] == 4 and a["fy"] >= 2010] if yc else data["annual_history"])
    P("Historical cycle from the YCharts export (fiscal years, $B):\n")
    P("| FY | " + " | ".join(str(h["fy"]) for h in hist_rows) + " |")
    P("|---|" + "---:|" * len(hist_rows))
    P("| Revenue | " + " | ".join(f"{h['revenue']:.1f}" for h in hist_rows) + " |")
    P("| Net income | " + " | ".join(f"{h['gaap_ni']:.1f}" for h in hist_rows) + " |")
    if yc:
        P("| FCF (OCF − gross capex) | " + " | ".join(f"{h['fcf']:.1f}" for h in hist_rows) + " |")
    P("")
    if yc:
        fcf_sum = sum(h["fcf"] for h in hist_rows if 2017 <= h["fy"] <= 2025)
        ni_sum = sum(h["gaap_ni"] for h in hist_rows if 2017 <= h["fy"] <= 2025)
        P(f"One thing the cash-flow statement makes brutally clear: across FY17–FY25 Micron reported ${ni_sum:.0f}B of "
          f"net income but generated only ${fcf_sum:.0f}B of free cash flow, because ~${sum(a['capex'] for a in yc['annual'] if 2017<=a['fy']<=2025):.0f}B "
          "went into fabs. Memory earnings are not the same as memory cash. That gap is why the "
          "terminal value below is struck on FCF, not net income, and why FY27 capex guidance matters as much as the revenue guide.\n")
    P(f"Average FY17–FY25 net income was ${d['avg_ni']:.1f}B on ${d['avg_rev']:.1f}B revenue; the prior peak was "
      f"${d['peak_ni']:.1f}B. FY26 will earn roughly ${f['gaap_ni']:.0f}B, about {f['gaap_ni']/d['peak_ni']:.0f}x the old peak "
      f"and {f['gaap_ni']/d['avg_ni']:.0f}x the old average. The whole valuation debate is how much of that is permanent.\n")
    P("| Normalized earnings basis | Value / share | MoS at current price |")
    P("|---|---:|---:|")
    for rr in res["earnings_power"]:
        P(f"| {rr.label} | ${rr.value_per_share:,.0f} | {1 - price / rr.value_per_share:+.0%} |")
    P(f"| **Probability-weighted (25/50/25)** | **${res['ep_weighted']:,.0f}** | **{1 - price / res['ep_weighted']:+.0%}** |")
    P("")

    P("## 4. Lens B: scenario DCF with an explicit down-cycle\n")
    P("FCF paths ($B) for FY27–FY31, terminal value on mid-cycle FCF at 3% growth, discounted at "
      f"{r:.0%}. Net cash of ~${res['net_cash_aug26']:.0f}B (May balance plus the >$30B of Q4 FCF management guided to) is added.\n")
    P("| Scenario | Prob. | FY27 | FY28 | FY29 | FY30 | FY31 | Terminal FCF | Value / share | MoS |")
    P("|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|")
    for s, rr in zip(SCENARIOS, res["dcf"]):
        P(f"| {s.name} | {s.prob:.0%} | " + " | ".join(f"{x:.0f}" for x in s.fcf) +
          f" | {s.terminal_fcf:.0f} | ${rr.value_per_share:,.0f} | {1 - price / rr.value_per_share:+.0%} |")
    P(f"| **Probability-weighted** | | | | | | | | **${res['dcf_weighted']:,.0f}** | **{1 - price / res['dcf_weighted']:+.0%}** |")
    P("")
    for s in SCENARIOS:
        P(f"- **{s.name}.** {s.story}")
    P("")
    P("Base-case sensitivity to the discount rate:\n")
    P("| Discount rate | " + " | ".join(f"{k:.0%}" for k in res["sens"]) + " |")
    P("|---|" + "---:|" * len(res["sens"]))
    P("| Value / share | " + " | ".join(f"${v:,.0f}" for v in res["sens"].values()) + " |")
    P("")
    tvs = res["dcf"][1].detail["tv_share"]
    P(f"Note that {tvs:.0%} of the base-case enterprise value is terminal value, i.e. it depends on what you "
      "believe mid-cycle FCF is after 2031. Nobody knows that number to within a factor of two, which is the "
      "honest reason the intrinsic-value range is so wide.\n")

    P("## 5. Lens C: the asset floor\n")
    P("| Item | $ / share |")
    P("|---|---:|")
    for k, v in res["floor"].items():
        P(f"| {k} | {v:,.0f} |")
    P("")
    P("The floor is real and rising fast: if consensus is even close, Micron will have roughly $270 of book "
      "value and $150 of net cash per share by the end of FY27. That is the strongest argument for the stock. "
      "It is also 70–85% below the current price, which is roughly what memory drawdowns look like "
      "(−55% in 2018–19, −50% in 2022, −90% in 2000–01). Past cycles bottomed near 1.0–1.5x book.\n")

    if res.get("diag"):
        P("## 5b. What the statements say about the quality of these earnings\n")
        P("| Quarter | Revenue | Receivables | DSO | Inventory | Inv. days | WC change | Net income | OCF | Gross capex | D&A | Net debt |")
        P("|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|")
        for x in res["diag"]:
            P(f"| {x['end']} | {x['revenue']:.1f} | {x['receivables']:.1f} | {x['dso']:.0f} | {x['inventory']:.1f} | {x['inv_days']:.0f} | "
              f"{x['wc_change']:+.1f} | {x['ni']:.1f} | {x['ocf']:.1f} | {x['capex']:.1f} | {x['da']:.1f} | {x['net_debt']:+.1f} |")
        P("")
        P("- **Inventory is not building.** Inventory has been flat at ~$8.3–8.7B for two years while revenue quadrupled; "
          "days held fell from 162 to 128. That is what a genuine shortage looks like. The first sign of the peak in every prior cycle "
          "was inventory days turning up two to three quarters before prices broke. Watch this line on Sept 30.")
        P("- **Receivables are the cost of the boom.** Receivables went from $7B to $27B in three quarters (DSO steady at ~75–78 days), "
          "which is why operating cash flow is running ~$3B below net income per quarter. Not a red flag by itself, but it means a "
          "price reversal would show up in cash (and in the balance sheet, via lower collections) faster than in the P&L.")
        P("- **Capex is about to double.** Gross capex was $19.6B in the first nine months of FY26 against D&A of only $6.9B. "
          "FY27 capex above $40B means depreciation will roughly double over 2027–29, exactly when the bear case has pricing softening. "
          "Margins compress from both ends in a downturn.")
        P("- **Balance sheet is now a fortress.** Total debt was cut from $16.2B to $6.4B in a year, and net cash is ~$20B "
          "(YCharts basis, excludes $4.3B of long-term investments) heading toward ~$50B after Q4.")
        P("- **Buybacks are token.** $1.4B repurchased over nine months against ~$26B of FCF. Management is keeping the cash for fabs, "
          "which is the right call in a shortage but tells you where the next cycle's supply is coming from.")
        P("")

    pe = data.get("pre_earnings")
    if pe:
        gq = pe["guide_q4fy26"]; cq = pe["consensus_q4fy26"]; pp = pe["price_path_2026"]
        P("## 5c. The September 30 print: what is priced in\n")
        P("| Item | Value |")
        P("|---|---|")
        P(f"| Report | {pe['report_date']}, {pe['report_time']} |")
        P(f"| Q4 guide | Rev ${gq['revenue']:.0f}B ± {gq['revenue_range']:.0f}, GM ~{gq['gross_margin_pct']:.0f}%, opex ${gq['opex']:.2f}B, EPS ${gq['non_gaap_eps']:.0f} ± {gq['eps_range']:.0f}, FCF >${gq['fcf_min']:.0f}B |")
        P(f"| Consensus | Rev ${cq['revenue']:.1f}B, EPS ${cq['eps']:.2f} (i.e. the Street already sits above the guide) |")
        P(f"| Last two EPS surprises | +{pe['recent_surprises'][0]['eps_surprise_pct']:.0f}% (Q2), +{pe['recent_surprises'][1]['eps_surprise_pct']:.0f}% (Q3); stock +{pe['recent_surprises'][1]['next_day_move_pct']:.1f}% after Q3 |")
        P(f"| Options-implied move | ~{pe['implied_move_pct_typical'].split(' ')[0]}% |")
        P(f"| Price path | ${pp['post_q3_close']:,.0f} after Q3 → ${pp['high']:,.0f} high → ${pp['late_july_low']:,.0f} late-July low → ${pp['sep_08_close']:,.2f} Sep 8 |")
        P(f"| Sell-side | {pe['analyst_ratings']['buy']} buy / {pe['analyst_ratings']['hold']} hold / {pe['analyst_ratings']['sell']} sell |")
        P(f"| Short interest | {pe['short_interest_pct_float']} |")
        P(f"| Q1 FY27 pricing backdrop (TrendForce) | server DRAM +{pe['industry_q1fy27_pricing']['server_dram_qoq_pct']}% QoQ, PC DRAM +{pe['industry_q1fy27_pricing']['pc_dram_qoq_pct']}%, NAND +{pe['industry_q1fy27_pricing']['nand_qoq_pct']}%; PC DRAM slows to +{pe['industry_q1fy27_pricing']['q4cy26_pc_dram_qoq_pct']}% the quarter after |")
        P("")
        P("**The Q4 number itself is nearly a known quantity.** Management guided to a tight ±$1B range on a quarter that "
          "was 75% contracted when they guided, and Micron has beaten its own guide every quarter of this upcycle. A beat is "
          "the base case and is already in the price; consensus sits above the guide. What moves the stock is the **Q1 FY27 guide "
          "and the FY27 capex/pricing language**:\n")
        P("- **Arithmetic for the guide.** Q4 revenue of ~$51B, plus TrendForce's Q3-calendar price increases (server DRAM +13–18%, "
          "NAND +10–15%) on roughly flat bits, points to a Q1 FY27 guide of roughly $56–60B and EPS in the mid-$30s. "
          "FY27 consensus of $155 EPS needs an average of ~$39/quarter, so a guide much below ~$35 would be read as 'the "
          "acceleration is over' even though it would be a record.")
        P("- **The word 'moderation'.** Management already said the Q4 margin outlook 'reflects a moderation in the rate of "
          "price increases'. TrendForce has PC DRAM slowing to +3–8% in calendar Q4. If Micron confirms deceleration into "
          "the February quarter, the market will start discounting the peak regardless of how good Q4 was. That is the "
          "single most likely way this print disappoints.")
        P("- **Capex.** A FY27 gross capex number of $45B+ is expected. Higher than that is bullish for 2029 share and bearish "
          "for the 2028 pricing cycle; the stock's reaction will depend on which narrative dominates that day.")
        P("- **Positioning.** 45 buys, 0 sells, a $1,295–1,515 mean target, and the stock is 20% below its high with short interest "
          "at multi-year highs. That combination produces violent moves both ways (see the +15.7% after Q3 and the trip to $740 "
          "five weeks later). Expect the realized move to exceed the ~9% the options price.")
        P("")
        P("**Event math.** Three outcomes, weighted by what the pricing data and past prints suggest:\n")
        P("| Outcome | Prob. | Typical reaction | Price next day | vs. blended IV |")
        P("|---|---:|---:|---:|---:|")
        iv = res["ivs"]["Blended intrinsic value"]
        outcomes = [("Beat + Q1 guide ≥ $58B, no moderation talk", 0.35, 0.12),
                    ("Beat + guide in the $54–58B range, 'moderation' reiterated", 0.45, -0.04),
                    ("Guide < $54B or capex shock / pricing peak signalled", 0.20, -0.18)]
        ev_move = 0.0
        for name, pr, mv in outcomes:
            px = price * (1 + mv); ev_move += pr * mv
            P(f"| {name} | {pr:.0%} | {mv:+.0%} | ${px:,.0f} | {1 - px / iv:+.0%} MoS |")
        P(f"| **Expected** | | **{ev_move:+.1%}** | **${price * (1 + ev_move):,.0f}** | |")
        P("")
        P(f"The expected one-day return on the event is roughly {ev_move:+.1%}, i.e. zero within any honest error bar. Buying the day "
          "before the print is a coin flip with a ~10–15% payoff either way on a stock that is already at fair value. That is speculation, "
          "not a margin-of-safety purchase, and nothing in the fundamentals changes on Sept 30 that isn't already visible in the pricing data.\n")

    P("## 6. Margin of safety\n")
    P("| Intrinsic value basis | Value / share | Margin of safety at $" + f"{price:,.0f}" + " |")
    P("|---|---:|---:|")
    for k, v in res["ivs"].items():
        bold = "**" if k.startswith("Blended") else ""
        P(f"| {bold}{k}{bold} | {bold}${v:,.0f}{bold} | {bold}{res['mos'][k]:+.0%}{bold} |")
    P("")
    P("Buy-below prices from the blended intrinsic value:\n")
    P("| Required margin of safety | Buy below |")
    P("|---|---:|")
    for m, v in res["buy_below"].items():
        P(f"| {m:.0%} | ${v:,.0f} |")
    P("")

    P("## 7. Conclusion: should you buy before September 30?\n")
    iv = res["ivs"]["Blended intrinsic value"]
    P(f"**No, not as a value purchase.** At ~${price:,.0f} the stock sits at fair value on a full-cycle view, the print is "
      "unlikely to change intrinsic value by more than a few percent in either direction, and the event is a ~±10–15% coin flip. "
      "Buying ahead of it is a bet on the Q1 guide, not on the business. Three ways to act on that:\n")
    P(f"1. **Wait for the print and buy weakness.** The market already offered ${data['pre_earnings']['price_path_2026']['late_july_low']:,.0f} six weeks ago on nothing "
      f"fundamental. A 'moderation' guide or a capex shock could plausibly do it again. ${res['buy_below'][0.25]:,.0f} is a 25% margin of safety on the "
      f"blended value and roughly where a disappointed market would take it; ${res['buy_below'][0.35]:,.0f}–${res['buy_below'][0.50]:,.0f} is where the bear case is covered.")
    P("2. **If you must own it into the print, size it as a trade.** A third of the intended position, with the rest reserved for a post-earnings "
      "pullback. Losing 15% on a third is survivable; losing 15% on a full position bought at fair value is a value investor's own goal.")
    P("3. **If the guide is strong and the stock gaps up 10%+,** let it go. A $1,100–1,150 price is inside the bull case's margin only if you assign "
      "the bull case more than 50% probability, and the industry data (decelerating price increases, doubling capex, China capacity) argue against that.")
    P("")
    P(f"For reference, the underlying valuation: **at ~${price:,.0f} there is no margin of safety.** The probability-weighted intrinsic value is about "
      f"${iv:,.0f}, so the stock trades within a few percent of fair value on a full-cycle view. The bull case "
      f"(${res['ivs']['DCF bull case']:,.0f}) is genuinely available, but you pay for it: the bear case is "
      f"${res['ivs']['DCF bear case']:,.0f}, roughly {1 - res['ivs']['DCF bear case']/price:.0%} lower, and the payoff is close to symmetric. "
      "A Graham-style investor wants to buy when the bear case is roughly the price, which means "
      f"~${res['buy_below'][0.50]:,.0f} or below. A less strict 25–35% cushion says ${res['buy_below'][0.35]:,.0f}–${res['buy_below'][0.25]:,.0f}.\n")
    P("What would change the answer:\n")
    P("- **Toward the bull case:** Q4 (Sept 30) beat with FY27 guidance implying >$200B revenue; HBM4 share gains; "
      "further long-term contracts converting spot-like pricing into multi-year take-or-pay; continued net-cash build to $150B+.")
    P("- **Toward the bear case:** TrendForce already shows contract-price growth decelerating (server DRAM +13–18% QoQ in Q3 vs. "
      "far larger gains earlier; PC DRAM guided to +3–8% in Q4). Citi expects prices to peak around Q2 CY2027. FY27 capex "
      "above $40B plus Samsung/SK Hynix/CXMT expansion is supply arriving in 2028 into a demand base that could be slowing. "
      "Watch inventory days, contract vs. spot spreads, and the FY27 EPS revision trend (it went $103 → $155 in 90 days; when it turns, the multiple turns with it).")
    P("")
    P("Position sizing note: this is a stock whose EPS could plausibly be $155 or $30 three years from now. "
      "Anything you own here should be sized for a 60–70% drawdown you would be willing to hold through, "
      "because the historical pattern is that the bottom arrives at 1–1.5x a much higher book value, not at a multiple of peak earnings.\n")
    P("---\n*Not investment advice. Model inputs and scenario assumptions are editable in "
      "`ycharts_export/valuation.py` and `data/mu_fundamentals.json`.*")
    return "\n".join(L)


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--ticker", default="MU")
    ap.add_argument("--data", help="fundamentals JSON (default data/<ticker>_fundamentals.json)")
    ap.add_argument("--price", type=float, help="override share price")
    ap.add_argument("--discount", type=float, default=0.10)
    ap.add_argument("--out", help="write markdown report here")
    args = ap.parse_args(argv)

    path = args.data or os.path.join("data", f"{args.ticker.lower()}_fundamentals.json")
    with open(path, encoding="utf-8") as fh:
        data = json.load(fh)
    price = args.price or data["market"]["price"]
    shares_m = data["market"]["shares_diluted_weighted_m"]
    res = run(data, price, args.discount, shares_m)
    md = report(data, res, price, args.discount, shares_m)
    if args.out:
        os.makedirs(os.path.dirname(args.out) or ".", exist_ok=True)
        with open(args.out, "w", encoding="utf-8") as fh:
            fh.write(md + "\n")
        print(f"wrote {args.out}", file=sys.stderr)
    print(md)
    return 0


if __name__ == "__main__":
    sys.exit(main())

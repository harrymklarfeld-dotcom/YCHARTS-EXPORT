# Micron (MU) intrinsic value and margin of safety

*Valuation date 2026-09-09. Price $1,000.26 (2026-09-08 close). Diluted shares 1,145M. Discount rate 10%. $ in billions unless per share.*

> ycharts.com was unreachable from the analysis environment (blocked at the network egress proxy), so the inputs below come from Micron's SEC-filed press releases and 10-Qs, TrendForce, and sell-side notes. See `data/mu_fundamentals.json` for every input and its source. Run `python -m ycharts_export.scrape MU` on an unrestricted network to pull the same fields from YCharts.

## 1. What the business is doing right now

| Quarter | Revenue | Gross margin | GAAP net income | GAAP EPS | Op. cash flow | Capex | FCF |
|---|---:|---:|---:|---:|---:|---:|---:|
| Q4FY25 (2025-08-28) | 11.32 | 44.7% | 3.20 | 2.83 | 5.73 | 4.93 | 0.80 |
| Q1FY26 (2025-11-27) | 13.64 | 56.0% | 5.24 | 4.60 | 8.41 | 4.50 | 3.90 |
| Q2FY26 (2026-02-26) | 23.86 | 73.0% | 13.79 | 12.07 | 11.90 | 5.00 | 6.90 |
| Q3FY26 (2026-05-28) | 41.46 | 84.6% | 28.24 | 24.67 | 25.39 | 7.10 | 18.30 |
| Q4FY26 guide | 50 ± 1 | — | — | ~30.73 (non-GAAP) | — | ~10 | >30 |
| **TTM (to May-26)** | **90.3** | | **50.5** | **44.17** | **51.4** | **21.5** | **29.9** |
| **FY26E (3Q actual + guide)** | **129** | | **~82** | **~73 (non-GAAP)** | | ~27 | **~59** |

Revenue has more than quadrupled year over year and gross margin has gone from the mid-40s to 85%. That is not volume: it is price. Every dollar of memory price increase drops almost straight to operating income, which is why net income is compounding faster than revenue. The balance sheet (May 28, 2026) shows $30.2B cash against $5.7B debt, $100.7B equity, and management points to 16 strategic customer agreements worth roughly $100B of minimum contracted revenue with HBM sold out through 2026 and 2027 capacity already allocated.

## 2. Where the stock is priced

| Metric | Value |
|---|---:|
| Market cap ($B) | 1,145 |
| Net cash, est. Aug-2026 ($B) | 54 |
| Enterprise value ($B) | 1,091 |
| P/E trailing GAAP | 22.6x |
| P/E FY26E (non-GAAP, 3Q actual + guide) | 13.7x |
| P/E FY27E consensus | 6.5x |
| P/E FY27E if EPS stalls at Q4 run-rate (4 x $30.7) | 8.1x |
| EV / TTM revenue | 12.1x |
| EV / FY26E FCF | 18.5x |
| EV / TTM FCF | 36.5x |
| Price / book (May-26) | 11.2x |
| FCF yield FY26E | 5.2% |
| Dividend yield | 0.1% |

Sell-side mean targets sit at $1,295–$1,515 (high $2,200); the 52-week range is $138–$1,255, so the stock is already ~20% off its high. Peers trade at forward P/Es of ~6.2x (SK Hynix) and ~4.7x (Samsung), so Micron at ~6.5x FY27 consensus is not out of line with the group.

The trap here is the low forward multiple. Memory stocks always look cheapest on next-year earnings at the top of the cycle, because next-year earnings are the peak. In FY2018 Micron earned $14.1B and traded at ~5x; two years later it earned $2.7B. In FY2022 it earned $8.7B; the next year it lost $5.8B. The relevant question is not what FY27 earnings are, it is what earnings look like averaged across the next full cycle, and what the market will pay for that.

## 3. Lens A: through-cycle earnings power

Historical cycle (fiscal years, GAAP net income $B):

| 2016 | 2017 | 2018 | 2019 | 2020 | 2021 | 2022 | 2023 | 2024 | 2025 |
|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| -0.3 | 5.1 | 14.1 | 6.3 | 2.7 | 5.9 | 8.7 | -5.8 | 0.8 | 8.5 |

Average FY17–FY25 net income was $5.1B on $25.8B revenue; the prior peak was $14.1B. FY26 will earn roughly $82B, about 6x the old peak and 16x the old average. The whole valuation debate is how much of that is permanent.

| Normalized earnings basis | Value / share | MoS at current price |
|---|---:|---:|
| Old regime (FY17-25 avg NI x 15 + net cash) | $114 | -774% |
| Bear: mid-cycle NI $35B x 12x + net cash | $414 | -142% |
| Base: mid-cycle NI $70B x 13x + net cash | $842 | -19% |
| Bull: mid-cycle NI $150B x 12x + net cash | $1,619 | +38% |
| **Probability-weighted (25/50/25)** | **$929** | **-8%** |

## 4. Lens B: scenario DCF with an explicit down-cycle

FCF paths ($B) for FY27–FY31, terminal value on mid-cycle FCF at 3% growth, discounted at 10%. Net cash of ~$54B (May balance plus the >$30B of Q4 FCF management guided to) is added.

| Scenario | Prob. | FY27 | FY28 | FY29 | FY30 | FY31 | Terminal FCF | Value / share | MoS |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| Bear: classic cycle, oversupply in CY2028 | 25% | 75 | 20 | 5 | 20 | 30 | 35 | $432 | -132% |
| Base: peak mid-CY2027, higher plateau | 50% | 130 | 95 | 50 | 60 | 70 | 70 | $884 | -13% |
| Bull: the cycle is dead | 25% | 150 | 165 | 140 | 150 | 160 | 160 | $1,830 | +45% |
| **Probability-weighted** | | | | | | | | **$1,007** | **+1%** |

- **Bear: classic cycle, oversupply in CY2028.** Contracts hold FY27, then Idaho/Korea/China capacity lands into slowing AI capex. Pricing gives back most of the 2025-27 gains; margins revert toward the FY22 level. Still a far larger business than the FY17-25 cycle.
- **Base: peak mid-CY2027, higher plateau.** Roughly the Citi view: DRAM/NAND prices crest around Q2 CY2027, FY28 is down but still huge, FY29 is the trough. HBM share and strategic customer agreements keep mid-cycle FCF ~$70B.
- **Bull: the cycle is dead.** AI memory demand compounds faster than the three-supplier oligopoly adds wafers; contracted pricing turns memory into a utility-like cash machine. FY27 consensus ($155 EPS) becomes the new normal, not the peak.

Base-case sensitivity to the discount rate:

| Discount rate | 8% | 9% | 10% | 11% | 12% |
|---|---:|---:|---:|---:|---:|
| Value / share | $1,195 | $1,014 | $884 | $787 | $711 |

Note that 67% of the base-case enterprise value is terminal value, i.e. it depends on what you believe mid-cycle FCF is after 2031. Nobody knows that number to within a factor of two, which is the honest reason the intrinsic-value range is so wide.

## 5. Lens C: the asset floor

| Item | $ / share |
|---|---:|
| Book value / share, May-2026 (reported) | 89 |
| Book value / share, Aug-2026E | 118 |
| Book value / share, Aug-2027E (consensus EPS retained) | 268 |
| Net cash / share, Aug-2026E | 47 |
| Net cash / share, Aug-2027E (base-case FCF) | 157 |

The floor is real and rising fast: if consensus is even close, Micron will have roughly $270 of book value and $150 of net cash per share by the end of FY27. That is the strongest argument for the stock. It is also 70–85% below the current price, which is roughly what memory drawdowns look like (−55% in 2018–19, −50% in 2022, −90% in 2000–01). Past cycles bottomed near 1.0–1.5x book.

## 6. Margin of safety

| Intrinsic value basis | Value / share | Margin of safety at $1,000 |
|---|---:|---:|
| DCF, probability-weighted | $1,007 | +1% |
| Earnings power, probability-weighted | $929 | -8% |
| **Blended intrinsic value** | **$968** | **-3%** |
| DCF base case | $884 | -13% |
| DCF bear case | $432 | -132% |
| DCF bull case | $1,830 | +45% |

Buy-below prices from the blended intrinsic value:

| Required margin of safety | Buy below |
|---|---:|
| 25% | $726 |
| 35% | $629 |
| 50% | $484 |

## 7. Conclusion

**At ~$1,000 there is no margin of safety.** The probability-weighted intrinsic value is about $968, so the stock trades within a few percent of fair value on a full-cycle view. The bull case ($1,830) is genuinely available, but you pay for it: the bear case is $432, roughly 57% lower, and the payoff is close to symmetric. A Graham-style investor wants to buy when the bear case is roughly the price, which means ~$484 or below. A less strict 25–35% cushion says $629–$726.

What would change the answer:

- **Toward the bull case:** Q4 (Sept 30) beat with FY27 guidance implying >$200B revenue; HBM4 share gains; further long-term contracts converting spot-like pricing into multi-year take-or-pay; continued net-cash build to $150B+.
- **Toward the bear case:** TrendForce already shows contract-price growth decelerating (server DRAM +13–18% QoQ in Q3 vs. far larger gains earlier; PC DRAM guided to +3–8% in Q4). Citi expects prices to peak around Q2 CY2027. FY27 capex above $40B plus Samsung/SK Hynix/CXMT expansion is supply arriving in 2028 into a demand base that could be slowing. Watch inventory days, contract vs. spot spreads, and the FY27 EPS revision trend (it went $103 → $155 in 90 days; when it turns, the multiple turns with it).

Position sizing note: this is a stock whose EPS could plausibly be $155 or $30 three years from now. Anything you own here should be sized for a 60–70% drawdown you would be willing to hold through, because the historical pattern is that the bottom arrives at 1–1.5x a much higher book value, not at a multiple of peak earnings.

---
*Not investment advice. Model inputs and scenario assumptions are editable in `ycharts_export/valuation.py` and `data/mu_fundamentals.json`.*

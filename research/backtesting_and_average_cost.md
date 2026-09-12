# Backtesting accumulation strategies built on average cost

*Research notes for the portfolio project, Sep 2026. The strategies described here are implemented in `portfolio/backtest.py`; run `python -m portfolio.backtest MU --start 2016-01-01` to see them on real data.*

## 1. What "average cost" strategies actually are

Every rule below is a way of deciding **how much to buy (or sell) at each point in time** given a fixed stream of money. Your average cost per share is the memory of those decisions, so it is a natural anchor for rules, but it has no information about the future: the market does not know or care what you paid.

| Strategy | Rule | What it optimizes | Known failure mode |
|---|---|---|---|
| **Lump sum** | Invest everything available today | Time in market | Bad luck on entry date; hard to do emotionally |
| **Dollar-cost averaging (DCA)** | Fixed $ every period regardless of price | Removes timing decisions; buys more shares when cheap (harmonic mean < arithmetic mean) | In a rising market, cash waiting to be invested is a drag; lump sum wins ~2/3 of the time |
| **Value averaging (Edleson, 1988)** | Hold the position to a target *value path* (e.g. +$500/month). Buy the shortfall, sell the excess | Forces "buy low, sell high" mechanically; higher IRR than DCA in most studies | Contributions become unbounded in a crash (the shortfall can be many months of income); selling triggers taxes; IRR looks good partly because of cash flow timing, not because of more money at the end |
| **DCA + buy the dip** | Regular DCA, plus an extra buy when price is X% below your average cost or Y% below the 52-week high | Adds a contrarian tilt without abandoning the schedule | Dips in a bear market keep coming; "buy the dip" ≈ "buy the falling knife" for single stocks. Requires banked cash, which is drag the rest of the time |
| **Buy below average only** | Never add above your average cost | Guarantees the average only ever falls | Locks you out of winners entirely: a stock that goes up and stays up is never bought again, so the rule systematically under-owns what works and concentrates in what has fallen |
| **Average-cost bands** | Trim a slice when price ≥ avg cost × (1+X), redeploy the cash below avg cost | Harvests volatility in range-bound names; "playing with house money" | Sells winners early; in a trending stock the trim is a permanent loss of upside, and the cash then sits idle (see the cash-drag column in the backtest) |
| **200-day moving-average filter** | Only be invested while price > 200-day MA | Avoids the worst of long bear markets; big drawdown reduction | Whipsaws in sideways markets, taxes on every exit, lower total return in most decades; the benefit is behavioral (staying the course), not alpha |

**Key point on lump sum vs DCA.** Vanguard's studies (2012 and updated 2023, "Cost averaging: invest now or temporarily hold your cash?") find that lump sum beat DCA about 68% of the time over 10-year rolling windows in the US, UK and Australia, by around 2 percentage points of final wealth, because markets go up more often than down. DCA's advantage is a lower drawdown of the *invested* portfolio and less regret. Most academic results agree ("Nobody gains from dollar cost averaging", Financial Services Review). For someone earning a salary this is mostly moot: you can only invest money as it arrives, which is DCA whether you like it or not. The decision that matters is what you do with a *windfall* (bonus, sale proceeds): the evidence says invest it, or at most spread it over 3–6 months.

**Key point on average cost itself.** Average cost matters for two real things: (1) taxes (Robinhood defaults to FIFO lots, not average cost; the ledger in `portfolio/ledger.py` computes both), and (2) it is the level where a *mental* loss becomes a *realized* one, which is why people anchor to it. Rules like "never buy above my average" are anchoring dressed up as discipline. The backtester lets you measure how much that anchoring costs on any ticker.

## 2. Backtesting hygiene (what makes a backtest lie)

1. **Survivorship bias.** Backtesting today's winners (MU, NVDA) is the biggest source of fake alpha: you already know they went up. Run the same rules on names that did not work (INTC, PYPL, DIS) and on an index (VOO) before trusting a rule. The `--replay` mode does this for your real trade history.
2. **Look-ahead.** Signals must use only data available at the close you trade on. The engine trades at the close of the signal day; a more conservative version is next-day open.
3. **Dividends.** yfinance `auto_adjust=True` gives total-return prices (dividends folded in), so the backtest is a total-return comparison. A YCharts price export is *price* return unless you export "Total Return Price".
4. **Costs and taxes.** Robinhood is commission-free, but every sell in a taxable account is a tax event. Strategies with many sells (value averaging, bands, MA filter) look better before tax than after. The `sells` column is your warning sign.
5. **Parameter overfitting.** "Buy 10% below average" vs "12% below" should give similar results. If a rule only works at one setting, it does not work.
6. **Regime dependence.** Report results by calendar year (the tables do) and across at least one full bear market (2018 Q4, 2020, 2022).
7. **Metrics.** Money-weighted return (XIRR) is the honest number for a strategy with contributions; time-weighted CAGR tells you what the *asset* did. If XIRR > TWR, your timing added value; if it is lower, it subtracted.

## 3. What the literature says about the sub-questions

* **Buy the dip vs DCA.** Studies of S&P 500 data (e.g. Nick Maggiulli's "Even God couldn't beat dollar-cost averaging", 2019) show that a perfect-foresight dip buyer, who buys only at the exact bottoms, underperforms plain DCA in most 40-year windows because cash sits idle while waiting. Realistic dip rules do worse. For single stocks the result is even less favorable because a 20% dip is often the start of a 60% one.
* **Value averaging.** Marshall (2000, 2006) confirms higher IRR than DCA but shows the ending wealth difference is small and the required cash flow is unbounded. Practical version: cap the monthly buy at 2–3x the base contribution and do not sell.
* **Trend filters.** Faber (2007, "A Quantitative Approach to Tactical Asset Allocation") shows a 10-month MA rule cut max drawdown roughly in half on the S&P 500 with similar CAGR since 1900. It works on broad indices, is much noisier on single stocks, and has underperformed buy-and-hold in the post-2009 bull market.
* **Concentration.** Bessembinder (2018) finds that 4% of stocks account for all net wealth creation in the US market since 1926; the median stock underperforms T-bills. Average-cost rules cannot fix a portfolio of the wrong names, so position sizing across holdings matters more than entry timing.

## 4. How the toolkit maps to this

| Question | Command |
|---|---|
| How did *my* trades do vs just DCA'ing the same dollars monthly? | `python -m portfolio.backtest --replay data/portfolio/snapshot.json -o reports/replay.md` |
| Which rule would have worked on X since Y? | `python -m portfolio.backtest X --start Y --amount 500 --freq M` |
| Same, on an index and a loser for bias control | `python -m portfolio.backtest VOO INTC --start 2016-01-01` |
| Sensitivity of the dip rule | `--dip-pct 5`, `--dip-pct 15`, `--dd-pct 30` |
| Interactive view | the **Backtest** tab in the dashboard (`python -m dashboard.serve`) |

## 5. Sources

* Vanguard, "Cost averaging: invest now or temporarily hold your cash?" (2023 update of the 2012 "Dollar-cost averaging just means taking risk later").
* Edleson, M. *Value Averaging: The Safe and Easy Strategy for Higher Investment Returns* (1988; Wiley 2006).
* Marshall, P. "A Statistical Comparison of Value Averaging vs. Dollar Cost Averaging and Random Investment Techniques", *Journal of Financial and Strategic Decisions* (2000).
* Faber, M. "A Quantitative Approach to Tactical Asset Allocation", *Journal of Wealth Management* (2007).
* Bessembinder, H. "Do Stocks Outperform Treasury Bills?", *Journal of Financial Economics* (2018).
* Maggiulli, N. "Even God Couldn't Beat Dollar-Cost Averaging", *Of Dollars and Data* (2019).
* "Nobody Gains from Dollar Cost Averaging: Analytical, Numerical and Empirical Results", *Financial Services Review* (https://openjournals.libs.uga.edu/fsr/article/view/3706).
* Framework survey: https://python.financial/ (vectorbt vs Backtrader vs QuantConnect, 2026). This project uses its own small engine because the strategies are cash-flow rules, not signals, and the whole run is a few thousand daily steps.

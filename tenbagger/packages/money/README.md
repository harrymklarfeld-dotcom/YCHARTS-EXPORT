# @tenbagger/money

Zero-runtime-dependency TypeScript engine behind Tenbagger's **Money hub**: one place for
liquidity vs investments vs debt, a forward-looking "can I cover the card?" check built on
real pay cycles, a plain-English scorecard, and links from each personal number to the
company metric (and lesson) it mirrors.

Principles:

- **Append-only history.** Snapshots are never edited; trends come from the log.
- **Honest labels on every number.** `verified` (statement/linked), `manual` (typed in),
  `projected` (usual schedule), `pending` (earned but conditional, e.g. hours not submitted),
  `estimate` (derived by the engine). A derived number takes its weakest input's label.
- **No invented numbers.** Paydays before `nextPayDate` are never guessed; income volatility needs
  2+ complete months; a category with too little data is left ungraded (`grade: null`).
- **Educational, not advice.** Tests scan every generated sentence for buy/sell/should/recommend.

## Install / build

```bash
cd tenbagger/packages/money
npm install          # dev deps only: typescript, vitest
npm run check        # typecheck + build + test
```

Like `@tenbagger/screener`, sources import each other with `.ts` extensions; Metro bundles `src/`
directly (mobile imports `../../../packages/money/src/index`).

## API

| Function | What it does |
|---|---|
| `projectIncome(streams, from, to)` | Dated `ExpectedDeposit`s in `[from, to]`, net of withholding, `projected` or `pending` |
| `coverageCheck(snapshot, streams, horizonDays, opts?)` | Per due date: cash now + income before − due, for pay-in-full and minimum; verdict, sentence, equation steps, daily runway |
| `netWorth(snapshot)` | Liquidity / investments / debt / net, liquidity ratio, net cash, debt-to-net-worth |
| `incomeVolatility(deposits, {asOf})`, `monthlyIncome(...)`, `debtToMonthlyIncome(...)` | History-based income metrics |
| `cardTrend(log, opts?)` | Card balance series, payments, and "paydown outrun" rebound detection |
| `scorecard(log, streams, deposits)` | Six graded categories + overall, with reasons |
| `appendSnapshot(log, snapshot)` / `buildLog(snapshots)` | Validated, frozen, append-only log (strictly increasing `takenAt`) |
| `companyAnalogies(breakdown, {monthlyFreeCashFlow})` | Personal ↔ company metric pairs with lesson ids |

### Dashboard functions (transactions, credit, investments, report)

| Function | What it does |
|---|---|
| `categorize(tx, {rules, overrides})`, `categorizeAll`, `DEFAULT_CATEGORY_RULES` | Rule-based categories: user override → provider category → first matching keyword (word-start match) → income/other. The rule map is plain data and editable |
| `spendingByCategory(txs, month)`, `compareCategories`, `spendingLeaks` | Spending (outflows minus card payments/transfers) by category; month vs prior; "leaks" = +25% and +$20 |
| `detectSubscriptions(txs)` | Same merchant, 26–35 days apart, amounts within ±15%, 3+ charges; next expected date is PROJECTED |
| `averageDailySpend`, `cashRunwayDays(cash, dailySpend)`, `spendingPace` | Runway and month pace (ESTIMATE) |
| `paymentRebounds(txs, cardId)` | Transaction-level "paydown outrun" (charges ≥ 50% of a payment within 14 days) |
| `utilization(balance, limit)`, `UTILIZATION_BANDS` | Utilization with plain-English <10% / <30% bands |
| `payoffPlan(balance, apr, monthlyPayment)`, `minimumOnlyPlan`, `requiredMonthlyPayment`, `interestAvoided`, `statementCycle` | Card math, monthly rate = APR/12 (ESTIMATE; real cards use a daily rate) |
| `netWorthSeries(snapshots)`, `netWorthChange` | Net-worth history points |
| `holdingsSummary`, `allocation`, `benchmarkComparison`, `dividendSummary`, `rothTracker`, `IRA_CONTRIBUTION_LIMITS` | Investments; the benchmark line is "same deposits into VOO" (ESTIMATE); IRA limits are dated constants with IRS sources |
| `annualizedIncome`, `pendingPayLedger`, `applyWorkLog`, goal helpers | Income extras and goals |
| `personal10K(month, data)` | Monthly income statement, balance sheet, cash-flow summary, scorecard, company analogs, share text (no account names/numbers) |
| `moneyAlerts(input)` | Ranked plain-English alerts |

`BANNED_PHRASES` also rejects lending offers (cash advance, payday loan, pre-approved, apply now,
limit increase, balance transfer, "open a card") and product picks ("best ETF", "top picks").

Dates are `YYYY-MM-DD` strings handled with integer day numbers (no `Date`, no timezone), so DST
can't shift a payday. Debt balances are positive amounts owed.

### Income rules
- hourly / per_session: `rate × unitsPerWeek × weeks per period` (weekly 1, biweekly 2,
  semimonthly 52/24, monthly 52/12). With `periodLagDays`, units come from the actual weekdays in
  the pay period instead (month-accurate).
- salary: `rate / periods per year`; other: `rate` per paycheck.
- `pendingUnsubmitted {units, periodEnd}` turns the paycheck covering that period `pending`,
  using the actual unsubmitted units.
- Monthly paydays clamp to short months (31st → Feb 28 → Mar 31). Semimonthly defaults to the
  15th and last day. `weekendRule: 'previous_business_day'` is optional.

### Coverage rules
- Cash now = checking + savings (`available` when given). Investments are never counted as spendable.
- Income counts from the day after the snapshot and strictly before the due date
  (`countSameDayDeposits` to include the due date itself).
- Due dates in the window are processed in order; earlier dues reduce later ones.
- Verdict: `covered` (full balance), `covered_minimum_only`, or `short`; `verdictWithoutPending`
  shows what happens if pending pay never lands.
- Everyday spending is excluded unless `dailySpend` is passed (then labelled ESTIMATE).

## Scorecard rubric

| Category | Measure | A | B | C | D | F |
|---|---|---|---|---|---|---|
| Net worth | net now vs first snapshot | > 0 and up > 5% | > 0, ±5% or single snapshot | > 0, down > 5% | < 0 | < 0 and below first |
| Investing | investments ÷ total assets | ≥ 50% | ≥ 25% | ≥ 10% | > 0 | none |
| Debt | debt ÷ typical monthly income | no debt | ≤ 0.5 mo | ≤ 1 mo | ≤ 2 mo | > 2 mo or no income |
| Income | CV of monthly deposit totals (2+ complete months) | ≤ 0.15 | ≤ 0.30 | ≤ 0.50 | ≤ 0.75 | > 0.75 |
| Liquidity | cash ÷ short-term debt | ≥ 2.0 or none due | ≥ 1.5 | ≥ 1.0 | ≥ 0.75 | < 0.75 |
| Spending | card trend across snapshots | down > 5% | ±5% | up > 5% | a paydown outrun | every paydown (2+) outrun |

Income is capped at B while any pay is pending. Overall = mean of graded categories on A=4…F=0
(A ≥ 3.5, B ≥ 2.5, C ≥ 1.5, D ≥ 0.5). A paydown is "outrun" when, within 14 days, new charges
win back ≥ 50% of it. Short-term debt = card balances + loan payments currently due.

## Company analogies

| Personal | Company | Lesson |
|---|---|---|
| Liquidity ratio (cash ÷ short-term debt) | Current ratio | `u5-l4` |
| Net cash (cash − all debt) | Net cash vs. net debt | `u5-l2` |
| Debt-to-net-worth | Debt-to-equity | `u5-l3` |
| Net worth = assets − debts | Assets = liabilities + equity | `u5-l1` |
| Monthly free cash flow (ESTIMATE from snapshots) | Free cash flow | `u4-l2` |

## Sample data

`tests/fixtures/alex.sample.json` is a **fictional** persona (Alex, 20, sophomore) with made-up
numbers, enriched by `node scripts/gen-sample.mjs` (seeded) with ~90 days of transactions,
month-end snapshots back to April, holdings, dividends, Roth contributions and detected streams.
The mobile app bundles an identical copy at `mobile/assets/data/money.sample.json`
(a mobile test checks they match).

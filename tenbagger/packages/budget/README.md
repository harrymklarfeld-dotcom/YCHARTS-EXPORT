# @tenbagger/budget

Zero-runtime-dependency TypeScript engine behind Tenbagger's **personal budget**: a 4-input Quick
setup that immediately answers "how much can I safely spend until payday?", plus an optional full
plan (income sources, bills, envelopes, goals, budgeting style) and ranked, explainable insights.

It reuses `@tenbagger/money` **read-only** (all imports go through `src/money.ts`): date math,
number labels, `projectIncome` (pending pay), `payoffPlan`, `pendingPayLedger`,
`detectSubscriptions`, the categorizer and the banned-phrase list.

```bash
cd tenbagger/packages/budget
npm install     # dev deps only: typescript, vitest
npm run check   # typecheck + tests
```

Mobile consumes `src/` directly (`mobile/src/budget/engine.ts` re-exports
`../../../packages/budget/src/index.ts`), same as the screener and money packages.

## Principles

- **Works without bank linking.** Manual answers are enough; linked data (`money-summary` shape)
  only sharpens it (`applyLinked`: verified balances, real statement and due date, income streams).
- **Conservative income.** Pending pay (hours not submitted) is never counted. Irregular earners are
  planned on the *lower* of their schedule and a low-but-normal month (25th percentile of complete
  months; a zero-income month counts as $0).
- **Honest labels** (`verified` / `manual` / `projected` / `pending` / `estimate`), weakest input wins.
- **Options, not advice.** Every sentence passes `findBudgetBannedPhrases` (money's list plus
  "should", "borrow", "get paid early", "sponsored", shame words). No products, securities or lenders.
- **Shame-free.** Statuses are `comfortable | tight | short` and insight tones `info | good | amber`;
  there is no "red".

## API

| Function | What it does |
|---|---|
| `quickSetup({asOf, cash, nextPayday, nextPayAmount, card?, bill?})` | 4 inputs → a working profile (40% built) |
| `emptyProfile`, `DEFAULT_CATEGORIES`, `STYLES`, `recommendStyle`, `setupProgress`, `validateProfile` | Setup helpers; endowed progress with its reason |
| `safeToSpend(profile, asOf, opts?)` | The hero number + equation lines, status, per-day, set-asides, excluded pending pay |
| `incomeBaseline(profile, asOf, {deposits?})` | Conservative monthly income (`planned`, `history_p25`, `lower_of_both`, `none`) |
| `projectedDeposits`, `toIncomeStreams`, `plannedMonthly` | Setup sources → money streams (+ stipend disbursements) |
| `buildMonthlyPlan(profile, baseline, asOf, style?)` | Buckets by style: 50/30/20 targets, zero-based to $0, pay-yourself-first, paycheck |
| `planPaychecks(profile, asOf, baseline, opts?)` | "When your $186 lands: $40 card, $25 Roth, $121 flexible" (lines sum to the paycheck) |
| `envelopes`, `envelopeHistory`, `nextCarry`, `varianceReport` | Envelopes with rollover (clamped ±1 month), plan vs actual from transactions |
| `goalTimelines`, `bufferProgress` | Months/ETA per goal (card via `payoffPlan`), buffer-month progress |
| `replan(before, after, asOf)`, `updateIncomeSource` | What changes when income changes, in sentences |
| `budgetInsights(input)` | Ranked insights with math, options, tier (free/pro) and a lesson/explainer link |
| `buildBudget({profile, asOf, linked?, workLog?, companies?})` | Everything the Budget screen needs in one call |

## Safe to spend

```
  cash now (checking; savings is the cushion and never counted)
− bills / card payment / automatic goal transfers due on or before the next PROJECTED paycheck
− set-aside: later bills (within ~a month) the paychecks before them can't fully cover
− cushion (comfort level: tight $100, balanced $75, flexible $40; editable)
= safe to spend until payday
```

- The window ends at the next **projected** paycheck. A pending paycheck neither ends the window
  nor pays anything; it is listed in `excludedPending`.
- A bill due *on* payday is paid from today's cash (paychecks can land late). A paycheck pays a bill
  only if it lands strictly before the due date (`fundObligations`, latest paycheck first).
- No paycheck expected → 14-day window, labelled `estimate`.
- A card due date already in the past rolls forward monthly using the current balance (`estimate`).
- Card payment = statement in full, unless there is a `pay_off_card` goal (then that goal's monthly
  amount, at least the minimum).

## Budgeting styles

| Style | Monthly plan | Per paycheck |
|---|---|---|
| `paycheck` (default for irregular income) | Leftover shown as "flexible" | Bills due before the next paycheck, then goals × paycheck share, rest flexible |
| `fifty_thirty_twenty` | Targets 50/30/20 of income (cents add up); savings topped up to 20% | Savings slice ≥ 20% minus card payment |
| `zero_based` | Leftover → cushion; shortfall → wants trimmed proportionally; unassigned = $0 | Same as paycheck |
| `pay_yourself_first` | max(goals, 15/10/5% by comfort) off the top; rest "free to spend" | Savings slice ≥ that rate |

## Insight types

| Type | Tier | From | Link |
|---|---|---|---|
| `safe_short` (amber, options) | free | `safeToSpend` | `/money/learn/statement-vs-due` |
| `pending_pay` "Submit your 6 hours to unlock $93 before Oct 17" | free | money `pendingPayLedger` + work log | `/money/learn/income-volatility` |
| `envelope_watch` (amber) | free | envelopes + transactions | article `your-money-like-a-10k` |
| `card_cover` | free | card obligation, money `interestAvoided` | `/money/learn/statement-vs-due` |
| `buffer_paychecks` | free | paycheck plans + `bufferProgress` | `/money/learn/emergency-fund` |
| `liquidity_ratio` "1.12× — like Costco's current ratio" | free | balances + company current ratios | `/lesson/u5-l4` |
| `fresh_start` | free | 1st–3rd of the month | article |
| `subscriptions` — **only when real transactions exist** | pro | money `detectSubscriptions` | `/lesson/u4-l2` |
| `card_payoff_faster` "$60 instead of $25 … saves $X" | pro | money `payoffPlan` | `/lesson/u5-l3` |
| `free_cash_flow` | pro | monthly plan | `/lesson/u4-l2` |
| `income_baseline` | pro | `incomeBaseline` | `/money/learn/income-volatility` |

## Sample

`tests/fixtures/alex.budget.json` is the **fictional** Alex (20, sophomore), consistent with
`money.sample.json` (same jobs, card, due date, balances, subscriptions). The mobile app bundles an
identical copy at `mobile/assets/data/budget.sample.json` (a mobile test checks they match).
`tests/fixtures/money.sample.json` is a copy of the Money hub sample used as "linked" data.

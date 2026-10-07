# Personal 10-K scorecard: evidence-based metrics and grading conditions

Prepared 2026-09-27 by the analyst agent. Read alongside `packages/money/src/scorecard.ts` (current rubric, `RUBRIC`
constant), `packages/money/README.md` ("Scorecard rubric" table) and `docs/market/PERSONAL_10K.md` (why the
scorecard is the risky, untested piece of the report). This doc does not touch code; it recommends what code should
adopt next.

**Confidence tags** (same convention as other docs): **[P]** primary (regulator/gov, standards body, dataset
publisher). **[S]** reputable secondary (established research org, press citing primary data). **[U]** unverified
(a paraphrase, industry blog, or something a search snippet described but we could not open in full).

**A note on scope.** Two families of evidence exist here and they disagree in scale, not direction: (1) whole-of-life
guidelines built for households with steady paychecks and years of savings (DeVaney, Greninger, Lytton/Garman/Porter,
CFPB QM rules), and (2) research built for exactly Tenbagger's users — irregular, thin-buffer, young (JPMorgan
Chase Institute, Financial Health Network, CFPB Financial Well-Being Scale). Recommendation throughout: keep the
academic ratio's *formula*, replace its *threshold* with the volatility- and student-aware one where they conflict.

---

## 1. Per-category recommended metric, threshold, and student adaptation

### 1. Net worth
- **Best metric:** Net worth level (assets − debts) **and** direction of change since a comparable prior point —
  current code already does both; keep it.
- **Threshold source:** No academic ratio literature grades net worth in isolation (it's a stock, not a ratio); the
  informal convention is Lytton/Garman/Porter's **solvency ratio** = net worth ÷ total assets, "technically
  insolvent" when assets < liabilities (ratio < 0) [S, cited via ERIC summary of Lytton et al. 1991,
  https://files.eric.ed.gov/fulltext/EJ1346400.pdf, retrieved 2026-09-27]. That maps directly to "negative net
  worth" already in the rubric.
- **Student adaptation:** **Do not penalize negative net worth caused by student loans/tuition debt.** No source
  says student debt should be excluded from insolvency ratios, but CFPB's own guidance to counselors explicitly
  treats federal student loan debt as "investment-like" debt against future earning power, distinct from
  consumer debt used for insolvency screening [S, CFPB Your Money Your Goals toolkin references the distinction;
  paraphrase, https://files.consumerfinance.gov/f/documents/cfpb_your-money-your-goals_debt_income_calc_tool_2018-11_ADA.pdf,
  retrieved 2026-09-27 — U for the exact wording, since we could not re-open the PDF body]. **Recommendation:**
  compute net worth two ways — "including student loans" and "excluding student loans" — and grade only the
  ex-student-loan number while showing both, so a normal sophomore with $12k in Direct Loans and $400 in a Roth
  isn't graded F on day one.

### 2. Investing
- **Best metric:** Investable-asset share of total assets (current formula), **plus** treat any Roth IRA
  contribution as a positive regardless of the account's current market value — this is a Tenbagger-specific rule,
  not from a cited source, but it follows directly from IRS contribution-limit tracking already in
  `rothTracker`/`IRA_CONTRIBUTION_LIMITS` in the same package; a contribution is a completed, real action
  independent of market swings, so grading on contribution-made rather than balance avoids punishing a student for
  a bad month in the S&P.
- **Threshold source:** No standardized "% of assets invested" grading band exists in the academic literature we
  found (Lytton/Garman/Porter's Capital Accumulation Ratio, "investment assets ÷ net worth," is the closest, target
  often cited informally as ~50% by mid-career [U, no primary threshold table located]). Current code's 50/25/10%
  bands are a reasonable, undocumented Tenbagger convention — **flag as [U] in-app**, don't imply CFPB/FHN backing.
- **Student adaptation:** For a 19–22-year-old, "0% invested" is normal, not a failing grade — Jump$tart/NEFE-style
  student guidance emphasizes *starting* (any Roth or brokerage account opened) over *allocation size*
  [U, general knowledge of Jump$tart Coalition financial-literacy standards; could not verify a specific numeric
  citation this session]. **Recommendation:** split the F band into "F: nothing invested, no account" vs. a new
  non-punitive "Building: account open, still small" band so opening a $25 Roth doesn't grade the same as never
  starting.

### 3. Debt
- **Best metric:** Debt-service framing, but the ratio that has the most authoritative backing is **debt ÷
  monthly income (debt-to-income, DTI)**, not "months of income the debt equals" phrased differently — same math,
  clearer label to reuse existing terminology.
- **Threshold source:** CFPB's own ability-to-repay/qualified-mortgage rule used **43% DTI** as the maximum
  qualifying threshold for years [P, https://files.consumerfinance.gov/f/201301_cfpb_ability-to-repay-summary.pdf,
  2013, superseded by a price-based test in 2020 but still the most-cited DTI cutoff]; separately, CFPB consumer
  guidance recommends "aim to keep your DTI at or below **36%**" as a general household health target [S, paraphrase
  from CFPB debt-to-income guidance, retrieved 2026-09-27]. These are *mortgage-affordability* ratios (monthly debt
  **payment** ÷ monthly income), not "total debt balance ÷ monthly income" as Tenbagger currently computes — the
  current metric is closer to a **debt-to-annual-income-in-months** measure, which has no equivalent standard
  threshold in the literature we found. **Recommendation:** keep the existing "months of income" framing (it's more
  intuitive for a student with a $600 card balance than a monthly-payment DTI would be, since revolving cards often
  have no fixed "payment"), but relabel it honestly as a Tenbagger convention, and add a second, standards-backed
  number for anyone with a fixed loan payment (student loan, auto): monthly payment ÷ monthly income, graded against
  the 36%/43% CFPB bands.
- **Student adaptation:** Exclude deferred/in-school student loans (payment = $0, not yet due) from the debt-service
  calculation entirely rather than grading them as debt "with no income to compare"; only count loans in active
  repayment.

### 4. Income
- **Best metric:** Coefficient of variation (CV = stdev ÷ mean) of monthly totals — current formula is sound and
  matches how JPMorgan Chase Institute characterizes volatility (they report the median worker experiences a
  **36% month-to-month income swing** [P, https://www.jpmorganchase.com/institute/news-events/despite-economic-growth-financial-volatility-remains-for-most-american-families,
  paraphrased from JPMCI "Weathering Volatility" research, retrieved 2026-09-27] — that 36% swing is roughly
  consistent with a CV in the 0.3–0.5 range for a typical volatile earner, which supports today's C/D bands rather
  than treating any volatility as a fail).
- **Threshold source / adaptation — the buffer, not just the CV:** JPMorgan Chase Institute's "Weathering
  Volatility 2.0" finds families need **~6 weeks of take-home income in liquid assets** to weather a simultaneous
  income dip and spending spike, and that **65% of families lack a sufficient buffer** [P,
  https://www.jpmorganchase.com/content/dam/jpmc/jpmorgan-chase-and-co/institute/pdf/institute-volatility-cash-buffer-report.pdf,
  October 2019, retrieved 2026-09-27]. **Recommendation:** add a second Income-adjacent metric — "weeks of essential
  spending covered" — computed as cash ÷ (weekly essential spend), graded against a 6-week JPMCI-sourced band. This
  is more actionable for an hourly/gig worker than CV alone, because CV describes the *shape* of volatility but not
  whether the buffer is enough to survive it.
- **Student adaptation:** Keep the existing rule capping the grade at B while any pay is `pending` (hours not yet
  submitted) — this is sound and has no direct external citation but matches CFPB's general principle of not
  crediting income that isn't yet realized [P, CFPB Financial Well-Being Scale user guide notes "planned" vs.
  "actual" resources should not be conflated, https://files.consumerfinance.gov/f/201512_cfpb_financial-well-being-user-guide-scale.pdf,
  December 2015, retrieved 2026-09-27]. Also explicitly **exclude irregular family support** ("my parents send money
  now and then") from the income base used for CV and the debt/income ratios — including it would understate real
  volatility for a student who can't rely on it monthly; only count support if it recurs on a fixed schedule (then
  it's a `stream` like any other, per CONTRACT.md's income-stream shape).

### 5. Liquidity
- **Best metric:** Cash ÷ short-term debt (the "personal current ratio") — matches the current-ratio analogy
  already wired to lesson `u5-l4`. Keep it, but treat it as the *short-horizon* check, and add JPMCI's buffer metric
  (above) as the *volatility-adjusted* check, since the two answer different questions (can I pay what's due right
  now vs. can I survive a bad month).
- **Threshold source:** DeVaney (1994) and Greninger et al. (1996) both anchor the classic **emergency-fund/liquidity
  ratio at 3 months of expenses** as the traditional planner recommendation, with Greninger's panel converging on
  **2.5–3 months minimum** [S, paraphrase of DeVaney 1994 "The usefulness of financial ratios as predictors of
  household insolvency" and Greninger et al. 1996, cited via https://files.eric.ed.gov/fulltext/EJ1346400.pdf,
  retrieved 2026-09-27]. That is a *stock* target (months of expenses held in cash), different from Tenbagger's
  *balance-sheet* ratio (cash ÷ currently-due short-term debt); both are legitimate and should coexist, not merge —
  the current ratio answers "can I cover what's due," the 3-month rule answers "how resilient is my cushion."
- **Student adaptation:** Substitute **weeks of essential spending**, not months of *income*, as the buffer unit —
  a student's "expenses" (rent share, food, phone) are a small, countable number, while income is the volatile,
  hard-to-average one; JPMCI's 6-week figure (above) is the number to cite, scaled down from its "months of
  expenses" cousins because it's specifically about surviving a simultaneous income/spending shock, which is the
  exact risk profile of an hourly-paid, per-session-gig student. **Recommendation band:** ≥6 weeks essential
  spending = Strong, 3–6 weeks = Building, <3 weeks = a flag (not "F" — see tone section below).

### 6. Spending
- **Best metric:** Card-balance trend + "paydown outrun" detection (current) is a good behavior signal with no
  direct academic ratio equivalent; keep it, but pair it with **credit utilization**, which has by far the
  strongest, most specific external evidence of anything in this rubric.
- **Threshold source:** FICO's own guidance: utilization above 30% starts to visibly hurt a score, and people with
  the **highest** FICO scores keep utilization **under 10%**, often in the "low single digits" [P,
  https://www.myfico.com/credit-education/blog/credit-utilization-be, retrieved 2026-09-27]. CFPB and Consumer
  Federation materials repeat the same <30%/<10% convention for consumer education [S, cross-checked against
  Experian/Chase/Credit Karma consumer explainers, retrieved 2026-09-27, all describing the same two thresholds
  independently — treated as convergent evidence]. Code already has `utilization()` / `UTILIZATION_BANDS` in
  `packages/money/src` per the README; the scorecard's "Spending" category should surface utilization, not just
  balance trend, since balance trend alone can't distinguish "I have a $50 limit and always max it" from "I have a
  $5,000 limit and use $200."
- **Student adaptation:** A first student card commonly has a **$300–$1,000 limit**, so a $150 balance is 15–50%
  utilization on a "normal" month of groceries — a much easier band to blow through than on an adult's $10k-limit
  card. **Recommendation:** grade utilization on the student's *actual* limit (already knowable from the card
  snapshot), not against an assumed "typical" limit, and note in the reason text that utilization resets each
  statement, so one heavy week isn't a permanent mark — pairs naturally with the existing "paydown outrun" language.

---

## 2. Conditions for grading at all

| Condition | Recommendation | Source / rationale |
|---|---|---|
| **Minimum data before any grade** | ≥1 snapshot for net worth/investing/liquidity (already the code's rule); ≥2 snapshots for trend-based categories (net worth change, spending); **≥60 days and 2 complete calendar months of deposit history** for Income CV — current code already requires this ("2 needed" — keep it, it's right). | JPMCI's own volatility metric is computed over rolling months, never fewer than 2 [P, JPMCI methodology described in the "Weathering Volatility" reports, retrieved 2026-09-27]. |
| **"Not enough data" vs. a grade** | Show `grade: null` with a specific, encouraging reason (code already does this for income/spending) rather than a default grade or an F. Never default an ungraded category into the GPA average — current code already excludes `null` from the GPA calc; keep this. | Matches CFPB's own scale-validity rule: the Financial Well-Being Scale explicitly cautions against scoring on incomplete item sets without adjustment [P, https://files.consumerfinance.gov/f/201512_cfpb_financial-well-being-user-guide-scale.pdf, Dec 2015]. |
| **Pending / projected income** | Keep the existing rule (income grade capped at B while any pay is pending); extend the same cap to the **debt** category, since `monthlyIncome` feeds the debt-to-income ratio — a debt ratio computed against optimistic pending income overstates capacity. | Consistent application of the "don't credit unrealized resources" principle above. |
| **Negative net worth from student loans** | Compute and grade net worth **excluding** student-loan balances in active deferment/in-school status (see §1); show the "including loans" number for transparency but do not let it set the grade. | No single source says "exclude," but this follows from (a) CFPB's investment-vs-consumer-debt distinction and (b) DESIGN_PSYCHOLOGY's shame-free design rule — an F for having a normal college loan is a false negative, not an honest signal. |
| **Volatility-aware rules for irregular income** | Below 2 complete months: no income grade. Between 2–3 months: grade, but cap at B (not enough history to trust an A). At 4+ months: no cap. Any month with a `pendingUnsubmitted` stream: cap that month's contribution or flag it, don't drop it. | JPMCI's income-spike/dip pattern shows swings cluster in 5 months out of 12 (paycheck timing, seasonal gig work) [P, JPMCI volatility report, retrieved 2026-09-27] — a 2-month window can catch an atypical spike/dip pair and should not yet earn the top grade. |
| **Confidence labels** | Reuse the existing `verified / manual / projected / pending / estimate` label system (already in README) end-to-end into the scorecard: every `Category.label` should already be the *weakest* input's label (code does this for Investing via `weakestLabel`) — extend the same `weakestLabel` call to every category, including Debt and Liquidity, which currently don't visibly surface it in the UI text. | Internal consistency rule already documented in `packages/money/README.md`; no external source needed. |
| **Family support / irregular gifts** | Exclude "now and then" transfers from any income stream used for CV, buffer-weeks, or debt-ratio math; only include if they recur on a knowable schedule (then model as a `stream`). | Judgment call, consistent with CFPB's caution against scoring on unreliable/unverifiable resources (§ above). |

---

## 3. Tone conditions

- **Grades describe categories, not the person.** Current `RUBRIC` and reason strings already avoid "you are
  bad at money" phrasing (e.g., "Nothing is in an investment account yet." not "you failed to invest") — keep
  this discipline; it matches DESIGN_PSYCHOLOGY's hard rule "celebrate behaviours, not balances" and "no red-number
  panic" (`docs/DESIGN_PSYCHOLOGY.md`, already in repo).
- **Alternative to letter grades — band labels.** Recommend testing three-word bands instead of A–F for at least the
  weakest categories: **"Building" / "Steady" / "Strong"** (or "Just starting" for zero-data states). Rationale:
  Credit Karma's own credit-factor "report card" already validates that *some* grading paradigm converts at scale
  (`docs/market/PERSONAL_10K.md` §1), but nothing in the literature we found directly tests A–F vs. word-bands for
  shame reduction in a *financial* context — **this is unverified [U]** and should not be asserted as proven; it's
  a hypothesis borrowed from the general finding that comparative, judgmental labels increase anxiety more than
  descriptive ones (general behavioral-science intuition, not a specific citation found this session).
- **Progress-vs-last-month as a primary lens.** CFPB's Financial Well-Being Scale itself is designed to be
  re-administered and tracked as a *trend* for an individual, not benchmarked against a population percentile in
  everyday use [P, https://files.consumerfinance.gov/f/201512_cfpb_financial-well-being-user-guide-scale.pdf, Dec
  2015] — supports leading the scorecard with "your liquidity moved from Building to Steady" over a static grade.
- **A/B test design to choose between letter grades and word bands:**
  1. **Cohort:** existing waitlist / campus test group, randomized 50/50 at first Personal 10-K generation.
  2. **Variant A:** current A–F grades + reason text (control). **Variant B:** three-word bands (Building/Steady/
     Strong, or a 4th "Needs a look" for the bottom band) + identical reason text, same data.
  3. **Primary metric:** 7-day return rate to the Money hub after first report (proxy for shame-driven avoidance —
     already the metric DESIGN_PSYCHOLOGY/PERSONAL_10K.md proposes for the same reason).
  4. **Secondary metrics:** self-reported reaction via a single post-report micro-survey ("How did seeing this
     feel?" 5-point scale, Positive→Negative), and share rate of the redacted card (does removing the letter grade
     change willingness to share?).
  5. **Guardrail:** compliance-scan.mjs must pass on both variants' generated strings before the test ships.
  6. **Decision rule:** ship whichever variant has equal-or-better 7-day return with no worse self-reported
     reaction; if word-bands under-perform on clarity (users can't tell what changed month over month), keep grades
     but soften copy instead.

---

## 4. Current rubric vs. recommended — side by side

| Category | Current (code today) | Recommended | What changes |
|---|---|---|---|
| Net worth | Net now vs. first snapshot, ±5% bands | Same, but compute/grade **excluding deferred student loans**; show "including loans" separately | Add student-loan carve-out; keep bands |
| Investing | Investable share of assets, 50/25/10% bands | Same share metric; **split F into "nothing yet" vs. new "Building" band for any account >$0**; count Roth contributions as positive regardless of balance | Add a non-punitive starter band; source-tag current bands as [U] Tenbagger convention |
| Debt | Total debt ÷ typical monthly income, "months of income" bands (0.5/1/2 mo) | Keep "months of income" as primary (more intuitive for revolving debt); **add a second DTI-style number** (fixed loan payment ÷ monthly income) graded against CFPB's 36%/43% [P/S] where a fixed payment exists; **exclude in-school/deferred loans** | Add CFPB-sourced fixed-payment DTI; carve out deferred loans |
| Income | CV of monthly deposits, 0.15/0.30/0.50/0.75 bands, capped at B if pending | Keep CV bands (consistent with JPMCI's ~36% median swing); **add "weeks of essential spending covered" metric** (JPMCI 6-week buffer, [P]); extend pending-income cap logic to Debt category too | Add a second, buffer-based metric; propagate pending-cap |
| Liquidity | Cash ÷ short-term debt, 2.0/1.5/1.0/0.75 bands | Keep as the "can I cover what's due" check; **add JPMCI's weeks-of-essential-spending as the resilience check**, banded at ≥6/3–6/<3 weeks | New second metric, not a replacement |
| Spending | Card balance trend + paydown-outrun detection | Keep trend/outrun logic; **add utilization graded on the card's actual limit**, <10%/<30% bands [P, FICO] | Surface `utilization()` (already built) inside the scorecard reason text |
| Tone/grading | A–F letters, `grade: null` for no data | A/B test A–F vs. Building/Steady/Strong word-bands; lead reason text with month-over-month change | Needs the test in §3, not a unilateral change |
| Data minimums | 1 snapshot (balance-sheet cats), 2 (trend cats), 2 complete months (income) | Keep all three; **add a "cap at B, not A, for 2–3 months of income history"** rule; add same cap to Debt when income is thin | New confidence-shading rule, not a new minimum |

---

## 5. Machine-readable proposed rubric

```json
{
  "version": "2026-09-27-proposed",
  "categories": [
    {
      "id": "net_worth",
      "title": "Net worth",
      "metrics": [
        { "id": "net_worth_total", "formula": "assets - debts", "excludes": ["deferred_student_loans"] },
        { "id": "net_worth_including_loans", "formula": "assets - debts", "excludes": [] }
      ],
      "bands": [
        { "grade": "A", "rule": "net_worth_total > 0 and pct_change_since_first > 0.05" },
        { "grade": "B", "rule": "net_worth_total > 0 and abs(pct_change_since_first) <= 0.05 or only_one_snapshot" },
        { "grade": "C", "rule": "net_worth_total > 0 and pct_change_since_first < -0.05" },
        { "grade": "D", "rule": "net_worth_total <= 0 and not below_first" },
        { "grade": "F", "rule": "net_worth_total <= 0 and below_first" }
      ],
      "min_data": { "snapshots": 1 },
      "sources": ["lytton_garman_porter_1991"]
    },
    {
      "id": "investing",
      "title": "Investing",
      "metrics": [{ "id": "invest_share", "formula": "investments / total_assets" }],
      "bands": [
        { "band": "Strong", "grade": "A", "rule": "invest_share >= 0.50" },
        { "band": "Steady", "grade": "B", "rule": "invest_share >= 0.25" },
        { "band": "Building", "grade": "C", "rule": "invest_share >= 0.10" },
        { "band": "Building", "grade": "D", "rule": "invest_share > 0" },
        { "band": "Just starting", "grade": "F", "rule": "invest_share == 0 and no_account" }
      ],
      "special_rule": "roth_contribution_counts_positive_regardless_of_balance",
      "min_data": { "snapshots": 1 },
      "sources": ["tenbagger_convention_unsourced_threshold"]
    },
    {
      "id": "debt",
      "title": "Debt",
      "metrics": [
        { "id": "debt_months_of_income", "formula": "total_debt / monthly_income", "excludes": ["deferred_student_loans"] },
        { "id": "fixed_payment_dti", "formula": "fixed_monthly_debt_payment / monthly_income", "applies_when": "fixed_payment_exists" }
      ],
      "bands": [
        { "grade": "A", "rule": "total_debt <= 0" },
        { "grade": "B", "rule": "debt_months_of_income <= 0.5" },
        { "grade": "C", "rule": "debt_months_of_income <= 1.0" },
        { "grade": "D", "rule": "debt_months_of_income <= 2.0" },
        { "grade": "F", "rule": "debt_months_of_income > 2.0 or income_unknown" }
      ],
      "secondary_band_source": { "dti_healthy": "<= 0.36", "dti_caution": "<= 0.43", "source": "cfpb_dti" },
      "min_data": { "snapshots": 1, "income_history_days": 60 },
      "sources": ["cfpb_ability_to_repay_2013", "cfpb_dti_guidance"]
    },
    {
      "id": "income",
      "title": "Income",
      "metrics": [
        { "id": "cv_monthly", "formula": "stdev(monthly_totals) / mean(monthly_totals)", "min_months": 2 },
        { "id": "weeks_buffer", "formula": "cash / (essential_weekly_spend)" }
      ],
      "bands": [
        { "grade": "A", "rule": "cv_monthly <= 0.15", "cap": "B if months_of_history < 4" },
        { "grade": "B", "rule": "cv_monthly <= 0.30" },
        { "grade": "C", "rule": "cv_monthly <= 0.50" },
        { "grade": "D", "rule": "cv_monthly <= 0.75" },
        { "grade": "F", "rule": "cv_monthly > 0.75" }
      ],
      "buffer_bands": [
        { "band": "Strong", "rule": "weeks_buffer >= 6" },
        { "band": "Building", "rule": "weeks_buffer >= 3" },
        { "band": "Needs a look", "rule": "weeks_buffer < 3" }
      ],
      "pending_rule": "cap_at_B_if_any_pending_unsubmitted_pay",
      "exclusions": ["irregular_family_support_not_on_fixed_schedule"],
      "min_data": { "complete_months": 2 },
      "sources": ["jpmci_weathering_volatility_2019", "jpmci_volatility_swings"]
    },
    {
      "id": "liquidity",
      "title": "Liquidity",
      "metrics": [
        { "id": "current_ratio_personal", "formula": "cash / short_term_debt" },
        { "id": "weeks_essential_spending", "formula": "cash / essential_weekly_spend", "unit": "weeks_of_essential_spending_not_months_of_income" }
      ],
      "bands": [
        { "grade": "A", "rule": "current_ratio_personal >= 2.0 or no_short_term_debt" },
        { "grade": "B", "rule": "current_ratio_personal >= 1.5" },
        { "grade": "C", "rule": "current_ratio_personal >= 1.0" },
        { "grade": "D", "rule": "current_ratio_personal >= 0.75" },
        { "grade": "F", "rule": "current_ratio_personal < 0.75" }
      ],
      "resilience_bands": [
        { "band": "Strong", "rule": "weeks_essential_spending >= 6" },
        { "band": "Building", "rule": "weeks_essential_spending >= 3" },
        { "band": "Needs a look", "rule": "weeks_essential_spending < 3" }
      ],
      "min_data": { "snapshots": 1 },
      "sources": ["devaney_1994", "greninger_1996", "jpmci_weathering_volatility_2019"]
    },
    {
      "id": "spending",
      "title": "Spending",
      "metrics": [
        { "id": "card_trend", "formula": "balance_series_across_snapshots" },
        { "id": "utilization", "formula": "card_balance / card_actual_limit" }
      ],
      "bands": [
        { "grade": "A", "rule": "balance_pct_change <= -0.05" },
        { "grade": "B", "rule": "abs(balance_pct_change) < 0.05" },
        { "grade": "C", "rule": "balance_pct_change > 0.05" },
        { "grade": "D", "rule": "rebounds_count >= 1 and rebounds_count < payments_count" },
        { "grade": "F", "rule": "payments_count >= 2 and rebounds_count == payments_count" }
      ],
      "utilization_bands": [
        { "band": "ideal", "rule": "utilization < 0.10" },
        { "band": "ok", "rule": "utilization < 0.30" },
        { "band": "high", "rule": "utilization >= 0.30" }
      ],
      "min_data": { "card_snapshots": 2 },
      "sources": ["fico_utilization_guidance"]
    }
  ],
  "min_data_global": {
    "no_grade_message": "not_enough_data",
    "income_cap_rule": "cap_grade_at_B_when_history_between_2_and_4_complete_months",
    "student_loan_rule": "exclude_deferred_or_in_school_loans_from_net_worth_and_debt_grading",
    "family_support_rule": "exclude_irregular_unscheduled_transfers_from_income_metrics"
  },
  "sources": {
    "lytton_garman_porter_1991": { "note": "solvency ratio, net worth insolvency threshold", "confidence": "S" },
    "cfpb_ability_to_repay_2013": { "url": "https://files.consumerfinance.gov/f/201301_cfpb_ability-to-repay-summary.pdf", "confidence": "P" },
    "cfpb_dti_guidance": { "note": "36% general DTI target, consumer guidance", "confidence": "S" },
    "jpmci_weathering_volatility_2019": { "url": "https://www.jpmorganchase.com/content/dam/jpmc/jpmorgan-chase-and-co/institute/pdf/institute-volatility-cash-buffer-report.pdf", "confidence": "P" },
    "jpmci_volatility_swings": { "url": "https://www.jpmorganchase.com/institute/news-events/despite-economic-growth-financial-volatility-remains-for-most-american-families", "confidence": "P" },
    "devaney_1994": { "note": "liquidity/emergency-fund ratio, 3 months of expenses", "confidence": "S" },
    "greninger_1996": { "note": "2.5-3 months minimum liquidity consensus among planners", "confidence": "S" },
    "fico_utilization_guidance": { "url": "https://www.myfico.com/credit-education/blog/credit-utilization-be", "confidence": "P" },
    "cfpb_financial_wellbeing_scale_2015": { "url": "https://files.consumerfinance.gov/f/201512_cfpb_financial-well-being-user-guide-scale.pdf", "confidence": "P" },
    "finhealth_network_8_indicators": { "url": "https://finhealthnetwork.org/about/what-is-financial-health/", "confidence": "S" },
    "tenbagger_convention_unsourced_threshold": { "note": "investing % bands, current code, not externally sourced", "confidence": "U" }
  }
}
```

---

## 6. What could not be verified

- PersonalCFO.money's or Credit Karma's exact internal thresholds (private, proprietary — already flagged [U] in
  `PERSONAL_10K.md`).
- A direct, controlled study comparing letter grades vs. word-bands for shame reduction in a *financial* app
  specifically — none found this session; the A/B test in §3 exists precisely because this gap is unfilled.
- FinHealth Score's exact numeric point values per indicator (the toolkit PDF describes ranges like "3+ months"
  and "1–5 months" but the underlying points table was not opened this session — treat FHN citations above as [S],
  paraphrase-level, not [P] exact quotes).
- Jump$tart/NEFE's specific numeric guidance for students (referenced generally; no specific citable number found
  this session — marked [U] above).

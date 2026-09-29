# Tenbagger financial model

A 36-month monthly income statement for Tenbagger, with bear, base and bull scenarios. It covers
revenue (subscriptions net of the store fee, ads, affiliate, B2B), COGS, gross profit, operating
expenses, operating income (EBIT), cash, and KPIs.

```
tenbagger/finance/
  assumptions.yaml      every driver, with a label and a source on each line
  model.py              the model: Python engine and Excel writer from one spec
  tests/test_model.py   pytest sanity checks
  out/
    Tenbagger_Model.xlsx  live-formula workbook
    summary.md            annual P&L tables, KPIs, sensitivities, 5 takeaways
    pnl_chart.csv         monthly series per scenario, for charts
```

## Editing assumptions and re-running

There are two ways to change a number.

**1. In the YAML (the source of truth).** Edit `assumptions.yaml`, then run:

```bash
python tenbagger/finance/model.py            # rebuilds out/ and cross-checks the workbook in LibreOffice
python tenbagger/finance/model.py --no-verify   # skip the LibreOffice check
python -m pytest tenbagger/finance/tests -q
```

- `drivers:` holds the **base** case. Each driver takes one line:
  `key: {v: value, unit: ..., label: "...", src: "..."}`.
- `scenarios: bear/bull` hold **overrides only**. Anything not listed there uses the base value.
- Units: `pct` is a fraction (0.15 = 15%). `month` is a model month from 1 to 36. `toggle` is 1 (on) or 0 (off).
- Switches: `ads_on`, `affiliate_on`, `b2b_on` (off by default), `llm_on`, `plaid_on`,
  `founder_salary_on` (off by default: $5k/month when on), and `soc2_on`.

You need `pyyaml` and `openpyxl`. The cross-check needs LibreOffice **Calc**
(`apt-get install libreoffice-calc`). `libreoffice-core` alone cannot open spreadsheets. If Calc is
missing, the script says so and skips the check.

**2. In the workbook.** Open `out/Tenbagger_Model.xlsx` in Excel, Google Sheets or LibreOffice and edit
the **blue cells on the Assumptions sheet**. Every monthly line, the annual P&L and the KPIs are
formulas, so they recalculate straight away.
- In the Bear and Bull columns, a black cell is the formula `=Base`, so it follows the base value.
  Type a number over it to override it.
- Workbook edits do **not** flow back into the YAML. They also do not update the Sensitivity sheet or
  `summary.md`, which `model.py` computes. To keep a change, put it in the YAML.

## What each output means

| Sheet / file | What it is |
|---|---|
| **Assumptions** | Every driver for Base, Bear and Bull, with its source. Derived values at the bottom are formulas: monthly churn from 12-month retention, install-to-paid, net factor after refunds and store fee, ad revenue per ad-seeing MAU, and variable cost per payer. |
| **Monthly_Base / _Bear / _Bull** | 36 monthly columns. Sections: installs by channel (organic/SEO, referral, creators, Apple Search Ads); the funnel from activation to trial to paid; subscribers by plan; MAU; ad, affiliate, B2B and linking volumes; revenue; COGS; OpEx; EBIT; cash; KPIs; break-even flags. Column B holds the row key used in `model.py`. |
| **Annual_PnL** | FY1–FY3 and 3-year totals for each scenario. The memo lines give the ads share of revenue, EBIT with ads switched off, cash, MAU and subscribers. |
| **KPIs** | Scale, ARPU and ARPPU, LTV, CAC by channel, LTV/CAC, payback months, break-even months, max cash need, and ads vs no ads. All of it is live. |
| **Sensitivity** | *Static values* written by `model.py`: (1) month-36 EBIT by install-to-paid × price, (2) eCPM multipliers, (3) ads on vs off, (4) a ±20% tornado on FY3 EBIT. Re-run the script to refresh them. |
| **Sources** | The `sources.json` entries cited in the YAML, plus notes on which inputs are unsourced. |
| `summary.md` | Readable tables and five plain-language takeaways. It ends with the result of the formula check. |
| `pnl_chart.csv` | Per scenario and month: installs, MAU, paid subscribers, each revenue line, COGS, gross profit, OpEx, EBIT, cash flow and cumulative cash. |

Definitions:
- **Break-even month:** the first month from which EBIT stays at or above zero through month 36. "First month with EBIT ≥ 0" is also shown.
- **Max cash need:** the deepest point of cumulative operating cash flow. It starts at $0 at launch, and annual plans are counted as paid upfront.
- **LTV:** lifetime net revenue per payer (after refunds and the 15% store fee) minus LLM and Plaid cost, at the steady-state plan mix.
- **CAC by channel:** CPI ÷ install-to-paid. Organic, SEO and referral installs carry no media cost.

## How the mechanics work

- **Installs:**
  - Organic installs grow at a fixed monthly rate.
  - Referral installs are a rate times the previous month's MAU.
  - Creator and Apple Search Ads installs are that month's budget ÷ CPI.
- **Paid conversion:** new payers = installs × activation × trial start rate × trial-to-paid (2.47% in the base case). New payers split across monthly, annual and student plans.
- **Subscribers by plan:**
  - Monthly plans churn at `1 − ret12^(1/12)` a month.
  - Annual and student plans are billed upfront. They renew 12 months later at the renewal rate. Their revenue is recognised at 1/12 a month.
- **MAU:** new free users this month, plus a retained free pool, plus paid subscribers.
  - The pool is fed by last month's free users × D30 retention.
  - The pool decays each month.
  - Paid subscribers are counted as active, so paid subscribers can never exceed MAU.
- **Revenue order:** gross in-app sales, less refunds, then the store fee on what remains. The store fee is applied once. Ads, affiliate and B2B revenue carry no store fee.
- **Cost rules:**
  - RevenueCat charges 1% of gross in-app billings above $2.5k a month. Payment processing sits inside the store fee.
  - Free users can link at most one bank (one Plaid Item). Pro users average 2.5 Items.
  - Data licensing switches from the beta tier to the scale tier once MAU passes a threshold.

## Where this differs from BENCHMARKS.md §C, and why

BENCHMARKS §C is the starting point. Its base-case conversion (2.5%), prices ($12.99 and $79.99), retention (17% and 44.1%), store fee, RevenueCat rule, data cost ($400) and hosting rule carry over. The changes:

1. **Paid acquisition is a budget, not 30% of installs at a $3.50 CPI.** A $3.50 CPI is below
   SplitMetrics' finance CPA of $13.28 [S17]. BENCHMARKS itself shows paid LTV/CAC below 1.
   - The base now runs a $500/month Apple Search Ads test at a $6 CPI, growing 3% a month.
   - Creators start in month 4 at $500/month and an $8 CPI.
   - As a result, 36-month installs are about 171k instead of 223k.
2. **MAU uses D30 retention of 12% and 8%/month decay**, instead of "25% of prior installs".
   - The 25% figure is well above the finance D30 benchmark of 2–6% [S85] and the PS gate of 7% or more.
   - The side effect: paid subscribers / MAU reaches 10.8% at month 36. That is above Duolingo's 9.2% [S3]. Either conversion is optimistic or MAU is conservative. Treat it as a warning sign, not a feature.
3. **Revenue is net of refunds and the store fee.** BENCHMARKS showed gross MRR and treated the store fee as a cost. On a gross basis the base case makes $175k of in-app sales in FY3, against BENCHMARKS' $232k. The gap is mainly change 1, plus the cheaper student plan.
4. **The plan mix now includes Student ($39.99/yr, 15%) and a $49 Recruiting Pass**, from PRODUCT_STRATEGY §4.
5. **Aggregation is costed per Plaid Item (MONEY_HUB §3)**, not per user, and it includes the free-tier bank link.
6. **New costs:** contractors, legal and compliance, insurance, tools, LLM tutor tokens and developer fees. BENCHMARKS had only $160/month of "other".
7. **Ads and affiliate revenue are modelled.** BENCHMARKS excluded them as upside.

## Honest caveats

- **Ad inputs are guesses.** Ads eCPMs, fill rate and impressions per user are marked [U]. None of them is in `sources.json`. Ads may also:
  - hurt conversion and the "serious learning" brand;
  - require age-gating (under-18s are excluded via `ad_share_free_mau`);
  - conflict with the "never promote trading" rule, which requires a strict advertiser block list.

  The "EBIT without ads" line assumes nothing else changes.
- **Affiliate inputs are guesses too.** Clicks, conversion and payout are [U]. Broker bounties may count as a "solicitation" issue, so counsel must review them. Credit offers are excluded by design.
- **Plaid prices are not public** [S89]. The $0.45 and $0.70 per-Item figures are illustrative (MONEY_HUB). Plaid is the largest COGS line in the base case, so get a quote.
- **Apple's Small Business Program is 15% only below $1M in proceeds.** The bull case passes that in FY3, and the model does not raise the rate. Web checkout after Epic v. Apple [S90][S91] is not modelled either. It could lower the fee.
- **The model leaves out several things:**
  - taxes, interest and the roughly 45-day store payout lag;
  - seasonality (earnings seasons, recruiting cycles);
  - the roughly 30% of annual plans cancelled in month 1 [S14], which is only approximated by the refund rate;
  - churn in B2B seats.
- **Unit economics are optimistic.** LTV and CAC use the steady-state mix and assume paid installs convert like organic ones, which is usually not true.
- **The Sensitivity sheet is static.** Excel data tables cannot be written portably, so `model.py` computes it.
- **No founder pay by default.** Base-case break-even does not include a salary. Set `founder_salary_on: 1` to include one.
- **Benchmarks come from search snippets.** BENCHMARKS.md itself says its figures came from search snippets. Verify every [P] and [S] figure before an investor deck.

## Verification

`model.py` writes every formula from the same Python spec that computes the numbers. It then:
1. converts the workbook with `soffice --headless --convert-to xlsx`, which forces a full recalculation;
2. compares **every formula cell** with the Python value (relative tolerance 1e-6);
3. if all match, ships the recalculated copy, so the file also carries cached values for previewers.

The result is printed and written at the end of `summary.md`. The pytest suite repeats the check when LibreOffice is installed.

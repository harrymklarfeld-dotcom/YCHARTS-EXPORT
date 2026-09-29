# Tenbagger: Does the "Personal 10-K" already exist?

Prepared 2026-09-27 by the analyst agent. Builds on `MONEY_HUB_RESEARCH.md` (Plaid feasibility, regulation,
the hybrid free/Pro plan), `MARKET_101.md` (sub-market sizing) and `DESIGN_PSYCHOLOGY.md` (Wrapped-effect
evidence, shame-free design rules). Code referenced: `tenbagger/packages/money/src/personal10K.ts` (income
statement + balance sheet + cash flow + share text), `scorecard.ts` (6-category letter-grade rubric),
`analogies.ts` (current ratio, net cash, debt-to-equity, free cash flow, balance-sheet analogies to lesson ids).

**Confidence tags** (same convention as the other docs): **[P]** primary (company page, filing, help
center, regulator). **[S]** reputable secondary (established press, known research). **[U]** unverified
(blog, review site, vendor marketing, a search-snippet we couldn't open, or our own estimate).

**Method caveat.** WebFetch was blocked by the egress proxy for `personalcfo.money` and `help.copilot.money`
(tried 2026-09-27); those two rows are built from search-engine snippets only and are tagged [U] even where
the snippet quotes the vendor's own words. Everything else was cross-checked across 2+ search results.
Nothing here is legal advice.

---

## 0. The answer in one screen

**No product combines all four pieces.** Pieces exist separately, spread across four different kinds of
app, and none of them is built by an education company:

1. **Automatic personal financial statements** (a balance sheet, sometimes a cash-flow view) — done well by
   Empower, Kubera, PocketSmith.
2. **A letter-grade "report card" on your finances** — done, but only on *credit factors*, by Credit Karma.
3. **A Wrapped-style annual/monthly recap** — done, but as a spending summary with no ratios or grades, by
   Copilot, Monarch and (open-source) Actual Budget; Monzo and Spotify proved the *format* works virally.
4. **Personal numbers explicitly written up "like a business,"** with ratios benchmarked against
   institutional norms — done by one small, low-profile app, **PersonalCFO.money** (closest single match,
   closeness **65/100**, but everything about its reach is unverified [U]).

**Nobody teaches the metric on a real company first and then unlocks it on your own numbers.** That pairing
— SEC-filing lessons plus a "Costco's current ratio vs. your liquidity ratio" callout — is the one piece we
found nowhere. It is Tenbagger's actual point of difference, not the report itself.

**Verdict:** the *report format* (income statement, balance sheet, cash flow, scorecard) is not new — every
piece has a precedent. The *company-analogy teaching loop*, and the specific combination of all four pieces
in one monthly artifact with a privacy-safe share card, is not something we found built anywhere. That is a
narrower, more testable claim than "nothing like this exists," and it is honest.

---

## 1. Existing products, scored for closeness to a "Personal 10-K"

**Closeness (0–100):** 0 = no relation. 100 = an automatic monthly income statement + balance sheet + cash
flow + letter-grade scorecard + company-benchmark captions + a redacted shareable, generated for a consumer,
built by an education-first brand. Every real product below is a fraction of that.

| Product | What it does | Closeness | Price | Reception | Source(s) |
|---|---|---|---|---|---|
| **PersonalCFO.money** | Web app that "assesses your finances like a business": models months of cash runway, flags debt-to-income / debt-to-assets / housing-cost ratios against institutional benchmarks, gives a monthly view "in 2–3 minutes," and explicitly says no bank connection is required. This is the single closest thing we found to the Personal 10-K's *ratio-benchmarking* half. | **65** | Not found in snippets [U] | No user counts, app-store rating or press coverage found; appears to be a small, low-profile indie product. Could not verify scale or reviews. | [personalcfo.money](https://personalcfo.money/) [U, WebFetch blocked, description from search snippet] |
| **Credit Karma: Credit Factors Report Card** | Under Credit → Score Details, a **letter grade on each credit factor** (utilization, payment history, age of accounts, derogatory marks, total accounts, inquiries). This is the closest precedent for Tenbagger's *scorecard* grading paradigm, but it only grades credit, not income, spending, liquidity or investing. | **40** (grading paradigm only) | Free (monetized by lead-gen: paid when you open a recommended card or loan) | Very large reach — Credit Karma is a top-3 US personal-finance app by users; no separate rating found for the report-card feature itself. | Feature described via aggregated review snippets [U]; business model per [MONEY_HUB_RESEARCH §1](../MONEY_HUB_RESEARCH.md) [P] |
| **Credit Karma: Net Worth** | Automatic net-worth aggregation (assets, debts, one number), gated to users with a credit score of 720+. No income statement, no ratios, no grades on net worth itself. | 25 | Free | Positioned as a mass-market feature inside an existing 100M+-user app. | [Credit Karma release, 2023-03-09](https://www.creditkarma.com/about/releases/credit-karma-aims-to-help-millions-of-americans-know-grow-and-protect-their-net-worth) [P]; [FinTech Futures](https://www.fintechfutures.com/fintech/us-fintech-credit-karma-launches-new-net-worth-product) [S] |
| **Empower Personal Dashboard** (formerly Personal Capital) | Free automatic net-worth dashboard: assets/debts pie chart, historical net-worth chart, cash-flow tracking, a "retirement fee analyzer" and an "allocation checkup." The best free balance-sheet-style tracker by reviewer consensus. No income statement, no letter grades, no company analogies; the free tool is a funnel into paid advisory. | **45** | Free (monetized by converting users to a paid financial-advisory service) | 4.6/5 across 4,820 reviews cited by one reviewer; widely called "the best free net worth tracker" in 2026 round-ups, with a caveat that post-rebrand UX pushes advisory upsells harder. | [ChooseFI review](https://choosefi.com/review/empower-review-the-ultimate-net-worth-tracker) [U]; [WalletHacks](https://wallethacks.com/personal-capital-review/) [U] |
| **Kubera** | Paid net-worth tracker spanning every asset class (crypto, real estate, cars, private equity, global currencies), auto-synced to 20,000+ institutions; adds estate/beneficiary planning. Balance-sheet-only: no income statement, no cash-flow summary, no grades, no company analogies. Built for complex, often high-net-worth portfolios, not students. | 35 | **$249/yr** (raised from $150), plus a $2,499/yr "Black" tier | Reviewers call it the best tracker for complex, multi-asset portfolios; explicitly "overkill" for a simple bank + brokerage user. | [The College Investor](https://thecollegeinvestor.com/36895/kubera-review/) [U]; [WallStreetZen](https://www.wallstreetzen.com/blog/kubera-app-review/) [U] |
| **PocketSmith** | Automatic net worth **plus** a calendar-based cash-flow forecast projected up to 30 years (net worth up to 60 years) from real transaction history — the strongest *forward-looking* balance sheet plus cash-flow combination we found. No income-statement framing, no letter grades, no company analogies. | **40** | Free tier (2 manual accounts); **$9.95/mo** Foundation, **$19.95/mo** Premium, **$29.95/mo** SuperMoney | Reviewers like the forecasting; the tiered step-pricing is repeatedly criticized ("5-star product with one-star pricing"). | [The CFO Club](https://thecfoclub.com/tools/pocketsmith-review/) [U]; [MoneyWise](https://moneywise.com/investing/reviews/pocketsmith) [U] |
| **Tiller Money** | Spreadsheet-based: auto-imports transactions into Google Sheets/Excel templates, including budget, debt-payoff and net-worth sheets. A user *could* hand-build an income statement and balance sheet with Tiller's templates, but nothing is automatic, there's no scorecard, and there's no mobile app. | 30 | **$79/yr**, no free tier, 30-day trial | Loved by spreadsheet enthusiasts; reviewers note its price edge over YNAB/Monarch has shrunk as it approaches their price points. | [Tiller pricing](https://sheetlink.app/tiller-money-pricing-2026) [U]; [FinCompareLab](https://www.fincomparelab.com/reviews/tiller-money-review/) [U] |
| **Copilot Money: Month and Year in Review** | A built-in recap (per Copilot's own help center) summarizing the month/year of spending and cash flow inside the app. No balance sheet, no letter grades, no company analogies, and (per MONEY_HUB_RESEARCH) the app's own cash-flow tab explicitly ignores future/unpaid items. | **35** | $13/mo or $95/yr (see MONEY_HUB_RESEARCH) | Apple Design Award finalist 2024 for the app generally; the recap feature itself has no separate review coverage found. | [Copilot help center: Month and Year in Review](https://help.copilot.money/en/articles/10310024-month-and-year-in-review) [U, WebFetch blocked, title/description from search snippet] |
| **Monarch: recap / Monarch Plus forecasting** | Recurring-bill detection, and (since April 2026) multi-year net-worth and cash-flow forecasting in the Plus tier. No income-statement framing, no letter grades, no company analogies. Already covered in MONEY_HUB_RESEARCH §1. | 30 | $14.99/mo or $99.99/yr; Plus **$199/yr** | Popular Mint-refugee destination (~20x user growth after Mint's shutdown per an earlier snippet). | See `MONEY_HUB_RESEARCH.md` row |
| **Monzo: "Year in Monzo"** | An annual, Spotify-Wrapped-style recap of spending categories and habits, built for sharing. Pure spending recap — no balance sheet, no ratios, no grades, no company analogies. Proves the *format* (annual recap, shareable) works for a bank brand. | 30 | Free (bank feature) | Cited in `DESIGN_PSYCHOLOGY.md` as a friendly-voice, shame-low recap model. | [Monzo: Year in Monzo 2025](https://monzo.com/help/year-in-monzo-2025) [P] |
| **Actual Budget: "Actual Budget Wrapped 2025"** | Open-source budgeting tool's own Spotify-Wrapped-style annual recap: biggest spending categories, income trend, transaction count. Same category as Monzo's recap: no statements, no grades, no company analogies. | 25 | Free / open source | Community project; no adoption numbers found. | [Actual Budget blog](https://actualbudget.org/blog/actual-budget-wrapped-2025/) [U] |
| **YNAB: Age of Money** | A single number (average days between earning and spending a dollar) that functions like one ratio on a personal balance sheet, with an explicit irregular-income philosophy. No full statements, no scorecard, no company analogies. Already covered in MONEY_HUB_RESEARCH. | 20 | $14.99/mo or $109/yr (12 months free for students) | Long-standing, well-reviewed budgeting method; cult following among "zero-based budget" users. | See `MONEY_HUB_RESEARCH.md` row |
| **Origin** | Net worth, budgeting, multi-year life-event forecasting, and (Sept 2025) an SEC-registered AI financial advisor. Forecasts life events over years but does not frame numbers as financial statements, does not grade, and (crucially) crosses into regulated advice, which Tenbagger's rules forbid. | 20 | ~$12.99/mo or $99/yr | Positioned as a premium "does it all" app; the AI-advisor claim generated press coverage. | See `MONEY_HUB_RESEARCH.md` row |
| **Cleo** | Chat-based "roast" budgeting aimed at Gen Z, plus cash advances. Conversational, not statement-based; no balance sheet, no scorecard, no company analogies. Already covered in MONEY_HUB_RESEARCH, including its **$17M FTC settlement (2025-03-27)**. | 20 | Plus $5.99/mo, Builder $14.99/mo | Popular with Gen Z for tone; regulatory record is a red flag (see MONEY_HUB_RESEARCH §4). | See `MONEY_HUB_RESEARCH.md` row |
| **Experian Boost** | Adds verified bill payments to a credit file to raise a FICO score; no report-card framing, no financial statements. Included only to confirm the credit bureaus' "report card" instinct stops at the score itself. | 10 | Free | Average +13-point FICO boost claimed by Experian. | [Forbes Advisor](https://www.forbes.com/advisor/credit-score/experian-boost-review/) [U] |
| **Rocket Money, Chase, Venmo, Robinhood, Wealthfront, Chime, Revolut** | Searched specifically for a "Wrapped"/year-in-review feature at each. **None was found** beyond Chase's plain "Year End Summary" and "Spend Report" (a transaction list/PDF, no ratios, no recap narrative, no sharing) and Robinhood's portfolio "Digests" (AI summaries of holdings, not a personal-financial-statement format). Absence, not confirmation of non-existence — treat as [U]. | 5–15 each | Varies | n/a | [Chase Year End Summary](https://www.chase.com/personal/credit-cards/year-end-summary) [P]; searches for Venmo/Robinhood/Wealthfront/Chime/Revolut wrapped features returned nothing on point [U] |
| **"CFO of Your Life" (media trope) / "Run Your Household Like a Business" playbook / personalprofitability.com guide** | Not apps — a recurring *article and course* genre (NBC News, personal-finance bloggers, a $-priced Gumroad Excel template) that manually walks someone through building their own income statement and balance sheet. Confirms real demand for the metaphor, with **zero automation** and no company-comparison teaching loop. | 15 (concept only, no product) | Free–low-cost content | n/a, not an app | [NBC News: "How to become CFO of your life"](https://www.nbcnews.com/news/amp/wbna52264840) [S]; [personalprofitability.com](https://personalprofitability.com/personal-financial-statements/) [U] |
| **AI money coaches generally (Cleo, Origin, MoneyLion-type apps, ChatGPT Finances)** | Conversational or dashboard-style guidance on request; ChatGPT Finances (per MONEY_HUB_RESEARCH) shows upcoming payments and answers scenario questions when asked, but does not generate a standing monthly "financial statements" artifact or grade anything. | 20 | Varies / included in ChatGPT Pro then Plus | See MONEY_HUB_RESEARCH row for ChatGPT Finances. | See `MONEY_HUB_RESEARCH.md` |
| **Education apps applying company metrics to personal finance** | We searched directly for this pairing and found **none**. The closest hits were generic "treat your finances like a business" content (above) with no company-comparison mechanic, and no finance-education app (Duolingo Finance-style courses, Zogo, EVERFI, Practical Money Skills) was found teaching a ratio *on a real public company* and then applying it to the learner's *own* numbers. This is the gap Tenbagger's `analogies.ts` already fills in code. | 0 (not found) | n/a | n/a | Search performed 2026-09-27; no on-point result [U, absence] |

---

## 2. Honest verdict: what's genuinely new vs. already done

**Already done, well, by someone else:**
- Automatic net worth / balance-sheet tracking (Empower, Kubera, PocketSmith) — commoditized, several are free.
- Forward cash-flow forecasting (PocketSmith, Monarch Plus) — a solved problem at the "will I have enough" level, though not at the "due-date coverage from irregular pay" level (see MONEY_HUB_RESEARCH §1's specific gap).
- A letter-grade "report card" feel — Credit Karma proved this works and scales, but only for credit factors.
- A Wrapped-style annual recap that people share — Monzo and Spotify proved the format; Copilot and Actual Budget ship monthly/annual recaps already.
- Framing your own numbers "like a business" — a real, if tiny and unverified, niche (PersonalCFO.money) and a well-worn content genre (the "CFO of your life" articles).

**Not found anywhere, and this is the actual bet:**
1. **The teach-then-unlock loop.** Learning a metric on a real SEC filing (Costco's current ratio) and then instantly seeing the same metric computed on your own numbers, with a link back to the lesson. This is the one mechanic no competitor — PFM, aggregator, credit bureau or AI coach — has, because none of them teaches.
2. **All four report pieces in one artifact, monthly, automatically:** income statement + balance sheet + cash-flow summary + a 6-category letter-grade scorecard + company-benchmark captions. Every competitor above ships at most two of these five elements.
3. **A share card that is Wrapped-style but never shows a dollar amount or a return** — Monzo and Spotify's recaps *are* the numbers; Tenbagger's would redact them by design. This is a genuinely different design choice, not just a smaller feature set, and it directly serves the compliance rule against implying advice or returns.

So: the report *format* is not new. The **teaching mechanic wrapped around it**, and the **specific combination + redacted-share design**, is new as far as this search could tell. That is a narrower and more honest claim than "nobody does a Personal 10-K" — pieces of it exist in at least six places.

---

## 3. Why it could win, why it could flop, and the smallest version worth testing

### Why it could win
- **The Wrapped effect is real and getting stronger, not weaker.** Spotify Wrapped 2025: 200M engaged users in 24 hours (+19% YoY), 500M shares day one (+41% YoY) [S, cited in DESIGN_PSYCHOLOGY]. Monzo and Actual Budget both shipped their own versions in the same window, meaning the appetite for a personal annual recap is now a category expectation, not a novelty — Tenbagger doesn't have to invent demand, only differentiate the artifact.
- **Credit Karma proves the "report card" instinct converts to habitual use at scale**, even on a narrow slice (credit factors only). A scorecard covering net worth, investing, debt, income, liquidity and spending is a strict superset of that idea.
- **The teaching hook is genuinely defensible.** MONEY_HUB_RESEARCH already argues that "learn it, then see it on you" is the retention mechanic that makes the money hub different from "Rocket Money with homework" — this doc confirms no competitor, including PersonalCFO.money, pairs company education with personal ratios.
- **Money-shame reduction is well-evidenced as a design lever** (DESIGN_PSYCHOLOGY §2.1, §12): 59% of Gen Z report money stress/anxiety [S]; framing a balance sheet "like a 10-K" and redacting the share card both directly target that anxiety rather than amplifying it with a bare number or a public dollar figure.

### Why it could flop (and the evidence for each risk)
- **A grade can read as judgment, not clarity — the opposite of the shame-free goal.** DESIGN_PSYCHOLOGY's hard rule is "no red-number panic" and "celebrate behaviours, not balances"; a scorecard with a D or F is exactly the kind of artifact that could violate that rule if the copy isn't extremely careful. Untested.
- **The "you're okay" or "you're a B-" claim carries the Hello Digit precedent risk**: CFPB action in 2022 against an algorithm that promised safety and got it wrong (cited in MONEY_HUB_RESEARCH §4) [P]. A grade is a stronger, more publishable claim than a raw number, so it raises this bar rather than lowering it.
- **Redacted sharing is an unproven trade-off.** Every viral recap we found (Spotify, Monzo, Actual Budget) shares the *actual numbers* — that specificity may be exactly what makes them shareable and relatable. A card that only shows "Liquidity: B+" might be less compelling to share than "$1,240 in card debt," precisely because it protects privacy. This needs a real A/B test, not an assumption.
- **Build cost is real and the code already reflects it.** `personal10K.ts` requires snapshot history (a balance sheet needs at least one snapshot; a trend needs two) and categorized transactions — i.e., linked accounts or diligent manual entry — which is a much higher bar than a one-off spending recap. MONEY_HUB_RESEARCH's Plaid cost analysis (§3) applies directly here: a monthly report is not free to generate at scale.
- **The company-analogy device could read as gimmicky** to a user focused on "can I make rent," especially attached to a poor grade ("your liquidity is worse than Carnival's in 2020" could land as mockery rather than insight if copy isn't tested).

### The smallest version worth testing
The building blocks already exist in code (`personal10K.ts`, `scorecard.ts`, `analogies.ts`), so the cheapest test is not a new build — it's an experiment on what's already there:

1. Ship the existing `personal10K()` monthly report **plus one company analogy plus the redacted share card** to a small cohort (existing waitlist or a campus test group), gated behind manual entry only (no new Plaid spend).
2. Track three things before building the teach-then-unlock lesson loop:
   - **Completion rate** of a first Personal 10-K (does anyone finish generating and reading it?).
   - **Share rate** of the redacted card, and whether viewers of a shared card ask "what does that ratio mean" (a proxy for whether redaction kills or preserves shareability).
   - **A/B on grade tone**: does a D/F category with today's copy reduce next-week opens (a shame signal) compared with a neutral-tone variant that states the number without a letter grade? This directly tests the biggest identified risk before the scorecard becomes a permanent, prominent UI element.
3. Only after that: build the "learn a metric on a company, then unlock it on yourself" lesson linkage (already scaffolded via `lessonId` in `analogies.ts`), because that is the one piece with no precedent and the one most worth protecting from a rushed launch.

# Tenbagger: Money Hub Research ("Read your own finances like a 10-K")

Prepared 2026-09-25 by the analyst agent. It builds on `PRODUCT_STRATEGY.md`, `BENCHMARKS.md` and `DATA_STRATEGY.md`, and it partly reverses one of their decisions (brokerage and bank linking had been deferred to v2; see §5 and §6).

**Confidence tags** (same as the other docs):
- **[P]** Primary: a filing, company page or help center, court filing, regulator or statistical-agency release.
- **[S]** Reputable secondary: established press or a known research publisher.
- **[U]** Unverified: a blog, review or comparison site, a vendor marketing page, a search-snippet summary we could not match to a primary page, or our own estimate.

**Method caveat.** WebFetch was **blocked by the egress proxy** for `federalreserve.gov` and `plaid.com` (tried 2026-09-25). Every figure below therefore comes from **search-engine snippets** of the linked page, all accessed 2026-09-25. Where a snippet quotes a primary page (for example a Fed or FTC URL), the tag is [P], but the exact wording should be checked by opening the link before any figure goes in a deck. Where the source date differs from the access date, it is given. Nothing here is legal advice. §4 lists the points that need counsel.

---

## 0. The answer in one screen

- **The gap is real and narrow.** Every incumbent predicts income **from past deposits**:
  - Plaid recurring streams
  - Monarch and Copilot "recurrings"
  - PocketGuard "In My Pocket"
  - Rocket Money's "left to spend"

  None of them models income that **depends on something the user still has to do**, such as submitting hours or filing a tutoring session report. None of them tests the specific question "will cash plus expected pay cover my **statement balance** by the **due date**?". None of them teaches.

  The students who need this are underserved in two ways. The cash-advance apps (Dave, Brigit, Cleo, EarnIn) target them but monetise through fees that regulators have repeatedly challenged. The good forecasting apps (Monarch, Copilot, YNAB) are $95–$199 a year and built for salaried households.
- **The persona is large.**
  - 16.2M undergraduates were enrolled in fall 2025.
  - 40% of full-time undergraduates work, and about 70% of all students work.
  - 57% of college students had a credit card, with an average balance of $1,423 (2019 data).
  - 30% of US adults have income that varies, and 11% struggled to pay bills because of it (SHED 2025).
- **Plaid can support it, but the feed costs money on every linked user.** `/transactions/recurring/get` returns inflow streams with `predicted_next_date`. A stream needs 3 occurrences to be `MATURE` and has an `EARLY_DETECTION` state before that. `/liabilities/get` returns `next_payment_due_date`, `minimum_payment_amount` and `last_statement_balance`.

  Transactions, Liabilities and Investments are all **monthly subscription fees per Item**, and the prices are not public. A free hub that links 3 institutions per user costs real money on every free user.
- **Regulation:** a coverage forecast of *your own* cash is not securities advice. The real risks are:
  - UDAP accuracy (the FTC's "deceptive" standard)
  - GLBA Safeguards obligations
  - **any temptation to offer advances.** The FTC, DOJ, DC and Baltimore cases against Dave, Brigit, Cleo and EarnIn show that the lending line is where the danger is.
- **Recommendation: a hybrid.**
  - **Free:** a "Due-Date Check" hook (manual entry plus 1 linked institution, with a daily "am I okay?" status) and the core lessons.
  - **Pro:** unlimited linking, forecast alerts, the Personal 10-K scorecard history, and the full screener and lessons.
  - **Retention mechanic:** *learn a metric on a company, then unlock it on your own finances.*

  This keeps the education brand while earning the daily opens that finance lessons alone may not.

---

## 1. Who already does forward cash flow, "safe to spend" or due-date coverage

**Column key:**
- **Fwd?** Does it project forward (future balance, safe-to-spend after upcoming bills)?
- **Irregular income?** Does it cope with income that arrives at uneven times and amounts?
- **Student?** Is there an explicit student offer or positioning?

| Product | What it does | Fwd? | Irregular income? | Student? | Price | Source(s) |
|---|---|---|---|---|---|---|
| **Simple** "Safe-to-Spend" | Bank balance minus scheduled bills and goals. The pioneer of the idea. | Yes, simple | Partly. It netted out goals and bills, not predicted pay. | No | Free (bank). **Dead**: BBVA shut Simple in 2021; users "lost access to … the safe-to-spend balance". | [TechCrunch 2021-01-07](https://techcrunch.com/2021/01/07/bbva-says-that-it-is-shutting-down-banking-app-simple-will-transfer-users-to-bbva-usa/) [S]; [DebtPayoffTools](https://debtpayofftools.com/comparisons/what-happened-to-simple/) [U] |
| **Copilot Money** | Predictive "Recurrings" are built into the month's "Spent" total. | **Weak.** The Cash Flow tab "only looks at what happened up until today, and doesn't take into account any unpaid Recurrings or future transactions." | No. It detects recurrings from history. | No student discount found | $13/mo or $95/yr, no free tier; iOS plus web (Dec 2025) | [Copilot help: Cash Flow tab](https://help.copilot.money/en/articles/9682232-cash-flow-tab-overview) [P]; [Finny pricing](https://getfinny.app/blog/copilot-money-pricing-2026) [U]; forecasting is an open [feature request](https://copilot.canny.io/feature-requests/p/forecasting-1) [P] |
| **Monarch** | Recurring detection (reviewers say about 80% of bills). Balance projection. Multi-year net-worth and cash-flow forecasting in **Monarch Plus** (launched April 2026). | Yes | Partly. Recurrings can miss bills "if the amount or the billing date varies". | Student discount through SheerID | $14.99/mo or $99.99/yr; Plus **$199/yr** [U] | [Monarch help: Forecasting](https://help.monarch.com/hc/en-us/articles/48344305092244-Forecasting-in-Monarch) [P]; [Monarch Plus blog](https://www.monarch.com/blog/monarch-plus) [P]; [Penny Hoarder review](https://www.thepennyhoarder.com/budgeting/monarch-money-review/) [S]; [Monarch discounts](https://help.monarch.com/hc/en-us/articles/360048883891-Discounts-and-Promotions) [P] |
| **YNAB** | Zero-based budgeting. **Age of Money** is the average number of days between earning a dollar and spending it, over the last 10 outflows. | Implicit: you budget only money you already have. It has a strong irregular-income method. | **Yes, philosophically** ("budget what you have") | **12 months free for college students** | $14.99/mo or $109/yr | [YNAB Age of Money](https://support.ynab.com/en_us/age-of-money-H1ZS84W1s) [P]; [YNAB pricing](https://www.ynab.com/pricing) [P]; [YNAB irregular income guide](https://www.ynab.com/guide/irregular-income) [P] |
| **Rocket Money** | Subscription tracking, upcoming bills, low-balance alert (default $200), "left over" after bills and card payments before next payday. | Yes, near-term | Detects from history | No | Free tier; Premium is "pay what's fair" at $7–14/mo | [Rocket Money pricing](https://www.rocketmoney.com/learn/personal-finance/how-much-does-rocket-money-cost) [P]; [Low-balance alert help](https://help.rocketmoney.com/en/articles/8418019-how-to-customize-a-low-balance-alert) [P] |
| **PocketGuard** | **"In My Pocket" / "Leftover"**: income − bills − budgets − goals. | Yes, to the next income | Detects recurring income. Weak when pay is lumpy. | No | Free, capped at 2 institutions; Plus $12.99/mo or $74.99/yr | [PocketGuard help: Leftover](https://help.pocketguard.com/hc/en-us/articles/360002167320-Leftover) [P]; [WalletGrower](https://walletgrower.com/budgeting/reviews/pocketguard) [U] |
| **Cleo** | Chat-based "roast" budgeting plus **cash advances** of $150–$500. Positioned at Gen Z. | Some | Advances are based on "accrued, unpaid income" | **Gen Z positioning** | Plus $5.99/mo, Builder $14.99/mo, plus express fees of $3.99–9.99 | [Cleo pricing](https://web.meetcleo.com/pricing) [P]; [FinCompareLab](https://www.fincomparelab.com/guides/cleo-pricing/) [U]. **FTC settlement of $17M, 2025-03-27** ([FTC case page](https://www.ftc.gov/legal-library/browse/cases-proceedings/cleo-ai-inc-ftc-v) [P]) |
| **Brigit** | Low-balance prediction plus cash advances. Aimed at people living paycheck to paycheck. | Yes (overdraft prediction) | Yes. This is its core market. | No | $9.99/mo membership plus a $0.99 instant fee (at the time of the FTC case) | [FTC 2023-11 press release: $18M refunds](https://www.ftc.gov/news-events/news/press-releases/2023/11/ftc-action-leads-18-million-refunds-brigit-consumers-harmed-deceptive-promises-about-cash-advances) [P] |
| **Dave** | ExtraCash advances plus banking. | Some | Yes | No | $1/mo membership, then a new fee structure without tips or express fees (announced 2024-12-31) | [Dave IR 2024-12-31](https://investors.dave.com/news-releases/news-release-details/dave-issues-statement-response-amended-ftc-complaint-and) [P]; FTC/DOJ case (§4) |
| **EarnIn** | "Cash Out" earned-wage access with tips and "Lightning Speed" fees of $3.99 or $5.99. | Pay-cycle based | **Yes.** It is built on hours worked. | No | Tips plus fees | [DC OAG release](https://oag.dc.gov/release/attorney-general-schwalb-sues-pay-advance-company) [P] |
| **Chime** | Get Paid Early (up to 2 days early), SpotMe overdraft (up to $200), MyPay advances (up to $500; $2–5 for instant delivery). | No forecasting as such | Advances are sized on direct-deposit history | No | Free checking; fees on instant MyPay | [Chime MyPay](https://www.chime.com/early-pay/mypay/) [P]; [Chime blog](https://www.chime.com/blog/chime-mypay-vs-spotme-vs-get-paid-early/) [P] |
| **Digit / Oportun Set & Save** | An algorithm sweeps "safe" amounts into savings. | Implicitly (it predicts what is safe to move) | Yes | No | $5/mo. Oportun bought Digit for about $211M in Dec 2021. **CFPB 2022 action**: the algorithm caused overdrafts. | [Oportun 8-K](https://www.sec.gov/Archives/edgar/data/1538716/000153871621000248/pressrelease12-22x21.htm) [P]; [CFPB v. Hello Digit](https://www.consumerfinance.gov/about-us/newsroom/cfpb-takes-action-against-hello-digit-for-lying-to-consumers-about-its-automated-savings-algorithm/) [P] |
| **Tally** | Credit-card payoff automation using a line of credit. | Card due dates, yes | No | No | **Dead**: shut down in August 2024 after raising $172M | [TechCrunch 2024-08-12](https://techcrunch.com/2024/08/12/a16z-backed-fintech-tally-which-raised-172m-in-funding-is-shutting-down-after-running-out-of-cash) [S] |
| **Albert** | Budgeting, "Genius" guidance, Instant Advance ($25–$1,000). | Some | Some | No | Genius $14.99–39.99/mo (reports vary) | [LendEDU](https://lendedu.com/blog/albert-review/) [U]; [FinCompareLab](https://www.fincomparelab.com/reviews/albert-review/) [U] |
| **EveryDollar** | Ramsey zero-based budget, paycheck planning (Premium). | Plan-based | Manual paycheck planning | No | Free (manual entry); Premium $79.99/yr or $17.99/mo | [Ramsey EveryDollar](https://www.ramseysolutions.com/money/everydollar) [P]; [LendEDU](https://lendedu.com/blog/everydollar-review/) [U] |
| **Origin** | Net worth, budgeting, life-event forecasting, and an **SEC-registered AI advisor** (Sept 2025). | Yes (life events, over years) | No | No | about $12.99/mo or $99/yr | [BusinessWire 2025-09-09](https://www.businesswire.com/news/home/20250909759834/en/Origin-Unveils-First-AI-Financial-Advisor-Regulated-by-the-SEC-Outsmarts-Every-Leading-AI-Model-on-the-CFP-Exam) [P]; [Benzinga](https://www.benzinga.com/money/origin-financial-review) [S] |
| **Credit Karma** (took in Mint in March 2024) | Credit score, net worth, basic cash flow. | No | No | No | Free (paid by lead generation) | [Credit Karma release](https://www.creditkarma.com/about/releases/intuit-credit-karma-welcomes-all-minters) [P]; [Wallet Hacks](https://wallethacks.com/migrating-from-mint-to-credit-karma-it-was-not-good/) [U] |
| **ChatGPT Finances** (new entrant) | Plaid-linked dashboard: portfolio, spending, subscriptions, **upcoming payments**, scenario Q&A. | Partly (on request) | On request | No | Included in Pro from 2026-05-15, then Plus (see PRODUCT_STRATEGY) | [OpenAI](https://openai.com/index/personal-finance-chatgpt/) [P]; [TechCrunch 2026-05-15](https://techcrunch.com/2026/05/15/openai-launches-chatgpt-for-personal-finance-will-let-you-connect-bank-accounts/) [S] |
| Long tail (Finviro, Cash Flow Calendar and similar) | Safe-to-spend or 90-day projections for irregular earners. | Yes | Yes (often with manual income entry) | Sometimes | $ varies | [Finviro](https://finviro.app/irregular-income-budgeting) [U]; [Cash Flow Calendar](https://www.cashflowcalendar.app/blog/best-budgeting-apps-variable-income) [U] |

### What is missing for students with hourly, gig or per-session income

1. **Income that depends on an action.** Campus payroll pays only for *submitted* hours, and tutoring pays only when the session report is *filed*. Aggregators can see a paycheck only after it lands. A 3-occurrence `MATURE` stream will be wrong, or missing, during the first weeks of every semester.

   No incumbent has a **"work not yet cashed"** ledger: log a shift or session, see the money it will bring in, and get a nudge to submit it before the payroll cutoff. This is the founder's own pain, and it is **not something an aggregator can observe**. It is a data advantage only if the user enters it, so entry must take one tap.
2. **Due-date coverage stated as a yes or no.**
   - The coverage check is: cash now + expected pay *before the due date* − **statement balance** (not the current balance, which "rebounds" with new charges) − bills due before that date.
   - Incumbents show a "left to spend" number. None of them answers "Covered by the 14th? Yes, with $62 to spare", or "Short by $40 unless you submit 3 hours by Friday".
3. **An academic calendar.** Breaks, work-study caps, aid refund dates and summer income cliffs.
4. **Price and trust.** The forecasting apps cost $95–$199/yr (YNAB is free for a student's first year only). The apps that target irregular earners make money from advances and fees, and the FTC has sued or settled with **Brigit, Dave and Cleo**.
5. **Nobody teaches the numbers.** "Liquidity" and "free cash flow" are metrics the user could *learn* and then apply. That is the one angle Tenbagger's lesson engine already owns.

---

## 2. Market sizing for the persona

| Metric | Value | Source (date) | Tag |
|---|---|---|---|
| US undergraduates enrolled | **16.2M**, fall 2025 | [NSC Research Center, Final Fall Enrollment Trends](https://nscresearchcenter.org/final-fall-enrollment-trends/) (2026) | [P] |
| Full-time undergraduates who were employed | **40%** in 2020 (43% in 2015). Part-time: 74%. Full-time ages 16–24: 37%. | [NCES Condition of Education, College Student Employment](https://nces.ed.gov/programs/coe/indicator/ssa/college-student-employment) (updated May 2022). There is newer 2022 data in [Digest table 503.40](https://nces.ed.gov/programs/digest/d23/tables/dt23_503.40.asp), but the values were not visible in snippets. | [P] |
| Students who work while enrolled (all levels) | **About 70%**; about 14M working learners | [Georgetown CEW, *Learning While Earning*](https://cew.georgetown.edu/cew-reports/workinglearners/) (2015) | [S] (dated) |
| College students with a credit card | **57%** | [Sallie Mae/Ipsos, *Majoring in Money 2019*](https://files.eric.ed.gov/fulltext/ED594429.pdf) | [P] (2019, dated) |
| Average student card balance | **$1,423** (up from $1,076 in 2016); about 60% pay in full monthly | Same source; see also [CNBC 2019-04-16](https://www.cnbc.com/2019/04/16/college-students-who-use-credit-cards-carry-5-on-average-sallie-mae.html) | [P] / [S] |
| Adults who would cover a $400 expense with cash or its equivalent | **63%**, unchanged for 4 years (high of 68% in 2021) | [Fed press release, 2026-05-13 (SHED 2025)](https://www.federalreserve.gov/newsevents/pressreleases/other20260513a.htm) | [P] |
| Adults whose income varies at least occasionally | **30%** in 2025 (28% in 2023) | [SHED 2025, Income and Expenses](https://www.federalreserve.gov/publications/2026-economic-well-being-of-us-households-in-2025-income-and-expenses.htm) | [P] |
| Struggled to pay bills because income varied | **11%** of all adults; 10% of employees; 22% of self-employed | Same source; [SHED 2025 Economic Hardships](https://www.federalreserve.gov/publications/2026-economic-well-being-of-us-households-in-2025-economic-hardships.htm) | [P] |
| Adults doing gig activities in the prior month | **20%** (13% sold things, 9% did short-term tasks); 41% of gig workers had variable income vs 26% of others | [SHED 2024, Employment and Gig Work](https://www.federalreserve.gov/publications/2025-economic-well-being-of-us-households-in-2024-employment-and-gig-work.htm) (May 2025). The 2025 figure was not visible in snippets. | [P] |
| Cardholders who carried a balance in the past year | **45%** (55% never carry one) | Attributed to SHED 2025 in the [Motley Fool research page](https://www.fool.com/money/research/credit-card-ownership-statistics/) | [S] (verify in SHED "Banking and Credit") |
| Ages 18–29 carrying card debt month to month | **40%** | Search snippet from a [Bankrate 2026 survey](https://www.bankrate.com/f/102997/x/4984941a16/credit-card-debt-survey-2026-_-press-release.pdf) | [U] |
| Gen Z owning any investments | **56%**; 64% of non-investors cite no income or living paycheck to paycheck | [FINRA Foundation / CFA Institute, 2023-05-24](https://www.finra.org/media-center/newsreleases/2023/finra-foundation-cfa-institute-research-focuses-gen-z-investors) | [P] |
| Gen Z IRA growth at Fidelity | Gen Z IRA **+25% YoY** in Q4 2025; 95% of Gen Z plan contributions went to Roth (Q3 2025) | [Fidelity Q4 2025 Retirement Analysis](https://about.fidelity.com/data-and-insights/q4-2025-retirement-analysis); [Fidelity Q3 2025 release](https://newsroom.fidelity.com/pressreleases/fidelity--q3-2025-retirement-analysis--retirement-account-balances-continue-to-climb--roth-savings-v/s/6bdc547b-b947-4d2c-b91a-f9d45f2b39c0) | [P] |

**Back-of-envelope serviceable market** (our estimate [U]):

| Step | Calculation | Result |
|---|---|---|
| Working undergraduates | 16.2M × 40–70% | **6.5–11M** |
| ...who hold a credit card | × 57% | **3.7–6.4M** |
| ...who also hold a brokerage or Roth account | × about 20–35%. This is an assumption: 56% of Gen Z "own investments", but much of that is crypto. | **0.7–2.2M** "full persona" students |

The broader "working student with a card" pool of about 4–6M is the realistic top of funnel for the free Due-Date Check. The full persona (brokerage plus Roth) is the natural Pro buyer.

---

## 3. Plaid feasibility and cost

**Recurring income detection: `/transactions/recurring/get`**
- Returns `inflow_streams` and `outflow_streams`, each with a frequency, an average or last amount, and **`predicted_next_date`** ([Plaid API: Transactions](https://plaid.com/docs/api/products/transactions/) [P, via snippet]).
- A stream becomes **`MATURE` after at least 3 occurrences**. Before that it is flagged **`EARLY_DETECTION`** ([Plaid blog: recurring transactions](https://plaid.com/blog/recurring-transactions/) [P, via snippet]).
- It is an add-on to Transactions, available in the US, Canada and UK ([Plaid docs](https://plaid.com/docs/transactions/) [P]).
- **Fit for this persona:**
  - A biweekly campus paycheck will mature after about 6 weeks, but amounts swing with hours.
  - Tutoring paid by Venmo or Zelle may not form a clean stream.
  - The predicted date is useful as a *prior*. The Tenbagger "work not yet cashed" log has to supply the amount, and the gating ("will it come at all?").

**Credit card due date and amounts: `/liabilities/get`**
- Credit-card fields include `next_payment_due_date`, `minimum_payment_amount`, `last_statement_balance`, `last_statement_issue_date`, `last_payment_amount` and APRs ([Plaid API: Liabilities](https://plaid.com/docs/api/products/liabilities/) [P, via snippet]).
- These are exactly the inputs the coverage check needs. `last_statement_balance` is the "amount due to avoid interest", as opposed to the current balance, which rebounds with new charges.

**Holdings:** Investments covers the brokerage and Roth accounts. It was already scoped in DATA_STRATEGY.

**Billing model**
- Transactions, Recurring Transactions, Liabilities and Investments are **subscription products**: a monthly fee **per Item** (per linked institution login) for as long as the access token exists.
- The fee is charged even if no calls are made or the Item is in an error state.
- There is no proration, and removing a product means deleting the Item ([Plaid billing docs](https://plaid.com/docs/account/billing/) [P, via snippet]).
- **Per-product prices are not published.** Pay-as-you-go prices appear only in the Production access flow ([Plaid support](https://support.plaid.com/hc/en-us/articles/16110502116887-What-are-Plaid-s-prices-and-pricing-plans-and-how-do-they-differ) [P]).

**Illustrative cost model**, to be replaced with the real quote [U]:
- The persona has about 3 Items: bank or card (often the same bank), broker, and Roth (often the same broker as the brokerage, making 2 Items).
- If Transactions (plus Recurring) and Liabilities together cost about $0.30–0.60 per Item per month, and Investments costs about $0.20–0.40 per Item per month, then a fully linked user costs about **$0.80–2.00/mo**.
- That is consistent with the $1.25–2.50 range in BENCHMARKS.md.
- **For a free tier, this is the business risk.** Cost-control levers:
  1. Free tier = 1 Item with Transactions only. The user enters the card due day once; statement balance comes from the card's own transactions or from manual entry. This avoids Liabilities.
  2. Unlink dormant free users after 30 days of no opens.
  3. Investments on Pro only.

**Bank data-access fees**
- JPMorgan now charges Plaid for data access (agreement announced September 2025). Plaid said it would **not pass the cost on** ([Payments Dive](https://www.paymentsdive.com/news/plaid-to-pay-for-jpmorgan-data-open-banking-fintechs/760192/) [S]; [JPMC release](https://www.jpmorganchase.com/newsroom/press-releases/2025/jpmc-plaid-renewed-data-access-agreement) [P]).
- The CFPB §1033 open-banking rule is enjoined and being rewritten, and fees for data access are an open question. A new NPRM went to OIRA in August 2026 ([Consumer Finance Monitor 2026-08-06](https://www.consumerfinancemonitor.com/2026/08/06/cfpb-sends-new-section-1033-open-banking-proposal-to-oira-for-review/) [S]; [Cozen O'Connor](https://www.cozen.com/news-resources/publications/2026/section-1033-compliance-date-open-banking-rule-enjoined-and-under-reconsideration) [S]).
- Treat aggregator unit cost as **rising risk**, not falling.

**Student-specific constraints**
- **Age.** Most college students are 18 or older, but some freshmen are 17. Require 18+ for linking, because a minor's consent to data-sharing terms is legally shaky. Confirm with counsel and Plaid's end-user terms [U].
- **Campus payroll** usually lands as a bank ACH deposit, which is fine. **Venmo and Cash App** tutoring income is only partly aggregable. Venmo *direct deposit* accounts cannot be linked by credentials ([Open Banking Tracker](https://www.openbankingtracker.com/plaid/venmo) [U]). The manual "session logged" entry covers this.
- **Credit unions and small banks** near campus may have spotty connections. The reconnect experience matters.

**Verdict:** technically feasible with off-the-shelf endpoints. Cost is manageable **only if** free users are limited to about 1 Item without Liabilities or Investments, until Plaid gives a quote.

---

## 4. Regulatory: is "can I cover my card?" advice?

**Securities advice.** A projection of the user's *own cash against their own bill* is not advice "as to the value of securities or the advisability of investing in … securities", so the Investment Advisers Act is not triggered.
- The existing Lowe/publisher analysis (PRODUCT_STRATEGY §1.4) still governs anything that touches holdings.
- **Rule:** the scorecard may *describe* ("your investments are 60% of net worth") but never *recommend* ("move $X into VOO", "contribute to your Roth now").
- Origin shows what happens once you cross that line: it runs its AI advisor through an SEC-registered RIA ([BusinessWire 2025-09-09](https://www.businesswire.com/news/home/20250909759834/en/Origin-Unveils-First-AI-Financial-Advisor-Regulated-by-the-SEC-Outsmarts-Every-Leading-AI-Model-on-the-CFP-Exam) [P]).

**Consumer protection: accuracy and marketing**
- The relevant enforcement pattern is FTC Act §5 deception, not "advice".
- **Hello Digit**: the CFPB acted in 2022 because its "safe to save" algorithm caused overdrafts it had promised would not happen ([CFPB](https://www.consumerfinance.gov/about-us/newsroom/cfpb-takes-action-against-hello-digit-for-lying-to-consumers-about-its-automated-savings-algorithm/) [P]). **This is the closest precedent for a "you're okay" forecast that turns out wrong.**
- **Product rules:**
  - Always show the inputs and the date as of which the data is current.
  - Label pending pay as "expected, not guaranteed".
  - Never promise "no overdraft" or "no late fee".
  - Build a conservative mode that counts only confirmed deposits.

**Data security**
- Consumer fintech apps that access account data are treated as GLBA "financial institutions". They are subject to the FTC Safeguards Rule, including a written information-security program, and to the breach-notification amendment effective 2024 ([FTC Safeguards Rule](https://www.ftc.gov/legal-library/browse/rules/safeguards-rule) [P]; [Cooley](https://cdp.cooley.com/fintech-faces-expanded-applicability-of-glbas-privacy-and-security-requirements/) [S]; [Federal Register 2023-11-13](https://www.federalregister.gov/documents/2023/11/13/2023-24412/standards-for-safeguarding-customer-information) [P]).
- This is a fixed compliance cost that exists **the moment we store bank data**. It did not exist in the education-only plan.

**Stay out of lending. Never add "cover me" advances.**

| Case | What happened | Source |
|---|---|---|
| **FTC v. Dave** (Nov 2024) | Deceptive "up to $500" claims, undisclosed $3–25 express fees, "tips" (more than $149M of tip revenue from 2022 to H1 2024) and a hidden $1/mo fee. Referred to DOJ, which filed an amended complaint on 2024-12-30 naming the CEO. Still pending. | [FTC release](https://www.ftc.gov/news-events/news/press-releases/2024/11/ftc-takes-action-against-online-cash-advance-app-dave-deceiving-consumers-charging-undisclosed-fees) [P]; [FTC referral](https://www.ftc.gov/news-events/news/press-releases/2024/12/ftc-refers-case-against-online-cash-advance-firm-dave-inc-department-justice) [P] |
| Baltimore v. Dave (2026) | Alleges unlicensed payday lending, with APRs above 2,500% | [ABA Banking Journal 2026-03](https://bankingjournal.aba.com/2026/03/baltimore-sues-payday-lender-dave-inc-over-allegedly-deceptive-lending-practices/) [S] |
| **Brigit** | $18M settlement (2023-11) over deceptive advance amounts and blocked cancellation. More than $17M refunded. | [FTC](https://www.ftc.gov/news-events/news/press-releases/2024/11/ftc-sends-more-17-million-consumers-harmed-brigits-deceptive-claims-junk-fees-confusing-cancellation) [P] |
| **Cleo** | $17M settlement (2025-03-27) | [FTC case](https://www.ftc.gov/legal-library/browse/cases-proceedings/cleo-ai-inc-ftc-v) [P] |
| **DC AG v. EarnIn** (Nov 2024) | Alleged loans at more than 300% APR. Most claims were dismissed in May 2025 and the dismissal left standing on appeal. | [DC OAG](https://oag.dc.gov/release/attorney-general-schwalb-sues-pay-advance-company) [P]; [PR Newswire](https://www.prnewswire.com/news-releases/dc-court-of-appeals-leaves-in-place-dismissal-of-oag-claims-against-earnin-302682133.html) [U] |

**CFPB position on earned-wage access (EWA)**
- It flip-flopped:
  - 2020: EWA without payment is not credit.
  - January 2025: that opinion rescinded.
  - May 2025: the rescission itself withdrawn.
  - **2025-12-23:** a new advisory opinion says qualifying EWA is not "credit" under TILA, and the 2024 proposed interpretive rule was withdrawn ([Federal Register](https://www.federalregister.gov/documents/2025/12/23/2025-23735/truth-in-lending-regulation-z-non-application-to-earned-wage-access-products) [P]).
- Federal rules are currently permissive, **but states (DC, Baltimore, and others) and the FTC are active**. The rules could swing again under a future administration.
- **Bottom line:** the "Short by $40" moment is exactly when a cash-advance upsell would convert. **Don't build it.**
  - Offer non-credit actions instead: "submit your 3 pending hours", "pay the minimum by the 14th and the rest after the 20th paycheck (interest estimate: $X)", "move $40 from savings".
  - If a partner offer is ever considered, it needs counsel plus state licensing review. Referral fees from lenders would also compromise the "never sold to" education brand.

**App store.** Apple and Google have extra rules for personal-loan apps. A pure read-only hub avoids them [U, not re-verified this pass].

---

## 5. Recommendation: which layer is the hook?

### Evidence on daily-habit potential

| Evidence | Source | Tag |
|---|---|---|
| 73% of consumers use their banking app weekly or more; 62% "cannot live without" it | [Chase Digital Banking Attitudes study](https://media.chase.com/news/consumers-rely-more-and-more-on-mobile-banking) | [S] (a bank's own survey; year per the release) |
| 34% of mobile-banking users open daily; 44% several times a week | Search snippet from an unnamed compilation | [U] |
| **52.5% of Gen Z check accounts at least once a day**, often before small purchases | [CheckAlt blog](https://www.checkalt.com/blog/understanding-gen-z-banking-preferences-what-financial-institutions-can-do-to-stay-relevant) | [U] (vendor blog, primary study not identified) |

The direction is consistent: **balance-checking is already a daily or near-daily habit for young users**. It is far more frequent than the "3 minutes of finance lessons a day" habit that PRODUCT_STRATEGY red-team #1 flagged as the biggest risk.

### Options

| Option | Pros | Cons |
|---|---|---|
| **A. Hub free, lessons paid** | Daily opens; the pain is immediate. | The free tier costs money per user (Plaid). The hub is commoditised: Rocket Money and Credit Karma are free, and ChatGPT includes it. It turns the brand into "another budgeting app" and dilutes the education or interview-prep positioning. |
| **B. Lessons free, hub paid** | Paid tier pays its own aggregator cost; keeps the education brand. | Loses the daily habit driver. People won't pay for a hub they haven't tried. |
| **C. Hybrid (recommended)** | Free "Due-Date Check lite" plus core lessons. Pro unlocks the full hub and depth. | More complex to explain. Needs discipline on free-tier cost. |

### Recommended unified product (Option C)

**Positioning:** *"Learn to read a 10-K, then read your own."*

The three core loops:

1. **The "Am I okay?" loop (daily, free).**
   - One screen shows a green, amber or red status: "Card due Oct 14: **covered, $62 to spare**".
   - It is computed from: cash now + *confirmed* pay before the due date + *pending* pay (hours and sessions you logged but haven't cashed) − statement balance − known bills before the due date.
   - Triggers:
     - a push when a paycheck lands
     - a push when a big charge moves the status from green to amber
     - "Submit your 6 logged hours by Friday to get paid on the 10th"
   - The one-tap **work log** is the unique input no aggregator has.
2. **The "Learn it, then see it on you" loop (3 min, free core).**
   - Each company lesson ends by **unlocking the same metric on your own finances**. For example:
     - Costco's current ratio unlocks "Your liquidity ratio = liquid cash ÷ card balance due within 30 days = 1.4×".
     - Apple's free cash flow unlocks "Your monthly FCF = pay in − spending = +$85".
     - Net cash unlocks "Your net cash = cash − card debt".
     - Debt/equity unlocks "Your debt ÷ (investments + cash)".
   - The hub's scorecard **starts mostly locked**, and lessons fill it in. That is the retention mechanic: curiosity about yourself pulls you through the curriculum, and the curriculum makes the hub understandable. It also lets us *describe* personal ratios without *recommending* anything.
3. **The "Personal 10-K" loop (monthly, Pro).**
   - A month-end "earnings report" for you: an income statement (pay by source), balance sheet (liquidity, investments, debt), FCF, and a plain-English MD&A ("tutoring revenue fell 40% during midterms").
   - It compares your ratios to companies you studied: "your liquidity is healthier than Carnival's in 2020".
   - It produces a **redacted share card** showing ratios only, never dollar amounts or returns.
   - The screener becomes "find companies with a balance sheet like yours".

**Free vs paid split**

| Free | Pro ($79.99/yr; Student $39.99/yr, as in PRODUCT_STRATEGY) |
|---|---|
| Due-Date Check for 1 card and 1 linked bank, or manual entry | Unlimited linked Items, including brokerage and Roth (Investments) |
| Work log (pending pay) with submit reminders | Forecast alerts (amber/red push), multi-bill 30-day projection |
| Core lesson path; each lesson unlocks 1 personal metric (current values only) | The full Personal 10-K scorecard **with history and trends**, monthly report, share cards |
| Daily Guess-the-Company, basic screener | Full screener and Quests, Interview-Prep track, Earnings Season packs |

Unit-economics guardrail: each free user must cost Plaid less than about $0.40/mo. That means 1 Item, Transactions only, and auto-unlink after 30 days idle. **Get Plaid's quote before committing to this split.**

**Metrics to add to the day-77 gate (PRODUCT_STRATEGY §7):**
- share of activated users who complete one Due-Date Check
- D7 opens per user (goal: **4 or more per week**, versus lessons alone)
- lesson→unlock conversion
- hub-first vs lesson-first cohort retention

### Red team

1. **"This is just Rocket Money with homework."** Free incumbents, and now ChatGPT, already show upcoming bills and left-to-spend. *Test:* in the waitlist fake-door test, pit "Will I be okay by my due date?" against "Learn to read a 10-K" and measure which headline wins with students. If the hub doesn't beat lessons by a clear margin in sign-ups, it isn't the hook.
2. **Aggregator cost eats a free product.** Items multiply across bank, card and broker, and bank data fees are rising (JPMorgan, §1033). *Mitigation:* caps described above. Manual-entry mode as a fallback.
3. **A wrong "you're okay" is a trust event and a legal one** (the Hello Digit precedent). Lumpy income is exactly where forecasts fail. *Mitigation:* conservative mode by default, visible inputs, "expected, not guaranteed" labels.
4. **Security and compliance load for a solo founder.** A GLBA Safeguards program, breach notification, and SOC2 pressure from partners arrive the day bank data is stored. That is weeks of work the education-only plan avoided.
5. **Brand and persona split gets worse.** PRODUCT_STRATEGY red-team #7 already warned that the ambitious-investor and interview-prep personas pull apart. Adding "broke student budgeting" is a third direction, and the lower willingness to pay drags on conversion.
6. **The advance temptation.** "Short by $40" screens convert well for cash advances, and that is how Dave, Brigit and Cleo ended up in enforcement actions. The answer must be a permanent no in the product principles.
7. **The founder's n=1.** The founder's own pain (submit-to-get-paid, rebounding card balance) is vivid but unvalidated. *Test:* 15 interviews with working students before building. Ask how many **currently check their balance before the due date**, and how many have **missed a card payment in the last year**.

---

## Appendix: open items to verify

- Plaid Production pricing for Transactions, Recurring, Liabilities and Investments per Item. This is the gating input for the free-tier decision.
- SHED 2025 values not visible in snippets: gig-activity share in 2025, and credit-card balance-carrying by age. Open the "Employment" and "Banking and Credit" chapters.
- NCES Digest table 503.40, for 2022 student-employment percentages to replace the 2020 COE figures.
- A newer student credit-card survey than Sallie Mae 2019.
- A primary source for the "Gen Z checks balance daily" figure. The current one is a vendor blog [U].
- Counsel:
  - whether GLBA Safeguards applies at our scale and data design
  - 18+ linking and Plaid end-user terms
  - wording of the coverage status, so it is not a guarantee.

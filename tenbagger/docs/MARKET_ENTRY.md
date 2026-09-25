# Tenbagger: Market Entry — What to Decide, Test and Do First

Prepared 2026-09-25. Builds on `BENCHMARKS.md`, `PRODUCT_STRATEGY.md`, `MONEY_HUB_RESEARCH.md`, `DATA_STRATEGY.md` and `YCHARTS_TEARDOWN.md`. `[S13]` means source S13 in `sources.json`. Inline links are new sources found for this document, all accessed 2026-09-25.

**Confidence tags:** **[P]** primary (filing, regulator, company's own page) · **[S]** reputable secondary (established press or research firm) · **[U]** unverified (blog, vendor, review site, or our own estimate).

**Caveat.** Like the other docs, every web figure comes from search-result snippets, not full page reads. Open the link before quoting a number to an investor. `tenbagger/finance/out/summary.md` did not exist when this was written, so the economics below reuse the model in `BENCHMARKS.md` §C. Not legal advice.

The customer-discovery kit that goes with this document is in `tenbagger/discovery/`.

---

## 0. The answer in one screen

**Recommendation: go, but narrowly and conditionally.** Launch to **US college students who already invest and are in or around a campus investment club or finance society**. Lead with *lessons on real companies + interview prep*. Use the money dashboard ("can I cover the card?") as the daily-habit feature, not as the headline, **unless the fake-door test says students want it more** (Decision 1).

**Why this beachhead:** a student founder can reach it for free and in person. About 600 US colleges run student-managed investment funds ([NACUBO](https://www.nacubo.org/Topics/Endowment-Management/Student-Run-Endowments) [S]). The people in those clubs have the clearest reason to pay: they already pay about $500 for interview prep (WSP, BIWS, CFI [S68][S69]).

**Conditions for "go".** All three must hold by **day 28 (2026-10-26)**. If any fails, change the headline or the segment once, then re-test.
1. At least 15 interviews in which the majority describe a *recent, specific* moment of confusion about a company or fund they own, and something they already did about it. "I'd just ask ChatGPT" must not be the dominant answer.
2. Waitlist landing conversion is **≥ 10% on warm traffic** (clubs, friends) and **≥ 4% on cold traffic** (strangers from ads or Reddit) ([getwaitlist](https://getwaitlist.com/blog/waitlist-benchmarks-conversion-rates) [U]).
3. At least **5% of sign-ups click "Reserve Student $39.99/yr" or "Reserve Pro"** (no charge), the PRODUCT_STRATEGY gate.

**The honest money warning.** A student-first launch lowers revenue per payer. At $39.99/yr the Student plan nets about **$2.83/mo** after the store fee, against **$7.82/mo** in the BENCHMARKS base case. If 60% of payers are students, the base case's month-36 ARR (annual recurring revenue) falls from about **$330k to about $194k** (§6). Students are the *wedge*, meaning the cheap first foothold. The revenue has to come from the $49 Recruiting Pass and from converting students to full Pro when they graduate.

---

## 1. The five decisions that matter right now

These are ranked by how much they change what you build next.

| # | Decision | Our current call | What settles it | By |
|---|---|---|---|---|
| **D1** | **Which front door?** "Learn investing on real companies" or "Money hub: can I cover my card?" | Learn first. The hub is the retention feature. | Fake-door headline A/B (`discovery/FAKE_DOOR_TEST.md`) plus interviews. The hub wins only if its sign-up rate is **≥ 1.5×** the Learn variant's with ≥ 150 visitors per variant. | Day 28 |
| **D2** | **Which student first?** Club investors and recruits, or all Gen Z | Club investors and recruits | Interviews: pain score and whether they have paid before, by segment (`discovery/tracker.csv`) | Day 21 |
| **D3** | **How to charge students?** Freemium, or trial-first | Test both. Freemium converts at a 2.1% median by day 35 vs 10.7% for a hard paywall [S13]. | Paywall A/B in TestFlight cohort 2 | Day 77 |
| **D4** | **Link bank accounts in beta?** | **No.** Start with a manual "Due-Date Check" (type in cash, card balance and due date). Linking adds per-user Plaid fees and GLBA security duties the day you store bank data (MONEY_HUB §3–4). | Hub usage with manual entry. Link only if ≥ 30% of activated users do a manual check weekly. | Day 77 |
| **D5** | **Buy ads?** | **No paid acquisition** until install-to-paid is ≥ 4%. Finance App Store installs cost $13.28 each [S17], and the base-case break-even is about $2.63 per install (BENCHMARKS §B4). | Beta conversion data | Day 90 |

(The name decision, retiring "Tenbagger" for something like "Unlevered", is already made in PRODUCT_STRATEGY §3. Just do the trademark check in week 1.)

---

## 2. The fastest cheap experiments, in order

The full scripts are in `discovery/`. Each experiment has a threshold set in advance, so the result tells you what to do instead of being open to interpretation.

| # | Experiment | Cost | Days | Go | Pivot | Stop |
|---|---|---|---|---|---|---|
| **E1** | **20 past-behaviour interviews** (INTERVIEW_GUIDE): 8 club investors, 6 pre-finance recruits, 6 working students with a card | $0 (coffee) | 1–14 | ≥ 60% of a segment show a real recent pain (score ≥ 4/5) **and** a workaround they already use, **and** ≥ 30% have paid for a finance or learning tool | The pain is real in a different segment → make that segment the beachhead | < 30% show pain in *every* segment, or most say "ChatGPT solves it" and mean it |
| **E2** | **Fake-door headline A/B:** "Learn to read any company's numbers" vs "Know if you can cover your card, every day" | $0–50 | 7–28 | Warm traffic ≥ 10%, cold ≥ 4%; the winning variant beats the other by ≥ 1.5× | Both variants at 4–10% warm → rewrite the headline, re-run once | Both below 4% warm |
| **E3** | **Price fake door:** on the thank-you screen, "Reserve Student $39.99/yr" / "Reserve Pro $79.99/yr" / "Recruiting Pass $49", with no charge taken | $0 | 7–28 | ≥ 5% of sign-ups reserve a paid plan | 2–5% → re-price, or lead with the $49 pass | < 2% |
| **E4** | **Club pilot:** 3 investment clubs play "Guess the Company" and an "Earnings Night" pack at one meeting, then use the web app for 2 weeks | About $60 of pizza | 14–35 | ≥ 40% of members who try it come back in week 2; ≥ 1 club leader asks to keep it | Weak week-2 return but leaders like it → build club tools (B2B2C, meaning sold through an institution to its members) | < 20% week-2 return and leaders indifferent |
| **E5** | **Concierge "Earnings Week" newsletter** (done by hand, no code) | $0 | 14–56 | Opens ≥ 45%, ≥ 15% of openers answer a quiz question | — | Opens < 25% |

**How big a test has to be.** Telling a 5% sign-up rate from a 10% one reliably takes about **430 visitors per variant** (95% confidence, 80% power; standard two-proportion formula). Fewer than that is *directional*: call a winner only if the gap is ≥ 1.5× with ≥ 150 visitors each. $50 of ads buys roughly 70 clicks at Meta's $0.70 average traffic CPC (cost per click) ([WordStream 2025](https://www.wordstream.com/blog/facebook-ads-benchmarks-2025) [S]). So **most test traffic must come free**, from clubs, classes and communities, and the $50 is a supplement.

---

## 3. Growth channels a solo student founder can actually run

CAC means customer acquisition cost: what you spend to win one paying user. The column is ranked by expected cost per payer.

| Rank | Channel | Why it could work | Evidence | Est. CAC per payer | When |
|---|---|---|---|---|---|
| 1 | **Campus investment clubs and finance societies** | You are already on a campus. The members are pre-qualified, and club leaders need content for meetings. | ~600 student-run funds at US colleges; the SMIF Consortium (student-managed investment funds) has ~300 member schools ([NACUBO](https://www.nacubo.org/Topics/Endowment-Management/Student-Run-Endowments) [S]; [Wikipedia summary](https://en.wikipedia.org/wiki/Student_managed_investments) [U]). Robinhood runs "Money Drills" at 17 universities [S59]. | **About $5–15** (pizza plus your time) [U, our estimate] | Now |
| 2 | **Daily puzzle + share cards** ("Guess the Company", Wordle-style) | Every share is a free ad. It gives Reddit, X and Discord something that isn't self-promotion. | The Wordle and Duolingo social mechanics; Duolingo spent only $41.8M on marketing through 2020 [S4] | About $0 | Web version in week 2 |
| 3 | **Programmatic SEO** (search-engine pages generated automatically from data) from SEC data: one page per company and metric | Already built in `tenbagger/web/`, and compounds over time | Stock Analysis reached about 8.4M visits a month bootstrapped [S54]; Simply Wall St ran on auto-generated content [S24] | About $0, but slow (3–9 months to rank) | Publish now, expect results in 2027 |
| 4 | **Finance professors** (assign one unit as homework or extra credit) | One yes brings in 30–200 students | 39 states now require a personal-finance course for high school graduation ([CEE 2026 Survey of the States](https://lasvegassun.com/news/2026/mar/18/council-for-economic-education-reports-that-more-s/) [S]); NGPF counts 30 with a *standalone* course ([NGPF](https://www.ngpf.org/blog/advocacy/how-many-states-require-students-to-take-a-personal-finance-course-for-high-school-graduation/) [S]). The college instructors who train those teachers are warm. | Low. The cost is sales time. | Test in E4; sell in year 2 |
| 5 | **Micro-creators** (10–100k followers) paid per sign-up or on revenue share | Borrowed trust with the audience | Flat CPM (cost per thousand views) of $40–80 for finance YouTube is too expensive (about $400 per payer) [S20]. Only revenue-share deals work. | $20–60 if revenue share | After retention is proven |
| ✗ | Apple Search Ads / Meta installs | — | $13.28 per finance install [S17] → about $530 per payer at 2.5% conversion | $400+ | Not before day 90 |

**Sequence:** clubs + puzzle (weeks 1–8) → SEO compounding in the background → professors (pilot) → creators on revenue share (after day 90) → paid ads only if unit economics allow.

---

## 4. Market size (bottom-up, arithmetic shown)

- **TAM** (total addressable market): everyone who could conceivably buy.
- **SAM** (serviceable available market): the part you can serve with this product and these channels.
- **SOM** (serviceable obtainable market): what you can realistically win in about 3 years.

| Layer | Arithmetic | People | $/yr |
|---|---|---|---|
| **TAM** | 16.2M US undergrads ([NSC, fall 2025](https://nscresearchcenter.org/final-fall-enrollment-trends/) [P]) × $39.99 Student plan, **plus** early career: 4 graduating classes × 2.0M bachelor's degrees a year ([NCES Fast Facts](https://nces.ed.gov/fastfacts/display.asp?id=37) [P]) = 8M × $79.99 Pro | 24.2M | $648M + $640M ≈ **$1.3B** |
| **SAM (beachhead)** | Undergrads who hold non-crypto investments: 16.2M × **21–37%**. Low end: 21% of young adults own non-retirement investments ([FINRA Foundation NFCS 2024, pub. Dec 2025](https://www.finra.org/media-center/newsreleases/2025/new-finra-foundation-research-examines-shifting-investor-behaviors) [P]). High end: 56% of Gen Z own investments minus 19% who hold only crypto ([FINRA/CFA 2023](https://www.finra.org/media-center/newsreleases/2023/finra-foundation-cfa-institute-research-focuses-gen-z-investors) [P]). × $39.99 | **3.4–6.0M** | **$136–240M** |
| SAM (money-hub door) | Working undergrads with a credit card (MONEY_HUB §2) | 3.7–6.4M | $148–256M |
| **SOM (3 yrs)** | Clubs: 150 campuses × 40 members reached × 50% activate × 15% pay ≈ 450 payers a year, which also seeds word of mouth. Add SEO and share-card installs per the BENCHMARKS base and bull cases. | **3.3k–20k payers** (0.07–0.4% of SAM) | **$0.2M–1.5M ARR** at the student-heavy price mix |

**Reading this.** The market is big enough. **The binding limits are retention and willingness to pay, not market size.** A 0.1% share of the SAM is a good solo business, but it is not a venture-scale one unless the early-career upgrade works.

**Growth drivers (why now)**
- **Roth IRA adoption.** 95% of Gen Z retirement contributions at Fidelity go to Roth [P, via MONEY_HUB]. Gen Z IRA contributions were up 65% year on year in Q1 2026 ([Forbes Advisor](https://www.forbes.com/advisor/retirement/gen-z-leads-ira-growth-lmandp5/) [S]).
- **High-school mandates.** 39 states (CEE) or 30 standalone (NGPF) require personal finance. By the class of 2031, 76% of public high school students will be required to take it [NGPF, S]. Students will arrive at college primed on the basics and ready for the "next level": real companies.
- **AI as the default finance adviser.** 77–82% of Gen Z say they use AI for money decisions ([American Banker/TD](https://www.americanbanker.com/news/more-americans-asking-ai-for-financial-advice-td-survey) [S]; [Credit Karma](https://www.creditkarma.com/about/commentary/the-rise-of-fin-ai-why-americans-are-trusting-generative-ai-with-their-wallets) [P]). Over half of AI-advice users report a bad decision ([Fortune 2025-09-24](https://fortune.com/2025/09/24/80-of-millennials-and-gen-z-who-used-ai-for-financial-advice-say-it-helped-but-over-half-made-a-bad-decision-security-risks-when-saving-investing-with-chatgpt-and-becoming-a-millionair/) [S]). This is **both a threat and the pitch**: "learn to check the numbers yourself".
- **Headwind: young investors pulled back.** Young adults owning non-retirement investments fell from 26% to 21% (NFCS 2021→2024) [P].

**Willingness-to-pay evidence**

| Signal | Reads as | Source |
|---|---|---|
| Recruits pay about $500 for WSP, BIWS or CFI | Strong for the recruiting segment | [S68][S69][S70] |
| Gen Z spends about $377/mo on subscriptions | They can pay; the question is priority | [resubs](https://resubs.app/resources/subscription-spending-statistics) [U] |
| "80%+ of college students can be reached with a 20% discount" | A student price anchor is needed | [SheerID](https://www.sheerid.com/wp-content/uploads/2013/05/College-Students-Vs.pdf) [U, dated 2013] |
| **Chegg subscribers −31% year on year to 3.2M** (Q1 2025) as students switched to free AI | **Strong negative:** students drop paid study tools that AI copies | [Chegg 10-Q](https://www.sec.gov/Archives/edgar/data/1364954/000136495425000052/chgg-20250331.htm) [P]; [NPR](https://www.npr.org/2025/08/06/g-s1-81012/chatgpt-ai-college-students-chegg-study) [S] |
| Monarch gives .edu students **12 months free**; YNAB does too | The money-hub door competes against $0 | [College Investor](https://thecollegeinvestor.com/35342/monarch-review/) [U]; YNAB [P, via MONEY_HUB] |

**Lesson from Chegg:** do not sell *answers*. Sell *practice, progress and proof*: streaks, readiness scores and credentials that AI can't hand you.

---

## 5. Who to serve first

| Segment | Core need (a past-behaviour signal) | Size | Willingness to pay | Reachability for you | Verdict |
|---|---|---|---|---|---|
| **A. Club investor**: has a Roth or brokerage account, joined an investment club, often not a finance major | "I own VOO and NVDA and can't explain either one" | Part of the 3.4–6.0M investing undergrads | Low to mid ($40/yr) | **Very high:** clubs, classmates | **Beachhead (with B)** |
| **B. Pre-finance recruit**: business or econ major targeting banking or equity research | "I need to walk through a DCF on a real company by the next recruiting round" | ~375k business bachelor's degrees a year [NCES, P] → maybe 150–300k active recruits [U] | **Highest** ($49 pass; $500 already paid elsewhere) | Very high (same clubs) | **Beachhead (monetisation)** |
| **C. Working student with a card**: hourly, gig or tutoring income | "I got a late fee because payroll landed after my due date" | 3.7–6.4M | Low (free alternatives) | High but spread out | Retention feature. It becomes the lead only if E2 says so. |
| **D. Early career** (22–29): first salary, 401k and Roth | "I don't know what's in my target-date fund" | ~8M | Mid ($80–100/yr, like Monarch) | Low for a student founder today | Year 2, reached by graduating users |

**Why A+B.** They sit in the same rooms (clubs), use the same engine (real-company lessons), and B pays for A's cheap price. The founder is one of them. C is attractive for daily opens, but it pits you against free tools and ChatGPT and adds bank-data compliance.

---

## 6. Economics in brief

| Item | Value | Basis |
|---|---|---|
| Net revenue per payer per month | Pro $7.82 (60% annual mix); **Student $2.83**; Recruiting Pass $41.65 one-time net | BENCHMARKS §B2; 15% store fee [S83] |
| Blended at 60% student / 40% Pro mix | $4.83/mo → base-case month-36 ARR ≈ 3,345 × $4.83 × 12 ≈ **$194k** (vs $330k) | Our arithmetic on BENCHMARKS §C |
| Lifetime value (net LTV) | Pro ≈ $105; Student ≈ $34 ÷ (1 − 0.44 renewal) ≈ **$61** | BENCHMARKS §B4; 44.1% annual renewal [S14] |
| Fixed costs | About $600–650/mo in beta (data $250–450, hosting, tools) | DATA_STRATEGY §6 |
| Break-even | ~80 Pro payers, or ~220 Student payers, cover fixed costs | $620 ÷ $7.82; $620 ÷ $2.83 |

**CAC and payback by channel.** Payback is how long a user's revenue takes to repay what you spent to get them. Annual plans are paid upfront, so payback is immediate whenever CAC is below the first-year net.

| Channel | CAC per payer (est.) | Payback on Student annual ($34 net upfront) | Payback on Pro annual ($68 net) |
|---|---|---|---|
| Clubs | $5–15 [U] | Immediate | Immediate |
| Share cards / SEO | ~$0 marginal | Immediate | Immediate |
| Creators on revenue share | Revenue share, ≤ 30% | Immediate by construction | Immediate |
| Meta traffic → waitlist → app | ~$14 per sign-up ($0.70 CPC ÷ 5%) → about $280 per payer at 5% sign-up-to-paid [U] | Never on Student | ~4 years |
| Apple Search Ads (finance) | ~$530 [S17] | Never | Never |

**Implication:** the business works only on free and near-free channels, which suits a founder with time but no money.

---

## 7. Competitors and how they will respond

| Incumbent | What it has now | Likely response to us | Our counter |
|---|---|---|---|
| **ChatGPT** (Finances in Plus since 2026-06-25) | Linked accounts, a dashboard, upcoming payments, Q&A ([OpenAI](https://openai.com/index/personal-finance-chatgpt/) [P]) | It won't respond to *us*; it keeps getting better at answers for free | Don't sell answers. Sell structured practice, streaks, readiness scores, and "check the AI's math" drills. |
| **Robinhood Cortex** ($5/mo Gold) | Chat that researches **and trades** in natural language, per-holding AI insights (rolled out Q1 2026) ([Yahoo Finance](https://finance.yahoo.com/news/robinhood-deepens-gold-experience-ai-190859247.html) [S]; [Robinhood on X](https://x.com/RobinhoodApp/status/2031731957252448633?lang=en) [P]) | More "Learn" content inside the broker | We are the neutral, no-trading teacher. Cortex is built to get you trading. |
| **Monarch** | AI assistant, forecasting, .edu students 12 months free ([Monarch what's new](https://www.monarch.com/whats-new) [P]) | Nothing aimed at investing education | Don't fight on budgeting. The hub's edge is the *work-not-yet-cashed* log and due-date yes/no, tied to lessons. |
| **Simply Wall St** | "Charlie" AI agent plus Learn Mode and a learning hub ([SWS](https://simplywall.st/features/ask-charlie) [P]; [learn.simplywall.st](https://learn.simplywall.st/) [P]) | The closest threat: it could add streaks and quizzes | Speed, student focus, interview prep, and free SEC-sourced data (their data is licensed, so their costs are higher). |

(Porter's five forces was left out on purpose. It changes no decision here: the power sits with free AI substitutes, which the table already covers.)

---

## 8. What is genuinely defensible, and what isn't

**Defensible, over time:**
1. **The curriculum engine.** Lessons and quiz items are generated from SEC XBRL with deterministic formulas and golden tests (`CONTRACT.md`), so answers are provably right and refresh every quarter for free. Competitors either use licensed data (costly) or LLM text (error-prone).
2. **"Personal 10-K" framing.** You learn a metric on Costco, then unlock it on your own money. It is a memorable idea, and it links two habits no competitor links.
3. **Trust stance.** "Never stock tips, no trade buttons, no advances" is both brand and legal armour (PRODUCT_STRATEGY §1.4, MONEY_HUB §4).
4. **SEO pages from free SEC data.** Thousands of pages at about $0 marginal cost; the lead compounds.
5. **Campus relationships** (if built): club and professor adoption is sticky once it is part of the syllabus or meeting agenda.

**Not defensible:** AI Q&A about stocks, portfolio linking, budgeting dashboards, and generic "what is a P/E" content. All are free elsewhere.

---

## 9. Entry options, scored

Each option is scored 1–5 on three dimensions. Attractiveness is the size of the prize. Feasibility is whether a solo student can do it in 90 days. Risk is inverted, so 5 means low risk. Score = A × F × R, out of 125.

| Option | A | F | R | Score | Role |
|---|---|---|---|---|---|
| **(b) Campus / club-led** | 3 | 5 | 4 | **60** | **Start here** (weeks 1–12) |
| **(a) B2C app-first** (SEO, share cards) | 4 | 4 | 3 | **48** | Run alongside; it is the product clubs use |
| (d) Creator-led | 3 | 3 | 3 | 27 | After day 90, on revenue share only |
| (c) B2B2C via universities and teachers | 4 | 2 | 3 | 24 | Year 2. Start with college professors, not K-12 (FERPA/COPPA, procurement). The Duolingo for Schools sunset opens a gap (PRODUCT_STRATEGY §4). |

---

## 10. Risks and guardrails

| Risk | Mitigation | Trigger to act |
|---|---|---|
| No daily habit ("lessons are homework") | Puzzle-first loop, earnings events, the Due-Date Check as a daily reason to open | D7 < 10% at day 77 → pivot to the paid Interview-Prep product only (PRODUCT_STRATEGY §6) |
| AI substitutes (the Chegg pattern) | Sell practice and proof, not answers | E1: most say "ChatGPT covers it" |
| Low student willingness to pay | $49 Recruiting Pass; convert to Pro at graduation | E3 below 2% |
| Regulatory | Education only; no individual recommendations (*Lowe*); game rewards for learning only (Mass. v. Robinhood); no cash advances (FTC v. Dave, Brigit, Cleo); coverage status labelled "expected, not guaranteed" (the CFPB Hello Digit precedent); LLC + Apple org account (5.1.1(ix)); $1–2k lawyer review before launch | Counsel says My Stocks or the hub is advice → ship general curriculum only |
| Survey and outreach etiquette | Follow each community's rules. r/personalfinance bans promoting financial products ([Reddit rules guide](https://redship.io/blog/reddit-self-promotion-rules) [U]). Ask moderators first. | Any mod warning → stop posting there |
| Founder bandwidth | One experiment a week; scope limited to the 5 MVP features | TestFlight misses day 56 → cut scope |

---

## 11. 90-day measurement plan

Day 0 = Mon 2026-09-28. These gates match PRODUCT_STRATEGY §6–7.

| Hypothesis | Experiment | Metric | Go | Pivot | Stop | Decision day |
|---|---|---|---|---|---|---|
| H1: Club investors feel a real, recurring pain | E1 interviews | % with pain ≥ 4/5 plus an existing workaround | ≥ 60% | Another segment ≥ 60% | All < 30% | 21 |
| H2: The Learn headline beats the Money headline | E2 A/B | Sign-up rate by variant | Learn ≥ Money | Money ≥ 1.5× Learn → hub-first | Both < 4% warm | 28 |
| H3: Students will pay | E3 fake door | % of sign-ups reserving a paid plan | ≥ 5% | 2–5% | < 2% | 28 |
| H4: Clubs spread it | E4 pilot | Week-2 return; leader wants more | ≥ 40% and yes | Leaders yes, users no | < 20% | 35 |
| H5: It becomes a habit | TestFlight cohort 1 (≥ 150 activated) | D1 / D7 retention | D1 ≥ 35%, D7 ≥ 15% | D7 10–15% | D7 < 10% | 77 |
| H6: Freemium or trial converts | Cohort 2 paywall A/B | Trial starts / activated users; trial → paid | ≥ 8%; ≥ 25% | 4–8% | < 4% and zero pass sales | 77–90 |
| H7: It lasts | Cohort 1 | D30 | ≥ 7% | 5–7% | < 5% | 90 |

(D1, D7 and D30 are the share of users who come back on day 1, 7 and 30.)

---

## 12. What a partner would challenge

A partner here means a senior consultant or an investor reviewing the plan.

| # | Hard question | Best current answer | Evidence still missing |
|---|---|---|---|
| 1 | "Chegg lost 31% of its subscribers to free AI. Why won't you?" | Chegg sold answers. We sell practice with verified data plus a credential and readiness score. AI makes the "check the numbers yourself" skill *more* valuable. | Interview evidence that students value practice or credentials over answers. Pass reservations (E3). |
| 2 | "Students pay $40 a year. How is this ever a business?" | Students are the wedge. Revenue comes from the $49 pass, from Pro at graduation, and later from campus licences. | Any data on student→Pro conversion (none until 2027). Recruiting Pass demand. |
| 3 | "Finance lessons don't form habits. Education D30 is about 2%." | Puzzle, earnings events and the Due-Date Check give daily reasons to open. The kill gate at day 77 is pre-committed. | Cohort retention. Whether the hub lifts D7 opens to ≥ 4 a week (MONEY_HUB §5). |
| 4 | "Why can't Simply Wall St or Robinhood copy this in a quarter?" | They can copy features. Their incentives are trading and paid data, and they don't live on campus. Our cost base is SEC data at $0. | Proof that clubs adopt and stick (E4). SEO traction. |
| 5 | "Is the market you can reach really big enough?" | SAM is 3.4–6M investing undergrads; 0.1% share = solo-sustainable. Scale needs the early-career upgrade. | Club count and membership sizes on your own campus and 10 nearby ones (SIGNALS.md). |

---

## Sources added in this document (all accessed 2026-09-25)

| Claim | URL | Date | Tag |
|---|---|---|---|
| 39 states require personal finance (CEE 2026) | https://lasvegassun.com/news/2026/mar/18/council-for-economic-education-reports-that-more-s/ | 2026-03-18 | S |
| 30 standalone; 76% of class of 2031 | https://www.ngpf.org/blog/advocacy/how-many-states-require-students-to-take-a-personal-finance-course-for-high-school-graduation/ | 2026 | S |
| Young adults with non-retirement investments 21% (vs 26%) | https://www.finra.org/media-center/newsreleases/2025/new-finra-foundation-research-examines-shifting-investor-behaviors | 2025-12 | P |
| Gen Z 56% own investments; 19% crypto-only | https://www.finra.org/media-center/newsreleases/2023/finra-foundation-cfa-institute-research-focuses-gen-z-investors | 2023-05-24 | P |
| 16.2M undergrads | https://nscresearchcenter.org/final-fall-enrollment-trends/ | 2026 | P |
| 2.0M bachelor's, 375k business | https://nces.ed.gov/fastfacts/display.asp?id=37 | 2024 | P |
| ~600 student-run funds; SMIF ~300 schools | https://www.nacubo.org/Topics/Endowment-Management/Student-Run-Endowments ; https://en.wikipedia.org/wiki/Student_managed_investments | undated | S / U |
| Gen Z IRA contributions +65% (Q1 2026) | https://www.forbes.com/advisor/retirement/gen-z-leads-ira-growth-lmandp5/ | 2026 | S |
| Gen Z AI for money 77–82% | https://www.americanbanker.com/news/more-americans-asking-ai-for-financial-advice-td-survey ; https://www.creditkarma.com/about/commentary/the-rise-of-fin-ai-why-americans-are-trusting-generative-ai-with-their-wallets | 2025 | S / P |
| Over half of AI-advice users made a bad decision | https://fortune.com/2025/09/24/80-of-millennials-and-gen-z-who-used-ai-for-financial-advice-say-it-helped-but-over-half-made-a-bad-decision-security-risks-when-saving-investing-with-chatgpt-and-becoming-a-millionair/ | 2025-09-24 | S |
| Chegg subscribers −31% to 3.2M | https://www.sec.gov/Archives/edgar/data/1364954/000136495425000052/chgg-20250331.htm | 2025-05 | P |
| Monarch .edu 12 months free; new AI assistant | https://thecollegeinvestor.com/35342/monarch-review/ ; https://www.monarch.com/whats-new | 2026 | U / P |
| Cortex: trading by chat, per-holding insights | https://finance.yahoo.com/news/robinhood-deepens-gold-experience-ai-190859247.html | 2026 | S |
| ChatGPT finance in Plus 2026-06-25 | https://openai.com/index/personal-finance-chatgpt/ | 2026-06 | P |
| SWS Charlie AI + Learn Mode | https://simplywall.st/features/ask-charlie ; https://learn.simplywall.st/ | 2026 | P |
| Meta CPC $0.70 traffic / $1.92 leads | https://www.wordstream.com/blog/facebook-ads-benchmarks-2025 | 2025 | S |
| Waitlist conversion 4–8% consumer cold | https://getwaitlist.com/blog/waitlist-benchmarks-conversion-rates | 2025 | U |
| Gen Z subscription spend $377/mo | https://resubs.app/resources/subscription-spending-statistics | 2026 | U |
| Reddit 90/10 and r/personalfinance promotion ban | https://redship.io/blog/reddit-self-promotion-rules | 2026 | U |

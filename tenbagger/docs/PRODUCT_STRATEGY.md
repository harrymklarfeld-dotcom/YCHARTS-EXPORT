# Tenbagger: Product Strategy

Prepared 2026-09-25 by the product-strategy agent. It builds on `docs/BENCHMARKS.md`. In this document `[S13]` refers to source 13 in `docs/sources.json`, and an inline link is a new source found for this document.

**Confidence tags** (same as BENCHMARKS.md):
- **[P]** Primary: a filing, company page, court opinion or regulator release.
- **[S]** Reputable secondary: established press or a known research publisher.
- **[U]** Unverified: a blog, agency marketing page, review site or search-snippet summary.

**Method caveat.** Every web figure below comes from search-engine snippets of the linked page. As BENCHMARKS.md explains, page fetching is unreliable in this sandbox. Before anything goes in front of an investor, lawyer or customer, open the link and confirm it. Nothing here is legal advice. Sections 1.4 and 6 name the points that need counsel.

---

## 0. The answer in one screen

- **Positioning:** *"Learn to read any public company's numbers, 3 minutes a day. Drills built from real SEC filings, never stock tips."*
- **MVP adds five things on top of the base lessons:**
  1. Guess-the-Company daily puzzle with share cards
  2. Screener Quests
  3. "My Stocks" lessons from typed-in tickers, with no brokerage link
  4. Earnings Season packs
  5. An Interview-Prep track sold to students
- **Deferred:**
  - Brokerage linking moves to v2 or later. ChatGPT and Perplexity now give it away, and it costs $1.25–2.50 per linked user per month.
  - The AI tutor moves to v2, limited to "explain my mistake, with citations".
- **Name:** stop using "Tenbagger" publicly. There is already a stock app called Tenbagger on Google Play, and the word promises 10x returns, which is the wrong promise for an education brand. The front-runner is **Unlevered**, pending a real trademark knockout (§3).
- **Pricing:**

  | Plan | Price |
  |---|---|
  | Free | $0 |
  | Pro | $12.99/mo or $79.99/yr, 7-day trial on annual |
  | Student | $39.99/yr, .edu verified |
  | Recruiting Pass | $49 one-time, 4 months |
  | Edu | Free teacher dashboard, then $149 per teacher per year or a campus license (later) |

- **Kill gates:**
  - **Day 28:** a waitlist and fake-door price test.
  - **Day 77:** TestFlight D7 retention must be at least 15%, with trial starts at least 8% of activated users.
  - **Day 90:** go/pivot memo, before any spending on the January 2027 launch.

---

## 1. Idea bank: 22 ideas beyond the base concept

The base concept is taken as given: lessons generated from SEC data, the screener as a practice arena, and holdings later. Everything below is additive.

**Scales used in the table:**
- **Effort:** S is under 1 week, M is 1–3 weeks, L is more than 3 weeks. All assume a solo developer with AI coding tools, starting from the existing `pipeline/`, `lessons/`, `packages/screener/` and `mobile/`.
- **Regulatory risk:** Lo, Med or Hi, judged against the Lowe/Robinhood lines described in §1.4.
- **Revenue impact:** how directly the idea drives paid conversion or new revenue.

### 1.1 Engagement and habit

| # | Idea | User value | Why ChatGPT doesn't replace it | Effort | Reg risk | Revenue impact |
|---|---|---|---|---|---|---|
| 1 | **Guess the Company.** A daily puzzle: here are the anonymised income statement, balance sheet and 5 ratios; guess the company in 6 tries, Wordle-style, with each wrong guess revealing a hint (sector, then margin trend, then segment mix). | A fun, 90-second daily reason to open the app. It teaches pattern recognition: "70% gross margin and no inventory means software". | ChatGPT can't run a shared daily puzzle with streaks, a social grid or a leaderboard. The shared ritual is the product. | **S.** It runs off `data/companies.json`. | Lo | Indirect but large: it feeds DAU and virality, and top-of-funnel feeds conversion. |
| 2 | **Shareable result cards.** A spoiler-free emoji grid ("Guessed $COST in 3 🟩🟩"), "I scored 9/10 on NVDA's cash flow", and a year-in-review card. | Social proof and bragging rights. | Distribution, not features. ChatGPT chats aren't made to be screenshotted. | S | Lo, as long as cards never show P&L or returns. | Indirect: organic acquisition, which is the only affordable channel. BENCHMARKS §B4 puts finance CPI at $13.28. |
| 3 | **Screener Quests.** Missions inside the screener: "Find 3 companies with ROIC above 20% and net cash", "Find a cyclical at peak margins". They are auto-checked against the data. | Turns the screener from an intimidating tool into a game. Practice happens on the real tool, which is the "arena". | ChatGPT gives the list; the quest makes *you* build it. Doing the work is the learning. | S. The screener engine exists. | Lo. Quests are about criteria, not "buy these". | Medium: the screener's advanced filters make a natural Pro gate. |
| 4 | **Number of the Day** push: one real stat and a 20-second question ("Costco's net margin is under 3%. Why is that fine?"). | A micro-habit on days with no time for a full lesson. | Proactive, scheduled and personalised to your path. | S | Lo | Retention |
| 5 | **Streak-saving through a real habit.** Instead of buying a freeze, read a 150-word 10-K excerpt and answer 2 questions to protect your streak. | Keeps the streak honest and teaches filings. | Unique mechanic. | S | Lo | Low directly. It is also a Pro perk: an extra freeze. |
| 6 | **Leagues and async head-to-head duels.** Weekly XP leagues plus "duel a friend on AMD's balance sheet": same 7 questions, best score wins. | Competition. Duolingo's leagues raised learning time 17% ([Lenny/Mazal](https://www.lennysnewsletter.com/p/how-duolingo-reignited-user-growth) [S]). | Social graph plus shared scoring. | M. Async is simple; real-time is not worth it. | **Med.** XP must come *only* from learning, never from trades or returns (see Mass. v. Robinhood). | Retention |
| 7 | **Spaced-repetition formula deck** (FSRS scheduling) covering the metric formulas the pipeline already defines in CONTRACT.md. | Remembering beats re-reading. | ChatGPT doesn't schedule your reviews. | S | Lo | Low |

### 1.2 Content and curriculum

| # | Idea | User value | Why ChatGPT doesn't replace it | Effort | Reg risk | Revenue impact |
|---|---|---|---|---|---|---|
| 8 | **Earnings Season Live.** Every week, a 5-company pack on companies reporting that week: "Before: what to watch in the numbers; After: what changed". It uses the free Finnhub earnings calendar ([Finnhub](https://finnhub.io/docs/api/earnings-calendar) [U]). | A timely, news-driven reason to come back, 4 seasons a year. BENCHMARKS E1 #2 names live events as the main fix for weak habit formation. | Curated, pushed and sequenced, but ChatGPT *can* summarise an earnings release. The defensible part is the practice questions and the "before vs after" follow-through. | **M.** The catch: the 8-K press release comes out first and **is not XBRL-tagged**, and the 10-Q with XBRL can follow days or weeks later. "After" lessons therefore need an LLM to extract the press-release numbers, with a human spot-check, or they must wait for the 10-Q. | **Med.** Never frame lessons as "will it beat?" or anything that looks like a price prediction. Say "what did margins do", not "is it a buy". | High for retention. It is also a Pro gate: the free tier gets 1 company per week. |
| 9 | **10-K reading drills** on real excerpts (MD&A, revenue recognition, risk factors, segment notes): "find the red flag", "which segment is subsidising which?" | Reading filings is the real skill that separates serious investors. | Uses real excerpts with a known right answer and graded practice. ChatGPT summarises; it doesn't train you to read. | M. It needs EDGAR full-text extraction, which is blocked in this sandbox but free in production. | Lo | Medium: the advanced track is Pro. |
| 10 | **Valuation Time Machine.** Historical cases: Cisco's P/E in 2000, Micron at a cycle peak, NVDA in 2023. "Here's what the numbers said *then*; what happened to margins over the next 3 years?" | The best way to teach cyclicality and multiples is with outcomes that are already known. | Curated narrative plus historical data, with no hallucination risk. | M. Historical prices need a licence or free end-of-day data; fundamentals are free from EDGAR. | Lo, because it is history, not recommendations. | Medium: premium content. |
| 11 | **Interview-Prep track** for pre-banking and equity-research recruits. "Walk me through a DCF" built on a real company, 3-statement linkage drills, comps from the live screener, timed mock rounds, and a readiness score. | Students already pay $497–499 for this from WSP or BIWS ([TPE review](https://theprivateequiteer.com/wall-street-prep-premium-package-review/) [U], [BIWS](https://breakingintowallstreet.com/biws-premium/) [P]), or $497/yr for CFI ([CFI pricing](https://corporatefinanceinstitute.com/pricing/) [P]). Those courses are Excel-heavy; this is mobile drilling. | ChatGPT can run a mock interview for free, and that is the real threat. Our defence is structured coverage, spaced repetition, readiness scoring on real current companies, and peer benchmarks ("you're faster than 70% of users"). | M. Mostly content, which `lessons/` can template. | Lo | **High.** Highest willingness to pay among target segments; seasonal revenue. |
| 12 | **Cyclicality Simulator.** Drag a commodity-price slider and watch a memory maker's margins, FCF and P/E move. Built on real historical ranges. | Makes "low P/E at peak earnings is a trap" something you feel. | Interactive, visual and data-backed. | M | Lo | Low to medium: content depth. |
| 13 | **Thesis Journal** that grades your calls on *fundamentals*, not price. You write falsifiable claims ("MU gross margin > 40% in FY27", "COST revenue growth stays > 5%"). When filings arrive, the app auto-grades each claim and shows a calibration score. | Honest feedback on your judgement over years. A deeply sticky, personal record. | ChatGPT doesn't remember your March claim or grade it against the September 10-Q. The data moat grows over time. | M | **Med.** Grading price targets or returns would reward trading, so never do it. Grading operating metrics is education. Needs counsel review. | Medium to high: a Pro anchor feature, since leaving means losing your record. |

### 1.3 Personalisation, social, B2B and credentials

| # | Idea | User value | Why ChatGPT doesn't replace it | Effort | Reg risk | Revenue impact |
|---|---|---|---|---|---|---|
| 14 | **"My Stocks" (manual).** Type in or import by CSV the tickers you own or follow. Lessons, puzzles and earnings packs then use *those* companies ("Your 5 stocks' average P/E is 31: here's what that implies"). | About 80% of the value of brokerage linking. | ChatGPT answers about your stocks; we *teach* on your stocks, inside a progression. | **S.** A watchlist table. | **Med.** It is closer to "attuned to your portfolio". Keep it descriptive math, no suggestions, and state that weights are user-entered. | High: personal lessons are the Pro hook, **with zero aggregation cost**. |
| 15 | **Portfolio X-ray through brokerage linking** (SnapTrade or Plaid, read-only). | Automatic, accurate weights. | **Weak moat now.** ChatGPT links brokerage accounts for Plus users through Plaid (Pro from 2026-05-15, US Plus from 2026-06-25) ([TechCrunch](https://techcrunch.com/2026/05/15/openai-launches-chatgpt-for-personal-finance-will-let-you-connect-bank-accounts/) [S], [implicator](https://www.implicator.ai/openai-adds-personal-finance-tools-to-chatgpt-pro-with-plaid-bank-connections/) [U]). Perplexity has done this since 2025 ([Plaid blog](https://plaid.com/blog/powering-intellligent-finance-with-perplexity/) [P]). Robinhood Cortex digests portfolios for $5/mo ([Robinhood](https://robinhood.com/gb/en/learn/articles/cortex-digests-is-here/) [P]). | L. Security, aggregator contracts, reconnect UX. | **Hi.** Individualised output about a specific portfolio is exactly what *Lowe* excluded from the publisher exemption (§1.4). | Negative at low price: $1.25–2.50/mo against about $5.67/mo net ARPPU on the annual plan ($79.99 × 0.85 ÷ 12) is 22–44% of revenue. |
| 16 | **Investment-club mode.** A club leaderboard on *learning*, shared watchlists, a "club earnings night" pack, and a thesis-journal feed. | University and adult clubs need structure. | Group state and a coordinator view. | M | Med. No group trade votes in-app. | Medium: a club plan, and a seed channel for campuses. |
| 17 | **Classroom and university licensing** with a teacher dashboard (assign units, see mastery). | Teachers need low-prep, real-data finance units. | Rosters, assignments and grading. | **L.** Rostering, FERPA, and COPPA if under 13. Stay 13+ and ideally college-first. | Lo | Medium to long term. The window matters: Duolingo for Schools closed to new classrooms and sunsets 2027-07-31 ([Duolingo Schools help](https://duolingoschools.zendesk.com/hc/en-us/articles/6830454446093-What-is-Duolingo-for-Schools) [P]). Teachers used to free, gamified dashboards are becoming orphaned. |
| 18 | **Certificates and credentials** ("Fundamentals I–III", "Valuation"), with lightly proctored final quizzes and LinkedIn badges. | A résumé line for students. | Verifiable credential. | S–M | Lo | Medium. Precedents: Duolingo English Test at $70 ([Coursera guide](https://www.coursera.org/articles/duolingo-english-test) [U]), CFI's FMVA inside a $497/yr plan. But Bloomberg Market Concepts is **free** at many universities ([NYU guide](https://guides.nyu.edu/bloombergguide/bloomberg-certification) [P]), so a no-name certificate is worth little until a university or club endorses it. |
| 19 | **Creator-made courses marketplace.** Finance creators build tracks on the engine and get a revenue share (Maven takes 10% ([Maven help](https://help.maven.com/en/articles/12240853-maven-instructor-policy-guidebook) [P])). | More content, and creators bring audiences. | Tools plus live data. | L | **Hi.** Creators may tout, or trade ahead of their picks. SEC v. Park ("Tokyo Joe") shows internet stock-pickers can lose the publisher exclusion ([SEC](https://www.sec.gov/newsroom/press-releases/2000-2-sec-sues-tokyo-joe-internet-website-operator-stock-picker-securities-fraud) [P]). Needs moderation and disclosure rules. | Medium to long term. |
| 20 | **B2B2C white-label** (the Zogo model) for credit unions, brokers and neobanks. | Partners get engagement and education content. | — | L | Med | Medium. Zogo has 200+ institution partners [S39], but pricing is not public. Year 2. |

### 1.4 Distribution and AI

| # | Idea | User value | Why ChatGPT doesn't replace it | Effort | Reg risk | Revenue impact |
|---|---|---|---|---|---|---|
| 21 | **Grounded AI tutor that shows its math.** Claude answers *only* from the company's filed data, cites the exact 10-K line or XBRL fact with the Citations API ([Anthropic docs](https://platform.claude.com/docs/en/build-with-claude/citations) [P]), shows each formula step, and refuses buy/sell questions. | "Why is my answer wrong?" gets a patient, cited, step-by-step reply. | Honestly, this is **table stakes, not a moat**. The edge is context: it knows which question you missed and your mastery level, and it stays inside the lesson. | M, plus a permanent eval burden: a golden set of about 200 Q&As and a refusal test set. | **Med to Hi.** An LLM can drift into advice. It needs output classifiers, a system prompt forbidding recommendations, and logging. | Medium: a Pro perk. **Cost** at current list prices ($1/$5 per MTok for Haiku 4.5, $2/$10 for Sonnet 5), assuming about 6k input and 400 output tokens per answer, is about $0.008–0.016 per answer. At 40 answers a month that is $0.30–0.65 per Pro user. Affordable if capped. |
| 22 | **Programmatic SEO pages plus a weekly newsletter.** A page per ticker per concept ("Costco's ROIC, explained in 3 minutes, then try the drill"), plus "The Weekly 10-K" email built from the Earnings pack. | Free learning on the web; an owned audience. | Search and email are channels ChatGPT doesn't own. The SWS and Stock Analysis playbook [S24][S54]. | S–M | Lo, as long as there are no ratings or "buy" language. | High indirectly: the cheapest acquisition. |

**The regulatory lines, briefly (not legal advice):**
- ***Lowe v. SEC* (1985):** publications stay outside the Investment Advisers Act when they are impersonal, bona fide and of general and regular circulation. The Court stressed they "do not offer individualized advice attuned to any specific portfolio or to any client's particular needs" ([Justia](https://supreme.justia.com/cases/federal/us/472/181/) [P]). Ideas 14, 15 and 21 are exactly where "attuned to a specific portfolio" starts. Ideas 1–13 are safely general.
- **Mass. v. Robinhood (Jan 2024, $7.5M):** the consent order cited confetti, lists of popular stocks, push notifications and scratch-off free-stock rewards used to drive trading ([InvestmentNews](https://www.investmentnews.com/regulation-legal-compliance/robinhood-to-pay-75m-to-settle-massachusetts-charges/248214) [S], [WealthManagement](https://www.wealthmanagement.com/regulation-compliance/robinhood-pays-7-5m-to-settle-massachusetts-gamification-charge) [S]). Our rule: **game mechanics reward correct understanding, never a trade, a holding or a return.**
- **Federal rule backdrop:** the SEC withdrew its predictive-data-analytics and digital-engagement proposal on 2025-06-12 ([SEC](https://www.sec.gov/rules-regulations/2025/06/s7-12-23) [P]). There is no federal gamification rule today, but state enforcement (as in Massachusetts) remains.
- **App Store guideline 5.1.1(ix):** apps in "highly-regulated fields" such as financial services must be submitted by a legal entity, not an individual ([Apple guidelines](https://developer.apple.com/app-store/review/guidelines/) [P]). **Form an LLC and enroll as an organization in week 1.**

---

## 2. Scoring and selection

**Scoring.** Impact (I) runs 1–5 and combines retention, conversion, distribution and differentiation. Feasibility (F) runs 1–5 and covers solo build time, running cost and regulatory drag. Score = I × F, with a maximum of 25.

| # | Idea | I | F | Score | Bucket |
|---|---|---|---|---|---|
| 3 | Screener Quests | 4 | 5 | **20** | **MVP** |
| 1 | Guess the Company (+ #2 share cards) | 4 | 5 | **20** | **MVP** |
| 14 | "My Stocks" (manual) | 4 | 5 | **20** | **MVP** |
| 11 | Interview-Prep track | 5 | 4 | **20** | **MVP** |
| 22 | SEO pages + newsletter | 5 | 4 | 20 | GTM workstream, run in parallel and not counted as a feature |
| 8 | Earnings Season Live | 5 | 3 | **15** | **MVP** (with a concierge first; see §7) |
| 4 | Number of the Day | 3 | 5 | 15 | v2, a cheap add-on |
| 2 | Share cards (standalone) | 3 | 5 | 15 | Merged into #1 |
| 21 | Grounded AI tutor | 4 | 3 | 12 | v2 |
| 13 | Thesis Journal | 4 | 3 | 12 | v2 |
| 18 | Certificates | 3 | 4 | 12 | v2, tied to the Interview track |
| 7 | Spaced-repetition deck | 3 | 4 | 12 | v2 |
| 5 | Streak-save through filings | 2 | 5 | 10 | v2, bundled with streaks |
| 6 | Leagues and duels | 3 | 3 | 9 | v2 (leagues need about 1k weekly users to feel alive) |
| 9 | 10-K reading drills | 3 | 3 | 9 | v2 |
| 10 | Valuation Time Machine | 3 | 3 | 9 | Later |
| 12 | Cyclicality Simulator | 3 | 3 | 9 | Later |
| 16 | Investment-club mode | 3 | 3 | 9 | Later, pulled forward if campus pull is strong |
| 15 | Brokerage-linked X-ray | 3 | 2 | 6 | Later, or never; replaced by #14 |
| 17 | Classroom licensing | 4 | 1 | 4 | Later: year 2, starting with college clubs |
| 20 | B2B2C white-label | 4 | 1 | 4 | Later: year 2 |
| 19 | Creator marketplace | 3 | 1 | 3 | Later, or never |

### MVP: 5 features on top of the base lessons and screener

1. **Guess the Company**, with share cards. This is the daily hook and the growth loop.
2. **Screener Quests.** The screener becomes the practice arena.
3. **"My Stocks" (manual).** Personalisation with no aggregation cost and a lower regulatory load.
4. **Earnings Season Live.** Run it by hand as a newsletter during the Q3 season (October–November 2026) before building it.
5. **Interview-Prep track.** The monetisation wedge with the clearest willingness to pay.

### v2 (months 4–9)
- Grounded tutor, limited to "explain my mistake"
- Thesis Journal
- Leagues
- Streak mechanics, including streak-save through a filing
- Certificates
- 10-K drills
- Spaced repetition
- Number of the Day

### Later (month 9 and beyond)
- Classroom and club licensing
- B2B2C
- Time Machine and Cyclicality Simulator
- Brokerage linking, only if users explicitly ask for it *and* counsel is comfortable
- Creator marketplace

**The ruthless cut.** The original "later: linked brokerage holdings" was the most differentiated part of the concept in 2025. **By mid-2026 it is commoditised and it is the riskiest part legally.** Keep the *idea* (lessons built on your own stocks) and drop the *plumbing* (the aggregator).

---

## 3. Positioning and naming

### The sharpest positioning statement

> **"Learn to read any public company's numbers, 3 minutes a day. Drills built from real SEC filings, never stock tips."**

**Long form, for the pitch:** *For serious beginners, finance students and pre-banking recruits who want to actually understand businesses, [Name] is the daily practice app for financial statements and valuation. Every lesson is built from a real company's SEC filings, including the companies you own. Unlike ChatGPT, which answers questions for you, and Finelo, which teaches trading, we make you able to answer the questions yourself, and we prove it with a streak, a score and a credential.*

**Why this line.** It claims three things no competitor holds together:
- **Skill** ("read numbers"), not picks.
- **Real data** ("SEC filings"), not generic cases like WSP, BIWS and CFI.
- **Habit** ("3 minutes a day"), not a $500 course.

"Never stock tips" does three jobs:
- It is the compliance posture (Lowe).
- It is the trust signal against Finelo's billing complaints [S36][S37].
- It is the contrast with AI tools that *do* give opinions.

### Name check (search-level only; not a legal clearance)

| Name | Collisions found | Verdict |
|---|---|---|
| **Tenbagger** | "Tenbagger" stock app on Google Play (`app.tenbagger.android`, contact at tenbagger.app) ([Google Play](https://play.google.com/store/apps/details?id=app.tenbagger.android&hl=de&gl=US) [P]); Tenbagger Capital, an asset manager ([tbamc.com](https://en.tbamc.com/) [U]); a `tenbagger` PyPI package. The term is Peter Lynch's word for a 10x stock ([Wikipedia](https://en.wikipedia.org/wiki/Multibagger_stock) [S]). | **Retire it as the public name.** There is a direct app-store collision in the same category, and the name promises 10x returns, the opposite of "education, not tips", which is bad optics under the Massachusetts gamification lens. Fine to keep as an internal codename. |
| **Unlevered** | No app, startup or brand surfaced in search. | **Recommended**, pending a USPTO search (classes 9 and 41) and a domain check. It is finance-literate, aspirational for students ("unlevered FCF" is interview vocabulary), and hints at "no leverage, no hype". The risk: it is jargon to true beginners. Mitigate with a tagline ("Unlevered: learn to read the numbers"). |
| **Ten-K / TenK** | TENK is the ticker of TenX Keane Acquisition, a SPAC ([Robinhood](https://robinhood.com/us/en/stocks/TENK/) [P]); tenk.club; an open-source "tenk" SEC chat tool on GitHub. "10-K" is the name of an SEC form, so the mark is likely *descriptive* and weak. | Second choice. The meaning is clear but it is hard to protect. |
| **DCF Dojo** | No exact-phrase hits. "Dojo" is a UK payments company (a fintech class-36 neighbour) ([PitchBook](https://pitchbook.com/profiles/company/92516-41) [U]). | Use it as the **sub-brand for the Interview-Prep track**, not the master brand, because it is too narrow. |
| Rejected: Moatly, Tickerwise, Compounder, Footnote, Quarterly, Tenfold, Moat School, StockCraft | Moatly already exists as an AI moat-rating stock app ([getmoatly.com](https://getmoatly.com/) [U]); TickerWise is a trading platform ([tickerwise.net](https://www.tickerwise.net/) [U]); several "Compounder" and "Footnote" apps are on the App Store; "Quarterly: Earnings & Trends" is on iOS ([App Store](https://apps.apple.com/us/app/quarterly-earnings-trends/id6756863358) [P]); StockCraft is a learn-to-invest paper-trading app ([stockcraft.app](https://stockcraft.app/) [U]); Moat School is an edtech company. | Crowded. |

**Avoid "-lingo" names.** Duolingo holds registered marks, and anything implying affiliation invites a likelihood-of-confusion fight ([Justia TM](https://trademarks.justia.com/861/71/duolingo-86171435.html) [P]). "Duolingo for X" is fine in a pitch, never in a name.

**Action for week 1:** run a 1-hour trademark knockout with counsel or on USPTO's own search (tmsearch.uspto.gov) for the top 2 names in classes 9 and 41, plus a .com or .app domain and App Store name reservation.

---

## 4. Pricing and packaging

### Benchmarks

| Product | Price | Source |
|---|---|---|
| Education-app category median | $8.13/mo, $43.94/yr | RevenueCat via BENCHMARKS [S14][S82] [U] |
| Quizlet Plus | $35.99/yr; Unlimited $44.99/yr | [nibble/brighterly](https://brighterly.com/blog/quizlet-cost/) [U] |
| Brilliant Premium | $161.88/yr ($13.49/mo); student discounts only occasional | [Brilliant help](https://brilliant.org/help/pricing-and-plans/how-much-does-brilliant-premium-cost/) [P] |
| Simply Wall St Premium | $131.40/yr or $15.99/mo | [S23] [U] |
| Robinhood Gold (includes Cortex AI) | $5/mo or $50/yr | [Robinhood on X](https://x.com/RobinhoodApp/status/2031731957252448633?lang=en) [P] |
| ChatGPT Plus (includes Plaid linking) | about $20/mo | Price from memory [U]; linking from TechCrunch [S] |
| Finelo | $6.99/wk intro, then $39.99 every 4 weeks after 12 weeks | [Finelo pricing](https://finelo.com/pricing) [P] |
| Spotify Student | 50% off, SheerID verification, up to 4 years | [Spotify](https://support.spotify.com/us/article/premium-student/) [P] |
| WSP Premium / BIWS Premium | $499 / $497 one-time | [TPE](https://theprivateequiteer.com/wall-street-prep-premium-package-review/) [U], [BIWS](https://breakingintowallstreet.com/biws-premium/) [P] |
| CFI (FMVA) | $497/yr Self-Study, $847/yr Full-Immersion | [CFI](https://corporatefinanceinstitute.com/pricing/) [P] |
| Bloomberg Market Concepts | $0 at subscribing universities; about $140–249 retail | [NYU](https://guides.nyu.edu/bloombergguide/bloomberg-certification) [P], [UKY](https://gatton.uky.edu/faculty-research/departments/john-maze-stewart-finance-quantitative-methods/seale-finance-learning) [U] |
| Kahoot (teacher) | about $121–228/yr per teacher | [Kahoot plans](https://kahoot.com/schools/plans/) [P]; figures via [trustradius](https://www.trustradius.com/products/kahoot/pricing) [U] |
| SIFMA Stock Market Game | $10 per team; about 600k students a year | [PFEW](https://www.pfew.org/stock-market-game/how-it-works) [U], [SMG](https://www.stockmarketgame.org/tour/) [P] |
| Duolingo for Schools | Free; closed to new classrooms and sunsetting 2027-07-31 | [Duolingo](https://duolingoschools.zendesk.com/hc/en-us/articles/6830454446093-What-is-Duolingo-for-Schools) [P] |

### Recommended packaging

| Tier | Price | What's in it | Rationale |
|---|---|---|---|
| **Free** | $0 | Full Unit 1 (margins); 1 lesson a day after that; the daily Guess-the-Company; 3 screener quests a week; up to 3 "My Stocks"; 1 Earnings company a week; SEO web pages. | The free tier *is* the habit and the viral loop. Duolingo's subscriber share rose from about 4% to 9% of MAU only after the habit engine matured [S3][S4]. |
| **Pro** | **$12.99/mo or $79.99/yr**, with a 7-day trial on annual only | Unlimited lessons and the advanced units (DCF, ROIC, cyclicality); unlimited My Stocks; full Earnings packs; all screener filters and quests; streak freezes; (v2) the tutor capped at 10 answers a day and the Thesis Journal. | Between Quizlet (the education floor) and Brilliant or SWS (the ceiling). Matches the BENCHMARKS base-case model. Trials of 5–9 days convert at 37.4% [S13]. |
| **Student** | **$39.99/yr**, .edu verified by SheerID or similar | Everything in Pro. | About 50% off, following the Spotify norm. Students are price-sensitive, and they are the evangelists and future full-price payers. |
| **Recruiting Pass** | **$49 one-time for 4 months**, stackable on Free or Student | The DCF Dojo interview track: 150+ drills on real companies, timed mocks, readiness score, and (v2) a certificate. | Priced at 10% of WSP or BIWS. It is a one-time purchase, so it avoids subscription fatigue during a seasonal need. |
| **Edu** (later) | Free teacher dashboard with students on Free; **Classroom Pro at $149 per teacher per year** (all students get Pro inside assignments); **campus or club license $1.5–5k/yr** [assumption] | Assignments, mastery reports, club leaderboards. | Kahoot sets the per-teacher anchor. The Duolingo for Schools sunset leaves an opening. Start with **college investment clubs and finance professors**, not K-12 (FERPA, COPPA and district procurement are too heavy for a solo founder). |

**Pricing rules:**
- **Show the renewal price before checkout,** make cancellation one tap, and never use weekly intro traps. This is our billing-trust contrast with Finelo [S36][S37].
- **Brokerage linking, if it ever ships, is a "Pro+" add-on at about $3/mo** so it pays its own aggregator cost of $1.25–2.50 per user per month. It is never bundled into $79.99.
- **Put the tutor on a cheap model by default**, with escalation to a larger model only on a "still confused" tap. Cap it at 10 answers a day. This keeps AI cost under $0.65 per payer per month (see idea #21).

---

## 5. Retention loop design, mapped to Duolingo's published mechanics

### Evidence base

| Mechanic | What Duolingo reported or was reported | Source |
|---|---|---|
| Company-wide focus on current-user retention (CURR) | CURR was the North Star; retention drove about 4.5x DAU growth before the IPO | [Lenny/Mazal](https://www.lennysnewsletter.com/p/how-duolingo-reignited-user-growth) [S]; [S7] |
| Leagues | +17% learning time; highly engaged learners tripled | [Lenny/Mazal](https://www.lennysnewsletter.com/p/how-duolingo-reignited-user-growth) [S]; mechanics in [Duolingo blog](https://blog.duolingo.com/duolingo-leagues-leaderboards/) [P] |
| Streaks | Called "the single most effective retention lever"; users with streaks of 7+ days retain about 2.4x as well | [Deconstructor of Fun](https://duolingo.deconstructoroffun.com/mechanics/streaks) [U] |
| Streak Freeze | Two freezes beat one, and three were no better than two | Same source, plus the [Lenny podcast with Jackson Shuttleworth](https://www.getrecall.ai/summary/lennys-podcast/behind-the-product-duolingo-streaks-or-jackson-shuttleworth-group-pm-retention-team) [U] |
| Friend Streaks | One-third of DAUs have a Friend Streak; 10M+ users hold streaks of a year or more | Duolingo shareholder letters ([Q4 FY24](https://investors.duolingo.com/static-files/99006c40-d8cf-41ca-b5b1-c5cb1fa5ba88) [P, via snippet]) |
| Notification optimisation | A "sleeping, recovering" bandit chooses reminder templates, trained on 200M notifications | [Yancey & Settles, KDD 2020](https://research.duolingo.com/papers/yancey.kdd20.pdf) [P] |
| Brand virality | Mascot-led TikTok; the "Duo died" stunt drove a 25,000%+ spike in mentions | [Brand24](https://brand24.com/blog/duolingo-social-media-strategy/) [U] |
| Limits of the Duolingo formula | Chess passed 1M DAU and became the fastest-growing subject; Duolingo does not expect math or music to monetize meaningfully near-term | [Q2 FY25 letter](https://investors.duolingo.com/static-files/0b55110c-2eb9-466d-8549-5459e0851290) [P]; [S6] |

**The chess vs. math lesson.** Chess works because it is a *game people already play for fun* with an opponent. Math feels like homework. Investing lessons will default to "math" unless the core loop feels like a puzzle (Guess the Company) or a live event (earnings). That is why those two sit in the MVP.

### The loops

**Daily loop (target: 3–5 minutes)**
1. **Trigger:** a push at the user's chosen time. Copy is picked by a simple bandit over about 8 templates, following Duolingo's recovering-bandit idea. v1 can be an epsilon-greedy rotation.
2. **Action:** today's Guess-the-Company, then 1 lesson or 1 Screener Quest, ideally on a "My Stocks" company.
3. **Reward:** XP, streak +1, and a share card.
4. **Investment:** add a ticker to My Stocks, or (v2) log a thesis claim.
5. **Streak mechanics:**
   - The 8-word rule explanation shown at the first streak ("Do one drill a day; miss a day and it resets"). Duolingo's clarity-copy experiment is reported as a meaningful win [U].
   - **2 freezes maximum**, following Duolingo's finding.
   - A freeze can be *earned* by reading a filing excerpt (idea #5), not only bought.

**Weekly loop**
- **Monday:** the Earnings Week pack drops ("5 companies reporting; here's what to watch").
- **During the week:** "After" lessons land as results post.
- **Leagues** (v2, once at least about 1k weekly learners exist): XP-only, and **XP never comes from anything market-linked** (trades, returns, price guesses).
- **Sunday:** a recap email, "The Weekly 10-K", which also feeds SEO and the newsletter.
- **Friend duels** (v2): an async 1-vs-1 on the same company.

**Seasonal loop (quarterly and annual)**
- **Earnings seasons** (4 a year, about 6 weeks each) are "Seasons" with a badge, a season leaderboard, and a "Season recap" card.
- **Recruiting season:** a DCF Dojo push around the busiest internship-recruiting window. Timing is unverified; confirm with campus finance clubs, and it has moved earlier in recent years.
- **December "Year in Numbers" card:** lessons done, companies mastered, and Thesis Journal accuracy. Designed to be shared.
- **10-K season** (February–March for December fiscal-year filers): a "Read one 10-K this month" challenge.

### Guardrails, turned into product rules

1. There are no trade buttons, broker deep-links or "top movers" lists anywhere. The Mass. v. Robinhood order named popular-stock lists [S].
2. Celebration animations fire only for learning achievements.
3. Leaderboards rank learning (XP, accuracy, streak), never portfolio value or returns.
4. The Thesis Journal grades operating metrics, never price targets.
5. Notifications never mention price moves ("NVDA is down 8%"). They may mention filings ("NVDA just filed its 10-Q").

### Instrumentation from day 1
- D1, D7 and D30 retention by acquisition cohort and by persona (student vs retail)
- CURR, the share of last week's actives active this week
- DAU/MAU
- Lessons per DAU
- Share rate per puzzle
- Trial-start rate among activated users
- Trial-to-paid rate

---

## 6. Red team: 7 ways this fails

Each risk has evidence, a mitigation, and a **kill or pivot criterion**. Dates assume day 0 is **Mon 2026-09-28**.

### 1. No daily habit forms: "finance lessons are homework"
- **Evidence:**
  - Education apps' D30 retention is about 2%, among the lowest of any category ([Business of Apps](https://www.businessofapps.com/data/education-app-benchmarks/) [U]).
  - The cross-category median is D1 26% / D7 13% / D30 7% ([core-mba](https://www.core-mba.pro/tool-hub/mobile-app-retention) [U]).
  - Finance-app D30 is 2–6% [S85].
  - Duolingo itself does not expect math to monetize near-term [S6].
- **Mitigation:**
  - Puzzle-first and event-first loop (§5).
  - My Stocks relevance.
  - Short sessions.
  - Ship streaks only after the core loop retains.
- **Kill or pivot:** by **day 77**, TestFlight cohort 1 (at least 150 activated users) must show **D1 ≥ 35% and D7 ≥ 15%** after 2 iteration cycles. If D7 is below 10%, **pivot to a seasonal, paid-only Interview-Prep product** (the DCF Dojo) where daily habit is not required. If D30 for cohort 1 is below 5% at day 90, the consumer-habit thesis is dead.

### 2. ChatGPT, Perplexity and brokers commoditise the "AI on your stocks" value
- **Evidence:**
  - ChatGPT Plus has had Plaid brokerage linking in the US since 2026-06-25 [S].
  - Perplexity has linked brokerages since 2025 [P].
  - Robinhood Cortex includes portfolio digests in a $5/mo Gold plan [P].
  - Fiscal.ai raised $10M for AI over fundamentals [S57].
- **Mitigation:**
  - Don't compete on answers.
  - Compete on *practice, progression and proof*: streaks, mastery, certificates, the thesis record.
  - The tutor stays scoped to "explain my mistake".
- **Kill or pivot:**
  - In **15+ user interviews by day 21**, if most describe the value as "I'd just ask ChatGPT", reposition fully around the student and credential wedge.
  - In beta, if Pro fake-door conversion stays **below 2% of activated users by day 84**, the consumer Pro thesis fails.

### 3. Freemium doesn't monetise and paid acquisition is unaffordable
- **Evidence:**
  - The freemium median is 2.1% download-to-paid by day 35, against 10.7% for a hard paywall [S13].
  - Finance-category Apple Search Ads cost $13.28 CPA [S17].
  - The base-case break-even CPI is about $2.63 (BENCHMARKS §B4).
- **Mitigation:**
  - A trial-first onboarding A/B against a soft paywall.
  - Student and Recruiting Pass for higher intent.
  - Organic channels only: SEO, share cards, campus clubs, creators paid per acquisition.
- **Kill or pivot:**
  - At the **day-28 landing test**, if fewer than **5% of waitlist sign-ups click "Reserve Pro at $79.99/yr"** (fake door, no charge), re-price or re-segment.
  - At **day 84**, if trial starts are below **8% of activated users** and there are zero Recruiting Pass purchases from 100+ student testers, stop the consumer subscription path.

### 4. Regulatory line-crossing: advice, gamification, or app-store rejection
- **Evidence:**
  - *Lowe* protects impersonal, bona fide publications, not advice "attuned to any specific portfolio" [P].
  - *SEC v. Park* ("Tokyo Joe") denied the exclusion for personalised emailed picks [P].
  - Massachusetts fined Robinhood $7.5M over gamification [S].
  - App Store 5.1.1(ix) requires a legal-entity submitter for financial services [P].
  - "Tenbagger" as a name implies return promises.
- **Mitigation:**
  - The product rules in §5.
  - Drop brokerage linking from the roadmap.
  - LLM refusal and eval tests.
  - Persistent "Education, not investment advice" disclosures.
  - An LLC.
  - Rename.
  - **Budget about $1–2k for a one-time securities-lawyer review** of My Stocks, the Thesis Journal and the tutor before public launch [assumed cost, U].
- **Kill or pivot:** if counsel says My Stocks or tutor outputs about a user's own holdings need RIA registration, **remove the personalised features** and ship the general curriculum only. The product still works, just with less of a hook. If App Review rejects the app twice under 3.1.1 or 5.1.1, ship as a PWA or web app first.

### 5. Data cost and quality eat the business
- **Evidence:**
  - Licensed price and fundamentals data costs about $350–450/mo (from the brief).
  - XBRL tags are messy, and this pipeline had to build tag fallbacks.
  - Earnings 8-K press releases are not XBRL-tagged (§1, #8).
  - EDGAR itself is free with no key, at up to 10 requests per second ([EDGAR guide](https://tldrfiling.com/blog/sec-edgar-api-rate-limits-best-practices) [U]).
- **Mitigation:**
  - Fundamentals from EDGAR only.
  - End-of-day or delayed prices from the cheapest licensable source.
  - Cap the universe at about 500 liquid US names.
  - A deterministic formula layer (CONTRACT.md) with golden tests.
  - Show "as of" dates everywhere.
- **Kill or pivot:**
  - If data costs are **above 30% of net revenue at month 9**, cut the universe or move prices to user-initiated fetches.
  - If users report **more than 1 data or answer error per 200 lessons served** in beta, freeze feature work until it is fixed. A wrong number is fatal to trust in a finance-education product.

### 6. Solo-founder bandwidth and content quality
- **Evidence:**
  - Duolingo runs thousands of experiments at once [U].
  - Well-funded consumer fintechs failed on retention, not capital: Tally raised $172M [S80]; Atom raised about $50M and was sold [S77].
  - An AI-generated lesson error is a trust event.
- **Mitigation:**
  - Scope to the 5 MVP features.
  - Template-generated lessons, not free-form LLM text.
  - AI only for explanations with citations.
  - A weekly "one experiment" cadence.
  - No B2B sales before month 9.
- **Kill or pivot:** if the MVP isn't in TestFlight by **day 56 (week 8)**, cut Earnings Live and the Interview track to content-only and ship. If still slipping, the scope is wrong, not the founder.

### 7. The two personas pull in opposite directions, and the niche is small
- **Evidence:**
  - Paying investing-research audiences are small: Seeking Alpha has about 250k Premium members [U].
  - Finelo's traction is for *trading* education, bought with aggressive paid marketing [S36].
  - Pre-banking students want interview drills; retail beginners want "am I overpaying for my stocks?"
- **Mitigation:**
  - One engine, two front doors: onboarding asks for your goal (Understand my stocks, or Land a finance job) and routes to different first units and paywalls.
  - Measure the personas separately.
- **Kill or pivot:**
  - If the **waitlist has fewer than 1,000 sign-ups by day 45** with warm-traffic landing conversion below 8% ([benchmarks](https://getwaitlist.com/blog/waitlist-benchmarks-conversion-rates) [U]), distribution is the bottleneck. Stop building and fix the channel.
  - At **day 90**, whichever persona has higher D7 *and* higher payment intent becomes the only persona for the next 90 days.

---

## 7. 90-day launch plan for a solo founder

**Calendar anchors:**
- Day 0 is Mon 2026-09-28; day 90 is about 2026-12-27.
- The **Q3 earnings season** (roughly mid-October to late November, when big banks report first) falls inside the plan, so Earnings Live can be tested *by hand* before it is built.
- The **Q4 season in mid-January 2027** is the public-launch target, just after the plan ends.

**Budget guide for the period** [estimates]:
- Data: about $400/mo
- Apple developer account: $99
- LLC and D-U-N-S: about $100–500
- Lawyer: about $1–2k
- Ads tests: $300–500
- Claude API: under $50
- **Total: about $3–4.5k**

**Tools:** RevenueCat (free under $2.5k MTR [S84]), PostHog or Amplitude free tier, Expo EAS/TestFlight, Beehiiv or Buttondown for email, SheerID or manual .edu checks.

| Week (dates) | Build | Validate | Gate or threshold |
|---|---|---|---|
| **W1** (Sep 28 – Oct 4) | Form an LLC; apply for D-U-N-S; enroll the Apple developer account as an **organization** (5.1.1(ix)). Trademark knockout for "Unlevered" and a backup. Landing page with 3 headline variants (skill / real data / interview) and a waitlist with referral ranking (the Robinhood pre-launch playbook [S62]). | Set up analytics. Write the interview script. | — |
| **W2** (Oct 5–11) | A web version of **Guess the Company** (S) posted daily on X, Reddit and TikTok as screenshots. A **fake-door price test**: after sign-up, "Reserve Pro at $79.99/yr" or "Student $39.99/yr", no charge. | 8 user interviews: 4 students (via 3 campus finance and investment clubs) and 4 retail investors. Post on r/SecurityAnalysis, r/FinancialCareers and finance Discords, following each community's rules. | Warm-traffic landing conversion of at least 10% ([benchmark](https://getlaunchlist.com/tools/waitlist-benchmark) [U]). |
| **W3** (Oct 12–18) | Q3 season begins. **Concierge "Earnings Week" newsletter**: 5 companies, a "what to watch" section and 3 quiz questions each, assembled by hand with LLM help. | 7 more interviews (15 total). Measure email open rate, quiz click-through and replies. | Open rate of at least 45%; at least 15% of openers answer a question. |
| **W4** (Oct 19–25) | Second newsletter issue with "after" lessons. Programmatic SEO for 100 tickers × 3 concepts. | **Gate 1 (day 28).** | **Continue if:** waitlist ≥ 500; landing conversion ≥ 10% on warm traffic; Pro reservation ≥ 5% of sign-ups; newsletter open ≥ 45% and answer ≥ 15%. **If 2 or more fail,** re-position (switch the headline or persona) and rerun W2–W4 once. **If they fail again,** stop. |
| **W5** (Oct 26 – Nov 1) | App: in-app Guess the Company; streak v0 (2-freeze cap); XP; share cards. | Newsletter issue 3. | — |
| **W6** (Nov 2–8) | App: Screener Quests (10 quests); My Stocks (manual and CSV); lessons re-targeted to My Stocks. | Newsletter issue 4. | — |
| **W7** (Nov 9–15) | App: Earnings pack UI (fed from the concierge content for now); DCF Dojo v0 (40 drills, 1 timed mock); RevenueCat paywall; persona fork at onboarding. | Newsletter issue 5. Recruit the TestFlight cohort from the waitlist: 100 students and 100 retail. | Build freeze on day 52. |
| **W8** (Nov 16–22) | **TestFlight cohort 1** of about 200 invited, with a target of at least 150 activated (activated means finishing a first lesson). | Daily analytics review; 5 in-app interviews. | **Day 56:** MVP in TestFlight, or cut scope (red team #6). |
| **W9** (Nov 23–29) | Iteration 1: fix the biggest drop-off in the onboarding funnel; tune notification copy (bandit v0). | D1 readout. | D1 ≥ 35%. Education D1 is typically well below the 26% cross-category median, so 35% is deliberately ambitious. |
| **W10** (Nov 30 – Dec 6) | Iteration 2: second-week content (new quests, a new Guess pack). A/B test: trial-first paywall vs. soft paywall. | D7 readout for cohort 1. | — |
| **W11** (Dec 7–13) | **Gate 2 (day 77).** | Cohort 2 (+200) with the paywall A/B live. | **Continue if:** D7 ≥ 15% (above the 13% cross-category median, far above education); lessons per DAU ≥ 2; puzzle share rate ≥ 5%; trial starts ≥ 8% of activated; at least 5 Recruiting Pass purchases or $49 reservations among students. **If D7 < 10%,** pivot to Interview-Prep-only (red team #1). |
| **W12** (Dec 14–20) | Lawyer review of My Stocks and the tutor spec. "Year in Numbers" share card. SEO expanded to 500 tickers. | D30 for cohort 1 lands (it started around day 52). | D30 ≥ 7% (the cross-category median) is the target; below 5% means stop (red team #1). |
| **W13** (Dec 21–27) | Write the **day-90 memo**: go, pivot or stop. Plan the public launch for the Q4 earnings season (mid-January 2027) and the spring recruiting push. | Pick the winning persona and paywall variant. | **Go only if** Gate 2 passed, D30 ≥ 7%, and trial-to-paid in cohort 2 is at least 25%. The RevenueCat trial benchmarks run 25.5–42.5% [S13]. |

**What we deliberately don't build in 90 days:** brokerage linking, leagues, the AI tutor, classroom dashboards, the creator marketplace, and certificates beyond a mock.

**What we measure every Monday:**
- Waitlist size and viral coefficient (invites per sign-up)
- D1, D7 and D30 by cohort and persona
- CURR
- Lessons per DAU
- Share rate
- Trial starts
- Data-error reports per 200 lessons

---

## Appendix: open questions to verify

1. **Tenbagger on iOS.** Whether an iOS "Tenbagger" app and a registered US trademark exist. Search found only the Android app and the tenbagger.app domain.
2. **"Unlevered".** USPTO status, and whether any App Store app uses the name. Search surfaced none; that is not a clearance.
3. **Recruiting timing.** The exact window of IB and ER internship recruiting for the Class of 2029. It has been moving earlier; ask club leaders.
4. **Press-release to 10-Q lag** for the target universe. This decides whether Earnings "After" lessons can run straight off XBRL.
5. **Counsel.** Whether "My Stocks" (user-entered tickers, descriptive math only) and a Thesis Journal that grades operating-metric claims stay within the *Lowe* publisher exclusion and outside state "digital engagement" enforcement.
6. **Duolingo streak and freeze figures.** Taken from secondary teardowns [U]; confirm against Duolingo's own blog or the Lenny podcast transcript before quoting.

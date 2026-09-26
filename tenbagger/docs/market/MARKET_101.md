# Market 101: what "personal finance apps" actually are, and where Tenbagger sits

Prepared 2026-09-26 by the market analyst. Written for a first-time founder: every term is defined once.

**How to read the tags.** `[M3]` is a source in `market/data.json`; `[S13]` is a source in `docs/sources.json` (copied into `data.json` too).
- **[P]** primary: a filing, regulator, or the company's own page.
- **[S]** reputable secondary: established press or a known research firm.
- **[U]** unverified: a blog, a review site, a paid "market report", an aggregator estimate, or our own arithmetic.

**Method caveat (same as the other docs).** WebFetch is still blocked for `sec.gov` (tried 2026-09-26). Every figure comes from search-result snippets that quote the linked page. A [P] tag means "the snippet quotes a primary document", not "I read it". Open the link before quoting a number to anyone.

---

## 0. The answer in one screen

- **"Personal finance apps" is not one market. It is at least six**, and they make money in very different ways: subscriptions, success fees, cash-advance fees, research subscriptions, brokerage revenue, and B2B licensing.
- **Rocket Money is in the biggest consumer-paid one (budgeting and bill tools).** Tenbagger's *money hub* touches it. Tenbagger's *core* (lessons on real SEC filings, the screener and fund X-ray) sits in two other markets: **investing research** and **financial education**.
- **Tenbagger is a hybrid, and no single incumbent looks like it.** On features, the closest products are Simply Wall St (about 34% overlap), YNAB (about 33%) and Koyfin (about 28%). **Rocket Money overlaps about 23%**, and almost all of that is the money hub (§4, and `ROCKET_MONEY_VS_US.md`).
- **The biggest consumer-paid pools are PFM and cash advances.** PFM (personal financial management: the budgeting and tracking apps) is roughly **$0.6–0.8B a year in the US**; Rocket Money alone booked about $390M in FY2025 [M1]. Cash-advance apps plus AI coaches bring in about $1–1.5B, but that money is fee revenue under regulators' scrutiny. Consumer-paid *finance learning* is small: probably low hundreds of millions of dollars worldwide [U, our estimate].
- **What this means for Tenbagger.** The learning side has little direct competition, but that also means little proven spending. The money side has proven spending, but also well-funded incumbents, several of them free for students. Win the learning side, and use the money hub only to bring people back every day.

---

## 1. First, three terms you'll see everywhere

- **PFM (personal financial management).** Apps that link your bank and card accounts and show where your money goes: budgets, bills, net worth. Mint invented the modern version in 2007. Rocket Money, Monarch, Copilot and YNAB are PFMs.
- **Account aggregation.** The plumbing that lets an app read your bank data, usually through **Plaid**. Each connected bank login ("Item") costs the app a monthly fee (MONEY_HUB_RESEARCH §3). This is why most PFMs charge money or sell ads.
- **Freemium vs hard paywall.**
  - *Freemium:* a free tier plus a paid upgrade. The median app converts 2.1% of downloads to paid by day 35 [S13].
  - *Hard paywall:* no free tier, just a trial. Those apps convert 10.7% [S13]. Monarch and Copilot use a hard paywall; Rocket Money and Cleo are freemium.

---

## 2. The six sub-markets

### 2.1 Budgeting and PFM (Rocket Money, Monarch, YNAB, Copilot, PocketGuard, EveryDollar)

| | |
|---|---|
| **What the customer gets** | "Where did my money go, and what's left?" Linked accounts, auto-categorized spending, budgets, upcoming bills and net worth. |
| **How it makes money** | Mostly **subscriptions**, from $7 to $15 a month or about $75–$110 a year. The free ones (Credit Karma, and Mint before it) earn **lead-gen fees** instead: they get paid when you open a credit card or take a loan they recommended. Mint died in 2024 on that model [S74]. |
| **Size** | This is where the "market reports" disagree absurdly. **Budget apps**, global 2025: **$0.25B** (Insight Partners [M24][U]). **Personal finance software**, global 2025: **$1.35B** (IMARC [M22][U]) to **$1.92B** (Research and Markets [M23][U]).<br>Yet **Rocket Money alone had about $390M of revenue in FY2025**, including $351M from subscriptions [M1][P]. The $0.25B figure therefore can't be right.<br>**Our bottom-up for the US:** Rocket Money (about $390M) + YNAB (about $50–100M [M17][U]) + Monarch (plausibly about $50M from 500k+ payers at about $100 [S29][U]) + Copilot, PocketGuard, EveryDollar and others ≈ **$0.6–0.8B a year** [U]. |
| **Growth** | The reports say 4.5–8.5% a year [M22][M23]. The leader grew much faster: Rocket Money subscription revenue rose **+31% in 2025** ($267M → $351M) [M1][P]. Mint's shutdown sent paid users to Monarch (about 20x growth [S28]) and Copilot [S32]. |
| **Customers** | Salaried adults aged 25–45, couples and households. They are organized, a little anxious, and already have several accounts. |

**Lesson:** people *do* pay about $100 a year to see their own money clearly, but the paid products are built for salaried households, not for students with irregular income (MONEY_HUB §1).

### 2.2 Subscription and bill tools (Rocket Money's origin, Trim, bank-app features)

| | |
|---|---|
| **What the customer gets** | "Find the subscriptions I forgot, cancel them for me, and lower my internet or phone bill." |
| **How it makes money** | A **success fee**: Rocket Money keeps **35–60% of the first year's savings** when a bill negotiation works [M7][P]. It also uses cancellation as a hook into a Premium subscription. |
| **Size** | No credible standalone figure exists. Rocket Money's non-subscription revenue was about **$39M in FY2025** ($390M − $351M). That is our inference, and it may include items other than negotiation fees [M1][U]. |
| **Trend** | The feature is being **absorbed**. Banks and card issuers now show subscriptions natively, and every PFM detects recurring charges. As a standalone business, it is shrinking into a feature. |
| **Customers** | Anyone with 5+ subscriptions; mostly not students. |

### 2.3 AI money coaches and cash-advance apps (Cleo, Dave, Brigit, EarnIn, MoneyLion, Albert)

| | |
|---|---|
| **What the customer gets** | A chatty assistant ("you spent $140 on DoorDash, bestie") **plus small cash advances** of $25–$500 before payday. |
| **How it makes money** | Subscription tiers that unlock advances, "express" fees for instant delivery, and tips. Cleo's tiers are $5.99–$14.99 a month [M15][U], plus express fees (MONEY_HUB §1). |
| **Size** | Bottom-up, about **$1–1.5B a year in the US** [U, our sum]:<br>• Dave: FY2025 revenue guidance of **$544–547M** [M26][P]<br>• Cleo: **$280M ARR** in July 2025, up from $185M at the end of 2024 [M13][S]<br>• MoneyLion, Brigit and EarnIn on top of those |
| **Growth** | Fast: Cleo roughly doubled; Dave grew +63% in Q3 2025 [M26]. **But the growth is lending-adjacent:**<br>• FTC settlement with Cleo: **$17M**, 2025 [M16][P]<br>• FTC settlement with Brigit: **$18M**<br>• The FTC and DOJ case against Dave is pending (MONEY_HUB §4) |
| **Customers** | Gen Z and young millennials living paycheck to paycheck, the persona closest to Tenbagger's "can I cover the card" student. |

**Lesson:** this is the market that monetizes Tenbagger's persona best. It does so through advances, which Tenbagger has ruled out permanently (MONEY_HUB §4). **Cleo proves students will pay a few dollars a month for a friendly money app. Our job is to prove they will pay for help that isn't credit.**

### 2.4 Investing research and tools (Simply Wall St, Seeking Alpha, Koyfin, Stock Analysis, Fiscal.ai, Morningstar Investor)

| | |
|---|---|
| **What the customer gets** | "Is this company any good?" Fundamentals, charts, screeners, ratings, and increasingly AI summaries. |
| **How it makes money** | Research subscriptions from $79 a year (Stock Analysis) to $299 a year (Seeking Alpha), and $39–$79 a month for Koyfin, plus ads on free pages (BENCHMARKS §1). |
| **Size** | **No credible report exists.** Disclosed or estimated players sit at the $10–100M scale each; Seeking Alpha, for example, is estimated at $25–50M [S45][U]. Our rough guess for the US segment is **$0.5–1.5B**, including Morningstar Investor and Motley Fool subscriptions [U, low confidence]. |
| **Growth** | Moderate. **AI is commoditizing "explain this stock"**: Robinhood bundles its Cortex AI into $5-a-month Gold [S60], Fiscal.ai raised $10M [S57], and ChatGPT reads filings. |
| **Customers** | Self-directed retail investors aged 25–60, mostly male, with a portfolio. Students mostly use the free tiers. |

**Lesson:** Tenbagger's screener, company pages and fund X-ray compete *here*. The research itself is being given away. What sells is **the explanation, the progression and the habit**.

### 2.5 Broker apps with learning built in (Robinhood Learn and Cortex, Public Alpha, Webull, Fidelity and Schwab education)

| | |
|---|---|
| **What the customer gets** | A free brokerage account, with free lessons and AI research attached. |
| **How it makes money** | **Brokerage economics**: payment for order flow (market makers pay the broker to route its customers' orders to them), interest on cash, margin lending, and bundles like Gold. The education is free, because it is there to keep users active. |
| **Size** | The revenue pool is huge, but it is not an education market. Robinhood alone made **$4.5B in FY2025** (+52%), and Gold reached 4.2M subscribers at year-end [M21][P] and 4.8M by Q2 2026 [S61][P]. |
| **Customers** | Anyone investing, and young people especially; this is where Gen Z starts investing. |

**Lesson:** brokers are **distribution partners, not rivals**. They give their learning away free, so Tenbagger can't out-free them. It has to out-teach them, and could be licensed to them later (BENCHMARKS §1.13).

### 2.6 Financial education and gamified learning (Zogo, Finelo, Brilliant; Duolingo as the mechanics benchmark; CFI and WSP at the advanced end)

| | |
|---|---|
| **What the customer gets** | Bite-sized lessons, quizzes, streaks and rewards, with "learn money" as the job to be done. |
| **How it makes money** | Three very different models:<br>1. **B2B2C licensing** (sold to an institution, which gives it free to its own members): Zogo is licensed by 250+ banks and credit unions and is free to users, with 2M+ users [M27][P].<br>2. **Paid web funnels**: Finelo charges an intro price that renews at $39.99 per 4 weeks [S36][U].<br>3. **One-off professional courses**: CFI, WSP and BIWS at about $500 (BENCHMARKS §1.14). |
| **Size** | The market reports say **$5.0–12.8B a year globally in 2025** [M25][U], but that is mostly schools, nonprofits and bank programs. The **consumer-paid app slice is small, probably low hundreds of millions of dollars globally** [U, our estimate]. Finelo's claimed 1–2M payers [S33][U] are the only big consumer number, and they are unaudited. |
| **Growth** | The reports say 6.8–12.6% a year [M25]. The structural tailwind is that **39 US states now require a high-school personal finance course** (MARKET_ENTRY §3). |
| **Customers** | Teens and college students (via schools or banks), career-switchers, and finance recruits (the advanced end). |

**Lesson:** people want to learn money (§ CONSUMER_PREFERENCES), but few pay for it directly. The paid exceptions sell an **outcome**: a job (CFI or WSP), or a promised trading skill (Finelo).

---

## 3. Summary table

| Segment | Revenue model | Rough size (US unless noted) | Main customer | Tenbagger overlap |
|---|---|---|---|---|
| Budgeting / PFM | Subscription ($75–110/yr) or lead-gen | ~$0.6–0.8B bottom-up [U]; reports $0.25–1.9B global [U] | Salaried households | **Partial**: the money hub |
| Subscription & bill tools | Success fees (35–60%) + subscription | ~$39M implied (Rocket) [U] | Anyone with many subscriptions | **None** (we don't cancel or negotiate) |
| AI coach / cash advance | Subscription gating advances + fees | ~$1–1.5B [U] | Paycheck-to-paycheck Gen Z | **Same persona, different product.** We refuse advances. |
| Investing research | Research subscription ($79–299/yr) | ~$0.5–1.5B [U, low] | Self-directed investors 25–60 | **Partial**: screener, company pages, fund X-ray |
| Brokers with learning | Brokerage revenue; education free | Robinhood $4.5B [P] (not an education pool) | Young investors | **Low**: potential partners |
| Financial education | B2B2C license, web funnel, pro courses | Reports $5–12.8B global [U]; consumer apps small [U] | Students, recruits | **Core**: lessons |

The segment sizes in `data.json` → `segments` use the same numbers.

---

## 4. Where Tenbagger sits: which markets it overlaps and which it doesn't

```
                      personal / your own data (10)
                               |
          Monarch  Copilot  Rocket Money  PocketGuard
          YNAB     Cleo     Robinhood   Credit Karma
                               |
                 TENBAGGER (4,7)   <- learn-first, but uses YOUR data
                               |
  learn (0) ---------- Simply Wall St (5,5) ----- Koyfin ------- manage money (10)
                               |        Seeking Alpha
       Finelo  Zogo            | Stock Analysis
       Duolingo                |
                      general content (0)
```
The coordinates are in `data.json` → `competitors[].position`. They are author judgment.

**Overlaps:**
- **Financial education.** This is our core, and the only place we plan to be clearly best: lessons on *real* SEC numbers, not generic cartoons.
- **Investing research.** The screener, company pages and fund X-ray compete with Simply Wall St, Koyfin and Stock Analysis. Research here is being commoditized, so treat it as the lesson's playground, not as the product.
- **PFM, a thin slice.** Safe-to-spend, "can I cover the card", a pending-pay log and the Personal 10-K. This is where Rocket Money, YNAB, Monarch and Cleo live.

**Doesn't overlap:**
- Subscription cancellation and bill negotiation.
- Cash advances and credit building. This is a deliberate, permanent no.
- Brokerage and trading. We never execute trades.
- Household or couples budgeting and multi-year forecasting. That is Monarch's turf.

**The white space we claim.** Lessons that use *real company filings* and then apply the same metric to *your own money* ("Costco's current ratio → your liquidity"). Nobody in any of the six segments does this (BENCHMARKS §D; MONEY_HUB §5).

**The honest risk.** The white space might be empty because nobody wants it. CONTRARIAN (2026-09-26) warns that the budgeting side fights incumbents who are free for students: YNAB gives students 12 months free [M18], and so does Monarch for .edu accounts (MARKET_ENTRY §3). The market data supports that warning: the paid PFM money goes to salaried households, and the money made from our exact persona goes to cash-advance apps.

---

## 5. What this means for Tenbagger (one line each)

1. **Say "investing-learning app with a money check-in", not "budgeting app".** Budgeting puts us next to Rocket Money's 4M payers and YNAB's free student year.
2. **Price against learning and research, not PFM.** Student pricing of $39.99 a year sits below every PFM ($75–110) and below Simply Wall St ($131) (PRODUCT_STRATEGY §4).
3. **Brokers and banks are channels.** Zogo's 250+ financial-institution licenses show that the B2B2C route works for finance learning.
4. **Never copy the cash-advance monetization**, even though it is the one that pays best for our persona.
5. **Programmatic SEO pages built from SEC data** are the cheapest way into the research segment (BENCHMARKS §1.10).

---

## 6. What could not be verified

- All the market-report sizes are [U]: paywalled, inconsistent, and in one case smaller than a single company's revenue. **Do not put them in a deck.** Use the bottom-up figures, with their arithmetic shown.
- Rocket Money's **total** revenue of $390M vs **subscription** revenue of $351M: both come from snippets of Rocket filings. The split between them (negotiation fees vs other) is our inference.
- YNAB, Monarch, Copilot and Simply Wall St revenue are not public.
- The feature-overlap percentages are our own scoring. The method is in `data.json` → `overlap_method`.

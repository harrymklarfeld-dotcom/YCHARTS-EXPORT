# Rocket Money vs Tenbagger: how similar are we, really?

Prepared 2026-09-26 by the market analyst. Tags **[P]/[S]/[U]** and source IDs work as in `MARKET_101.md`: `M#` is in `market/data.json` and `S#` is in `docs/sources.json`. Every figure comes from search-result snippets, because sec.gov and company sites are blocked for full fetches from this sandbox. Open the link before you quote a number.

---

## 0. The honest answer

**About a fifth similar (~23% feature overlap), and almost all of that fifth is the money hub.**

- **What Rocket Money is.** A **money-management and savings utility**. It finds and cancels subscriptions, negotiates bills, tracks spending and budgets, shows net worth and credit score, and moves money into savings automatically. It makes money when you *save* or *stop spending*.
- **What Tenbagger is.** A **learning app**. You learn to read real companies' numbers, then apply them to your own money. We make money if you *keep learning and coming back*.
- **Where the two collide.** Both show your balance, upcoming bills and "what's left". A student who only wants that will pick Rocket Money's free tier, not us.
- **What Rocket Money doesn't do.**
  - Teach anything.
  - Research stocks or funds.
  - Model pay you've earned but haven't received yet.
  - Answer "will I cover my card by the due date?" with a yes or no.
  - Speak to students.

In one line: **Rocket Money is a competitor to our money hub, not to our product.** If the money hub becomes the headline, we become "Rocket Money with homework" (the MONEY_HUB red-team #1 warning). If lessons stay the headline, Rocket Money is mostly irrelevant, except as a benchmark for how to monetize.

---

## 1. Rocket Money deep dive

### 1.1 Company history

- **Founded** in 2015 as **Truebill** (Silver Spring, MD) [U, from memory; not re-verified].
- **Acquired** by Rocket Companies (NYSE: RKT, the parent of Rocket Mortgage) for **$1.275B in cash**. Announced 2021-12-20 and closed in December 2021. At the time it had **2.5M+ users (doubled in a year)** and was "on track for **$100M ARR**" [M5][P].
- **Renamed** Rocket Money in 2022 [U].
- **Why a mortgage company bought a budgeting app.** Rocket wants a direct, daily relationship with millions of consumers that it can later turn into mortgages, refinances and loans. This matters for competition: **Rocket Money's acquisition cost is partly subsidized by the mortgage business**, so it can outspend any standalone app on ads.

### 1.2 Every major feature

| Feature | What it does | Free or Premium | Source |
|---|---|---|---|
| Account linking | Connects bank, card, loan and investment accounts through an aggregator | Free | [M8][P] |
| **Subscription detection** | Automatically lists recurring charges once accounts are linked | Free | [M6][P] |
| **Concierge cancellation** | "Cancel for me": Rocket's team cancels the service and tries to get refunds | Premium | [M6][P]; [M8][P] |
| **Bill negotiation** | Staff call providers (internet, phone, cable, insurance and similar) to lower bills | All tiers. Fee of 35–60% of first-year savings; **free on Premium+** | [M7][P] |
| Spending tracking and categories | Auto-categorized transactions, spending insights | Free (basic) | [M8][P] |
| Budgets | Category budgets. Premium gives **unlimited** budgets | Free limited, Premium unlimited | [M8][P] |
| Upcoming bills and "left to spend" | Bill calendar. Amount left over after bills and card payments before the next payday | Free | MONEY_HUB §1 [P] |
| Alerts | Low-balance (default $200), large transactions, bill changes | Free | MONEY_HUB §1 [P] |
| **Net worth** | Assets minus debts across linked accounts, including investment *balances* | Premium | [M6][P] |
| **Credit score and reports** | Experian report with a FICO 2 score | Premium | [M6][P] |
| **Smart Savings (autopilot)** | Moves small amounts every 1–3 business days into a savings account, sized to your balance and spending | Premium | [M6][P] |
| Real-time sync, export, shared access | Faster refresh, CSV export, partner sharing | Premium | [U]: review-site descriptions only |

**What it does not have:**
- lessons or education of any kind
- stock or fund research, a screener, or holdings analysis beyond balances
- forecasting of pay that hasn't landed yet
- a "yes or no, covered by the due date" answer
- any student positioning

### 1.3 Pricing and the premium model

| Tier | Price | What it adds |
|---|---|---|
| **Free** | $0 | Linking, subscription list, basic budgets, bills, alerts |
| **Premium** | **"Pay what's fair": you choose $7–14 a month** | Cancellation concierge, unlimited budgets, net worth, credit, Smart Savings |
| **Premium+** | **About $15 a month** | Everything in Premium, plus **bill negotiation with no success fee** |

Sources: [M6][P]; [M10][U]. Annual pricing exists, but we did not verify the amount.

**Why "pay what's fair" is clever.**
- It turns the price into a personal decision instead of a comparison with competitors.
- It still anchors at $7 or more.
- It lets price-sensitive users feel generous.

It is also a complaint magnet: several reviews say "pick $7, not $14" [M10][U].

**Implied revenue per payer** [U, our arithmetic]:
- Subscription revenue was $351M in FY2025 [M1].
- Premium members were 4.1M at the end of 2024 [M2]. The end-2025 figure was not found; assume an average of about 4.5–5M over the year.
- That implies **about $70–78 per payer per year, or about $6–6.5 a month**.
- Most people therefore pay close to the $7 floor, or less through annual plans and discounts.
- **Takeaway:** a mass-market money app lands at about $6 a month per payer, which is close to our planned Student price ($39.99 a year, or $3.33 a month).

### 1.4 Bill negotiation economics

**How the fee works** [M7][P]:
- The fee is **35–60% of the first 12 months of savings**, charged only if the negotiation succeeds.
- It is billed about 48 hours after success, unless you set up a payment plan.
- **Premium+ members pay no fee.**

**Worked example** [our arithmetic]:
- Rocket Money gets a $90/mo internet bill cut to $70/mo, saving $20 a month.
- First-year savings: $240.
- Rocket's fee: **$84–144**, taken up front.
- The customer keeps $96–156 in year 1 and all of the savings after that.

**Why it's a good business:**
- The staff cost is a phone call or chat, and much of it is now automated.
- The fee is often larger than a year of Premium.
- Premium+ exists to turn heavy negotiators into subscribers.

**Scale.** Total Rocket Money revenue was about $390M in FY2025 against $351M from subscriptions, which leaves **about $39M from negotiation fees and other items** [M1][U: the split is our inference]. **Negotiation is the hook and a sideline. Subscriptions are the business.**

**Why it causes complaints:**
- Some users didn't realize a negotiation was happening until the fee landed.
- Some "monthly savings" turned out to be a one-time credit [M9][M10][U].

**For Tenbagger:** don't build this. It is operations-heavy, it isn't relevant for students (their phone and internet bills are often on a parent's plan), and it brings a billing-trust risk.

### 1.5 Scale

| Metric | Value | Source |
|---|---|---|
| Premium (paid) members | **4.1M at the end of 2024**, adding "over 1M" year on year | [M2][P] |
| Total members | "10M+" (company marketing claim) | [U] |
| Rocket Money subscription revenue | **$179M (2023) → $267M (2024) → $351M (2025)**: +49%, then +31% | [M1][P] |
| Rocket Money total revenue, FY2025 | About **$390M**, up $93M, "primarily due to growth in paying subscribers" | [M1][P via snippet] |
| Growth, Q2 2025 | Rocket Money revenue +$22.8M (+31%) year on year | [M4][P] |
| Growth, Q2 2026 | Rocket Money revenue +$20M year on year, again from paying subscribers | [M3][P] |
| Where it's reported | Inside Rocket's "All Other" segment, alongside Redfin and Rocket Loans. Rocket does not publish a standalone P&L for it. | [M3][P] |

The latest member count we found is from the end of 2024. The 2025 and 2026 releases, as seen in snippets, only describe growth in words.

### 1.6 Growth channels

1. **Podcast ads at industrial scale.**
   - 9,813 sponsored episodes across 764 podcasts [M11][U].
   - The ads are host-read, in the "I found $X in subscriptions I forgot" format.
2. **YouTube creator integrations.**
   - About 1.4k creators and 4.1k sponsored posts, with about 1.3B total views and about 309k views per post.
   - The creators include mega-channels aimed at a young audience, such as Ryan Trahan and Danny Gonzalez [M12][U].
   - **Many of these viewers are exactly our age group.**
3. **Parent subsidy and cross-sell.** Rocket's mortgage economics justify a CAC that a standalone app couldn't afford (see §1.1). [Inference]
4. **The product itself is the ad.** "We found you $X of subscriptions" is an instant, concrete win in the first session, and people share it.
5. **App Store search.** 285k iOS ratings keep it at the top for "budget" and "subscription" searches [M9][U].

**Lesson for Tenbagger.** Rocket Money's creator-ad machine sets the price of attention in personal finance, and it is a price we cannot pay (BENCHMARKS §B4). But its **first-session "found you money" moment** is the pattern to copy. Our version is: "In 90 seconds, see whether your card is covered by the 14th." Or, on the learning side: "You just read Costco's margins better than most adults."

### 1.7 App Store rating, praise and complaints

**Ratings** [M9][U]:
- iOS: **4.5★ from about 285k ratings**
- Google Play: **4.6★ from about 117k**
- Trustpilot: **3.5★ from about 4.1k**

The gap between store ratings and Trustpilot is typical. The unhappy users go to Trustpilot and the BBB.

**Top praise:**
1. Automatic subscription discovery ("found $X I forgot").
2. One-tap or concierge cancellation.
3. A clean dashboard for budgets and bills.
4. Bill negotiation when it works.

**Top complaints:**
1. **Negotiation fees** that surprised the user, or savings that were a one-time credit.
2. **Hard to cancel Premium** itself (the irony gets noticed).
3. Bank sync errors and account lockouts, for example after a phone-number change or a 2FA failure.
4. Support is email-only and slow.
5. The price-choice screen feels manipulative.

Sources: [M9][M10][U]. This is a summary of review-site mining, not our own scrape.

---

## 2. Side-by-side feature matrix: Tenbagger vs Rocket Money

**How to read this matrix:**
- **Weight** is how much each feature matters to *Tenbagger's* value proposition. The weights sum to 100.
- **Score:** ● = has it (1.0), ◐ = partial (0.5), ○ = doesn't have it (0).
- **Overlap** = Σ(weight × score) = the share of *our* product that Rocket Money also delivers.

| Area | Feature | Weight | Tenbagger | Rocket Money | Note |
|---|---|---|---|---|---|
| Learn | Duolingo-style lessons on real SEC financials | 20 | ● | ○ | Our core. RM has no learning. |
| Learn | Streaks, XP, gamified habit | 8 | ● | ○ | |
| Learn | Personal-finance lessons (budgeting styles, credit) | 4 | ● | ○ | |
| Research | Friendly stock screener | 10 | ● | ○ | |
| Research | Company pages and compare | 6 | ● | ○ | |
| Research | Fund X-ray (look-through holdings, fees) | 8 | ● | ○ | |
| Research | Holdings tracking | 4 | ◐ (planned) | ◐ (balances only, in net worth) | |
| Money hub | Safe to spend until payday | 8 | ● | ◐ | RM's "left to spend" uses *past* deposits only |
| Money hub | "Can I cover the card?" (yes/no by due date, statement balance) | 8 | ● | ◐ | RM shows bills and low-balance alerts, not a coverage answer |
| Money hub | Pending-pay / work log (earned but not yet paid) | 4 | ● | ○ | Nobody has this (MONEY_HUB §1) |
| Money hub | Personal 10-K (your finances as a company report) | 5 | ● | ○ | |
| Money hub | Budgets and upcoming bills | 6 | ◐ | ● | |
| Money hub | Net worth | 4 | ◐ | ● | |
| Money hub | Bank linking | 3 | ◐ (1 Item free, gated) | ● | |
| Money hub | Student pricing | 2 | ● | ○ | |
| **Overlap with Tenbagger** | | **100** | | **≈ 23%** | |

**Features Rocket Money has and we don't (and shouldn't build):** subscription detection and cancellation, bill negotiation, credit score, automated savings transfers, partner sharing.

**Reverse overlap.** Rocket Money's own value is roughly 40% subscriptions and bills, 25% budgets and bills, 15% net worth and credit, 10% savings and 10% alerts (our judgment). By that yardstick, **Tenbagger covers maybe 20–25% of Rocket Money**: budgets and bills, net worth, and a better version of "left to spend".

**Overlap within the money hub alone.** Rocket Money covers ≈ 45% of our hub's features, and 0% of our learning and research features.

---

## 3. The same compact treatment for six more

The overlap percentages use the same weights (see `data.json` → `overlap_method`).

### 3.1 Monarch: ~27% overlap

- **What it is:** a paid PFM for households. It covers budgets, recurring charges, net worth and investment holdings, and adds **forecasting in Monarch Plus** (April 2026) [M45][P].
- **Price:** $14.99 a month or $99.99 a year; Plus $199 a year. **No free tier**, and a 7-day trial [S30][S]. For students, **.edu accounts get 12 months free** (MARKET_ENTRY §3, per Monarch's "what's new" page [P] and The College Investor [U]).
- **Scale:** about 1M users and 500k+ payers [S29][U]. Raised a **$75M Series B at an $850M valuation** in May 2025 [S28][S].
- **Rating:** iOS **4.9★ from about 70k ratings** [M19][U].
- **Praise:** couples and household view, clean design, reliable sync.
- **Complaints:** price; recurring charges missed when amounts or dates vary (MONEY_HUB §1).
- **Why the overlap is ~27%:** budgets, net worth, holdings, partial safe-to-spend and card coverage, and student pricing. **No learning and no research.**
- **What it means for us:** the best paid PFM, built for salaried couples. Don't fight it on budgeting. A graduate who "grows up" may move to Monarch, and that's fine.

### 3.2 Copilot Money: ~21% overlap

- **What it is:** a beautiful iOS-first PFM with AI categorization.
- **Price:** $13 a month or $95 a year. Hard paywall [S31][U].
- **Scale:** 100k+ subscribers; "a majority open it daily" [M20][U]. $6M Series A in 2024 [S32][S].
- **Rating:** iOS **4.8★ from about 30k** [M20][U].
- **Praise:** design (an Apple Design Award finalist), calm charts, daily-open habit.
- **Complaints:** no Android; its cash-flow view "only looks at what happened up until today" (MONEY_HUB §1 [P]).
- **What it means for us:** Copilot proves **design quality can create a daily habit in a finance app**. It is our tone benchmark for the money hub (DESIGN_PSYCHOLOGY §1.1).

### 3.3 YNAB: ~33% overlap (the closest PFM, and the most instructive)

- **What it is:** zero-based budgeting ("give every dollar a job"). Its **credit-card payment category** answers "can I cover the card?" by design. It has **a strong irregular-income method** [M46][P] and runs **free workshops, making it the only PFM that teaches**.
- **Price:** $14.99 a month or $109 a year. **12 months free for college students** [M18][P].
- **Scale:** about 196 staff, bootstrapped, founded 2004 [M17][U]. Revenue is estimated at $49–100M [U].
- **Praise:** it "changed how I think about money"; a devoted community.
- **Complaints:** a steep learning curve, manual effort, and the price after the free year.
- **Why the overlap is ~33%:** YNAB already covers safe-to-spend, card coverage and personal-finance teaching.
- **What it means for us:** **YNAB is the real incumbent for the hub's "am I okay?" promise, and it is free to students for a year.** Our only edges are:
  1. the pending-pay log, for money earned but not yet paid
  2. a 4-input setup instead of a budgeting method
  3. the tie-in to investing lessons

  That is exactly why CONTRARIAN (2026-09-26) says to shrink the hub to one number.

### 3.4 Cleo: ~19% feature overlap, but the **highest customer overlap**

- **What it is:** a chat-first AI money coach for Gen Z. Its **"roast mode"** jokes about your spending. It adds budgets, cash advances of $20–$250 and credit building.
- **Price:** Free; Plus $5.99, Pro $8.99 and Builder $14.99 a month, plus express fees [M15][U].
- **Scale:** **$280M ARR in July 2025, up from $185M** [M13][S]. About 7M users and about 700k payers in late 2024 [M14][U].
- **Rating:** iOS about 4.6–4.7★; Android 4.3★ [U].
- **Praise:** it is funny and non-judgmental, and it "gets" young people.
- **Complaints:** advance amounts are far below what was promised ("$250 promised, $20 paid" [M43][U]); hard to cancel. **An FTC settlement of $17M in 2025** [M16][P].
- **What it means for us:** Cleo proves a **Gen Z voice plus a small monthly price** works at scale. But its revenue comes from lending. Borrow its tone, never its business model.

### 3.5 Simply Wall St: ~34% overlap (the closest on features overall)

- **What it is:** visual "Snowflake" fundamentals, a screener, portfolio sync, and auto-generated news.
- **Price:** Free (5 reports a month); Premium $131.40 a year or $15.99 a month; Unlimited $258 a year [S23][U].
- **Scale:** "7M+ investors" (undated [S21][P]). Raised about **$2.5M, including $1.8M from its own customers** [S22][S].
- **Rating:** app about 4.6★; Trustpilot 4.2★ [M44][U].
- **Praise:** makes fundamentals understandable at a glance.
- **Complaints:** price; no guidance on what to *learn* next.
- **Why the overlap is ~34%:** screener, company pages, holdings, part of fund X-ray, and "half" of our lessons, because its visuals do explain.
- **What it means for us:** our nearest neighbour on the *product*. The difference is **curriculum and progression**, plus the personal-money bridge. Its customer-funded, content-led growth is a model for a small team (BENCHMARKS §1.2).

### 3.6 Duolingo: ~8% feature overlap, but it is the **engagement benchmark**

- **What it is:** gamified micro-lessons with streaks, leagues and a mascot. It has no finance content.
- **Scale:** **140.6M MAU and 58.7M DAU** (DAU/MAU about 42%); **12.7M paid subscribers** at Q2 2026 [S1][P]. **Subscribers were 9.2% of MAU** in FY2025, up from about 4% in 2020 [S3][S4][P].
- **What it means for us:**
  - Duolingo is the proof that *learning can be a daily habit*, and the numbers to aim at are DAU/MAU and the paying share of MAU.
  - Duolingo's own math and music subjects aren't expected to monetize meaningfully in the near term (BENCHMARKS §1.1). **Even Duolingo struggles to make a new subject pay.**
  - Instrument D1/D7/D30 retention from day one (D1 = the share of users who come back the day after install; D7 and D30 likewise).

---

## 4. Summary scoreboard

| Product | Segment | Price | Scale | Feature overlap | Customer overlap (students) | Threat |
|---|---|---|---|---|---|---|
| Simply Wall St | Research | $131/yr | 7M users | **34%** | Medium | Medium: closest product |
| YNAB | PFM | $109/yr, **free year for students** | ~$50–100M rev [U] | **33%** | Medium | **High for the hub** |
| Koyfin | Research | $39–79/mo | 500k | 28% | Low | Low |
| Monarch | PFM | $99.99/yr, **free year for .edu** | 500k+ payers [U] | 27% | Low | Low–medium |
| Robinhood | Broker | Free / Gold $5 | 28M funded | 26% | **High** | Medium (free AI research) |
| **Rocket Money** | PFM + bills | $7–15/mo | **4.1M payers, $351M subs rev** | **23%** | Medium | Medium, **for the hub only** |
| Copilot | PFM | $95/yr | 100k+ | 21% | Low | Low |
| Cleo | AI coach + advances | $5.99–14.99/mo | $280M ARR | 19% | **High** | Medium (voice, attention) |
| Duolingo | Learning (non-finance) | ~$7–13/mo | 140M MAU | 8% | High | Benchmark, not a rival |

---

## 5. What this means for Tenbagger

1. **Rocket Money is not "what we're building".** Stop comparing the whole product to it. Compare the *hub* to it, and compare the *product* to Simply Wall St plus Duolingo.
2. **If the fake-door test (MARKET_ENTRY D1) shows the hub headline winning, the real competitors become YNAB (free for students), Rocket Money (free tier) and Cleo (Gen Z voice).** That fight is expensive. Go in with the pending-pay log and the yes/no card answer, nothing broader.
3. **Copy three things from Rocket Money:**
   1. the concrete first-session win
   2. price anchoring of the "pay what's fair" kind (our version: show the $79.99 anchor before $39.99 Student)
   3. creator sponsorships aimed at a young audience, bought on revenue share, not flat CPM
4. **Avoid two:** surprise fees and hard cancellation. They are Rocket Money's and Cleo's top complaints, and our trust brand depends on doing the opposite.

## 6. Could not verify

- Rocket Money's paid-member count for 2025 and 2026. Only the end-2024 figure (4.1M) was found.
- The total-revenue ($390M) vs subscription-revenue ($351M) split. What makes up the $39M difference is not confirmed.
- Rocket Money's annual price, and its Premium+ price beyond "about $15/mo" from its own pricing page snippet.
- Cleo's user and payer counts come from Sacra [U]. The ARR comes from press quoting the CEO [S].
- All app ratings come from review sites quoting the stores [U]. They change weekly.

# Tenbagger — Market & Benchmark Analysis

Prepared 2026-09-25 by the research agent. The full source list, with dates and confidence tags, is in `sources.json`. In this document, `[S12]` means source ID 12 in that file.

**Confidence tags**
- **[P]** Primary: an SEC filing, company IR page, company press release or the company's own website.
- **[S]** Reputable secondary: established press such as TechCrunch, CNBC or Forbes, or a recognised research publisher such as RevenueCat, SplitMetrics, Apptopia or Similarweb.
- **[U]** Unverified: a blog, a review site, an aggregator estimate (Latka, Sacra, Tracxn, Owler) or an AI-generated summary.

**How the research was done.** WebFetch was blocked by the sandbox's egress proxy. For example, `revenuecat.com` returned `EGRESS_BLOCKED`, and the contract says `sec.gov` is also blocked. As a result, **no page was opened and read in full**. Every figure below comes from search-engine result snippets that summarise the cited URL. A [P] tag therefore means "the snippet says this comes from a primary document". It does not mean "I read the filing". Before any number goes into an investor deck, open the URL and confirm it. §6 lists the figures that most need checking.

---

## 0. Executive summary

1. **The paying market exists, but it is small per product.** The closest investing analogs have a few hundred thousand paying subscribers at most:
   - Seeking Alpha: about 250k Premium members [U]
   - Monarch: more than 500k payers [U]
   - Finelo: claims 1.15–2M "premium users" [U]
   - Copilot: more than 100k subscribers [U]

   The only products with millions of subscribers are Duolingo (12.7M paid subs, Q2 2026 [P]) and Robinhood Gold (4.8M at $5/mo, Q2 2026 [P]). Gold is a bundle that comes with a brokerage account, not a learning product.
2. **Freemium converts poorly unless the free product is a habit.**
   - Freemium apps have a median **2.1% download-to-paid rate by day 35**. Hard-paywall apps have 10.7% [S13].
   - Duolingo, the best-in-class freemium learning app, has paid subscribers equal to **9.2% of average MAU** (FY2025 [P]). That figure took 13 years and an obsessive retention engine to reach. It was about 4% of MAUs in 2020 [P].
3. **Paid acquisition is expensive in finance.**
   - Apple Search Ads in the Finance category cost **$6.06 per tap and $13.28 CPA** in 2025, against a $3.76 cross-category average [S].
   - At base-case unit economics (net LTV about $105 per payer, 2.5% install-to-paid), a paid install is only profitable **below about $2.60 CPI**.

   In the base case, paid acquisition loses money and organic growth does all the work.
4. **Model result (§C).**
   - **Bear:** never breaks even with paid UA. With paid UA switched off, it reaches operating break-even in month 22 at about $23k ARR, which is hobby scale.
   - **Base:** monthly operating break-even in month 16 and cumulative break-even in month 30. It exits month 36 at about **$330k ARR** with about 3.3k payers.
   - **Bull:** break-even in month 3 and about **$2.4M ARR** at month 36. This case needs top-quartile conversion (4%) and viral organic growth.

   All scenarios exclude any salary for the founder.
5. **The positioning white space is real.** One quadrant combines advanced content (margins, FCF, ROIC, DCF) with lessons built on your own holdings. Nobody occupies it with a learning product:
   - Simply Wall St has visual fundamentals and portfolio sync, but no curriculum.
   - Robinhood Cortex and Public Alpha give AI answers on your holdings, but no curriculum.
   - WSP, BIWS and CFI teach advanced finance, but on generic cases.

---

## 1. Comparable company profiles

A dash (—) means no data was found.

### 1.1 Duolingo — the engagement and freemium benchmark

**What it does.** Gamified mobile lessons, originally for languages and now also math, music and chess. It uses a freemium model with Super/Max subscriptions.

**Launched.** Public launch in June 2012. Super (then called Plus) launched in 2017 [S8][S4].

**Users (Q2 2026, three months to 2026-06-30) [S1][P]:**
- DAU: 58.7M, up 23% year on year
- MAU: 140.6M, up 10% year on year
- DAU/MAU ratio: about 42%

**Users (Q4 2025) [S2][P]:**
- DAU: 52.7M
- MAU: 133.1M
- DAU/MAU: 39.6%, up from 34.7% a year earlier

**Paid subscribers.**
- 12.7M at Q2 2026, up 17% year on year [S1][P]
- 12.2M at Q4 2025 [S10][S]
- 1.6M at 2020-12-31 [S4][P, via snippet]

**Free-to-paid conversion.**
- Subscribers were **9.2% of average LTM MAUs** in FY2025, up from 8.8% in FY2024 [S3][P].
- The equivalent figure was about 4% in 2020 [S4][P, via snippet].
- The often-quoted "8–9%" is correct only for 2024–25, and it is measured against MAU, not installs.

**Revenue.**
- Q2 2026 revenue: $298.5M, up 18% [S1][P]
- Q2 2026 bookings: $289.1M, up 8% [S1][P]
- FY2025 bookings: $1,158.4M, up 33% [S2][P]
- FY2025 revenue: about $1.03B. This figure comes from company guidance of $1,027.5–1,031.5M given before year-end [S2][P]. The final reported figure has not been checked.
- FY2026 revenue guidance: $1,197–1,221M [S2][P]

**Funding and valuation.** Public company (NASDAQ: DUOL) since its 2021 IPO.

**Growth trajectory.**
- DAU growth slowed from +54–59% in 2024 [S6] to +23% in Q2 2026 [S1].
- Bookings growth also slowed, to +8% in Q2 2026. This is the "AI-first" and saturation debate [S10][S].

**Retention and engagement.**
- The CURR (current-user retention rate) focus, leaderboards (leagues) and streak optimisation drove **4.5x DAU growth over about 4 years** before the IPO [S7][S].
- The Q3 2024 letter said a large share of DAUs have streaks of more than a year. The snippet quoted ">20%", which is unverified wording [S6][P, via snippet].

**Non-language subjects.**
- Chess passed **1M DAU** within months of launch and grew faster than any subject Duolingo had launched before (Q2 2025) [S5][P].
- Duolingo told investors it did **not expect math or music to contribute meaningfully to monetization near-term** [S6][P].

**How it got the first 100k users.**
- About **300k people signed up for the beta waitlist after Luis von Ahn's TED talk** [S8][S].
- It reached 250k weekly active users about 3 months after the June 2012 launch [S8][S].
- It was named Apple's iPhone App of the Year in 2013 [S8][S].
- It spent only **$41.8M on external marketing in total from founding through 2020** [S4][P].

**ONE lesson for Tenbagger.** Retention creates conversion. Duolingo's subscriber share rose from about 4% to 9% of MAU only after years of CURR-focused work on streaks and leagues. Instrument D1/D7/D30 retention and CURR from day one, and treat the paywall as secondary to the daily habit.

### 1.2 Simply Wall St — the closest product analog

**What it does.** Visual "Snowflake" stock fundamentals, portfolio tracking with broker sync, and auto-generated news articles.

**Founded.** 2014 in Sydney, by Al Bentley and Nick Van Den Berg [S21][P].

**Users.**
- "7M+ investors" (undated claim on the company site) [S21][P].
- In 2017 it had 100k users, up from 25k a year earlier [S22][S].

**Paid subscribers.** Not disclosed.

**Revenue.** Not disclosed. Owler and similar estimates were not usable [U].

**Pricing (September 2026, per review sites) [S23][U]:**
- Free: 5 company reports a month
- Premium: $131.40 per year (about $10.95/mo), or $15.99 billed monthly
- Unlimited: $258 per year

**Funding.**
- About **$2.5M in total**, including $1.8M raised **from its own customers** in 2017 [S22][S].
- No large VC round was found.

**How it got the first 100k users.**
- It generated articles automatically from its data and syndicated them through Yahoo Finance and Apple News. These, along with its own SWS News site and organic traffic, are listed as its acquisition channels [S24][U].
- It also crowdfunded from its users [S22].

**ONE lesson for Tenbagger.** Simply Wall St reached millions of users on about $2.5M of capital by turning structured fundamentals into distributable content. Tenbagger's SEC-derived data can do the same: auto-generated, SEO-able "lesson cards" for every ticker.

### 1.3 Brilliant — advanced interactive learning subscription

**What it does.** Interactive STEM and quantitative courses, including quantitative finance content. Premium subscription.

**Founded.** 2012 (per Wikipedia and Crunchbase) [S25][U].

**Users.** "10M+ learners" [S25][U].

**Revenue.** $14.3M in 2024, per a Latka estimate [S25][U]. **This is likely an underestimate and should not be relied on.**

**Pricing (company help page, via snippet) [S26][P]:**
- $24.99 per month
- $161.88 per year ($13.49/mo)
- 7-day free trial

**Funding.** A reported $50M Series C in May 2022. The investor named is USV [S25][U, not confirmed against a press release].

**How it acquired users.** Heavy YouTube and podcast sponsorship of science and education creators such as Veritasium and Kurzgesagt [S27][U]. One claim says it sponsored 3Blue1Brown, but 3Blue1Brown says it does not run sponsorships, so that claim is unreliable [S27].

**ONE lesson for Tenbagger.** An advanced-content app can charge **$13–25 a month**, well above the education-category median of $8.13/mo [S14]. Brilliant's funnel, however, depends on paid creator integrations, so price must support that CAC.

### 1.4 Monarch Money — paid personal-finance (PFM) benchmark

**What it does.** Paid budgeting and net-worth app that aggregates all of a household's accounts.

**Founded.** 2018 by Val Agostino, an early Mint product manager [S28][S].

**Users.**
- More than 500k paying subscribers and about 1M total users [S29][U].
- Paid subscribers grew **about 20x** after Mint's shutdown [S28][S].

**Revenue.** Sacra puts ARR at "$12.6M" [S29][U]. **This is inconsistent** with 500k payers at about $100 a year, which would imply roughly $50M. Treat both figures as unverified.

**Pricing.** $14.99/mo or $99.99/yr for Core, plus a Plus tier at $199/yr. There is a 7-day trial and no free tier [S30][S].

**Funding.** $75M Series B in May 2025, co-led by FPV and Forerunner, at an **$850M post-money valuation** [S28][S].

**How it acquired users.** It was positioned as the Mint replacement when Intuit announced the shutdown in November 2023. TechCrunch covered Monarch in its Mint-shutdown story [S47][S].

**ONE lesson for Tenbagger.** US consumers **will pay about $100 a year for a finance app with no free tier** once the free incumbent disappears. Hard-paywall economics (§B) can work in finance.

### 1.5 Copilot Money — paid PFM benchmark

**What it does.** Budgeting app, originally iOS-only, with AI categorisation.

**Founded.** About 2019–2020 by Andrés Ugarte, a former Google engineer [S31][U].

**Users and revenue.**
- "100k+ subscribers" [S31][U]
- "$2.9M revenue" [S31][U]. This is also inconsistent with 100k payers at $95 a year.

**Pricing.** $13/mo or $95/yr [S31][U].

**Funding.**
- $6M Series A in March 2024, led by Adjacent [S32][S].
- About $16.8M raised in total [U].

**Growth.** It "grew more in the last four months than the previous four years" after the Mint shutdown [S32][S].

**ONE lesson for Tenbagger.** A single well-positioned product with a clear, polished UI and paid-only pricing can reach profitability on less than $20M raised. Design quality is part of the moat for retail finance.

### 1.6 Finelo — paid gamified trading education

**What it does.** Bite-sized trading and investing lessons, 28-day challenges and a simulator. It is owned by Zimran, an app studio of Kazakh origin whose Finelo entity is in Cyprus [S33][U].

**Launched.** Zimran was founded in 2021 [S33][U].

**Users.**
- "1.5M+ learners" [S34][P, company claim]
- "1.15M+ paid subscribers" (early 2025) or "2M+ premium users" (claims vary) [S33][U]
- Android: about **1.3M downloads, averaging about 2.1k per day** [S35][S, Apptopia estimate]

**Revenue.** Not disclosed. Zimran says it is "profitable" [S33][U].

**Pricing.** Web-funnel "intro" plans [S36][U]:
- 1 week: about $6.99
- 4 weeks: $19.99
- 12 weeks: $39.99, after which it **renews at $39.99 per month**

**Funding.** Not disclosed.

**Growth.** Performance-marketing web funnels built around a quiz, then a paywall, then an app download (inferred from the pricing structure). A 4.6-star rating across about 17k Trustpilot reviews [S34][U].

**Retention.** Billing complaints dominate the negative reviews and the BBB complaint file [S36][S37][S].

**ONE lesson for Tenbagger.** Paid-social web funnels can sell finance education at scale and at high prices. The model depends on aggressive intro-to-renewal price steps, however, and generates refund and complaint risk. Borrow the funnel mechanics (quiz onboarding, web checkout) but not the billing dark patterns.

### 1.7 Zogo — B2B2C licensed finance education

**What it does.** Gamified financial-literacy app that banks and credit unions license and co-brand. Users earn rewards for completing lessons.

**Founded.** 2018 [S38][S].

**Users.**
- About 700k by June 2022 [S38][S]
- About 1M by early 2023 [S38][S]

**Partners.**
- 200 financial institutions (2022 press release) [S39][P]
- "250+ institutional partners" (company site, via snippet) [S40][P]

**Revenue and pricing.** The license fee is not public [S40]. Credit unions offer the app free to their members [S41][S].

**Funding.** A Techstars and MassChallenge seed of about $140–295k [S42][U]. No later round was found.

**How it acquired users.** Through each financial institution's own member marketing. B2B sales did the acquisition work [S38].

**ONE lesson for Tenbagger.** Licensing can outsource CAC. Zogo reached about 1M users on very little capital, but the model trades consumer pricing power for B2B sales cycles. It is a **year-2 option**, for example licensing to university finance clubs, credit unions or brokers, not a launch strategy.

### 1.8 Seeking Alpha — research subscription

**What it does.** Crowd-sourced equity research from paid contributors, plus Quant ratings. Premium, Alpha Picks and Pro tiers.

**Founded.** 2004 by David Jackson, a former Morgan Stanley analyst [S43][U].

**Users.**
- About 17M monthly visitors [S43][U]
- Similarweb reports about 42M visits a month [S44][S]

**Paid subscribers.** "250k+ Premium" (review-site figure) [S45][U].

**Revenue.** Similarweb estimates $25–50M [S44][U]. This seems low for 250k payers at $299 a year.

**Pricing.**
- Premium rose from $239 (2023) to $269 (2024) to **$299 a year** [S46][P, company price-update page via snippet]
- Alpha Picks: $499/yr [U]
- Pro: $2,400/yr [U]

**Funding.** Private. No data found.

**How it acquired users.** Contributor-generated content provided long-tail SEO. It also had syndication partnerships with CNBC, MSN, Nasdaq and MarketWatch [S43][U].

**ONE lesson for Tenbagger.** Retail investors pay $299 a year for conviction and ideas, and Seeking Alpha has repeatedly raised prices. Tenbagger's "learn on your own holdings" content should explicitly help users judge their own holdings, while staying on the education side of the line from advice.

### 1.9 Koyfin — terminal-lite research

**What it does.** Charts, fundamentals, dashboards and portfolio tools, marketed as a Bloomberg alternative. It also sells tiers to financial advisers (RIAs).

**Founded.** 2016 by Rob Koyfman, formerly of Goldman Sachs and Bloomberg [S48][U].

**Users.**
- About 100k in 2020, rising to "500k+ investors" by 2023 [S48][U]

**Revenue.** Not disclosed.

**Pricing (2026) [S49][S]:**
- Free tier
- Plus: $39/mo
- Pro: $79/mo
- Advisor tiers: $209 and $299/mo

**Funding.**
- $3M seed in 2019 [S50][S]
- About $6.7–7.3M in total. The last round was in 2021 [S51][U].

**How it acquired users.** FinTwit (Twitter/X), word of mouth, and a generous free tier [S48][U].

**ONE lesson for Tenbagger.** A capital-efficient, largely bootstrapped data product can grow from free retail users into higher-priced professional tiers. Keep a "pro" or student tier in mind, for example for pre-banking recruits.

### 1.10 Stock Analysis (stockanalysis.com) — the SEO-led growth model

**What it does.** Free stock data pages (financials, statistics, IPOs, ETFs), a screener, and a Pro tier that removes ads and adds downloads and more history.

**Launched.** 2019 by "Kris Gunnars" (Kristjan Mar Gunnarsson), who previously founded Authority Nutrition and **sold it to Healthline** [S52][P][S53][S].

**Traffic.**
- **About 8.4M visits a month** (Similarweb, November 2025 to January 2026) [S54][S]
- #24 in Similarweb's Investing category (August 2026) [S54][S]
- About 59% of traffic is from the US [S54][S]
- Channel mix: roughly 64% direct and 20% Google [S54][S]
- "40M+ monthly pageviews" [S55][U]

**Revenue and paid subscribers.** Not disclosed. It earns from ads, the Pro subscription and affiliate links [U].

**Pricing.** Pro costs $9.99/mo or $79/yr [S56][P].

**Funding.** Bootstrapped. No round was found [S52].

**How it acquired users.** Programmatic SEO: one page per ticker and per metric for about 5k+ tickers, built by a founder with a proven nutrition-SEO track record [S53].

**ONE lesson for Tenbagger.** Tenbagger's pipeline already produces per-company fundamentals (`data/companies.json`). Publish crawlable web pages for every company and metric ("What is Micron's ROIC?"). This is the cheapest acquisition channel in the category, and it has already been proven here.

### 1.11 Fiscal.ai (formerly FinChat) — AI research terminal

**What it does.** Fundamentals, company KPIs, AI chat over filings, and an API.

**Founded.** About 2020–2021 (FinChat launched in 2023). **Unverified.**

**Users.** "350k+ registered users" (June 2025) [S57][P].

**Revenue.** Not disclosed.

**Pricing.** Free tier, Pro at $39–49/mo and Max at $79–99/mo [S58][U].

**Funding.** **$10M Series A in June 2025**, led by Portage, bringing total funding to $13M [S57][P].

**How it acquired users.** The founders had large FinTwit and YouTube audiences (co-founder Braden Dennis runs the "Stock Market Hunt" podcast and video channel). This is **unverified** in this research.

**ONE lesson for Tenbagger.** "AI plus clean fundamentals" is already a crowded, funded space. Tenbagger's differentiation must be the **curriculum and progression**, not AI chat over filings.

### 1.12 Robinhood (Learn and Cortex) — broker-integrated education

**What it does.**
- **Robinhood Learn** is free in-app education [S59][P].
- **Cortex** is an AI research assistant announced on 2025-03-27. It is bundled into **Gold** at $5/mo [S60][P].

**Users (Q2 2026) [S61][P]:**
- 28.4M funded customers
- **4.8M Gold subscribers**, up 39% year on year, equal to about 17% adoption. About 40% of new funded customers take Gold.
- ARPU: $187

**How it got early users.** A referral waitlist with about **1M sign-ups before the December 2014 launch** [S62][U].

**ONE lesson for Tenbagger.** The broker already owns the holdings data and gives AI research away as part of a $5 bundle. Tenbagger cannot compete on "AI on your stocks". It must win on **structured learning that builds skill**, and it should consider being *complementary*, for example linking to Robinhood or Public read-only.

### 1.13 Public.com — broker-integrated education and AI

**What it does.** Multi-asset broker with a social layer. Its "Alpha" AI gives fundamentals and analysis [S63][U].

**Launched.** 2019 [S63].

**Users.**
- 1M members by February 2021, after 10x growth in 2020 [S64][P]
- "3M" users later [S65][U]

**Funding.**
- $220M Series D in February 2021 [S64][P]
- $135M raised in December 2024 ($105M equity and $30M debt), led by Accel [S66][S]
- Last widely reported valuation: $2B in 2021 [S63][U]

**How it acquired users.** Social investing features and celebrity investors (Will Smith, J.J. Watt) generated press in 2020 [S67][S].

**ONE lesson for Tenbagger.** Brokers use education and AI as *retention features*, not products. That makes brokers potential **distribution partners** (for example B2B2C licensing), not only competitors.

### 1.14 Wall Street Prep, BIWS and CFI — advanced paid education

**What they do.** Financial modeling, valuation and DCF, M&A/LBO, and interview preparation for banking, private equity and corporate finance.

**Pricing:**
- **CFI:** $347/yr (Course-Only), **$497/yr** (Self-Study, includes the FMVA certificate) and $847/yr (Full-Immersion) [S68][P]
- **BIWS:** about $497 for one year of Premium [S69][P]
- **WSP:** Premium Package about $499 [S70][U]

**Learners.**
- CFI: "**3M+ learners**" in 180+ countries [S71][P], and 4M course enrollments by 2021 [S72][P]
- WSP: 300+ corporate clients, including Goldman Sachs, JPMorgan and KKR, use it for analyst training [S70][U]

**Founded.** WSP about 2004 (founder Matan Feldman); BIWS about 2010 (founder Brian DeChesare); CFI 2016 [S71]. The WSP and BIWS dates are **unverified**.

**Funding.** All three appear bootstrapped or privately held. CFI acquired Macabacus in 2021 [S72][P].

**How they acquired users.** Founder-led content and blogs (BIWS in particular), SEO on technical interview topics, university and corporate training contracts, and certificates (FMVA) that students list on LinkedIn [S70][S71].

**ONE lesson for Tenbagger.** Students and pre-banking recruits already pay about **$500 a year** for DCF and valuation training when it signals job-readiness. A credential or skills badge ("Completed Tenbagger Valuation track") could support a student premium tier.

### 1.15 Failures and exits — why they died

| Company | Status | Funding raised | Why it failed or exited | Lesson for Tenbagger |
|---|---|---|---|---|
| **Mint** | Launched 2007. Bought by Intuit for about $170M in 2009, when it had 1.5M users [S73][P]. Shut down 2024-03-23 [S74][S]. | Acquired | It was free and ad- and referral-funded. Intuit consolidated it into Credit Karma, which runs the same lead-gen model at larger scale [S74][S75]. About 3.6M active users in 2021 [U]. Early growth came from a blog, email and a TechCrunch40 win, not ads [S73]. | Ad-funded finance tools die when a bigger ad vehicle exists. Tenbagger should charge users directly and keep ads and affiliate income minor. |
| **Atom Finance** | Acquired by Toggle AI in May 2024. The app was shut down [S76][P]. | About $41–50M, including a $28M Series B led by SoftBank LatAm in 2021 [S77][P] | A free "Bloomberg for retail" app struggled to monetise its premium tier. It pivoted toward B2B infrastructure for banks and brokers, then sold [S76][S77]. | "Free pro-grade research" is not a business. Monetisation must come before scale. |
| **Invstr** | Lost its brokerage partner (Apex) and stopped working in about May 2024 [S78][U]. | About $40M+ [U] | A fantasy-finance game combined with a real brokerage. It depended on a clearing partner, and users got no notice when it ended [S78]. Nearly 1M downloads by 2020 [S79][S]. | Platform dependency and gamification alone do not retain users. Keep brokerage integration read-only and swappable, with more than one aggregator. |
| **Tally** | Shut down August 2024 [S80][S]. | $172M; last valued at $855M [S80][S81] | Capital-intensive credit and lending model. A failed pivot from consumer to B2B, then an inability to raise [S80][S81]. | Avoid balance-sheet and regulated activity. Stay a software and education product that can stay alive on subscription revenue. |

---

## A. Comparison table

Users are the latest figure found, with its date. Tags mark how reliable each figure is.

| Company | Users (date) | Paid subs | Revenue / ARR | Price (USD) | Funding / valuation | Model | Main growth channel |
|---|---|---|---|---|---|---|---|
| Duolingo | 140.6M MAU / 58.7M DAU (Q2-26) [P] | 12.7M (Q2-26) [P] | $298.5M in Q2-26; about $1.03B FY25 (guidance) [P] | Super about $7–13/mo [U] | Public (DUOL) | Freemium | Organic, word of mouth, social |
| Simply Wall St | 7M+ investors (undated) [P] | — | — | $131/yr to $258/yr [U] | About $2.5M, customer-funded [S] | Freemium | Content syndication, SEO |
| Brilliant | 10M+ learners [U] | — | About $14M (2024, likely low) [U] | $24.99/mo or $161.88/yr [P] | Series C, about $50M (2022) [U] | Trial then paywall | Creator sponsorships |
| Monarch | About 1M users (2025) [U] | 500k+ [U] | Unclear ($12.6M [U]) | $14.99/mo or $99.99/yr [S] | $75M B at $850M (2025-05) [S] | Hard paywall | Mint exodus, PR |
| Copilot | — | 100k+ [U] | $2.9M [U] | $13/mo or $95/yr [U] | $6M A (2024-03) [S] | Hard paywall | App Store, Mint exodus |
| Finelo | 1.5M learners [P] | 1.15–2M claimed [U] | — (profitable claim) [U] | $6.99/wk intro to $39.99/mo [U] | Undisclosed | Web funnel then subscription | Paid social performance marketing |
| Zogo | About 1M (2023) [S] | B2B: 200–250+ financial institutions [P] | — | Free to users; financial institution license [S] | About $0.1–0.3M seed [U] | B2B2C license | Financial institution channel |
| Seeking Alpha | About 17–42M visits/mo [U/S] | 250k+ Premium [U] | $25–50M est. [U] | $299/yr [P] | Private | Freemium, metered | SEO, contributors, syndication |
| Koyfin | 500k+ (2023) [U] | — | — | $39–79/mo [S] | About $7M [U] | Freemium | FinTwit, word of mouth |
| Stock Analysis | About 8.4M visits/mo (Jan-26) [S] | — | — | $9.99/mo or $79/yr [P] | Bootstrapped [P] | Ads plus freemium | Programmatic SEO |
| Fiscal.ai | 350k+ registered (Jun-25) [P] | — | — | $39–99/mo [U] | $13M total ($10M A, Jun-25) [P] | Freemium | Founder audience, FinTwit |
| Robinhood (Gold/Cortex) | 28.4M funded (Q2-26) [P] | 4.8M Gold [P] | ARPU $187 [P] | Gold $5/mo [S] | Public (HOOD) | Broker bundle | Referral, waitlist |
| Public | 1M (Feb-21) to 3M [P/U] | — | — | Free plus premium | About $554M+ raised; $2B (2021) [U] | Broker | Social, celebrity PR |
| CFI | 3M+ learners [P] | — | — | $347–847/yr [P] | Private | Paid, annual | SEO, certification |
| WSP / BIWS | — | — | — | About $497–499 [P/U] | Private | Paid, one-off or annual | SEO, B2B training |
| Mint (dead) | 1.5M (2009) [P]; about 3.6M active (2021) [U] | 0 | Ads and referrals | Free | Acquired for $170M (2009) [P] | Ad and lead-gen | Blog, PR, TC40 |
| Atom (exited) | 100k (2019) [S] | Grew 250% in H1-21 [P] | — | Freemium | About $50M [P] | Freemium, then B2B | Press, App Store |
| Invstr (dead) | About 1M downloads (2020) [S] | — | — | Free plus brokerage | About $40M [U] | Game plus broker | Sports-fan marketing |
| Tally (dead) | — | — | — | Lending | $172M [S] | Credit | Paid |

---

## B. Revenue-per-user, conversion and CAC benchmarks for the model

### B1. Conversion

| Metric | Value | Source |
|---|---|---|
| Median download-to-paid rate by day 35, **freemium** apps | **2.1%** | RevenueCat SOSA 2026 [S13][S] |
| Same metric, **hard-paywall** apps | **10.7%** | [S13][S] |
| Same metrics, previous year's report | 2.2% freemium vs 12.1% hard paywall | RevenueCat SOSA 2025 [S14][S] |
| Trial-to-paid by trial length | 25.5% (≤4 days), **37.4% (5–9 days)**, 42.5% (17–32 days) | [S13][S] |
| Education category "trial conversion" | **6.5%**. The snippet appears to describe download-to-trial, but the label is ambiguous. | RevenueCat 2026 Education [S12][S] |
| Timing of conversions | About 50% of paid conversions happen on Day 0 | [S13][S] |
| Freemium self-serve SaaS: "good" rate | 3–5% | Lenny / OpenView survey of 1,000+ products [S16][S] |
| Freemium self-serve SaaS: "great" rate | 6–8% | [S16][S] |
| Duolingo paid subscribers as a share of average MAU | 9.2% in FY25, 8.8% in FY24, about 4% in 2020 | [S3][S4][P] |

**Implication.** Model install-to-paid at **1.5% / 2.5% / 4.0%** for bear, base and bull. The base sits slightly above the 2.1% freemium median, because the product is a niche with high intent. The bull is near the "great" range. A 7-day trial on annual plans is supported by the 5–9 day trial-to-paid figure of 37.4%.

### B2. Pricing and revenue per user

| Metric | Value | Source |
|---|---|---|
| Education category median price | **$8.13/mo** and **$43.94/yr** | RevenueCat 2025, via secondary summary [S14][S82][U] |
| Paid finance-app comparables | $95–100/yr (Monarch, Copilot); $79/yr (Stock Analysis); $131–258/yr (Simply Wall St); $162/yr (Brilliant); $299/yr (Seeking Alpha); about $500/yr (CFI, BIWS) | §1 |
| Median revenue per install at day 14, hard paywall vs freemium | $2.32 vs $0.27 | [S13][S] |
| Median revenue per install at day 60, hard paywall vs freemium | **$3.09 vs $0.38** | [S13][S] |
| Median revenue per install at day 60, North America | $0.55 | [S13][S] |
| App store commission | 15% under Apple's Small Business Program (below $1M a year in proceeds) | [S83][S] |
| Google Play commission | 15% on all auto-renewing subscriptions from day one | [S83][S] |
| RevenueCat fee | Free up to $2.5k monthly tracked revenue, then 1% | [S84][P] |

**Implication.** The base case uses **$12.99/mo and $79.99/yr, with 60% of subscribers on annual plans**. That gives a gross ARPPU of $9.20/mo and a **net ARPPU of $7.82/mo** after the 15% store fee.

### B3. Retention

| Metric | Value | Source |
|---|---|---|
| Annual plans still subscribed after 1 year | **44.1%** (down from 47.1%) | RevenueCat 2025 [S14][S] |
| Monthly plans still subscribed after 12 months | **17.0%** (down from 18.8%) | [S14][S] |
| Annual subscriptions cancelled in the first month | Nearly 30% | [S14][S] |
| 2026 report, non-AI apps | Annual retention 30.7%, monthly 9.5% | RevenueCat 2026, via TechCrunch [S15][S] |
| Finance-app D30 retention | 2–6% (Adjust 2026 reports about 2%) | [S85][U] |

The 2026 figures may be defined differently from the 2025 ones. **I use the 2025 figures for the base case and the 2026 figures for the bear case.**

### B4. CAC by channel

| Channel | Benchmark | Source | Implied cost per paid user at 2.5% install-to-paid |
|---|---|---|---|
| Apple Search Ads, Finance category | CPT $6.06; **CPA (install) $13.28** (2025) | SplitMetrics [S17][S] | About **$530** |
| Apple Search Ads, all categories | CPT $2.25; CPA $3.76 | [S17][S] | About $150 |
| Apple Search Ads, Education category | CPT about $1.24 | [S18][U] | About $100 at a 50% tap-to-install rate |
| TikTok | About $2.45 CPI globally | [S19][U] | About $98 (US will be higher) |
| Meta / fintech, iOS US | $10–25 per install | [S19][U] | $400–1,000 |
| Finance YouTube creators | Integration CPM **$40–80** for mid/large channels. Micro channels (10k subs) charge $50–120 CPM, or $1.5–6k per video. Shorts: $5–15 CPM. | [S20][U] | At $50 CPM and a 0.5% view-to-install rate: about $10 CPI, about $400 per payer |
| SEO / programmatic pages | Near-zero marginal cost. Stock Analysis reached about 8.4M visits a month bootstrapped. Simply Wall St ran on syndicated auto-content. | [S54][S24] | Build time only |
| Organic / word of mouth | Duolingo spent only $41.8M on external marketing in total through 2020 | [S4][P] | — |

**Unit economics check (base case).**
- Blended net LTV is about **$105**:
  - Monthly subscribers: $12.99 × 0.85 ÷ 13.7% monthly churn ≈ $80
  - Annual subscribers: $79.99 × 0.85 ÷ (1 − 0.44) ≈ $121
- At 2.5% install-to-paid, the **maximum CPI at which a paid install breaks even is about $2.63**. Every paid channel in the finance category is above that.
- **Conclusion:** paid UA works only with a hard paywall or a trial-first onboarding. Examples are Monarch and Finelo, whose web funnel is inferred from its pricing. At freemium conversion rates, growth must be organic: SEO, creators paid per acquisition, and referral.

---

## C. Bottom-up 3-scenario model (36 months)

The model is monthly and simulates cohorts separately for monthly and annual plans. Revenue is recognised MRR. Annual plans are paid in cash upfront, so **cash flow is better than shown**. The reproducible script is described at the end of this section. **No founder salary is included.** A $5k/mo founder draw is shown as a separate hurdle.

### C1. Assumptions and their benchmark ties

| Driver | Bear | Base | Bull | Tied to |
|---|---|---|---|---|
| Installs in month 1 | 800 | 1,500 | 3,000 | Launch plus SEO ramp. Duolingo had 250k weekly actives within 3 months of launch but was an outlier [S8]. Finelo's Android app averages about 2.1k downloads a day [S35]. |
| Monthly install growth | 4% | 7% | 9% | Author judgment. Month 36 volumes are 3.2k, 16k and 61k installs a month, versus Finelo's Android run-rate of about 63k a month [S35]. |
| Share of installs from paid UA | 25% | 30% | 30% | Author judgment |
| Blended CPI on paid installs | $5.00 | $3.50 | $2.50 | Apple Search Ads education/overall to finance range [S17][S18]; TikTok [S19] |
| Install-to-paid conversion | 1.5% | 2.5% | 4.0% | RevenueCat freemium median 2.1% [S13]; "great" 6–8% [S16] |
| Share of payers on annual plans | 50% | 60% | 65% | Annual plans retain best [S14] |
| Monthly price | $9.99 | $12.99 | $14.99 | Education median $8.13 [S14]; Monarch and Copilot $13–15 [S30][S31] |
| Annual price | $59.99 | $79.99 | $99.99 | Stock Analysis $79 [S56]; Monarch $99.99 [S30] |
| Monthly plans still subscribed at 12 months | 9.5% (16.2% monthly churn) | 17% (13.7%) | 25% (10.9%) | RevenueCat 2026 / 2025 / above median [S15][S14] |
| Annual-plan renewal rate | 30.7% | 44.1% | 54% | RevenueCat 2026 / 2025 / cheap-plan best case of 53.7% [S15][S14] |
| App store fee | 15% | 15% | 15% | Small Business Program and Google subscriptions [S83] |
| RevenueCat fee | 1% of revenue above $2.5k MTR | Same | Same | [S84] |
| Data licensing | $450/mo | $400/mo | $350/mo | Founder's quote ($350–450). SEC EDGAR data itself is free. |
| Brokerage linking | Starts month 13 | Starts month 13 | Starts month 13 | Roadmap ("later") |
| Share of payers who link an account | 20% | 30% | 40% | Author judgment |
| Aggregation cost per linked user per month | $2.50 | $1.50 | $1.25 | SnapTrade: $100/mo platform fee plus $1 (daily) or $2 (real-time) per user [S86][P]; founder range $1.25–2.50 |
| Hosting | $50 + $0.01 per MAU | Same | Same | Supabase Pro $25 [S87][P]; Expo Starter $19 [S88][P] |
| Other fixed costs | $160/mo (legal and privacy templates, developer accounts) | Same | Same | Author estimate |
| Estimated MAU | Current installs plus 25% of prior installs, decaying 7% a month | Same | Same | Finance D30 retention 2–6% [S85]; Duolingo-like habit is not assumed |
| Ads and affiliate revenue | Excluded (upside) | Excluded | Excluded | — |

### C2. Scenario outputs

| | **Bear** | **Base** | **Bull** |
|---|---|---|---|
| Cumulative installs by month 36 | 62k | 223k | 708k |
| Paid subscribers at month 36 | 397 | 3,345 | 19,963 |
| Paid subscribers as a share of estimated MAU, month 36 | 3.9% | 7.5% | 12.8% (above Duolingo's 9.2%, so aggressive) |
| MRR at month 36 | $2.5k | $27.5k | $197.6k |
| ARR run-rate at month 36 | **$31k** | **$330k** | **$2.37M** |
| Revenue in year 1 / year 2 / year 3 | $6k / $15k / $25k | $28k / $98k / $232k | $122k / $517k / $1.53M |
| Net ARPPU after store fee | $6.37/mo | $7.82/mo | $9.06/mo |
| Blended net LTV per payer | $61 | $105 | $161 |
| Paid CAC per payer | $333 | $140 | $62 |
| LTV/CAC on paid installs | **0.18** | **0.75** | **2.6** |
| First month with non-negative operating profit | **Never** within 36 months | **Month 16** | **Month 3** |
| Month cumulative cash turns positive | Never | **Month 30** | Month 5 |
| Maximum cumulative burn (trough) | −$70k and still falling at month 36 | −$12.4k | −$2.6k |
| First month net ≥ $5k (founder "ramen" draw covered) | Never | Not within 36 months (net is $3.7k at month 36) | Month 8 |
| **Sensitivity: paid UA switched off** (organic installs only) | Operating break-even month 22; about $23k ARR at month 36 | Break-even **month 4**; about $231k ARR and $14k/mo net at month 36 | — |

### C3. Month-by-month detail (selected months)

Figures are monthly.

**Base case**

| Month | Installs | MAU (est.) | Paid subs | MRR | Store fee | Data | Aggregation | Hosting | Paid UA | Other | Net | Cumulative |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | 1,500 | 1,500 | 38 | $345 | $52 | $400 | $0 | $65 | $1,575 | $160 | −$1,907 | −$1,907 |
| 6 | 2,104 | 3,997 | 240 | $2,096 | $314 | $400 | $0 | $90 | $2,209 | $160 | −$1,077 | −$8,913 |
| 12 | 3,157 | 7,590 | 553 | $4,640 | $696 | $400 | $0 | $126 | $3,315 | $181 | −$78 | −$11,950 |
| 18 | 4,738 | 12,419 | 914 | $7,610 | $1,141 | $400 | $511 | $174 | $4,975 | $211 | $196 | −$12,408 |
| 24 | 7,111 | 19,304 | 1,449 | $11,964 | $1,795 | $400 | $752 | $243 | $7,466 | $255 | $1,054 | −$8,380 |
| 30 | 10,671 | 29,401 | 2,207 | $18,192 | $2,729 | $400 | $1,093 | $344 | $11,205 | $317 | $2,104 | $1,419 |
| 36 | 16,015 | 44,402 | 3,345 | $27,521 | $4,128 | $400 | $1,605 | $494 | $16,816 | $410 | $3,668 | $19,213 |

**Bear case**

| Month | Installs | Paid subs | MRR | Paid UA | Net | Cumulative |
|---|---|---|---|---|---|---|
| 12 | 1,232 | 132 | $865 | $1,539 | −$1,497 | −$18,202 |
| 24 | 1,972 | 242 | $1,562 | $2,465 | −$2,079 | −$40,624 |
| 36 | 3,157 | 397 | $2,547 | $3,946 | −$2,842 | −$70,174 |

**Bull case**

| Month | Installs | Paid subs | MRR | Aggregation | Paid UA | Net | Cumulative |
|---|---|---|---|---|---|---|---|
| 12 | 7,741 | 2,112 | $21,194 | $0 | $5,806 | $11,284 | $49,515 |
| 24 | 21,774 | 6,923 | $68,705 | $3,561 | $16,330 | $36,737 | $318,261 |
| 36 | 61,242 | 19,963 | $197,568 | $10,081 | $45,931 | $107,843 | $1,149,819 |

**Reading the model:**
1. **Fixed costs are tiny.** Data, hosting and tools total about $600–650 a month. In the base case, subscriptions cover them once there are about 80 payers.
2. **Paid acquisition decides whether the business works.** In the base case, paid UA is the largest cost line and has an LTV/CAC below 1. Switching it off reaches break-even about 12 months earlier, in month 4 instead of month 16. Buy installs only after onboarding lifts install-to-paid toward 4%, or buy them from creators on a cost-per-acquisition basis.
3. **Aggregation cost is manageable if it is gated.** Linking accounts costs roughly 5–7% of MRR in the base and bull cases at month 36. Restrict account linking to paying users only.
4. **The bull case needs Duolingo-grade conversion.** Its paid-to-MAU ratio is above Duolingo's 9.2%, so it is an optimistic ceiling, not a plan.

**Reproducing the model.** The model script is `model.py` in the session scratchpad (Python, about 80 lines). It is not in the repo. Every assumption is the `S` dictionary at the top of the script.

---

## D. Positioning map

**Axes:**
- **x-axis:** 0 = beginner / basic literacy, 10 = advanced (DCF, ROIC, modeling).
- **y-axis:** 0 = generic content, the same for everyone. 10 = built on the user's own data (holdings or accounts).

These coordinates are the author's judgment based on the product descriptions in §1.

| Product | x (beginner→advanced) | y (generic→own data) | Bubble size (users, log hint) | Note |
|---|---|---|---|---|
| **Tenbagger (target)** | **6.5** | **8.5** | — | Advanced lessons on real SEC financials and the user's own holdings |
| Simply Wall St | 4.5 | 8.0 | 7M | Closest analog: visuals and portfolio sync, but no curriculum |
| Robinhood Cortex (Gold) | 4.0 | 7.5 | 4.8M Gold | AI answers about your stocks; not a structured course |
| Public (Alpha) | 4.5 | 6.5 | About 3M | AI and fundamentals inside the broker |
| Koyfin | 7.5 | 5.0 | 500k | Portfolio import and dashboards; no lessons |
| Seeking Alpha | 6.0 | 4.0 | About 17M visits a month | Portfolio alerts and ratings |
| Fiscal.ai | 8.0 | 3.5 | 350k | Pro data and AI; no pedagogy |
| Stock Analysis | 5.5 | 2.0 | About 8M visits a month | Data pages; no personalization |
| Atom Finance (exited) | 6.0 | 6.0 | 100k+ | Research and portfolio sync, now dead |
| Monarch | 2.0 | 9.5 | About 1M | Your own money, but budgeting, not investing skill |
| Copilot | 2.0 | 9.5 | 100k+ | Same as Monarch |
| Mint (dead) | 1.0 | 9.0 | 3.6M | Free and ad-funded |
| Robinhood Learn | 1.5 | 3.0 | 28M funded customers | Generic basics |
| Finelo | 2.5 | 1.5 | 1.5M | Gamified trading basics and a simulator |
| Invstr (dead) | 2.5 | 2.5 | About 1M | Fantasy-finance game |
| Zogo | 1.0 | 1.0 | About 1M | Financial-literacy basics |
| Duolingo (reference) | 1.5 | 1.0 | 140M | Mechanics benchmark only |
| Brilliant | 6.5 | 0.5 | 10M | Advanced interactive learning, not finance-native |
| CFI | 8.5 | 0.5 | 3M | Modeling certificates |
| Wall Street Prep / BIWS | 9.5 | 0.5 | — | IB/PE interview prep |

**White space.** The region with x ≥ 5 and y ≥ 7 has no learning product in it. Simply Wall St and the brokers' AI tools border it from below-left.

---

## E. Top risks and go-to-market moves

### E1. Top 5 risks, with evidence

1. **Freemium conversion does not cover the cost of acquisition.**
   - The freemium median is 2.1% download-to-paid, against 10.7% with a hard paywall [S13].
   - Finance-category Apple Search Ads cost $13.28 per install [S17].
   - The base-case model shows paid UA at LTV/CAC 0.75.
   - *Mitigation:* test a trial-first paywall at onboarding (Monarch and Copilot charge from day one [S30][S31]). Keep the free tier as SEO pages and a lesson preview.
2. **Nobody forms a daily habit around investing lessons.**
   - Finance-app D30 retention is 2–6% [S85].
   - Even Duolingo does not expect its non-language subjects (math, music) to contribute meaningfully to monetization near-term [S6].
   - Duolingo's retention came from years of CURR-focused experiments [S7].
   - *Mitigation:* tie lessons to live events such as your holdings' earnings, 10-K releases and price moves, so each session has a reason to happen. Add streaks and leagues only once there is a core loop to reinforce.
3. **Bundling by brokers and AI tools.**
   - Robinhood gives Cortex AI research away inside a $5/mo Gold bundle, with 4.8M subscribers [S61][S60].
   - Public offers Alpha AI [S63].
   - Fiscal.ai raised $10M for AI over fundamentals [S57].
   - "Explain this stock" is being commoditised.
   - *Mitigation:* the moat is the curriculum, the progression and the credential (as with CFI's FMVA [S68]), not answers.
4. **Platform and data dependency.**
   - Invstr died when its brokerage partner (Apex) relationship ended [S78].
   - Aggregators price per connected user: SnapTrade charges $100/mo plus $1–2 per user [S86], and Plaid's investments pricing is not public [S89].
   - App store rules on external payment links were partly reversed on appeal in December 2025 [S90][S91].
   - *Mitigation:* read-only linking, at least two aggregators, CSV import as a fallback, and a web checkout where the rules allow it.
5. **Regulatory, trust and billing reputation.**
   - Personalized lessons that discuss a user's own holdings could be read as investment advice. This needs legal review; I found no specific source for it in this research.
   - Finelo's aggressive intro-to-renewal pricing generates BBB complaints and billing-dominated negative reviews [S36][S37].
   - Mint's shutdown shows free finance apps can vanish [S74].
   - *Mitigation:* frame everything as education, never make buy or sell recommendations, show clear renewal prices, and make cancellation easy.

(A sixth, structural risk: **a solo founder's capital and scope**. Tally raised $172M and still died [S80]. Atom raised about $50M and was sold [S77]. Capital does not save a weak retention or monetization loop, so reaching ramen profitability early matters more than raising.)

### E2. Top 5 go-to-market moves, with evidence of who did them

| # | Move | Who did it successfully | Evidence |
|---|---|---|---|
| 1 | **Programmatic SEO pages from the SEC pipeline** ("What is AAPL's ROIC?", "Micron free cash flow explained"), each linking into a lesson | Stock Analysis (bootstrapped, about 8.4M visits a month); Simply Wall St (auto-articles syndicated to Yahoo Finance and Apple News) | [S54][S53][S24] |
| 2 | **Pre-launch waitlist with referral gamification** (move up the queue by inviting friends) | Robinhood (about 1M sign-ups before launch); Duolingo (300k beta sign-ups via a TED talk) | [S62][S8] |
| 3 | **Creator partnerships in finance and education YouTube, TikTok and podcasts**, paid per acquisition or revenue share rather than flat CPM given finance CPMs of $40–80 | Brilliant (education creator sponsorships); Fiscal.ai (founder audience) | [S27][S20] |
| 4 | **Campus and pre-banking channel**: finance clubs, investment clubs, recruiting groups; student pricing plus a certificate | Robinhood Money Drills (17 universities); CFI's FMVA (3M+ learners); WSP (300+ corporate clients) | [S59][S71][S70] |
| 5 | **Customer-funded community and a "catch the exodus" posture**: crowdfund from users; be ready when a competitor shuts down | Simply Wall St (raised $1.8M from customers); Monarch and Copilot (20x and "more than the prior 4 years" growth after Mint's shutdown) | [S22][S28][S32] |

Honourable mention: **B2B2C licensing** to credit unions or brokers, as Zogo does with 200–250+ financial institution partners [S39][S40]. It is a good year-2 revenue diversifier.

---

## 6. What I could not verify, and where the evidence is weak

- **Nothing was read in full.** WebFetch was blocked. All figures come from search snippets. Priority checks:
  - Duolingo's Q2 2026 and FY2025 letters
  - The RevenueCat 2025 and 2026 PDFs (category tables for Education and Finance)
  - SplitMetrics' finance CPA
- **RevenueCat category figures.** I could not get Finance-category medians. The Education "6.5%" figure is ambiguous (download-to-trial or trial-to-paid?).
- **Private-company revenue is weak or contradictory:**
  - Monarch: Sacra's $12.6M ARR vs 500k+ payers
  - Copilot: $2.9M vs 100k+ subscribers
  - Brilliant: Latka's $14.3M
  - Seeking Alpha: $25–50M
  - All are tagged [U]. **Do not quote them to investors.**
- **Finelo** paid-subscriber claims (1.15M–2M) are company or review-site claims with no audit.
- **Simply Wall St** paid-subscriber count and revenue are not public. Its "7M investors" figure is undated.
- **CAC:** the TikTok, Meta and creator CPM figures come from agency blogs [U]. Only the SplitMetrics Apple Search Ads figures are [S].
- **Zogo licensing price** and **Plaid investments pricing** are not public.
- **Founding dates** for WSP and BIWS, and **Fiscal.ai's founders' audience**, are from memory or context and were not verified by search.
- **Model structure:** the growth path (installs and their growth rate) is author judgment, not benchmarked. It is the most sensitive input after conversion.

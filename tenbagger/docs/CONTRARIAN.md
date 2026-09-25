# Tenbagger: Contrarian reviews

The standing devil's advocate. Each review is dated, newest first. The format is: **Steelman** (the fair case, in two sentences), **Attack** (the strongest reasons it fails), **Reframe** (different ways to hit the same goal: a cheap 1-week test, a "10x weirder" idea and a "do less" option), then **Verdict** (keep, change or kill, plus the single change that helps most).

The hard guardrails are taken as fixed: education, not advice; no rewards for trading; no gambling mechanics; real user data stays private. These reviews question *how* the guardrails are met, never *whether*.

---

## 2026-09-25: First full review (everything built and decided so far)

**What I read:** all of `docs/*.md`, `finance/out/summary.md`, `discovery/`, `mobile/src/config/monetization.ts`, the route tree in `mobile/src/app/`, `prototypes/index.html` and tokens, and the git history.

**Five facts behind almost every critique below:**

1. **Nobody has talked to a customer yet.** `discovery/tracker.csv` holds one row, and it is the "EXAMPLE ROW - delete" placeholder. The website waitlist endpoint is `''`, so every sign-up so far is stored only in the visitor's own browser (`discovery/FAKE_DOOR_TEST.md` §1).
2. **About 48k lines of code exist, and all 40 commits are authored by "Claude".** By directory: mobile 15.9k, packages 15.0k, backend 6.6k, lessons 2.9k, pipeline 2.0k, web 1.7k, datasources 1.6k, finance 1.6k, funds 1.5k. There are 344 passing tests.
3. **What got built is not what the strategy chose.** PRODUCT_STRATEGY §2 picked five MVP features: Guess the Company, Screener Quests, My Stocks, Earnings Season Live and the Interview-Prep track. **None of the five has a screen** in `mobile/src/app/`, and the $49 Recruiting Pass is missing from `PLANS`. What shipped instead is fund X-ray, compare, Screener v2, articles, a website, ads, a paywall, store-submission prep and a Plaid-backed money hub. Most of that list came from the YCharts teardown and the money-hub research, not from the chosen MVP.
4. **The docs decided against things the code then did.** Two examples:
   - PRODUCT_STRATEGY §3 and MARKET_ENTRY §1 both say to retire "Tenbagger" as the public name. `APP_NAME` is still `'Tenbagger'`.
   - MARKET_ENTRY D4 says **no bank linking in beta**, yet `FREE_LIMITS.money_accounts = 1` gives every free user a linked bank.
5. **The founder's own model says the business barely works.** In the base case: FY3 revenue is $153k, the founder salary is $0, and paid acquisition returns $0.24–0.31 of lifetime value per $1 spent. The bear case needs $92k and never breaks even (`finance/out/summary.md`).

---

### 1. Core concept: lessons + screener + money hub in one app

**Steelman.** Finance lessons alone won't form a daily habit, so a "can I cover my card?" check supplies the daily open and the screener supplies the practice arena. "Learn it on Costco, then apply it to your own money" is a memorable link that no competitor makes.

**Attack.**
- **Three products, three competitor sets, one founder.** The lessons compete with Duolingo-style apps and ChatGPT. The screener competes with free tools such as Stock Analysis, Finviz and WallStreetZen. The hub competes with Rocket Money, Credit Karma (free) and now ChatGPT Finances. Each third ends up weaker than the focused tool it competes with.
- **The personas don't overlap much.** MARKET_ENTRY §5 names the club investor and the pre-finance recruit as the beachhead. The hub serves persona C, the working student with a card, whom the same table calls a "retention feature" pitted against "free tools and ChatGPT". The daily-habit feature serves a different person than the one who pays.
- **The "learn it, then apply it to yourself" link is untested.** Nothing shows that a club investor who learns free cash flow wants to see a "free cash flow" figure for their own checking account. It could just as easily feel like homework twice.
- **The bundle makes the product hard to explain.** MONEY_HUB §5 concedes Option C is "more complex to explain". On an App Store page you get one sentence and three screenshots.
- **The daily-habit claim rests on the weakest evidence in the docs.** The key statistic, "52.5% of Gen Z check accounts at least once a day", is tagged [U] from a vendor blog. Even if it is true, people check their *bank's* app. That is not evidence they would open a third-party app for the same thing.

**Reframe.**
- **Cheap test (1 week):** put three single-purpose landing pages in front of the same club traffic (Learn, Interview drills, Due-Date Check) and let sign-ups and "reserve" clicks pick the product. FAKE_DOOR_TEST already has the plumbing for two of the pages.
- **10x weirder:** drop the app and make Tenbagger a **weekly live event**. For example, "Earnings Night" for investment clubs: a 30-minute group quiz on a company that reported that week, projected at club meetings. The habit is weekly and social instead of daily and solitary, which is how clubs already behave.
- **Do less:** ship **Learn + Screener Quests only**. Park the hub as a separate experiment, possibly a separate app, until one of them retains.

**Verdict: change.** Unbundle for launch. One app, one promise. Keep the hub code on a branch.

---

### 2. Target customer and beachhead

**Steelman.** College students in investment clubs are reachable in person for free. The recruits among them already pay about $500 for interview prep, so a cheap student price can be subsidised by a $49 pass.

**Attack.**
- **The paying segment is the one most exposed to ChatGPT.** Chegg lost half a million subscribers after ChatGPT launched, and 62% of students surveyed planned to use ChatGPT against 30% for Chegg ([Gizmodo](https://gizmodo.com/chegg-is-on-its-last-legs-after-chatgpt-sent-its-stock-down-99-2000522585), [Sherwood](https://sherwood.news/business/chegg-biggest-chatgpt-gen-ai-loser/)). Surveys also report that 50% of Gen Z have used ChatGPT to find stock picks ([Yahoo Finance](https://finance.yahoo.com/news/80-millennials-gen-z-used-151214803.html)). "Walk me through a DCF" is exactly what a free chatbot mock interview does well.
- **The segment is small and seasonal.** The docs estimate 150–300k active recruits, flagged [U], and recruiting happens in bursts. A $49 one-time pass is a good product and a poor subscription business.
- **Students cut revenue per payer.** MARKET_ENTRY's own arithmetic says a student-heavy mix takes month-36 ARR from about $330k to about $194k.
- **The founder being "one of them" is a bias risk.** It speeds up the interviews, but it tempts you to generalise from your own club.

**Reframe.**
- **Cheap test:** in 7 days, sell **10 paid Recruiting Passes before building them**: a Stripe link to a Google Doc of 40 DCF drills plus one live mock over Zoom. If 10 people won't pay $49 for a concierge version, the app version won't sell either.
- **10x weirder:** sell to the **club, not the student**. $300 a semester gets a club treasurer a pitch-competition kit: real-company data packs, a judging rubric, and a leaderboard of members' learning (never returns). That means one buyer, one budget and a whole room of users.
- **Do less:** pick **only B (the recruits)** for 90 days. Serve A through the free tier and ignore C.

**Verdict: change.** Keep clubs as the *channel*. Make the recruit the *customer*, and prove it with money, not waitlist clicks.

---

### 3. Monetization: subscription + ads + affiliate, and the free-tier limits

**Steelman.** Subscriptions carry the business, and ads and affiliate offers are small, capped add-ons that are banned from sensitive screens. The ad rules in `monetization.ts` are careful: no ads in lessons, the hub or the paywall, non-personalized ads only, and Pro is ad-free.

**Attack.**
- **Ads cost more than they earn.** The model shows **$673 in FY1** and 3.1% of revenue in FY3. Turning ads off moves break-even by one month.
  - US banner eCPMs are about $0.85 on Android and $1.10 on iOS ([Maf.ad](https://maf.ad/en/blog/mobile-ads-ecpm/)), and non-personalized ads pay less than that.
  - The price is an ad SDK sitting in an app with a Plaid backend and bank-data encryption. That adds App Privacy label disclosures, review risk, and a banner beside the "never stock tips" screener. A brand built on trust shouldn't sell that trust for $56 a month.
- **The rewarded "+1 heart" ad puts a gambling-adjacent mechanic on learning.** Hearts, plus a 1-new-lesson-a-day cap, plus paying with your attention to keep going: the free tier is metered twice. Duolingo's 2025 switch from hearts to "energy" produced a public revolt over being "punished for using the app" ([Android Authority](https://www.androidauthority.com/quitting-duolingo-energy-system-3599842/), [Class Central](https://www.classcentral.com/report/duolingo-breaks-hearts-for-energy/)). Duolingo has 100M users to absorb that. You have zero.
- **The daily lesson cap throttles the habit you are trying to build.** The model's biggest levers are organic growth and activation (the tornado chart). Capping new lessons at one a day after day 3 caps the very engagement that drives both. Gate *depth* instead: DCF, ROIC, Practice, X-ray.
- **Affiliate is off (good) but still built.** $215 in FY1 doesn't justify the FTC-disclosure surface. It also puts brokerage referrals inside an "education, not advice" brand.
- **The plans don't match the chosen wedge.** The Recruiting Pass, the only product with proven willingness to pay (the WSP and BIWS comparables), isn't in `PLANS`. The Student plan at $39.99 is.
- **The paywall sells features nobody has asked for yet.** The benefit bullets are X-ray, compare and "link every account", which are the unvalidated features. No benefit bullet is about passing an interview.

**Reframe.**
- **Cheap test:** turn on a **hard paywall with a trial** for half of TestFlight cohort 2 and leave freemium on the other half. The docs cite 10.7% vs 2.1% conversion [S13]. The code already supports the A/B through `FREE_LIMITS`.
- **10x weirder:** **pay-what-you-learn**. Free forever, and you buy a $9 "unit certificate" only when you pass a proctored unit exam. People pay for *proof*, not access, which also fits the positioning ("prove it").
- **Do less:** delete ads and affiliate from v1. Set `adsEnabled: false` and remove the SDK dependency. Launch with Free, Pro and the Recruiting Pass.

**Verdict: change.** Kill ads and hearts at launch, meter depth instead of daily count, and add the Recruiting Pass. The single most valuable change is removing the ad SDK.

---

### 4. The money hub: "can I cover the card?"

**Steelman.** A yes/no due-date check that counts pay you've earned but not yet been paid for is a gap no incumbent fills. The research is genuinely good (MONEY_HUB §1), and balance checking is a far more frequent habit than lessons.

**Attack.**
- **It is the most expensive feature, and it is free.** Plaid bills Transactions, Liabilities and Investments monthly *per Item*, even for errored Items ([Plaid billing docs](https://plaid.com/docs/account/billing/)). Third-party estimates put it at about $1.50–2.00 per Item per month below 1,000 Items ([Vendr](https://www.vendr.com/marketplace/plaid), [Monetizely](https://www.getmonetizely.com/articles/plaid-vs-yodlee-how-much-will-financial-data-apis-cost-your-fintech-in-2025)). The model already shows Plaid as the **largest COGS line: 16% of FY3 revenue**, and the free tier includes a linked bank. Free users therefore cost money every month to deliver a feature the positioning calls secondary.
- **It contradicts the plan it sits in.** MARKET_ENTRY D4 says "No [linking] in beta… GLBA security duties the day you store bank data". The backend already stores encrypted Plaid tokens and verifies webhooks. That is well engineered (QA_REVIEW), but it is liability taken on before anyone asked for it.
- **Its value depends on the accuracy you are weakest at.** Plaid's recurring streams need 3 occurrences to become `MATURE`, and campus paychecks vary with hours (MONEY_HUB §3). A green "covered, $62 to spare" that turns out wrong is the Hello Digit pattern the research itself cites: an algorithm causing overdrafts led to a CFPB action.
- **The unique part doesn't need Plaid at all.** The differentiator is the "work not yet cashed" ledger, which the user types in. Plaid supplies the commoditised part: balances and due dates, which the bank's own app already shows.
- **The commoditisation clock is short.** ChatGPT Finances already shows "upcoming payments" via Plaid (MONEY_HUB §1).

**Reframe.**
- **Cheap test:** a **manual Due-Date Check** in the web demo, or even an iOS Shortcut or SMS bot: "Text me your balance, card statement and due date, plus the hours you've logged." Run it for 20 students for 2 weeks and count how many check in at least 3 times a week. MARKET_ENTRY already sets the bar at 30% weekly.
- **10x weirder:** a **payroll-cutoff reminder only**. "You worked 6 hours at the library this week. Submit them by Thursday 5pm or they land after your card is due." There is no bank data at all, and it is the one thing nobody else can see.
- **Do less:** cut the free tier to manual entry, zero linked banks, and put linking behind Pro.

**Verdict: change.** Set `FREE_LIMITS.money_accounts` to 0 and ship manual entry only in beta. Link banks only if the manual check hits the 30%-weekly bar.

---

### 5. Growth plan: organic, SEO and clubs

**Steelman.** Paid acquisition doesn't pay back (LTV/CAC 0.24–0.31x), so organic is the only option. Free SEC data makes thousands of ticker-by-concept pages nearly free to produce, and clubs let a student founder reach people in person.

**Attack.**
- **Programmatic SEO for informational queries is being eaten by AI answers.** Pew found Google users clicked a result in **8% of visits when an AI summary appeared, against 15% without** ([Pew Research](https://www.pewresearch.org/short-reads/2025/07/22/google-users-are-less-likely-to-click-on-links-when-an-ai-summary-appears-in-the-results/)). "Costco ROIC explained" is precisely the query an AI Overview answers. Stock Analysis's SEO playbook was built before 2024.
- **Ticker pages are a crowded SERP.** Stock Analysis, Macrotrends, WallStreetZen, Finviz and Yahoo already have domain authority. A new domain's pages won't rank for months, and the 90-day gates close first.
- **Clubs are a channel with a ceiling.** About 600 student-run funds (MARKET_ENTRY §0) at 20–40 members each is roughly 12–24k people in total. That is fine for a beachhead but not a growth engine, and club leaders turn over every year.
- **The viral loop isn't built.** Guess the Company plus share cards was *the* growth loop in PRODUCT_STRATEGY, and it doesn't exist in the app.
- **The model's biggest lever is organic growth month over month** (±$29–41k of FY3 EBIT on a ±20% move), and it is an assumption with no data behind it.

**Reframe.**
- **Cheap test:** build **Guess the Company as a web page this week**, with no app (PRODUCT_STRATEGY W2 already says so). Post the daily grid on r/SecurityAnalysis, club group chats and X for 7 days, and measure the share rate and day-2 return. It is the cheapest possible test of whether anyone comes back.
- **10x weirder:** **ship inside the channel.** Build a Discord bot or GroupMe bot that posts the daily puzzle and the weekly earnings quiz into club servers. Distribution lives where the clubs already talk, and the app becomes the place to go deeper.
- **Do less:** stop expanding SEO pages beyond about 100. Put the hours into a weekly newsletter ("The Weekly 10-K"), an owned channel that AI Overviews can't intercept.

**Verdict: change.** Lead with the shareable daily puzzle and club-native bots. Treat SEO as a slow side bet.

---

### 6. The name "Tenbagger" and the brand

**Steelman.** It is catchy, finance-literate (Peter Lynch's word) and memorable to exactly the club investors you're targeting. It has also been the working name across 48k lines of code and every doc.

**Attack.**
- **Your own agents already said to kill it, twice** (PRODUCT_STRATEGY §3, MARKET_ENTRY §1). Nothing changed except more code with the name in it.
- **There is a same-category collision.** The existing "Tenbagger" Android app promotes "top US gainers and losers" ([Google Play](https://play.google.com/store/apps/details?id=app.tenbagger.android&hl=de&gl=US)). That is literally the kind of top-movers list your guardrails ban, following the Mass. v. Robinhood order.
- **There is a concrete bug.** `monetization.ts` points `termsUrl`, `privacyUrl` and `studentVerificationUrl` at **`tenbagger.app`**, which PRODUCT_STRATEGY §3 identifies as *that other app's* domain. Your paywall links to someone else's privacy policy.
- **The name makes the wrong promise.** It literally means "a stock that went up 10x", which is the opposite of "never stock tips". It invites App Review and state-regulator questions, and it attracts the get-rich audience you don't want.
- **SEO is hopeless.** "Tenbagger" search results are dominated by "how to find tenbagger stocks" content and the WallStreetZen "Potential Tenbaggers" screener ([WallStreetZen](https://www.wallstreetzen.com/stock-screener/tenbagger-stocks)).
- **The cost of switching only grows.** The bundle ID can't change after the first upload (LAUNCH_CHECKLIST 0.3).

**Reframe.**
- **Cheap test:** put 3 names (Unlevered, a plain-English option such as "Footnotes" or "Tenkay", and Tenbagger) on the same landing page for 3 days of the same traffic, and run a 10-minute USPTO knockout on the winner.
- **10x weirder:** name it after the **ritual, not the asset**: "Earnings Night", "The Daily Filing". The name becomes the habit.
- **Do less:** keep "Tenbagger" as a codename only. Pick any clear, safe name this week and move on. The name matters less than the fact that it isn't this one.

**Verdict: kill (the public name).** Decide this week, before the domain, LLC, D-U-N-S and bundle ID lock it in.

---

### 7. The design-direction process

**Steelman.** Three clickable prototypes on real data (Ledger, Arcade, Terminal Lite), each tokenised for direct import into `tokens.ts`, make the trade-offs concrete. That is cheap to compare and cheap to adopt.

**Attack.**
- **The three directions are really three personas.** Ledger fits Edu and trust, Arcade fits beginners and habit, and Terminal Lite fits clubs and recruits (the table in `prototypes/index.html`). Picking a direction before picking the customer is choosing the audience through a colour palette.
- **The designer's note recommends all three.** "A's type… with B's streak components… and C's dense tables for Pro" is a committee answer. It produces a product that looks like none of them and costs the most to build.
- **Nobody outside the build has seen them.** No user has looked at any of the prototypes. The judgement is internal taste, generated by the same system that wrote the code.
- **v2 prototypes are being made before v1 has a verdict.** More options won't settle it. Evidence will.

**Reframe.**
- **Cheap test:** a **5-second test** with 20 club members. Show each of the three phone screens for 5 seconds, then ask "Who is this app for? Would you pay for it?" Alternatively, use the three screens as the three landing-page hero images in the fake-door test and let sign-ups decide.
- **10x weirder:** design the **share card first**. The screenshot that travels in group chats is the brand, and the app should look like the card.
- **Do less:** stop generating directions. Pick C if the recruit is the customer (Review 2) or A if not, and accept the default system fonts until retention is proven.

**Verdict: change.** Freeze design work until the beachhead decision is made. Then pick one direction, no blend.

---

### 8. The build approach: a first-time solo founder with a huge AI-generated codebase

**Steelman.** AI agents let one person build in weeks what used to take a team months, and the quality signals are real. There are 344 passing tests, row-level security (RLS) on all 18 tables, verified webhook signatures and deterministic formula tests (QA_REVIEW). A deep, correct data pipeline is a real moat.

**Attack.**
- **The founder may not be able to maintain what was built.** About 48k lines across Python, TypeScript, Deno/Supabase SQL, Astro, Expo and a GitHub Actions data pipeline: 7 runtimes, all authored by agents. When a Plaid webhook breaks at 2am, or App Review rejects a build, can the founder fix it without an agent? Industry data shows AI-assisted code churns more and duplicates more: 7.9% of new code revised within two weeks, and copy-pasted code overtaking moved code for the first time ([GitClear 2025](https://www.gitclear.com/ai_assistant_code_quality_2025_research)).
- **The code outran the learning.** The 90-day plan said: landing page and interviews in weeks 1–4, app build in weeks 5–8 *after* Gate 1. Instead the app, backend, paywall, ads, store prep and website all exist, with zero interviews. Every line built before validation is a line you're emotionally and financially attached to (the sunk-cost trap), and each one is maintenance debt if the pivot comes.
- **The build drifts toward what agents find easy to build.** A YCharts feature teardown turned into fund X-ray and compare. Research turned into a Plaid backend. The strategy's cheap S-effort features (Guess the Company, Quests, My Stocks) were skipped. The agents are optimising for impressive and complete, not for the next learning milestone.
- **The surface area is also a security and compliance liability.** Encrypted bank tokens, 18 RLS tables and an ad SDK all carry GLBA Safeguards duties the day the first real user links a bank. Tests passing is not a security programme.
- **Opportunity cost.** Every hour spent reviewing agent PRs is an hour not spent interviewing students.

**Reframe.**
- **Cheap test:** the **"can I explain it" drill**. Pick 5 random files (one each from backend, money, screener, pipeline and mobile). Without an agent, explain what each does and change one behaviour in each. Any you can't do mark the areas to freeze or delete.
- **10x weirder:** go **no-code for validation**. Run the first 90 days on a Typeform lesson, a Google Sheet screener, a Substack newsletter and Stripe links. Keep the codebase as a private asset and only turn it on once a gate is passed.
- **Do less:** a **code freeze plus a deletion pass**. Mark `money/` backend/Plaid, ads, affiliate, fund X-ray, compare and articles as "not in v1" behind flags, or delete them to a branch. Aim for a v1 you can read in one weekend, at a guess under 15k lines.

**Verdict: change.** Freeze feature work now. The next 10 days go to interviews and the fake door, not to code.

---

### Top 5 pushbacks the founder should decide on this week

1. **Stop building; start talking.** Zero interviews and zero sign-ups captured against about 48k lines of code. *Alternative:* a feature freeze until Gate 1. Connect the waitlist endpoint today, do 15 interviews by 10/12, and run the Learn vs Money fake door.
2. **Retire "Tenbagger" now.** It collides with a same-category app that promotes gainers and losers, promises 10x returns, and currently points your legal links at that app's domain (`tenbagger.app`). *Alternative:* a 3-name landing test plus a USPTO knockout this week, before the LLC, domain and bundle ID are locked.
3. **Unbundle: one app, one promise.** Lessons, screener and hub serve different people against different competitors. *Alternative:* launch Learn + Screener Quests + Guess the Company, the MVP the strategy actually chose. Move the money hub to a branch, or to a manual-only experiment.
4. **No free bank linking and no Plaid in beta.** It is the largest COGS line (16% of FY3 revenue), carries GLBA duties, and contradicts MARKET_ENTRY D4. *Alternative:* set `money_accounts: 0` for free users and ship a manual Due-Date Check plus a "submit your hours" reminder. Link banks only if 30% of users check weekly.
5. **Cut ads and hearts; charge for proof, not access.** Ads earn about $56 a month in FY1, and the rewarded-heart mechanic plus the 1-lesson daily cap throttle the habit. *Alternative:* `adsEnabled: false`, remove the SDK, gate depth rather than daily count, add the $49 Recruiting Pass to `PLANS`, and pre-sell 10 concierge passes before building the track.

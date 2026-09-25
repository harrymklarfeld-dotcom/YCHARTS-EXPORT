# App Store listing

Exact strings are in [`../metadata.json`](../metadata.json); run `node store/check-metadata.mjs`
after any edit. Limits: name 30, subtitle 30, promotional text 170, keywords 100, description
4,000 ([limits reference](https://www.applaunchflow.com/blog/app-store-metadata-character-limits-2026)).

| Field | Value | Chars |
|---|---|---|
| Name | Tenbagger: Learn Investing | 26 |
| Subtitle | Bite-size stock market lessons | 30 |
| Promotional text | Learn to read any public company's numbers in 3 minutes a day. Every lesson is built from real SEC filings. Education only, never stock tips. | 141 |
| Keywords | `finance,accounting,10-k,earnings,balance,sheet,cash,flow,valuation,dcf,ratio,screener,literacy,quiz` | 99 |
| Description | [`description.txt`](description.txt) | ~2,400 |
| Primary / secondary category | Education / Finance | |
| Support URL | https://tenbagger.example/support (**TODO**: real domain) | |
| Privacy Policy URL | https://tenbagger.example/legal/privacy (the website's `/legal/privacy` page) | |
| License agreement | Apple's Standard EULA (link it in the description, which `description.txt` does) | |
| Copyright | 2026 YOURCOMPANY LLC | |

> **Name caveat.** `docs/PRODUCT_STRATEGY.md` §3 recommends dropping "Tenbagger" publicly (an
> Android app already uses it; the word promises 10x returns). If you rename (front-runner
> "Unlevered"), change `APP_NAME` in `app.config.ts`, `metadata.json`, and both descriptions
> **before** the first submission. Renaming later loses nothing technical but splits reviews,
> links and press. Reserve the name in App Store Connect as soon as the developer account exists.

## ASO rationale

Apple indexes **name + subtitle + keyword field together**, and a word counts once no matter where
it appears. So the keyword field never repeats `learn`, `investing`, `stock`, `market`, `lessons`
or `bite-size` (the checker enforces this). Rules followed:

1. **Name carries the highest-volume intent.** "learn investing" is the head term beginners type;
   the brand alone ranks for nothing on day 1.
2. **Subtitle adds the second cluster**: "stock market" and "lessons". Apple combines words across
   fields, so we also rank for "stock market lessons", "learn stock market", "investing lessons".
3. **Keyword field = long tail the competitors under-serve**: accounting, financial statements
   (`balance`,`sheet`,`cash`,`flow` combine into "balance sheet" and "cash flow"), `10-k`, `earnings`,
   `valuation`, `dcf`, `ratio`, `screener`, `literacy` (as in "financial literacy"), `quiz`.
   Singular forms only; Apple matches simple plurals.
4. **No competitor or trademark names** (Duolingo, Robinhood and the like). That is a guideline
   2.3.7 rejection and a trademark risk.
5. **No "free", "best", "#1"**: wasted characters or metadata rejections.
6. Deliberately **not targeted**: "trading", "day trading", "crypto", "signals", "stock picks". They
   attract the wrong users and invite the "is this investment advice?" review question.

After launch, re-evaluate keywords every 4–6 weeks using App Store Connect → Analytics → Sources →
App Store Search, and swap the weakest two terms. See the ASO section of the launch checklist.

## Category decision: **Education primary, Finance secondary**

| Consideration | Education primary | Finance primary |
|---|---|---|
| What the app *is* | Lessons, quizzes, streaks. Matches the binary and the review notes | Reads as a markets or money tool |
| Guideline 3.2.1(viii): apps "used for financial trading, investing, or money management should be submitted by the financial institution performing such services" | We perform none of those services. Education framing matches reality and keeps the reviewer on the education checklist | Invites the reviewer to ask whether we are that institution, and for licences |
| Guideline 5.1.1(ix): regulated financial services must be submitted by a legal entity | Satisfied either way: we enroll as an LLC (see checklist) | Same |
| Competition and charts | Smaller charts; a new app can reach category top lists | Dominated by banks and brokers with huge install counts |
| Search Ads cost | Lower | Finance CPA is about $13 (BENCHMARKS [S17]) |
| Discovery for finance searchers | Covered by the **secondary** category and keywords | |

Secondary category Finance keeps us browsable next to money apps without claiming to be one.

**Revisit if** account linking (Plaid) ships. A Money hub that shows real balances is closer to
"money management" under 3.2.1(viii). The LLC submitter satisfies 5.1.1(ix), but have counsel
confirm that read-only aggregation for education fits, and keep Education primary.

## Subscriptions shown on the product page

Create them in App Store Connect → Monetization → Subscriptions, in **one subscription group**
("Tenbagger Pro") so users can upgrade and downgrade without double billing:

| Reference name | Product ID | Duration | Price (US) | Intro offer | Group level |
|---|---|---|---|---|---|
| Pro Annual | `tenbagger_pro_annual` | 1 year | $79.99 | 7-day free trial (new subscribers) | 1 |
| Student Annual | `tenbagger_student_annual` | 1 year | $39.99 | none | 1 |
| Pro Monthly | `tenbagger_pro_monthly` | 1 month | $12.99 | none | 2 |

The product ids come from `src/config/monetization.ts` (`PLANS[*].storeProductId`); the app's plan
ids are `pro_monthly`, `pro_annual` and `student_annual`. Every subscription needs a display name,
a description, and a **review screenshot of the paywall** before it can be submitted with the first
build. **Student plan caveat:** Apple has no built-in student verification. The app must gate the
Student product behind its own .edu check (`LEGAL.studentVerificationUrl`). If that check is not
live at submission, hide the Student card (`FLAGS.studentPlanEnabled = false`) and do not submit
that product yet. An unreachable product gets flagged under guideline 2.1.

## Sources
- App Review Guidelines (3.1.2, 3.2.1(viii), 5.1.1(ix), 2.3.7): https://developer.apple.com/app-store/review/guidelines/
- Subscription metadata and EULA placement (3.1.2): https://maxmannstein.com/blog/where-to-put-the-eula-for-ios-apps-implementing-subscriptions
- Metadata limits: https://www.applaunchflow.com/blog/app-store-metadata-character-limits-2026

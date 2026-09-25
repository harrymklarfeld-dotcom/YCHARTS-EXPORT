# App Review notes

Paste the block below into App Store Connect → version → **App Review Information → Notes**. Fill
the contact fields with a phone that someone answers during review. Guideline 2.1(a) requires
either a demo account or a fully-featured demo mode for account-based features. v1 has **no
accounts**, so say so explicitly and give the steps.

For the **v1.x build with account linking**, use the second block and create the demo account
first.

---

### Block A: v1.0 (no accounts, no linking)

```
Thank you for reviewing Tenbagger.

WHAT THE APP IS
Tenbagger is an EDUCATIONAL app. It teaches people to read public-company financial statements
(margins, cash flow, valuation) through short quiz-style lessons built from companies' public SEC
filings. It is not investment advice. It does not recommend securities, execute trades, hold
customer money, give personalized advice, or connect to any brokerage or bank account in this
version. A disclaimer is always visible on the Profile tab and under every lesson source chip.

NO LOGIN REQUIRED
There is no account or sign-in. All progress is stored on the device. No demo account is needed.

HOW TO REVIEW (about 3 minutes)
1. Learn tab → tap the first lesson → answer 5 questions. Each answer shows an explanation and the
   filing it came from (e.g. "COST FY2025 10-K").
2. Screener tab → pick a preset screen → tap any metric name for a plain-English explainer.
3. Companies tab → open any company → "Practice with this company".
4. Money tab → shows a FICTIONAL sample persona ("Sample" label at the top) to demonstrate how
   personal numbers are explained like a company's. No real account data is used or requested.
5. Profile tab → streak, XP, daily goal, theme and the educational disclaimer.

IN-APP PURCHASES (auto-renewable subscriptions, one group "Tenbagger Pro")
- tenbagger_pro_monthly  $12.99 / month
- tenbagger_pro_annual   $79.99 / year, 7-day free trial for new subscribers
- tenbagger_student_annual $39.99 / year (requires .edu verification in-app)
To reach the paywall: open any company and tap "Practice with this company" (a Pro feature), or
tap any "Pro" badge. Profile → Subscription also opens it. (New installs get unlimited lessons for
the first 3 days, so the daily lesson limit will not trigger during review.) The paywall shows price, period,
trial terms, and links to Terms of Use (Apple standard EULA) and Privacy Policy, plus Restore
Purchases. Purchases work with a Sandbox Apple Account.

ADS
Free users may see non-personalized Google AdMob ads at the end of articles and between screener
results only. Never in lessons, on the paywall, or on the Money tab. We do not track users and do
not show the App Tracking Transparency prompt. Pro is ad-free.

DATA
Companies and lessons use public SEC filing data bundled with the app. XP and streaks are earned
only by completing lessons, never by trading or holding securities.

Submitted by YOURCOMPANY LLC (organization account), per guideline 5.1.1(ix).
Contact: <founder name>, <phone>, <email>
```

### Block B: v1.x with accounts and read-only account linking

Before submitting: create `review@YOURCOMPANY.com` in Supabase with MFA **disabled for that user
only**, or give Apple a TOTP secret, because linking requires aal2 (`backend/SECURITY.md` §4.5).
Point the build at Plaid **Sandbox** or at a review-only production flag that lets Apple use
Plaid's test institution. Verify the full flow on a clean device the day you submit.

```
DEMO ACCOUNT
Email: review@YOURCOMPANY.com
Password: <password>
(MFA: enter code from TOTP secret <secret>, or MFA is disabled for this review account.)

ACCOUNT LINKING IS READ-ONLY
Linking uses Plaid Link. Credentials are entered inside Plaid's own UI; we never see them. We
request read-only products only (investments; transactions and liabilities only if the user opts
into the Money hub). We cannot move money, place trades, or change anything at the institution.
Test institution: choose "First Platypus Bank" in Plaid Link, username user_good, password
pass_good (Plaid Sandbox credentials).

Linked data is used only to build educational lessons about the user's own holdings (for example
"your holdings' average margin"). No recommendations to buy or sell. Users can unlink any account
(Profile → Linked accounts → Unlink) and delete their account and all data (Profile → Delete
account), per guideline 5.1.1(v).
```

## Things that must be true on the build you submit

- [ ] No "coming soon" buttons that do nothing (the current Profile "Link brokerage (coming soon)"
      row). Hide it in production (`APP_ENV === 'production'`) or make it open a waitlist sheet. Placeholder
      UI is a guideline 2.1 / 4.2 rejection risk.
- [ ] Paywall shows the full price, billing period, trial length and what happens after the trial,
      with working Terms and Privacy links and **Restore Purchases** (guideline 3.1.2).
- [ ] The Student plan is either verifiable in-app or hidden (see `listing.md`).
- [ ] Production AdMob **app** ids and ad-unit ids set in EAS env (`ADMOB_IOS_APP_ID`,
      `EXPO_PUBLIC_ADMOB_*`). No test ads in the store build.
- [ ] Disclaimer visible without scrolling on Profile, and in the App Store description.
- [ ] App works offline and on first launch with no network (review devices are sometimes on
      restricted networks).

# Google Play Data safety answers

Play Console → Policy → App content → Data safety. Under Play's definitions, "collected" means sent
off the device. "Shared" means transferred to a third party, but **not** to a service provider that
processes data on your behalf. On-device-only data is not declared.

## v1.0 (no accounts, non-personalized AdMob, RevenueCat, no Plaid)

**Overview questions**

| Question | Answer |
|---|---|
| Does your app collect or share any of the required user data types? | Yes |
| Is all of the user data collected by your app encrypted in transit? | Yes (all SDK traffic is HTTPS) |
| Do you provide a way for users to request that their data is deleted? | Yes. There are no accounts; purchase records can be deleted by emailing support (RevenueCat supports deleting a customer), and ad data is controlled by Google's ad settings. Give the web URL `https://tenbagger.example/legal/privacy#delete`. **TODO:** add that anchor to the privacy page |

**Data types**

| Category → type | Collected | Shared | Optional? | Purposes | Source |
|---|---|---|---|---|---|
| Financial info → Purchase history | Yes | No (RevenueCat is a service provider) | Required for subscribers | App functionality | RevenueCat |
| Device or other IDs → Device or other IDs | Yes | **Yes** (Google, for ads) | Required for free tier | Advertising or marketing; Fraud prevention, security and compliance | AdMob |
| App activity → App interactions | Yes | Yes | Required for free tier | Advertising or marketing; Analytics | AdMob |
| App info and performance → Crash logs | Yes | No | Required | App functionality (SDK diagnostics) | AdMob |
| App info and performance → Diagnostics | Yes | Yes | Required | Advertising or marketing; Analytics | AdMob |
| Location → Approximate location | Yes | Yes | Required for free tier | Advertising or marketing | AdMob (from IP address) |

**Not collected in v1:** personal info (name, email, user IDs), financial account info, messages,
photos, contacts, calendar, health, web history, files, precise location, audio. **Lesson
progress stays on the device and is not declared.**

Cross-check the AdMob rows against Google's own Data safety guidance for the SDK version you ship
(AdMob help → "Prepare your app for Google Play's Data safety section"). Google updates it with SDK
releases.

## Additions when accounts / linking ship (v1.x)

| Category → type | Collected | Shared | Purposes |
|---|---|---|---|
| Personal info → Email address | Yes | No (Supabase = service provider) | App functionality, Account management |
| Personal info → User IDs | Yes | No | App functionality, Account management |
| App activity → Other actions (lesson progress, streaks) | Yes | No | App functionality, Analytics |
| Financial info → Other financial info (holdings, balances, transactions, bills, income streams) | Yes | No (Plaid / SnapTrade process it for us) | App functionality |
| Financial info → Credit score | No | | |

Then also:
- Answer "Yes" to **account deletion** and give both an **in-app path** and a **web URL** where users can
  request deletion without reinstalling the app (Play requires a web link for apps with accounts).
- Update **App access** with demo credentials.
- Update the Financial features declaration (see `financial-features.md`).

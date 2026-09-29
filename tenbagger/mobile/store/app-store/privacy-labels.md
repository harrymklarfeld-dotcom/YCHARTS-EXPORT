# App Store "App Privacy" answers (nutrition label)

App Store Connect → App Privacy → Get Started. Apple counts data as **collected** only when it is
transmitted off the device and kept longer than needed to handle one request. Data that never
leaves the phone is not collected. Answers must cover every SDK in the binary.

## What the v1.0 binary actually does

| Data | Where it goes | Collected? |
|---|---|---|
| Lesson progress, XP, streak, hearts, daily goal, theme | AsyncStorage on the device only (`src/state/store.ts`); no backend | **No** |
| Screener filters, companies viewed | On device | **No** |
| Money tab | Bundled **fictional** sample persona (`assets/data/money.sample.json`) | **No** |
| Subscription purchases | StoreKit → RevenueCat (`react-native-purchases`), keyed to an **anonymous** RevenueCat app user id; no login | **Yes**: Purchase History |
| Ads (free users) | Google Mobile Ads SDK (AdMob), **non-personalized** (`ADS_MODE=npa`, `FLAGS.personalizedAds=false`), no ATT prompt, so IDFA is unavailable | **Yes**: see below |
| Email, name, phone, contacts, photos, precise location | never requested | No |
| Brokerage or bank data (Plaid) | **not in v1** | No |

## Answers for v1.0 (ads non-personalized)

**Do you or your third-party partners collect data from this app?** Yes.

| Data type (Apple's name) | Purpose(s) | Linked to user? | Used for tracking? | Source |
|---|---|---|---|---|
| Purchases → Purchase History | App Functionality | No | No | RevenueCat (anonymous id, no account) |
| Identifiers → Device ID | Third-Party Advertising | No | No | AdMob (IDFV / ad id; IDFA unavailable without ATT) |
| Usage Data → Product Interaction | Third-Party Advertising, Analytics | No | No | AdMob (ad clicks and impressions) |
| Usage Data → Advertising Data | Third-Party Advertising | No | No | AdMob |
| Location → Coarse Location | Third-Party Advertising | No | No | AdMob derives it from the IP address |
| Diagnostics → Crash Data | App Functionality | No | No | AdMob SDK crash logs |
| Diagnostics → Performance Data | Third-Party Advertising, Analytics | No | No | AdMob |

The resulting label shows **"Data Not Linked to You"**: Purchases, Identifiers, Usage Data,
Location, Diagnostics. **"Data Used to Track You"** is empty and there is no "Data Linked to You".
These rows match `ios.privacyManifests.NSPrivacyCollectedDataTypes` in `app.config.ts`. Change both
together.

Before submitting, re-read Google's current disclosure table and add any type it lists that is
missing here: https://developers.google.com/admob/ios/privacy/data-disclosure. RevenueCat's
guidance: https://www.revenuecat.com/docs/platform-resources/apple-platform-resources/apple-app-privacy.

## Variant: personalized ads with the ATT prompt (`ADS_MODE=personalized`)

Only if `FLAGS.personalizedAds` and `FLAGS.requestTrackingAuthorization` are both true (the config
then adds `NSUserTrackingUsageDescription`). Change these rows to **Used for tracking: Yes**:
Device ID, Product Interaction, Advertising Data, Coarse Location. The label then gains **"Data
Used to Track You"**, which hurts conversion for a finance-education brand. We recommend staying on
non-personalized ads.

## Variant: ads off (`ADS_MODE=off`, `FLAGS.adsEnabled=false`)

Only Purchases → Purchase History remains. Also remove `react-native-google-mobile-ads` from the
binary: Apple judges the SDK that is linked, not whether it is called.

## Future versions: add these rows when the feature ships

| Feature | Add | Purpose | Linked | Tracking |
|---|---|---|---|---|
| Accounts / cloud sync (Supabase Auth) | Contact Info → Email Address | App Functionality | Yes | No |
| | Identifiers → User ID | App Functionality | Yes | No |
| | Usage Data → Product Interaction (lesson progress synced to `lesson_progress`, `daily_activity`) | App Functionality, Analytics | Yes | No |
| | Purchases → Purchase History changes to **Linked: Yes** once RevenueCat is logged in with the user id | | | |
| Brokerage linking (Plaid / SnapTrade, read-only) | Financial Info → Other Financial Info (holdings, account names, last-4, balances) | App Functionality | Yes | No |
| Money hub (Plaid transactions / liabilities, opt-in) | Financial Info → Other Financial Info (transactions, balances, bills, income streams), plus Financial Info → Credit Info if liabilities include credit-card data | App Functionality | Yes | No |
| Product analytics (PostHog / Amplitude) | Usage Data → Product Interaction; Diagnostics | Analytics | per vendor setup | No |

With accounts, guideline **5.1.1(v)** also requires in-app account deletion
([Apple](https://developer.apple.com/support/offering-account-deletion-in-your-app/)). The backend
already cascades deletes (`backend/SECURITY.md` §4.6); the app needs a "Delete account" button that
calls it and revokes Plaid items.

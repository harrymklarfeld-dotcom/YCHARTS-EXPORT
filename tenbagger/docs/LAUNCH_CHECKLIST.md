# Launch checklist: from zero to live in both stores

Written 2026-09-25 for a first-time founder. Do the steps **in order**, because later steps need
IDs from earlier ones. **[FOUNDER]** marks steps only you can do: they need your identity, your
signature, your money or your legal authority. Everything else an engineer or agent can do once
the accounts exist. Costs are US, as of September 2026. Check each linked page before you pay.
Nothing here is legal or tax advice.

Store copy and form answers are in `mobile/store/` (start at `mobile/store/README.md`). Build
config is in `mobile/app.config.ts` and `mobile/eas.json`.

**Critical path:** LLC → D-U-N-S (up to 30 days) → Apple organization enrollment (days to about
2 weeks). Start the LLC and D-U-N-S in week 1. Everything else can run in parallel.

---

## Phase 0: Decide the name (week 1, before paying for anything named)

| # | Step | Who | Cost | Time |
|---|---|---|---|---|
| 0.1 | Trademark knockout for the public name ("Tenbagger" vs the recommended "Unlevered", `PRODUCT_STRATEGY.md` §3) in USPTO classes 9 and 41 at tmsearch.uspto.gov. Ideally have counsel review it | **[FOUNDER]** + counsel | $0 DIY; about $300–800 counsel | 1–3 days |
| 0.2 | Buy the domain (.com or .app). You need it for the Apple org enrollment website check and for a work email | **[FOUNDER]** | ~$15–30/yr | same day |
| 0.3 | If you rename: change `APP_NAME` in `mobile/app.config.ts`, `mobile/store/metadata.json`, both description files, and `web/site.config.ts`. **The bundle id cannot change after the first upload**, so decide it now (for example `com.unlevered.app`) and set `BUNDLE_ID` in `eas.json` | engineer | — | 1 h |

## Phase 1: Legal entity and identifiers (weeks 1–3)

Apple guideline **5.1.1(ix)** says apps in financial services should be submitted by a legal
entity, not an individual ([App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/)).
A Google Play **organization** account also skips the "12 testers for 14 days" closed-test rule
that personal accounts face ([Play help](https://support.google.com/googleplay/android-developer/answer/14151465)).

| # | Step | Who | Cost | Time |
|---|---|---|---|---|
| 1.1 | **Form an LLC** in your home state (simplest for taxes) or Delaware or Wyoming. File the articles, name a registered agent, sign an operating agreement | **[FOUNDER]** | State fee ~$50–500; registered agent $0–300/yr; some states add annual fees (for example CA $800/yr franchise tax, DE $300/yr) | 1–10 business days |
| 1.2 | **EIN** from the IRS (irs.gov → "Apply for an EIN online") | **[FOUNDER]** | $0 | minutes, same day |
| 1.3 | Business bank account in the LLC's name (you need it for App Store and Play payouts) | **[FOUNDER]** | usually $0 | 1–3 days |
| 1.4 | **D-U-N-S number** for the LLC. First check Apple's D-U-N-S lookup tool; if there is no record, request one there for free. The legal name and address must match the LLC filing **exactly** | **[FOUNDER]** | $0 | up to 5 business days, sometimes up to 30 ([Apple](https://developer.apple.com/help/account/membership/D-U-N-S/)) |
| 1.5 | Website live on the domain with **/legal/privacy**, **/legal/terms**, **/support** and a contact email on the domain. The web app has `/legal/privacy` and `/legal/disclaimer`; **/legal/terms and /support still need building**. Put the LLC's name in the footer. Have counsel review the privacy policy and terms | engineer + **[FOUNDER]** for counsel sign-off | $0 hosting; counsel ~$500–2,000 | 1–3 days |
| 1.6 | Set `LEGAL.termsUrl` and `LEGAL.privacyUrl` in `mobile/src/config/monetization.ts` to the real pages. They currently point to `tenbagger.app/...`, while the store files use `tenbagger.example/legal/...`. Make all of them the same live URLs | engineer | — | 10 min |

## Phase 2: Developer accounts (weeks 2–4)

| # | Step | Who | Cost | Time |
|---|---|---|---|---|
| 2.1 | **Apple Developer Program as an Organization** (developer.apple.com/programs/enroll or the Apple Developer app). You need the D-U-N-S number, legal authority to bind the LLC, a work email on the domain, and the public website. Enable 2FA on the Apple Account | **[FOUNDER]** | **$99/yr** | a few days to about 2 weeks (Apple may phone you to verify) |
| 2.2 | **Google Play Console, Organization account**. Needs the D-U-N-S number, a verified payments profile in the LLC's name, and a contact phone and email | **[FOUNDER]** | **$25 one-time** | 2–7 days of identity verification |
| 2.3 | Expo account and organization (expo.dev); invite engineers | **[FOUNDER]** creates it | free tier (limited monthly builds); paid plans if you need more ([expo.dev/pricing](https://expo.dev/pricing)) | minutes |
| 2.4 | RevenueCat account and project | **[FOUNDER]** creates it | free until $2.5k monthly tracked revenue, then a % of revenue (`PRODUCT_STRATEGY.md` [S84]) | minutes |
| 2.5 | Google AdMob account in the LLC's name (payments profile and tax info); create iOS and Android apps → get the **app ids** `ca-app-pub-…~…` and ad-unit ids | **[FOUNDER]** | $0 | 1 day; ad serving on a new app can take days, and you link the store listing after launch |

## Phase 3: Store agreements, tax, banking (right after 2.1 / 2.2)

| # | Step | Who | Cost |
|---|---|---|---|
| 3.1 | App Store Connect → Business: accept the **Paid Applications Agreement**, add the **bank account**, and complete **tax forms** (W-9 for a US LLC; complete the other regions it asks for). **In-app purchases do not work, even in sandbox, until this is Active** | **[FOUNDER]** | $0 |
| 3.2 | Enroll in the **App Store Small Business Program** (developer.apple.com/app-store/small-business-program). It cuts Apple's commission from 30% to **15%** while proceeds stay under $1M/yr. Enroll **before** your first sale; it takes effect after approval, around the end of the fiscal month ([Apple](https://developer.apple.com/app-store/small-business-program/), [RevenueCat guide](https://www.revenuecat.com/blog/engineering/small-business-program)) | **[FOUNDER]** | $0 |
| 3.3 | Play Console → Payments profile: merchant account, bank, tax info. Google already charges **15%** on subscriptions, so there is nothing to enroll | **[FOUNDER]** | $0 |

## Phase 4: App records and in-app products

Product ids **must** match `mobile/src/config/monetization.ts` (`PLANS[*].storeProductId`). Plan ids
in the app are `pro_monthly`, `pro_annual` and `student_annual`. `node mobile/store/check-metadata.mjs`
checks that the store file matches the code.

| # | Step | Who |
|---|---|---|
| 4.1 | App Store Connect → Apps → **+ New App**: platform iOS, name (this reserves it), language en-US, bundle id = `BUNDLE_ID`, SKU `tenbagger-ios`. Copy the numeric **Apple ID** into `eas.json` → `submit.production.ios.ascAppId`, and your Team ID into `appleTeamId` | **[FOUNDER]** or admin |
| 4.2 | App Store Connect → Subscriptions → group **"Tenbagger Pro"** → `tenbagger_pro_annual` ($79.99/yr, intro offer: 7-day free trial for new subscribers, level 1), `tenbagger_student_annual` ($39.99/yr, level 1), `tenbagger_pro_monthly` ($12.99/mo, level 2). Each needs a display name, a description and a paywall review screenshot | admin |
| 4.3 | App Store Connect → Users and Access → Integrations → **In-App Purchase key (.p8)**, uploaded to RevenueCat. Also create an **App Store Connect API key** (App Manager role) for `eas submit` | **[FOUNDER]** (Account Holder) |
| 4.4 | Set App Store Server Notifications (V2) to RevenueCat's URL (RevenueCat → app settings) | admin |
| 4.5 | Play Console → **Create app** (name, default language, App, Free, declarations). Subscriptions come **after** the first AAB upload (step 6.4): create subscriptions `tenbagger_pro_monthly` (base plan `monthly`), `tenbagger_pro_annual` (base plan `annual` + offer `free-trial-7d`), `tenbagger_student_annual` (base plan `annual`) | admin |
| 4.6 | Google Cloud service account with Play Console access (financial data + release manager), JSON key uploaded to **RevenueCat** and to **EAS** (`npx eas-cli@latest credentials` → Android → Google Service Account). Keep the key out of git. Enable Real-time Developer Notifications (Pub/Sub topic from RevenueCat) | admin |
| 4.7 | RevenueCat: add the iOS and Android apps, import the products, create entitlement **`pro`** (`PRO_ENTITLEMENT_ID`) attached to all 3 products, and create offering **`default`** with packages `$rc_monthly` → monthly, `$rc_annual` → pro annual, custom package `student_annual` → student annual (matches `rcPackageId`) | admin |
| 4.8 | Put the RevenueCat **public** SDK keys and the AdMob ids in EAS environment variables (expo.dev → project → Environment variables, environment `production` and `preview`): `EXPO_PUBLIC_RC_IOS_KEY`, `EXPO_PUBLIC_RC_ANDROID_KEY`, `ADMOB_IOS_APP_ID`, `ADMOB_ANDROID_APP_ID`, `EXPO_PUBLIC_ADMOB_{IOS,ANDROID}_{BANNER,NATIVE,REWARDED}` | engineer |

## Phase 5: Engineering readiness (in parallel with Phases 2–4)

| # | Step |
|---|---|
| 5.1 | `cd tenbagger/mobile && npx expo install expo-dev-client expo-updates expo-splash-screen`. The dev client is needed because RevenueCat and AdMob don't run in Expo Go. `expo-updates` enables OTA channels. `expo-splash-screen` is needed because SDK 57 configures the native splash through its plugin; `app.config.ts` registers it automatically once it's installed |
| 5.2 | `npx eas-cli@latest login`, then `npx eas-cli@latest init`. Put the project id in the `EAS_PROJECT_ID` env var (or let `eas init` add `extra.eas.projectId`), which also switches on `updates.url` |
| 5.3 | Set the real `BUNDLE_ID` in `eas.json` → `build.base.env`. Check with `npx expo config --type public` |
| 5.4 | `npx eas-cli@latest build --profile development --platform all` and install on your phones. Test a **sandbox** purchase (iOS: a Sandbox Apple Account in Settings → Developer) and a **license tester** purchase (Play Console → License testing), then restore, cancel and expire |
| 5.5 | Release blockers (see `mobile/store/app-store/review-notes.md`): hide "Link brokerage (coming soon)" in production; paywall shows price, period, trial terms, Terms and Privacy links and Restore; Student plan verifiable or hidden; no test ad ids in production; disclaimer visible |
| 5.6 | `npx tsc --noEmit`, `npx jest`, `npx expo-doctor`. Fix everything before the store build |

## Phase 6: Builds and test tracks

| # | Step | Time |
|---|---|---|
| 6.1 | `npx eas-cli@latest build --profile production --platform ios`. EAS creates the distribution certificate and provisioning profile, and enables the In-App Purchase capability for the bundle id. Log in with the org Apple Account when asked | 15–40 min |
| 6.2 | `npx eas-cli@latest submit --profile production --platform ios` uploads to App Store Connect. The build appears in **TestFlight** after processing | 10–60 min |
| 6.3 | TestFlight **internal** testers (up to 100 App Store Connect users) need no review. **External** testers (the 100 students and 100 retail users from the strategy plan) need a one-time Beta App Review | internal: immediate; beta review about 1 day |
| 6.4 | `npx eas-cli@latest build --profile production --platform android` produces an `.aab`. **The very first upload for a new app must be done by hand** in Play Console → Testing → Internal testing → Create release (the Play API can't create the first release). After that, `eas submit --platform android` uploads to the `internal` track as a draft | minutes |
| 6.5 | Internal testing track: add tester emails, share the opt-in link, and run the same purchase tests with license testers | minutes to a few hours |
| 6.6 | Optional closed testing track for the wider cohort. It is not required for organization accounts | — |

**Current platform minimums (already met by Expo SDK 57):** iOS uploads must be built with Xcode 26 /
iOS 26 SDK since 28 Apr 2026, and EAS uses current Xcode images
([Apple](https://developer.apple.com/news/upcoming-requirements/), [Expo](https://expo.dev/blog/app-store-connect-minimum-sdk-26)).
Play requires target API 36 for new apps and updates since 31 Aug 2026, and RN 0.86 targets 36
([Android](https://developer.android.com/google/play/requirements/target-sdk)).

## Phase 7: Store forms (copy from `mobile/store/`)

| # | App Store Connect | Play Console |
|---|---|---|
| 7.1 | Listing: name, subtitle, promo text, description, keywords, support and marketing URLs, category Education / Finance (`app-store/listing.md`) | Main store listing, category Education (`google-play/listing.md`) |
| 7.2 | Screenshots 6.9" (+6.5") (`screenshots.md`) | Phone screenshots, feature graphic, 512 icon |
| 7.3 | App Privacy (`app-store/privacy-labels.md`) | Data safety (`google-play/data-safety.md`) |
| 7.4 | Age rating questionnaire, override to 13+ (`app-store/age-rating.md`) | Content rating (IARC), Target audience 13+, Ads = yes, Advertising ID = yes |
| 7.5 | App Review information + notes (`app-store/review-notes.md`) | App access (no login in v1) |
| 7.6 | License agreement: Apple Standard EULA | Financial features: "My app doesn't provide any financial features" (`google-play/financial-features.md`) |
| 7.7 | Attach the 3 subscriptions to the version ("In-App Purchases and Subscriptions" section). **First-time subscriptions must be submitted with an app version** | Subscriptions activated |
| 7.8 | Export compliance: preset by `usesNonExemptEncryption: false` | — |

## Phase 8: Submit and review

| Store | What happens | Typical time |
|---|---|---|
| Apple | Submit for Review. Most apps are reviewed within 24–48 h; first submissions and finance-adjacent apps sometimes get follow-up questions. Choose **Manual release** so you control launch day | 1–3 days, allow a week |
| Google | Send the production release for review. New apps from new accounts can take several days | 1–7 days, allow 2 weeks |

Answer Resolution Center messages within hours, politely and specifically. Quote the review
notes. If a reviewer misreads the app as investment advice, reply with the educational framing and
the disclaimer location instead of changing the app straight away.

### Common rejections for finance and education apps, and how we avoid them

| Rejection | Guideline | Our prevention |
|---|---|---|
| Individual developer account for a finance app | 5.1.1(ix) | LLC plus Organization enrollment (Phases 1–2) |
| App treated as investing or money management without being the institution | 3.2.1(viii) | Education category and framing; no trading, advice or money movement; review notes say so; no linking in v1 |
| Missing subscription terms, EULA or privacy links | 3.1.2 | Paywall shows terms and links and Restore; the description includes the EULA and privacy links |
| IAP not working in review (agreements not active, products not submitted) | 2.1 | Phase 3.1 active; subscriptions attached to the version; sandbox tested |
| Placeholder or "coming soon" features, broken buttons | 2.1 / 4.2 | Hide "Link brokerage (coming soon)"; test every tab offline |
| Privacy label or manifest doesn't match SDKs | 5.1.2 / ITMS-91053 | `privacyManifests` in `app.config.ts` plus labels generated from the same list |
| ATT string present but no prompt, or tracking without ATT | 5.1.2 | Non-personalized ads; ATT string only added when `ADS_MODE=personalized` |
| Misleading claims ("guaranteed returns", "10x") | 2.3.1 / Play Deceptive Behavior | Copy says "Education, never stock tips"; no return claims in screenshots |
| Account creation without in-app deletion (once accounts ship) | 5.1.1(v) | Delete-account flow plus backend cascade (`backend/SECURITY.md` §4.6) |
| Rewards tied to trading, gamified trading | 3.2.2 / state regulators | XP and streaks come only from lessons (`src/state/store.ts` regulatory note) |
| Play: missing Financial features or Data safety declaration | Play policy | Phase 7 forms completed for every release |

## Phase 9: After launch

**Ratings prompt timing.** Use `expo-store-review` (`npx expo install expo-store-review`) with
`StoreReview.requestReview()`. Apple shows the system prompt at most 3 times in 365 days, and
Google enforces its own quota. Ask **only at a high point**: right after a lesson completed with
0 mistakes, on the user's 3rd or later active day, and at least 7 days after install. Never ask
after a paywall view, a purchase, an error, a lost heart or a failed lesson, and never gate
anything on leaving a review (guideline 1.1.7 / 5.6.1). Log each prompt locally so you ask at most
once per app version.

**ASO loop (every 4–6 weeks).**
- App Store Connect → Analytics → Sources → App Store Search shows which queries bring installs.
  Swap the 2 weakest keywords, rerun `store/check-metadata.mjs`, and ship the change with the next version.
- Use Product Page Optimization (App Store) and Store listing experiments (Play) to A/B test
  screenshot #1 and the subtitle.
- Refresh "What's New" and promotional text (no new build needed) for earnings season packs.
- Localize for en-GB, en-CA and en-AU first: same copy, extra keyword fields.
- Reply to every review in the first 90 days.

**Over-the-air updates.** `eas update --channel production` ships JS and asset fixes to
installed builds with the same `version` (runtime policy `appVersion`). Bump `APP_VERSION` in
`app.config.ts` whenever you add a native module or change native config, and never use OTA to
change what the app fundamentally does (guideline 2.5.2 / 3.3.1(b) of the Developer Program License
Agreement). Use the `preview` channel to test an update on internal builds first.

**Keep things current.**
- Renew the Apple membership every year ($99).
- Answer new age-rating questions when Apple adds them.
- Update privacy labels and Data safety with **every** new SDK.
- Before shipping accounts or Plaid linking, redo `mobile/store/` sections marked "v1.x", the
  review notes (demo account), and the WISP items in `backend/SECURITY.md`.

---

## Cost summary (first year)

| Item | Cost |
|---|---|
| LLC formation + registered agent | ~$100–800 (state dependent) + annual state fees |
| EIN, D-U-N-S | $0 |
| Domain | ~$15–30 |
| Apple Developer Program (Organization) | $99/yr |
| Google Play Console | $25 once |
| Expo EAS | $0 on the free tier; paid if you exceed its build quota |
| RevenueCat | $0 under $2.5k monthly tracked revenue |
| AdMob, TestFlight, Play testing tracks | $0 |
| Counsel (privacy policy, terms, trademark knockout) | ~$1–3k (optional but recommended) |
| **Store commission** | 15% (Apple Small Business Program; Google subscriptions) |

## Founder-only steps at a glance

0.1 trademark · 0.2 domain · 1.1 LLC · 1.2 EIN · 1.3 bank · 1.4 D-U-N-S · 1.5 counsel sign-off ·
2.1 Apple enrollment · 2.2 Play enrollment · 2.3 Expo org · 2.4 RevenueCat · 2.5 AdMob ·
3.1 Paid Apps agreement, bank and tax · 3.2 Small Business Program · 3.3 Play payments ·
4.1 app record · 4.3 IAP and API keys (Account Holder role).

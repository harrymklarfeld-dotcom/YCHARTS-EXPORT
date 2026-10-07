# Google Play listing and App content declarations

Strings are in [`../metadata.json`](../metadata.json) and
[`full-description.txt`](full-description.txt). Limits: title 30, short description 80, full
description 4,000.

| Field | Value |
|---|---|
| App name | Tenbagger: Learn Investing (26) |
| Short description | 3-minute lessons on real company financials. Education, never stock tips. (73) |
| Full description | `full-description.txt` (same copy as iOS with Google Play billing language) |
| App icon | `brand/play-icon-512.png` (512×512 PNG) |
| Feature graphic | `brand/play-feature-graphic.png` (1024×500) |
| Phone screenshots | 4–8, see [`../screenshots.md`](../screenshots.md). Aspect ratio must not exceed 2:1 |
| Category | Education |
| Tags | Education, Finance, Business (pick the closest available tags) |
| Contact email / website | support@YOURCOMPANY.com / https://tenbagger.example |
| Privacy policy | https://tenbagger.example/legal/privacy |

Play policy bans "#1", "best", "free" and call-to-action text ("Install now") in the title, icon
and screenshots
([Play preview assets](https://support.google.com/googleplay/android-developer/answer/9866151)).

## App content (Policy → App content): answers for v1.0

| Declaration | Answer |
|---|---|
| Privacy policy | URL above |
| App access | **All functionality is available without special access** (no login in v1). With v1.x accounts: "Some functionality is restricted", and provide the demo credentials from `app-store/review-notes.md` Block B |
| Ads | **Yes, my app contains ads** (AdMob, free tier) |
| Content rating (IARC questionnaire) | Category: **Reference, News, or Educational**. Violence, sexuality, language, controlled substances: No. Gambling / simulated gambling: No. User interaction features: none (no chat, no UGC, no sharing of location). Digital purchases: Yes. Expected result: Everyone / PEGI 3 / USK 0 |
| Target audience and content | Age groups: **13–15, 16–17, 18 and over**. Do **not** tick any under-13 group (that brings the Families policy, which requires Families-certified ad SDKs and bans some identifiers). "Could your store listing unintentionally appeal to children?" No |
| News app | No |
| COVID-19 contact tracing / status | No |
| Data safety | See [`data-safety.md`](data-safety.md) |
| Government app | No |
| Financial features | See [`financial-features.md`](financial-features.md) |
| Health apps | No health features |
| Advertising ID | **Yes**, the app uses the advertising ID, for **Advertising or marketing**. The AdMob SDK reads it for non-personalized ads, frequency capping and fraud prevention. If `ADS_MODE=off`, answer No; `app.config.ts` then blocks the `AD_ID` permission |

**Ads and under-16 users in the EEA/UK:** AdMob's UMP consent flow (`src/monetization/ads/consent.native.ts`)
covers GDPR consent. Because teens are in the audience, tag requests with
`tagForUnderAgeOfConsent` for EEA/UK users unless you age-gate. Open decision; see the launch checklist.

## Testing tracks (organization account)

Organization accounts are **exempt** from the "12 testers for 14 days" closed-test rule that applies
to personal accounts created after 13 Nov 2023
([Play help](https://support.google.com/googleplay/android-developer/answer/14151465),
[explainer](https://ontest.app/blog/google-play-12-testers-14-days-requirement-explained)). This is
another reason to enroll as the LLC. Suggested order: Internal testing (up to 100 testers, minutes to
publish) → Closed testing (your TestFlight-equivalent cohort) → Production with a staged rollout
(10% → 50% → 100%).

## Build requirements (checked 2026-09)

- New apps and updates must **target Android 16 (API 36)** since 31 Aug 2026
  ([Play target API](https://developer.android.com/google/play/requirements/target-sdk)).
  Expo SDK 57 / React Native 0.86 already sets `targetSdk = 36` and `compileSdk = 36`
  (`node_modules/react-native/gradle/libs.versions.toml`).
- Upload an **Android App Bundle** (`.aab`). The `production` profile in `eas.json` builds one.
- Enroll in **Play App Signing** (the default for new apps). EAS keeps the upload key.

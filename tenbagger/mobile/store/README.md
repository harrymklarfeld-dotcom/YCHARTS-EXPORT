# Store submission kit

Everything you paste into App Store Connect and Google Play Console lives here. The step-by-step
order (LLC → accounts → builds → review) is in [`../../docs/LAUNCH_CHECKLIST.md`](../../docs/LAUNCH_CHECKLIST.md).

| File | What it is | Where it goes |
|---|---|---|
| `metadata.json` | Every length-limited string (name, subtitle, keywords, promo text, short description) plus the in-app product ids | App Store Connect → App Information / version page; Play Console → Main store listing |
| `check-metadata.mjs` | `node store/check-metadata.mjs`: checks character limits, keyword waste, and that product ids match `src/config/monetization.ts` | Run before every metadata change |
| `app-store/listing.md` | Name, subtitle, keywords with ASO reasoning, category decision | App Store Connect |
| `app-store/description.txt` | App Store description (includes the subscription terms required by guideline 3.1.2) | App Store Connect → version → Description |
| `app-store/age-rating.md` | Answers to the 2025+ age-rating questionnaire | App Store Connect → App Information → Age Rating |
| `app-store/privacy-labels.md` | App Privacy ("nutrition label") answers for v1.0 and for later versions | App Store Connect → App Privacy |
| `app-store/review-notes.md` | Notes for App Review, paste as-is | App Store Connect → version → App Review Information |
| `google-play/listing.md` | Title, short/full description, content rating, target audience, ads declaration | Play Console → Grow → Store presence; Policy → App content |
| `google-play/full-description.txt` | Play full description | Play Console → Main store listing |
| `google-play/data-safety.md` | Data safety form answers | Play Console → Policy → App content → Data safety |
| `google-play/financial-features.md` | Financial features declaration answers | Play Console → Policy → App content → Financial features |
| `screenshots.md` | Screenshot plan: which screen, which caption, which size | Both stores |
| `brand/generate-icons.mjs` | Renders the icon, adaptive icon layers, splash and Play graphics from one SVG mark | Writes to `../assets/` and `brand/` |
| `brand/play-icon-512.png`, `brand/play-feature-graphic.png` | Play hi-res icon (512×512) and feature graphic (1024×500) | Play Console → Main store listing → Graphics |

## Decisions baked into these files (change them in one place)

| Decision | Current value | Where it is set |
|---|---|---|
| Name / bundle id / version | `Tenbagger`, `com.YOURCOMPANY.tenbagger`, `0.1.0` | `app.config.ts` constants (env overrides: `APP_NAME`, `BUNDLE_ID`, `APP_VERSION`) |
| iPad | **Not supported in v1** (`supportsTablet: false`) | `app.config.ts` |
| Ads | **Non-personalized AdMob ads for free users, no ATT prompt** | `ADS_MODE` in `eas.json` + `FLAGS` in `src/config/monetization.ts`; the two must agree |
| Accounts / cloud sync | **None in v1**. Progress stays on the device | Privacy labels assume this |
| Brokerage / bank linking (Plaid) | **Not in the v1 binary**. Money tab shows a fictional sample persona | If a later build turns linking on, redo privacy labels, Data safety, Financial features, and review notes (sections marked "v1.x with linking") |
| Primary category | Education (secondary: Finance) | `app-store/listing.md` explains why |

If any of those change, update the matching store answers **before** uploading the build. Store
answers that do not match the binary are a common rejection reason (App Store guideline 5.1.2,
Play User Data policy).

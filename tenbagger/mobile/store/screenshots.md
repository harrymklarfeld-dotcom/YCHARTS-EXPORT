# Screenshot plan

## Required sizes (checked 2026-09)

| Store | Set | Pixels (portrait) | Required? |
|---|---|---|---|
| App Store | **iPhone 6.9"** | 1320×2868 (also accepts 1290×2796, 1260×2736) | **Yes.** Apple scales it down for smaller iPhones |
| App Store | iPhone 6.5" | 1284×2778 or 1242×2688 | Only if you skip the 6.9" set. We ship both, so older-device listings get native-sized art |
| App Store | iPad 13" | 2064×2752 or 2048×2732 | **Not needed**: `supportsTablet: false` in `app.config.ts` |
| Google Play | Phone | 1080×1920 (9:16). Each side 320–3840 px, **longest side ≤ 2× shortest** | Yes, at least 2; 4+ at 1080p recommended for featuring |
| Google Play | Feature graphic | 1024×500 | Yes: `brand/play-feature-graphic.png` |
| Google Play | 7"/10" tablet | | Optional; skip in v1 |

Apple takes 1–10 screenshots per set and Play takes 2–8. The first 3 matter most: they show in
search results. Sources: [App Store sizes](https://www.mobileaction.co/guide/app-screenshot-sizes-and-guidelines-for-the-app-store/),
[6.9"/6.5" fallback rules](https://screenhance.com/blog/app-store-screenshot-dimensions-2026),
[Play 2:1 rule](https://screenkit.tools/specs/google-play-screenshot-sizes).

**The raw captures cannot be uploaded as-is.** `tenbagger/docs/screenshots/*.png` are 780×1688
(390×844 @2x). That size is not an accepted App Store size, and at 2.16:1 it breaks Play's 2:1
limit. `store/screenshots/compose.mjs` places each capture on a branded 1320×2868, 1284×2778 or
1080×1920 canvas with a caption, which fixes both problems.

## The set (same order on both stores)

| # | Raw capture (`docs/screenshots/`) | Caption (2 lines) | Sub-caption | Job |
|---|---|---|---|---|
| 1 | `real-03-question.png` | Learn from real / company numbers | Every question comes from an actual SEC filing | Core promise and differentiation |
| 2 | `04-feedback-correct.png` | Every answer / shows its source | See exactly which 10-K a number came from | Trust: the source chip |
| 3 | `real-01-learn.png` | 3 minutes a day / builds the habit | A clear path from margins to valuation | Habit and gamified path |
| 4 | `real-04-screener.png` | Screen companies / in plain English | Tap any metric for a simple explainer | Second pillar: screener |
| 5 | `real-05-company-mu.png` | Every key number / explained simply | Tap any metric to see what it means | Depth on real companies |
| 6 | `13-lesson-complete.png` | Streaks come from / learning, not trading | Education only. Never stock tips. | Reassures the reviewer and the cautious user |
| alt | `10-learn-dark.png` | Easy on the eyes / day or night | Light and dark themes | Optional 7th |
| alt | `08b-company-history.png` | Ten years of history / at a glance | Simple charts for every metric | Swap for #5 if the history chart reads better |

Rules we follow:
- Captions make **no performance claims**: no "beat the market", "10x", "#1" or "best".
- Show **real UI only**. The Money tab uses a fictional persona, so leave it out of v1
  screenshots; it would need a "Sample data" label visible in the image.
- Screenshots **#5** show "High vs. typical" colour cues on valuation metrics. That is fine as
  education, but make sure the in-app explainer says what "typical" means. Red means "unusual",
  not "sell".
- No iPad frames and no Android device frames on the iOS set. Apple rejects screenshots that show
  a different platform's hardware.

## How to produce the final images

1. Build a **production-like** binary (`eas build --profile preview`) with real data sources
   (not the `*.sample.json` files) and a clean profile.
2. Capture the raw screens:
   - iOS: iPhone 17 Pro Max simulator → `xcrun simctl io booted screenshot raw.png` (1320×2868). Set
     a clean status bar first: `xcrun simctl status_bar booted override --time 9:41 --batteryLevel 100 --cellularBars 4`.
   - Android: Pixel emulator (1080×2400) → `adb exec-out screencap -p > raw.png`.
3. Save them over the matching files in `docs/screenshots/`, or point `compose.mjs` at the new
   folder. Then run:
   ```bash
   mkdir -p /tmp/icongen && (cd /tmp/icongen && npm i @resvg/resvg-js pngjs)
   ICONGEN_MODULES=/tmp/icongen node store/screenshots/compose.mjs
   ```
   This writes `store/screenshots/out/{ios-6.9,ios-6.5,android-phone}/01-…06-….png`. The script
   works with the current 780×1688 captures too; that is how the drafts were checked.
4. Upload `ios-6.9` (and `ios-6.5`) in App Store Connect → version → Previews and Screenshots, and
   `android-phone` in Play Console → Main store listing → Phone screenshots.
5. Also take one **paywall screenshot** per subscription for App Store Connect's in-app purchase
   review field. It is not public.

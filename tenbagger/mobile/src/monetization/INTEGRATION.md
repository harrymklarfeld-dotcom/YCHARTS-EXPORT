# Monetization: integration guide for the lead

Everything is imported from `src/monetization` (the barrel `index.ts`). All knobs (prices, limits,
flags, ad caps, offers) live in **`src/config/monetization.ts`**. Already wired:
`<MonetizationProvider>` in `src/app/_layout.tsx`, the `/paywall` (modal) and `/settings/subscription`
routes, and the Profile rows "Upgrade to Pro / Tenbagger Pro" and "Restore purchases".

```ts
import { useEntitlement, useFeature, useLessonGate, useLessonInProgress, usePaywall,
         ProGate, AdSlot, RewardedHeartButton, OfferCard, useMonetization, screenerAdRowIndexes } from '../monetization';
```

| API | What it does |
|---|---|
| `useEntitlement()` | `{ tier, isPro, isTrial, planId, snapshot, ready }` |
| `useFeature(f)` | `{ allowed, reason, limit, used, remaining, openPaywall() }` for any `Feature` in config |
| `useLessonGate(lessonId, unitId)` | Same shape, for lesson **start** (replays and `alwaysFreeUnitIds` pass) |
| `usePaywall()(source)` | Opens `/paywall`; returns `false` and does nothing while a lesson is in progress |
| `useLessonInProgress(active)` | Marks lesson/practice as on screen: blocks paywalls and banner ads |
| `<ProGate feature="…">` | Children if allowed, else a lock card that opens the paywall |
| `<AdSlot placement context slotIndex?>` | Renders nothing unless all ad rules pass (free user, allowed screen, caps, consent) |
| `<RewardedHeartButton onEarned>` | Optional "+1 heart" rewarded ad; tap-to-play; hidden when ineligible |
| `<OfferCard placement articleTags>` | Affiliate card ("Sponsored" + disclosure). Off until `FLAGS.affiliateEnabled` |
| `useMonetization.getState().setUsage({ savedScreens, linkedAccounts })` | Keep metered counts accurate |

The daily new-lesson counter needs no wiring: the provider watches `useApp().completed` and
records the day each lesson is **first** completed.

## Where to drop them

### 1. Learn tab: lesson/day limit (`src/app/(tabs)/index.tsx`)
Gate at the path node, **before** the lesson opens (never mid-question):
```tsx
// inside the unit loop, per lesson l of unit u
const gate = useLessonGate(l.id, u.id);        // hoist into a small <GatedLessonNode> component
onPress={() => (gate.allowed ? router.push(`/lesson/${l.id}`) : gate.openPaywall())}
```
Do the same for the "Continue" button (line ~83). Optional: show `gate.remaining` ("1 free lesson left today").
Also guard deep links in `src/app/lesson/[id].tsx`: if `!gate.allowed`, render `<ProGate feature="lessons">{null}</ProGate>` instead of the player.

### 2. Lesson player (`src/components/lesson/LessonPlayer.tsx`)
- `useLessonInProgress(phase === 'question');` near the top. This blocks paywalls and banner ads mid-question.
- In the `phase === 'no_hearts'` block (line ~126), under the "Back to path" button:
  `<RewardedHeartButton onEarned={() => setPhase('question')} />`
  (Needs `FLAGS.rewardedHeartEnabled`. It is user-initiated only and grants exactly 1 heart.)
- No `AdSlot` or interstitial anywhere in the player, ever.

### 3. Practice mode (`src/app/practice/[ticker].tsx`; button in `src/app/company/[ticker].tsx` line ~137)
Wrap the practice screen body: `<ProGate feature="practice_mode">…</ProGate>`, or gate the button:
`const g = useFeature('practice_mode'); onPress={() => g.allowed ? router.push(...) : g.openPaywall()}`.
Also call `useLessonInProgress()` inside the practice player.

### 4. Screener (`src/app/(tabs)/screener.tsx`)
- **Presets**: `isPresetFree(p.id, index, tier)`: free users get the first `FREE_SCREENER_PRESET_COUNT` presets (or the ids in
  `FREE_SCREENER_PRESET_IDS`). For the others, show a lock chip and call `useFeature('screener_presets_all').openPaywall()`.
- **Saved screens** (when "save screen" ships): before saving, `useFeature('saved_screens')`; after any
  change, `setUsage({ savedScreens: n })`.
- **Ads between results** (line ~193):
  ```tsx
  const adRows = screenerAdRowIndexes(results.length);
  {results.map((c, i) => (
    <Fragment key={c.ticker}>
      <CompanyRow company={c} metrics={shownMetrics} />
      {adRows.includes(i) ? <AdSlot placement="screener_results" context="screener" slotIndex={adRows.indexOf(i)} /> : null}
    </Fragment>
  ))}
  ```

### 5. Funds: X-ray and Compare (`src/app/xray.tsx`, `src/app/compare.tsx`, fund page `src/app/fund/[ticker].tsx`)
- Wrap the X-ray result body in `<ProGate feature="xray">`. Keep the portfolio input visible so users see what they would get.
- Wrap the compare chart in `<ProGate feature="compare">`. A good free teaser is the first metric row only.
- No ads on X-ray: it shows the user's own holdings (`personal_finance`).

### 6. Money hub (`src/money/MoneyScreen.tsx`, `src/app/(tabs)/money.tsx`)
- **No `AdSlot` and no `OfferCard` anywhere in the Money hub.** The rules refuse `money_hub`,
  `bank_linking` and `personal_finance` contexts anyway.
- "Link account" button: `const g = useFeature('money_accounts'); g.allowed ? startLink() : g.openPaywall()`.
  Free = 1 linked institution. Call `setUsage({ linkedAccounts: n })` whenever links change.
- Alerts toggle: `<ProGate feature="money_alerts" compact>`.
- Personal 10-K report: `<ProGate feature="personal_10k">`.
- Never show credit, loan or cash-advance offers (the affiliate validator rejects them).

### 7. Articles (`src/articles/ArticleReaderScreen.tsx`)
- End of article, just above `<Disclaimer compact />` (line ~142):
  ```tsx
  <OfferCard placement="article_end" articleTags={article.tags} articleId={article.slug} />
  <AdSlot placement="article_end" context="article" />
  ```
- Pro articles: add `pro?: boolean` to the article type/data, show the intro, then
  `<ProGate feature="articles_pro">{rest of body}</ProGate>`. Mark the list card with a small "PRO" tag.
- Articles that teach about the user's own money ("your money like a 10-K") should use `context="personal_finance"`,
  or leave out the AdSlot entirely.

### 8. Daily puzzle
Always free (`FREE_LIMITS.daily_puzzle = true`). No gate needed.

## Native build checklist (purchases and ads do NOT run in Expo Go)
Expo Go, web and jest use the mocks automatically (the paywall shows "Test mode").
For the real SDKs you need an **EAS development build** (`npx eas-cli@latest build --profile development`):

1. **app.json plugins.** These must be added before any native build, because the Google Mobile Ads SDK
   crashes at launch without an app id. The ids below are Google's test app ids:
   ```json
   "plugins": [
     "expo-router",
     ["react-native-google-mobile-ads", {
       "androidAppId": "ca-app-pub-3940256099942544~3347511713",
       "iosAppId": "ca-app-pub-3940256099942544~1458002511",
       "delayAppMeasurementInit": true
     }]
   ]
   ```
   Only if you flip `FLAGS.personalizedAds` and `FLAGS.requestTrackingAuthorization`, also add
   `["expo-tracking-transparency", { "userTrackingPermission": "…" }]`.
2. **Env vars** (`.env` or EAS secrets): `EXPO_PUBLIC_RC_IOS_KEY`, `EXPO_PUBLIC_RC_ANDROID_KEY`, and optionally
   `EXPO_PUBLIC_ADMOB_{IOS,ANDROID}_{BANNER,NATIVE,REWARDED}` (the defaults are Google test units).
3. **RevenueCat dashboard**: entitlement `pro`; a current offering with packages `$rc_annual` (7-day free
   trial intro offer), `$rc_monthly` and `student_annual`, mapped to store products
   `tenbagger_pro_annual`, `tenbagger_pro_monthly` and `tenbagger_student_annual`.
4. **Student verification** (.edu) is not built. The plan is SheerID or a similar service, with the student
   product sold only through a separate offering after verification. Until then, consider
   `FLAGS.studentPlanEnabled = false` in production.
5. **AdMob console → Blocking controls**: block personal loans, payday/cash advance, crypto, gambling and
   "get rich quick" categories.
6. **Analytics**: `addAnalyticsSink((event, props) => posthog.capture(event, props))`. Events:
   `paywall_view`, `paywall_dismiss`, `plan_selected`, `trial_start`, `purchase`, `purchase_cancelled`,
   `purchase_failed`, `restore`, `gate_hit`, `ad_impression`, `rewarded_earned`, `offer_impression`,
   `offer_click` and `paywall_blocked_in_lesson`.

# Tenbagger — mobile app

Short, game-like lessons built on real company financials, a beginner-friendly stock screener,
and later your own linked brokerage. Built with Expo SDK 57, React Native 0.86, TypeScript (strict)
and expo-router. Everything runs on the device: there's no backend and nothing is fetched over the network.

> Educational only. Not investment advice. XP, streaks and goals come **only** from learning,
> never from trading (see `src/state/store.ts` and `src/game/xp.ts`).

## Run it on your phone (Expo Go)

```bash
cd tenbagger/mobile
npm install
npx expo start            # scan the QR code with Expo Go (Android) or the Camera app (iOS)
# phone and computer on different networks?
npx expo start --tunnel
```

Other targets: `npm run web` (browser), `npm run ios` / `npm run android` (simulators).
Every native module used (`react-native-svg`, `@react-native-async-storage/async-storage`,
`react-native-screens`, `react-native-safe-area-context`) is bundled in Expo Go. You don't need a dev build.

## Scripts

| Command | What it does |
|---|---|
| `npx tsc --noEmit` (`npm run typecheck`) | Strict type check |
| `npx jest` (`npm test`) | Unit tests for game logic, the screener adapter, practice sets and the data layer |
| `npx expo export --platform web` (`npm run export:web`) | Production web bundle in `dist/` |
| `npm run gen:sample` | Rebuilds the sample JSON in `assets/data/` |

## Screens

| Route | Screen |
|---|---|
| `(tabs)/index` | **Learn**: units and lessons laid out as a path (locked, unlocked or complete), XP, streak flame, hearts, and a daily goal ring with a Continue button |
| `lesson/[id]` | **Lesson player**: intro card, then questions one at a time. Supports `multiple_choice`, `numeric` (keypad with tolerance, K/M/B scale for USD), `true_false`, `compare` and `order` (tap to rank). Gives instant feedback with the explanation and a `Source: COST FY2025 10-K · gross_profit / revenue` chip. You get 5 hearts and a progress bar. A wrong answer costs a heart and the question comes back at the end. Ends on a completion screen with XP |
| `(tabs)/screener` | **Screener**: preset screens, or build your own with a metric picker, an operator and a value in friendly units (%, $B, ×). Results can be sorted, and tapping a metric opens a plain-English explainer sheet |
| `(tabs)/companies` | Company list with search |
| `company/[ticker]` | **Company**: header, key metrics grouped with friendly labels and soft color cues, 5–10 years of history as mini bar charts (react-native-svg), and a **Practice with this company** button |
| `practice/[ticker]` | Practice set built from lesson questions sourced from that ticker, topped up with questions generated deterministically from its data |
| `(tabs)/profile` | **Profile**: streak, XP and level, leagues placeholder, daily goal, theme setting (system/light/dark), reset progress, **Link brokerage (coming soon)**, and a disclaimer that is always visible |

## File tree

```
mobile/
  app.json, metro.config.js, jest.config.js, tsconfig.json
  assets/data/companies.sample.json   8 companies (contract shape, sample numbers)
  assets/data/lessons.sample.json     2 units × 2 lessons × 5 question types
  scripts/gen-sample-data.mjs         generates both sample files (formulas from CONTRACT.md)
  src/
    app/                              expo-router routes (see table above)
    components/                       ui kit, Icon (svg), GoalRing, MiniBarChart, Sheet, lesson/*
    data/                             data layer: sources.ts (the swap point), normalize.ts, index.ts
    game/                             PURE gamification logic + __tests__
      day.ts        timezone-safe local day keys (Intl / device tz; DST-proof day diffs)
      streak.ts     recordActivity / displayedStreak
      hearts.ts     5 hearts, +1 per 30 min, pure regen
      xp.ts         lesson/practice XP, perfect bonus, replay factor, levels
      dailyGoal.ts  per-day XP log and goal progress
      answers.ts    answer checking for all 5 types, keypad → contract units
      progress.ts   path lock/unlock
    lib/            format.ts, metricCatalog.ts (labels + explainers), screener.ts (adapter), practice.ts
    state/store.ts  zustand + AsyncStorage persistence
    theme/          "Ledger" palette (light/dark), serif display + system sans
    types/contract.ts  TS mirror of tenbagger/CONTRACT.md
```

## Swapping in real data (one line each)

**Companies and lessons.** Edit `src/data/sources.ts`:

```ts
import companiesJson from '../../../data/companies.json';   // was ../../assets/data/companies.sample.json
import lessonsJson from '../../../data/lessons.json';       // was ../../assets/data/lessons.sample.json
```

`metro.config.js` already adds `tenbagger/data` and `tenbagger/packages` to `watchFolders`, so Metro
can bundle them. Everything flows through `normalizeCompanies` / `normalizeLessons`, which drop malformed
entries instead of crashing. `dataInfo.isSample` switches off automatically when `source !== "fixture"`.
Run `npx jest` after swapping: `src/data/__tests__/data.test.ts` checks the files against the contract,
including a spot check of the metric formulas.

**Screener engine.** Screens import only from `src/lib/screener.ts`. When `packages/screener` lands, re-export
its `runScreen` / `PRESET_SCREENS` from there, as described in the header comment. The UI's friendly labels and
explainers stay in `src/lib/metricCatalog.ts`.

## Contract notes and assumptions

- `order` questions: `choices` holds the items to rank and `answer` is the list of choice indices in the correct order.
  The contract lists `choices` only for mc/compare, but order questions need it too.
- `compare` choices are tickers. When a ticker is in companies.json, the card also shows the company name.
- Numeric `tolerance` is absolute, in the answer's units (decimal ratios for percent). If it's missing, the default is 1% relative.
- Hearts can't be bought. Leagues and brokerage linking are placeholders.

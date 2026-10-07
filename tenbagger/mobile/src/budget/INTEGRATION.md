# Budget: integration guide for the lead

Everything is imported from `src/budget` (barrel `index.ts`). Engine: `tenbagger/packages/budget`
(pure TS, tests: `cd tenbagger/packages/budget && npm run check`). Nothing outside `src/budget/`,
`src/app/onboarding/`, `src/app/budget/` and `assets/data/budget.sample.json` was edited.

```ts
import { BudgetFirstLaunch, BudgetSummaryCard, SafeToSpendCard, BudgetInsights, BudgetScreen,
         useBudgetStore, useBudgetView, useNeedsBudgetOnboarding } from '../budget';
```

| Export | What it is |
|---|---|
| `<SafeToSpendCard compact? />` | Connected hero: "Safe to spend until payday" + "Show the math". With no plan yet it shows a "Find my number" setup card |
| `<BudgetSummaryCard />` | Compact card for the Money dashboard: hero number, next paycheck's plan sentence, top free insight, "Open my budget ›" |
| `<BudgetInsights limit? />` | Ranked insights (free shown, Pro shown as locked titles that open the paywall) |
| `<BudgetScreen embedded? section? />` | The full Budget screen (already routed at `/budget`) |
| `<BudgetFirstLaunch />` | Renders nothing; opens Quick setup once on first launch |
| `useBudgetStore.getState().setLinked(data)` | Feed linked data (money-summary shape) into the plan |

## Routes (already created, auto-registered by expo-router)
- `/onboarding` Quick setup: 4 inputs (cash, next payday + amount, card balance + due date, one big bill) → the hero number with its equation. `?step=0..4`.
- `/onboarding/plan` optional "Build my full plan" / "Edit my setup": goals → income → bills → spending → balances → comfort → style. `?step=goals|income|…|style`. Every step is skippable.
- `/budget` Budget screen (`?sample=1` shows the fictional Alex plan). `/budget/insights` insights only. `/budget/edit` → `/onboarding/plan`.

Optional, in `src/app/_layout.tsx` `<Stack>`, for a modal feel:
```tsx
<Stack.Screen name="onboarding/index" options={{ headerShown: false, presentation: 'fullScreenModal', animation: 'slide_from_bottom' }} />
<Stack.Screen name="onboarding/plan" options={{ headerShown: false }} />
<Stack.Screen name="budget/index" options={{ title: 'Budget', headerBackTitle: 'Back' }} />
```

## 1. First launch → Quick setup
In `src/app/_layout.tsx`, next to `<HeartsTicker />` (inside `<MonetizationProvider>`/`<ThemeProvider>`):
```tsx
import { BudgetFirstLaunch } from '../budget';
…
<HeartsTicker />
<BudgetFirstLaunch />
```
It waits for AsyncStorage to hydrate, then `router.push('/onboarding')` once. "Not now" (or finishing) sets
`onboardingSeen`, so it never shows again. If you'd rather not interrupt the Learn tab on day one, mount it
in `src/app/(tabs)/money.tsx` instead (first visit to Money) — same component.

Learn tab alternative (no auto-open): add a card in `src/app/(tabs)/index.tsx` under the header:
```tsx
const needsBudget = useNeedsBudgetOnboarding();
{needsBudget ? <SafeToSpendCard compact /> : null}   // shows "Find my number in 30 seconds"
```

## 2. Money dashboard
- **Overview tab** (`src/money/dashboard/OverviewTab.tsx`): put `<BudgetSummaryCard />` as the FIRST card
  (answer first), above the coverage / "Can I cover the card?" panel.
- **Insights**: in the same tab, below the scorecard (or in a new "Budget" dashboard tab), add
  ```tsx
  <SectionTitle eyebrow="Ranked · math shown · you decide" title="Budget insights" />
  <BudgetInsights limit={3} />
  <Pressable onPress={() => router.push('/budget/insights')}>…See all</Pressable>
  ```
- Optional full tab: add `'budget'` to the dashboard tabs and render `<BudgetScreen embedded />`.
- No `AdSlot` / `OfferCard` anywhere near these (they show personal finances; `personal_finance` context).

## 3. Linked data (improves the plan, never required)
When `money-summary` (or the Money hub's data) loads, pass it through:
```ts
useBudgetStore.getState().setLinked({
  snapshots: summary.snapshots,            // → verified cash/savings/card (statement, due date, APR)
  incomeStreams: summary.incomeStreams,    // → income sources (manual streams incl. pending hours)
  deposits: summary.deposits,              // → 25th-percentile income baseline
  transactions,                            // → envelopes, variance, subscription insight (ONLY when present)
  workLog: useMoneyStore.getState().workLog, // → "Submit your 6 hours to unlock $93" insight
});
```
Linked data is kept in memory only (not persisted). Without it, everything works from manual answers, and the
subscription insight never appears (it is never guessed from manual bills).

## 4. Settings / Profile
Add two rows (Profile tab or a settings screen):
- "Budget setup" → `router.push('/budget/edit')` (edit any step later)
- "Reset budget" → `useBudgetStore.getState().resetBudget()` (confirm first)

## 5. Monetization
- Free: quick setup, safe-to-spend, paycheck plans, envelopes, goals, free insights (pending pay, short-before-payday, card covered, buffer, liquidity ratio ↔ current ratio, envelope watch, fresh start).
- Pro: `card_payoff_faster`, `subscriptions`, `free_cash_flow`, `income_baseline`. Gated in `InsightList` with
  `useFeature(BUDGET_PRO_FEATURE)`; today `BUDGET_PRO_FEATURE = 'personal_10k'` (src/budget/gating.ts) because
  `Feature` has no budget entry. To split it: add `'budget_insights'` to `Feature` and `FREE_LIMITS` (false) in
  `src/config/monetization.ts`, a COPY entry in ProGate, then change that one line.

## 6. Notifications (not wired)
`profile.comfort.notify` stores 'paycheck' | 'daily' | 'weekly' | 'off'. When push lands, send the hero sentence
(`useBudgetView().budget.safe.headline`) on that cadence. No urgency copy, no money-action rewards.

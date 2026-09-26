import { useMemo } from 'react';
import { today } from '../state/store';
import { buildView, shouldShowOnboarding, type BudgetView } from './model';
import { useBudgetStore } from './store';

/** Everything the budget UI shows, recomputed only when inputs change. */
export function useBudgetView(): BudgetView {
  const profile = useBudgetStore((s) => s.profile);
  const sampleMode = useBudgetStore((s) => s.sampleMode);
  const linked = useBudgetStore((s) => s.linked);
  const paid = useBudgetStore((s) => s.paid);
  const carried = useBudgetStore((s) => s.carried);
  const day = today();
  return useMemo(() => buildView({ profile, sampleMode, today: day, linked, paid, carried }), [profile, sampleMode, day, linked, paid, carried]);
}

/** True on first launch (no plan yet, onboarding not skipped). Waits for storage to load. */
export function useNeedsBudgetOnboarding(): boolean {
  const hydrated = useBudgetStore((s) => s.hydrated);
  const profile = useBudgetStore((s) => s.profile);
  const onboardingSeen = useBudgetStore((s) => s.onboardingSeen);
  const sampleMode = useBudgetStore((s) => s.sampleMode);
  return hydrated && shouldShowOnboarding({ profile, onboardingSeen, sampleMode });
}

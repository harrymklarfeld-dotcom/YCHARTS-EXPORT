/** React hooks for gating, paywall and ads. Logic lives in the pure modules next door. */
import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { PLANS, type Feature, type PlanId } from '../config/monetization';
import { today, useApp } from '../state/store';
import { track } from './analytics';
import {
  canPresentPaywall,
  checkFeature,
  checkLessonStart,
  effectiveTier,
  newLessonsOn,
  type GateResult,
  type Tier,
  type Usage,
} from './entitlements';
import { fallbackPrice } from './pricing';
import { getPurchases } from './runtime';
import { useMonetization } from './store';
import type { PurchaseResult, StorePackage } from './purchases/PurchasesAdapter';

export function useEntitlement() {
  const snap = useMonetization((s) => s.entitlement);
  const ready = useMonetization((s) => s.ready);
  const tier: Tier = effectiveTier(snap);
  return { tier, isPro: tier === 'pro', isTrial: tier === 'pro' && snap.isTrial, planId: snap.planId, snapshot: snap, ready };
}

export function useUsage(): Usage {
  const lessonFirstDay = useMonetization((s) => s.lessonFirstDay);
  const firstSeenDay = useMonetization((s) => s.firstSeenDay);
  const savedScreens = useMonetization((s) => s.savedScreens);
  const linkedAccounts = useMonetization((s) => s.linkedAccounts);
  const day = today();
  return useMemo(
    () => ({ newLessonsToday: newLessonsOn(lessonFirstDay, day), firstSeenDay: firstSeenDay ?? day, today: day, savedScreens, linkedAccounts }),
    [lessonFirstDay, firstSeenDay, day, savedScreens, linkedAccounts],
  );
}

export type PaywallSource = Feature | 'profile' | 'settings' | 'lesson_limit' | 'onboarding' | 'other';

/** Open the paywall. Refuses (returns false) while a lesson is in progress. */
export function usePaywall() {
  const { tier } = useEntitlement();
  return useCallback(
    (source: PaywallSource) => {
      const lessonInProgress = useMonetization.getState().lessonInProgress;
      if (!canPresentPaywall({ lessonInProgress, tier })) {
        if (lessonInProgress) track('paywall_blocked_in_lesson', { source });
        return false;
      }
      router.push({ pathname: '/paywall', params: { source } });
      return true;
    },
    [tier],
  );
}

/** Gate a feature: `{ allowed, reason, remaining, openPaywall }`. */
export function useFeature(feature: Feature): GateResult & { openPaywall: () => boolean } {
  const { tier } = useEntitlement();
  const usage = useUsage();
  const open = usePaywall();
  const res = checkFeature(feature, tier, usage);
  const openPaywall = useCallback(() => {
    track('gate_hit', { feature });
    return open(feature);
  }, [open, feature]);
  return { ...res, openPaywall };
}

/** Lesson start gate (call on the path / lesson intro, NEVER mid-question). */
export function useLessonGate(lessonId: string, unitId?: string | null): GateResult & { openPaywall: () => boolean } {
  const { tier } = useEntitlement();
  const usage = useUsage();
  const completed = useApp((s) => s.completed);
  const open = usePaywall();
  const res = checkLessonStart({ id: lessonId, unitId }, { tier, usage, completedLessonIds: Object.keys(completed) });
  const openPaywall = useCallback(() => {
    track('gate_hit', { feature: 'lessons' });
    return open('lesson_limit');
  }, [open]);
  return { ...res, openPaywall };
}

/** Mark a lesson/practice session as on screen: blocks paywalls and ads while mounted. */
export function useLessonInProgress(active = true) {
  useEffect(() => {
    if (!active) return;
    useMonetization.getState().setLessonInProgress(true);
    return () => useMonetization.getState().setLessonInProgress(false);
  }, [active]);
}

/** Packages for the paywall (store prices when available, config fallbacks otherwise). */
export function usePlans(): StorePackage[] {
  const packages = useMonetization((s) => s.packages);
  return useMemo(() => {
    const byId = new Map(packages.map((p) => [p.planId, p]));
    return (Object.keys(PLANS) as PlanId[]).map((id) => byId.get(id) ?? { planId: id, price: fallbackPrice(id) });
  }, [packages]);
}

export function usePurchaseActions() {
  const [busy, setBusy] = useState<null | 'purchase' | 'restore'>(null);
  const purchase = useCallback(async (planId: PlanId, source?: string): Promise<PurchaseResult> => {
    setBusy('purchase');
    try {
      const r = await getPurchases().purchase(planId);
      useMonetization.getState().setEntitlement(r.entitlement);
      const plan = PLANS[planId];
      if (r.status === 'purchased') {
        track(r.entitlement.isTrial ? 'trial_start' : 'purchase', { plan: planId, period: plan.period, source, store: getPurchases().kind });
      } else if (r.status === 'cancelled') track('purchase_cancelled', { plan: planId, source });
      else if (r.status === 'failed') track('purchase_failed', { plan: planId, source, error: r.error });
      return r;
    } finally {
      setBusy(null);
    }
  }, []);
  const restore = useCallback(async () => {
    setBusy('restore');
    try {
      const snap = await getPurchases().restore();
      useMonetization.getState().setEntitlement(snap);
      track('restore', { restored: snap.tier === 'pro' });
      return snap;
    } finally {
      setBusy(null);
    }
  }, []);
  return { purchase, restore, busy };
}

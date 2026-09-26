/**
 * Mount once near the root (src/app/_layout.tsx). Creates the purchases + ads adapters,
 * loads the entitlement, listens for renewals/refunds, runs the ads consent flow, and keeps the
 * daily-lesson counter in sync with the learning store. Renders children immediately: nothing
 * here blocks the app, and failures fall back to the cached entitlement.
 */
import { useEffect, type ReactNode } from 'react';
import { toDayKey } from '../game/day';
import { useApp } from '../state/store';
import { createAdsAdapter } from './ads/createAdsAdapter';
import { createPurchasesAdapter } from './purchases/createPurchasesAdapter';
import { setAdapters } from './runtime';
import { useMonetization } from './store';

const toDay = (ms: number) => toDayKey(new Date(ms));

function whenHydrated(fn: () => void) {
  if (useMonetization.getState().hydrated) {
    fn();
    return () => {};
  }
  return useMonetization.subscribe((s, prev) => {
    if (s.hydrated && !prev.hydrated) fn();
  });
}

export function MonetizationProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
    let cancelled = false;
    let offChange: (() => void) | undefined;
    const offHydrate = whenHydrated(async () => {
      const m = useMonetization.getState();
      m.ensureFirstSeen(toDay(Date.now()));
      const purchases = createPurchasesAdapter({
        initial: m.mockPurchase,
        save: (rec) => useMonetization.getState().setMockPurchase(rec),
      });
      const ads = createAdsAdapter();
      setAdapters({ purchases, ads });
      m.setRuntime({ purchasesKind: purchases.kind, adsKind: ads.kind });
      try {
        await purchases.init();
        offChange = purchases.onChange((snap) => useMonetization.getState().setEntitlement(snap));
        const snap = await purchases.getEntitlement();
        if (!cancelled) useMonetization.getState().setEntitlement(snap);
        const packages = await purchases.getPackages();
        if (!cancelled) useMonetization.getState().setRuntime({ packages });
      } catch {
        // offline or store unavailable: keep the cached snapshot (effectiveTier() expires it)
      }
      if (!cancelled) useMonetization.getState().setRuntime({ ready: true });
      try {
        const consent = await ads.init();
        if (!cancelled) useMonetization.getState().setRuntime({ consent });
      } catch {
        // no ads is always an acceptable outcome
      }
    });
    return () => {
      cancelled = true;
      offHydrate();
      offChange?.();
    };
  }, []);

  // Daily new-lesson counter: record the day each lesson is first completed.
  const completed = useApp((s) => s.completed);
  const hydrated = useMonetization((s) => s.hydrated);
  useEffect(() => {
    if (hydrated) useMonetization.getState().syncCompletedLessons(completed, toDay);
  }, [completed, hydrated]);

  return <>{children}</>;
}

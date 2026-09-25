/**
 * Monetization state (separate from the learning store so the two never tangle):
 * cached entitlement, simulated purchase (mock mode), usage counters for free-tier limits,
 * and the ad-impression log for frequency caps. Persisted with AsyncStorage.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { AdPlacement } from '../config/monetization';
import { trimLog, type AdImpressionLog } from './adRules';
import { DEFAULT_CONSENT, type ConsentState } from './ads/AdsAdapter';
import { FREE_SNAPSHOT, type EntitlementSnapshot } from './entitlements';
import type { MockPurchaseRecord } from './purchases/MockPurchasesAdapter';
import type { StorePackage } from './purchases/PurchasesAdapter';

type Persisted = {
  entitlement: EntitlementSnapshot;
  mockPurchase: MockPurchaseRecord;
  firstSeenDay: string | null;
  /** lessonId → local day it was FIRST completed (drives the daily new-lesson limit). */
  lessonFirstDay: Record<string, string>;
  savedScreens: number;
  linkedAccounts: number;
  adLog: AdImpressionLog;
};

type Runtime = {
  hydrated: boolean;
  ready: boolean;
  purchasesKind: 'mock' | 'revenuecat';
  adsKind: 'mock' | 'admob';
  packages: StorePackage[];
  consent: ConsentState;
  lessonInProgress: boolean;
};

type Actions = {
  setEntitlement: (s: EntitlementSnapshot) => void;
  setMockPurchase: (r: MockPurchaseRecord) => void;
  syncCompletedLessons: (completed: Record<string, { completedAt: number }>, toDay: (ms: number) => string) => void;
  ensureFirstSeen: (day: string) => void;
  /** Screener / Money hub report their counts here so limits stay accurate. */
  setUsage: (u: Partial<Pick<Persisted, 'savedScreens' | 'linkedAccounts'>>) => void;
  recordAdImpression: (p: AdPlacement, now?: number) => void;
  setLessonInProgress: (v: boolean) => void;
  setRuntime: (r: Partial<Runtime>) => void;
};

export type MonetizationState = Persisted & Runtime & Actions;

const initial: Persisted = {
  entitlement: FREE_SNAPSHOT,
  mockPurchase: null,
  firstSeenDay: null,
  lessonFirstDay: {},
  savedScreens: 0,
  linkedAccounts: 0,
  adLog: {},
};

export const useMonetization = create<MonetizationState>()(
  persist(
    (set, get) => ({
      ...initial,
      hydrated: false,
      ready: false,
      purchasesKind: 'mock',
      adsKind: 'mock',
      packages: [],
      consent: DEFAULT_CONSENT,
      lessonInProgress: false,
      setEntitlement: (entitlement) => set({ entitlement }),
      setMockPurchase: (mockPurchase) => set({ mockPurchase }),
      syncCompletedLessons: (completed, toDay) => {
        const cur = get().lessonFirstDay;
        let next: Record<string, string> | null = null;
        for (const [id, c] of Object.entries(completed)) {
          if (cur[id]) continue;
          next = next ?? { ...cur };
          next[id] = toDay(c.completedAt);
        }
        if (next) set({ lessonFirstDay: next });
      },
      ensureFirstSeen: (day) => {
        if (!get().firstSeenDay) set({ firstSeenDay: day });
      },
      setUsage: (u) => set(u),
      recordAdImpression: (p, now = Date.now()) =>
        set((s) => ({ adLog: trimLog({ ...s.adLog, [p]: [...(s.adLog[p] ?? []), now] }, now) })),
      setLessonInProgress: (lessonInProgress) => set({ lessonInProgress }),
      setRuntime: (r) => set(r),
    }),
    {
      name: 'tenbagger-monetization-v1',
      version: 1,
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (s): Persisted => ({
        entitlement: s.entitlement,
        mockPurchase: s.mockPurchase,
        firstSeenDay: s.firstSeenDay,
        lessonFirstDay: s.lessonFirstDay,
        savedScreens: s.savedScreens,
        linkedAccounts: s.linkedAccounts,
        adLog: s.adLog,
      }),
      onRehydrateStorage: () => () => {
        useMonetization.setState({ hydrated: true });
      },
    },
  ),
);

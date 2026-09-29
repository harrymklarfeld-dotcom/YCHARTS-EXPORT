/**
 * Budget local state (device only, AsyncStorage). Separate from the Money store on purpose.
 * Linked data is kept in memory only (set by the Money hub when money-summary loads).
 *
 * REGULATORY NOTE: nothing here awards XP, streaks or rewards for money actions.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { emptyProfile, quickSetup, type BudgetProfile, type QuickSetupInput, type SetupStep } from './engine';
import type { LinkedBudgetData } from './model';

type Persisted = {
  profile: BudgetProfile | null;
  /** Viewing the fictional Alex sample instead of your own plan. */
  sampleMode: boolean;
  /** The user finished or skipped onboarding (don't auto-show it again). */
  onboardingSeen: boolean;
  /** Bill occurrences marked paid (`billId@YYYY-MM-DD`). */
  paid: string[];
  /** Envelope carry-ins for `carriedMonth`. */
  carried: Record<string, number>;
  carriedMonth: string | null;
};

type Actions = {
  saveQuick: (input: QuickSetupInput) => void;
  setProfile: (p: BudgetProfile) => void;
  /** Merge a step's answers and mark the step answered. */
  saveStep: (step: SetupStep, patch: Partial<BudgetProfile>, asOf: string) => void;
  skipOnboarding: () => void;
  setSampleMode: (on: boolean) => void;
  togglePaid: (id: string) => void;
  setLinked: (l: LinkedBudgetData | null) => void;
  resetBudget: () => void;
};

export type BudgetStore = Persisted & Actions & { linked: LinkedBudgetData | null; hydrated: boolean };

const EMPTY: Persisted = { profile: null, sampleMode: false, onboardingSeen: false, paid: [], carried: {}, carriedMonth: null };

export const useBudgetStore = create<BudgetStore>()(
  persist(
    (set) => ({
      ...EMPTY,
      linked: null,
      hydrated: false,
      saveQuick: (input) => set((s) => ({ profile: quickSetup(input, s.profile ?? undefined), onboardingSeen: true, sampleMode: false })),
      setProfile: (p) => set({ profile: p }),
      saveStep: (step, patch, asOf) =>
        set((s) => {
          const base = s.profile ?? emptyProfile(asOf);
          const answered = base.answered.includes(step) ? base.answered : [...base.answered, step];
          return { profile: { ...base, ...patch, mode: 'full', answered, updatedAt: asOf }, sampleMode: false };
        }),
      skipOnboarding: () => set({ onboardingSeen: true }),
      setSampleMode: (on) => set({ sampleMode: on }),
      togglePaid: (id) => set((s) => ({ paid: s.paid.includes(id) ? s.paid.filter((x) => x !== id) : [...s.paid, id] })),
      setLinked: (l) => set({ linked: l }),
      resetBudget: () => set({ ...EMPTY }),
    }),
    {
      name: 'tenbagger-budget-v1',
      version: 1,
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (s): Persisted => ({
        profile: s.profile,
        sampleMode: s.sampleMode,
        onboardingSeen: s.onboardingSeen,
        paid: s.paid,
        carried: s.carried,
        carriedMonth: s.carriedMonth,
      }),
      onRehydrateStorage: () => () => useBudgetStore.setState({ hydrated: true }),
    },
  ),
);

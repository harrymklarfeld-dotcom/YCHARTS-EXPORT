/**
 * Money dashboard local state (device only, AsyncStorage): the "work not yet cashed" log,
 * edited goal targets and category overrides. Separate from the app store on purpose.
 *
 * REGULATORY NOTE: nothing here awards XP, streaks or rewards. Logging hours, spending or
 * investing never earns points (XP comes only from lessons; see src/game/xp.ts).
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { WorkEntry } from './engine';
import type { MoneyGoals } from './hub';
import { EMPTY_LOCAL, type LocalMoneyState } from './dashboard';

type Actions = {
  logWork: (streamId: string, units: number, date: string) => void;
  removeWork: (id: string) => void;
  markSubmitted: (streamId: string) => void;
  setGoals: (g: Partial<MoneyGoals>) => void;
  setCategoryOverride: (merchant: string, category: string | null) => void;
  resetMoney: () => void;
};

export type MoneyStore = LocalMoneyState & Actions;

let seq = 0;

export const useMoneyStore = create<MoneyStore>()(
  persist(
    (set) => ({
      ...EMPTY_LOCAL,
      logWork: (streamId, units, date) =>
        set((s) => ({ workLog: [...s.workLog, { id: `w${Date.now().toString(36)}${(seq++).toString(36)}`, streamId, units, date }] })),
      removeWork: (id) => set((s) => ({ workLog: s.workLog.filter((e) => e.id !== id) })),
      markSubmitted: (streamId) => set((s) => ({ workLog: s.workLog.map((e) => (e.streamId === streamId ? { ...e, submitted: true } : e)) })),
      setGoals: (g) => set((s) => ({ goals: { ...s.goals, ...g } })),
      setCategoryOverride: (merchant, category) =>
        set((s) => {
          const next = { ...s.categoryOverrides };
          if (category) next[merchant] = category;
          else delete next[merchant];
          return { categoryOverrides: next };
        }),
      resetMoney: () => set({ ...EMPTY_LOCAL }),
    }),
    {
      name: 'tenbagger-money-v1',
      version: 1,
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (s): LocalMoneyState => ({ workLog: s.workLog, goals: s.goals, categoryOverrides: s.categoryOverrides }),
    },
  ),
);

export function useLocalMoney(): LocalMoneyState {
  const workLog = useMoneyStore((s) => s.workLog);
  const goals = useMoneyStore((s) => s.goals);
  const categoryOverrides = useMoneyStore((s) => s.categoryOverrides);
  return { workLog, goals, categoryOverrides };
}

export type { WorkEntry };

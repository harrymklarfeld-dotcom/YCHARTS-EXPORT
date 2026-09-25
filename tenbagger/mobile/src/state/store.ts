/**
 * App state: zustand + AsyncStorage persistence. Local-first; no network.
 * All rules live in ../game (pure, unit-tested); the store only wires them together.
 *
 * REGULATORY NOTE: XP, streaks and goals are earned only by completing learning content.
 * Do not add rewards tied to trading, deposits, or holding securities.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import {
  addXpToLog,
  DEFAULT_DAILY_GOAL,
  INITIAL_HEARTS,
  INITIAL_STREAK,
  loseHeart,
  recordActivity,
  regenHearts,
  toDayKey,
  type HeartsState,
  type StreakState,
  type XpLog,
} from '../game';

export type ThemePref = 'system' | 'light' | 'dark';

export type CompletedLesson = { completedAt: number; bestMistakes: number; timesCompleted: number };

type Persisted = {
  totalXp: number;
  xpLog: XpLog;
  streak: StreakState;
  hearts: HeartsState;
  completed: Record<string, CompletedLesson>;
  dailyGoal: number;
  themePref: ThemePref;
};

type Actions = {
  /** Award learning XP and extend the streak. */
  awardLearningXp: (xp: number, now?: number) => void;
  completeLesson: (lessonId: string, mistakes: number, xp: number, now?: number) => void;
  loseHeart: (now?: number) => void;
  tickHearts: (now?: number) => void;
  setDailyGoal: (goal: number) => void;
  setThemePref: (p: ThemePref) => void;
  resetProgress: () => void;
};

export type AppState = Persisted & Actions & { hydrated: boolean };

const initial: Persisted = {
  totalXp: 0,
  xpLog: {},
  streak: INITIAL_STREAK,
  hearts: INITIAL_HEARTS,
  completed: {},
  dailyGoal: DEFAULT_DAILY_GOAL,
  themePref: 'system',
};

export const useApp = create<AppState>()(
  persist(
    (set, get) => ({
      ...initial,
      hydrated: false,
      awardLearningXp: (xp, now = Date.now()) => {
        const day = toDayKey(new Date(now));
        set((s) => ({
          totalXp: s.totalXp + xp,
          xpLog: addXpToLog(s.xpLog, day, xp),
          streak: recordActivity(s.streak, day),
        }));
      },
      completeLesson: (lessonId, mistakes, xp, now = Date.now()) => {
        const prev = get().completed[lessonId];
        set((s) => ({
          completed: {
            ...s.completed,
            [lessonId]: {
              completedAt: now,
              bestMistakes: prev ? Math.min(prev.bestMistakes, mistakes) : mistakes,
              timesCompleted: (prev?.timesCompleted ?? 0) + 1,
            },
          },
        }));
        get().awardLearningXp(xp, now);
      },
      loseHeart: (now = Date.now()) => set((s) => ({ hearts: loseHeart(s.hearts, now) })),
      tickHearts: (now = Date.now()) => {
        const next = regenHearts(get().hearts, now);
        if (next !== get().hearts && (next.count !== get().hearts.count || next.regenFrom !== get().hearts.regenFrom)) {
          set({ hearts: next });
        }
      },
      setDailyGoal: (goal) => set({ dailyGoal: goal }),
      setThemePref: (p) => set({ themePref: p }),
      resetProgress: () => set({ ...initial, themePref: get().themePref }),
    }),
    {
      name: 'tenbagger-app-v1',
      version: 1,
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (s): Persisted => ({
        totalXp: s.totalXp,
        xpLog: s.xpLog,
        streak: s.streak,
        hearts: s.hearts,
        completed: s.completed,
        dailyGoal: s.dailyGoal,
        themePref: s.themePref,
      }),
      onRehydrateStorage: () => () => {
        useApp.setState({ hydrated: true });
      },
    },
  ),
);

/** Today's local day key (device time zone). */
export const today = () => toDayKey(new Date());

/**
 * Articles store: reading progress + read marks, persisted with AsyncStorage.
 * Separate from src/state/store.ts on purpose (own key, own version). No XP here, ever.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { withOpened, withProgress, withRead, type ReadMap } from './progress';

type ArticlesState = {
  reads: ReadMap;
  setProgress: (slug: string, p: number) => void;
  markRead: (slug: string, read: boolean, now?: number) => void;
  opened: (slug: string, now?: number) => void;
  resetReading: () => void;
};

export const useArticles = create<ArticlesState>()(
  persist(
    (set) => ({
      reads: {},
      setProgress: (slug, p) =>
        set((s) => {
          const next = withProgress(s.reads, slug, p);
          return next === s.reads ? s : { reads: next };
        }),
      markRead: (slug, read, now = Date.now()) => set((s) => ({ reads: withRead(s.reads, slug, read, now) })),
      opened: (slug, now = Date.now()) => set((s) => ({ reads: withOpened(s.reads, slug, now) })),
      resetReading: () => set({ reads: {} }),
    }),
    {
      name: 'tenbagger-articles-v1',
      version: 1,
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (s) => ({ reads: s.reads }),
    },
  ),
);

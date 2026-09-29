/**
 * Screener preferences, per device: chosen result columns, saved screens and watchlists.
 * zustand + AsyncStorage (local only; nothing is sent anywhere). Logic lives in ./lists.ts.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { Filter } from '../types/contract';
import * as L from './lists';

type Actions = {
  setColumns: (ids: string[]) => void;
  toggleColumn: (id: string) => void;
  moveColumn: (id: string, delta: -1 | 1) => void;
  resetColumns: () => void;
  saveScreen: (input: { name: string; filters: Filter[]; columns?: string[]; sort?: L.SortSpec; id?: string }, now?: number) => string;
  renameScreen: (id: string, name: string, now?: number) => void;
  deleteScreen: (id: string) => void;
  createWatchlist: (name: string, tickers?: string[], now?: number) => string;
  toggleTicker: (listId: string, ticker: string) => void;
  renameWatchlist: (id: string, name: string) => void;
  deleteWatchlist: (id: string) => void;
};

export type ScreenerPrefs = L.ListsState & Actions & { hydrated: boolean };

export const useScreenerPrefs = create<ScreenerPrefs>()(
  persist(
    (set, get) => {
      const lists = (): L.ListsState => {
        const { columns, savedScreens, watchlists } = get();
        return { columns, savedScreens, watchlists };
      };
      return {
        ...L.INITIAL_LISTS,
        hydrated: false,
        setColumns: (ids) => set({ columns: L.sanitizeColumns(ids) }),
        toggleColumn: (id) => set({ columns: L.toggleColumn(get().columns, id) }),
        moveColumn: (id, delta) => set({ columns: L.moveColumn(get().columns, id, delta) }),
        resetColumns: () => set({ columns: [...L.DEFAULT_COLUMNS] }),
        saveScreen: (input, now = Date.now()) => {
          const { state, id } = L.saveScreen(lists(), input, now);
          set(state);
          return id;
        },
        renameScreen: (id, name, now = Date.now()) => set(L.renameScreen(lists(), id, name, now)),
        deleteScreen: (id) => set(L.deleteScreen(lists(), id)),
        createWatchlist: (name, tickers = [], now = Date.now()) => {
          const { state, id } = L.createWatchlist(lists(), name, tickers, now);
          set(state);
          return id;
        },
        toggleTicker: (listId, ticker) => set(L.toggleTicker(lists(), listId, ticker)),
        renameWatchlist: (id, name) => set(L.renameWatchlist(lists(), id, name)),
        deleteWatchlist: (id) => set(L.deleteWatchlist(lists(), id)),
      };
    },
    {
      name: 'tenbagger-screener-v2',
      version: 1,
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (s) => ({ columns: s.columns, savedScreens: s.savedScreens, watchlists: s.watchlists }),
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<L.ListsState>;
        return {
          ...current,
          columns: L.sanitizeColumns(Array.isArray(p.columns) ? p.columns : current.columns),
          savedScreens: Array.isArray(p.savedScreens) ? p.savedScreens : [],
          watchlists: Array.isArray(p.watchlists) ? p.watchlists : [],
        };
      },
      onRehydrateStorage: () => () => useScreenerPrefs.setState({ hydrated: true }),
    },
  ),
);

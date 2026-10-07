/**
 * Pure state logic for chosen columns, saved screens and watchlists. The zustand store in
 * ./store.ts only wires these to AsyncStorage, so everything here is unit-tested without React.
 */
import type { Filter } from '../types/contract';
import { isColumnId } from './columns';

export const MAX_COLUMNS = 8;
export const MAX_SAVED_SCREENS = 50;
export const MAX_WATCHLISTS = 20;
export const MAX_WATCHLIST_TICKERS = 200;
export const MAX_NAME_LENGTH = 40;
export const DEFAULT_COLUMNS: readonly string[] = Object.freeze(['pe', 'roic', 'score:quality', 'score:value', 'market_cap', 'style']);

export type SortSpec = { column: string; dir: 'asc' | 'desc' };

export type SavedScreen = {
  id: string;
  name: string;
  filters: Filter[];
  columns: string[];
  sort?: SortSpec;
  createdAt: number;
  updatedAt: number;
};

export type Watchlist = { id: string; name: string; tickers: string[]; createdAt: number };

export type ListsState = { columns: string[]; savedScreens: SavedScreen[]; watchlists: Watchlist[] };

export const INITIAL_LISTS: ListsState = { columns: [...DEFAULT_COLUMNS], savedScreens: [], watchlists: [] };

let seq = 0;
export function newId(prefix: string, now: number): string {
  seq = (seq + 1) % 1_000_000;
  return `${prefix}_${now.toString(36)}_${seq.toString(36)}`;
}

export function cleanName(name: string, fallback: string): string {
  const n = String(name ?? '').replace(/\s+/g, ' ').trim().slice(0, MAX_NAME_LENGTH);
  return n || fallback;
}

/** Valid, unique column ids, capped; falls back to defaults when nothing valid is left. */
export function sanitizeColumns(ids: readonly string[]): string[] {
  const out: string[] = [];
  for (const id of ids) if (isColumnId(id) && !out.includes(id) && out.length < MAX_COLUMNS) out.push(id);
  return out.length ? out : [...DEFAULT_COLUMNS];
}

export function toggleColumn(columns: readonly string[], id: string): string[] {
  if (!isColumnId(id)) return [...columns];
  if (columns.includes(id)) return columns.length > 1 ? columns.filter((c) => c !== id) : [...columns];
  return columns.length >= MAX_COLUMNS ? [...columns] : [...columns, id];
}

export function moveColumn(columns: readonly string[], id: string, delta: -1 | 1): string[] {
  const i = columns.indexOf(id);
  const j = i + delta;
  if (i < 0 || j < 0 || j >= columns.length) return [...columns];
  const next = [...columns];
  [next[i], next[j]] = [next[j], next[i]];
  return next;
}

const cloneFilters = (fs: readonly Filter[]): Filter[] =>
  fs.map((f) => ({ metric: f.metric, op: f.op, value: Array.isArray(f.value) ? [f.value[0], f.value[1]] : f.value }) as Filter);

export function saveScreen(
  s: ListsState,
  input: { name: string; filters: readonly Filter[]; columns?: readonly string[]; sort?: SortSpec; id?: string },
  now: number,
): { state: ListsState; id: string } {
  const existing = input.id ? s.savedScreens.find((x) => x.id === input.id) : undefined;
  const name = cleanName(input.name, `My screen ${s.savedScreens.length + 1}`);
  const base = {
    name,
    filters: cloneFilters(input.filters),
    columns: sanitizeColumns(input.columns ?? s.columns),
    ...(input.sort ? { sort: { column: input.sort.column, dir: input.sort.dir } } : {}),
  };
  if (existing) {
    const updated: SavedScreen = { ...existing, ...base, updatedAt: now };
    return { state: { ...s, savedScreens: s.savedScreens.map((x) => (x.id === existing.id ? updated : x)) }, id: existing.id };
  }
  const id = newId('scr', now);
  const saved: SavedScreen = { id, ...base, createdAt: now, updatedAt: now };
  // Newest first; oldest dropped past the cap.
  return { state: { ...s, savedScreens: [saved, ...s.savedScreens].slice(0, MAX_SAVED_SCREENS) }, id };
}

export function renameScreen(s: ListsState, id: string, name: string, now: number): ListsState {
  return { ...s, savedScreens: s.savedScreens.map((x) => (x.id === id ? { ...x, name: cleanName(name, x.name), updatedAt: now } : x)) };
}

export function deleteScreen(s: ListsState, id: string): ListsState {
  return { ...s, savedScreens: s.savedScreens.filter((x) => x.id !== id) };
}

const normTicker = (t: string) => String(t ?? '').trim().toUpperCase().slice(0, 12);

export function createWatchlist(s: ListsState, name: string, tickers: readonly string[], now: number): { state: ListsState; id: string } {
  if (s.watchlists.length >= MAX_WATCHLISTS) return { state: s, id: '' };
  const id = newId('wl', now);
  const uniq: string[] = [];
  for (const t of tickers.map(normTicker)) if (t && !uniq.includes(t) && uniq.length < MAX_WATCHLIST_TICKERS) uniq.push(t);
  const wl: Watchlist = { id, name: cleanName(name, `Watchlist ${s.watchlists.length + 1}`), tickers: uniq, createdAt: now };
  return { state: { ...s, watchlists: [...s.watchlists, wl] }, id };
}

export function toggleTicker(s: ListsState, listId: string, ticker: string): ListsState {
  const t = normTicker(ticker);
  if (!t) return s;
  return {
    ...s,
    watchlists: s.watchlists.map((w) => {
      if (w.id !== listId) return w;
      if (w.tickers.includes(t)) return { ...w, tickers: w.tickers.filter((x) => x !== t) };
      if (w.tickers.length >= MAX_WATCHLIST_TICKERS) return w;
      return { ...w, tickers: [...w.tickers, t] };
    }),
  };
}

export function renameWatchlist(s: ListsState, id: string, name: string): ListsState {
  return { ...s, watchlists: s.watchlists.map((w) => (w.id === id ? { ...w, name: cleanName(name, w.name) } : w)) };
}

export function deleteWatchlist(s: ListsState, id: string): ListsState {
  return { ...s, watchlists: s.watchlists.filter((w) => w.id !== id) };
}

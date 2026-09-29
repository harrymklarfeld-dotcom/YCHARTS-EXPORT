/**
 * Pure reading-progress rules (tested). Reading is tracked for the reader's benefit only:
 * it never awards XP. XP comes from finishing the linked lesson (see widgets/QuizWidget).
 */
import type { Article } from './types';

export type ReadState = {
  /** Furthest scroll position reached, 0..1. */
  progress: number;
  /** Set when the reader tapped "Mark as read" (or finished reading to the end). */
  readAt?: number;
  lastOpenedAt?: number;
};

export type ReadMap = Record<string, ReadState>;

const clamp01 = (n: number) => (Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : 0);

/** Only ever moves forward; ignores changes smaller than 5 points unless reaching the end. */
export function withProgress(map: ReadMap, slug: string, p: number): ReadMap {
  const prev = map[slug] ?? { progress: 0 };
  const next = clamp01(p);
  if (next <= prev.progress) return map;
  if (next < 0.98 && next - prev.progress < 0.05) return map;
  return { ...map, [slug]: { ...prev, progress: next >= 0.98 ? 1 : Math.round(next * 100) / 100 } };
}

export function withRead(map: ReadMap, slug: string, read: boolean, now: number): ReadMap {
  const prev = map[slug] ?? { progress: 0 };
  if (read) return { ...map, [slug]: { ...prev, progress: 1, readAt: prev.readAt ?? now } };
  const { readAt: _drop, ...rest } = prev;
  return { ...map, [slug]: rest };
}

export function withOpened(map: ReadMap, slug: string, now: number): ReadMap {
  return { ...map, [slug]: { ...(map[slug] ?? { progress: 0 }), lastOpenedAt: now } };
}

export const isRead = (map: ReadMap, slug: string) => !!map[slug]?.readAt;

export type LibrarySummary = { total: number; read: number; continueSlug: string | null; nextSlug: string | null };

/** Counts + "continue reading" (most recently opened, unread, started) + next unread in library order. */
export function librarySummary(articles: Article[], map: ReadMap): LibrarySummary {
  const unread = articles.filter((a) => !isRead(map, a.slug));
  const started = unread
    .filter((a) => (map[a.slug]?.lastOpenedAt ?? 0) > 0)
    .sort((a, b) => (map[b.slug]?.lastOpenedAt ?? 0) - (map[a.slug]?.lastOpenedAt ?? 0));
  return {
    total: articles.length,
    read: articles.length - unread.length,
    continueSlug: started[0]?.slug ?? null,
    nextSlug: unread[0]?.slug ?? null,
  };
}

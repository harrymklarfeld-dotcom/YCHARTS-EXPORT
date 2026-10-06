/**
 * Freshness + refresh pacing for linked connections. Pure (no React); tested in
 * __tests__/live.test.ts. Local on purpose: packages/money may later provide syncPlan /
 * freshnessLine, and the lead can swap these out.
 */
import { CONNECTION_STATUS_LABEL } from './copy';
import type { Connection } from './types';

/** Pull-to-refresh or the refresh button asks a connection at most once per 15 minutes. */
export const REFRESH_COOLDOWN_MS = 15 * 60 * 1000;
/** On app foreground, connections older than this are refreshed automatically. */
export const FOREGROUND_STALE_MS = 6 * 60 * 60 * 1000;

/** Connections that cannot be refreshed until the user signs in again (or relinks). */
export function canSync(c: Connection): boolean {
  return c.status !== 'needs_relogin' && c.status !== 'revoked';
}

/** Milliseconds until `id` may be refreshed again (0 = now). */
export function cooldownRemaining(lastAttemptMs: number | undefined, nowMs: number, cooldownMs = REFRESH_COOLDOWN_MS): number {
  if (lastAttemptMs === undefined) return 0;
  return Math.max(0, lastAttemptMs + cooldownMs - nowMs);
}

/** Splits ids into those due for a refresh and those still cooling down. */
export function planRefresh(
  ids: readonly string[],
  lastAttempt: Readonly<Record<string, number>>,
  nowMs: number,
  cooldownMs = REFRESH_COOLDOWN_MS,
): { due: string[]; cooling: string[] } {
  const due: string[] = [];
  const cooling: string[] = [];
  for (const id of ids) (cooldownRemaining(lastAttempt[id], nowMs, cooldownMs) > 0 ? cooling : due).push(id);
  return { due, cooling };
}

/** Ids of syncable connections never updated or last updated more than `maxAgeMs` ago. */
export function staleIds(connections: readonly Connection[], nowMs: number, maxAgeMs = FOREGROUND_STALE_MS): string[] {
  return connections
    .filter((c) => canSync(c) && (!c.lastSyncedAt || nowMs - Date.parse(c.lastSyncedAt) > maxAgeMs))
    .map((c) => c.id);
}

/** "just now", "5 min ago", "3 hr ago", "2 days ago", "not yet". */
export function agoText(iso: string | null | undefined, nowMs: number): string {
  if (!iso) return 'not yet';
  const ms = nowMs - Date.parse(iso);
  if (!Number.isFinite(ms)) return 'not yet';
  const min = Math.floor(ms / 60_000);
  if (min < 1) return 'just now';
  if (min < 60) return `${min} min ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} hr ago`;
  const days = Math.floor(hr / 24);
  return `${days} day${days === 1 ? '' : 's'} ago`;
}

export type ChipTone = 'ok' | 'busy' | 'attention' | 'muted';

/** Status chip for one connection. "Updating" wins while a refresh is in flight. */
export function statusChip(c: Connection, updating: boolean): { label: string; tone: ChipTone } {
  if (updating) return { label: CONNECTION_STATUS_LABEL.updating, tone: 'busy' };
  switch (c.status) {
    case 'active':
      return { label: CONNECTION_STATUS_LABEL.active, tone: 'ok' };
    case 'needs_relogin':
      return { label: CONNECTION_STATUS_LABEL.needs_relogin, tone: 'attention' };
    case 'expiring':
      return { label: CONNECTION_STATUS_LABEL.expiring, tone: 'attention' };
    case 'error':
      return { label: CONNECTION_STATUS_LABEL.error, tone: 'muted' };
    case 'revoked':
      return { label: CONNECTION_STATUS_LABEL.revoked, tone: 'muted' };
  }
}

/**
 * One line for Home: "4 connections · updated 5 min ago · 1 needs a quick sign-in".
 * Uses the OLDEST syncable connection, so the line never overstates freshness. Empty with no connections.
 */
export function homeFreshness(connections: readonly Connection[], nowMs: number): string {
  if (connections.length === 0) return '';
  const syncable = connections.filter(canSync);
  const times = syncable.map((c) => (c.lastSyncedAt ? Date.parse(c.lastSyncedAt) : Number.NaN));
  const oldest = times.some((x) => Number.isNaN(x)) ? null : times.length ? new Date(Math.min(...times)).toISOString() : null;
  const attention = connections.filter((c) => c.status === 'needs_relogin' || c.status === 'expiring').length;
  return [
    `${connections.length} connection${connections.length === 1 ? '' : 's'}`,
    syncable.length ? `updated ${agoText(oldest, nowMs)}` : '',
    attention ? `${attention} need${attention === 1 ? 's' : ''} a quick sign-in` : '',
  ]
    .filter(Boolean)
    .join(' · ');
}

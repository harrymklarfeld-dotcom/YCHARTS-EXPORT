/**
 * Keeping linked accounts fresh: which connections (Plaid Items) to refresh, and plain-English
 * freshness text for the Money hub.
 *
 * COST CAP (every refresh is a paid aggregator call, so the app never refreshes on a whim):
 * - `app_open`: refresh only connections last synced more than 6 hours ago (or never). With the
 *   app opened all day that is at most ~4 app-driven refreshes per connection per day.
 * - `pull_to_refresh`: refresh a connection only if it was not manually refreshed in the last
 *   15 minutes; otherwise it is skipped with reason `cooldown` and the minutes left. At most
 *   4 manual refreshes per connection per hour, however often the user pulls.
 * - `webhook`: the provider says new data is ready for ONE Item, so that Item always syncs
 *   (no cooldown: the provider is telling us fresh data exists, so the sync is not wasted).
 * - `needs_relogin` is never refreshed (the call would fail); the action is `relogin`, which the
 *   app shows as a gentle "sign in again" button. `syncing` connections are not refreshed twice.
 *
 * Times are ISO timestamps (instants), unlike the rest of the package, which uses calendar dates.
 */

export type ConnectionStatus = 'ok' | 'needs_relogin' | 'pending_expiration' | 'syncing' | 'error';

export type Connection = {
  id: string;
  /** Display name, e.g. "Chase". */
  institution: string;
  /** ISO timestamp of the last successful sync; null when it has never synced. */
  lastSyncedAt: string | null;
  status: ConnectionStatus;
  /** ISO timestamp of the last pull-to-refresh that hit this connection. */
  lastManualRefreshAt?: string | null;
  /** Accounts under this connection (checking, savings, card…), when known. */
  accountCount?: number;
};

export type SyncTrigger = 'app_open' | 'pull_to_refresh' | 'webhook';

export type SyncReason =
  | 'never_synced'
  | 'stale'
  | 'fresh'
  | 'manual'
  | 'cooldown'
  | 'webhook'
  | 'not_this_item'
  | 'needs_relogin'
  | 'already_syncing';

export type SyncDecision = {
  connectionId: string;
  institution: string;
  action: 'refresh' | 'skip' | 'relogin';
  reason: SyncReason;
  /** cooldown only: whole minutes until a manual refresh is allowed again. */
  minutesLeft?: number;
};

export const APP_OPEN_MAX_AGE_MIN = 6 * 60;
export const MANUAL_COOLDOWN_MIN = 15;

export type SyncPlanOptions = {
  /** webhook only: the connection (Item) the webhook is about. */
  connectionId?: string;
  appOpenMaxAgeMin?: number;
  manualCooldownMin?: number;
};

const ms = (t: string | Date) => (typeof t === 'string' ? Date.parse(t) : t.getTime());
/** Minutes from `then` to `now`; null when `then` is missing or unparseable. */
function minutesSince(then: string | null | undefined, now: string | Date): number | null {
  if (!then) return null;
  const a = Date.parse(then);
  const b = ms(now);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  return (b - a) / 60000;
}

/** One decision per connection, in input order. See the COST CAP header for the policy. */
export function syncPlan(
  connections: readonly Connection[],
  now: string | Date,
  trigger: SyncTrigger,
  opts: SyncPlanOptions = {},
): SyncDecision[] {
  const maxAge = opts.appOpenMaxAgeMin ?? APP_OPEN_MAX_AGE_MIN;
  const cooldown = opts.manualCooldownMin ?? MANUAL_COOLDOWN_MIN;
  return connections.map((c): SyncDecision => {
    const d = (action: SyncDecision['action'], reason: SyncReason, extra: Partial<SyncDecision> = {}): SyncDecision => ({
      connectionId: c.id,
      institution: c.institution,
      action,
      reason,
      ...extra,
    });
    if (c.status === 'needs_relogin') return d('relogin', 'needs_relogin');
    if (trigger === 'webhook') return c.id === opts.connectionId ? d('refresh', 'webhook') : d('skip', 'not_this_item');
    if (c.status === 'syncing') return d('skip', 'already_syncing');
    if (trigger === 'pull_to_refresh') {
      const since = minutesSince(c.lastManualRefreshAt, now);
      if (since !== null && since >= 0 && since < cooldown) {
        return d('skip', 'cooldown', { minutesLeft: Math.max(1, Math.ceil(cooldown - since)) });
      }
      return d('refresh', 'manual');
    }
    const age = minutesSince(c.lastSyncedAt, now);
    if (age === null) return d('refresh', 'never_synced');
    return age > maxAge ? d('refresh', 'stale') : d('skip', 'fresh');
  });
}

/** "just now", "3 min ago", "5 hr ago", "2 days ago". */
export function timeAgo(then: string, now: string | Date): string {
  const m = minutesSince(then, now);
  if (m === null) return 'at an unknown time';
  if (m < 1) return 'just now';
  if (m < 60) return `${Math.floor(m)} min ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} hr ago`;
  const days = Math.floor(h / 24);
  return days === 1 ? '1 day ago' : `${days} days ago`;
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/**
 * One line for the top of the Money hub, e.g. "Updated 3 min ago · 4 accounts at 3 banks".
 * "Updated" uses the OLDEST successful sync among connections that are still updating
 * (needs-sign-in ones are left out; they have their own line), so it never overstates freshness.
 */
export function freshnessLine(connections: readonly Connection[], now: string | Date): string {
  if (connections.length === 0) return 'No accounts linked yet';
  const banks = new Set(connections.map((c) => c.institution.trim().toLowerCase())).size;
  const counts = connections.map((c) => c.accountCount);
  const where = counts.every((n): n is number => typeof n === 'number' && n >= 0)
    ? `${plural(counts.reduce((s, n) => s + n, 0), 'account', 'accounts')} at ${plural(banks, 'bank', 'banks')}`
    : `${plural(banks, 'bank', 'banks')} linked`;
  const live = connections.filter((c) => c.status !== 'needs_relogin');
  if (live.length === 0) return `Paused until you sign in again · ${where}`;
  if (live.some((c) => !c.lastSyncedAt)) {
    return live.every((c) => !c.lastSyncedAt) ? `Getting your first update · ${where}` : `Still getting some accounts · ${where}`;
  }
  const oldest = live.map((c) => c.lastSyncedAt!).sort((a, b) => Date.parse(a) - Date.parse(b))[0]!;
  return `Updated ${timeAgo(oldest, now)} · ${where}`;
}

/** Plain-English, shame-free status for one connection. */
export function connectionStatusText(c: Connection, now: string | Date): string {
  switch (c.status) {
    case 'needs_relogin':
      return `${c.institution} needs you to sign in again to keep updating`;
    case 'pending_expiration':
      return `${c.institution} will ask you to sign in again soon to keep updating`;
    case 'syncing':
      return `${c.institution} is updating now`;
    case 'error':
      return `${c.institution} didn't update last time. We'll try again on your next refresh`;
    case 'ok':
    default:
      return c.lastSyncedAt ? `${c.institution} updated ${timeAgo(c.lastSyncedAt, now)}` : `${c.institution} is getting its first update`;
  }
}

/** Text for a skipped pull-to-refresh, e.g. "Chase just updated. You can refresh again in 12 min". */
export function cooldownText(d: SyncDecision): string | null {
  return d.reason === 'cooldown' && d.minutesLeft !== undefined
    ? `${d.institution} just updated. You can refresh again in ${d.minutesLeft} min`
    : null;
}

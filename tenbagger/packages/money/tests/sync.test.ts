import { describe, expect, it } from 'vitest';
import {
  connectionStatusText,
  cooldownText,
  findBannedPhrases,
  freshnessLine,
  syncPlan,
  timeAgo,
  type Connection,
} from '../src/index.ts';

const NOW = '2026-10-06T18:00:00Z';
const ago = (min: number) => new Date(Date.parse(NOW) - min * 60000).toISOString();
const conn = (id: string, institution: string, extra: Partial<Connection> = {}): Connection => ({
  id,
  institution,
  lastSyncedAt: ago(10),
  status: 'ok',
  ...extra,
});

describe('syncPlan (cost cap)', () => {
  const conns = [
    conn('chase', 'Chase', { lastSyncedAt: ago(7 * 60) }),
    conn('ally', 'Ally', { lastSyncedAt: ago(60) }),
    conn('discover', 'Discover', { status: 'needs_relogin', lastSyncedAt: ago(3 * 24 * 60) }),
    conn('rh', 'Robinhood', { lastSyncedAt: null }),
    conn('busy', 'Busy Bank', { status: 'syncing', lastSyncedAt: ago(9 * 60) }),
  ];

  it('app_open refreshes only connections older than 6h (or never synced)', () => {
    expect(syncPlan(conns, NOW, 'app_open').map((d) => [d.connectionId, d.action, d.reason])).toEqual([
      ['chase', 'refresh', 'stale'],
      ['ally', 'skip', 'fresh'],
      ['discover', 'relogin', 'needs_relogin'],
      ['rh', 'refresh', 'never_synced'],
      ['busy', 'skip', 'already_syncing'],
    ]);
    // exactly 6h is still fresh; just over is stale
    expect(syncPlan([conn('a', 'A', { lastSyncedAt: ago(360) })], NOW, 'app_open')[0]!.action).toBe('skip');
    expect(syncPlan([conn('a', 'A', { lastSyncedAt: ago(361) })], NOW, 'app_open')[0]!.action).toBe('refresh');
  });

  it('pull_to_refresh honours a 15-minute manual cooldown with minutes left', () => {
    const plan = syncPlan(
      [
        conn('chase', 'Chase', { lastManualRefreshAt: ago(3) }),
        conn('ally', 'Ally', { lastManualRefreshAt: ago(15) }),
        conn('rh', 'Robinhood'),
        conn('discover', 'Discover', { status: 'needs_relogin' }),
        conn('err', 'Credit Union', { status: 'error', lastManualRefreshAt: ago(30) }),
        conn('pe', 'Pending Bank', { status: 'pending_expiration' }),
      ],
      NOW,
      'pull_to_refresh',
    );
    expect(plan.map((d) => [d.connectionId, d.action, d.reason, d.minutesLeft])).toEqual([
      ['chase', 'skip', 'cooldown', 12],
      ['ally', 'refresh', 'manual', undefined],
      ['rh', 'refresh', 'manual', undefined],
      ['discover', 'relogin', 'needs_relogin', undefined],
      ['err', 'refresh', 'manual', undefined],
      ['pe', 'refresh', 'manual', undefined],
    ]);
    expect(cooldownText(plan[0]!)).toBe('Chase just updated. You can refresh again in 12 min');
    expect(cooldownText(plan[1]!)).toBeNull();
  });

  it('webhook always syncs that item (even if fresh or in cooldown), never a needs_relogin one', () => {
    const c = [
      conn('chase', 'Chase', { lastSyncedAt: ago(1), lastManualRefreshAt: ago(1) }),
      conn('ally', 'Ally', { lastSyncedAt: ago(9 * 60) }),
      conn('discover', 'Discover', { status: 'needs_relogin' }),
    ];
    expect(syncPlan(c, NOW, 'webhook', { connectionId: 'chase' }).map((d) => [d.connectionId, d.action, d.reason])).toEqual([
      ['chase', 'refresh', 'webhook'],
      ['ally', 'skip', 'not_this_item'],
      ['discover', 'relogin', 'needs_relogin'],
    ]);
    expect(syncPlan(c, NOW, 'webhook', { connectionId: 'discover' })[2]!.action).toBe('relogin');
  });

  it('accepts a Date for now and empty input', () => {
    expect(syncPlan([], new Date(NOW), 'app_open')).toEqual([]);
    expect(syncPlan([conn('a', 'A', { lastSyncedAt: ago(400) })], new Date(NOW), 'app_open')[0]!.reason).toBe('stale');
  });
});

describe('freshness text', () => {
  it('timeAgo', () => {
    expect(timeAgo(ago(0.5), NOW)).toBe('just now');
    expect(timeAgo(ago(3), NOW)).toBe('3 min ago');
    expect(timeAgo(ago(5 * 60 + 10), NOW)).toBe('5 hr ago');
    expect(timeAgo(ago(26 * 60), NOW)).toBe('1 day ago');
    expect(timeAgo(ago(3 * 24 * 60), NOW)).toBe('3 days ago');
  });

  it('freshnessLine: oldest live sync, accounts and institutions', () => {
    const c = [
      conn('chase', 'Chase', { lastSyncedAt: ago(3), accountCount: 2 }),
      conn('ally', 'Ally', { lastSyncedAt: ago(1), accountCount: 1 }),
      conn('discover', 'Discover', { lastSyncedAt: ago(2), accountCount: 1 }),
    ];
    expect(freshnessLine(c, NOW)).toBe('Updated 3 min ago · 4 accounts at 3 banks');
    // A needs-sign-in connection does not drag the line back; it has its own status text.
    const withRelogin = [...c, conn('rh', 'Robinhood', { status: 'needs_relogin', lastSyncedAt: ago(5000), accountCount: 1 })];
    expect(freshnessLine(withRelogin, NOW)).toBe('Updated 3 min ago · 5 accounts at 4 banks');
    expect(freshnessLine([conn('chase', 'Chase', { accountCount: 1 })], NOW)).toBe('Updated 10 min ago · 1 account at 1 bank');
    expect(freshnessLine([conn('chase', 'Chase')], NOW)).toBe('Updated 10 min ago · 1 bank linked');
    expect(freshnessLine([], NOW)).toBe('No accounts linked yet');
    expect(freshnessLine([conn('chase', 'Chase', { lastSyncedAt: null, accountCount: 2 })], NOW)).toBe('Getting your first update · 2 accounts at 1 bank');
    expect(freshnessLine([conn('chase', 'Chase', { status: 'needs_relogin', accountCount: 2 })], NOW)).toBe(
      'Paused until you sign in again · 2 accounts at 1 bank',
    );
  });

  it('per-connection status text is plain and shame-free', () => {
    const texts = (['ok', 'needs_relogin', 'pending_expiration', 'syncing', 'error'] as const).map((status) =>
      connectionStatusText(conn('chase', 'Chase', { status, lastSyncedAt: ago(3) }), NOW),
    );
    expect(texts).toEqual([
      'Chase updated 3 min ago',
      'Chase needs you to sign in again to keep updating',
      'Chase will ask you to sign in again soon to keep updating',
      'Chase is updating now',
      "Chase didn't update last time. We'll try again on your next refresh",
    ]);
    for (const s of texts) {
      expect(findBannedPhrases(s)).toEqual([]);
      expect(s).not.toMatch(/!|urgent|warning|fail|error|immediately|alert/i);
    }
  });
});

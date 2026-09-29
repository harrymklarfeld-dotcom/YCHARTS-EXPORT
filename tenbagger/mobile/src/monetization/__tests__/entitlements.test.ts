import { FREE_LIMITS, LESSON_RULES } from '../../config/monetization';
import {
  canPresentPaywall,
  checkFeature,
  checkLessonStart,
  effectiveTier,
  FREE_SNAPSHOT,
  inLessonGracePeriod,
  isPresetFree,
  newLessonsOn,
  type Usage,
} from '../entitlements';
import { MockPurchasesAdapter, mockSnapshot } from '../purchases/MockPurchasesAdapter';
import { grantOneHeart } from '../hearts';

const usage = (over: Partial<Usage> = {}): Usage => ({
  newLessonsToday: 0,
  firstSeenDay: '2026-09-01',
  today: '2026-09-20',
  savedScreens: 0,
  linkedAccounts: 0,
  ...over,
});

describe('config sanity', () => {
  it('free tier = daily puzzle + 1 lesson/day + 3 saved screens + 1 linked bank', () => {
    expect(FREE_LIMITS.daily_puzzle).toBe(true);
    expect(FREE_LIMITS.lessons).toBe(1);
    expect(FREE_LIMITS.saved_screens).toBe(3);
    expect(FREE_LIMITS.money_accounts).toBe(1);
    for (const f of ['practice_mode', 'xray', 'compare', 'money_alerts', 'personal_10k'] as const) expect(FREE_LIMITS[f]).toBe(false);
  });
});

describe('checkFeature', () => {
  it('pro gets everything', () => {
    for (const f of Object.keys(FREE_LIMITS) as (keyof typeof FREE_LIMITS)[]) {
      expect(checkFeature(f, 'pro', usage({ newLessonsToday: 99, savedScreens: 99, linkedAccounts: 99 })).allowed).toBe(true);
    }
  });
  it('free-only and pro-only features', () => {
    expect(checkFeature('daily_puzzle', 'free', usage())).toEqual({ allowed: true, reason: 'free_feature' });
    expect(checkFeature('xray', 'free', usage())).toEqual({ allowed: false, reason: 'pro_only' });
    expect(checkFeature('compare', 'free', usage()).allowed).toBe(false);
    expect(checkFeature('practice_mode', 'free', usage()).allowed).toBe(false);
  });
  it('meters saved screens at 3', () => {
    expect(checkFeature('saved_screens', 'free', usage({ savedScreens: 2 }))).toMatchObject({ allowed: true, remaining: 1, limit: 3 });
    expect(checkFeature('saved_screens', 'free', usage({ savedScreens: 3 }))).toMatchObject({ allowed: false, reason: 'limit_reached', remaining: 0 });
  });
  it('allows exactly 1 linked bank on free', () => {
    expect(checkFeature('money_accounts', 'free', usage({ linkedAccounts: 0 })).allowed).toBe(true);
    expect(checkFeature('money_accounts', 'free', usage({ linkedAccounts: 1 })).allowed).toBe(false);
  });
  it('1 new lesson per day after the grace period', () => {
    expect(checkFeature('lessons', 'free', usage({ newLessonsToday: 0 })).allowed).toBe(true);
    expect(checkFeature('lessons', 'free', usage({ newLessonsToday: 1 }))).toMatchObject({ allowed: false, reason: 'limit_reached' });
  });
  it('unlimited lessons during the first N days', () => {
    const n = LESSON_RULES.unlimitedFirstDays;
    expect(inLessonGracePeriod({ firstSeenDay: '2026-09-20', today: '2026-09-20' })).toBe(true);
    const lastGraceDay = `2026-09-${String(20 + n - 1).padStart(2, '0')}`;
    const firstLimitedDay = `2026-09-${String(20 + n).padStart(2, '0')}`;
    expect(checkFeature('lessons', 'free', usage({ firstSeenDay: '2026-09-20', today: lastGraceDay, newLessonsToday: 7 })).reason).toBe('grace_period');
    expect(checkFeature('lessons', 'free', usage({ firstSeenDay: '2026-09-20', today: firstLimitedDay, newLessonsToday: 1 })).allowed).toBe(false);
  });
});

describe('checkLessonStart', () => {
  const base = { tier: 'free' as const, usage: usage({ newLessonsToday: 1 }), completedLessonIds: ['u2-l1'] };
  it('replays are always free', () => {
    expect(checkLessonStart({ id: 'u2-l1', unitId: 'u2' }, base)).toEqual({ allowed: true, reason: 'replay' });
  });
  it('always-free units bypass the daily limit', () => {
    expect(checkLessonStart({ id: 'u1-l2', unitId: LESSON_RULES.alwaysFreeUnitIds[0] }, base).reason).toBe('always_free_content');
  });
  it('new lesson in another unit is blocked when the day is used up', () => {
    expect(checkLessonStart({ id: 'u2-l2', unitId: 'u2' }, base).allowed).toBe(false);
    expect(checkLessonStart({ id: 'u2-l2', unitId: 'u2' }, { ...base, tier: 'pro' }).allowed).toBe(true);
  });
});

describe('counting and paywall timing', () => {
  it('counts only lessons first completed today', () => {
    expect(newLessonsOn({ a: '2026-09-20', b: '2026-09-19', c: '2026-09-20' }, '2026-09-20')).toBe(2);
  });
  it('never presents a paywall mid-lesson, nor to pro', () => {
    expect(canPresentPaywall({ lessonInProgress: true, tier: 'free' })).toBe(false);
    expect(canPresentPaywall({ lessonInProgress: false, tier: 'pro' })).toBe(false);
    expect(canPresentPaywall({ lessonInProgress: false, tier: 'free' })).toBe(true);
  });
  it('expired cached pro falls back to free', () => {
    const snap = { ...FREE_SNAPSHOT, tier: 'pro' as const, expiresAt: '2026-01-01T00:00:00Z' };
    expect(effectiveTier(snap, Date.parse('2026-02-01'))).toBe('free');
    expect(effectiveTier(snap, Date.parse('2025-12-01'))).toBe('pro');
  });
});

describe('MockPurchasesAdapter', () => {
  it('annual purchase starts a 7-day trial and grants pro', async () => {
    let now = Date.parse('2026-09-20T12:00:00Z');
    const saved: unknown[] = [];
    const m = new MockPurchasesAdapter({ now: () => now, save: (r) => saved.push(r) });
    expect((await m.getEntitlement()).tier).toBe('free');
    const r = await m.purchase('pro_annual');
    expect(r.status).toBe('purchased');
    expect(r.entitlement).toMatchObject({ tier: 'pro', isTrial: true, planId: 'pro_annual' });
    expect(saved).toHaveLength(1);
    now += 8 * 86_400_000;
    expect((await m.restore()).isTrial).toBe(false);
  });
  it('monthly has no trial; cancelled purchase grants nothing', async () => {
    const m = new MockPurchasesAdapter({ nextOutcome: 'cancelled' });
    expect((await m.purchase('pro_monthly')).entitlement.tier).toBe('free');
    const r = await m.purchase('pro_monthly');
    expect(r.entitlement).toMatchObject({ tier: 'pro', isTrial: false });
    expect(mockSnapshot(null, 0).tier).toBe('free');
  });
});

describe('rewarded heart', () => {
  it('adds one heart, capped at 5', () => {
    expect(grantOneHeart({ count: 0, regenFrom: 1000 }, 1000)).toEqual({ count: 1, regenFrom: 1000 });
    expect(grantOneHeart({ count: 4, regenFrom: 1000 }, 1000)).toEqual({ count: 5, regenFrom: null });
    expect(grantOneHeart({ count: 5, regenFrom: null }, 1000)).toEqual({ count: 5, regenFrom: null });
  });
});

describe('screener presets', () => {
  it('free gets the first presets, pro gets all', () => {
    expect(isPresetFree('any', 0, 'free')).toBe(true);
    expect(isPresetFree('any', 99, 'free')).toBe(false);
    expect(isPresetFree('any', 99, 'pro')).toBe(true);
  });
});

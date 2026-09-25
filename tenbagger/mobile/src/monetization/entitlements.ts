/**
 * Entitlement + free-tier limit logic. PURE (no React, no store) so it is unit-tested and
 * shared by hooks, ProGate and the lesson gate. All numbers come from src/config/monetization.ts.
 */
import { FREE_LIMITS, FREE_SCREENER_PRESET_COUNT, FREE_SCREENER_PRESET_IDS, LESSON_RULES, type Feature, type PlanId } from '../config/monetization';
import { daysBetween, toDayKey } from '../game/day';

export type Tier = 'free' | 'pro';

/** Normalized view of the user's subscription (from RevenueCat or the mock adapter). */
export type EntitlementSnapshot = {
  tier: Tier;
  planId: PlanId | null;
  isTrial: boolean;
  /** ISO date; null for free or lifetime. */
  expiresAt: string | null;
  willRenew: boolean;
  source: 'mock' | 'revenuecat' | 'cache';
};

export const FREE_SNAPSHOT: EntitlementSnapshot = {
  tier: 'free',
  planId: null,
  isTrial: false,
  expiresAt: null,
  willRenew: false,
  source: 'cache',
};

/** Treat an expired cached snapshot as free (offline safety net). */
export function effectiveTier(snap: EntitlementSnapshot, now: number = Date.now()): Tier {
  if (snap.tier !== 'pro') return 'free';
  if (snap.expiresAt && Date.parse(snap.expiresAt) < now) return 'free';
  return 'pro';
}

/** What the limit engine needs to know about usage. */
export type Usage = {
  /** Distinct NEW lessons completed today (replays excluded). */
  newLessonsToday: number;
  /** Local day key (YYYY-MM-DD) of first launch, used for the onboarding grace period. */
  firstSeenDay: string | null;
  today: string;
  savedScreens: number;
  linkedAccounts: number;
};

export const EMPTY_USAGE = (today: string): Usage => ({
  newLessonsToday: 0,
  firstSeenDay: today,
  today,
  savedScreens: 0,
  linkedAccounts: 0,
});

export type GateReason =
  | 'pro' // allowed because the user is Pro
  | 'free_feature' // allowed for everyone
  | 'within_free_limit'
  | 'grace_period' // lessons unlimited during the first days
  | 'always_free_content'
  | 'replay'
  | 'pro_only'
  | 'limit_reached';

export type GateResult = {
  allowed: boolean;
  reason: GateReason;
  /** Free limit, when the feature is metered. */
  limit?: number;
  used?: number;
  /** Remaining free uses (never negative). */
  remaining?: number;
};

export function inLessonGracePeriod(usage: Pick<Usage, 'firstSeenDay' | 'today'>): boolean {
  if (!usage.firstSeenDay || LESSON_RULES.unlimitedFirstDays <= 0) return false;
  return daysBetween(usage.firstSeenDay, usage.today) < LESSON_RULES.unlimitedFirstDays;
}

function usedFor(feature: Feature, usage: Usage): number {
  switch (feature) {
    case 'lessons':
      return usage.newLessonsToday;
    case 'saved_screens':
      return usage.savedScreens;
    case 'money_accounts':
      return usage.linkedAccounts;
    default:
      return 0;
  }
}

/**
 * Can the user do one MORE of `feature`? (e.g. start another new lesson, save another screen,
 * link another account). For boolean features, "used" is irrelevant.
 */
export function checkFeature(feature: Feature, tier: Tier, usage: Usage): GateResult {
  if (tier === 'pro') return { allowed: true, reason: 'pro' };
  const rule = FREE_LIMITS[feature];
  if (rule === true) return { allowed: true, reason: 'free_feature' };
  if (rule === false) return { allowed: false, reason: 'pro_only' };
  if (feature === 'lessons' && inLessonGracePeriod(usage)) return { allowed: true, reason: 'grace_period' };
  const used = usedFor(feature, usage);
  const remaining = Math.max(0, rule - used);
  return { allowed: remaining > 0, reason: remaining > 0 ? 'within_free_limit' : 'limit_reached', limit: rule, used, remaining };
}

/**
 * Can the user START this lesson? Checked only at lesson start, never mid-lesson.
 * Replays and always-free units bypass the daily limit.
 */
export function checkLessonStart(
  lesson: { id: string; unitId?: string | null },
  opts: { tier: Tier; usage: Usage; completedLessonIds: Iterable<string> },
): GateResult {
  if (opts.tier === 'pro') return { allowed: true, reason: 'pro' };
  const completed = new Set(opts.completedLessonIds);
  if (LESSON_RULES.replaysFree && completed.has(lesson.id)) return { allowed: true, reason: 'replay' };
  if (lesson.unitId && LESSON_RULES.alwaysFreeUnitIds.includes(lesson.unitId)) return { allowed: true, reason: 'always_free_content' };
  return checkFeature('lessons', opts.tier, opts.usage);
}

/**
 * Count distinct lessons first completed on `day` from a log of first-completion days.
 * (The monetization store records a lesson's day the first time it appears in `completed`.)
 */
export function newLessonsOn(firstCompletionDay: Record<string, string>, day: string): number {
  let n = 0;
  for (const d of Object.values(firstCompletionDay)) if (d === day) n++;
  return n;
}

/** Local day key helper re-exported for callers that only import monetization. */
export const dayKey = (ms: number = Date.now()) => toDayKey(new Date(ms));

/** Paywalls must never interrupt a lesson in progress (spec: never mid-question). */
export function canPresentPaywall(ctx: { lessonInProgress: boolean; tier: Tier }): boolean {
  return !ctx.lessonInProgress && ctx.tier !== 'pro';
}

/** Is this screener preset open to free users? (by id list, else the first N presets) */
export function isPresetFree(presetId: string, index: number, tier: Tier): boolean {
  if (tier === 'pro' || FREE_LIMITS.screener_presets_all === true) return true;
  if (FREE_SCREENER_PRESET_IDS.length) return FREE_SCREENER_PRESET_IDS.includes(presetId);
  return index < FREE_SCREENER_PRESET_COUNT;
}

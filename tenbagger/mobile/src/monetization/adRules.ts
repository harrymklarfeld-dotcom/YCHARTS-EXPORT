/**
 * Ad eligibility. PURE: AdSlot, the rewarded-heart button and tests all call adEligibility().
 *
 * Rules (and why):
 *  1. No ads for Pro. Ad-free is part of what people pay for.
 *  2. Never on screens with personal financial data (Money hub, bank linking, anything showing
 *     balances/bills). Ads beside a user's own money read as endorsement, invite lenders to target
 *     cash-strapped users, and put an ad SDK next to GLBA-covered data.
 *  3. Never inside lessons/practice: no interstitials, no banners mid-question. Learning first.
 *  4. Allowed: a native/banner slot at the end of an article, banners between screener results,
 *     and an OPTIONAL rewarded ad to refill a heart that only plays after an explicit tap.
 *  5. Frequency caps per placement and per day come from config.
 *
 * Finance ad policy note: we are the *publisher*. Google/Meta financial-services advertiser
 * verification applies to advertisers, but we still block sensitive categories in the AdMob
 * console (Blocking controls): personal loans, payday/cash advance, crypto, "get rich quick",
 * gambling. That is configured in AdMob, not in code.
 */
import {
  AD_PLACEMENTS,
  ADS_MAX_IMPRESSIONS_PER_DAY,
  FLAGS,
  FORBIDDEN_AD_CONTEXTS,
  type AdContext,
  type AdPlacement,
} from '../config/monetization';
import type { Tier } from './entitlements';

/** Impression log: epoch ms per placement (trimmed to the last ~2 days by the store). */
export type AdImpressionLog = Partial<Record<AdPlacement, number[]>>;

export type AdRequest = {
  placement: AdPlacement;
  context: AdContext;
  tier: Tier;
  now: number;
  /** Local-day start (epoch ms) for daily caps. */
  dayStart: number;
  log: AdImpressionLog;
  /** Screener: index of this slot within the current list (0-based). */
  slotIndex?: number;
  /** Rewarded: the user tapped a button to ask for it. */
  userInitiated?: boolean;
  /** Test/QA override of FLAGS.adsEnabled. */
  adsEnabled?: boolean;
  /** A lesson/practice session is on screen (defensive, in case context is mislabeled). */
  lessonInProgress?: boolean;
};

export type AdDecision =
  | { ok: true }
  | {
      ok: false;
      reason:
        | 'ads_disabled'
        | 'pro'
        | 'forbidden_context'
        | 'lesson_in_progress'
        | 'placement_not_allowed_here'
        | 'needs_user_action'
        | 'screen_cap'
        | 'daily_cap'
        | 'global_daily_cap'
        | 'too_soon';
    };

export function adEligibility(req: AdRequest): AdDecision {
  const enabled = req.adsEnabled ?? FLAGS.adsEnabled;
  if (!enabled) return { ok: false, reason: 'ads_disabled' };
  if (req.tier === 'pro') return { ok: false, reason: 'pro' };
  if (FORBIDDEN_AD_CONTEXTS.includes(req.context)) return { ok: false, reason: 'forbidden_context' };

  const cfg = AD_PLACEMENTS[req.placement];
  // A lesson in progress blocks everything except the user-initiated heart refill on the
  // out-of-hearts screen (which is between questions, never mid-question).
  if (req.lessonInProgress && !(cfg.userInitiatedOnly && req.context === 'hearts_empty')) {
    return { ok: false, reason: 'lesson_in_progress' };
  }
  if (!cfg.allowedContexts.includes(req.context)) return { ok: false, reason: 'placement_not_allowed_here' };
  if (cfg.userInitiatedOnly && !req.userInitiated) return { ok: false, reason: 'needs_user_action' };
  if (cfg.maxPerScreen !== undefined && req.slotIndex !== undefined && req.slotIndex >= cfg.maxPerScreen) {
    return { ok: false, reason: 'screen_cap' };
  }

  const mine = (req.log[req.placement] ?? []).filter((t) => t >= req.dayStart);
  if (mine.length >= cfg.maxPerDay) return { ok: false, reason: 'daily_cap' };
  let total = 0;
  for (const list of Object.values(req.log)) total += (list ?? []).filter((t) => t >= req.dayStart).length;
  if (total >= ADS_MAX_IMPRESSIONS_PER_DAY) return { ok: false, reason: 'global_daily_cap' };
  const last = mine.length ? Math.max(...mine) : null;
  if (last !== null && cfg.minIntervalMinutes > 0 && req.now - last < cfg.minIntervalMinutes * 60_000) {
    return { ok: false, reason: 'too_soon' };
  }
  return { ok: true };
}

/**
 * Screener: after which result rows (0-based row index) to insert an ad slot.
 * e.g. everyNRows 8, maxPerScreen 2, 30 rows → [7, 15]. Never after the last row.
 */
export function screenerAdRowIndexes(rowCount: number): number[] {
  const cfg = AD_PLACEMENTS.screener_results;
  const n = cfg.everyNRows ?? 0;
  const max = cfg.maxPerScreen ?? 0;
  if (n <= 0 || max <= 0) return [];
  const out: number[] = [];
  for (let i = n - 1; i < rowCount - 1 && out.length < max; i += n) out.push(i);
  return out;
}

/** Drop impressions older than 2 days so persisted state stays tiny. */
export function trimLog(log: AdImpressionLog, now: number): AdImpressionLog {
  const cutoff = now - 2 * 86_400_000;
  const out: AdImpressionLog = {};
  for (const [k, v] of Object.entries(log) as [AdPlacement, number[] | undefined][]) {
    const kept = (v ?? []).filter((t) => t >= cutoff);
    if (kept.length) out[k] = kept;
  }
  return out;
}

/** Non-personalized unless config opts in AND the user consented (UMP) AND ATT allows it. */
export function shouldRequestNonPersonalized(consent: { personalizedAllowed: boolean }): boolean {
  return !(FLAGS.personalizedAds && consent.personalizedAllowed);
}

import { AD_PLACEMENTS, ADS_MAX_IMPRESSIONS_PER_DAY, FORBIDDEN_AD_CONTEXTS, type AdContext, type AdPlacement } from '../../config/monetization';
import { adEligibility, screenerAdRowIndexes, shouldRequestNonPersonalized, trimLog, type AdRequest } from '../adRules';

const NOW = Date.parse('2026-09-20T15:00:00Z');
const DAY = Date.parse('2026-09-20T00:00:00Z');
const req = (over: Partial<AdRequest> = {}): AdRequest => ({
  placement: 'article_end',
  context: 'article',
  tier: 'free',
  now: NOW,
  dayStart: DAY,
  log: {},
  adsEnabled: true,
  ...over,
});

const placements = Object.keys(AD_PLACEMENTS) as AdPlacement[];

describe('adEligibility', () => {
  it('allows an article-end ad for a free user', () => {
    expect(adEligibility(req())).toEqual({ ok: true });
  });

  it('NEVER for pro, on any placement or context', () => {
    for (const placement of placements) {
      for (const context of AD_PLACEMENTS[placement].allowedContexts) {
        expect(adEligibility(req({ placement, context, tier: 'pro', userInitiated: true }))).toEqual({ ok: false, reason: 'pro' });
      }
    }
  });

  it('NEVER on money / bank-linking / personal-finance / lesson screens, whatever the placement', () => {
    const banned: AdContext[] = ['money_hub', 'bank_linking', 'personal_finance', 'lesson', 'practice'];
    for (const c of banned) expect(FORBIDDEN_AD_CONTEXTS).toContain(c);
    for (const placement of placements) {
      for (const context of banned) {
        expect(adEligibility(req({ placement, context, userInitiated: true })).ok).toBe(false);
      }
    }
  });

  it('no banner while a lesson is in progress even if the context is mislabeled', () => {
    expect(adEligibility(req({ lessonInProgress: true }))).toEqual({ ok: false, reason: 'lesson_in_progress' });
  });

  it('placements stay in their own screens', () => {
    expect(adEligibility(req({ placement: 'article_end', context: 'screener' })).ok).toBe(false);
    expect(adEligibility(req({ placement: 'screener_results', context: 'screener', slotIndex: 0 })).ok).toBe(true);
  });

  it('rewarded heart: user-initiated only, allowed on out-of-hearts screen mid-session', () => {
    const r = { placement: 'heart_refill' as const, context: 'hearts_empty' as const };
    expect(adEligibility(req(r))).toEqual({ ok: false, reason: 'needs_user_action' });
    expect(adEligibility(req({ ...r, userInitiated: true }))).toEqual({ ok: true });
    expect(adEligibility(req({ ...r, userInitiated: true, lessonInProgress: true }))).toEqual({ ok: true });
  });

  it('frequency caps: per day, min interval, per screen, global', () => {
    const cfg = AD_PLACEMENTS.heart_refill;
    const r = { placement: 'heart_refill' as const, context: 'hearts_empty' as const, userInitiated: true };
    const recent = NOW - (cfg.minIntervalMinutes - 1) * 60_000;
    expect(adEligibility(req({ ...r, log: { heart_refill: [recent] } }))).toEqual({ ok: false, reason: 'too_soon' });
    const many = Array.from({ length: cfg.maxPerDay }, (_, i) => DAY + i * 3_600_000);
    expect(adEligibility(req({ ...r, log: { heart_refill: many } }))).toEqual({ ok: false, reason: 'daily_cap' });
    // yesterday's impressions don't count
    expect(adEligibility(req({ ...r, log: { heart_refill: many.map((t) => t - 86_400_000) } })).ok).toBe(true);

    const max = AD_PLACEMENTS.screener_results.maxPerScreen!;
    expect(adEligibility(req({ placement: 'screener_results', context: 'screener', slotIndex: max })).ok).toBe(false);

    const lots = Array.from({ length: ADS_MAX_IMPRESSIONS_PER_DAY }, () => DAY + 1);
    expect(adEligibility(req({ log: { screener_results: lots } }))).toEqual({ ok: false, reason: 'global_daily_cap' });
  });

  it('master switch off', () => {
    expect(adEligibility(req({ adsEnabled: false }))).toEqual({ ok: false, reason: 'ads_disabled' });
  });
});

describe('helpers', () => {
  it('screener slots every N rows, capped, never after the last row', () => {
    const { everyNRows = 8, maxPerScreen = 2 } = AD_PLACEMENTS.screener_results;
    expect(screenerAdRowIndexes(everyNRows)).toEqual([]);
    expect(screenerAdRowIndexes(100)).toHaveLength(maxPerScreen);
    expect(screenerAdRowIndexes(100)[0]).toBe(everyNRows - 1);
  });
  it('trims old impressions', () => {
    expect(trimLog({ article_end: [NOW - 3 * 86_400_000, NOW] }, NOW)).toEqual({ article_end: [NOW] });
  });
  it('non-personalized by default', () => {
    expect(shouldRequestNonPersonalized({ personalizedAllowed: true })).toBe(true);
  });
});

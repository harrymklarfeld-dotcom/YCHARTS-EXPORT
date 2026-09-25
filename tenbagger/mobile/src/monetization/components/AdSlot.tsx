/**
 * <AdSlot placement="article_end" context="article" />
 * Renders NOTHING unless adEligibility() allows it (free user, allowed screen, under caps,
 * consent permits). Always labelled "Advertisement". Decision is taken once per mount so an
 * impression that hits a cap doesn't make the slot vanish mid-read.
 */
import { useCallback, useMemo, useRef } from 'react';
import { Text, View } from 'react-native';
import { AD_PLACEMENTS, type AdContext, type AdPlacement } from '../../config/monetization';
import { useTheme } from '../../theme';
import { adEligibility, shouldRequestNonPersonalized } from '../adRules';
import { track } from '../analytics';
import { useEntitlement } from '../hooks';
import { getAds } from '../runtime';
import { useMonetization } from '../store';

function startOfLocalDay(now: number) {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export function AdSlot({ placement, context, slotIndex }: { placement: AdPlacement; context?: AdContext; slotIndex?: number }) {
  const t = useTheme();
  const { tier } = useEntitlement();
  const consent = useMonetization((s) => s.consent);
  const lessonInProgress = useMonetization((s) => s.lessonInProgress);
  const cfg = AD_PLACEMENTS[placement];
  const ctx: AdContext = context ?? cfg.allowedContexts[0];
  const mountedAt = useRef(Date.now()).current;

  const decision = useMemo(() => {
    const now = mountedAt;
    return adEligibility({
      placement,
      context: ctx,
      tier,
      now,
      dayStart: startOfLocalDay(now),
      log: useMonetization.getState().adLog,
      slotIndex,
      lessonInProgress,
    });
  }, [placement, ctx, tier, slotIndex, lessonInProgress, mountedAt]);

  const onImpression = useCallback(() => {
    useMonetization.getState().recordAdImpression(placement);
    track('ad_impression', { placement, format: cfg.format, network: getAds().kind });
  }, [placement, cfg.format]);
  const onFail = useCallback((message: string) => track('ad_failed', { placement, error: message }), [placement]);

  if (!decision.ok || !consent.canRequestAds || cfg.format === 'rewarded') return null;
  const { AdView } = getAds();
  return (
    <View style={{ gap: 4, marginVertical: 8 }} accessibilityLabel="Advertisement">
      <Text style={{ color: t.c.inkSoft, fontSize: 10, fontWeight: '800', letterSpacing: 1 }}>ADVERTISEMENT</Text>
      <AdView
        placement={placement}
        format={cfg.format}
        nonPersonalized={shouldRequestNonPersonalized(consent)}
        onImpression={onImpression}
        onFail={onFail}
      />
    </View>
  );
}

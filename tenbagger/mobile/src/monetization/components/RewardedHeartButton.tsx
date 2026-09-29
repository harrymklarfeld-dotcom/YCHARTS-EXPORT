/**
 * Optional "Watch a short ad for +1 heart" on the out-of-hearts screen. User-initiated only:
 * nothing plays until the button is tapped. Hidden for Pro, when capped, or when the build has
 * no rewarded ads. Hearts are never sold.
 */
import { useState } from 'react';
import { FLAGS } from '../../config/monetization';
import { Button } from '../../components/ui';
import { useApp } from '../../state/store';
import { adEligibility, shouldRequestNonPersonalized } from '../adRules';
import { track } from '../analytics';
import { grantOneHeart } from '../hearts';
import { useEntitlement } from '../hooks';
import { getAds } from '../runtime';
import { useMonetization } from '../store';

export function RewardedHeartButton({ onEarned }: { onEarned?: () => void }) {
  const { tier } = useEntitlement();
  const adLog = useMonetization((s) => s.adLog);
  const consent = useMonetization((s) => s.consent);
  const [state, setState] = useState<'idle' | 'loading' | 'unavailable'>('idle');
  const now = Date.now();
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  const decision = adEligibility({
    placement: 'heart_refill',
    context: 'hearts_empty',
    tier,
    now,
    dayStart: d.getTime(),
    log: adLog,
    userInitiated: true,
  });
  if (!FLAGS.rewardedHeartEnabled || !decision.ok || !consent.canRequestAds || !getAds().rewardedAvailable) return null;

  return (
    <Button
      variant="secondary"
      label={state === 'loading' ? 'Loading ad…' : state === 'unavailable' ? 'No ad available right now' : 'Watch a short ad for +1 heart'}
      disabled={state !== 'idle'}
      onPress={async () => {
        setState('loading');
        const outcome = await getAds().showRewarded('heart_refill', shouldRequestNonPersonalized(consent));
        if (outcome === 'earned') {
          useMonetization.getState().recordAdImpression('heart_refill');
          track('ad_impression', { placement: 'heart_refill', format: 'rewarded', network: getAds().kind });
          track('rewarded_earned', { placement: 'heart_refill' });
          useApp.setState((s) => ({ hearts: grantOneHeart(s.hearts, Date.now()) }));
          setState('idle');
          onEarned?.();
        } else {
          setState(outcome === 'unavailable' ? 'unavailable' : 'idle');
        }
      }}
    />
  );
}

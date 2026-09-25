/**
 * AdMob adapter (react-native-google-mobile-ads). Needs an EAS dev/production build and the
 * config plugin in app.json (see ../INTEGRATION.md). Unit ids default to Google's TEST ids.
 * "native" placements use a MEDIUM_RECTANGLE banner in v1 (a true NativeAdView layout can come later).
 */
import { useState } from 'react';
import { Platform, View } from 'react-native';
import { AD_UNIT_IDS, type AdPlacement } from '../../config/monetization';
import type { AdsAdapter, AdViewProps, RewardedOutcome } from './AdsAdapter';
import { runConsentFlow } from './consent';

type GMA = typeof import('react-native-google-mobile-ads');

function unitIds() {
  return Platform.OS === 'ios' ? AD_UNIT_IDS.ios : AD_UNIT_IDS.android;
}

export function createAdMobAdapter(): AdsAdapter | null {
  let gma: GMA;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    gma = require('react-native-google-mobile-ads') as GMA;
  } catch {
    return null;
  }
  const { BannerAd, BannerAdSize, RewardedAd, RewardedAdEventType, AdEventType } = gma;

  function AdView({ format, nonPersonalized, onImpression, onFail }: AdViewProps) {
    const [failed, setFailed] = useState(false);
    if (failed) return null;
    return (
      <View style={{ alignItems: 'center' }}>
        <BannerAd
          unitId={unitIds().banner}
          size={format === 'native' ? BannerAdSize.MEDIUM_RECTANGLE : BannerAdSize.ANCHORED_ADAPTIVE_BANNER}
          requestOptions={{ requestNonPersonalizedAdsOnly: nonPersonalized }}
          onAdImpression={onImpression}
          onAdFailedToLoad={(e) => {
            setFailed(true);
            onFail(e.message);
          }}
        />
      </View>
    );
  }

  return {
    kind: 'admob',
    rewardedAvailable: true,
    AdView,
    async init() {
      const consent = await runConsentFlow();
      if (consent.canRequestAds) {
        // Finance: keep content rating conservative; category blocking is done in the AdMob console.
        await gma.default().setRequestConfiguration({ maxAdContentRating: gma.MaxAdContentRating.PG });
        await gma.default().initialize();
      }
      return consent;
    },
    showRewarded(_placement: AdPlacement, nonPersonalized: boolean) {
      return new Promise<RewardedOutcome>((resolve) => {
        const ad = RewardedAd.createForAdRequest(unitIds().rewarded, { requestNonPersonalizedAdsOnly: nonPersonalized });
        let earned = false;
        const unsubs = [
          ad.addAdEventListener(RewardedAdEventType.LOADED, () => ad.show()),
          ad.addAdEventListener(RewardedAdEventType.EARNED_REWARD, () => {
            earned = true;
          }),
          ad.addAdEventListener(AdEventType.CLOSED, () => {
            unsubs.forEach((u) => u());
            resolve(earned ? 'earned' : 'dismissed');
          }),
          ad.addAdEventListener(AdEventType.ERROR, () => {
            unsubs.forEach((u) => u());
            resolve('unavailable');
          }),
        ];
        ad.load();
      });
    },
  };
}

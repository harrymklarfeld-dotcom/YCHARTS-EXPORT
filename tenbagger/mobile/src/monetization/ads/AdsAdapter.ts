/**
 * Ads abstraction. The app only talks to this interface:
 *  - AdMob adapter (googleAds.native.tsx) on iOS/Android dev/production builds
 *  - MockAdsAdapter on web, Expo Go and jest
 * Eligibility (who/where/how often) is decided in ../adRules.ts BEFORE any adapter is called.
 */
import type { ComponentType } from 'react';
import type { AdFormat, AdPlacement } from '../../config/monetization';

export type ConsentState = {
  /** UMP says we may request ads at all (false → render nothing). */
  canRequestAds: boolean;
  /** User consented to personalized ads (UMP) and, on iOS, ATT is authorized. */
  personalizedAllowed: boolean;
};

export const DEFAULT_CONSENT: ConsentState = { canRequestAds: true, personalizedAllowed: false };

export type AdViewProps = {
  placement: AdPlacement;
  format: Exclude<AdFormat, 'rewarded'>;
  nonPersonalized: boolean;
  onImpression: () => void;
  onFail: (message: string) => void;
};

export type RewardedOutcome = 'earned' | 'dismissed' | 'unavailable';

export interface AdsAdapter {
  readonly kind: 'mock' | 'admob';
  /** Runs the consent flow (UMP, then ATT if configured) and initializes the SDK. */
  init(): Promise<ConsentState>;
  /** Banner/native view; renders nothing when no fill. */
  AdView: ComponentType<AdViewProps>;
  /** Whether rewarded ads can be offered at all in this build. */
  readonly rewardedAvailable: boolean;
  showRewarded(placement: AdPlacement, nonPersonalized: boolean): Promise<RewardedOutcome>;
}

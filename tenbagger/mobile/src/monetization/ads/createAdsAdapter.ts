import { isRunningInExpoGo } from 'expo';
import type { AdsAdapter } from './AdsAdapter';
import { createAdMobAdapter } from './googleAds';
import { MockAdsAdapter } from './MockAdsAdapter';

/** AdMob on native dev/prod builds; mock on web, Expo Go and jest. */
export function createAdsAdapter(): AdsAdapter {
  const isTest = typeof process !== 'undefined' && process.env.NODE_ENV === 'test';
  if (!isTest && !isRunningInExpoGo()) {
    const real = createAdMobAdapter();
    if (real) return real;
  }
  return new MockAdsAdapter();
}

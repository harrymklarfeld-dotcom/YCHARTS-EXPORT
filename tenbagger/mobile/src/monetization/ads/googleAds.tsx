/** Web / default: AdMob is native-only. createAdsAdapter() falls back to the mock. */
import type { AdsAdapter } from './AdsAdapter';

export function createAdMobAdapter(): AdsAdapter | null {
  return null;
}

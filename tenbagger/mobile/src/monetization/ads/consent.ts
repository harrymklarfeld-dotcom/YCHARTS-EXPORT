/** Web / default: no UMP or ATT. Non-personalized by default. */
import { DEFAULT_CONSENT, type ConsentState } from './AdsAdapter';

export async function runConsentFlow(): Promise<ConsentState> {
  return DEFAULT_CONSENT;
}

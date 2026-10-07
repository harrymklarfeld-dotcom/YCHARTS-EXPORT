/**
 * Consent flow stub for iOS/Android dev/production builds.
 *  1. Google UMP (GDPR/US-state privacy): requestInfoUpdate → show the form only if required.
 *  2. iOS App Tracking Transparency: ONLY if FLAGS.personalizedAds && FLAGS.requestTrackingAuthorization.
 *     By default we serve non-personalized ads, so we never show the ATT prompt (and the
 *     NSUserTrackingUsageDescription string is not needed until that flag flips).
 * Either step failing leaves us on non-personalized ads.
 */
import { Platform } from 'react-native';
import { FLAGS } from '../../config/monetization';
import { DEFAULT_CONSENT, type ConsentState } from './AdsAdapter';

export async function runConsentFlow(): Promise<ConsentState> {
  let canRequestAds = true;
  let umpPersonalized = false;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { AdsConsent } = require('react-native-google-mobile-ads') as typeof import('react-native-google-mobile-ads');
    await AdsConsent.requestInfoUpdate();
    const info = await AdsConsent.loadAndShowConsentFormIfRequired();
    canRequestAds = info.canRequestAds;
    if (FLAGS.personalizedAds) {
      const choices = await AdsConsent.getUserChoices();
      umpPersonalized = !!choices.selectPersonalisedAds;
    }
  } catch {
    return DEFAULT_CONSENT;
  }

  let attOk = Platform.OS !== 'ios';
  if (Platform.OS === 'ios' && FLAGS.personalizedAds && FLAGS.requestTrackingAuthorization) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const att = require('expo-tracking-transparency') as typeof import('expo-tracking-transparency');
      const { granted } = await att.requestTrackingPermissionsAsync();
      attOk = granted;
    } catch {
      attOk = false;
    }
  }
  return { canRequestAds, personalizedAllowed: FLAGS.personalizedAds && umpPersonalized && attOk };
}

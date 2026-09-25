/**
 * Expo app config (replaces app.json). The single place for the app's name, ids and version.
 *
 * ── Edit these constants, or override them with env vars (EAS build profiles set them) ──
 *   APP_NAME            display name under the icon (≤ 30 chars for the App Store)
 *   APP_VERSION         marketing version shown in the stores (semver)
 *   BUNDLE_ID           iOS bundleIdentifier AND Android package. Placeholder until the LLC exists.
 *                       Cannot be changed after the first store upload, so pick it once.
 *   APP_ENV             development | preview | production (set per profile in eas.json)
 *
 * Build numbers: eas.json uses `"appVersionSource": "remote"` + `autoIncrement`, so EAS owns
 * ios.buildNumber / android.versionCode. The values below are only used for local
 * `npx expo run:*` builds and can be overridden with IOS_BUILD_NUMBER / ANDROID_VERSION_CODE.
 *
 * Monetization toggles (ads mode, ATT) must match src/config/monetization.ts → FLAGS.
 * See store/README.md for how each decision below maps to the store forms.
 */
import type { ConfigContext, ExpoConfig } from 'expo/config';

// ─── The one place ───────────────────────────────────────────────────────────────────────────
const APP_NAME = process.env.APP_NAME ?? 'Tenbagger';
const APP_SLUG = 'tenbagger';
const APP_SCHEME = 'tenbagger';
const APP_VERSION = process.env.APP_VERSION ?? '0.1.0';
const BUNDLE_ID = process.env.BUNDLE_ID ?? 'com.YOURCOMPANY.tenbagger';
const IOS_BUILD_NUMBER = process.env.IOS_BUILD_NUMBER ?? '1';
const ANDROID_VERSION_CODE = Number(process.env.ANDROID_VERSION_CODE ?? '1');
/** EAS project id: written by `npx eas-cli@latest init`, or set EAS_PROJECT_ID. */
const EAS_PROJECT_ID = process.env.EAS_PROJECT_ID;
/** Expo account that owns the project (optional; set with `eas init`). */
const EAS_OWNER = process.env.EAS_OWNER;

type AppEnv = 'development' | 'preview' | 'production';
const APP_ENV = (process.env.APP_ENV ?? 'development') as AppEnv;

// ─── Ads ─────────────────────────────────────────────────────────────────────────────────────
/**
 * off           no ads; AD_ID permission removed on Android.
 * npa           non-personalized ads only (default; matches FLAGS.personalizedAds = false).
 *               No ATT prompt, NSPrivacyTracking = false.
 * personalized  personalized ads; adds the ATT usage string. Only if FLAGS.requestTrackingAuthorization.
 */
type AdsMode = 'off' | 'npa' | 'personalized';
const ADS_MODE = (process.env.ADS_MODE ?? 'npa') as AdsMode;
/**
 * AdMob *app* ids (not ad-unit ids). Defaults are Google's public sample app ids, safe for dev.
 * Production values come from EAS env vars ADMOB_IOS_APP_ID / ADMOB_ANDROID_APP_ID.
 * The plugin is always registered because the Google Mobile Ads SDK is linked whenever the
 * package is installed and crashes on launch without an app id.
 */
const ADMOB_IOS_APP_ID = process.env.ADMOB_IOS_APP_ID ?? 'ca-app-pub-3940256099942544~1458002511';
const ADMOB_ANDROID_APP_ID = process.env.ADMOB_ANDROID_APP_ID ?? 'ca-app-pub-3940256099942544~3347511713';

if (APP_ENV === 'production' && ADS_MODE !== 'off' && ADMOB_IOS_APP_ID.startsWith('ca-app-pub-3940256099942544')) {
  // Test app ids in a store build serve no revenue and look like a mistake to reviewers.
  console.warn('[app.config] Production build is using AdMob TEST app ids. Set ADMOB_IOS_APP_ID / ADMOB_ANDROID_APP_ID.');
}
if (APP_ENV === 'production' && BUNDLE_ID.includes('YOURCOMPANY')) {
  console.warn('[app.config] BUNDLE_ID is still the placeholder com.YOURCOMPANY.tenbagger.');
}

const TRACKING_USAGE =
  'Allow tracking to see ads that are more relevant to you. Tenbagger never shows ads during lessons or next to your own finances, and Pro is ad-free.';

// ─── iOS privacy manifest (PrivacyInfo.xcprivacy) ────────────────────────────────────────────
/**
 * Required-reason APIs: the union of what the linked pods declare in their own manifests
 * (checked in node_modules on Expo SDK 57):
 *   UserDefaults  CA92.1  react-native core, expo-constants (AsyncStorage persists via files)
 *   FileTimestamp C617.1  react-native core, @react-native-async-storage/async-storage
 *                 0A2A.1, 3B52.1  expo-file-system (pulled in by expo)
 *   DiskSpace     E174.1, 85F4.1  expo-file-system
 *   SystemBootTime 35F9.1 react-native (ReactCommon/timing)
 * Re-check after adding native deps:
 *   find node_modules -name PrivacyInfo.xcprivacy -not -path '*\/Pods/*'
 * Collected data types mirror store/app-store/privacy-labels.md.
 */
const collected = (type: string, linked: boolean, tracking: boolean, purposes: string[]) => ({
  NSPrivacyCollectedDataType: `NSPrivacyCollectedDataType${type}`,
  NSPrivacyCollectedDataTypeLinked: linked,
  NSPrivacyCollectedDataTypeTracking: tracking,
  NSPrivacyCollectedDataTypePurposes: purposes.map((p) => `NSPrivacyCollectedDataTypePurpose${p}`),
});
const adsOn = ADS_MODE !== 'off';
const tracks = ADS_MODE === 'personalized';

const privacyManifests = {
  NSPrivacyTracking: tracks,
  NSPrivacyTrackingDomains: [] as string[], // the Google Mobile Ads pod declares its own domains
  NSPrivacyCollectedDataTypes: [
    // RevenueCat: purchase receipts keyed to an anonymous app user id.
    collected('PurchaseHistory', false, false, ['AppFunctionality']),
    ...(adsOn
      ? [
          collected('DeviceID', false, tracks, ['ThirdPartyAdvertising']),
          collected('AdvertisingData', false, tracks, ['ThirdPartyAdvertising']),
          collected('ProductInteraction', false, tracks, ['ThirdPartyAdvertising', 'Analytics']),
          collected('CoarseLocation', false, tracks, ['ThirdPartyAdvertising']),
          collected('CrashData', false, false, ['AppFunctionality']),
          collected('PerformanceData', false, false, ['ThirdPartyAdvertising', 'Analytics']),
        ]
      : []),
  ],
  NSPrivacyAccessedAPITypes: [
    { NSPrivacyAccessedAPIType: 'NSPrivacyAccessedAPICategoryUserDefaults', NSPrivacyAccessedAPITypeReasons: ['CA92.1'] },
    {
      NSPrivacyAccessedAPIType: 'NSPrivacyAccessedAPICategoryFileTimestamp',
      NSPrivacyAccessedAPITypeReasons: ['C617.1', '0A2A.1', '3B52.1'],
    },
    { NSPrivacyAccessedAPIType: 'NSPrivacyAccessedAPICategoryDiskSpace', NSPrivacyAccessedAPITypeReasons: ['E174.1', '85F4.1'] },
    { NSPrivacyAccessedAPIType: 'NSPrivacyAccessedAPICategorySystemBootTime', NSPrivacyAccessedAPITypeReasons: ['35F9.1'] },
  ],
};

// ─── Plugins ─────────────────────────────────────────────────────────────────────────────────
/**
 * react-native-purchases (RevenueCat) needs NO config plugin: it autolinks. It does need a
 * development build (not Expo Go) and the In-App Purchase capability, which EAS enables
 * automatically for the bundle id when it creates credentials.
 */
const plugins: ExpoConfig['plugins'] = [
  'expo-router',
  [
    'react-native-google-mobile-ads',
    {
      iosAppId: ADMOB_IOS_APP_ID,
      androidAppId: ADMOB_ANDROID_APP_ID,
      // Wait for our consent/ATT flow before the SDK initialises measurement.
      delayAppMeasurementInit: true,
    },
  ],
  [
    'expo-tracking-transparency',
    // false removes NSUserTrackingUsageDescription: never ship the string unless we actually ask.
    { userTrackingPermission: tracks ? TRACKING_USAGE : false },
  ],
];

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: APP_ENV === 'production' ? APP_NAME : `${APP_NAME} (${APP_ENV === 'preview' ? 'Preview' : 'Dev'})`,
  slug: APP_SLUG,
  scheme: APP_SCHEME,
  version: APP_VERSION,
  ...(EAS_OWNER ? { owner: EAS_OWNER } : {}),
  orientation: 'portrait',
  icon: './assets/icon.png',
  userInterfaceStyle: 'automatic',
  splash: {
    image: './assets/splash-icon.png',
    resizeMode: 'contain',
    backgroundColor: '#F5F2EA',
  },
  // OTA updates: `eas update --channel <profile channel>`. Requires `npx expo install expo-updates`;
  // until then these keys are inert. appVersion policy = an OTA only reaches builds with the same
  // APP_VERSION, so bump APP_VERSION whenever native code or native config changes.
  runtimeVersion: { policy: 'appVersion' },
  ...(EAS_PROJECT_ID ? { updates: { url: `https://u.expo.dev/${EAS_PROJECT_ID}` } } : {}),
  ios: {
    bundleIdentifier: BUNDLE_ID,
    buildNumber: IOS_BUILD_NUMBER,
    // iPhone only for v1: no iPad layouts, no 13" iPad screenshots, no iPad review pass.
    // The app still runs on iPad in iPhone-compatibility mode. Revisit with a tablet layout.
    supportsTablet: false,
    config: {
      // No custom crypto; HTTPS only → exempt. Skips the export-compliance question per upload.
      usesNonExemptEncryption: false,
    },
    privacyManifests,
  },
  android: {
    package: BUNDLE_ID,
    versionCode: ANDROID_VERSION_CODE,
    adaptiveIcon: {
      backgroundColor: '#14213D',
      foregroundImage: './assets/android-icon-foreground.png',
      backgroundImage: './assets/android-icon-background.png',
      monochromeImage: './assets/android-icon-monochrome.png',
    },
    predictiveBackGestureEnabled: false,
    // Ads off → strip the advertising-id permission merged in by the ads/ATT SDKs, so the
    // Play Console "Advertising ID" declaration can honestly be "No".
    blockedPermissions: adsOn ? [] : ['com.google.android.gms.permission.AD_ID'],
  },
  web: {
    favicon: './assets/favicon.png',
    output: 'single',
    bundler: 'metro',
  },
  plugins,
  extra: {
    appEnv: APP_ENV,
    adsMode: ADS_MODE,
    ...(EAS_PROJECT_ID ? { eas: { projectId: EAS_PROJECT_ID } } : {}),
  },
});

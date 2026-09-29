/**
 * Mock ads for web, Expo Go and jest. In development it draws a labelled placeholder so layouts
 * can be checked; in a production web build it renders nothing (we do not run AdSense on web).
 */
import { useEffect } from 'react';
import { Text, View } from 'react-native';
import { useTheme } from '../../theme';
import { DEFAULT_CONSENT, type AdsAdapter, type AdViewProps, type RewardedOutcome } from './AdsAdapter';

const isDev = typeof __DEV__ !== 'undefined' && __DEV__;

function MockAdView({ format, onImpression }: AdViewProps) {
  const t = useTheme();
  useEffect(() => {
    if (isDev) onImpression();
  }, [onImpression]);
  if (!isDev) return null;
  return (
    <View
      accessibilityLabel="Advertisement placeholder"
      style={{
        height: format === 'native' ? 120 : 56,
        borderRadius: t.radius.sm,
        borderWidth: 1,
        borderStyle: 'dashed',
        borderColor: t.c.line,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: t.c.surfaceAlt,
      }}
    >
      <Text style={{ color: t.c.inkSoft, fontSize: 12, fontWeight: '700' }}>Ad · {format} placeholder (test mode)</Text>
    </View>
  );
}

export class MockAdsAdapter implements AdsAdapter {
  readonly kind = 'mock' as const;
  readonly rewardedAvailable = isDev;
  AdView = MockAdView;
  constructor(private rewardedOutcome: RewardedOutcome = 'earned') {}
  async init() {
    return DEFAULT_CONSENT;
  }
  async showRewarded(): Promise<RewardedOutcome> {
    if (!this.rewardedAvailable) return 'unavailable';
    await new Promise((r) => setTimeout(r, 400));
    return this.rewardedOutcome;
  }
}

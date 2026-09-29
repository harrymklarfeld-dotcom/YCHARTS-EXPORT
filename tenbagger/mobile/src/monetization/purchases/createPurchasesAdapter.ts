import { isRunningInExpoGo } from 'expo';
import { Platform } from 'react-native';
import { RC_KEYS } from '../../config/monetization';
import { MockPurchasesAdapter, type MockOptions } from './MockPurchasesAdapter';
import type { PurchasesAdapter } from './PurchasesAdapter';
import { createRevenueCatAdapter } from './revenueCat';

/**
 * Real RevenueCat on iOS/Android dev/prod builds with a key; the mock everywhere else
 * (web, Expo Go, jest, missing key).
 */
export function createPurchasesAdapter(mock: MockOptions = {}): PurchasesAdapter {
  const key = Platform.OS === 'ios' ? RC_KEYS.ios : Platform.OS === 'android' ? RC_KEYS.android : '';
  const isTest = typeof process !== 'undefined' && process.env.NODE_ENV === 'test';
  if (key && !isTest && !isRunningInExpoGo()) {
    const real = createRevenueCatAdapter(key);
    if (real) return real;
  }
  return new MockPurchasesAdapter(mock);
}

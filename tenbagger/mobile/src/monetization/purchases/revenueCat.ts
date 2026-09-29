/**
 * Web / default build: RevenueCat's native SDK is not bundled. createPurchasesAdapter() falls
 * back to the mock. The real adapter lives in revenueCat.native.ts (iOS/Android only).
 */
import type { PurchasesAdapter } from './PurchasesAdapter';

export function createRevenueCatAdapter(_apiKey: string): PurchasesAdapter | null {
  return null;
}

/**
 * Purchases abstraction. The app only talks to this interface:
 *  - RevenueCatPurchasesAdapter (native dev/production builds with an EXPO_PUBLIC_RC_* key)
 *  - MockPurchasesAdapter (web, Expo Go, jest, or no API key)
 */
import type { PlanId } from '../../config/monetization';
import type { EntitlementSnapshot } from '../entitlements';
import type { PlanPrice } from '../pricing';

export type StorePackage = {
  planId: PlanId;
  price: PlanPrice;
};

export type PurchaseStatus = 'purchased' | 'cancelled' | 'failed' | 'pending';

export type PurchaseResult = {
  status: PurchaseStatus;
  entitlement: EntitlementSnapshot;
  error?: string;
};

export interface PurchasesAdapter {
  readonly kind: 'mock' | 'revenuecat';
  init(): Promise<void>;
  /** Plans the store can sell right now, with localized prices. */
  getPackages(): Promise<StorePackage[]>;
  getEntitlement(): Promise<EntitlementSnapshot>;
  purchase(planId: PlanId): Promise<PurchaseResult>;
  /** Required by App Review: restore previous purchases on this store account. */
  restore(): Promise<EntitlementSnapshot>;
  /** Subscribe to entitlement changes (renewals, refunds, family sharing). Returns unsubscribe. */
  onChange(cb: (snap: EntitlementSnapshot) => void): () => void;
}

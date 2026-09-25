/** Adapter singletons, created once by <MonetizationProvider>. */
import type { AdsAdapter } from './ads/AdsAdapter';
import { MockAdsAdapter } from './ads/MockAdsAdapter';
import { MockPurchasesAdapter } from './purchases/MockPurchasesAdapter';
import type { PurchasesAdapter } from './purchases/PurchasesAdapter';

let purchases: PurchasesAdapter = new MockPurchasesAdapter();
let ads: AdsAdapter = new MockAdsAdapter();

export const getPurchases = () => purchases;
export const getAds = () => ads;
export function setAdapters(next: { purchases?: PurchasesAdapter; ads?: AdsAdapter }) {
  if (next.purchases) purchases = next.purchases;
  if (next.ads) ads = next.ads;
}

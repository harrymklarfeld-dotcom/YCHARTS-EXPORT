/**
 * RevenueCat adapter (iOS/Android). Requires an EAS development or production build:
 * Expo Go does not contain the store billing native code, so createPurchasesAdapter() uses the
 * mock there. Setup: create products in App Store Connect / Play Console, an entitlement "pro"
 * (PRO_ENTITLEMENT_ID) and a current offering with packages $rc_annual, $rc_monthly and
 * student_annual in RevenueCat, then set EXPO_PUBLIC_RC_IOS_KEY / EXPO_PUBLIC_RC_ANDROID_KEY.
 */
import type {
  CustomerInfo,
  PurchasesPackage,
  PurchasesStoreProduct,
} from 'react-native-purchases';
import { PLANS, PRO_ENTITLEMENT_ID, type PlanId } from '../../config/monetization';
import { FREE_SNAPSHOT, type EntitlementSnapshot } from '../entitlements';
import { formatMoney, type PlanPrice } from '../pricing';
import type { PurchaseResult, PurchasesAdapter, StorePackage } from './PurchasesAdapter';

type RCModule = typeof import('react-native-purchases');

function planForProduct(productId: string): PlanId | null {
  for (const p of Object.values(PLANS)) {
    // Android ids look like "tenbagger_pro_annual:annual" (product:basePlan)
    if (productId === p.storeProductId || productId.startsWith(`${p.storeProductId}:`)) return p.id;
  }
  return null;
}

export function snapshotFromCustomerInfo(info: CustomerInfo): EntitlementSnapshot {
  const ent = info.entitlements.active[PRO_ENTITLEMENT_ID];
  if (!ent || !ent.isActive) return { ...FREE_SNAPSHOT, source: 'revenuecat' };
  return {
    tier: 'pro',
    planId: planForProduct(ent.productIdentifier),
    isTrial: ent.periodType === 'TRIAL',
    expiresAt: ent.expirationDate,
    willRenew: ent.willRenew,
    source: 'revenuecat',
  };
}

function freeTrialDays(p: PurchasesStoreProduct): number {
  const intro = p.introPrice;
  if (!intro || intro.price !== 0) return 0;
  const n = intro.periodNumberOfUnits;
  switch (intro.periodUnit) {
    case 'DAY':
      return n;
    case 'WEEK':
      return n * 7;
    case 'MONTH':
      return n * 30;
    case 'YEAR':
      return n * 365;
    default:
      return 0;
  }
}

class RevenueCatPurchasesAdapter implements PurchasesAdapter {
  readonly kind = 'revenuecat' as const;
  private pkgs = new Map<PlanId, PurchasesPackage>();

  constructor(
    private rc: RCModule,
    private apiKey: string,
  ) {}

  private get P() {
    return this.rc.default;
  }

  async init() {
    // Anonymous app user id; log in with a real id once accounts exist (Purchases.logIn).
    this.P.configure({ apiKey: this.apiKey });
  }

  async getPackages(): Promise<StorePackage[]> {
    const offerings = await this.P.getOfferings();
    const current = offerings.current;
    if (!current) return [];
    const out: StorePackage[] = [];
    this.pkgs.clear();
    for (const plan of Object.values(PLANS)) {
      const pkg = current.availablePackages.find((x) => x.identifier === plan.rcPackageId);
      if (!pkg) continue;
      this.pkgs.set(plan.id, pkg);
      const pr = pkg.product;
      const price: PlanPrice = {
        planId: plan.id,
        amount: pr.price,
        currency: pr.currencyCode,
        priceString: pr.priceString || formatMoney(pr.price, pr.currencyCode),
        period: plan.period,
        // NB: Apple only grants the intro offer to eligible users; see
        // Purchases.checkTrialOrIntroductoryPriceEligibility before promising a trial.
        trialDays: freeTrialDays(pr),
      };
      out.push({ planId: plan.id, price });
    }
    return out;
  }

  async getEntitlement() {
    return snapshotFromCustomerInfo(await this.P.getCustomerInfo());
  }

  async purchase(planId: PlanId): Promise<PurchaseResult> {
    if (!this.pkgs.size) await this.getPackages();
    const pkg = this.pkgs.get(planId);
    if (!pkg) return { status: 'failed', entitlement: await this.getEntitlement(), error: 'Plan not available in this store' };
    try {
      const { customerInfo } = await this.P.purchasePackage(pkg);
      return { status: 'purchased', entitlement: snapshotFromCustomerInfo(customerInfo) };
    } catch (e: unknown) {
      const err = e as { userCancelled?: boolean | null; code?: string; message?: string };
      const cancelled = !!err.userCancelled || err.code === this.rc.PURCHASES_ERROR_CODE.PURCHASE_CANCELLED_ERROR;
      const pending = err.code === this.rc.PURCHASES_ERROR_CODE.PAYMENT_PENDING_ERROR;
      return {
        status: cancelled ? 'cancelled' : pending ? 'pending' : 'failed',
        entitlement: await this.getEntitlement().catch(() => ({ ...FREE_SNAPSHOT, source: 'revenuecat' as const })),
        error: cancelled ? undefined : err.message,
      };
    }
  }

  async restore() {
    return snapshotFromCustomerInfo(await this.P.restorePurchases());
  }

  onChange(cb: (s: EntitlementSnapshot) => void) {
    const listener = (info: CustomerInfo) => cb(snapshotFromCustomerInfo(info));
    this.P.addCustomerInfoUpdateListener(listener);
    return () => {
      this.P.removeCustomerInfoUpdateListener(listener);
    };
  }
}

export function createRevenueCatAdapter(apiKey: string): PurchasesAdapter | null {
  if (!apiKey) return null;
  try {
    // Lazy require so a missing native module (Expo Go) degrades to the mock instead of crashing.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const rc = require('react-native-purchases') as RCModule;
    return new RevenueCatPurchasesAdapter(rc, apiKey);
  } catch {
    return null;
  }
}

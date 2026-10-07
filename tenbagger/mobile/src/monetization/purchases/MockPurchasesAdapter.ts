/**
 * Simulated store: purchases succeed instantly and nothing is charged. Used on web, in Expo Go,
 * in tests, and whenever no RevenueCat key is configured. The paywall shows a "Test mode" note.
 */
import { PLANS, type PlanId } from '../../config/monetization';
import { FREE_SNAPSHOT, type EntitlementSnapshot } from '../entitlements';
import { fallbackPrice } from '../pricing';
import type { PurchaseResult, PurchasesAdapter, StorePackage } from './PurchasesAdapter';

export type MockPurchaseRecord = { planId: PlanId; purchasedAt: number } | null;

export type MockOptions = {
  initial?: MockPurchaseRecord;
  /** Persist the simulated purchase (the monetization store passes this). */
  save?: (rec: MockPurchaseRecord) => void;
  /** Force the next purchase outcome (tests / QA). */
  nextOutcome?: 'purchased' | 'cancelled' | 'failed';
  now?: () => number;
};

export function mockSnapshot(rec: MockPurchaseRecord, now: number): EntitlementSnapshot {
  if (!rec) return { ...FREE_SNAPSHOT, source: 'mock' };
  const plan = PLANS[rec.planId];
  const trialEnds = rec.purchasedAt + plan.trialDays * 86_400_000;
  const isTrial = plan.trialDays > 0 && now < trialEnds;
  const periodMs = (plan.period === 'year' ? 365 : 30) * 86_400_000;
  const expires = isTrial ? trialEnds : rec.purchasedAt + plan.trialDays * 86_400_000 + periodMs;
  return {
    tier: 'pro',
    planId: rec.planId,
    isTrial,
    expiresAt: new Date(expires).toISOString(),
    willRenew: true,
    source: 'mock',
  };
}

export class MockPurchasesAdapter implements PurchasesAdapter {
  readonly kind = 'mock' as const;
  private rec: MockPurchaseRecord;
  private listeners = new Set<(s: EntitlementSnapshot) => void>();
  nextOutcome: MockOptions['nextOutcome'];

  constructor(private opts: MockOptions = {}) {
    this.rec = opts.initial ?? null;
    this.nextOutcome = opts.nextOutcome;
  }

  private now() {
    return this.opts.now ? this.opts.now() : Date.now();
  }

  private emit() {
    const s = mockSnapshot(this.rec, this.now());
    this.listeners.forEach((l) => l(s));
  }

  async init() {}

  async getPackages(): Promise<StorePackage[]> {
    return (Object.keys(PLANS) as PlanId[]).map((planId) => ({ planId, price: fallbackPrice(planId) }));
  }

  async getEntitlement() {
    return mockSnapshot(this.rec, this.now());
  }

  async purchase(planId: PlanId): Promise<PurchaseResult> {
    const outcome = this.nextOutcome ?? 'purchased';
    this.nextOutcome = undefined;
    if (outcome !== 'purchased') {
      return { status: outcome, entitlement: mockSnapshot(this.rec, this.now()), error: outcome === 'failed' ? 'Simulated failure' : undefined };
    }
    this.rec = { planId, purchasedAt: this.now() };
    this.opts.save?.(this.rec);
    this.emit();
    return { status: 'purchased', entitlement: mockSnapshot(this.rec, this.now()) };
  }

  async restore() {
    return mockSnapshot(this.rec, this.now());
  }

  /** Test-mode only: forget the simulated purchase. */
  reset() {
    this.rec = null;
    this.opts.save?.(null);
    this.emit();
  }

  onChange(cb: (s: EntitlementSnapshot) => void) {
    this.listeners.add(cb);
    return () => {
      this.listeners.delete(cb);
    };
  }
}

/**
 * Public API of the monetization module. Other screens import ONLY from here:
 *   import { useEntitlement, useFeature, ProGate, AdSlot, OfferCard } from '../monetization';
 * See INTEGRATION.md for where each piece goes.
 */
export { MonetizationProvider } from './MonetizationProvider';
export {
  useEntitlement,
  useFeature,
  useLessonGate,
  useLessonInProgress,
  usePaywall,
  usePlans,
  usePurchaseActions,
  useUsage,
  type PaywallSource,
} from './hooks';
export { ProGate, ProLockCard } from './components/ProGate';
export { AdSlot } from './components/AdSlot';
export { RewardedHeartButton } from './components/RewardedHeartButton';
export { OfferCard } from './components/OfferCard';
export { useMonetization } from './store';
export { adEligibility, screenerAdRowIndexes } from './adRules';
export { checkFeature, checkLessonStart, effectiveTier, isPresetFree, type EntitlementSnapshot, type GateResult, type Tier } from './entitlements';
export { addAnalyticsSink, track, type MonetizationEvent } from './analytics';
export { validateOffers, offersFor } from './affiliate';

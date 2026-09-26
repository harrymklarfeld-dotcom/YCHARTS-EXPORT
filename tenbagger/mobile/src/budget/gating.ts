import type { Feature } from '../config/monetization';

/**
 * Basic budget (quick setup, safe-to-spend, paycheck plan, envelopes, goals, free insights) is free.
 * Advanced insights (payoff comparisons, subscriptions, free cash flow, income baseline) are Pro.
 *
 * The monetization config has no budget-specific Feature yet, so advanced insights ride on the
 * existing Pro-only `personal_10k` feature (same "your money, analysed" bundle). To split them,
 * add `'budget_insights'` to `Feature` / `FREE_LIMITS` in src/config/monetization.ts and change this line.
 */
export const BUDGET_PRO_FEATURE: Feature = 'personal_10k';

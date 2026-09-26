/**
 * Public API of the budget module. Other screens import ONLY from here:
 *   import { BudgetSummaryCard, SafeToSpendCard, useNeedsBudgetOnboarding } from '../budget';
 * See INTEGRATION.md.
 */
export { BudgetFirstLaunch } from './FirstLaunch';
export { BudgetInsights, BudgetSummaryCard, EnvelopeList, GoalList, InsightCard, InsightList, PaycheckPlanCard, SafeToSpendCard, SafeToSpendHero } from './components';
export { default as BudgetScreen } from './BudgetScreen';
export { useBudgetView, useNeedsBudgetOnboarding } from './hooks';
export { useBudgetStore } from './store';
export { buildView, shouldShowOnboarding, type LinkedBudgetData } from './model';
export { BUDGET_PRO_FEATURE } from './gating';

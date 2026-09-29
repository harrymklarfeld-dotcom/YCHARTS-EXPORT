/**
 * @tenbagger/budget — personal budgeting engine (pure TS, zero runtime deps).
 * Reuses @tenbagger/money (read-only) for dates, labels, income projection and card math.
 */
export type {
  Balances,
  Bill,
  BillKind,
  BudgetGoal,
  BudgetProfile,
  BudgetStyle,
  CardInfo,
  CategoryKind,
  Comfort,
  Disbursement,
  GoalKind,
  IncomeKind,
  IncomeSource,
  MathLine,
  SetupStep,
  SourceFrequency,
  SpendingCategory,
  Tightness,
} from './types.ts';

export {
  bufferFor,
  DEFAULT_BUFFER,
  DEFAULT_CATEGORIES,
  emptyProfile,
  freshStartMoment,
  FULL_PLAN_STEPS,
  hasIrregularIncome,
  quickSetup,
  recommendStyle,
  setupProgress,
  STEP_WEIGHTS,
  STYLES,
  validateProfile,
} from './setup.ts';
export type { QuickSetupInput, SetupProgress, StyleInfo } from './setup.ts';

export { completeMonths, conditionFor, incomeBaseline, percentile, plannedMonthly, projectedDeposits, toIncomeStreams } from './income.ts';
export type { IncomeBaseline, MonthIncome, SourceMonthly } from './income.ts';

export {
  billOccurrences,
  cardObligation,
  essentialsMonthly,
  goalByDate,
  goalCurrent,
  goalMonthly,
  goalTarget,
  goalTransfers,
  monthlyOccurrences,
  plannedCardPayment,
} from './obligations.ts';
export type { Obligation } from './obligations.ts';

export { fundObligations } from './allocate.ts';
export type { Funding, FundingResult } from './allocate.ts';

export { safeToSpend } from './safe.ts';
export type { SafeStatus, SafeToSpend, SafeToSpendOptions } from './safe.ts';

export { baseBuckets, buildMonthlyPlan, PYF_RATE } from './plan.ts';
export type { Group, MonthlyPlan, PlanBucket } from './plan.ts';

export { planPaychecks } from './paycheck.ts';
export type { PaycheckLine, PaycheckPlan, PaycheckPlanOptions } from './paycheck.ts';

export { BILL_CATEGORIES, envelopeFor, envelopeHistory, envelopes, nextCarry, spentByEnvelope, varianceReport } from './envelopes.ts';
export type { Envelope, EnvelopeOptions, EnvelopeStatus, VarianceReport, VarianceRow } from './envelopes.ts';

export { bufferProgress, goalTimeline, goalTimelines } from './goals.ts';
export type { BufferProgress, GoalTimeline } from './goals.ts';

export { replan, updateIncomeSource } from './replan.ts';
export type { PlanChange, Replan } from './replan.ts';

export { applyLinked, balancesFromSnapshot, hasTransactions, latestSnapshot, sourceFromStream } from './linked.ts';
export type { LinkedMoney } from './linked.ts';

export { budgetInsights, INSIGHT_LINKS, insightText, prettyMerchant } from './insights.ts';
export type { CompanyRatio, Insight, InsightInput, InsightLink, InsightType } from './insights.ts';

export { BUDGET_BANNED_PHRASES, findBudgetBannedPhrases, isBudgetVoice } from './language.ts';

export { buildBudget } from './budget.ts';
export type { Budget, BuildBudgetInput } from './budget.ts';

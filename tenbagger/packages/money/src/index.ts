export type {
  Account,
  AccountBasis,
  AccountKind,
  ExpectedDeposit,
  Grade,
  IncomeDeposit,
  IncomeKind,
  IncomeStream,
  ISODate,
  Labeled,
  Liability,
  NumberLabel,
  PayFrequency,
  Holding,
  HoldingKind,
  Snapshot,
  SnapshotLog,
  Transaction,
  Weekday,
  WorkSchedule,
} from './types.ts';

export {
  addDays,
  addMonthsClamped,
  dateOf,
  diffDays,
  fromDayNumber,
  isISODate,
  shortDate,
  daysInMonth,
  monthKey,
  toDayNumber,
  weekday,
  weekdayName,
} from './dates.ts';

export { formatPct, formatRatio, formatUSD, LABEL_TEXT, round2, weakestLabel } from './format.ts';
export { BANNED_PHRASES, findBannedPhrases, isEducational } from './language.ts';

export { projectIncome, scheduledMonthlyIncome, validateStream, nominalPayDate, PERIODS_PER_YEAR, weeksPerPeriod } from './income.ts';

export { coverageCheck } from './coverage.ts';
export type { CoverageOptions, CoverageReport, DueCheck, EquationStep, RunwayPoint, Verdict } from './coverage.ts';

export {
  cardTrend,
  debtToMonthlyIncome,
  DEBT_KINDS,
  incomeVolatility,
  INVESTMENT_KINDS,
  LIQUID_KINDS,
  liquidCash,
  monthlyIncome,
  monthlyTotals,
  netWorth,
} from './networth.ts';
export type { Breakdown, CardPayment, CardPoint, CardTrend, CardTrendOptions, LabeledRatio, MonthTotal, Volatility } from './networth.ts';

export {
  gradeDebt,
  gradeFromGpa,
  gradeIncome,
  gradeInvesting,
  gradeLiquidity,
  gradeNetWorth,
  RUBRIC,
  scorecard,
} from './scorecard.ts';
export type { Category, CategoryId, Scorecard } from './scorecard.ts';

export { appendSnapshot, buildLog, latest, SnapshotError, takenAtKey, validateSnapshot } from './snapshots.ts';

export { ANALOGY_LESSONS, companyAnalogies, estimateMonthlyFreeCashFlow } from './analogies.ts';
export type { Analogy } from './analogies.ts';

export {
  averageDailySpend,
  CATEGORY_TITLES,
  cashRunwayDays,
  categorize,
  categorizeAll,
  categoryTitle,
  compareCategories,
  DEFAULT_CATEGORY_RULES,
  detectSubscriptions,
  isSpending,
  merchantKey,
  monthBounds,
  NON_SPENDING,
  paymentRebounds,
  prevMonth,
  SPEND_CATEGORIES,
  spendingByCategory,
  spendingLeaks,
  spendingPace,
} from './transactions.ts';
export type {
  CategorizedTransaction,
  CategorizeOptions,
  CategoryChange,
  CategoryRules,
  CategorySpend,
  CategoryTotal,
  DailySpend,
  Leak,
  PaymentRebound,
  SpendingPace,
  Subscription,
  SubscriptionOptions,
} from './transactions.ts';

export { interestAvoided, minimumOnlyPlan, payoffPlan, requiredMonthlyPayment, statementCycle, utilization, UTILIZATION_BANDS } from './credit.ts';
export type { PayoffMonth, PayoffPlan, StatementCycle, Utilization, UtilizationBand, UtilizationBandId } from './credit.ts';

export { allocation, benchmarkComparison, daysStale, dividendSummary, holdingsSummary, IRA_CONTRIBUTION_LIMITS, priceOn, rothTracker } from './investments.ts';
export type {
  AllocationSlice, BenchmarkComparison, BenchmarkPoint, Contribution, Dividend, DividendSummary, HoldingRow, HoldingsSummary, PricePoint, RothTracker, ValuePoint,
} from './investments.ts';

export {
  annualizedIncome, applyWorkLog, cardPayoffGoal, emergencyFundGoal, netWorthChange, netWorthSeries, pendingPayLedger, savingsTargetGoal, unitsPerPaycheck,
} from './series.ts';
export type { GoalProgress, NetWorthChange, NetWorthPoint, PendingLine, WorkEntry } from './series.ts';

export { personal10K } from './report.ts';
export type { CompanyAnalog, Personal10K, Personal10KInput } from './report.ts';

export { moneyAlerts } from './alerts.ts';
export type { AlertInput, AlertSeverity, MoneyAlert } from './alerts.ts';

/**
 * One call that builds everything the Budget screen shows. Pure and deterministic.
 */
import { monthKey, type CategorizeOptions, type IncomeDeposit, type ISODate, type Transaction, type WorkEntry } from './money.ts';
import { envelopes, type Envelope } from './envelopes.ts';
import { bufferProgress, goalTimelines, type BufferProgress, type GoalTimeline } from './goals.ts';
import { incomeBaseline, type IncomeBaseline } from './income.ts';
import { budgetInsights, type CompanyRatio, type Insight } from './insights.ts';
import { applyLinked, type LinkedMoney } from './linked.ts';
import { planPaychecks, type PaycheckPlan } from './paycheck.ts';
import { buildMonthlyPlan, type MonthlyPlan } from './plan.ts';
import { safeToSpend, type SafeToSpend } from './safe.ts';
import { recommendStyle, setupProgress, type SetupProgress } from './setup.ts';
import type { BudgetProfile, BudgetStyle } from './types.ts';

export type BuildBudgetInput = {
  profile: BudgetProfile;
  asOf: ISODate;
  /** Linked data (money-summary shape). Optional: manual setup works without it. */
  linked?: LinkedMoney | null;
  workLog?: readonly WorkEntry[];
  companies?: readonly CompanyRatio[];
  categorize?: CategorizeOptions;
  paid?: readonly string[];
  /** Envelope carry-ins from last month. */
  carried?: Readonly<Record<string, number>>;
};

export type Budget = {
  asOf: ISODate;
  profile: BudgetProfile;
  linked: boolean;
  baseline: IncomeBaseline;
  safe: SafeToSpend;
  plan: MonthlyPlan;
  paychecks: PaycheckPlan[];
  envelopes: Envelope[];
  goals: GoalTimeline[];
  buffer: BufferProgress;
  insights: Insight[];
  progress: SetupProgress;
  recommended: { style: BudgetStyle; reason: string };
};

export function buildBudget(input: BuildBudgetInput): Budget {
  const { asOf } = input;
  const linked = input.linked ?? null;
  const profile = linked ? applyLinked(input.profile, linked) : input.profile;
  const deposits: readonly IncomeDeposit[] = linked?.deposits ?? [];
  const transactions: readonly Transaction[] | undefined = linked?.transactions && linked.transactions.length ? linked.transactions : undefined;
  const baseline = incomeBaseline(profile, asOf, { deposits });
  const safe = safeToSpend(profile, asOf, input.paid ? { paid: input.paid } : {});
  const plan = buildMonthlyPlan(profile, baseline, asOf);
  const paychecks = planPaychecks(profile, asOf, baseline, { count: 3, ...(input.paid ? { paid: input.paid } : {}) });
  const envs = envelopes(profile, monthKey(asOf), {
    ...(input.categorize ?? {}),
    asOf,
    ...(transactions ? { transactions } : {}),
    ...(input.carried ? { carried: input.carried } : {}),
  });
  const cushion = paychecks.flatMap((pc) => pc.lines.filter((l) => l.kind === 'cushion')).map((l) => l.amount);
  const buffer = bufferProgress(profile, cushion.length ? { perPaycheck: cushion[0]! } : {});
  const insights = budgetInsights({
    profile,
    asOf,
    baseline,
    safe,
    deposits,
    ...(transactions ? { transactions } : {}),
    ...(input.workLog ? { workLog: input.workLog } : {}),
    ...(input.companies ? { companies: input.companies } : {}),
    ...(input.categorize ? { categorize: input.categorize } : {}),
  });
  return {
    asOf,
    profile,
    linked: !!linked,
    baseline,
    safe,
    plan,
    paychecks,
    envelopes: envs,
    goals: goalTimelines(profile, asOf),
    buffer,
    insights,
    progress: setupProgress(profile),
    recommended: recommendStyle(profile),
  };
}

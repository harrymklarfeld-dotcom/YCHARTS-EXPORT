/**
 * Re-plan when income (or anything else) changes: compare the old and new plan, bucket by bucket,
 * and say what moved in plain words. Pure: returns new objects, never mutates.
 */
import { formatUSD, round2, type IncomeDeposit, type ISODate } from './money.ts';
import { incomeBaseline } from './income.ts';
import { buildMonthlyPlan, type MonthlyPlan } from './plan.ts';
import { safeToSpend } from './safe.ts';
import type { BudgetProfile, IncomeSource } from './types.ts';

export type PlanChange = { id: string; title: string; from: number; to: number; diff: number };

export type Replan = {
  baselineBefore: number;
  baselineAfter: number;
  change: number;
  safeBefore: number;
  safeAfter: number;
  planBefore: MonthlyPlan;
  planAfter: MonthlyPlan;
  changes: PlanChange[];
  sentences: string[];
};

export function updateIncomeSource(p: BudgetProfile, id: string, patch: Partial<Omit<IncomeSource, 'id'>>, asOf: ISODate): BudgetProfile {
  return { ...p, updatedAt: asOf, income: p.income.map((s) => (s.id === id ? ({ ...s, ...patch } as IncomeSource) : s)) };
}

export function replan(before: BudgetProfile, after: BudgetProfile, asOf: ISODate, opts: { deposits?: readonly IncomeDeposit[] } = {}): Replan {
  const bo = opts.deposits ? { deposits: opts.deposits } : {};
  const b0 = incomeBaseline(before, asOf, bo);
  const b1 = incomeBaseline(after, asOf, bo);
  const planBefore = buildMonthlyPlan(before, b0, asOf);
  const planAfter = buildMonthlyPlan(after, b1, asOf);
  const ids = [...new Set([...planBefore.buckets.map((b) => b.id), ...planAfter.buckets.map((b) => b.id)])];
  const changes: PlanChange[] = [];
  for (const id of ids) {
    const x = planBefore.buckets.find((b) => b.id === id);
    const y = planAfter.buckets.find((b) => b.id === id);
    const from = x?.planned ?? 0;
    const to = y?.planned ?? 0;
    if (Math.abs(to - from) >= 0.01) changes.push({ id, title: (y ?? x)!.title, from, to, diff: round2(to - from) });
  }
  changes.sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff) || a.id.localeCompare(b.id));
  const change = round2(b1.monthly - b0.monthly);
  const safeBefore = safeToSpend(before, asOf).amount;
  const safeAfter = safeToSpend(after, asOf).amount;
  const sentences: string[] = [];
  if (change !== 0) sentences.push(`Your plan now counts ${formatUSD(b1.monthly)} a month (${formatUSD(change, { signed: true })}).`);
  for (const c of changes.slice(0, 3)) sentences.push(`${c.title}: ${formatUSD(c.from)} → ${formatUSD(c.to)}.`);
  if (safeAfter !== safeBefore) sentences.push(`Safe to spend until payday: ${formatUSD(safeBefore)} → ${formatUSD(safeAfter)}.`);
  if (!sentences.length) sentences.push('Nothing in the plan changes.');
  return { baselineBefore: b0.monthly, baselineAfter: b1.monthly, change, safeBefore, safeAfter, planBefore, planAfter, changes, sentences };
}

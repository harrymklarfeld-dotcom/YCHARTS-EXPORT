/**
 * The monthly plan, shaped by the chosen budgeting style. Uses the conservative income baseline.
 */
import { formatUSD, round2, type ISODate } from './money.ts';
import { goalMonthly } from './obligations.ts';
import type { IncomeBaseline } from './income.ts';
import type { BudgetProfile, BudgetStyle } from './types.ts';

export type Group = 'needs' | 'wants' | 'savings';

export type PlanBucket = {
  id: string;
  title: string;
  kind: 'bill' | 'envelope' | 'goal' | 'card' | 'cushion' | 'flexible';
  group: Group;
  planned: number;
  /** What the user asked for before any trimming. */
  requested: number;
};

export type MonthlyPlan = {
  style: BudgetStyle;
  income: number;
  buckets: PlanBucket[];
  totals: Record<Group, number>;
  /** 50/30/20 only: the target for each group. */
  targets: Record<Group, number> | null;
  /** Income − everything planned. zero_based aims for exactly 0. Negative = the plan asks for more than comes in. */
  unassigned: number;
  /** Everything requested fits in the income. */
  fits: boolean;
  /** How much wants were trimmed to fit (zero_based / pay_yourself_first). */
  trimmed: number;
  notes: string[];
  sentence: string;
};

/** Savings rate taken off the top in pay-yourself-first, by comfort level. */
export const PYF_RATE = { tight: 0.15, balanced: 0.1, flexible: 0.05 } as const;

function sum(xs: readonly { planned: number }[]): number {
  return round2(xs.reduce((t, x) => t + x.planned, 0));
}

function totalsOf(buckets: readonly PlanBucket[]): Record<Group, number> {
  return {
    needs: sum(buckets.filter((b) => b.group === 'needs')),
    wants: sum(buckets.filter((b) => b.group === 'wants')),
    savings: sum(buckets.filter((b) => b.group === 'savings')),
  };
}

/** Scale `wants` envelopes down (proportionally, in cents) by `cut`. Returns how much was cut. */
function trimWants(buckets: PlanBucket[], cut: number): number {
  const wants = buckets.filter((b) => b.group === 'wants' && b.kind === 'envelope' && b.planned > 0);
  const total = sum(wants);
  if (total <= 0 || cut <= 0) return 0;
  const take = Math.min(total, cut);
  let done = 0;
  wants.forEach((b, i) => {
    const share = i === wants.length - 1 ? round2(take - done) : round2((b.planned / total) * take);
    const s = Math.min(b.planned, share);
    b.planned = round2(b.planned - s);
    done = round2(done + s);
  });
  return done;
}

/** Base buckets: bills, envelopes, goals (and the card goal), before the style shapes them. */
export function baseBuckets(p: BudgetProfile, asOf: ISODate): PlanBucket[] {
  const out: PlanBucket[] = [];
  for (const b of p.bills) out.push({ id: `bill:${b.id}`, title: b.name, kind: 'bill', group: 'needs', planned: round2(b.amount), requested: round2(b.amount) });
  for (const c of p.categories) {
    const g: Group = c.kind === 'need' ? 'needs' : 'wants';
    out.push({ id: `env:${c.id}`, title: c.title, kind: 'envelope', group: g, planned: round2(c.monthly), requested: round2(c.monthly) });
  }
  for (const g of p.goals) {
    const m = goalMonthly(g, p, asOf);
    if (m <= 0) continue;
    out.push({ id: `goal:${g.id}`, title: g.title, kind: g.kind === 'pay_off_card' ? 'card' : 'goal', group: 'savings', planned: m, requested: m });
  }
  return out;
}

export function buildMonthlyPlan(p: BudgetProfile, baseline: Pick<IncomeBaseline, 'monthly'>, asOf: ISODate, style: BudgetStyle = p.style): MonthlyPlan {
  const income = round2(Math.max(0, baseline.monthly));
  const buckets = baseBuckets(p, asOf);
  const notes: string[] = [];
  let targets: MonthlyPlan['targets'] = null;
  let trimmed = 0;
  const requestedTotal = sum(buckets);

  switch (style) {
    case 'fifty_thirty_twenty': {
      targets = { needs: round2(income * 0.5), wants: round2(income * 0.3), savings: round2(income - round2(income * 0.5) - round2(income * 0.3)) };
      const t = totalsOf(buckets);
      if (t.savings < targets.savings) {
        buckets.push({ id: 'cushion', title: 'Extra to savings (the 20%)', kind: 'cushion', group: 'savings', planned: round2(targets.savings - t.savings), requested: 0 });
      }
      const t2 = totalsOf(buckets);
      if (t2.needs > targets.needs) notes.push(`Needs are ${formatUSD(t2.needs - targets.needs)} above the 50% line. That is common with rent or low income; wants and savings absorb it.`);
      if (t2.wants > targets.wants) notes.push(`Wants are ${formatUSD(t2.wants - targets.wants)} above the 30% line.`);
      break;
    }
    case 'zero_based': {
      const left = round2(income - requestedTotal);
      if (left > 0) {
        buckets.push({ id: 'cushion', title: 'Cushion (every extra dollar gets a job)', kind: 'cushion', group: 'savings', planned: left, requested: 0 });
      } else if (left < 0) {
        trimmed = trimWants(buckets, -left);
        if (trimmed > 0) notes.push(`Wants were trimmed by ${formatUSD(trimmed)} so the plan balances.`);
      }
      break;
    }
    case 'pay_yourself_first': {
      const goals = sum(buckets.filter((b) => b.group === 'savings'));
      const rate = PYF_RATE[p.comfort.tightness];
      const first = round2(Math.max(goals, income * rate));
      if (first > goals) buckets.push({ id: 'cushion', title: `Pay yourself first (${Math.round(rate * 100)}%)`, kind: 'cushion', group: 'savings', planned: round2(first - goals), requested: 0 });
      const over = round2(sum(buckets) - income);
      if (over > 0) {
        trimmed = trimWants(buckets, over);
        if (trimmed > 0) notes.push(`Wants were trimmed by ${formatUSD(trimmed)} so savings come first.`);
      }
      const left = round2(income - sum(buckets));
      if (left > 0) buckets.push({ id: 'flexible', title: 'Free to spend', kind: 'flexible', group: 'wants', planned: left, requested: 0 });
      break;
    }
    case 'paycheck': {
      const left = round2(income - requestedTotal);
      if (left > 0) buckets.push({ id: 'flexible', title: 'Flexible (assigned paycheck by paycheck)', kind: 'flexible', group: 'wants', planned: left, requested: 0 });
      break;
    }
  }

  const totals = totalsOf(buckets);
  const planned = round2(totals.needs + totals.wants + totals.savings);
  const unassigned = round2(income - planned);
  const fits = unassigned >= 0;
  if (!fits) notes.push(`The plan asks for ${formatUSD(-unassigned)} more than a low month brings in. Paycheck planning handles this: each paycheck covers what is due first.`);
  const sentence =
    income <= 0
      ? 'With no income counted this month, the plan only uses cash you already have.'
      : style === 'fifty_thirty_twenty' && targets
        ? `Of ${formatUSD(income)}: needs ${formatUSD(totals.needs)} (target ${formatUSD(targets.needs)}), wants ${formatUSD(totals.wants)} (target ${formatUSD(targets.wants)}), savings and debt ${formatUSD(totals.savings)} (target ${formatUSD(targets.savings)}).`
        : `Of ${formatUSD(income)} a month: ${formatUSD(totals.needs)} needs, ${formatUSD(totals.wants)} wants, ${formatUSD(totals.savings)} goals and cushion${unassigned > 0 ? `, ${formatUSD(unassigned)} not assigned yet` : ''}.`;
  return { style, income, buckets, totals, targets, unassigned, fits, trimmed, notes, sentence };
}

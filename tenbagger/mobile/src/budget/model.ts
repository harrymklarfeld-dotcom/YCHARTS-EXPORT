/**
 * Pure glue between the budget store and the engine (unit-tested in __tests__/model.test.ts).
 *
 * Sources, in order:
 *  - sample mode: the FICTIONAL Alex plan (assets/data/budget.sample.json) with the Money hub's
 *    sample (money.sample.json) standing in for linked accounts
 *  - the user's own profile (manual), plus linked data when the lead passes it in (setLinked)
 */
import budgetSampleJson from '../../assets/data/budget.sample.json';
import moneySampleJson from '../../assets/data/money.sample.json';
import { getCompanies } from '../data';
import {
  addDays,
  buildBudget,
  shortDate,
  weekday,
  type Budget,
  type BudgetProfile,
  type CompanyRatio,
  type ISODate,
  type LinkedMoney,
  type WorkEntry,
} from './engine';

export type LinkedBudgetData = LinkedMoney & { workLog?: WorkEntry[] };

export type BudgetSample = {
  sample: true;
  sampleLabel: string;
  persona: { name: string; age: number; year: string; blurb: string };
  asOf: ISODate;
  workLog: WorkEntry[];
  profile: BudgetProfile;
};

export const budgetSample = budgetSampleJson as unknown as BudgetSample;
export const moneySampleLinked = moneySampleJson as unknown as LinkedMoney & { asOf: ISODate };

/** Company current ratios for the "like Costco's current ratio" insight. */
export function companyRatios(): CompanyRatio[] {
  return getCompanies()
    .map((c) => ({ ticker: c.ticker, name: c.name, currentRatio: (c.metrics as { current_ratio?: number | null }).current_ratio ?? NaN }))
    .filter((c) => Number.isFinite(c.currentRatio) && c.currentRatio > 0);
}

export type BudgetSource = 'sample' | 'mine' | 'none';

export type ViewInput = {
  profile: BudgetProfile | null;
  sampleMode: boolean;
  today: ISODate;
  linked?: LinkedBudgetData | null;
  paid?: string[];
  carried?: Record<string, number>;
};

export type BudgetView = { source: BudgetSource; asOf: ISODate; budget: Budget | null; sampleLabel: string | null };

export function buildView(input: ViewInput): BudgetView {
  if (input.sampleMode) {
    const s = budgetSample;
    const budget = buildBudget({ profile: s.profile, asOf: s.asOf, linked: moneySampleLinked, workLog: s.workLog, companies: companyRatios() });
    return { source: 'sample', asOf: s.asOf, budget, sampleLabel: `${s.sampleLabel}. Linked data is the Money hub sample.` };
  }
  if (!input.profile) return { source: 'none', asOf: input.today, budget: null, sampleLabel: null };
  const linked = input.linked ?? null;
  const budget = buildBudget({
    profile: input.profile,
    asOf: input.today,
    linked,
    ...(linked?.workLog ? { workLog: linked.workLog } : {}),
    companies: companyRatios(),
    ...(input.paid ? { paid: input.paid } : {}),
    ...(input.carried ? { carried: input.carried } : {}),
  });
  return { source: 'mine', asOf: input.today, budget, sampleLabel: null };
}

/** Show onboarding on first launch: no profile yet and the user hasn't skipped it. */
export function shouldShowOnboarding(s: { profile: BudgetProfile | null; onboardingSeen: boolean; sampleMode: boolean }): boolean {
  return !s.profile && !s.onboardingSeen && !s.sampleMode;
}

/** The next `n` days as quick-pick chips ("Fri Oct 9"). */
export function dayChips(from: ISODate, n = 21, startOffset = 1): { date: ISODate; label: string }[] {
  const names = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  return Array.from({ length: n }, (_, i) => {
    const date = addDays(from, i + startOffset);
    return { date, label: `${names[weekday(date)]} ${shortDate(date)}` };
  });
}

/** Parse a friendly money string ("$1,120.50") → number | null. */
export function parseMoney(s: string): number | null {
  const clean = s.replace(/[$,\s]/g, '');
  if (clean === '') return null;
  const n = Number(clean);
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) / 100 : null;
}

export function moneyText(n: number | undefined | null): string {
  if (n === undefined || n === null || !Number.isFinite(n)) return '';
  return Number.isInteger(n) ? String(n) : n.toFixed(2);
}

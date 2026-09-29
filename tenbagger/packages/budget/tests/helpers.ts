import raw from './fixtures/alex.budget.json' with { type: 'json' };
import money from './fixtures/money.sample.json' with { type: 'json' };
import { emptyProfile, type BudgetProfile, type IncomeSource, type LinkedMoney } from '../src/index.ts';
import type { WorkEntry } from '../../money/src/index.ts';

export const ALEX = raw.profile as unknown as BudgetProfile;
export const ALEX_AS_OF = raw.asOf;
export const ALEX_WORKLOG = raw.workLog as unknown as WorkEntry[];
export const MONEY = money as unknown as LinkedMoney & { asOf: string };

/** A small, fully controlled profile: $500 cash, one $400 biweekly paycheck. */
export function profile(extra: Partial<BudgetProfile> = {}): BudgetProfile {
  const base = emptyProfile('2026-10-05');
  return {
    ...base,
    categories: [],
    income: [paycheck()],
    balances: { asOf: '2026-10-05', basis: 'manual', cash: 500 },
    comfort: { tightness: 'balanced', notify: 'paycheck', buffer: 50 },
    ...extra,
  };
}

export function paycheck(extra: Partial<IncomeSource> = {}): IncomeSource {
  return { id: 'job', name: 'Job', kind: 'paycheck', rate: 400, frequency: 'biweekly', nextPayDate: '2026-10-09', ...extra };
}

export function hourly(extra: Partial<IncomeSource> = {}): IncomeSource {
  return { id: 'lib', name: 'Library job', kind: 'hourly', rate: 15, unitsPerWeek: 10, weekdays: [1, 3, 5], frequency: 'biweekly', nextPayDate: '2026-10-09', withholdingRate: 0, ...extra };
}

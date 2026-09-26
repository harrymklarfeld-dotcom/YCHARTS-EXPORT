/**
 * Income for budgeting: turn setup answers into @tenbagger/money income streams, project dated
 * paychecks (projected vs pending), and pick a CONSERVATIVE monthly baseline for irregular pay.
 */
import {
  addDays,
  addMonthsClamped,
  diffDays,
  formatUSD,
  monthKey,
  PERIODS_PER_YEAR,
  prevMonth,
  projectIncome,
  round2,
  toDayNumber,
  type ExpectedDeposit,
  type IncomeDeposit,
  type IncomeStream,
  type ISODate,
  type NumberLabel,
} from './money.ts';
import type { BudgetProfile, Disbursement, IncomeSource } from './types.ts';

const UNIT_KINDS = new Set(['hourly', 'per_session']);

/** Default condition text for pay that only lands after the user does something. */
export function conditionFor(s: IncomeSource): string | undefined {
  if (s.condition) return s.condition;
  if (!s.paidOnlyIfSubmitted) return undefined;
  return s.kind === 'per_session' ? 'session reports filed' : 'hours submitted';
}

/**
 * Setup sources → money-package streams. Stipends and occasional money are NOT streams
 * (stipends are dated lump sums; occasional money is never counted in the plan).
 */
export function toIncomeStreams(sources: readonly IncomeSource[]): IncomeStream[] {
  const out: IncomeStream[] = [];
  for (const s of sources) {
    if (s.kind === 'stipend' || s.frequency === 'occasional' || !s.nextPayDate) continue;
    const kind: IncomeStream['kind'] = s.kind === 'hourly' ? 'hourly' : s.kind === 'per_session' ? 'per_session' : s.kind === 'salary' ? 'salary' : 'other';
    const stream: IncomeStream = {
      id: s.id,
      name: s.name,
      kind,
      rate: Math.max(0, s.rate),
      schedule: { unitsPerWeek: UNIT_KINDS.has(s.kind) ? Math.max(0, s.unitsPerWeek ?? 0) : 0, weekdays: s.weekdays ?? [] },
      payFrequency: s.frequency,
      nextPayDate: s.nextPayDate,
      withholdingRate: s.kind === 'paycheck' || s.kind === 'allowance' ? 0 : (s.withholdingRate ?? 0),
    };
    const cond = conditionFor(s);
    if (cond) stream.condition = cond;
    if (s.pendingUnsubmitted && UNIT_KINDS.has(s.kind)) stream.pendingUnsubmitted = { ...s.pendingUnsubmitted };
    out.push(stream);
  }
  return out;
}

function disbursementEnd(d: Disbursement): ISODate {
  return d.coversUntil ?? addMonthsClamped(d.date, 4);
}

/**
 * Every paycheck / disbursement expected in `[from, to]`, sorted by date. Regular pay is
 * `projected`; the paycheck covering unsubmitted work is `pending` (money-package rules).
 */
export function projectedDeposits(p: Pick<BudgetProfile, 'income'>, from: ISODate, to: ISODate): ExpectedDeposit[] {
  const out = projectIncome(toIncomeStreams(p.income), from, to);
  const f = toDayNumber(from);
  const t = toDayNumber(to);
  for (const s of p.income) {
    if (s.kind !== 'stipend') continue;
    for (const d of s.disbursements ?? []) {
      const n = toDayNumber(d.date);
      if (n < f || n > t || !(d.amount > 0)) continue;
      out.push({ date: d.date, amount: round2(d.amount), gross: round2(d.amount), basis: 'projected', streamId: s.id, streamName: s.name, note: `Lump sum meant to last until ${disbursementEnd(d)}` });
    }
  }
  return out.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.streamId.localeCompare(b.streamId)));
}

export type SourceMonthly = { id: string; name: string; monthly: number; counted: boolean; note: string };

/** Planned monthly take-home for one source (pending pay never adds to it). */
export function plannedMonthly(s: IncomeSource, asOf: ISODate): SourceMonthly {
  const base = { id: s.id, name: s.name };
  const w = s.withholdingRate ?? 0;
  if (s.frequency === 'occasional') {
    return { ...base, monthly: 0, counted: false, note: 'Occasional money is not counted in the plan. When it lands, it is a bonus.' };
  }
  switch (s.kind) {
    case 'hourly':
    case 'per_session': {
      const units = Math.max(0, s.unitsPerWeek ?? 0);
      const m = round2((s.rate * units * 52 * (1 - w)) / 12);
      const word = s.kind === 'hourly' ? 'hours' : 'sessions';
      return { ...base, monthly: m, counted: true, note: `${units} ${word}/week × ${formatUSD(s.rate, { cents: true })}${w > 0 ? ` minus ${Math.round(w * 100)}% withheld` : ''}` };
    }
    case 'salary':
      return { ...base, monthly: round2((s.rate * (1 - w)) / 12), counted: true, note: `${formatUSD(s.rate)} a year${w > 0 ? ` minus ${Math.round(w * 100)}% withheld` : ''}` };
    case 'paycheck':
    case 'allowance':
      return { ...base, monthly: round2((s.rate * PERIODS_PER_YEAR[s.frequency]) / 12), counted: true, note: `${formatUSD(s.rate)} per ${s.frequency} payment` };
    case 'stipend': {
      // Spread each lump sum over the months it has to cover, counted only while it is current.
      let m = 0;
      const n = toDayNumber(asOf);
      for (const d of s.disbursements ?? []) {
        const end = disbursementEnd(d);
        const months = Math.max(1, Math.round(diffDays(d.date, end) / 30.44));
        if (n >= toDayNumber(d.date) - 31 && n <= toDayNumber(end)) m += d.amount / months;
      }
      return { ...base, monthly: round2(m), counted: m > 0, note: m > 0 ? 'Lump sum spread over the months it has to cover' : 'No disbursement covers this month' };
    }
  }
}

/** Linear-interpolated percentile (p in [0,1]) of a list. Deterministic. */
export function percentile(xs: readonly number[], p: number): number {
  if (xs.length === 0) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const rank = Math.min(1, Math.max(0, p)) * (s.length - 1);
  const lo = Math.floor(rank);
  const hi = Math.ceil(rank);
  return s[lo]! + (s[hi]! - s[lo]!) * (rank - lo);
}

export type MonthIncome = { month: string; total: number };

/**
 * Complete calendar months of deposit history before `asOf`'s month, oldest first, up to
 * `maxMonths`. Months with no deposits count as $0 (a zero-income month is real data), but only
 * from the first month that has any deposit.
 */
export function completeMonths(deposits: readonly IncomeDeposit[], asOf: ISODate, maxMonths = 6): MonthIncome[] {
  const confirmed = deposits.filter((d) => d.basis === 'verified' || d.basis === 'manual');
  if (confirmed.length === 0) return [];
  const first = confirmed.map((d) => monthKey(d.date)).sort()[0]!;
  const months: string[] = [];
  let m = prevMonth(monthKey(asOf));
  while (m >= first && months.length < maxMonths) {
    months.unshift(m);
    m = prevMonth(m);
  }
  return months.map((month) => ({ month, total: round2(confirmed.filter((d) => monthKey(d.date) === month).reduce((t, d) => t + d.amount, 0)) }));
}

export type IncomeBaseline = {
  /** The monthly number the plan uses. */
  monthly: number;
  /** From the user's schedule (hours × rate etc.), pending pay excluded. */
  planned: number;
  /** 25th-percentile month of confirmed history (null with fewer than `minMonths`). */
  history: number | null;
  method: 'planned' | 'history_p25' | 'lower_of_both' | 'none';
  label: NumberLabel;
  months: MonthIncome[];
  perSource: SourceMonthly[];
  /** Pending pay (conditional) known right now; never part of the baseline. */
  pendingExcluded: number;
  sentence: string;
};

/**
 * Conservative monthly income:
 * - planned = scheduled take-home (hours × rate, salary / 12, …), pending pay excluded
 * - history = 25th percentile of the last complete months (needs `minMonths`, default 3)
 * - both → the LOWER one; one → that one; neither → $0 (a zero-income plan still works)
 */
export function incomeBaseline(
  p: Pick<BudgetProfile, 'income'>,
  asOf: ISODate,
  opts: { deposits?: readonly IncomeDeposit[]; minMonths?: number; pct?: number } = {},
): IncomeBaseline {
  const perSource = p.income.map((s) => plannedMonthly(s, asOf));
  const planned = round2(perSource.reduce((t, s) => t + s.monthly, 0));
  const months = completeMonths(opts.deposits ?? [], asOf);
  const minMonths = opts.minMonths ?? 3;
  const history = months.length >= minMonths ? round2(percentile(months.map((m) => m.total), opts.pct ?? 0.25)) : null;
  const hasPlanned = perSource.some((s) => s.counted);
  let monthly = 0;
  let method: IncomeBaseline['method'] = 'none';
  if (hasPlanned && history !== null) {
    monthly = Math.min(planned, history);
    method = 'lower_of_both';
  } else if (history !== null) {
    monthly = history;
    method = 'history_p25';
  } else if (hasPlanned) {
    monthly = planned;
    method = 'planned';
  }
  const pendingExcluded = round2(
    projectedDeposits(p, asOf, addDays(asOf, 62)).filter((d) => d.basis === 'pending').reduce((t, d) => t + d.amount, 0),
  );
  const sentence =
    method === 'none'
      ? 'No income is set up yet, so the plan counts $0 a month and only uses money already in your account.'
      : method === 'planned'
        ? `The plan counts ${formatUSD(monthly)} a month from your usual schedule${pendingExcluded > 0 ? `, not the ${formatUSD(pendingExcluded)} of pending pay` : ''}.`
        : method === 'history_p25'
          ? `The plan counts ${formatUSD(monthly)} a month: a low-but-normal month from your last ${months.length} months (the 25th percentile), so a slow month doesn't break it.`
          : `The plan counts ${formatUSD(monthly)} a month, the lower of your schedule (${formatUSD(planned)}) and a low-but-normal recent month (${formatUSD(history ?? 0)}).`;
  return { monthly: round2(monthly), planned, history, method, label: 'estimate', months, perSource, pendingExcluded, sentence };
}

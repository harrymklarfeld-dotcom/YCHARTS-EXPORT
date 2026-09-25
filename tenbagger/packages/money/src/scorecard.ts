/**
 * Plain-English health scorecard. Deterministic rubric (see `RUBRIC`), educational wording:
 * it describes what the numbers show and never tells anyone what to buy, sell or do.
 */
import { dateOf, shortDate } from './dates.ts';
import { formatPct, formatUSD, weakestLabel } from './format.ts';
import {
  cardTrend,
  debtToMonthlyIncome,
  incomeVolatility,
  monthlyIncome,
  netWorth,
  type CardTrendOptions,
} from './networth.ts';
import type { Grade, IncomeDeposit, IncomeStream, NumberLabel, SnapshotLog } from './types.ts';

export type CategoryId = 'net_worth' | 'investing' | 'debt' | 'income' | 'liquidity' | 'spending';

export type Category = {
  id: CategoryId;
  title: string;
  /** null = not enough data to grade honestly. */
  grade: Grade | null;
  reason: string;
  /** The number the grade is based on, formatted ("1.12×", "70%"). */
  metric: string;
  label: NumberLabel;
};

export type Scorecard = {
  asOf: string;
  categories: Category[];
  overall: { grade: Grade | null; gpa: number | null; reason: string };
};

/** The rubric, in words. Shown in the app and kept in sync with the code by tests. */
export const RUBRIC: Record<CategoryId | 'overall', { title: string; measure: string; bands: string[] }> = {
  net_worth: {
    title: 'Net worth',
    measure: 'Net worth (cash + investments − debt) in the latest snapshot, and its change since the first snapshot.',
    bands: ['A: positive and up more than 5%', 'B: positive and within ±5% (or only one snapshot)', 'C: positive but down more than 5%', 'D: negative', 'F: negative and lower than the first snapshot'],
  },
  investing: {
    title: 'Investing',
    measure: 'Share of everything you own that sits in brokerage, retirement or crypto accounts.',
    bands: ['A: 50% or more', 'B: 25% to 50%', 'C: 10% to 25%', 'D: above 0% but under 10%', 'F: nothing invested yet'],
  },
  debt: {
    title: 'Debt',
    measure: 'Total debt ÷ typical monthly income (how many months of income the debt equals).',
    bands: ['A: no debt', 'B: up to 0.5 months', 'C: up to 1 month', 'D: up to 2 months', 'F: more than 2 months, or debt with no income'],
  },
  income: {
    title: 'Income',
    measure: 'Coefficient of variation (stdev ÷ mean) of monthly deposit totals over complete months; needs 2+ months.',
    bands: ['A: 0.15 or less', 'B: up to 0.30', 'C: up to 0.50', 'D: up to 0.75', 'F: above 0.75', 'Capped at B while any pay is PENDING (work not submitted)'],
  },
  liquidity: {
    title: 'Liquidity',
    measure: 'Liquidity ratio = cash ÷ short-term debt (the personal current ratio).',
    bands: ['A: 2.0 or more, or no short-term debt', 'B: 1.5 to 2.0', 'C: 1.0 to 1.5', 'D: 0.75 to 1.0', 'F: under 0.75'],
  },
  spending: {
    title: 'Spending',
    measure: 'Credit card balance across snapshots, including paydowns that new charges win back within 14 days.',
    bands: ['A: balance down more than 5%', 'B: roughly flat (±5%)', 'C: balance up more than 5%', 'D: at least one paydown was outrun by new charges', 'F: every paydown (2+) was outrun'],
  },
  overall: {
    title: 'Overall',
    measure: 'Average of the graded categories on a 4-point scale (A=4 … F=0).',
    bands: ['A: 3.5+', 'B: 2.5+', 'C: 1.5+', 'D: 0.5+', 'F: under 0.5'],
  },
};

const POINTS: Record<Grade, number> = { A: 4, B: 3, C: 2, D: 1, F: 0 };

export function gradeFromGpa(gpa: number): Grade {
  if (gpa >= 3.5) return 'A';
  if (gpa >= 2.5) return 'B';
  if (gpa >= 1.5) return 'C';
  if (gpa >= 0.5) return 'D';
  return 'F';
}

export function gradeNetWorth(net: number, first: number | null): Grade {
  if (net < 0) return first !== null && net < first ? 'F' : 'D';
  const rel = first === null ? 0 : first !== 0 ? (net - first) / Math.abs(first) : net > 0 ? 1 : 0;
  if (first === null) return 'B';
  if (rel > 0.05) return 'A';
  if (rel < -0.05) return 'C';
  return 'B';
}

export function gradeInvesting(share: number): Grade {
  if (share >= 0.5) return 'A';
  if (share >= 0.25) return 'B';
  if (share >= 0.1) return 'C';
  if (share > 0) return 'D';
  return 'F';
}

export function gradeDebt(debt: number, monthsOfIncome: number | null): Grade {
  if (debt <= 0) return 'A';
  if (monthsOfIncome === null) return 'F';
  if (monthsOfIncome <= 0.5) return 'B';
  if (monthsOfIncome <= 1) return 'C';
  if (monthsOfIncome <= 2) return 'D';
  return 'F';
}

export function gradeIncome(cv: number, hasPending: boolean): Grade {
  const g: Grade = cv <= 0.15 ? 'A' : cv <= 0.3 ? 'B' : cv <= 0.5 ? 'C' : cv <= 0.75 ? 'D' : 'F';
  return hasPending && g === 'A' ? 'B' : g;
}

export function gradeLiquidity(ratio: number | null): Grade {
  if (ratio === null || ratio >= 2) return 'A';
  if (ratio >= 1.5) return 'B';
  if (ratio >= 1) return 'C';
  if (ratio >= 0.75) return 'D';
  return 'F';
}

export function scorecard(
  log: SnapshotLog,
  streams: readonly IncomeStream[],
  deposits: readonly IncomeDeposit[],
  opts: { card?: CardTrendOptions } = {},
): Scorecard {
  const last = log[log.length - 1];
  if (!last) {
    return { asOf: '', categories: [], overall: { grade: null, gpa: null, reason: 'Add a first snapshot to see a scorecard.' } };
  }
  const asOf = dateOf(last.takenAt);
  const b = netWorth(last);
  const first = log.length > 1 ? netWorth(log[0]!) : null;
  const cats: Category[] = [];

  // Net worth
  {
    const g = gradeNetWorth(b.net.value, first ? first.net.value : null);
    const change = first ? b.net.value - first.net.value : null;
    const reason =
      change === null
        ? `Net worth is ${formatUSD(b.net.value)}. One snapshot so far, so there's no trend yet.`
        : `Net worth is ${formatUSD(b.net.value)}, ${change >= 0 ? 'up' : 'down'} ${formatUSD(Math.abs(change))} since ${shortDate(first!.asOf)}.`;
    cats.push({ id: 'net_worth', title: 'Net worth', grade: g, reason, metric: formatUSD(b.net.value), label: b.net.label });
  }

  // Investing
  {
    const share = b.totalAssets.value > 0 ? b.investments.value / b.totalAssets.value : 0;
    const g = gradeInvesting(share);
    const reason =
      share > 0
        ? `${formatPct(share)} of what you own is in investment accounts (${formatUSD(b.investments.value)}).`
        : 'Nothing is in an investment account yet.';
    cats.push({ id: 'investing', title: 'Investing', grade: g, reason, metric: formatPct(share), label: weakestLabel([b.investments.label, b.totalAssets.label]) });
  }

  // Debt
  const income = monthlyIncome(deposits, streams, asOf);
  {
    const r = debtToMonthlyIncome(b, income);
    const g = gradeDebt(b.debt.value, r.value);
    const reason =
      b.debt.value <= 0
        ? 'No debt in this snapshot.'
        : r.value === null
          ? `You owe ${formatUSD(b.debt.value)} and there's no income on record to compare it with.`
          : `You owe ${formatUSD(b.debt.value)}, about ${r.value.toFixed(1)} months of your typical ${formatUSD(income.value)} monthly income${income.label === 'estimate' ? ' (ESTIMATE from your schedule)' : ''}.`;
    cats.push({ id: 'debt', title: 'Debt', grade: g, reason, metric: r.value === null ? '—' : `${r.value.toFixed(1)} mo`, label: r.label });
  }

  // Income
  {
    const v = incomeVolatility(deposits, { asOf });
    const pending = streams.filter((s) => s.pendingUnsubmitted);
    const pendingText = pending.length
      ? ` Some pay is PENDING until ${pending.map((s) => s.condition ?? 'the work is submitted').join(' and ')}.`
      : '';
    if (v.cv === null) {
      cats.push({
        id: 'income', title: 'Income', grade: null,
        reason: `Not enough history yet: ${v.months.length} complete month${v.months.length === 1 ? '' : 's'} of deposits (2 needed).${pendingText}`,
        metric: '—', label: v.label,
      });
    } else {
      const g = gradeIncome(v.cv, pending.length > 0);
      const lo = Math.min(...v.months.map((m) => m.total));
      const hi = Math.max(...v.months.map((m) => m.total));
      const steadiness = v.cv <= 0.15 ? 'steady' : v.cv <= 0.3 ? 'fairly steady' : v.cv <= 0.5 ? 'uneven' : 'very uneven';
      cats.push({
        id: 'income', title: 'Income', grade: g,
        reason: `Monthly pay is ${steadiness}: ${formatUSD(lo)} to ${formatUSD(hi)} over the last ${v.months.length} months (variation ${v.cv.toFixed(2)}).${pendingText}`,
        metric: `CV ${v.cv.toFixed(2)}`, label: v.label,
      });
    }
  }

  // Liquidity
  {
    const r = b.liquidityRatio.value;
    const g = gradeLiquidity(r);
    let reason: string;
    if (r === null) reason = `No card or loan payments are due; cash is ${formatUSD(b.liquidity.value)}.`;
    else if (b.shortTermDebt.value > b.liquidity.value)
      reason = `${b.byKind.loan > 0 ? 'Short-term debt' : 'The card balance'} (${formatUSD(b.shortTermDebt.value)}) exceeds your cash (${formatUSD(b.liquidity.value)}): a ratio of ${r.toFixed(2)}.`;
    else reason = `Cash (${formatUSD(b.liquidity.value)}) covers short-term debt (${formatUSD(b.shortTermDebt.value)}) ${r.toFixed(2)}×${r < 1.5 ? ', a thin cushion' : ''}.`;
    cats.push({ id: 'liquidity', title: 'Liquidity', grade: g, reason, metric: r === null ? '—' : `${r.toFixed(2)}×`, label: b.liquidityRatio.label });
  }

  // Spending (card trend)
  {
    const t = cardTrend(log, opts.card ?? {});
    const label = weakestLabel(t.points.map((p) => p.label));
    if (!t.accountId || t.points.length < 2) {
      cats.push({
        id: 'spending', title: 'Spending', grade: null,
        reason: t.accountId ? 'Needs 2+ snapshots of the card to see a trend.' : 'No credit card in your snapshots.',
        metric: '—', label,
      });
    } else {
      const rebounds = t.payments.filter((p) => p.rebound);
      let g: Grade;
      if (t.payments.length >= 2 && rebounds.length === t.payments.length) g = 'F';
      else if (rebounds.length > 0) g = 'D';
      else if (t.direction === 'up') g = 'C';
      else if (t.direction === 'flat') g = 'B';
      else g = 'A';
      const lastRebound = rebounds[rebounds.length - 1];
      const reason = lastRebound
        ? `After the ${formatUSD(lastRebound.paid)} payment on ${shortDate(lastRebound.date)}, new charges brought the card back to ${formatUSD(lastRebound.rebound!.balance)} within ${lastRebound.rebound!.days} days: the paydown is being outrun.`
        : `Card balance went from ${formatUSD(t.points[0]!.balance)} to ${formatUSD(t.points[t.points.length - 1]!.balance)} across ${t.points.length} snapshots.`;
      cats.push({ id: 'spending', title: 'Spending', grade: g, reason, metric: formatUSD(t.change ?? 0, { signed: true }), label });
    }
  }

  const graded = cats.filter((c) => c.grade !== null);
  const gpa = graded.length ? Math.round((graded.reduce((t, c) => t + POINTS[c.grade!], 0) / graded.length) * 100) / 100 : null;
  const grade = gpa === null ? null : gradeFromGpa(gpa);
  const best = graded.filter((c) => c.grade === 'A').map((c) => c.title);
  const weak = graded.filter((c) => c.grade === 'D' || c.grade === 'F').map((c) => c.title);
  const reason =
    gpa === null
      ? 'Not enough data to grade yet.'
      : `${graded.length} of ${cats.length} categories graded, average ${gpa.toFixed(2)} of 4.` +
        (best.length ? ` Strongest: ${best.join(', ')}.` : '') +
        (weak.length ? ` Weakest: ${weak.join(', ')}.` : '');
  return { asOf, categories: cats, overall: { grade, gpa, reason } };
}

/**
 * Plain-English health scorecard. Deterministic rubric (see `RUBRIC`), educational wording:
 * it describes what the numbers show and never tells anyone what to buy, sell or do.
 *
 * Thresholds and grading conditions follow tenbagger/docs/market/SCORECARD_METRICS.md:
 * JPMorgan Chase Institute (income volatility, ~6-week cash buffer), CFPB (DTI 36% / 43%, student-loan
 * treatment), FICO (utilization under 10% / 30%). Where a band has no outside source it says so.
 */
import { dateOf, shortDate } from './dates.ts';
import { utilization } from './credit.ts';
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
    bands: ['A: positive and up more than 5%', 'B: positive and within ±5% (or only one snapshot)', 'C: positive but down more than 5%', 'D: negative', 'F: negative and lower than the first snapshot', 'Deferred / in-school student loans are shown but not graded here (CFPB)'],
  },
  investing: {
    title: 'Investing',
    measure: 'Share of everything you own that sits in brokerage, retirement or crypto accounts.',
    bands: ['A: 50% or more', 'B: 25% to 50%', 'C: 10% to 25%', 'D: an investment or retirement account is open, under 10% (just started)', 'F: no investment or retirement account yet', 'These bands are a Tenbagger convention with no outside source; a Roth account counts even while its balance is small'],
  },
  debt: {
    title: 'Debt',
    measure: 'Total debt ÷ typical monthly income (how many months of income the debt equals). Deferred / in-school student loans are excluded. Minimum payments ÷ income (DTI) is shown alongside: 36% or less is the common healthy line, 43% the caution line (CFPB).',
    bands: ['A: no debt', 'B: up to 0.5 months', 'C: up to 1 month', 'D: up to 2 months', 'F: more than 2 months, or debt with no income'],
  },
  income: {
    title: 'Income',
    measure: 'Coefficient of variation (stdev ÷ mean) of monthly deposit totals over complete months; needs 2+ months. Unscheduled money (family help now and then) is left out. For context, the typical US worker\'s income swings about 36% month to month (JPMorgan Chase Institute).',
    bands: ['A: 0.15 or less', 'B: up to 0.30', 'C: up to 0.50', 'D: up to 0.75', 'F: above 0.75', 'Capped at B while any pay is PENDING (work not submitted)', 'Capped at B until there are 4+ complete months of history'],
  },
  liquidity: {
    title: 'Liquidity',
    measure: 'Liquidity ratio = cash ÷ short-term debt (the personal current ratio). Also shown: weeks of essential spending your cash covers (6+ weeks strong, 3 to 6 building, under 3 thin; JPMorgan Chase Institute).',
    bands: ['A: 2.0 or more, or no short-term debt', 'B: 1.5 to 2.0', 'C: 1.0 to 1.5', 'D: 0.75 to 1.0', 'F: under 0.75'],
  },
  spending: {
    title: 'Spending',
    measure: 'Credit card balance across snapshots, including paydowns that new charges win back within 14 days. Utilization on the card\'s actual limit is shown alongside (under 10% ideal, under 30% manageable; FICO).',
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

/** `hasAccount`: an investment/retirement account exists (even with a small or $0 balance). */
export function gradeInvesting(share: number, hasAccount: boolean = share > 0): Grade {
  if (share >= 0.5) return 'A';
  if (share >= 0.25) return 'B';
  if (share >= 0.1) return 'C';
  if (share > 0 || hasAccount) return 'D';
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

/** Months of history below this cap the income grade at B (confidence rule). */
export const INCOME_FULL_CONFIDENCE_MONTHS = 4;

export function gradeIncome(cv: number, hasPending: boolean, monthsOfHistory: number = INCOME_FULL_CONFIDENCE_MONTHS): Grade {
  const g: Grade = cv <= 0.15 ? 'A' : cv <= 0.3 ? 'B' : cv <= 0.5 ? 'C' : cv <= 0.75 ? 'D' : 'F';
  const capped = hasPending || monthsOfHistory < INCOME_FULL_CONFIDENCE_MONTHS;
  return capped && g === 'A' ? 'B' : g;
}

/** Weeks of essential spending that cash covers; bands from JPMorgan Chase Institute's ~6-week buffer finding. */
export function bufferWeeks(cash: number, essentialWeeklySpend: number | null | undefined): { weeks: number | null; band: 'strong' | 'building' | 'thin' | null } {
  if (!essentialWeeklySpend || essentialWeeklySpend <= 0) return { weeks: null, band: null };
  const exact = Math.max(0, cash) / essentialWeeklySpend;
  const weeks = Math.round(exact * 10) / 10; // rounded for display; the band uses the exact value
  return { weeks, band: exact >= 6 ? 'strong' : exact >= 3 ? 'building' : 'thin' };
}

/** Fixed-payment DTI bands (CFPB): 36% healthy, 43% caution. */
export function dtiBand(dti: number): 'healthy' | 'caution' | 'high' {
  return dti <= 0.36 ? 'healthy' : dti <= 0.43 ? 'caution' : 'high';
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
  opts: {
    card?: CardTrendOptions;
    /** Essential spending per week (bills, food, transport). Enables the weeks-of-buffer line. */
    essentialWeeklySpend?: number;
  } = {},
): Scorecard {
  const last = log[log.length - 1];
  if (!last) {
    return { asOf: '', categories: [], overall: { grade: null, gpa: null, reason: 'Add a first snapshot to see a scorecard.' } };
  }
  const asOf = dateOf(last.takenAt);
  const b = netWorth(last);
  const first = log.length > 1 ? netWorth(log[0]!) : null;
  const deferredOf = (snap: (typeof log)[number]) =>
    snap.accounts.filter((a) => a.kind === 'loan' && a.deferred).reduce((t, a) => t + Math.max(0, a.balance), 0);
  const deferredNow = deferredOf(last);
  const cats: Category[] = [];

  // Net worth (deferred / in-school student loans shown but not graded)
  {
    const gradedNet = b.net.value + deferredNow;
    const gradedFirst = first ? first.net.value + deferredOf(log[0]!) : null;
    const g = gradeNetWorth(gradedNet, gradedFirst);
    const change = gradedFirst === null ? null : gradedNet - gradedFirst;
    const loanNote = deferredNow > 0 ? ` Deferred student loans (${formatUSD(deferredNow)}) are shown on the balance sheet but not graded here.` : '';
    const reason =
      (change === null
        ? `Net worth is ${formatUSD(b.net.value)}. One snapshot so far, so there's no trend yet.`
        : `Net worth is ${formatUSD(b.net.value)}, ${change >= 0 ? 'up' : 'down'} ${formatUSD(Math.abs(change))} since ${shortDate(first!.asOf)}.`) + loanNote;
    cats.push({ id: 'net_worth', title: 'Net worth', grade: g, reason, metric: formatUSD(b.net.value), label: b.net.label });
  }

  // Investing
  {
    const share = b.totalAssets.value > 0 ? b.investments.value / b.totalAssets.value : 0;
    const hasAccount = last.accounts.some((a) => a.kind === 'brokerage' || a.kind === 'retirement' || a.kind === 'crypto');
    const g = gradeInvesting(share, hasAccount);
    const reason =
      share > 0
        ? `${formatPct(share)} of what you own is in investment accounts (${formatUSD(b.investments.value)}).`
        : hasAccount
          ? 'An investment or retirement account is open. That counts as a start, whatever the balance.'
          : 'Nothing is in an investment account yet.';
    cats.push({ id: 'investing', title: 'Investing', grade: g, reason, metric: formatPct(share), label: weakestLabel([b.investments.label, b.totalAssets.label]) });
  }

  // Debt
  // Income-based grades leave out unscheduled money (family help now and then).
  const irregularIds = new Set(streams.filter((s) => s.irregular).map((s) => s.id));
  const regularDeposits = deposits.filter((d) => !d.streamId || !irregularIds.has(d.streamId));
  const regularStreams = streams.filter((s) => !s.irregular);
  const income = monthlyIncome(regularDeposits, regularStreams, asOf);
  {
    const gradedDebt = Math.max(0, b.debt.value - deferredNow);
    const months = income.value > 0 ? Math.round((gradedDebt / income.value) * 100) / 100 : null;
    const r = debtToMonthlyIncome(b, income);
    const g = gradeDebt(gradedDebt, months);
    const deferredIds = new Set(last.accounts.filter((a) => a.kind === 'loan' && a.deferred).map((a) => a.id));
    const minPayments = last.liabilities.filter((l) => !deferredIds.has(l.accountId)).reduce((t, l) => t + Math.max(0, l.minimumDue), 0);
    const dti = income.value > 0 && minPayments > 0 ? minPayments / income.value : null;
    const dtiNote = dti === null ? '' : ` Minimum payments are ${formatPct(dti)} of monthly income (${dtiBand(dti) === 'healthy' ? 'within' : dtiBand(dti) === 'caution' ? 'between' : 'above'} the common 36% / 43% lines).`;
    const loanNote = deferredNow > 0 ? ` Deferred student loans (${formatUSD(deferredNow)}) are not counted here.` : '';
    const reason =
      (gradedDebt <= 0
        ? 'No debt counted in this snapshot.'
        : months === null
          ? `You owe ${formatUSD(gradedDebt)} and there's no income on record to compare it with.`
          : `You owe ${formatUSD(gradedDebt)}, about ${months.toFixed(1)} months of your typical ${formatUSD(income.value)} monthly income${income.label === 'estimate' ? ' (ESTIMATE from your schedule)' : ''}.`) +
      dtiNote + loanNote;
    cats.push({ id: 'debt', title: 'Debt', grade: g, reason, metric: months === null ? '—' : `${months.toFixed(1)} mo`, label: r.label });
  }

  // Income
  {
    const v = incomeVolatility(regularDeposits, { asOf });
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
      const g = gradeIncome(v.cv, pending.length > 0, v.months.length);
      const historyNote = v.months.length < INCOME_FULL_CONFIDENCE_MONTHS ? ` With ${v.months.length} months of history the grade tops out at B for now.` : '';
      const lo = Math.min(...v.months.map((m) => m.total));
      const hi = Math.max(...v.months.map((m) => m.total));
      const steadiness = v.cv <= 0.15 ? 'steady' : v.cv <= 0.3 ? 'fairly steady' : v.cv <= 0.5 ? 'uneven' : 'very uneven';
      cats.push({
        id: 'income', title: 'Income', grade: g,
        reason: `Monthly pay is ${steadiness}: ${formatUSD(lo)} to ${formatUSD(hi)} over the last ${v.months.length} months (variation ${v.cv.toFixed(2)}).${pendingText}${historyNote}`,
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
    const buf = bufferWeeks(b.liquidity.value, opts.essentialWeeklySpend);
    if (buf.weeks !== null) {
      reason += ` It also covers about ${buf.weeks} weeks of essential spending (${buf.band === 'strong' ? '6+ weeks is a strong buffer' : buf.band === 'building' ? '3 to 6 weeks, building toward 6' : 'under 3 weeks, a thin buffer'}).`;
    }
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
      const card = last.accounts.find((a) => a.id === t.accountId);
      const u = card ? utilization(card.balance, card.creditLimit) : null;
      const utilNote = u && u.ratio !== null ? ` ${u.sentence}` : '';
      cats.push({ id: 'spending', title: 'Spending', grade: g, reason: reason + utilNote, metric: formatUSD(t.change ?? 0, { signed: true }), label });
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

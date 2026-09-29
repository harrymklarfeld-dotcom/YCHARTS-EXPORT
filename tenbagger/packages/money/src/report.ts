/**
 * "Personal 10-K": one month of your money written up the way a company reports a year —
 * income statement, balance sheet, cash-flow summary, the scorecard, and company analogs.
 * Every number keeps its label; the share text carries no account names or numbers.
 */
import { dateOf, shortDate } from './dates.ts';
import { formatPct, formatUSD, round2, weakestLabel } from './format.ts';
import { ANALOGY_LESSONS } from './analogies.ts';
import { netWorth } from './networth.ts';
import { scorecard, type Scorecard } from './scorecard.ts';
import { buildLog } from './snapshots.ts';
import { categorize, monthBounds, spendingByCategory, type CategorizeOptions, type CategoryTotal } from './transactions.ts';
import type { IncomeDeposit, IncomeStream, NumberLabel, Snapshot, Transaction } from './types.ts';

export type Personal10KInput = CategorizeOptions & {
  /** Full snapshot history, oldest first. */
  snapshots: readonly Snapshot[];
  transactions: readonly Transaction[];
  deposits: readonly IncomeDeposit[];
  streams: readonly IncomeStream[];
  /** Display name for the share text, e.g. "Alex". */
  name?: string;
  sample?: boolean;
};

export type CompanyAnalog = { id: keyof typeof ANALOGY_LESSONS; title: string; personal: string; company: string; text: string; lessonId: string; label: NumberLabel };

export type Personal10K = {
  month: string;
  title: string;
  period: { from: string; to: string };
  incomeStatement: {
    income: number;
    incomeByStream: { streamId: string; name: string; total: number }[];
    spending: number;
    topCategories: CategoryTotal[];
    /** income − spending: the personal free cash flow. */
    freeCashFlow: number;
    /** freeCashFlow ÷ income; null with no income. */
    savingsRate: number | null;
    moneyInvested: number;
    label: NumberLabel;
  };
  balanceSheet: {
    asOf: string;
    cash: number;
    investments: number;
    totalAssets: number;
    cardDebt: number;
    otherDebt: number;
    totalLiabilities: number;
    netWorth: number;
    label: NumberLabel;
  } | null;
  cashFlow: {
    startCash: number | null;
    endCash: number | null;
    change: number | null;
    moneyIn: number;
    moneyOut: number;
    cardPayments: number;
    /** Change in everything owed: + means borrowing funded part of the month. */
    debtChange: number | null;
    netWorthChange: number | null;
    label: NumberLabel;
  };
  scorecard: Scorecard | null;
  analogs: CompanyAnalog[];
  shareText: string;
};

function snapshotsThrough(snaps: readonly Snapshot[], end: string): Snapshot[] {
  return snaps.filter((s) => dateOf(s.takenAt) <= end);
}

/** The personal 10-K for calendar month `month` (`YYYY-MM`). */
export function personal10K(month: string, data: Personal10KInput): Personal10K {
  const b = monthBounds(month);
  const opts: CategorizeOptions = {
    ...(data.rules ? { rules: data.rules } : {}),
    ...(data.overrides ? { overrides: data.overrides } : {}),
  };
  const monthName = `${shortDate(b.start).split(' ')[0]} ${month.slice(0, 4)}`;

  // Income statement
  const deps = data.deposits.filter((d) => (d.basis === 'verified' || d.basis === 'manual') && d.date >= b.start && d.date <= b.end);
  const income = round2(deps.reduce((s, d) => s + d.amount, 0));
  const byStream = new Map<string, number>();
  for (const d of deps) byStream.set(d.streamId ?? 'other', (byStream.get(d.streamId ?? 'other') ?? 0) + d.amount);
  const incomeByStream = [...byStream.entries()]
    .map(([streamId, total]) => ({ streamId, name: data.streams.find((s) => s.id === streamId)?.name ?? 'Other income', total: round2(total) }))
    .sort((a, c) => c.total - a.total);
  const spend = spendingByCategory(data.transactions, month, opts);
  const inMonth = data.transactions.filter((t) => t.date >= b.start && t.date <= b.end);
  const moneyInvested = round2(
    inMonth.filter((t) => t.amount < 0 && categorize(t, opts) === 'transfer' && /brokerage|roth|invest/i.test(t.name)).reduce((s, t) => s - t.amount, 0),
  );
  const fcf = round2(income - spend.total);
  const isLabel = weakestLabel([spend.label, ...deps.map((d) => d.basis as NumberLabel)]);

  // Balance sheet: latest snapshot on or before month end.
  const upTo = snapshotsThrough(data.snapshots, b.end);
  const endSnap = upTo[upTo.length - 1];
  const before = data.snapshots.filter((s) => dateOf(s.takenAt) < b.start);
  const startSnap = before[before.length - 1] ?? data.snapshots.find((s) => dateOf(s.takenAt) >= b.start && dateOf(s.takenAt) <= b.end);
  const endB = endSnap ? netWorth(endSnap) : null;
  const startB = startSnap && startSnap !== endSnap ? netWorth(startSnap) : null;
  const balanceSheet = endB
    ? {
        asOf: endB.asOf,
        cash: endB.liquidity.value,
        investments: endB.investments.value,
        totalAssets: endB.totalAssets.value,
        cardDebt: endB.byKind.credit_card,
        otherDebt: endB.byKind.loan,
        totalLiabilities: endB.debt.value,
        netWorth: endB.net.value,
        label: endB.net.label,
      }
    : null;

  // Cash flow summary
  const moneyIn = round2(inMonth.filter((t) => t.amount > 0 && categorize(t, opts) === 'income').reduce((s, t) => s + t.amount, 0));
  const moneyOut = spend.total;
  const cardPayments = round2(inMonth.filter((t) => t.amount < 0 && categorize(t, opts) === 'card_payment').reduce((s, t) => s - t.amount, 0));
  const cashFlow = {
    startCash: startB ? startB.liquidity.value : null,
    endCash: endB ? endB.liquidity.value : null,
    change: startB && endB ? round2(endB.liquidity.value - startB.liquidity.value) : null,
    moneyIn,
    moneyOut,
    cardPayments,
    debtChange: startB && endB ? round2(endB.debt.value - startB.debt.value) : null,
    netWorthChange: startB && endB ? round2(endB.net.value - startB.net.value) : null,
    label: weakestLabel([isLabel, endB?.liquidity.label ?? 'estimate']),
  };

  // Scorecard over history through month end.
  let sc: Scorecard | null = null;
  if (upTo.length) sc = scorecard(buildLog(upTo), data.streams, data.deposits);

  // Company analogs
  const analogs: CompanyAnalog[] = [];
  if (endB) {
    const lr = endB.liquidityRatio.value;
    analogs.push({
      id: 'current_ratio',
      title: 'Current ratio',
      personal: lr === null ? 'Nothing due soon' : `Cash covers what's due soon ${lr.toFixed(2)}×`,
      company: 'current assets ÷ current liabilities',
      text: 'A company compares cash and other short-term assets with bills due within a year. Under 1.0 means near-term bills are bigger than the cash on hand.',
      lessonId: ANALOGY_LESSONS.current_ratio,
      label: endB.liquidityRatio.label,
    });
  }
  analogs.push({
    id: 'free_cash_flow',
    title: 'Free cash flow',
    personal: `${formatUSD(fcf, { signed: true })} this month`,
    company: 'operating cash flow − capital spending',
    text: 'Income minus spending is the cash your "business" generated. Companies with steady positive free cash flow can fund growth without borrowing.',
    lessonId: ANALOGY_LESSONS.free_cash_flow,
    label: isLabel,
  });
  if (endB) {
    const de = endB.debtToNetWorth.value;
    analogs.push({
      id: 'debt_to_equity',
      title: 'Debt-to-equity',
      personal: de === null ? 'Not meaningful (net worth ≤ 0)' : `Debt ÷ net worth ${de.toFixed(2)}`,
      company: 'total debt ÷ shareholders’ equity',
      text: 'Your net worth is your equity. The ratio shows how much of what you have is funded by what you owe, the same way it shows how much of a company is funded by lenders.',
      lessonId: ANALOGY_LESSONS.debt_to_equity,
      label: endB.debtToNetWorth.label,
    });
  }

  const who = data.name ? `${data.name}'s` : 'My';
  const lines = [
    `${who} Personal 10-K: ${monthName}${data.sample ? ' (sample data, fictional)' : ''}`,
    `Income ${formatUSD(income)} − spending ${formatUSD(spend.total)} = free cash flow ${formatUSD(fcf, { signed: true })}${
      income > 0 ? (fcf >= 0 ? ` (${formatPct(fcf / income)} of income kept)` : ` (spending was ${formatPct(spend.total / income)} of income)`) : ''
    }.`,
    balanceSheet
      ? `Balance sheet (${shortDate(balanceSheet.asOf)}): assets ${formatUSD(balanceSheet.totalAssets)}, debts ${formatUSD(balanceSheet.totalLiabilities)}, net worth ${formatUSD(balanceSheet.netWorth)}.`
      : 'Balance sheet: no snapshot yet.',
    spend.categories.length ? `Biggest spending: ${spend.categories.slice(0, 3).map((c) => `${c.title} ${formatUSD(c.total)}`).join(', ')}.` : '',
    sc && sc.overall.grade ? `Scorecard: ${sc.overall.grade} overall (${sc.categories.map((c) => `${c.title} ${c.grade ?? '–'}`).join(', ')}).` : '',
    'Made with Tenbagger. Educational only.',
  ].filter(Boolean);

  return {
    month,
    title: `Personal 10-K · ${monthName}`,
    period: { from: b.start, to: b.end },
    incomeStatement: {
      income,
      incomeByStream,
      spending: spend.total,
      topCategories: spend.categories.slice(0, 6),
      freeCashFlow: fcf,
      savingsRate: income > 0 ? round2(fcf / income) : null,
      moneyInvested,
      label: isLabel,
    },
    balanceSheet,
    cashFlow,
    scorecard: sc,
    analogs,
    shareText: lines.join('\n'),
  };
}

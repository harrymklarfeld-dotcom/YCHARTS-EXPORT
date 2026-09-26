/**
 * "Your money, like a 10-K": each personal number next to the company metric it mirrors,
 * linked to the Tenbagger lesson (ids from tenbagger/data/lessons.json) that teaches it.
 */
import { dateOf, diffDays } from './dates.ts';
import { formatUSD, round2, weakestLabel } from './format.ts';
import { netWorth, type Breakdown } from './networth.ts';
import type { Labeled, NumberLabel, SnapshotLog } from './types.ts';

export type Analogy = {
  id: 'current_ratio' | 'net_cash' | 'debt_to_equity' | 'balance_sheet' | 'free_cash_flow';
  /** e.g. "Liquidity ratio 1.12" */
  personal: string;
  personalValue: number | null;
  label: NumberLabel;
  /** e.g. "Current ratio" */
  company: string;
  companyFormula: string;
  /** One or two plain-English sentences connecting the two. */
  explanation: string;
  /** Lesson id in data/lessons.json. */
  lessonId: string;
};

/** Lesson ids used (verified against tenbagger/data/lessons.json by the tests). */
export const ANALOGY_LESSONS = {
  current_ratio: 'u5-l4', // Current ratio
  net_cash: 'u5-l2', // Net cash vs. net debt
  debt_to_equity: 'u5-l3', // Debt-to-equity
  balance_sheet: 'u5-l1', // Assets = liabilities + equity
  free_cash_flow: 'u4-l2', // Free cash flow
} as const;

/**
 * Personal "free cash flow" per month: the change in (cash − debt) between the first and last
 * snapshot, scaled to 30.44 days. Always an ESTIMATE; money moved into investment accounts
 * counts as spent here, the way capex reduces a company's FCF. null with < 14 days of history.
 */
export function estimateMonthlyFreeCashFlow(log: SnapshotLog): Labeled | null {
  if (log.length < 2) return null;
  const a = log[0]!;
  const b = log[log.length - 1]!;
  const days = diffDays(dateOf(a.takenAt), dateOf(b.takenAt));
  if (days < 14) return null;
  const change = netWorth(b).netCash.value - netWorth(a).netCash.value;
  return { value: round2((change / days) * 30.44), label: 'estimate' };
}

export function companyAnalogies(b: Breakdown, extras: { monthlyFreeCashFlow?: Labeled | null } = {}): Analogy[] {
  const out: Analogy[] = [];
  const lr = b.liquidityRatio.value;
  out.push({
    id: 'current_ratio',
    personal: lr === null ? 'Liquidity ratio — (nothing due)' : `Liquidity ratio ${lr.toFixed(2)}`,
    personalValue: lr,
    label: b.liquidityRatio.label,
    company: 'Current ratio',
    companyFormula: 'current assets ÷ current liabilities',
    explanation:
      `Your cash (${formatUSD(b.liquidity.value)}) ÷ what's due soon (${formatUSD(b.shortTermDebt.value)}). ` +
      'A company does the same with current assets and the bills due within a year; under 1.0 means the near-term bills are bigger than the cash to pay them.',
    lessonId: ANALOGY_LESSONS.current_ratio,
  });
  out.push({
    id: 'net_cash',
    personal: `Net cash ${formatUSD(b.netCash.value)}`,
    personalValue: b.netCash.value,
    label: b.netCash.label,
    company: 'Net cash (or net debt)',
    companyFormula: 'cash − total debt',
    explanation: `Cash (${formatUSD(b.liquidity.value)}) minus everything owed (${formatUSD(b.debt.value)}). Companies with net cash can pay off all debt today; negative means net debt.`,
    lessonId: ANALOGY_LESSONS.net_cash,
  });
  const de = b.debtToNetWorth.value;
  out.push({
    id: 'debt_to_equity',
    personal: de === null ? 'Debt-to-net-worth —' : `Debt-to-net-worth ${de.toFixed(2)}`,
    personalValue: de,
    label: b.debtToNetWorth.label,
    company: 'Debt-to-equity',
    companyFormula: 'total debt ÷ shareholders’ equity',
    explanation: `Your net worth is your "equity". Debt of ${formatUSD(b.debt.value)} against ${formatUSD(b.net.value)} of it; for a company, the same ratio shows how much of the business is funded by lenders.`,
    lessonId: ANALOGY_LESSONS.debt_to_equity,
  });
  out.push({
    id: 'balance_sheet',
    personal: `Net worth ${formatUSD(b.net.value)}`,
    personalValue: b.net.value,
    label: b.net.label,
    company: 'Assets = liabilities + equity',
    companyFormula: 'equity = total assets − total liabilities',
    explanation: `You own ${formatUSD(b.totalAssets.value)} and owe ${formatUSD(b.debt.value)}; what's left (${formatUSD(b.net.value)}) is your equity, exactly like a balance sheet.`,
    lessonId: ANALOGY_LESSONS.balance_sheet,
  });
  const fcf = extras.monthlyFreeCashFlow ?? null;
  out.push({
    id: 'free_cash_flow',
    personal: fcf === null ? 'Monthly free cash flow — (needs 2+ snapshots)' : `Monthly free cash flow ${formatUSD(fcf.value, { signed: true })}`,
    personalValue: fcf?.value ?? null,
    label: fcf ? weakestLabel([fcf.label, 'estimate']) : 'estimate',
    company: 'Free cash flow',
    companyFormula: 'operating cash flow − capex',
    explanation:
      'How much (cash − debt) grows or shrinks per month across your snapshots. A company’s FCF is the cash left after running and maintaining the business; money you move into investments counts like capex here.',
    lessonId: ANALOGY_LESSONS.free_cash_flow,
  });
  return out;
}

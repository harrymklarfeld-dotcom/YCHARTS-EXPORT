/** Plain-English fund facts. Pure functions. */
import type { Fund } from './types';

/** Yearly cost in dollars of holding `amount` at `expenseRatio` (decimal). */
export function yearlyCost(expenseRatio: number | null | undefined, amount = 1000): number | null {
  if (expenseRatio === null || expenseRatio === undefined || !Number.isFinite(expenseRatio) || expenseRatio < 0) return null;
  return expenseRatio * amount;
}

/** "$0.30 per year on $1,000" — cents shown under $10, whole dollars above. */
export function expenseSentence(expenseRatio: number | null | undefined, amount = 1000): string {
  const c = yearlyCost(expenseRatio, amount);
  if (c === null) return 'Fee not available yet';
  const money = c < 10 ? `$${c.toFixed(2)}` : `$${Math.round(c).toLocaleString('en-US')}`;
  return `${money} per year on $${amount.toLocaleString('en-US')}`;
}

export function expensePercent(expenseRatio: number | null | undefined): string {
  if (expenseRatio === null || expenseRatio === undefined || !Number.isFinite(expenseRatio)) return '—';
  return `${(expenseRatio * 100).toFixed(2)}%`;
}

export function holdingsSentence(n: number | null | undefined): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return 'Number of holdings not available';
  if (n === 1) return 'Holds 1 thing';
  return `Owns ${Math.round(n).toLocaleString('en-US')} different investments`;
}

/** Share of the fund in its top `n` listed holdings (decimal). */
export function topShare(f: Pick<Fund, 'top_holdings'>, n = 10): number {
  return f.top_holdings.slice(0, n).reduce((s, h) => s + (h.weight ?? 0), 0);
}

/** "If this fund were one company" sentence pieces; null-safe. */
export function lookThroughSentence(f: Pick<Fund, 'look_through'>): string {
  const lt = f.look_through;
  const parts: string[] = [];
  if (lt.weighted_pe !== null) parts.push(`a P/E of about ${lt.weighted_pe.toFixed(0)}`);
  if (lt.weighted_roic !== null) parts.push(`a return on invested capital near ${Math.round(lt.weighted_roic * 100)}%`);
  if (!parts.length) return 'We can’t look inside this fund with company data yet.';
  return `If this fund were one company, it would have ${parts.join(' and ')}.`;
}

/**
 * Investments: holdings table, allocation, a "what if every dollar had gone into the benchmark"
 * comparison, dividends and the Roth IRA contribution tracker. Descriptive only.
 */
import { addDays, diffDays, shortDate, toDayNumber } from './dates.ts';
import { formatUSD, round2, weakestLabel } from './format.ts';
import type { Holding, ISODate, NumberLabel } from './types.ts';

// ---------------------------------------------------------------- holdings

export type HoldingRow = Holding & {
  value: number;
  /** Share of the total across the holdings passed in. */
  weight: number;
  /** value − costBasis; null when cost is unknown (or for cash). */
  gain: number | null;
  gainPct: number | null;
};

export type HoldingsSummary = {
  rows: HoldingRow[];
  total: number;
  cash: number;
  /** Total gain across rows with a known cost. */
  gain: number | null;
  costKnown: number;
  largest: HoldingRow | null;
  /** Weight of the three largest non-cash positions. */
  top3Weight: number;
  label: NumberLabel;
};

export function holdingsSummary(holdings: readonly Holding[]): HoldingsSummary {
  const valued = holdings.map((h) => ({ h, value: round2(h.kind === 'cash' ? h.shares * (h.price || 1) : h.shares * h.price) }));
  const total = round2(valued.reduce((s, v) => s + v.value, 0));
  const rows: HoldingRow[] = valued
    .map(({ h, value }) => {
      const gain = h.kind !== 'cash' && h.costBasis !== null ? round2(value - h.costBasis) : null;
      return {
        ...h,
        value,
        weight: total > 0 ? round2(value / total) : 0,
        gain,
        gainPct: gain !== null && h.costBasis ? round2(gain / h.costBasis) : null,
      };
    })
    .sort((a, b) => b.value - a.value);
  const invested = rows.filter((r) => r.kind !== 'cash');
  const withCost = invested.filter((r) => r.gain !== null);
  const gainTotal = withCost.length ? round2(withCost.reduce((s, r) => s + (r.gain ?? 0), 0)) : null;
  return {
    rows,
    total,
    cash: round2(rows.filter((r) => r.kind === 'cash').reduce((s, r) => s + r.value, 0)),
    gain: gainTotal,
    costKnown: round2(withCost.reduce((s, r) => s + (r.costBasis ?? 0), 0)),
    largest: invested[0] ?? null,
    top3Weight: round2(invested.slice(0, 3).reduce((s, r) => s + r.weight, 0)),
    label: weakestLabel(holdings.map((h) => h.basis)),
  };
}

export type AllocationSlice = { key: string; value: number; weight: number };

/** Group holdings by asset class (default), ticker or account. Largest first. */
export function allocation(holdings: readonly Holding[], by: 'assetClass' | 'ticker' | 'accountId' = 'assetClass'): AllocationSlice[] {
  const m = new Map<string, number>();
  let total = 0;
  for (const h of holdings) {
    const value = h.shares * (h.kind === 'cash' ? h.price || 1 : h.price);
    const key = by === 'assetClass' ? h.assetClass ?? (h.kind === 'cash' ? 'Cash' : h.kind) : by === 'ticker' ? h.ticker ?? 'Cash' : h.accountId;
    m.set(key, (m.get(key) ?? 0) + value);
    total += value;
  }
  return [...m.entries()]
    .map(([key, value]) => ({ key, value: round2(value), weight: total > 0 ? round2(value / total) : 0 }))
    .sort((a, b) => b.value - a.value || a.key.localeCompare(b.key));
}

// ---------------------------------------------------------------- benchmark

export type PricePoint = { date: ISODate; price: number };
export type ValuePoint = { date: ISODate; value: number };
export type Contribution = { date: ISODate; amount: number; accountId?: string };

export type BenchmarkPoint = { date: ISODate; actual: number; benchmark: number; contributed: number };

export type BenchmarkComparison = {
  ticker: string;
  series: BenchmarkPoint[];
  contributed: number;
  actualGain: number;
  benchmarkGain: number;
  /** Gain ÷ (starting value + contributions). Simple, not time-weighted. */
  actualReturn: number | null;
  benchmarkReturn: number | null;
  label: NumberLabel;
  sentence: string;
};

/** Last price on or before `date` (or the first price if `date` is earlier). */
export function priceOn(prices: readonly PricePoint[], date: ISODate): number | null {
  if (!prices.length) return null;
  const sorted = [...prices].sort((a, b) => (a.date < b.date ? -1 : 1));
  let p = sorted[0]!.price;
  for (const x of sorted) {
    if (x.date <= date) p = x.price;
    else break;
  }
  return p;
}

/**
 * "What if every dollar had gone into `ticker` instead?" The starting value and each later
 * contribution are converted to benchmark shares at that day's price; the benchmark line is
 * those shares × price at each actual point. Always an ESTIMATE (it ignores dividends and fees).
 */
export function benchmarkComparison(
  values: readonly ValuePoint[],
  contributions: readonly Contribution[],
  prices: readonly PricePoint[],
  ticker = 'VOO',
): BenchmarkComparison | null {
  const pts = [...values].sort((a, b) => (a.date < b.date ? -1 : 1));
  if (pts.length < 2 || !prices.length) return null;
  const first = pts[0]!;
  const p0 = priceOn(prices, first.date)!;
  let shares = first.value / p0;
  let contributed = 0;
  const flows = contributions.filter((c) => c.date > first.date).sort((a, b) => (a.date < b.date ? -1 : 1));
  let fi = 0;
  const series: BenchmarkPoint[] = [];
  for (const pt of pts) {
    while (fi < flows.length && flows[fi]!.date <= pt.date) {
      const f = flows[fi]!;
      shares += f.amount / priceOn(prices, f.date)!;
      contributed += f.amount;
      fi++;
    }
    series.push({ date: pt.date, actual: round2(pt.value), benchmark: round2(shares * priceOn(prices, pt.date)!), contributed: round2(contributed) });
  }
  const last = series[series.length - 1]!;
  const basis = first.value + contributed;
  const actualGain = round2(last.actual - basis);
  const benchmarkGain = round2(last.benchmark - basis);
  const ar = basis > 0 ? round2(actualGain / basis) : null;
  const br = basis > 0 ? round2(benchmarkGain / basis) : null;
  const diff = round2(last.actual - last.benchmark);
  return {
    ticker,
    series,
    contributed: round2(contributed),
    actualGain,
    benchmarkGain,
    actualReturn: ar,
    benchmarkReturn: br,
    label: 'estimate',
    sentence:
      `Since ${shortDate(first.date)}, the accounts grew to ${formatUSD(last.actual)}. The same starting value and deposits placed in ${ticker} on the same days ` +
      `would be about ${formatUSD(last.benchmark)} (${diff >= 0 ? `${formatUSD(diff)} less` : `${formatUSD(-diff)} more`}). Past results say nothing certain about the future.`,
  };
}

// ---------------------------------------------------------------- dividends

export type Dividend = { date: ISODate; ticker: string; accountId: string; amount: number };

export type DividendSummary = {
  trailing12m: number;
  byTicker: { ticker: string; total: number; count: number }[];
  recent: Dividend[];
  /** Trailing 12-month dividends ÷ current holdings value (the portfolio's cash yield). */
  yieldOnValue: number | null;
  label: NumberLabel;
};

export function dividendSummary(divs: readonly Dividend[], asOf: ISODate, holdingsValue?: number): DividendSummary {
  const from = addDays(asOf, -365);
  const inWindow = divs.filter((d) => d.date > from && d.date <= asOf);
  const m = new Map<string, { total: number; count: number }>();
  for (const d of inWindow) {
    const c = m.get(d.ticker) ?? { total: 0, count: 0 };
    c.total += d.amount;
    c.count += 1;
    m.set(d.ticker, c);
  }
  const t12 = round2(inWindow.reduce((s, d) => s + d.amount, 0));
  return {
    trailing12m: t12,
    byTicker: [...m.entries()].map(([ticker, v]) => ({ ticker, total: round2(v.total), count: v.count })).sort((a, b) => b.total - a.total),
    recent: [...inWindow].sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, 6),
    yieldOnValue: holdingsValue && holdingsValue > 0 ? round2(t12 / holdingsValue * 10000) / 10000 : null,
    label: 'verified',
  };
}

// ---------------------------------------------------------------- Roth IRA

/**
 * Annual IRA contribution limits (Roth + traditional combined, under age 50).
 * Sources: IRS Notice 2024-80 (2025: $7,000); IRS Notice 2025-67, Nov 2025 (2026: $7,500).
 * Update each year from irs.gov ("Retirement topics – IRA contribution limits").
 * Contributions are also capped at earned income for the year, and Roth eligibility phases out
 * at higher incomes.
 */
export const IRA_CONTRIBUTION_LIMITS: Readonly<Record<number, { limit: number; source: string }>> = {
  2025: { limit: 7000, source: 'IRS Notice 2024-80' },
  2026: { limit: 7500, source: 'IRS Notice 2025-67' },
};

export type RothTracker = {
  year: number;
  contributed: number;
  limit: number | null;
  /** Lower of the IRS limit and earned income, when earned income is given. */
  effectiveLimit: number | null;
  remaining: number | null;
  progress: number | null;
  source: string | null;
  notes: string[];
};

/** Contributions counted toward tax year `year` (each contribution may carry its own `taxYear`). */
export function rothTracker(
  contributions: readonly (Contribution & { taxYear?: number })[],
  year: number,
  opts: { earnedIncome?: number; limits?: Readonly<Record<number, { limit: number; source: string }>> } = {},
): RothTracker {
  const limits = opts.limits ?? IRA_CONTRIBUTION_LIMITS;
  const contributed = round2(contributions.filter((c) => (c.taxYear ?? Number(c.date.slice(0, 4))) === year).reduce((s, c) => s + c.amount, 0));
  const entry = limits[year];
  const limit = entry?.limit ?? null;
  const eff = limit === null ? null : opts.earnedIncome !== undefined ? Math.min(limit, Math.max(0, opts.earnedIncome)) : limit;
  const notes = [
    entry ? `${year} limit: ${formatUSD(entry.limit)} across all your IRAs (${entry.source}).` : `No limit on file for ${year}.`,
    'Contributions for a year cannot exceed your earned income for that year.',
    'Contributions for a tax year can be made until that year’s tax filing deadline.',
  ];
  return {
    year,
    contributed,
    limit,
    effectiveLimit: eff,
    remaining: eff === null ? null : round2(Math.max(0, eff - contributed)),
    progress: eff ? round2(Math.min(1, contributed / eff)) : null,
    source: entry?.source ?? null,
    notes,
  };
}

/** Days since the latest `asOf` among dated items (freshness). */
export function daysStale(dates: readonly ISODate[], today: ISODate): number | null {
  if (!dates.length) return null;
  const newest = dates.reduce((a, b) => (toDayNumber(b) > toDayNumber(a) ? b : a));
  return Math.max(0, diffDays(newest, today));
}

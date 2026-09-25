import { getMetricInfo } from './catalog.ts';
import { getValue } from './engine.ts';
import { isNum } from './format.ts';
import type { Company, FieldKey } from './types.ts';

/** Median of the finite numbers in `values`; null if there are none. */
export function median(values: ReadonlyArray<number | null | undefined>): number | null {
  const xs = values.filter(isNum).sort((a, b) => a - b);
  if (xs.length === 0) return null;
  const mid = Math.floor(xs.length / 2);
  return xs.length % 2 === 1 ? xs[mid]! : (xs[mid - 1]! + xs[mid]!) / 2;
}

/** Median of `metric` across companies in `sector` (case-insensitive); null if no data. */
export function sectorMedian(
  companies: readonly Company[],
  sector: string,
  metric: FieldKey,
): number | null {
  const s = sector.trim().toLowerCase();
  return median(
    companies.filter((c) => c.sector?.trim().toLowerCase() === s).map((c) => getValue(c, metric)),
  );
}

export interface PeerOptions {
  /**
   * Restrict the peer group: 'sector' = same sector as the target company,
   * any other string = that sector name. Omit for all companies.
   */
  sector?: 'sector' | string;
}

function findTicker(companies: readonly Company[], ticker: string): Company | undefined {
  const t = ticker.trim().toUpperCase();
  return companies.find((c) => c.ticker.toUpperCase() === t);
}

function peerGroup(companies: readonly Company[], target: Company, opts: PeerOptions): Company[] {
  const others = companies.filter((c) => c !== target && c.ticker.toUpperCase() !== target.ticker.toUpperCase());
  if (opts.sector === undefined) return others;
  const s = (opts.sector === 'sector' ? target.sector : opts.sector).trim().toLowerCase();
  return others.filter((c) => c.sector?.trim().toLowerCase() === s);
}

/**
 * Percent (0–100) of OTHER companies with data whose value is strictly below
 * the target's. Ties count as neither above nor below.
 *
 * Returns null when the ticker is unknown, its value is null, or no peer has data.
 *
 * Example: P/E percentileRank 20 means 80% (minus ties) of peers have a higher
 * P/E — "cheaper than ~80% of peers" by that measure.
 */
export function percentileRank(
  companies: readonly Company[],
  metric: FieldKey,
  ticker: string,
  opts: PeerOptions = {},
): number | null {
  const cmp = compareToPeers(companies, metric, ticker, opts);
  return cmp ? cmp.pctBelow : null;
}

export interface PeerComparison {
  ticker: string;
  metric: FieldKey;
  value: number;
  /** Peers with data (excludes the target). */
  peerCount: number;
  /** % of peers with a strictly lower value. */
  pctBelow: number;
  /** % of peers with a strictly higher value. */
  pctAbove: number;
  /** Median of the peers (excluding the target). */
  peerMedian: number | null;
  /** e.g. "Technology companies" or "companies". */
  groupLabel: string;
  /** Beginner-friendly sentence, e.g. "By P/E, cheaper than 80% of Technology companies." */
  sentence: string;
}

const CHEAP_WHEN_LOW = new Set<string>(['pe', 'ps', 'pb', 'ev_ebitda']);
const CHEAP_WHEN_HIGH = new Set<string>(['fcf_yield', 'earnings_yield']);

function pct(n: number, d: number): number {
  return Math.round((n / d) * 1000) / 10; // one decimal place
}

function wholePct(p: number): string {
  return `${Math.round(p)}%`;
}

/**
 * Rich comparison for UI copy such as "cheaper than 80% of Tech companies".
 * Returns null when the comparison cannot be made (unknown ticker, null value, no peers with data).
 */
export function compareToPeers(
  companies: readonly Company[],
  metric: FieldKey,
  ticker: string,
  opts: PeerOptions = {},
): PeerComparison | null {
  const target = findTicker(companies, ticker);
  if (!target) return null;
  const value = getValue(target, metric);
  if (value === null) return null;
  const peerValues = peerGroup(companies, target, opts)
    .map((c) => getValue(c, metric))
    .filter((v): v is number => v !== null);
  if (peerValues.length === 0) return null;

  const below = peerValues.filter((v) => v < value).length;
  const above = peerValues.filter((v) => v > value).length;
  const pctBelow = pct(below, peerValues.length);
  const pctAbove = pct(above, peerValues.length);

  const sectorName = opts.sector === undefined ? null : opts.sector === 'sector' ? target.sector : opts.sector;
  const groupLabel = sectorName ? `${sectorName} companies` : 'companies';

  const info = getMetricInfo(metric);
  const name = info?.shortLabel ?? metric;
  const shown = info ? info.format(value) : String(value);
  let sentence: string;
  if (CHEAP_WHEN_LOW.has(metric)) {
    sentence = `By ${name} (${shown}), cheaper than ${wholePct(pctAbove)} of ${groupLabel}.`;
  } else if (CHEAP_WHEN_HIGH.has(metric)) {
    sentence = `By ${name} (${shown}), cheaper than ${wholePct(pctBelow)} of ${groupLabel}.`;
  } else if (info?.higherIsBetter === false) {
    sentence = `${name} of ${shown} is lower than ${wholePct(pctAbove)} of ${groupLabel}.`;
  } else {
    sentence = `${name} of ${shown} is higher than ${wholePct(pctBelow)} of ${groupLabel}.`;
  }

  return {
    ticker: target.ticker,
    metric,
    value,
    peerCount: peerValues.length,
    pctBelow,
    pctAbove,
    peerMedian: median(peerValues),
    groupLabel,
    sentence,
  };
}

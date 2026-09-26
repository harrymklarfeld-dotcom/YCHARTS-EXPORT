/**
 * RangeBar data: where a company sits between the lowest and highest value of its peers.
 * Percentile text comes from the shared screener package's compareToPeers.
 */
import {
  compareToPeers,
  getMetricInfo,
  getValue,
  type Company as EngineCompany,
  type FieldKey,
} from '../../../packages/screener/src/index';

export type RangeScope = 'sector' | 'all';

export type RangeInfo = {
  metric: string;
  value: number;
  min: number;
  max: number;
  median: number | null;
  /** 0..1 position of the value on the min→max track. */
  position: number;
  pctBelow: number;
  pctAbove: number;
  peerCount: number;
  groupLabel: string;
  sentence: string;
  /** The scope actually used (falls back to 'all' when the sector is too small). */
  scope: RangeScope;
};

export const RANGE_METRICS = ['pe', 'fcf_yield', 'gross_margin', 'operating_margin', 'roic', 'revenue_growth_yoy'] as const;
export const MIN_SECTOR_PEERS = 2;

type AnyCompany = { ticker: string; sector?: string | null };

export function rangeFor(companiesIn: AnyCompany[], metric: string, ticker: string, scope: RangeScope = 'sector'): RangeInfo | null {
  const companies = companiesIn as unknown as EngineCompany[];
  const target = companies.find((c) => c.ticker.toUpperCase() === ticker.toUpperCase());
  if (!target) return null;
  let used: RangeScope = scope;
  let cmp = scope === 'sector' ? compareToPeers(companies, metric as FieldKey, ticker, { sector: 'sector' }) : null;
  if (!cmp || cmp.peerCount < MIN_SECTOR_PEERS) {
    cmp = compareToPeers(companies, metric as FieldKey, ticker);
    used = 'all';
  }
  if (!cmp) return null;
  const sector = (target.sector ?? '').trim().toLowerCase();
  const group = companies.filter((c) => used === 'all' || (c.sector ?? '').trim().toLowerCase() === sector);
  const vals = group.map((c) => getValue(c, metric as FieldKey)).filter((v): v is number => v !== null);
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const position = max > min ? (cmp.value - min) / (max - min) : 0.5;
  return {
    metric,
    value: cmp.value,
    min,
    max,
    median: cmp.peerMedian,
    position: Math.max(0, Math.min(1, position)),
    pctBelow: cmp.pctBelow,
    pctAbove: cmp.pctAbove,
    peerCount: cmp.peerCount,
    groupLabel: cmp.groupLabel,
    sentence: edgeSentence(metric, cmp.value, cmp.pctBelow, cmp.pctAbove, cmp.peerCount, cmp.groupLabel) ?? cmp.sentence,
    scope: used,
  };
}

/** At either end of the range, "cheaper than 0%" reads badly: say "highest/lowest" instead. */
export function edgeSentence(metric: string, value: number, pctBelow: number, pctAbove: number, peerCount: number, groupLabel: string): string | null {
  if (peerCount < 1) return null;
  const info = getMetricInfo(metric);
  const name = info?.shortLabel ?? metric;
  const shown = info ? info.format(value) : String(value);
  const of = `of the ${peerCount + 1} ${groupLabel} we cover`;
  if (pctAbove === 0 && pctBelow > 0) return `Highest ${name} (${shown}) ${of}.`;
  if (pctBelow === 0 && pctAbove > 0) return `Lowest ${name} (${shown}) ${of}.`;
  return null;
}

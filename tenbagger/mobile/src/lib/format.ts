import type { QuestionUnit } from '../types/contract';

export type ValueFormat = 'usd' | 'percent' | 'multiple' | 'ratio' | 'per_share' | 'count';

const DASH = '—';

export function formatUsdCompact(v: number | null | undefined, digits = 1): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return DASH;
  const sign = v < 0 ? '−' : '';
  const a = Math.abs(v);
  if (a >= 1e12) return `${sign}$${(a / 1e12).toFixed(digits)}T`;
  if (a >= 1e9) return `${sign}$${(a / 1e9).toFixed(digits)}B`;
  if (a >= 1e6) return `${sign}$${(a / 1e6).toFixed(digits)}M`;
  if (a >= 1e3) return `${sign}$${(a / 1e3).toFixed(digits)}K`;
  return `${sign}$${a.toFixed(2)}`;
}

export function formatPercent(v: number | null | undefined, digits = 1): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return DASH;
  const s = (v * 100).toFixed(digits);
  return `${v < 0 ? s.replace('-', '−') : s}%`;
}

export function formatMultiple(v: number | null | undefined, digits = 1): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return DASH;
  return `${v.toFixed(digits)}×`;
}

export function formatCount(v: number | null | undefined): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return DASH;
  const a = Math.abs(v);
  if (a >= 1e9) return `${(v / 1e9).toFixed(2)}B`;
  if (a >= 1e6) return `${(v / 1e6).toFixed(1)}M`;
  return v.toLocaleString('en-US');
}

export function formatValue(v: number | null | undefined, fmt: ValueFormat): string {
  switch (fmt) {
    case 'usd':
      return formatUsdCompact(v);
    case 'per_share':
      return v === null || v === undefined || !Number.isFinite(v) ? DASH : `$${v.toFixed(2)}`;
    case 'percent':
      return formatPercent(v);
    case 'multiple':
      return formatMultiple(v);
    case 'ratio':
      return v === null || v === undefined || !Number.isFinite(v) ? DASH : v.toFixed(2);
    case 'count':
      return formatCount(v);
  }
}

export function formatForUnit(v: number, unit: QuestionUnit | undefined): string {
  switch (unit) {
    case 'percent':
      return formatPercent(v, 1);
    case 'usd':
      return formatUsdCompact(v, 2);
    case 'multiple':
      return formatMultiple(v, 1);
    default:
      return String(v);
  }
}

/** "Source: COST FY2025 10-K · gross_profit / revenue" */
export function sourceLabel(src: { ticker: string; fy: number; formula?: string; metrics?: string[] }): string {
  const what = src.formula ?? src.metrics?.join(', ') ?? '';
  return `Source: ${src.ticker} FY${src.fy} 10-K${what ? ` · ${what}` : ''}`;
}

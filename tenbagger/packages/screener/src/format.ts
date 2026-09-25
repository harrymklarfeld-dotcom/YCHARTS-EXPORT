/**
 * Small, locale-independent number formatters (no Intl, so output is identical
 * on Node, Hermes and JSC).
 */

export type Unit = 'percent' | 'usd' | 'multiple' | 'ratio' | 'count';

export const MISSING = '—';

export function isNum(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v);
}

function trimZeros(s: string): string {
  return s.includes('.') ? s.replace(/\.?0+$/, '') : s;
}

function compact(abs: number): string {
  const tiers: Array<[number, string]> = [
    [1e12, 'T'],
    [1e9, 'B'],
    [1e6, 'M'],
    [1e3, 'K'],
  ];
  for (const [size, suffix] of tiers) {
    // Threshold slightly below the tier so 999.96M renders as "1B", not "1000M".
    if (abs >= size * 0.9995) {
      const n = abs / size;
      const digits = n >= 99.95 ? 0 : 1; // 1.2B, 12.3B, 254B
      return trimZeros(n.toFixed(digits)) + suffix;
    }
  }
  return '';
}

/** 0.312 -> "31%", 0.0456 -> "4.6%", -0.05 -> "-5%". */
export function formatPercent(v: number | null | undefined): string {
  if (!isNum(v)) return MISSING;
  const pct = v * 100;
  const digits = Math.abs(pct) >= 10 ? 0 : 1;
  const s = trimZeros(pct.toFixed(digits));
  return (s === '-0' ? '0' : s) + '%';
}

/** 254e9 -> "$254B", 3.456 -> "$3.46", -1.2e9 -> "-$1.2B". */
export function formatUsd(v: number | null | undefined): string {
  if (!isNum(v)) return MISSING;
  const sign = v < 0 ? '-' : '';
  const abs = Math.abs(v);
  if (abs >= 1e3) {
    const c = compact(abs);
    if (c) return `${sign}$${c}`;
  }
  const s = abs.toFixed(2);
  return s === '0.00' ? '$0' : `${sign}$${s}`;
}

/** 18.23 -> "18.2x", 25 -> "25x". */
export function formatMultiple(v: number | null | undefined): string {
  if (!isNum(v)) return MISSING;
  const s = trimZeros(v.toFixed(1));
  return (s === '-0' ? '0' : s) + 'x';
}

/** 1.5 -> "1.50". */
export function formatRatio(v: number | null | undefined): string {
  if (!isNum(v)) return MISSING;
  const s = v.toFixed(2);
  return s === '-0.00' ? '0.00' : s;
}

/** 1.1e9 -> "1.1B". */
export function formatCount(v: number | null | undefined): string {
  if (!isNum(v)) return MISSING;
  const sign = v < 0 ? '-' : '';
  const abs = Math.abs(v);
  if (abs >= 1e3) return sign + compact(abs);
  return sign + trimZeros(abs.toFixed(2));
}

export function formatByUnit(unit: Unit, v: number | null | undefined): string {
  switch (unit) {
    case 'percent':
      return formatPercent(v);
    case 'usd':
      return formatUsd(v);
    case 'multiple':
      return formatMultiple(v);
    case 'ratio':
      return formatRatio(v);
    case 'count':
      return formatCount(v);
  }
}

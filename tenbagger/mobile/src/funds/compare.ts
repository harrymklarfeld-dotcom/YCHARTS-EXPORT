/**
 * Pure transforms for the multi-company CompareChart.
 *
 * Modes:
 * - raw      the reported values
 * - indexed  each line rebased to 100 at its first positive value (growth race)
 * - yoy      year-over-year change: % growth for dollar/EPS metrics (null when the prior
 *            year is ≤ 0, like CONTRACT growth); percentage-point change for margins
 */
import type { HistoryKey, HistoryPoint } from '../types/contract';

export type CompareMode = 'raw' | 'indexed' | 'yoy';
export type ComparePoint = { fy: number; value: number | null };
export type CompareSeries = { ticker: string; points: ComparePoint[] };
export type CompanyHistoryLike = { ticker: string; history: Partial<Record<HistoryKey, HistoryPoint[]>> };

export const COMPARE_METRICS: { key: HistoryKey; label: string; kind: 'usd' | 'per_share' | 'ratio' }[] = [
  { key: 'revenue', label: 'Revenue', kind: 'usd' },
  { key: 'net_income', label: 'Net income', kind: 'usd' },
  { key: 'free_cash_flow', label: 'Free cash flow', kind: 'usd' },
  { key: 'eps_diluted', label: 'EPS (diluted)', kind: 'per_share' },
  { key: 'gross_margin', label: 'Gross margin', kind: 'ratio' },
  { key: 'operating_margin', label: 'Operating margin', kind: 'ratio' },
  { key: 'total_debt', label: 'Total debt', kind: 'usd' },
  { key: 'cash', label: 'Cash', kind: 'usd' },
];

export const MAX_COMPARE = 3;

export function metricKind(metric: HistoryKey): 'usd' | 'per_share' | 'ratio' {
  return COMPARE_METRICS.find((m) => m.key === metric)?.kind ?? 'usd';
}

const fin = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

export function rawPoints(h: HistoryPoint[] | undefined | null): ComparePoint[] {
  if (!Array.isArray(h)) return [];
  const seen = new Map<number, number | null>();
  for (const p of h) {
    if (!Array.isArray(p) || !fin(p[0])) continue;
    seen.set(p[0], fin(p[1]) ? p[1] : null);
  }
  return [...seen.entries()].sort((a, b) => a[0] - b[0]).map(([fy, value]) => ({ fy, value }));
}

/** Rebase to 100 at the first positive value. Points before the base are null. */
export function indexTo100(points: ComparePoint[]): ComparePoint[] {
  const baseIdx = points.findIndex((p) => fin(p.value) && p.value > 0);
  if (baseIdx < 0) return points.map((p) => ({ fy: p.fy, value: null }));
  const base = points[baseIdx].value as number;
  return points.map((p, i) => ({ fy: p.fy, value: i < baseIdx || !fin(p.value) ? null : (p.value / base) * 100 }));
}

/** YoY change vs. the immediately preceding fiscal year (gaps → null). */
export function yoy(points: ComparePoint[], kind: 'usd' | 'per_share' | 'ratio'): ComparePoint[] {
  const by = new Map(points.map((p) => [p.fy, p.value]));
  return points.map((p) => {
    const prev = by.get(p.fy - 1);
    if (!fin(p.value) || !fin(prev)) return { fy: p.fy, value: null };
    if (kind === 'ratio') return { fy: p.fy, value: p.value - prev };
    return { fy: p.fy, value: prev > 0 ? p.value / prev - 1 : null };
  });
}

export function transform(points: ComparePoint[], mode: CompareMode, kind: 'usd' | 'per_share' | 'ratio'): ComparePoint[] {
  if (mode === 'indexed') return indexTo100(points);
  if (mode === 'yoy') return yoy(points, kind);
  return points;
}

export function buildSeries(companies: CompanyHistoryLike[], tickers: string[], metric: HistoryKey, mode: CompareMode): CompareSeries[] {
  const kind = metricKind(metric);
  const out: CompareSeries[] = [];
  for (const t of tickers.slice(0, MAX_COMPARE)) {
    const c = companies.find((x) => x.ticker.toUpperCase() === t.toUpperCase());
    if (!c) continue;
    out.push({ ticker: c.ticker, points: transform(rawPoints(c.history?.[metric]), mode, kind) });
  }
  return out;
}

/** Sorted union of fiscal years across series. */
export function yearsOf(series: CompareSeries[]): number[] {
  return [...new Set(series.flatMap((s) => s.points.map((p) => p.fy)))].sort((a, b) => a - b);
}

export function valueAt(s: CompareSeries, fy: number): number | null {
  const p = s.points.find((x) => x.fy === fy);
  return p && fin(p.value) ? p.value : null;
}

/** Last non-null point of a series (for end labels). */
export function lastPoint(s: CompareSeries): ComparePoint | null {
  for (let i = s.points.length - 1; i >= 0; i--) if (fin(s.points[i].value)) return s.points[i];
  return null;
}

/** "Nice" axis ticks covering [min, max], always including 0 when the data crosses it. */
export function niceTicks(min: number, max: number, count = 4): number[] {
  if (!fin(min) || !fin(max)) return [0, 1];
  if (min === max) {
    const pad = Math.abs(min) * 0.1 || 1;
    min -= pad;
    max += pad;
  }
  const span = max - min;
  const raw = span / Math.max(1, count);
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const norm = raw / mag;
  const step = (norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 2.5 ? 2.5 : norm <= 5 ? 5 : 10) * mag;
  const lo = Math.floor(min / step) * step;
  const hi = Math.ceil(max / step) * step;
  const ticks: number[] = [];
  for (let v = lo; v <= hi + step / 2; v += step) ticks.push(Math.abs(v) < step / 1e6 ? 0 : Number(v.toPrecision(12)));
  return ticks;
}

export function domainOf(series: CompareSeries[], mode: CompareMode): { min: number; max: number } {
  const vals = series.flatMap((s) => s.points.map((p) => p.value)).filter(fin);
  if (!vals.length) return { min: 0, max: 1 };
  let min = Math.min(...vals);
  let max = Math.max(...vals);
  if (mode === 'raw' || mode === 'yoy') {
    min = Math.min(min, 0);
    max = Math.max(max, 0);
  }
  return { min, max };
}

/** Format a transformed value for the given mode + metric kind. */
export function formatCompare(v: number | null | undefined, mode: CompareMode, kind: 'usd' | 'per_share' | 'ratio'): string {
  if (!fin(v)) return '—';
  const neg = v < 0 ? '−' : '';
  const a = Math.abs(v);
  if (mode === 'indexed') return `${neg}${a.toFixed(0)}`;
  if (mode === 'yoy') {
    if (kind === 'ratio') return `${v >= 0 ? '+' : '−'}${(a * 100).toFixed(1)} pts`;
    return `${v >= 0 ? '+' : '−'}${(a * 100).toFixed(0)}%`;
  }
  if (kind === 'ratio') return `${neg}${(a * 100).toFixed(1)}%`;
  if (kind === 'per_share') return `${neg}$${a.toFixed(2)}`;
  if (a >= 1e12) return `${neg}$${(a / 1e12).toFixed(1)}T`;
  if (a >= 1e9) return `${neg}$${(a / 1e9).toFixed(a >= 1e11 ? 0 : 1)}B`;
  if (a >= 1e6) return `${neg}$${(a / 1e6).toFixed(0)}M`;
  return `${neg}$${a.toFixed(0)}`;
}

/**
 * Spread end labels vertically so they don't overlap. Input: desired y per label (px).
 * Output: adjusted y in the same order, at least `gap` apart, clamped to [top, bottom].
 */
export function spreadLabels(ys: number[], gap: number, top: number, bottom: number): number[] {
  const order = ys.map((y, i) => ({ y, i })).sort((a, b) => a.y - b.y);
  for (let k = 1; k < order.length; k++) if (order[k].y - order[k - 1].y < gap) order[k].y = order[k - 1].y + gap;
  const overflow = order.length ? order[order.length - 1].y - bottom : 0;
  if (overflow > 0) for (const o of order) o.y -= overflow;
  for (let k = 0; k < order.length; k++) if (order[k].y < top) order[k].y = top + k * gap;
  const out = new Array<number>(ys.length);
  for (const o of order) out[o.i] = o.y;
  return out;
}

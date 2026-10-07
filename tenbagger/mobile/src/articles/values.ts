/** Read catalog metrics off a company (pure; tested). `price` lives at the company's top level. */
import { formatValue, type ValueFormat } from '../lib/format';
import type { Company } from '../types/contract';
import type { CatalogEntry } from './types';

export function metricValue(c: Company, key: string, catalog: Record<string, CatalogEntry>): number | null {
  if (key === 'price') return typeof c.price === 'number' && Number.isFinite(c.price) ? c.price : null;
  const info = catalog[key];
  const bag = (info?.source === 'fundamentals' ? c.fundamentals : info?.source === 'metrics' ? c.metrics : { ...c.fundamentals, ...c.metrics }) as Record<string, number | null | undefined>;
  const v = bag?.[key];
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

export function formatMetric(v: number | null, key: string, catalog: Record<string, CatalogEntry>): string {
  const fmt: ValueFormat = catalog[key]?.format ?? 'ratio';
  return formatValue(v, fmt);
}

/**
 * "gross profit / revenue = $15.0B / $37.4B = 40.1%" when the catalog lists `terms`,
 * otherwise just the formula. Returns { formula, worked } where `worked` may be null.
 */
export function workedFormula(c: Company, key: string, catalog: Record<string, CatalogEntry>): { formula: string; worked: string | null } {
  const info = catalog[key];
  if (!info) return { formula: '', worked: null };
  if (!info.terms) return { formula: info.formula, worked: null };
  const [a, b] = info.terms;
  const va = metricValue(c, a, catalog);
  const vb = metricValue(c, b, catalog);
  if (va === null || vb === null) return { formula: info.formula, worked: null };
  const op = info.op ?? '/';
  return {
    formula: info.formula,
    worked: `${formatMetric(va, a, catalog)} ${op} ${formatMetric(vb, b, catalog)} = ${formatMetric(metricValue(c, key, catalog), key, catalog)}`,
  };
}

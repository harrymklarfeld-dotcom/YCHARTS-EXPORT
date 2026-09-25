/**
 * Build-time helpers for article widgets: metric catalog (from content/widgets.json,
 * falling back to the screener catalog), data provenance, and value lookup.
 */
import fs from 'node:fs';
import site from '../../site.config.ts';
import { companiesFile, fromWeb, type Company } from './data.ts';
import { METRIC_CATALOG } from '../../../packages/screener/src/index.ts';
import type { WFormat } from './wformat.ts';

export type WMetric = { label: string; short: string; format: WFormat; source: string; formula?: string; terms?: string[]; op?: string };

type Spec = { provenance?: { real_fixture_tickers?: string[] }; metrics?: Record<string, WMetric> };

let _spec: Spec | null = null;
function spec(): Spec {
  if (_spec) return _spec;
  try {
    _spec = JSON.parse(fs.readFileSync(fromWeb(site.data.widgetsSpec), 'utf8')) as Spec;
  } catch {
    _spec = {};
  }
  return _spec;
}

const UNIT_TO_FORMAT: Record<string, WFormat> = { percent: 'percent', usd: 'usd', multiple: 'multiple', ratio: 'ratio', count: 'count' };

export function wmetric(key: string): WMetric | null {
  const m = spec().metrics?.[key];
  if (m) return m;
  if (key === 'price') return { label: 'Share price', short: 'Price', format: 'per_share', source: 'company' };
  const info = METRIC_CATALOG.find((x) => x.key === key);
  if (!info) return null;
  return {
    label: info.label,
    short: info.shortLabel,
    format: key === 'eps_diluted' ? 'per_share' : (UNIT_TO_FORMAT[info.unit] ?? 'ratio'),
    source: info.source === 'metric' ? 'metrics' : 'fundamentals',
    formula: info.formula,
  };
}

export function value(c: Company, key: string): number | null {
  if (key === 'price') return c.price ?? null;
  const v = (c.metrics as Record<string, unknown>)[key] ?? (c.fundamentals as Record<string, unknown>)[key];
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

/**
 * Per WIDGETS.md: a company's fundamentals are "sample" when companies.json came
 * from fixtures and the ticker isn't in provenance.real_fixture_tickers, unless
 * the company carries its own `fundamentals_is_sample` flag.
 */
export function isSampleFundamentals(c: Company): boolean {
  const own = (c as unknown as Record<string, unknown>).fundamentals_is_sample;
  if (typeof own === 'boolean') return own;
  if (companiesFile().source !== 'fixture') return false;
  const real = spec().provenance?.real_fixture_tickers ?? [];
  return !real.includes(c.ticker);
}

export function historySeries(c: Company, key: string): Array<[number, number | null]> {
  return ((c.history ?? {}) as Record<string, Array<[number, number | null]> | undefined>)[key] ?? [];
}

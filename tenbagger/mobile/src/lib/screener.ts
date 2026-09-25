/**
 * Thin LOCAL screener adapter.
 *
 * The real engine lives in tenbagger/packages/screener (pure TS, no deps) and exports
 * `runScreen(companies, screen)`, `PRESET_SCREENS` and `METRIC_CATALOG`. Until it lands, this
 * file implements the same surface against the CONTRACT.md Filter/Screen shapes.
 *
 * To swap: replace the body of this file with
 *   export { runScreen, PRESET_SCREENS } from '../../../packages/screener/src';
 * (keep `getMetricValue`/`describeFilter` or re-export the package's equivalents). Screens only
 * import from here, so nothing else changes. The friendly labels/explainers stay in
 * ./metricCatalog (the UI's copy), and can be merged with the package's catalog.
 */
import type { Company, Filter, MetricKey, Screen } from '../types/contract';
import { METRIC_BY_KEY, METRIC_CATALOG } from './metricCatalog';
import { formatValue } from './format';
import {
  PRESET_SCREENS as ENGINE_PRESETS,
  runScreen as engineRunScreen,
  type Company as EngineCompany,
  type Screen as EngineScreen,
} from '../../../packages/screener/src/index';

export { METRIC_CATALOG };

export function getMetricValue(c: Company, key: MetricKey | string): number | null {
  const m = (c.metrics as Record<string, number | null | undefined>)[key];
  if (m !== undefined) return m ?? null;
  const f = (c.fundamentals as Record<string, number | null | undefined>)[key];
  if (f !== undefined) return f ?? null;
  return null;
}

export function passesFilter(c: Company, f: Filter): boolean {
  const v = getMetricValue(c, f.metric);
  if (v === null || !Number.isFinite(v)) return false; // unknown never passes
  const val = f.value;
  switch (f.op) {
    case '>':
      return typeof val === 'number' && v > val;
    case '>=':
      return typeof val === 'number' && v >= val;
    case '<':
      return typeof val === 'number' && v < val;
    case '<=':
      return typeof val === 'number' && v <= val;
    case '==':
      return typeof val === 'number' && Math.abs(v - val) < 1e-9;
    case 'between': {
      if (!Array.isArray(val)) return false;
      const lo = Math.min(val[0], val[1]);
      const hi = Math.max(val[0], val[1]);
      return v >= lo && v <= hi;
    }
  }
}

export type ScreenResult = { company: Company; sortValue: number | null };

export function sortCompanies(companies: Company[], metric: string, dir: 'asc' | 'desc'): Company[] {
  return [...companies].sort((a, b) => {
    const va = getMetricValue(a, metric);
    const vb = getMetricValue(b, metric);
    if (va === null && vb === null) return a.ticker.localeCompare(b.ticker);
    if (va === null) return 1; // nulls last regardless of direction
    if (vb === null) return -1;
    return dir === 'asc' ? va - vb : vb - va;
  });
}

export function runScreen(companies: Company[], screen: Screen): Company[] {
  // Delegates to the shared engine (null-safe, stable sort, nulls last).
  const out = engineRunScreen(companies as unknown as EngineCompany[], screen as unknown as EngineScreen);
  return out.results.map((r) => r.company as unknown as Company);
}

export function describeFilter(f: Filter): string {
  const info = METRIC_BY_KEY[f.metric];
  const label = info?.short ?? f.metric;
  const fmt = info?.format ?? 'ratio';
  if (f.op === 'between' && Array.isArray(f.value)) {
    return `${label} ${formatValue(f.value[0], fmt)}–${formatValue(f.value[1], fmt)}`;
  }
  const opText: Record<string, string> = { '>': '>', '>=': '≥', '<': '<', '<=': '≤', '==': '=' };
  return `${label} ${opText[f.op]} ${typeof f.value === 'number' ? formatValue(f.value, fmt) : ''}`;
}

// Presets come from the shared engine so app and package never drift.
export const PRESET_SCREENS: (Screen & { caveat?: string })[] = ENGINE_PRESETS.map((p) => ({
  id: p.id,
  name: p.name,
  description: p.description,
  caveat: p.caveat,
  filters: p.filters as unknown as Filter[],
  sort: p.sort as Screen['sort'],
}));

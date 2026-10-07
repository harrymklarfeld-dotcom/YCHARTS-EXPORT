import { getMetricInfo, isFieldKey, isMetricKey } from './catalog.ts';
import { isNum } from './format.ts';
import type { Company, FieldKey, Filter, FilterOp, Screen } from './types.ts';

export const FILTER_OPS: readonly FilterOp[] = Object.freeze(['>', '>=', '<', '<=', 'between', '==']);

/** Relative tolerance used by '==' so 0.1 + 0.2 == 0.3 behaves as a human expects. */
const EQ_EPSILON = 1e-9;

export class ScreenError extends Error {
  readonly issues: readonly string[];
  constructor(issues: readonly string[]) {
    super(`Invalid screen: ${issues.join('; ')}`);
    this.name = 'ScreenError';
    this.issues = issues;
  }
}

/**
 * Read a metric or fundamental from a company. Returns null for missing,
 * null, NaN or ±Infinity values — never anything non-finite.
 */
export function getValue(company: Company, key: FieldKey | string): number | null {
  const bag: Record<string, unknown> | undefined = isMetricKey(key)
    ? (company.metrics as Record<string, unknown> | undefined)
    : (company.fundamentals as Record<string, unknown> | undefined);
  const v = bag?.[key];
  return isNum(v) ? v : null;
}

/** Returns human-readable problems with a filter (empty array = valid). */
export function validateFilter(filter: Filter): string[] {
  const issues: string[] = [];
  const f = filter as Partial<Filter> | null | undefined;
  if (!f || typeof f !== 'object') return ['Filter must be an object.'];
  if (typeof f.metric !== 'string' || !isFieldKey(f.metric)) {
    issues.push(`Unknown metric "${String(f.metric)}".`);
  }
  if (!FILTER_OPS.includes(f.op as FilterOp)) {
    issues.push(`Unknown operator "${String(f.op)}". Use one of ${FILTER_OPS.join(', ')}.`);
    return issues;
  }
  if (f.op === 'between') {
    const v = f.value;
    if (!Array.isArray(v) || v.length !== 2 || !isNum(v[0]) || !isNum(v[1])) {
      issues.push(`"between" on ${String(f.metric)} needs two numbers, like [0.1, 0.2].`);
    } else if (v[0] > v[1]) {
      issues.push(
        `"between" on ${String(f.metric)} has its low bound (${v[0]}) above its high bound (${v[1]}).`,
      );
    }
  } else if (!isNum(f.value)) {
    issues.push(`"${f.op}" on ${String(f.metric)} needs a single finite number.`);
  }
  return issues;
}

/** Returns human-readable problems with a screen (empty array = valid). */
export function validateScreen(screen: Screen): string[] {
  const issues: string[] = [];
  if (!screen || typeof screen !== 'object') return ['Screen must be an object.'];
  if (!Array.isArray(screen.filters)) {
    issues.push('Screen needs a filters array (it may be empty).');
  } else {
    screen.filters.forEach((f, i) => {
      for (const msg of validateFilter(f)) issues.push(`Filter ${i + 1}: ${msg}`);
    });
  }
  if (screen.sort !== undefined) {
    if (!isFieldKey(screen.sort.metric)) issues.push(`Unknown sort metric "${screen.sort.metric}".`);
    if (screen.sort.dir !== 'asc' && screen.sort.dir !== 'desc') {
      issues.push(`Sort direction must be "asc" or "desc", got "${String(screen.sort.dir)}".`);
    }
  }
  return issues;
}

/** Test a value against a filter. null never passes. Assumes a valid filter. */
export function testValue(value: number | null, filter: Filter): boolean {
  if (value === null || !isNum(value)) return false;
  const { op } = filter;
  if (op === 'between') {
    const [lo, hi] = filter.value as [number, number];
    return value >= lo && value <= hi; // inclusive on both ends
  }
  const t = filter.value as number;
  switch (op) {
    case '>':
      return value > t;
    case '>=':
      return value >= t;
    case '<':
      return value < t;
    case '<=':
      return value <= t;
    case '==':
      return Math.abs(value - t) <= EQ_EPSILON * Math.max(1, Math.abs(value), Math.abs(t));
  }
}

export type FilterOutcome = 'pass' | 'fail' | 'missing';

export interface FilterCheck {
  filter: Filter;
  value: number | null;
  outcome: FilterOutcome;
}

/** Evaluate every filter of a screen for one company (no short-circuit). */
export function checkCompany(company: Company, filters: readonly Filter[]): FilterCheck[] {
  return filters.map((filter) => {
    const value = getValue(company, filter.metric);
    const outcome: FilterOutcome =
      value === null ? 'missing' : testValue(value, filter) ? 'pass' : 'fail';
    return { filter, value, outcome };
  });
}

export interface ScreenResult {
  company: Company;
  matched: true;
  /** Values of every filtered metric plus the sort metric, keyed by metric. */
  values: Partial<Record<FieldKey, number | null>>;
}

export interface MissingDataExclusion {
  ticker: string;
  /** Metrics that were null and blocked the match. */
  missing: FieldKey[];
}

export interface RunScreenOutput {
  results: ScreenResult[];
  /**
   * Companies that failed ONLY because some filtered metric was null — every
   * filter with data passed. They might match if the data existed.
   */
  excludedForMissingData: number;
  /** Detail for `excludedForMissingData`, in input order. */
  missingData: MissingDataExclusion[];
  /** Number of companies considered. */
  total: number;
}

/**
 * Compare two nullable numbers for sorting. Nulls always go last regardless of
 * direction; equal values return 0 (so Array#sort keeps input order — stable).
 */
export function compareNullable(a: number | null, b: number | null, dir: 'asc' | 'desc'): number {
  if (a === null && b === null) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  if (a === b) return 0;
  return dir === 'asc' ? a - b : b - a;
}

/**
 * Run a screen. Pure and deterministic: does not mutate inputs; ties in the
 * sort keep input order; companies without a sort value go last.
 *
 * @throws ScreenError if the screen is malformed (unknown metric, bad bounds…).
 */
export function runScreen(companies: readonly Company[], screen: Screen): RunScreenOutput {
  const issues = validateScreen(screen);
  if (issues.length) throw new ScreenError(issues);

  const keys: FieldKey[] = [];
  for (const f of screen.filters) if (!keys.includes(f.metric)) keys.push(f.metric);
  const sortKey = screen.sort?.metric as FieldKey | undefined;
  if (sortKey && !keys.includes(sortKey)) keys.push(sortKey);

  const results: ScreenResult[] = [];
  const missingData: MissingDataExclusion[] = [];

  for (const company of companies) {
    const checks = checkCompany(company, screen.filters);
    if (checks.every((c) => c.outcome === 'pass')) {
      const values: Partial<Record<FieldKey, number | null>> = {};
      for (const k of keys) values[k] = getValue(company, k);
      results.push({ company, matched: true, values });
    } else if (!checks.some((c) => c.outcome === 'fail')) {
      const missing: FieldKey[] = [];
      for (const c of checks) {
        if (c.outcome === 'missing' && !missing.includes(c.filter.metric)) missing.push(c.filter.metric);
      }
      missingData.push({ ticker: company.ticker, missing });
    }
  }

  if (screen.sort) {
    const { dir } = screen.sort;
    const k = screen.sort.metric as FieldKey;
    // Decorate with index so stability does not depend on the engine's sort.
    const decorated = results.map((r, i) => ({ r, i, v: r.values[k] ?? null }));
    decorated.sort((a, b) => compareNullable(a.v, b.v, dir) || a.i - b.i);
    results.splice(0, results.length, ...decorated.map((d) => d.r));
  }

  return {
    results,
    excludedForMissingData: missingData.length,
    missingData,
    total: companies.length,
  };
}

/** Readable operator text used by explanations. */
export function describeCondition(filter: Filter): string {
  const info = getMetricInfo(filter.metric);
  const fmt = (v: number) => (info ? info.format(v) : String(v));
  if (filter.op === 'between') {
    const [lo, hi] = filter.value as [number, number];
    return `between ${fmt(lo)} and ${fmt(hi)}`;
  }
  const opText = filter.op === '==' ? '=' : filter.op;
  return `${opText} ${fmt(filter.value as number)}`;
}

/**
 * Human-readable line per filter, e.g. "ROIC 31% (needs > 15%) ✓" or
 * "P/E — no data (needs < 25) ✗".
 */
export function explainMatch(company: Company, screen: Screen): string[] {
  return checkCompany(company, screen.filters).map(({ filter, value, outcome }) => {
    const info = getMetricInfo(filter.metric);
    const name = info?.shortLabel ?? filter.metric;
    const shown = value === null ? '— no data' : info ? info.format(value) : String(value);
    const mark = outcome === 'pass' ? '✓' : '✗';
    return `${name} ${shown} (needs ${describeCondition(filter)}) ${mark}`;
  });
}

/** Convenience: does one company pass every filter? */
export function matchesScreen(company: Company, screen: Screen): boolean {
  return checkCompany(company, screen.filters).every((c) => c.outcome === 'pass');
}

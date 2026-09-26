/**
 * Result-table columns: any catalog metric/fundamental, the four educational scores, and the
 * size × style bucket. Values come only from our filings-derived data.
 */
import type { Company } from '../types/contract';
import {
  getEngineMetricInfo,
  getMetricValue,
  SCORE_FAMILIES,
  type CompanyScores,
  type CsvColumn,
  type ScoreFamilyId,
  type StyleBoxResult,
} from '../lib/screener';
import { METRIC_CATALOG as ENGINE_CATALOG } from '../../../packages/screener/src/index';

export type ColumnKind = 'metric' | 'score' | 'style';

export type ColumnContext = { scores: Map<string, CompanyScores>; styles: Map<string, StyleBoxResult> };

export type ColumnDef = {
  id: string;
  kind: ColumnKind;
  label: string;
  short: string;
  /** Group for the picker. */
  group: string;
  /** Default direction when a column header is first tapped. */
  defaultDir: 'asc' | 'desc';
  /** Numeric (or string for style) value for sorting; null sorts last. */
  sortValue(c: Company, ctx: ColumnContext): number | string | null;
  display(c: Company, ctx: ColumnContext): string;
  /** Raw CSV value. */
  csv(c: Company, ctx: ColumnContext): string | number | null;
};

const GROUP_LABEL: Record<string, string> = {
  size: 'Size',
  valuation: 'Valuation',
  profitability: 'Profitability',
  returns: 'Returns',
  growth: 'Growth',
  'financial health': 'Financial health',
  dividends: 'Dividends',
  'income statement': 'Income statement',
  'cash flow': 'Cash flow',
  'balance sheet': 'Balance sheet',
};

const metricColumns: ColumnDef[] = ENGINE_CATALOG.map((m) => ({
  id: m.key,
  kind: 'metric',
  label: m.label,
  short: m.shortLabel,
  group: GROUP_LABEL[m.category] ?? 'Other',
  defaultDir: m.higherIsBetter === false ? 'asc' : 'desc',
  sortValue: (c) => getMetricValue(c, m.key),
  display: (c) => m.format(getMetricValue(c, m.key)),
  csv: (c) => getMetricValue(c, m.key),
}));

const scoreColumns: ColumnDef[] = SCORE_FAMILIES.map((f) => ({
  id: `score:${f.id}`,
  kind: 'score',
  label: `${f.label} score`,
  short: f.label === 'Balance sheet' ? 'Balance' : f.label,
  group: 'Scores (0–100, relative)',
  defaultDir: 'desc',
  sortValue: (c, ctx) => ctx.scores.get(c.ticker)?.[f.id as ScoreFamilyId].score ?? null,
  display: (c, ctx) => {
    const s = ctx.scores.get(c.ticker)?.[f.id as ScoreFamilyId].score;
    return s === null || s === undefined ? '—' : String(s);
  },
  csv: (c, ctx) => ctx.scores.get(c.ticker)?.[f.id as ScoreFamilyId].score ?? null,
}));

const styleColumn: ColumnDef = {
  id: 'style',
  kind: 'style',
  label: 'Size & style',
  short: 'Style',
  group: 'Scores (0–100, relative)',
  defaultDir: 'asc',
  sortValue: (c, ctx) => {
    const s = ctx.styles.get(c.ticker);
    if (!s || (!s.size && !s.style)) return null;
    const size = { Large: 0, Mid: 1, Small: 2 }[s.size ?? 'Small'] ?? 3;
    const style = { Value: 0, Blend: 1, Growth: 2 }[s.style ?? 'Growth'] ?? 3;
    return size * 3 + style;
  },
  display: (c, ctx) => ctx.styles.get(c.ticker)?.label ?? '—',
  csv: (c, ctx) => ctx.styles.get(c.ticker)?.label ?? null,
};

export const ALL_COLUMNS: readonly ColumnDef[] = Object.freeze([...scoreColumns, styleColumn, ...metricColumns]);
const BY_ID = new Map(ALL_COLUMNS.map((c) => [c.id, c]));

export function getColumn(id: string): ColumnDef | undefined {
  return BY_ID.get(id);
}

export function isColumnId(id: string): boolean {
  return BY_ID.has(id);
}

/** Picker groups in display order. */
export function columnGroups(): Array<{ group: string; columns: ColumnDef[] }> {
  const order: string[] = [];
  const m = new Map<string, ColumnDef[]>();
  for (const c of ALL_COLUMNS) {
    if (!m.has(c.group)) {
      m.set(c.group, []);
      order.push(c.group);
    }
    m.get(c.group)!.push(c);
  }
  return order.map((g) => ({ group: g, columns: m.get(g)! }));
}

/** Stable sort with nulls last in either direction. */
export function sortByColumn(companies: readonly Company[], id: string, dir: 'asc' | 'desc', ctx: ColumnContext): Company[] {
  const col = getColumn(id);
  if (!col) return [...companies];
  const decorated = companies.map((c, i) => ({ c, i, v: col.sortValue(c, ctx) }));
  decorated.sort((a, b) => {
    if (a.v === null && b.v === null) return a.i - b.i;
    if (a.v === null) return 1;
    if (b.v === null) return -1;
    if (a.v === b.v) return a.i - b.i;
    const cmp = typeof a.v === 'string' || typeof b.v === 'string' ? String(a.v).localeCompare(String(b.v)) : (a.v as number) - (b.v as number);
    return dir === 'asc' ? cmp : -cmp;
  });
  return decorated.map((d) => d.c);
}

/** CSV columns for the chosen ids (raw values: decimals for %, raw USD). */
export function csvColumns(ids: readonly string[], ctx: ColumnContext): CsvColumn[] {
  return ids
    .map(getColumn)
    .filter((c): c is ColumnDef => !!c)
    .map((col) => {
      const unit = col.kind === 'metric' ? getEngineMetricInfo(col.id)?.unit : undefined;
      const suffix = unit === 'percent' ? ' (decimal)' : unit === 'usd' ? ' (USD)' : unit === 'multiple' ? ' (x)' : col.kind === 'score' ? ' (0-100)' : '';
      return { header: `${col.short}${suffix}`, value: (c) => col.csv(c as unknown as Company, ctx) };
    });
}

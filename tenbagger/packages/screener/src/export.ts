import { getMetricInfo } from './catalog.ts';
import { getValue } from './engine.ts';
import type { Company, FieldKey } from './types.ts';

export interface CsvColumn {
  /** Header text. */
  header: string;
  /** Raw cell value. Numbers are written unformatted (decimals for percents, raw USD). */
  value(company: Company): string | number | null | undefined;
}

/** A column for a catalog field. Header includes the unit so raw numbers stay readable. */
export function catalogCsvColumn(key: FieldKey): CsvColumn {
  const info = getMetricInfo(key);
  const unit =
    info?.unit === 'percent' ? ' (decimal)' : info?.unit === 'usd' ? ' (USD)' : info?.unit === 'multiple' ? ' (x)' : '';
  return { header: `${info?.shortLabel ?? key}${unit}`, value: (c) => getValue(c, key) };
}

/** Base identity columns included first in every export. */
export const CSV_ID_COLUMNS: readonly CsvColumn[] = Object.freeze([
  { header: 'Ticker', value: (c: Company) => c.ticker },
  { header: 'Name', value: (c: Company) => c.name },
  { header: 'Sector', value: (c: Company) => c.sector },
  { header: 'Fiscal year', value: (c: Company) => c.latest_fy },
]);

/**
 * RFC 4180 cell: quotes when needed, doubles quotes. Text cells that start with
 * = + - @ (spreadsheet formula triggers) are prefixed with an apostrophe.
 */
export function csvCell(v: string | number | null | undefined): string {
  if (v === null || v === undefined) return '';
  if (typeof v === 'number') return Number.isFinite(v) ? String(v) : '';
  let s = String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export interface CsvOptions {
  /** Appended as a final "# …" line describing where the numbers came from. */
  sourceNote?: string;
  /** Line ending, default "\n". */
  eol?: string;
}

/**
 * Results → CSV text. Only our own filing-derived data: identity columns plus
 * whatever columns the caller passes.
 */
export function toCsv(companies: readonly Company[], columns: readonly CsvColumn[], opts: CsvOptions = {}): string {
  const eol = opts.eol ?? '\n';
  const cols = [...CSV_ID_COLUMNS, ...columns];
  const lines = [cols.map((c) => csvCell(c.header)).join(',')];
  for (const co of companies) lines.push(cols.map((c) => csvCell(c.value(co))).join(','));
  if (opts.sourceNote) lines.push(csvCell(`# ${opts.sourceNote}`));
  return lines.join(eol) + eol;
}

import raw from './fixtures/companies.json' with { type: 'json' };
import type { CompaniesFile, Company } from '../src/index.ts';

export const FIXTURE = raw as unknown as CompaniesFile;
export const COMPANIES: readonly Company[] = FIXTURE.companies;

export function byTicker(t: string): Company {
  const c = COMPANIES.find((x) => x.ticker === t);
  if (!c) throw new Error(`fixture has no ${t}`);
  return c;
}

/** Minimal contract-shaped company for focused unit tests. */
export function mk(
  ticker: string,
  metrics: Partial<Company['metrics']>,
  extra: Partial<Company> = {},
): Company {
  return {
    ticker,
    cik: 1,
    name: `${ticker} Inc.`,
    sector: 'Technology',
    industry: 'Software',
    fiscal_year_end: '12-31',
    price: 10,
    price_date: '2026-09-08',
    price_is_sample: true,
    latest_fy: 2025,
    fundamentals: {},
    metrics,
    ...extra,
  };
}

export const tickers = (rs: ReadonlyArray<{ company: Company }>) => rs.map((r) => r.company.ticker);

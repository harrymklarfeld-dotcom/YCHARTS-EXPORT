/** Which numbers are real vs sample. Rules: tenbagger/content/WIDGETS.md → "Sample data". */
import type { Company } from '../types/contract';
import { dataInfo } from '../data';
import { getArticlesFile } from './data';

const PRICE_METRICS = new Set(['price', 'market_cap', 'enterprise_value', 'pe', 'ps', 'pb', 'ev_ebitda', 'fcf_yield', 'earnings_yield', 'dividend_yield']);

export function isSampleFundamentals(c: Company, isFixture = dataInfo.isSample, realTickers = getArticlesFile().provenance.real_fixture_tickers): boolean {
  const flag = (c as Company & { fundamentals_is_sample?: unknown }).fundamentals_is_sample;
  if (typeof flag === 'boolean') return flag;
  if (!isFixture) return false;
  return !realTickers.includes(c.ticker);
}

export function usesPrice(metric: string): boolean {
  return PRICE_METRICS.has(metric);
}

/** Tags to show next to a widget that displays `metrics` for `companies`. */
export function provenanceTags(companies: Company[], metrics: string[]): { sample: boolean; samplePrice: boolean } {
  return {
    sample: companies.some((c) => isSampleFundamentals(c)),
    samplePrice: metrics.some(usesPrice) && companies.some((c) => c.price_is_sample),
  };
}

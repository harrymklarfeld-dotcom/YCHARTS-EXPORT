import { getValue } from './engine.ts';
import type { Company } from './types.ts';

/**
 * Style buckets: a 3 × 3 grid of size (by market cap) × style (by how the
 * price compares with growth). A description, not a verdict: "Value" means
 * "priced low relative to this list, with slower growth", nothing more.
 *
 * Size: market_cap >= largeMin → Large; >= midMin → Mid; otherwise Small.
 *
 * Style, relative to `universe`:
 *   priceLevel  = average percentile of P/E and P/B (high = pricier), using whichever exist
 *   growthLevel = percentile of 3y revenue CAGR (falls back to 1y revenue growth)
 *   styleScore  = average of priceLevel and growthLevel (whichever exist), 0–100
 *   styleScore <= valueMax → Value; >= growthMin → Growth; otherwise Blend.
 * Loss-makers (no P/E) and negative-equity companies (no P/B) use what is left.
 */

export type SizeBucket = 'Large' | 'Mid' | 'Small';
export type StyleBucket = 'Value' | 'Blend' | 'Growth';

export interface StyleBoxConfig {
  /** Market cap (USD) at or above which a company is Large. Default $10B. */
  largeMin: number;
  /** Market cap (USD) at or above which a company is Mid. Default $2B. */
  midMin: number;
  /** styleScore at or below this is Value. Default 100/3. */
  valueMax: number;
  /** styleScore at or above this is Growth. Default 200/3. */
  growthMin: number;
}

export const STYLE_BOX_CONFIG: Readonly<StyleBoxConfig> = Object.freeze({
  largeMin: 10e9,
  midMin: 2e9,
  valueMax: 100 / 3,
  growthMin: 200 / 3,
});

export const SIZE_BUCKETS: readonly SizeBucket[] = Object.freeze(['Large', 'Mid', 'Small']);
export const STYLE_BUCKETS: readonly StyleBucket[] = Object.freeze(['Value', 'Blend', 'Growth']);

export interface StyleBoxResult {
  ticker: string;
  size: SizeBucket | null;
  style: StyleBucket | null;
  /** "Large Blend", "Mid —" … */
  label: string;
  /** 0–100 or null. */
  priceLevel: number | null;
  growthLevel: number | null;
  styleScore: number | null;
  /** Plain-English reason. */
  explanation: string;
}

function pctWithin(values: readonly number[], v: number): number {
  const n = values.length;
  if (n <= 1) return 50;
  let below = 0;
  let equal = 0;
  for (const x of values) {
    if (x < v) below++;
    else if (x === v) equal++;
  }
  return ((below + Math.max(0, equal - 1) / 2) / (n - 1)) * 100;
}

const growthOf = (c: Company) => getValue(c, 'revenue_cagr_3y') ?? getValue(c, 'revenue_growth_yoy');
const positive = (c: Company, k: 'pe' | 'pb') => {
  const v = getValue(c, k);
  return v !== null && v > 0 ? v : null;
};

export function sizeBucket(marketCap: number | null, config: StyleBoxConfig = STYLE_BOX_CONFIG): SizeBucket | null {
  if (marketCap === null || !Number.isFinite(marketCap) || marketCap <= 0) return null;
  if (marketCap >= config.largeMin) return 'Large';
  if (marketCap >= config.midMin) return 'Mid';
  return 'Small';
}

interface Universe {
  pe: number[];
  pb: number[];
  growth: number[];
}

function buildUniverse(universe: readonly Company[]): Universe {
  const collect = (f: (c: Company) => number | null) =>
    universe.map(f).filter((v): v is number => v !== null).sort((a, b) => a - b);
  return { pe: collect((c) => positive(c, 'pe')), pb: collect((c) => positive(c, 'pb')), growth: collect(growthOf) };
}

function fmt(n: number) {
  return String(Math.round(n));
}

function classify(company: Company, u: Universe, config: StyleBoxConfig): StyleBoxResult {
  const size = sizeBucket(getValue(company, 'market_cap'), config);
  const pe = positive(company, 'pe');
  const pb = positive(company, 'pb');
  const g = growthOf(company);
  const priceParts: number[] = [];
  if (pe !== null) priceParts.push(pctWithin(u.pe, pe));
  if (pb !== null) priceParts.push(pctWithin(u.pb, pb));
  const priceLevel = priceParts.length ? priceParts.reduce((a, b) => a + b, 0) / priceParts.length : null;
  const growthLevel = g !== null ? pctWithin(u.growth, g) : null;
  const parts = [priceLevel, growthLevel].filter((x): x is number => x !== null);
  const styleScore = parts.length ? parts.reduce((a, b) => a + b, 0) / parts.length : null;
  const style: StyleBucket | null =
    styleScore === null ? null : styleScore <= config.valueMax ? 'Value' : styleScore >= config.growthMin ? 'Growth' : 'Blend';

  const sizeText =
    size === null
      ? 'Size unknown (no market cap).'
      : `${size}: market cap ${size === 'Large' ? `≥ $${config.largeMin / 1e9}B` : size === 'Mid' ? `$${config.midMin / 1e9}B–$${config.largeMin / 1e9}B` : `< $${config.midMin / 1e9}B`}.`;
  let styleText: string;
  if (styleScore === null) styleText = 'Style unknown (no P/E, P/B or revenue growth).';
  else {
    const bits: string[] = [];
    if (priceLevel !== null) bits.push(`price level ${fmt(priceLevel)} (P/E & P/B percentile)`);
    if (growthLevel !== null) bits.push(`growth level ${fmt(growthLevel)} (revenue growth percentile)`);
    styleText = `${style}: ${bits.join(' and ')} average to ${fmt(styleScore)} of 100 (Value ≤ ${fmt(config.valueMax)}, Growth ≥ ${fmt(config.growthMin)}).`;
  }
  return {
    ticker: company.ticker,
    size,
    style,
    label: `${size ?? '—'} ${style ?? '—'}`,
    priceLevel: priceLevel === null ? null : Math.round(priceLevel * 10) / 10,
    growthLevel: growthLevel === null ? null : Math.round(growthLevel * 10) / 10,
    styleScore: styleScore === null ? null : Math.round(styleScore * 10) / 10,
    explanation: `${sizeText} ${styleText}`,
  };
}

/** Size × style bucket for one company, relative to `universe`. */
export function styleBox(
  company: Company,
  universe: readonly Company[],
  config: StyleBoxConfig = STYLE_BOX_CONFIG,
): StyleBoxResult {
  return classify(company, buildUniverse(universe), config);
}

/** Style boxes for every company (universe = the same list). Output order = input order. */
export function styleBoxes(companies: readonly Company[], config: StyleBoxConfig = STYLE_BOX_CONFIG): StyleBoxResult[] {
  const u = buildUniverse(companies);
  return companies.map((c) => classify(c, u, config));
}

export interface StyleFilter {
  size?: readonly SizeBucket[];
  style?: readonly StyleBucket[];
}

/**
 * Keep companies whose bucket matches (empty/undefined arrays = no constraint).
 * Buckets are computed against `universe` (default: `companies`).
 */
export function filterByStyle<T extends Company>(
  companies: readonly T[],
  filter: StyleFilter,
  universe: readonly Company[] = companies,
  config: StyleBoxConfig = STYLE_BOX_CONFIG,
): T[] {
  const u = buildUniverse(universe);
  return companies.filter((c) => {
    const r = classify(c, u, config);
    if (filter.size?.length && (r.size === null || !filter.size.includes(r.size))) return false;
    if (filter.style?.length && (r.style === null || !filter.style.includes(r.style))) return false;
    return true;
  });
}

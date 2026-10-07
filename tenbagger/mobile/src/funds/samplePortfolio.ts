import type { XrayInput } from './xray';

/**
 * A FICTIONAL example portfolio used until a brokerage is linked. Not a suggestion.
 * Linked holdings (CONTRACT holdings shape: { ticker, market_value, … }) can be passed to
 * `xray()` in place of this list.
 */
export const SAMPLE_PORTFOLIO: XrayInput[] = [
  { ticker: 'VOO', weight: 40 },
  { ticker: 'NVDA', weight: 15 },
  { ticker: 'AAPL', weight: 12 },
  { ticker: 'MU', weight: 10 },
  { ticker: 'XLV', weight: 6 },
  { ticker: 'GLD', weight: 5 },
  { ticker: 'HACK', weight: 4 },
  { ticker: 'XLE', weight: 3 },
  { ticker: 'CASH', weight: 5, name: 'Cash' },
];

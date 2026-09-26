import type { Screen } from './types.ts';

/**
 * A contract `Screen` plus teaching extras. Descriptions explain what the
 * filters look for and why an investor might study it — they are not advice.
 */
export interface PresetScreen extends Screen {
  /** One emoji for the card. */
  emoji: string;
  /** What this screen can miss or get wrong — shown under the results. */
  caveat: string;
  /** Hook for the app to link a lesson, `preset:<id>`. */
  learnMoreLessonId: string;
}

function preset(p: Omit<PresetScreen, 'learnMoreLessonId'>): PresetScreen {
  // Deep-freeze so the app cannot accidentally mutate a shared preset.
  for (const f of p.filters) {
    if (Array.isArray(f.value)) Object.freeze(f.value);
    Object.freeze(f);
  }
  Object.freeze(p.filters);
  if (p.sort) Object.freeze(p.sort);
  return Object.freeze({ ...p, learnMoreLessonId: `preset:${p.id}` });
}

export const PRESET_SCREENS: readonly PresetScreen[] = Object.freeze([
  preset({
    id: 'cash-machines',
    name: 'Cash machines',
    emoji: '💵',
    description:
      'Companies that turn more than 20 cents of every revenue dollar into free cash flow — cash left after paying for operations and new equipment. Studying them shows what an efficient, low-capital business model looks like.',
    caveat:
      'One strong year can come from delayed investment or a one-off. Check the free cash flow history before drawing conclusions.',
    filters: [{ metric: 'fcf_margin', op: '>', value: 0.2 }],
    sort: { metric: 'fcf_margin', dir: 'desc' },
  }),
  preset({
    id: 'quality-fair-price',
    name: 'Quality at a fair price',
    emoji: '⚖️',
    description:
      'High return on invested capital (above 15%) combined with a P/E under 25. It pairs a sign of a strong business with a valuation that is not extreme, a classic idea from quality investing.',
    caveat:
      'P/E is blank for money-losing companies, so they never appear here. A low P/E can also mean the market expects profits to shrink.',
    filters: [
      { metric: 'roic', op: '>', value: 0.15 },
      { metric: 'pe', op: '<', value: 25 },
    ],
    sort: { metric: 'roic', dir: 'desc' },
  }),
  preset({
    id: 'fortress-balance-sheets',
    name: 'Fortress balance sheets',
    emoji: '🏰',
    description:
      'More cash than debt, and at least $1.50 of short-term assets for every $1 of bills due this year. These companies could handle a rough patch without needing to borrow.',
    caveat:
      'Lots of idle cash can also mean a company is not finding good ways to reinvest. Safety is not the same as growth.',
    filters: [
      { metric: 'net_cash', op: '>', value: 0 },
      { metric: 'current_ratio', op: '>', value: 1.5 },
    ],
    sort: { metric: 'net_cash', dir: 'desc' },
  }),
  preset({
    id: 'dividend-payers',
    name: 'Dividend payers',
    emoji: '🪙',
    description:
      'Companies that paid shareholders a dividend in the latest fiscal year, sorted by dividend yield. A good starting point for learning how companies share profits with owners.',
    caveat:
      'A very high yield often appears after the share price has fallen and may signal that the dividend is at risk. Compare dividends with free cash flow.',
    filters: [{ metric: 'dividend_yield', op: '>', value: 0 }],
    sort: { metric: 'dividend_yield', dir: 'desc' },
  }),
  preset({
    id: 'fast-growers',
    name: 'Fast growers',
    emoji: '🚀',
    description:
      'Revenue has grown more than 20% per year on average over the last three years. It shows which businesses are expanding quickly, whether or not they are profitable yet.',
    caveat:
      'Fast growth is hard to sustain and is often already reflected in a high valuation. Look at margins and cash flow too.',
    filters: [{ metric: 'revenue_cagr_3y', op: '>', value: 0.2 }],
    sort: { metric: 'revenue_cagr_3y', dir: 'desc' },
  }),
  preset({
    id: 'deep-value',
    name: 'Deep value',
    emoji: '🔎',
    description:
      'Enterprise value is less than 8 times EBITDA (operating profit before depreciation). These are businesses the market prices modestly relative to their current operating profit.',
    caveat:
      'Cheap can stay cheap: low multiples often reflect shrinking, cyclical or troubled businesses. The screen cannot tell a bargain from a value trap.',
    filters: [{ metric: 'ev_ebitda', op: '<', value: 8 }],
    sort: { metric: 'ev_ebitda', dir: 'asc' },
  }),
  preset({
    id: 'profitable-and-growing',
    name: 'Profitable & growing',
    emoji: '🌱',
    description:
      'Keeps more than 10% of revenue as net profit and grew revenue by more than 10% last year. It shows companies doing two hard things at once.',
    caveat:
      'This uses a single year of growth, which can be flattered by an acquisition or a weak prior year.',
    filters: [
      { metric: 'net_margin', op: '>', value: 0.1 },
      { metric: 'revenue_growth_yoy', op: '>', value: 0.1 },
    ],
    sort: { metric: 'revenue_growth_yoy', dir: 'desc' },
  }),
  preset({
    id: 'low-debt',
    name: 'Low debt',
    emoji: '🪶',
    description:
      'Debt is no more than half of shareholders’ equity (debt-to-equity between 0 and 0.5). The lower bound of 0 leaves out companies with negative equity, whose ratio looks small but is actually a warning sign.',
    caveat:
      'Some very stable businesses use debt sensibly. Low debt reduces risk but does not by itself make a business good.',
    filters: [{ metric: 'debt_to_equity', op: 'between', value: [0, 0.5] }],
    sort: { metric: 'debt_to_equity', dir: 'asc' },
  }),
  preset({
    id: 'pricing-power',
    name: 'Pricing power',
    emoji: '👑',
    description:
      'Gross margin above 50% and operating margin above 20%. Businesses that keep most of each sale often have a brand, patent or network that customers pay extra for.',
    caveat:
      'Margins differ hugely by industry — software and retail are not comparable. Compare against sector medians.',
    filters: [
      { metric: 'gross_margin', op: '>', value: 0.5 },
      { metric: 'operating_margin', op: '>', value: 0.2 },
    ],
    sort: { metric: 'operating_margin', dir: 'desc' },
  }),
  preset({
    id: 'steady-compounders',
    name: 'Steady compounders',
    emoji: '🐢',
    description:
      'ROIC above 12%, operating margin above 10%, and 3-year revenue growth between 5% and 20% a year. It looks for durable, moderately growing businesses rather than rockets.',
    caveat:
      'Three years is a short window, and past steadiness does not guarantee the next three years look the same.',
    filters: [
      { metric: 'roic', op: '>', value: 0.12 },
      { metric: 'operating_margin', op: '>', value: 0.1 },
      { metric: 'revenue_cagr_3y', op: 'between', value: [0.05, 0.2] },
    ],
    sort: { metric: 'roic', dir: 'desc' },
  }),
]);

export function getPresetScreen(id: string): PresetScreen | undefined {
  return PRESET_SCREENS.find((p) => p.id === id);
}

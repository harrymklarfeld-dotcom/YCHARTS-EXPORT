import type { MetricKey } from '../types/contract';
import type { ValueFormat } from './format';

export type MetricGroup = 'Valuation' | 'Profitability' | 'Health' | 'Growth' | 'Size' | 'Cash flow';

export type MetricInfo = {
  key: MetricKey;
  label: string; // friendly label
  short: string; // compact label, e.g. "P/E"
  group: MetricGroup;
  format: ValueFormat;
  /** Plain-English explainer for beginners. */
  explainer: string;
  formula: string;
  /**
   * Which direction usually reads as "stronger" for a business. Used ONLY for soft color cues
   * next to numbers (never as a recommendation). 'neutral' → no cue.
   */
  better: 'higher' | 'lower' | 'neutral';
  /** Thresholds for the soft color cue: [caution below/above, strong above/below]. */
  cue?: [number, number];
};

export const METRIC_CATALOG: MetricInfo[] = [
  { key: 'market_cap', label: 'Market cap', short: 'Mkt cap', group: 'Size', format: 'usd', better: 'neutral',
    formula: 'price × diluted shares',
    explainer: 'What the whole company would cost at today\'s share price. It tells you size, not quality.' },
  { key: 'enterprise_value', label: 'Enterprise value', short: 'EV', group: 'Size', format: 'usd', better: 'neutral',
    formula: 'market cap + debt − cash',
    explainer: 'Market cap adjusted for debt and cash — roughly the price to buy the whole business, including paying off what it owes.' },
  { key: 'pe', label: 'Price / earnings', short: 'P/E', group: 'Valuation', format: 'multiple', better: 'lower', cue: [40, 15],
    formula: 'price / diluted EPS',
    explainer: 'How many dollars you pay for $1 of this year\'s profit. A P/E of 20 means $20 per $1 of earnings. High P/Es usually mean investors expect growth; blank means earnings were zero or negative.' },
  { key: 'ps', label: 'Price / sales', short: 'P/S', group: 'Valuation', format: 'multiple', better: 'lower', cue: [10, 2],
    formula: 'market cap / revenue',
    explainer: 'Dollars paid per $1 of yearly sales. Handy when a company has little or no profit yet.' },
  { key: 'pb', label: 'Price / book', short: 'P/B', group: 'Valuation', format: 'multiple', better: 'lower', cue: [10, 2],
    formula: 'market cap / shareholders\' equity',
    explainer: 'Price compared with the accounting value of what shareholders own (assets minus liabilities).' },
  { key: 'ev_ebitda', label: 'EV / EBITDA', short: 'EV/EBITDA', group: 'Valuation', format: 'multiple', better: 'lower', cue: [25, 10],
    formula: 'EV / (operating income + D&A)',
    explainer: 'Whole-business price versus a rough measure of cash profit before interest, taxes and depreciation. Lets you compare companies with different debt levels.' },
  { key: 'fcf_yield', label: 'Free cash flow yield', short: 'FCF yield', group: 'Valuation', format: 'percent', better: 'higher', cue: [0.01, 0.05],
    formula: 'free cash flow / market cap',
    explainer: 'The free cash a company produced as a % of its price. 5% means $5 of free cash per $100 of company.' },
  { key: 'earnings_yield', label: 'Earnings yield', short: 'E/P', group: 'Valuation', format: 'percent', better: 'higher', cue: [0.02, 0.06],
    formula: 'EPS / price',
    explainer: 'P/E flipped upside down: profit per $1 of price. Easy to compare with a savings rate.' },
  { key: 'dividend_yield', label: 'Dividend yield', short: 'Div yield', group: 'Valuation', format: 'percent', better: 'neutral',
    formula: 'dividends paid / market cap',
    explainer: 'Cash paid to shareholders each year as a % of the company\'s price. Zero is common for growing companies.' },
  { key: 'gross_margin', label: 'Gross margin', short: 'Gross mgn', group: 'Profitability', format: 'percent', better: 'higher', cue: [0.2, 0.5],
    formula: 'gross profit / revenue',
    explainer: 'Of each sales dollar, how much is left after paying for the product itself. Software is often 70%+, grocers often under 20%.' },
  { key: 'operating_margin', label: 'Operating margin', short: 'Op mgn', group: 'Profitability', format: 'percent', better: 'higher', cue: [0.05, 0.2],
    formula: 'operating income / revenue',
    explainer: 'What\'s left from each sales dollar after running the business — salaries, rent, R&D, marketing — but before interest and taxes.' },
  { key: 'net_margin', label: 'Net margin', short: 'Net mgn', group: 'Profitability', format: 'percent', better: 'higher', cue: [0.03, 0.15],
    formula: 'net income / revenue',
    explainer: 'The bottom line: cents of profit per sales dollar after every expense, interest and tax.' },
  { key: 'fcf_margin', label: 'FCF margin', short: 'FCF mgn', group: 'Cash flow', format: 'percent', better: 'higher', cue: [0.03, 0.15],
    formula: 'free cash flow / revenue',
    explainer: 'Cents of free cash per sales dollar, after the company paid for its own investments (capex).' },
  { key: 'roe', label: 'Return on equity', short: 'ROE', group: 'Profitability', format: 'percent', better: 'higher', cue: [0.08, 0.2],
    formula: 'net income / shareholders\' equity',
    explainer: 'Profit generated per $1 shareholders have in the business. Very high values can come from lots of debt or buybacks.' },
  { key: 'roa', label: 'Return on assets', short: 'ROA', group: 'Profitability', format: 'percent', better: 'higher', cue: [0.03, 0.1],
    formula: 'net income / total assets',
    explainer: 'Profit per $1 of everything the company owns. Useful to compare asset-heavy and asset-light businesses.' },
  { key: 'roic', label: 'Return on invested capital', short: 'ROIC', group: 'Profitability', format: 'percent', better: 'higher', cue: [0.08, 0.15],
    formula: 'operating income × (1 − tax rate) / (debt + equity − cash)',
    explainer: 'After-tax operating profit per $1 of money invested in the business by lenders and owners. A classic quality measure.' },
  { key: 'debt_to_equity', label: 'Debt / equity', short: 'D/E', group: 'Health', format: 'ratio', better: 'lower', cue: [2, 0.5],
    formula: 'total debt / shareholders\' equity',
    explainer: 'How much the company borrowed for each $1 shareholders own. Higher means more leverage — bigger swings in good and bad years.' },
  { key: 'current_ratio', label: 'Current ratio', short: 'Current', group: 'Health', format: 'ratio', better: 'higher', cue: [1, 1.5],
    formula: 'current assets / current liabilities',
    explainer: 'Short-term assets versus bills due within a year. Under 1 isn\'t automatically bad (Costco and Apple run lean) but is worth understanding.' },
  { key: 'net_cash', label: 'Net cash', short: 'Net cash', group: 'Health', format: 'usd', better: 'higher', cue: [0, 1],
    formula: 'cash − total debt',
    explainer: 'Cash minus debt. Positive means the company could repay all its debt from the bank account today.' },
  { key: 'revenue_growth_yoy', label: 'Revenue growth (1y)', short: 'Rev growth', group: 'Growth', format: 'percent', better: 'higher', cue: [0, 0.1],
    formula: 'revenue this year / last year − 1',
    explainer: 'How much sales grew versus last year.' },
  { key: 'eps_growth_yoy', label: 'EPS growth (1y)', short: 'EPS growth', group: 'Growth', format: 'percent', better: 'higher', cue: [0, 0.1],
    formula: 'EPS this year / last year − 1',
    explainer: 'How much profit per share grew versus last year. Blank if last year was a loss.' },
  { key: 'revenue_cagr_3y', label: 'Revenue CAGR (3y)', short: '3y CAGR', group: 'Growth', format: 'percent', better: 'higher', cue: [0, 0.1],
    formula: '(revenue / revenue 3y ago)^(1/3) − 1',
    explainer: 'Average yearly sales growth over three years — smooths out one lucky or unlucky year.' },
  { key: 'revenue', label: 'Revenue', short: 'Revenue', group: 'Size', format: 'usd', better: 'neutral',
    formula: 'total sales for the year',
    explainer: 'Everything customers paid the company during the fiscal year. The "top line".' },
  { key: 'net_income', label: 'Net income', short: 'Net income', group: 'Size', format: 'usd', better: 'neutral',
    formula: 'revenue − all expenses − taxes',
    explainer: 'Profit after every cost, interest payment and tax. The "bottom line".' },
  { key: 'free_cash_flow', label: 'Free cash flow', short: 'FCF', group: 'Cash flow', format: 'usd', better: 'neutral',
    formula: 'operating cash flow − capex',
    explainer: 'Cash generated by the business after paying for buildings, machines and other investments.' },
  { key: 'eps_diluted', label: 'EPS (diluted)', short: 'EPS', group: 'Profitability', format: 'per_share', better: 'neutral',
    formula: 'net income / diluted shares',
    explainer: 'Profit per share, counting stock options and other shares that could be created.' },
];

export const METRIC_BY_KEY: Record<string, MetricInfo> = Object.fromEntries(METRIC_CATALOG.map((m) => [m.key, m]));

export type Cue = 'strong' | 'neutral' | 'caution' | 'none';

/** Soft, educational color cue. Not a rating or recommendation. */
export function metricCue(key: string, v: number | null | undefined): Cue {
  const info = METRIC_BY_KEY[key];
  if (!info || !info.cue || v === null || v === undefined || !Number.isFinite(v) || info.better === 'neutral') return 'none';
  const [a, b] = info.cue;
  if (info.better === 'higher') return v >= b ? 'strong' : v < a ? 'caution' : 'neutral';
  return v <= b ? 'strong' : v > a ? 'caution' : 'neutral';
}

/** Builder input units: percents typed as 15 (→0.15), dollars typed in $B. */
export function inputUnitFor(key: string): { suffix: string; prefix: string; toRaw: (n: number) => number; fromRaw: (n: number) => number } {
  const fmt = METRIC_BY_KEY[key]?.format ?? 'ratio';
  if (fmt === 'percent') return { prefix: '', suffix: '%', toRaw: (n) => n / 100, fromRaw: (n) => Math.round(n * 100 * 1000) / 1000 };
  if (fmt === 'usd') return { prefix: '$', suffix: 'B', toRaw: (n) => n * 1e9, fromRaw: (n) => Math.round((n / 1e9) * 1000) / 1000 };
  if (fmt === 'multiple') return { prefix: '', suffix: '×', toRaw: (n) => n, fromRaw: (n) => n };
  if (fmt === 'per_share') return { prefix: '$', suffix: '', toRaw: (n) => n, fromRaw: (n) => n };
  return { prefix: '', suffix: '', toRaw: (n) => n, fromRaw: (n) => n };
}

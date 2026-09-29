import { formatByUnit, type Unit } from './format.ts';
import type { FieldKey, FundamentalKey, MetricKey } from './types.ts';

export type { Unit } from './format.ts';

export type MetricCategory =
  | 'size'
  | 'valuation'
  | 'profitability'
  | 'returns'
  | 'growth'
  | 'financial health'
  | 'dividends'
  | 'income statement'
  | 'cash flow'
  | 'balance sheet';

export interface MetricInfo {
  key: FieldKey;
  /** 'metric' lives in company.metrics, 'fundamental' in company.fundamentals. */
  source: 'metric' | 'fundamental';
  /** Friendly name, e.g. "Return on invested capital". */
  label: string;
  /** Compact name for chips / explanations, e.g. "ROIC". */
  shortLabel: string;
  /** 1–2 sentence plain-English explainer for beginners. */
  explainer: string;
  /**
   * How to display the value. 'count' is only used for share counts, which fit
   * none of the other units.
   */
  unit: Unit;
  /**
   * true: generally higher is better; false: generally lower is better;
   * null: neither (depends on context, e.g. company size).
   */
  higherIsBetter: boolean | null;
  category: MetricCategory;
  /** Formula as documented in CONTRACT.md (metrics only). */
  formula?: string;
  /** Hook for the app to deep-link into a lesson: always `metric:<key>`. */
  learnMoreLessonId: string;
  format: (value: number | null | undefined) => string;
}

type Def = Omit<MetricInfo, 'key' | 'source' | 'format' | 'learnMoreLessonId'>;

const METRIC_DEFS: Record<MetricKey, Def> = {
  market_cap: {
    label: 'Market capitalization',
    shortLabel: 'Market cap',
    explainer:
      'What the whole company is worth on the stock market: share price times the number of shares. It tells you how big a company is, not whether it is good.',
    unit: 'usd',
    higherIsBetter: null,
    category: 'size',
    formula: 'price × shares_diluted',
  },
  enterprise_value: {
    label: 'Enterprise value',
    shortLabel: 'EV',
    explainer:
      'Market cap plus debt minus cash — roughly the price tag for taking over the entire business, debts included.',
    unit: 'usd',
    higherIsBetter: null,
    category: 'size',
    formula: 'market_cap + total_debt − cash',
  },
  pe: {
    label: 'Price-to-earnings',
    shortLabel: 'P/E',
    explainer:
      'How many dollars investors pay for each $1 of yearly profit. A lower number means the market is paying less for today’s earnings; it is blank when the company lost money.',
    unit: 'multiple',
    higherIsBetter: false,
    category: 'valuation',
    formula: 'price / eps_diluted (null if eps ≤ 0)',
  },
  ps: {
    label: 'Price-to-sales',
    shortLabel: 'P/S',
    explainer:
      'Company value divided by a year of revenue. Useful for young companies that are not profitable yet, but it ignores how much of each sale turns into profit.',
    unit: 'multiple',
    higherIsBetter: false,
    category: 'valuation',
    formula: 'market_cap / revenue',
  },
  pb: {
    label: 'Price-to-book',
    shortLabel: 'P/B',
    explainer:
      'Company value compared with its accounting net worth (assets minus liabilities). It matters most for banks and asset-heavy businesses.',
    unit: 'multiple',
    higherIsBetter: false,
    category: 'valuation',
    formula: 'market_cap / total_equity (null if equity ≤ 0)',
  },
  ev_ebitda: {
    label: 'EV to EBITDA',
    shortLabel: 'EV/EBITDA',
    explainer:
      'Takeover price (enterprise value) divided by operating profit before depreciation. It lets you compare companies with different amounts of debt on a level field.',
    unit: 'multiple',
    higherIsBetter: false,
    category: 'valuation',
    formula: 'enterprise_value / (operating_income + d_and_a) (null if ≤ 0)',
  },
  fcf_yield: {
    label: 'Free cash flow yield',
    shortLabel: 'FCF yield',
    explainer:
      'Free cash flow as a percentage of market cap. Think of it as the cash “return” the business generates for each dollar of company value.',
    unit: 'percent',
    higherIsBetter: true,
    category: 'valuation',
    formula: 'free_cash_flow / market_cap',
  },
  earnings_yield: {
    label: 'Earnings yield',
    shortLabel: 'Earnings yield',
    explainer:
      'P/E flipped upside down: yearly profit per share divided by the share price. Handy for comparing a stock with the interest rate on a savings account or bond.',
    unit: 'percent',
    higherIsBetter: true,
    category: 'valuation',
    formula: 'eps_diluted / price',
  },
  dividend_yield: {
    label: 'Dividend yield',
    shortLabel: 'Div. yield',
    explainer:
      'Cash paid to shareholders as dividends over the year, as a percentage of the company’s value. A very high yield can be a warning sign that the payout may be cut.',
    unit: 'percent',
    higherIsBetter: true,
    category: 'dividends',
    formula: 'dividends_paid / market_cap',
  },
  gross_margin: {
    label: 'Gross margin',
    shortLabel: 'Gross margin',
    explainer:
      'Of every $1 of revenue, how much is left after paying the direct cost of making the product. High gross margins often point to pricing power.',
    unit: 'percent',
    higherIsBetter: true,
    category: 'profitability',
    formula: 'gross_profit / revenue',
  },
  operating_margin: {
    label: 'Operating margin',
    shortLabel: 'Op. margin',
    explainer:
      'Of every $1 of revenue, how much is left after all the costs of running the business (product, staff, marketing, research) — before interest and taxes.',
    unit: 'percent',
    higherIsBetter: true,
    category: 'profitability',
    formula: 'operating_income / revenue',
  },
  net_margin: {
    label: 'Net margin',
    shortLabel: 'Net margin',
    explainer:
      'Of every $1 of revenue, how much ends up as bottom-line profit after every expense, interest and tax.',
    unit: 'percent',
    higherIsBetter: true,
    category: 'profitability',
    formula: 'net_income / revenue',
  },
  fcf_margin: {
    label: 'Free cash flow margin',
    shortLabel: 'FCF margin',
    explainer:
      'Of every $1 of revenue, how much turns into real spare cash after paying for operations and new equipment. Cash is harder to dress up than accounting profit.',
    unit: 'percent',
    higherIsBetter: true,
    category: 'profitability',
    formula: 'free_cash_flow / revenue',
  },
  roe: {
    label: 'Return on equity',
    shortLabel: 'ROE',
    explainer:
      'Profit earned for each $1 of shareholders’ money in the business. Heavy borrowing can inflate it, so check debt too.',
    unit: 'percent',
    higherIsBetter: true,
    category: 'returns',
    formula: 'net_income / total_equity',
  },
  roa: {
    label: 'Return on assets',
    shortLabel: 'ROA',
    explainer:
      'Profit earned for each $1 of stuff the company owns (cash, factories, inventory). It shows how efficiently the assets are put to work.',
    unit: 'percent',
    higherIsBetter: true,
    category: 'returns',
    formula: 'net_income / total_assets',
  },
  roic: {
    label: 'Return on invested capital',
    shortLabel: 'ROIC',
    explainer:
      'After-tax operating profit for each $1 that owners and lenders have invested in the business. A company that keeps ROIC high can grow without needing much extra money.',
    unit: 'percent',
    higherIsBetter: true,
    category: 'returns',
    formula: 'operating_income × (1 − tax_rate) / (total_debt + total_equity − cash)',
  },
  debt_to_equity: {
    label: 'Debt-to-equity',
    shortLabel: 'Debt/Equity',
    explainer:
      'Borrowed money compared with shareholders’ money. Above 1 means the business is funded more by lenders than by owners; a negative value means equity itself is negative.',
    unit: 'ratio',
    higherIsBetter: false,
    category: 'financial health',
    formula: 'total_debt / total_equity',
  },
  current_ratio: {
    label: 'Current ratio',
    shortLabel: 'Current ratio',
    explainer:
      'Short-term assets divided by bills due within a year. Above 1 means the company has more coming in soon than it owes soon.',
    unit: 'ratio',
    higherIsBetter: true,
    category: 'financial health',
    formula: 'current_assets / current_liabilities',
  },
  net_cash: {
    label: 'Net cash',
    shortLabel: 'Net cash',
    explainer:
      'Cash minus all debt. Positive means the company could pay off every loan today and still have cash left over.',
    unit: 'usd',
    higherIsBetter: true,
    category: 'financial health',
    formula: 'cash − total_debt',
  },
  revenue_growth_yoy: {
    label: 'Revenue growth (1 year)',
    shortLabel: 'Revenue growth',
    explainer: 'How much revenue grew compared with the previous fiscal year.',
    unit: 'percent',
    higherIsBetter: true,
    category: 'growth',
    formula: 'revenue / prior revenue − 1',
  },
  eps_growth_yoy: {
    label: 'EPS growth (1 year)',
    shortLabel: 'EPS growth',
    explainer:
      'How much profit per share grew compared with the previous year. It can swing wildly when last year’s profit was tiny.',
    unit: 'percent',
    higherIsBetter: true,
    category: 'growth',
    formula: 'eps / prior eps − 1',
  },
  revenue_cagr_3y: {
    label: 'Revenue growth (3-year average)',
    shortLabel: '3y revenue CAGR',
    explainer:
      'The steady yearly growth rate that would take revenue from three years ago to today. It smooths out one lucky or unlucky year.',
    unit: 'percent',
    higherIsBetter: true,
    category: 'growth',
    formula: '(revenue / revenue 3 years ago)^(1/3) − 1',
  },
};

const FUNDAMENTAL_DEFS: Record<FundamentalKey, Def> = {
  revenue: {
    label: 'Revenue',
    shortLabel: 'Revenue',
    explainer: 'All the money customers paid the company during the year — the “top line”.',
    unit: 'usd',
    higherIsBetter: null,
    category: 'income statement',
  },
  cost_of_revenue: {
    label: 'Cost of revenue',
    shortLabel: 'Cost of revenue',
    explainer:
      'The direct cost of producing what the company delivered: materials, factory work, hosting and similar costs.',
    unit: 'usd',
    higherIsBetter: null,
    category: 'income statement',
  },
  gross_profit: {
    label: 'Gross profit',
    shortLabel: 'Gross profit',
    explainer: 'Revenue minus cost of revenue: what is left to pay for everything else.',
    unit: 'usd',
    higherIsBetter: true,
    category: 'income statement',
  },
  operating_income: {
    label: 'Operating income',
    shortLabel: 'Operating income',
    explainer:
      'Profit from the core business after all operating costs, before interest and taxes.',
    unit: 'usd',
    higherIsBetter: true,
    category: 'income statement',
  },
  net_income: {
    label: 'Net income',
    shortLabel: 'Net income',
    explainer: 'The bottom line: profit after every expense, interest payment and tax.',
    unit: 'usd',
    higherIsBetter: true,
    category: 'income statement',
  },
  eps_diluted: {
    label: 'Earnings per share (diluted)',
    shortLabel: 'EPS',
    explainer:
      'Net income divided by the number of shares, counting stock options that could become shares. It is your slice of the yearly profit per share owned.',
    unit: 'usd',
    higherIsBetter: true,
    category: 'income statement',
  },
  shares_diluted: {
    label: 'Shares outstanding (diluted)',
    shortLabel: 'Shares',
    explainer:
      'How many slices the company is cut into, including ones that options could create. A shrinking count means each remaining share owns a bigger piece.',
    unit: 'count',
    higherIsBetter: null,
    category: 'income statement',
  },
  operating_cash_flow: {
    label: 'Operating cash flow',
    shortLabel: 'Operating cash flow',
    explainer:
      'Cash actually collected from running the business during the year, after paying suppliers, staff and taxes.',
    unit: 'usd',
    higherIsBetter: true,
    category: 'cash flow',
  },
  capex: {
    label: 'Capital expenditures',
    shortLabel: 'Capex',
    explainer:
      'Money spent on long-lasting things like factories, equipment and data centers. Needed to grow, but it uses up cash.',
    unit: 'usd',
    higherIsBetter: null,
    category: 'cash flow',
  },
  free_cash_flow: {
    label: 'Free cash flow',
    shortLabel: 'FCF',
    explainer:
      'Operating cash flow minus capital expenditures: the spare cash left that could pay dividends, repay debt or be reinvested.',
    unit: 'usd',
    higherIsBetter: true,
    category: 'cash flow',
  },
  dividends_paid: {
    label: 'Dividends paid',
    shortLabel: 'Dividends paid',
    explainer: 'Total cash handed to shareholders as dividends during the year.',
    unit: 'usd',
    higherIsBetter: null,
    category: 'cash flow',
  },
  cash: {
    label: 'Cash',
    shortLabel: 'Cash',
    explainer: 'Cash and near-cash investments the company has on hand at year end.',
    unit: 'usd',
    higherIsBetter: true,
    category: 'balance sheet',
  },
  total_assets: {
    label: 'Total assets',
    shortLabel: 'Total assets',
    explainer: 'Everything the company owns that has value: cash, inventory, buildings, patents and more.',
    unit: 'usd',
    higherIsBetter: null,
    category: 'balance sheet',
  },
  total_liabilities: {
    label: 'Total liabilities',
    shortLabel: 'Total liabilities',
    explainer: 'Everything the company owes: loans, unpaid bills, leases and other obligations.',
    unit: 'usd',
    higherIsBetter: false,
    category: 'balance sheet',
  },
  total_equity: {
    label: 'Shareholders’ equity',
    shortLabel: 'Equity',
    explainer:
      'Assets minus liabilities: the accounting value that belongs to the owners. It can be negative if the company owes more than it owns on paper.',
    unit: 'usd',
    higherIsBetter: true,
    category: 'balance sheet',
  },
  total_debt: {
    label: 'Total debt',
    shortLabel: 'Debt',
    explainer: 'Money borrowed from banks and bond investors that must be paid back with interest.',
    unit: 'usd',
    higherIsBetter: false,
    category: 'balance sheet',
  },
  current_assets: {
    label: 'Current assets',
    shortLabel: 'Current assets',
    explainer: 'Assets expected to turn into cash within a year, like cash, customer IOUs and inventory.',
    unit: 'usd',
    higherIsBetter: null,
    category: 'balance sheet',
  },
  current_liabilities: {
    label: 'Current liabilities',
    shortLabel: 'Current liabilities',
    explainer: 'Bills and debts that must be paid within the next year.',
    unit: 'usd',
    higherIsBetter: null,
    category: 'balance sheet',
  },
  inventory: {
    label: 'Inventory',
    shortLabel: 'Inventory',
    explainer:
      'Goods sitting on shelves or in warehouses waiting to be delivered to customers. Inventory piling up faster than revenue can be a warning sign.',
    unit: 'usd',
    higherIsBetter: null,
    category: 'balance sheet',
  },
  d_and_a: {
    label: 'Depreciation & amortization',
    shortLabel: 'D&A',
    explainer:
      'An accounting charge that spreads the cost of equipment and other long-lived assets over the years they are used. It lowers profit but is not a cash payment that year.',
    unit: 'usd',
    higherIsBetter: null,
    category: 'income statement',
  },
  income_tax: {
    label: 'Income tax',
    shortLabel: 'Income tax',
    explainer: 'Taxes the company recorded on its profit for the year.',
    unit: 'usd',
    higherIsBetter: null,
    category: 'income statement',
  },
  pretax_income: {
    label: 'Pre-tax income',
    shortLabel: 'Pre-tax income',
    explainer: 'Profit after all expenses and interest but before income taxes.',
    unit: 'usd',
    higherIsBetter: true,
    category: 'income statement',
  },
};

function build(source: 'metric' | 'fundamental', defs: Record<string, Def>): MetricInfo[] {
  return Object.entries(defs).map(([key, def]) => {
    const info: MetricInfo = {
      key: key as FieldKey,
      source,
      ...def,
      learnMoreLessonId: `metric:${key}`,
      format: (value) => formatByUnit(def.unit, value),
    };
    return Object.freeze(info);
  });
}

/** Every metric and fundamental in the contract, metrics first, in contract order. */
export const METRIC_CATALOG: readonly MetricInfo[] = Object.freeze([
  ...build('metric', METRIC_DEFS),
  ...build('fundamental', FUNDAMENTAL_DEFS),
]);

/** Contract metric keys, in contract order. */
export const METRIC_KEYS = Object.freeze(Object.keys(METRIC_DEFS)) as readonly MetricKey[];
/** Contract fundamental keys, in contract order. */
export const FUNDAMENTAL_KEYS = Object.freeze(
  Object.keys(FUNDAMENTAL_DEFS),
) as readonly FundamentalKey[];

const BY_KEY: ReadonlyMap<string, MetricInfo> = new Map(METRIC_CATALOG.map((m) => [m.key, m]));

export function isFieldKey(key: string): key is FieldKey {
  return BY_KEY.has(key);
}

export function isMetricKey(key: string): key is MetricKey {
  return Object.prototype.hasOwnProperty.call(METRIC_DEFS, key);
}

/** Look up catalog info; returns undefined for unknown keys. */
export function getMetricInfo(key: string): MetricInfo | undefined {
  return BY_KEY.get(key);
}

/** Format any field value using its catalog unit (falls back to plain number). */
export function formatValue(key: string, value: number | null | undefined): string {
  const info = BY_KEY.get(key);
  return info ? info.format(value) : formatByUnit('ratio', value);
}

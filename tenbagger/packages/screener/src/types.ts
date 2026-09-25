/**
 * Types mirroring tenbagger/CONTRACT.md (`data/companies.json`, schema_version 1)
 * and the screener Filter / Screen shapes. Keep in sync with the contract.
 */

/** Latest fiscal year fundamentals, raw USD (shares in raw count). */
export interface Fundamentals {
  revenue: number | null;
  cost_of_revenue: number | null;
  gross_profit: number | null;
  operating_income: number | null;
  net_income: number | null;
  eps_diluted: number | null;
  shares_diluted: number | null;
  operating_cash_flow: number | null;
  capex: number | null;
  free_cash_flow: number | null;
  dividends_paid: number | null;
  cash: number | null;
  total_assets: number | null;
  total_liabilities: number | null;
  total_equity: number | null;
  total_debt: number | null;
  current_assets: number | null;
  current_liabilities: number | null;
  inventory: number | null;
  d_and_a: number | null;
  income_tax: number | null;
  pretax_income: number | null;
}

/** Derived metrics; ratios are decimals (0.447 = 44.7%), null if not computable. */
export interface Metrics {
  market_cap: number | null;
  enterprise_value: number | null;
  pe: number | null;
  ps: number | null;
  pb: number | null;
  ev_ebitda: number | null;
  fcf_yield: number | null;
  earnings_yield: number | null;
  dividend_yield: number | null;
  gross_margin: number | null;
  operating_margin: number | null;
  net_margin: number | null;
  fcf_margin: number | null;
  roe: number | null;
  roa: number | null;
  roic: number | null;
  debt_to_equity: number | null;
  current_ratio: number | null;
  net_cash: number | null;
  revenue_growth_yoy: number | null;
  eps_growth_yoy: number | null;
  revenue_cagr_3y: number | null;
}

/** `[fy, value]` pairs, ascending by fy. */
export type HistorySeries = Array<[number, number | null]>;

export interface History {
  revenue?: HistorySeries;
  net_income?: HistorySeries;
  free_cash_flow?: HistorySeries;
  eps_diluted?: HistorySeries;
  gross_margin?: HistorySeries;
  operating_margin?: HistorySeries;
  total_debt?: HistorySeries;
  cash?: HistorySeries;
  [key: string]: HistorySeries | undefined;
}

export interface Company {
  ticker: string;
  cik: number;
  name: string;
  sector: string;
  industry: string;
  fiscal_year_end: string;
  price: number | null;
  price_date: string;
  price_is_sample: boolean;
  latest_fy: number;
  /** Partial is tolerated: missing keys are treated as null. */
  fundamentals: Partial<Fundamentals>;
  /** Partial is tolerated: missing keys are treated as null. */
  metrics: Partial<Metrics>;
  history?: History;
}

export interface CompaniesFile {
  schema_version: number;
  generated_at: string;
  source: string;
  companies: Company[];
}

export type MetricKey = keyof Metrics;
export type FundamentalKey = keyof Fundamentals;
/** Anything a filter or sort can reference. */
export type FieldKey = MetricKey | FundamentalKey;

export type FilterOp = '>' | '>=' | '<' | '<=' | 'between' | '==';

/** Contract shape. `between` takes an inclusive `[low, high]` tuple. */
export interface Filter {
  metric: FieldKey;
  op: FilterOp;
  value: number | [number, number];
}

export type SortDir = 'asc' | 'desc';

/** Contract shape. `sort.metric` is typed as string in the contract; it must be a FieldKey at runtime. */
export interface Screen {
  id: string;
  name: string;
  description: string;
  filters: Filter[];
  sort?: { metric: string; dir: SortDir };
}

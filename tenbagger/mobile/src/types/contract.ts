/**
 * Types mirroring tenbagger/CONTRACT.md. If the contract changes, change it here
 * (and nowhere else) — every screen reads data through these shapes.
 */

export type Fundamentals = {
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
};

export type Metrics = {
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
};

export type HistoryPoint = [fy: number, value: number | null];

export type HistoryKey =
  | 'revenue'
  | 'net_income'
  | 'free_cash_flow'
  | 'eps_diluted'
  | 'gross_margin'
  | 'operating_margin'
  | 'total_debt'
  | 'cash';

export type Company = {
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
  fundamentals: Fundamentals;
  metrics: Metrics;
  history: Partial<Record<HistoryKey, HistoryPoint[]>>;
};

export type CompaniesFile = {
  schema_version: number;
  generated_at: string;
  source: string;
  companies: Company[];
};

export type QuestionType = 'multiple_choice' | 'numeric' | 'true_false' | 'compare' | 'order';
export type QuestionUnit = 'percent' | 'usd' | 'multiple' | 'none';

export type QuestionSource = {
  ticker: string;
  fy: number;
  metrics: string[];
  formula?: string;
};

type QuestionBase = {
  id: string;
  prompt: string;
  unit?: QuestionUnit;
  explanation: string;
  source?: QuestionSource;
};

export type MultipleChoiceQuestion = QuestionBase & {
  type: 'multiple_choice';
  choices: string[];
  answer: number;
};
export type CompareQuestion = QuestionBase & {
  type: 'compare';
  choices: string[];
  answer: number;
};
export type NumericQuestion = QuestionBase & {
  type: 'numeric';
  answer: number;
  tolerance?: number;
};
export type TrueFalseQuestion = QuestionBase & {
  type: 'true_false';
  answer: boolean;
};
/** `choices` are the items to rank; `answer` lists choice indices in the correct order. */
export type OrderQuestion = QuestionBase & {
  type: 'order';
  choices: string[];
  answer: number[];
};

export type Question =
  | MultipleChoiceQuestion
  | CompareQuestion
  | NumericQuestion
  | TrueFalseQuestion
  | OrderQuestion;

export type Lesson = {
  id: string;
  title: string;
  xp: number;
  intro: string;
  questions: Question[];
};

export type Unit = {
  id: string;
  title: string;
  summary: string;
  order: number;
  lessons: Lesson[];
};

export type LessonsFile = {
  schema_version: number;
  units: Unit[];
};

export type MetricKey = keyof Metrics | keyof Fundamentals;

export type FilterOp = '>' | '>=' | '<' | '<=' | 'between' | '==';

export type Filter = {
  metric: MetricKey;
  op: FilterOp;
  value: number | [number, number];
};

export type Screen = {
  id: string;
  name: string;
  description: string;
  filters: Filter[];
  sort?: { metric: string; dir: 'asc' | 'desc' };
};

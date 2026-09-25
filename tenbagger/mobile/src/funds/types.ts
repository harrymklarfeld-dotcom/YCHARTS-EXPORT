/** Mirror of tenbagger/funds/README.md → data/funds.json (schema_version 1). */

export type FundHolding = { name: string; ticker: string | null; weight: number | null; mapped?: boolean };

export type Allocation = { stock: number; bond: number; cash: number; commodity: number; other: number };

export type LookThrough = {
  weighted_pe: number | null;
  weighted_fcf_yield: number | null;
  weighted_roic: number | null;
  coverage_pct: number;
};

export type FundSource = { type: string; ref: string; sample?: boolean; as_of?: string; [k: string]: unknown };

export type Fund = {
  ticker: string;
  name: string;
  issuer: string;
  category: string;
  expense_ratio: number | null;
  total_net_assets: number | null;
  as_of: string | null;
  holdings_count: number | null;
  top_holdings: FundHolding[];
  allocation: Allocation | null;
  sector_weights: Record<string, number | null>;
  look_through: LookThrough;
  is_sample: boolean;
  note?: string | null;
  sources: FundSource[];
};

export type FundsFile = { schema_version: number; generated_at: string; source: string; funds: Fund[] };

// Portfolio look-through analytics used by the `portfolio-summary` function and by the
// lesson engine's `{holding}` personalization. Pure functions: no I/O.
//
// WEIGHTING METHOD
// ----------------
// Weights are market-value weights: w_i = MV_i / Σ MV.
//
// Portfolio P/E uses HARMONIC weighting, i.e. it is computed from the weighted
// average EARNINGS YIELD and inverted:
//
//     EY_port = Σ w_i · EY_i        (EY_i = eps / price, from companies.json metrics)
//     PE_port = 1 / EY_port         (null if EY_port ≤ 0)
//
// Why: owning $MV_i of a company at P/E_i means you "own" MV_i / PE_i of its earnings.
// The portfolio's price-to-earnings is therefore Σ MV_i / Σ (MV_i / PE_i) — exactly the
// weighted harmonic mean of P/Es. The simple weighted arithmetic mean Σ w_i·PE_i is biased
// upward and explodes near zero earnings (one stock at P/E 400 dominates). Using earnings
// yield also lets loss-makers (negative EY, P/E = null per contract) count honestly
// instead of being silently dropped.
//
// FCF yield and dividend yield are already "yield" ratios, so their weighted arithmetic
// mean is the same harmonic treatment of P/FCF. ROIC and margins are weighted arithmetic
// means over holdings where the metric exists (a rough look-through, not an exact
// aggregate of capital). Every metric reports `coverage`: the share of invested
// (non-cash) value that had data, so lessons can say "based on 90% of your stocks".

export interface CompanyMetricsLite {
  pe?: number | null;
  earnings_yield?: number | null;
  fcf_yield?: number | null;
  roic?: number | null;
  dividend_yield?: number | null;
  gross_margin?: number | null;
  operating_margin?: number | null;
  net_margin?: number | null;
  revenue_growth_yoy?: number | null;
  debt_to_equity?: number | null;
}

export interface PortfolioRow {
  ticker: string | null;
  name: string | null;
  asset_class: string;
  market_value: number;
  cost_basis: number | null;
  currency: string;
  company?: {
    name: string;
    sector: string | null;
    industry: string | null;
    metrics: CompanyMetricsLite;
  } | null;
}

export interface WeightedMetric {
  value: number | null;
  coverage: number; // share of invested (non-cash) USD value with data, 0..1
}

interface RawWeighted extends WeightedMetric {
  raw: number | null; // unrounded, for derived metrics (P/E = 1 / EY)
}

export interface PositionSummary {
  key: string;
  ticker: string | null;
  name: string | null;
  asset_class: string;
  sector: string;
  market_value: number;
  weight: number;
  in_universe: boolean; // present in companies.json → usable for lessons
  metrics: CompanyMetricsLite | null;
}

export interface PortfolioSummary {
  as_of: string;
  currency: "USD";
  total_market_value: number;
  invested_market_value: number;
  cash_weight: number;
  position_count: number;
  cost_basis_total: number | null;
  unrealized_gain: number | null;
  cost_basis_coverage: number;
  weighted: {
    pe: WeightedMetric;
    earnings_yield: WeightedMetric;
    fcf_yield: WeightedMetric;
    roic: WeightedMetric;
    dividend_yield: WeightedMetric;
    gross_margin: WeightedMetric;
  };
  sector_mix: Array<{ sector: string; market_value: number; weight: number }>;
  largest_holding: PositionSummary | null;
  concentration: { top5_weight: number; hhi: number; effective_positions: number | null };
  positions: PositionSummary[];
  lesson_context: {
    /** Featured holding for `{holding}` lessons: largest position that exists in companies.json. */
    holding: PositionSummary | null;
    holdings_in_universe: string[]; // tickers ordered by weight
    /** Flat template variables: {holding}, {holding_name}, {holding_weight}, {portfolio_pe}, … */
    variables: Record<string, string | number | null>;
  };
  warnings: string[];
}

const r6 = (x: number) => Math.round(x * 1e6) / 1e6;
const r2 = (x: number) => Math.round(x * 100) / 100;
const fin = (x: unknown): x is number => typeof x === "number" && Number.isFinite(x);

function sectorFor(row: PortfolioRow): string {
  if (row.company?.sector) return row.company.sector;
  switch (row.asset_class) {
    case "cash":
      return "Cash";
    case "crypto":
      return "Crypto";
    case "option":
      return "Options";
    case "fixed_income":
      return "Bonds";
    case "etf":
    case "mutual_fund":
      return "Funds & ETFs";
    default:
      return "Unknown";
  }
}

export function weightedMean(pairs: Array<{ mv: number; v: number | null | undefined }>, investedTotal: number): RawWeighted {
  let num = 0;
  let den = 0;
  for (const p of pairs) {
    if (!fin(p.v) || p.mv <= 0) continue;
    num += p.mv * p.v;
    den += p.mv;
  }
  const raw = den > 0 ? num / den : null;
  return { value: raw === null ? null : r6(raw), raw, coverage: investedTotal > 0 ? r6(den / investedTotal) : 0 };
}

export function computePortfolioSummary(rows: PortfolioRow[], asOf: string): PortfolioSummary {
  const warnings: string[] = [];
  const usd = rows.filter((r) => {
    if (r.currency !== "USD") {
      warnings.push(`Excluded ${r.ticker ?? r.name ?? "a position"} (${r.currency}) from USD totals`);
      return false;
    }
    return fin(r.market_value);
  });

  // Aggregate the same security across accounts.
  const agg = new Map<string, { row: PortfolioRow; mv: number; cost: number | null; costKnownMv: number }>();
  for (const r of usd) {
    const key = r.ticker && r.asset_class !== "cash" ? `T:${r.ticker}` : `${r.asset_class}:${r.name ?? "?"}`;
    const cur = agg.get(key) ?? { row: r, mv: 0, cost: 0, costKnownMv: 0 };
    cur.mv += r.market_value;
    if (fin(r.cost_basis)) {
      cur.cost = (cur.cost ?? 0) + r.cost_basis;
      cur.costKnownMv += r.market_value;
    }
    agg.set(key, cur);
  }

  const total = [...agg.values()].reduce((s, a) => s + a.mv, 0);
  const cashMv = [...agg.values()].filter((a) => a.row.asset_class === "cash").reduce((s, a) => s + a.mv, 0);
  const invested = total - cashMv;

  const positions: PositionSummary[] = [...agg.entries()]
    .map(([key, a]) => ({
      key,
      ticker: a.row.ticker,
      name: a.row.company?.name ?? a.row.name,
      asset_class: a.row.asset_class,
      sector: sectorFor(a.row),
      market_value: r2(a.mv),
      weight: total > 0 ? r6(a.mv / total) : 0,
      in_universe: !!a.row.company,
      metrics: a.row.company?.metrics ?? null,
    }))
    .sort((x, y) => y.market_value - x.market_value || (x.ticker ?? "").localeCompare(y.ticker ?? ""));

  // Look-through metrics over equity-like positions that have company data.
  const covered = [...agg.values()].filter((a) => a.row.company && a.row.asset_class !== "cash");
  const ey = weightedMean(
    covered.map((a) => {
      const m = a.row.company!.metrics;
      const v = fin(m.earnings_yield) ? m.earnings_yield : fin(m.pe) && m.pe > 0 ? 1 / m.pe : null;
      return { mv: a.mv, v };
    }),
    invested,
  );
  const pick = (k: keyof CompanyMetricsLite): WeightedMetric => {
    const { value, coverage } = weightedMean(covered.map((a) => ({ mv: a.mv, v: a.row.company!.metrics[k] })), invested);
    return { value, coverage };
  };

  const pe: WeightedMetric = {
    value: ey.raw !== null && ey.raw > 0 ? r6(1 / ey.raw) : null,
    coverage: ey.coverage,
  };
  if (ey.raw !== null && ey.raw <= 0) warnings.push("Portfolio has net losses in aggregate; P/E not meaningful");

  // Sector mix
  const sectors = new Map<string, number>();
  for (const p of positions) sectors.set(p.sector, (sectors.get(p.sector) ?? 0) + p.market_value);
  const sector_mix = [...sectors.entries()]
    .map(([sector, mv]) => ({ sector, market_value: r2(mv), weight: total > 0 ? r6(mv / total) : 0 }))
    .sort((a, b) => b.market_value - a.market_value || a.sector.localeCompare(b.sector));

  // Concentration
  const hhiRaw = total > 0 ? [...agg.values()].reduce((s, a) => s + (a.mv / total) ** 2, 0) : 0;
  const top5 = positions.slice(0, 5).reduce((s, p) => s + p.market_value, 0);

  // Cost basis (only where reported — Plaid often lacks tax lots)
  const withCost = [...agg.values()].filter((a) => a.row.asset_class !== "cash" && a.costKnownMv > 0);
  const costTotal = withCost.reduce((s, a) => s + (a.cost ?? 0), 0);
  const costMv = withCost.reduce((s, a) => s + a.costKnownMv, 0);

  const largest = positions.find((p) => p.asset_class !== "cash") ?? null;
  const featured = positions.find((p) => p.in_universe && p.asset_class !== "cash") ?? null;

  const variables: Record<string, string | number | null> = {
    holding: featured?.ticker ?? null,
    holding_name: featured?.name ?? null,
    holding_weight: featured?.weight ?? null,
    holding_sector: featured?.sector ?? null,
    holding_pe: featured?.metrics?.pe ?? null,
    holding_fcf_yield: featured?.metrics?.fcf_yield ?? null,
    holding_roic: featured?.metrics?.roic ?? null,
    holding_gross_margin: featured?.metrics?.gross_margin ?? null,
    largest_holding: largest?.ticker ?? largest?.name ?? null,
    largest_holding_weight: largest?.weight ?? null,
    portfolio_pe: pe.value,
    portfolio_fcf_yield: pick("fcf_yield").value,
    portfolio_roic: pick("roic").value,
    top_sector: sector_mix.find((s) => s.sector !== "Cash")?.sector ?? null,
    position_count: positions.length,
  };

  return {
    as_of: asOf,
    currency: "USD",
    total_market_value: r2(total),
    invested_market_value: r2(invested),
    cash_weight: total > 0 ? r6(cashMv / total) : 0,
    position_count: positions.length,
    cost_basis_total: withCost.length ? r2(costTotal) : null,
    unrealized_gain: withCost.length ? r2(costMv - costTotal) : null,
    cost_basis_coverage: invested > 0 ? r6(costMv / invested) : 0,
    weighted: {
      pe,
      earnings_yield: { value: ey.value, coverage: ey.coverage },
      fcf_yield: pick("fcf_yield"),
      roic: pick("roic"),
      dividend_yield: pick("dividend_yield"),
      gross_margin: pick("gross_margin"),
    },
    sector_mix,
    largest_holding: largest,
    concentration: {
      top5_weight: total > 0 ? r6(top5 / total) : 0,
      hhi: r6(hhiRaw),
      effective_positions: hhiRaw > 0 ? r6(1 / hhiRaw) : null,
    },
    positions,
    lesson_context: {
      holding: featured,
      holdings_in_universe: positions.filter((p) => p.in_universe && p.ticker).map((p) => p.ticker!),
      variables,
    },
    warnings,
  };
}

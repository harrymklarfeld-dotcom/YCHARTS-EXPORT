// Regenerates companies.json: `node tests/fixtures/make-fixture.mjs`
// Fictional companies. Metrics are derived from fundamentals with the exact
// CONTRACT.md formulas so the fixture conforms to the contract.
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const B = 1e9;
const M = 1e6;

const fin = (x) => (typeof x === 'number' && Number.isFinite(x) ? x : null);
const div = (a, b) => (a == null || b == null || b === 0 ? null : fin(a / b));
const round = (x, d = 6) => (x == null ? null : Math.round(x * 10 ** d) / 10 ** d);

function company(spec) {
  const f = { ...spec.f };
  // Derived fundamentals (keep explicit nulls).
  if (f.gross_profit === undefined)
    f.gross_profit = f.revenue != null && f.cost_of_revenue != null ? f.revenue - f.cost_of_revenue : null;
  if (f.free_cash_flow === undefined)
    f.free_cash_flow = f.operating_cash_flow != null && f.capex != null ? f.operating_cash_flow - f.capex : null;
  if (f.total_liabilities === undefined) f.total_liabilities = f.total_assets - f.total_equity;
  if (f.eps_diluted === undefined) f.eps_diluted = round(f.net_income / f.shares_diluted, 4);

  const price = spec.price;
  const market_cap = price * f.shares_diluted;
  const enterprise_value = market_cap + f.total_debt - f.cash;
  const ebitda = f.operating_income + f.d_and_a;
  let tax_rate = f.pretax_income > 0 ? f.income_tax / f.pretax_income : 0.21;
  tax_rate = Math.min(0.35, Math.max(0, tax_rate));
  const invested = f.total_debt + f.total_equity - f.cash;

  const revHist = spec.revenueHistory; // [[fy, v], ...] ascending, last = latest_fy
  const epsHist = spec.epsHistory ?? [];
  const last = (h, back) => (h.length > back ? h[h.length - 1 - back][1] : null);
  const prevRev = last(revHist, 1);
  const rev3 = last(revHist, 3);
  const prevEps = last(epsHist, 1);

  const metrics = {
    market_cap,
    enterprise_value,
    pe: f.eps_diluted > 0 ? div(price, f.eps_diluted) : null,
    ps: div(market_cap, f.revenue),
    pb: f.total_equity > 0 ? div(market_cap, f.total_equity) : null,
    ev_ebitda: ebitda > 0 ? div(enterprise_value, ebitda) : null,
    fcf_yield: div(f.free_cash_flow, market_cap),
    earnings_yield: div(f.eps_diluted, price),
    dividend_yield: div(f.dividends_paid, market_cap),
    gross_margin: div(f.gross_profit, f.revenue),
    operating_margin: div(f.operating_income, f.revenue),
    net_margin: div(f.net_income, f.revenue),
    fcf_margin: div(f.free_cash_flow, f.revenue),
    roe: div(f.net_income, f.total_equity),
    roa: div(f.net_income, f.total_assets),
    roic: invested > 0 ? div(f.operating_income * (1 - tax_rate), invested) : null,
    debt_to_equity: div(f.total_debt, f.total_equity),
    current_ratio: div(f.current_assets, f.current_liabilities),
    net_cash: f.cash - f.total_debt,
    revenue_growth_yoy: prevRev ? div(f.revenue, prevRev) - 1 : null,
    eps_growth_yoy: prevEps && prevEps > 0 ? div(f.eps_diluted, prevEps) - 1 : null,
    revenue_cagr_3y: rev3 && rev3 > 0 ? (f.revenue / rev3) ** (1 / 3) - 1 : null,
  };
  for (const k of Object.keys(metrics)) metrics[k] = round(fin(metrics[k]));

  return {
    ticker: spec.ticker,
    cik: spec.cik,
    name: spec.name,
    sector: spec.sector,
    industry: spec.industry,
    fiscal_year_end: '12-31',
    price,
    price_date: '2026-09-08',
    price_is_sample: true,
    latest_fy: 2025,
    fundamentals: f,
    metrics,
    history: {
      revenue: revHist,
      net_income: [[2025, f.net_income]],
      free_cash_flow: [[2025, f.free_cash_flow]],
      eps_diluted: epsHist,
      gross_margin: [[2025, metrics.gross_margin]],
      operating_margin: [[2025, metrics.operating_margin]],
      total_debt: [[2025, f.total_debt]],
      cash: [[2025, f.cash]],
    },
  };
}

const base = (o) => ({
  inventory: 0,
  dividends_paid: 0,
  ...o,
});

const specs = [
  {
    // Cash machine, fast grower, fortress, pricing power; P/E too high for quality-fair-price.
    ticker: 'CSHM', cik: 900001, name: 'Cashmere Software Inc.', sector: 'Technology', industry: 'Software',
    price: 250,
    f: base({
      revenue: 10 * B, cost_of_revenue: 2 * B, operating_income: 3.5 * B, net_income: 2.8 * B,
      shares_diluted: 1 * B, operating_cash_flow: 3.6 * B, capex: 0.4 * B, cash: 8 * B,
      total_assets: 30 * B, total_equity: 20 * B, total_debt: 2 * B, current_assets: 15 * B,
      current_liabilities: 5 * B, d_and_a: 0.5 * B, income_tax: 0.7 * B, pretax_income: 3.5 * B,
    }),
    revenueHistory: [[2022, 5 * B], [2023, 6.5 * B], [2024, 8 * B], [2025, 10 * B]],
    epsHistory: [[2024, 2.2], [2025, 2.8]],
  },
  {
    // Quality at a fair price, dividend payer, low debt, steady compounder.
    ticker: 'QLTY', cik: 900002, name: 'Qualis Tools Corp.', sector: 'Industrials', industry: 'Machinery',
    price: 60,
    f: base({
      revenue: 8 * B, cost_of_revenue: 4.8 * B, operating_income: 1.6 * B, net_income: 1.2 * B,
      shares_diluted: 0.4 * B, operating_cash_flow: 1.5 * B, capex: 0.3 * B, dividends_paid: 0.4 * B,
      cash: 1 * B, total_assets: 12 * B, total_equity: 7 * B, total_debt: 1.5 * B, current_assets: 4 * B,
      current_liabilities: 2.5 * B, inventory: 1.2 * B, d_and_a: 0.3 * B, income_tax: 0.3 * B, pretax_income: 1.5 * B,
    }),
    revenueHistory: [[2022, 6.5 * B], [2023, 7 * B], [2024, 7.5 * B], [2025, 8 * B]],
    epsHistory: [[2024, 2.7], [2025, 3.0]],
  },
  {
    // Deep value (low EV/EBITDA), leveraged, dividend payer, shrinking.
    ticker: 'DPST', cik: 900003, name: 'Deepwater Steel Co.', sector: 'Materials', industry: 'Steel',
    price: 20,
    f: base({
      revenue: 20 * B, cost_of_revenue: 17 * B, operating_income: 2 * B, net_income: 1.2 * B,
      shares_diluted: 0.5 * B, operating_cash_flow: 2.2 * B, capex: 1.5 * B, dividends_paid: 0.3 * B,
      cash: 1 * B, total_assets: 25 * B, total_equity: 10 * B, total_debt: 8 * B, current_assets: 7 * B,
      current_liabilities: 5 * B, inventory: 3 * B, d_and_a: 1 * B, income_tax: 0.4 * B, pretax_income: 1.6 * B,
    }),
    revenueHistory: [[2022, 24 * B], [2023, 23 * B], [2024, 21 * B], [2025, 20 * B]],
    epsHistory: [[2024, 3.0], [2025, 2.4]],
  },
  {
    // Loss-maker: P/E, EV/EBITDA null; fast grower; net cash; fortress.
    ticker: 'BURN', cik: 900004, name: 'Burnrate Biotherapeutics', sector: 'Health Care', industry: 'Biotechnology',
    price: 40,
    f: base({
      revenue: 1 * B, cost_of_revenue: 0.3 * B, operating_income: -0.6 * B, net_income: -0.55 * B,
      shares_diluted: 0.2 * B, operating_cash_flow: -0.4 * B, capex: 0.1 * B,
      cash: 3 * B, total_assets: 4.5 * B, total_equity: 3.8 * B, total_debt: 0.2 * B, current_assets: 3.4 * B,
      current_liabilities: 0.6 * B, d_and_a: 0.05 * B, income_tax: 0, pretax_income: -0.55 * B,
    }),
    revenueHistory: [[2022, 0.35 * B], [2023, 0.5 * B], [2024, 0.7 * B], [2025, 1 * B]],
    epsHistory: [[2024, -3.1], [2025, -2.75]],
  },
  {
    // Negative equity: D/E negative (must NOT pass Low debt), P/B null; high margins; dividends.
    ticker: 'NEGQ', cik: 900005, name: 'Golden Arch Diners Inc.', sector: 'Consumer Discretionary', industry: 'Restaurants',
    price: 150,
    f: base({
      revenue: 12 * B, cost_of_revenue: 5 * B, operating_income: 5 * B, net_income: 3.3 * B,
      shares_diluted: 0.3 * B, operating_cash_flow: 4 * B, capex: 1.5 * B, dividends_paid: 1.8 * B,
      cash: 1 * B, total_assets: 30 * B, total_equity: -3 * B, total_debt: 20 * B, current_assets: 3 * B,
      current_liabilities: 3 * B, inventory: 0.1 * B, d_and_a: 0.8 * B, income_tax: 1 * B, pretax_income: 4.3 * B,
    }),
    revenueHistory: [[2022, 11 * B], [2023, 11.2 * B], [2024, 11.6 * B], [2025, 12 * B]],
    epsHistory: [[2024, 10.5], [2025, 11]],
  },
  {
    // New listing: one year of history, so growth metrics are null.
    ticker: 'NEWC', cik: 900006, name: 'Newcomer Cloud Ltd.', sector: 'Technology', industry: 'Software',
    price: 30,
    f: base({
      revenue: 2 * B, cost_of_revenue: 0.6 * B, operating_income: 0.5 * B, net_income: 0.4 * B,
      shares_diluted: 0.5 * B, operating_cash_flow: 0.6 * B, capex: 0.1 * B,
      cash: 1.5 * B, total_assets: 4 * B, total_equity: 3 * B, total_debt: 0.3 * B, current_assets: 2.5 * B,
      current_liabilities: 0.8 * B, d_and_a: 0.05 * B, income_tax: 0.1 * B, pretax_income: 0.5 * B,
    }),
    revenueHistory: [[2025, 2 * B]],
    epsHistory: [[2025, 0.8]],
  },
  {
    // Bank-like: no gross margin / current ratio data.
    ticker: 'BNKY', cik: 900007, name: 'Bankwise Financial Corp.', sector: 'Financials', industry: 'Banks',
    price: 45,
    f: base({
      revenue: 6 * B, cost_of_revenue: null, gross_profit: null, operating_income: 2.4 * B, net_income: 1.8 * B,
      shares_diluted: 0.6 * B, operating_cash_flow: 2.5 * B, capex: 0.2 * B, dividends_paid: 0.7 * B,
      cash: 10 * B, total_assets: 150 * B, total_equity: 15 * B, total_debt: 12 * B, current_assets: null,
      current_liabilities: null, inventory: null, d_and_a: 0.2 * B, income_tax: 0.6 * B, pretax_income: 2.4 * B,
    }),
    revenueHistory: [[2022, 5 * B], [2023, 5.3 * B], [2024, 5.7 * B], [2025, 6 * B]],
    epsHistory: [[2024, 2.7], [2025, 3.0]],
  },
  {
    // TWN1 and TWN2 share identical numbers (sort-stability tests).
    ticker: 'TWN1', cik: 900008, name: 'Twinline Semis A', sector: 'Technology', industry: 'Semiconductors',
    price: 50,
    f: base({
      revenue: 5 * B, cost_of_revenue: 2 * B, operating_income: 1.5 * B, net_income: 1.2 * B,
      shares_diluted: 0.4 * B, operating_cash_flow: 1.8 * B, capex: 0.6 * B, dividends_paid: 0.1 * B,
      cash: 2 * B, total_assets: 9 * B, total_equity: 6 * B, total_debt: 1 * B, current_assets: 4 * B,
      current_liabilities: 2 * B, inventory: 0.8 * B, d_and_a: 0.4 * B, income_tax: 0.25 * B, pretax_income: 1.45 * B,
    }),
    revenueHistory: [[2022, 3.5 * B], [2023, 4 * B], [2024, 4.4 * B], [2025, 5 * B]],
    epsHistory: [[2024, 2.6], [2025, 3.0]],
  },
  {
    ticker: 'TWN2', cik: 900009, name: 'Twinline Semis B', sector: 'Technology', industry: 'Semiconductors',
    price: 50,
    f: base({
      revenue: 5 * B, cost_of_revenue: 2 * B, operating_income: 1.5 * B, net_income: 1.2 * B,
      shares_diluted: 0.4 * B, operating_cash_flow: 1.8 * B, capex: 0.6 * B, dividends_paid: 0.1 * B,
      cash: 2 * B, total_assets: 9 * B, total_equity: 6 * B, total_debt: 1 * B, current_assets: 4 * B,
      current_liabilities: 2 * B, inventory: 0.8 * B, d_and_a: 0.4 * B, income_tax: 0.25 * B, pretax_income: 1.45 * B,
    }),
    revenueHistory: [[2022, 3.5 * B], [2023, 4 * B], [2024, 4.4 * B], [2025, 5 * B]],
    epsHistory: [[2024, 2.6], [2025, 3.0]],
  },
  {
    // Utility: high debt, steady dividend, slow growth.
    ticker: 'UTLY', cik: 900010, name: 'Steadyvolt Utilities', sector: 'Utilities', industry: 'Electric Utilities',
    price: 70,
    f: base({
      revenue: 15 * B, cost_of_revenue: 9 * B, operating_income: 3.5 * B, net_income: 2 * B,
      shares_diluted: 0.5 * B, operating_cash_flow: 5 * B, capex: 4.5 * B, dividends_paid: 1.5 * B,
      cash: 0.5 * B, total_assets: 80 * B, total_equity: 25 * B, total_debt: 35 * B, current_assets: 5 * B,
      current_liabilities: 6 * B, inventory: 0.9 * B, d_and_a: 2.5 * B, income_tax: 0.5 * B, pretax_income: 2.5 * B,
    }),
    revenueHistory: [[2022, 13.5 * B], [2023, 14 * B], [2024, 14.5 * B], [2025, 15 * B]],
    epsHistory: [[2024, 3.8], [2025, 4.0]],
  },
];

const out = {
  schema_version: 1,
  generated_at: '2026-09-25T00:00:00Z',
  source: 'fixture',
  companies: specs.map(company),
};
const json = JSON.stringify(out, null, 2);
if (/NaN|Infinity/.test(json)) throw new Error('fixture contains non-finite numbers');
writeFileSync(fileURLToPath(new URL('./companies.json', import.meta.url)), json + '\n');
console.log(`wrote ${out.companies.length} companies`);
void M;

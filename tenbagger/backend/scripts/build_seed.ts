// Builds tests/fixtures/companies_sample.json and supabase/seed.sql from hand-entered
// ILLUSTRATIVE fundamentals, computing metrics exactly per CONTRACT.md formulas.
// Numbers are rounded, sample-only (price_is_sample: true, source: "fixture") — not investment data.
// Usage: deno run -A scripts/build_seed.ts
type F = Record<string, number>;
const raw: Array<{ ticker: string; cik: number; name: string; sector: string; industry: string; fye: string; price: number; fy: number; f: F; prior: { revenue: number; eps_diluted: number; revenue_3y: number } }> = [
  { ticker: "MU", cik: 723125, name: "Micron Technology, Inc.", sector: "Technology", industry: "Semiconductors", fye: "08-28", price: 100, fy: 2025,
    f: { revenue: 37.4e9, cost_of_revenue: 22.5e9, operating_income: 9.8e9, net_income: 8.5e9, eps_diluted: 7.59, shares_diluted: 1.12e9, operating_cash_flow: 17.5e9, capex: 15.9e9, dividends_paid: 0.52e9, cash: 9.6e9, total_assets: 82.8e9, total_liabilities: 28.6e9, total_equity: 54.2e9, total_debt: 14.6e9, current_assets: 31.0e9, current_liabilities: 11.0e9, inventory: 8.4e9, d_and_a: 8.4e9, income_tax: 1.0e9, pretax_income: 9.5e9 },
    prior: { revenue: 25.1e9, eps_diluted: 0.70, revenue_3y: 30.8e9 } },
  { ticker: "COST", cik: 909832, name: "Costco Wholesale Corporation", sector: "Consumer Staples", industry: "Discount Stores", fye: "08-31", price: 900, fy: 2025,
    f: { revenue: 275.2e9, cost_of_revenue: 239.9e9, operating_income: 10.4e9, net_income: 8.1e9, eps_diluted: 18.21, shares_diluted: 0.445e9, operating_cash_flow: 13.3e9, capex: 5.5e9, dividends_paid: 2.2e9, cash: 14.2e9, total_assets: 77.1e9, total_liabilities: 47.9e9, total_equity: 29.2e9, total_debt: 5.8e9, current_assets: 38.4e9, current_liabilities: 37.1e9, inventory: 18.6e9, d_and_a: 2.4e9, income_tax: 2.7e9, pretax_income: 10.8e9 },
    prior: { revenue: 254.5e9, eps_diluted: 16.56, revenue_3y: 227.0e9 } },
  { ticker: "AAPL", cik: 320193, name: "Apple Inc.", sector: "Technology", industry: "Consumer Electronics", fye: "09-27", price: 250, fy: 2025,
    f: { revenue: 416.2e9, cost_of_revenue: 221.0e9, operating_income: 133.0e9, net_income: 112.0e9, eps_diluted: 7.46, shares_diluted: 15.0e9, operating_cash_flow: 111.5e9, capex: 12.7e9, dividends_paid: 15.4e9, cash: 35.9e9, total_assets: 359.2e9, total_liabilities: 285.5e9, total_equity: 73.7e9, total_debt: 98.7e9, current_assets: 147.9e9, current_liabilities: 165.6e9, inventory: 5.7e9, d_and_a: 11.7e9, income_tax: 20.7e9, pretax_income: 132.7e9 },
    prior: { revenue: 391.0e9, eps_diluted: 6.08, revenue_3y: 394.3e9 } },
  { ticker: "KO", cik: 21344, name: "The Coca-Cola Company", sector: "Consumer Staples", industry: "Beverages", fye: "12-31", price: 70, fy: 2024,
    f: { revenue: 47.1e9, cost_of_revenue: 18.3e9, operating_income: 9.99e9, net_income: 10.6e9, eps_diluted: 2.46, shares_diluted: 4.32e9, operating_cash_flow: 6.8e9, capex: 2.1e9, dividends_paid: 8.4e9, cash: 10.8e9, total_assets: 100.5e9, total_liabilities: 74.2e9, total_equity: 26.3e9, total_debt: 44.5e9, current_assets: 25.9e9, current_liabilities: 25.2e9, inventory: 4.7e9, d_and_a: 1.1e9, income_tax: 2.4e9, pretax_income: 13.1e9 },
    prior: { revenue: 45.8e9, eps_diluted: 2.47, revenue_3y: 38.7e9 } },
  { ticker: "RIVN", cik: 1874178, name: "Rivian Automotive, Inc.", sector: "Consumer Discretionary", industry: "Auto Manufacturers", fye: "12-31", price: 12, fy: 2024,
    f: { revenue: 4.97e9, cost_of_revenue: 6.17e9, operating_income: -4.69e9, net_income: -4.75e9, eps_diluted: -4.69, shares_diluted: 1.01e9, operating_cash_flow: -1.72e9, capex: 1.14e9, dividends_paid: 0, cash: 5.29e9, total_assets: 15.4e9, total_liabilities: 8.8e9, total_equity: 6.6e9, total_debt: 4.4e9, current_assets: 11.2e9, current_liabilities: 2.9e9, inventory: 2.2e9, d_and_a: 1.1e9, income_tax: 0.01e9, pretax_income: -4.74e9 },
    prior: { revenue: 4.43e9, eps_diluted: -5.74, revenue_3y: 0.055e9 } },
];
const r = (x: number | null, d = 6) => (x === null || !Number.isFinite(x) ? null : Math.round(x * 10 ** d) / 10 ** d);
const companies = raw.map((c) => {
  const f = { ...c.f } as F;
  f.gross_profit = f.revenue - f.cost_of_revenue;
  f.free_cash_flow = f.operating_cash_flow - f.capex;
  const mc = c.price * f.shares_diluted;
  const ev = mc + f.total_debt - f.cash;
  const ebitda = f.operating_income + f.d_and_a;
  let tax = f.pretax_income > 0 ? f.income_tax / f.pretax_income : 0.21;
  tax = Math.min(0.35, Math.max(0, tax));
  const ic = f.total_debt + f.total_equity - f.cash;
  const metrics = {
    market_cap: r(mc, 0), enterprise_value: r(ev, 0),
    pe: f.eps_diluted > 0 ? r(c.price / f.eps_diluted, 4) : null,
    ps: r(mc / f.revenue, 4), pb: f.total_equity > 0 ? r(mc / f.total_equity, 4) : null,
    ev_ebitda: ebitda > 0 ? r(ev / ebitda, 4) : null,
    fcf_yield: r(f.free_cash_flow / mc), earnings_yield: r(f.eps_diluted / c.price), dividend_yield: r(f.dividends_paid / mc),
    gross_margin: r(f.gross_profit / f.revenue), operating_margin: r(f.operating_income / f.revenue),
    net_margin: r(f.net_income / f.revenue), fcf_margin: r(f.free_cash_flow / f.revenue),
    roe: r(f.net_income / f.total_equity), roa: r(f.net_income / f.total_assets),
    roic: ic > 0 ? r((f.operating_income * (1 - tax)) / ic) : null,
    debt_to_equity: r(f.total_debt / f.total_equity, 4), current_ratio: r(f.current_assets / f.current_liabilities, 4),
    net_cash: r(f.cash - f.total_debt, 0),
    revenue_growth_yoy: r(f.revenue / c.prior.revenue - 1),
    eps_growth_yoy: c.prior.eps_diluted > 0 ? r(f.eps_diluted / c.prior.eps_diluted - 1) : null,
    revenue_cagr_3y: r(Math.pow(f.revenue / c.prior.revenue_3y, 1 / 3) - 1),
  };
  return {
    ticker: c.ticker, cik: c.cik, name: c.name, sector: c.sector, industry: c.industry, fiscal_year_end: c.fye,
    price: c.price, price_date: "2026-09-08", price_is_sample: true, latest_fy: c.fy,
    fundamentals: f, metrics,
    history: { revenue: [[c.fy - 1, c.prior.revenue], [c.fy, f.revenue]], net_income: [], free_cash_flow: [], eps_diluted: [[c.fy - 1, c.prior.eps_diluted], [c.fy, f.eps_diluted]], gross_margin: [], operating_margin: [], total_debt: [], cash: [] },
  };
});
const doc = { schema_version: 1, generated_at: "2026-09-25T00:00:00Z", source: "fixture", companies };
const root = new URL("..", import.meta.url).pathname;
const json = JSON.stringify(doc, null, 2);
await Deno.writeTextFile(root + "tests/fixtures/companies_sample.json", json + "\n");
const sql = `-- Tenbagger seed (local dev / CI only). ILLUSTRATIVE SAMPLE numbers (price_is_sample = true).
-- Generated by scripts/build_seed.ts — do not hand-edit. In production, load the real
-- data/companies.json with:  select public.load_companies(<json>);
-- No user rows are seeded: sign up through Supabase Auth (the on_auth_user_created
-- trigger creates profile + lesson_progress rows).

select public.load_companies($seed$${JSON.stringify(doc)}$seed$::jsonb);
`;
await Deno.writeTextFile(root + "supabase/seed.sql", sql);
console.log(`wrote ${companies.length} companies`);

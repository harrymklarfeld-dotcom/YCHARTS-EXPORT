#!/usr/bin/env node
/**
 * Generates contract-conforming SAMPLE data for the mobile app:
 *   assets/data/companies.sample.json  (8 companies)
 *   assets/data/lessons.sample.json    (2 units)
 *
 * Numbers are rounded, approximate placeholders (source: "fixture", price_is_sample: true)
 * so the UI can be built before the real pipeline lands. Every derived metric is computed
 * with the exact formulas from tenbagger/CONTRACT.md, and every lesson answer is computed
 * from the generated companies — nothing is hand-typed into a question.
 *
 * Run: node scripts/gen-sample-data.mjs
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const outDir = join(here, '..', 'assets', 'data');
mkdirSync(outDir, { recursive: true });

const B = 1e9;
const M = 1e6;

// Base (latest FY) inputs, in billions unless noted. Approximate, sample only.
const BASE = [
  {
    ticker: 'COST', cik: 909832, name: 'Costco Wholesale Corporation', sector: 'Consumer Staples',
    industry: 'Discount Stores', fiscal_year_end: '08-31', latest_fy: 2025, price: 920,
    f: { revenue: 275.2, cost_of_revenue: 239.9, operating_income: 10.4, net_income: 8.1, shares: 0.4448,
      ocf: 13.3, capex: 5.5, div: 2.2, cash: 14.2, assets: 77.1, liab: 47.9, equity: 29.2, debt: 5.7,
      ca: 38.4, cl: 38.0, inv: 18.6, da: 2.4, tax: 2.7, pretax: 10.8 },
    growth: [0.06, 0.08, 0.10, 0.15, 0.17, 0.07, 0.05, 0.05], nmDrift: [0.001, 0.001, 0.0005, 0, 0, -0.001, 0.0005, 0.001],
  },
  {
    ticker: 'MU', cik: 723125, name: 'Micron Technology, Inc.', sector: 'Technology',
    industry: 'Semiconductors', fiscal_year_end: '08-28', latest_fy: 2025, price: 160,
    f: { revenue: 37.4, cost_of_revenue: 22.5, operating_income: 9.8, net_income: 8.5, shares: 1.13,
      ocf: 17.5, capex: 15.9, div: 0.52, cash: 9.6, assets: 82.8, liab: 28.5, equity: 54.2, debt: 14.6,
      ca: 37.0, cl: 11.0, inv: 8.4, da: 8.4, tax: 0.99, pretax: 9.5 },
    growth: [0.49, 0.62, -0.49, -0.11, 0.29, 0.03, -0.23, 0.50], nmDrift: [0, -0.2, -0.55, 0.05, 0.02, 0.0, -0.1, 0.2],
  },
  {
    ticker: 'AAPL', cik: 320193, name: 'Apple Inc.', sector: 'Technology',
    industry: 'Consumer Electronics', fiscal_year_end: '09-27', latest_fy: 2025, price: 255,
    f: { revenue: 416.2, cost_of_revenue: 221.0, operating_income: 133.1, net_income: 112.0, shares: 15.0,
      ocf: 111.5, capex: 12.7, div: 15.4, cash: 35.9, assets: 359.2, liab: 285.5, equity: 73.7, debt: 98.7,
      ca: 148.0, cl: 165.6, inv: 5.7, da: 11.7, tax: 20.7, pretax: 132.7 },
    growth: [0.064, 0.02, -0.028, 0.078, 0.33, 0.055, -0.02, 0.16], nmDrift: [0.0, 0.01, 0.0, -0.01, 0.0, 0.05, 0.0, 0.01],
  },
  {
    ticker: 'MSFT', cik: 789019, name: 'Microsoft Corporation', sector: 'Technology',
    industry: 'Software', fiscal_year_end: '06-30', latest_fy: 2025, price: 510,
    f: { revenue: 281.7, cost_of_revenue: 87.8, operating_income: 128.5, net_income: 101.8, shares: 7.465,
      ocf: 136.2, capex: 64.6, div: 24.1, cash: 94.6, assets: 619.0, liab: 275.5, equity: 343.5, debt: 43.2,
      ca: 191.1, cl: 141.2, inv: 0.9, da: 34.2, tax: 21.8, pretax: 123.6 },
    growth: [0.15, 0.16, 0.07, 0.18, 0.18, 0.14, 0.14, 0.15], nmDrift: [0.0, 0.0, -0.02, 0.0, 0.01, -0.01, 0.0, 0.0],
  },
  {
    ticker: 'KO', cik: 21344, name: 'The Coca-Cola Company', sector: 'Consumer Staples',
    industry: 'Beverages', fiscal_year_end: '12-31', latest_fy: 2025, price: 70,
    f: { revenue: 47.9, cost_of_revenue: 18.7, operating_income: 13.6, net_income: 13.1, shares: 4.31,
      ocf: 11.5, capex: 2.2, div: 8.8, cash: 10.5, assets: 101.0, liab: 71.0, equity: 30.0, debt: 44.0,
      ca: 26.0, cl: 25.0, inv: 4.6, da: 1.1, tax: 2.9, pretax: 16.0 },
    growth: [0.02, 0.03, 0.06, 0.11, 0.17, -0.11, 0.09, -0.01], nmDrift: [0.05, -0.04, -0.01, -0.01, 0.0, -0.02, -0.02, -0.03],
  },
  {
    ticker: 'NVDA', cik: 1045810, name: 'NVIDIA Corporation', sector: 'Technology',
    industry: 'Semiconductors', fiscal_year_end: '01-25', latest_fy: 2026, price: 178,
    f: { revenue: 187.0, cost_of_revenue: 55.0, operating_income: 120.0, net_income: 104.0, shares: 24.5,
      ocf: 100.0, capex: 5.5, div: 1.0, cash: 55.0, assets: 180.0, liab: 40.0, equity: 140.0, debt: 8.5,
      ca: 140.0, cl: 25.0, inv: 15.0, da: 2.5, tax: 19.0, pretax: 123.0 },
    growth: [0.65, 1.14, 1.26, 0.0, 0.61, 0.53, -0.07, 0.21], nmDrift: [0.0, 0.0, 0.07, -0.33, -0.10, -0.08, -0.12, 0.0],
  },
  {
    ticker: 'F', cik: 37996, name: 'Ford Motor Company', sector: 'Consumer Discretionary',
    industry: 'Auto Manufacturers', fiscal_year_end: '12-31', latest_fy: 2025, price: 11.5,
    f: { revenue: 187.0, cost_of_revenue: 168.0, operating_income: 5.0, net_income: -2.0, shares: 3.98,
      ocf: 17.0, capex: 8.5, div: 3.0, cash: 28.0, assets: 290.0, liab: 245.0, equity: 45.0, debt: 160.0,
      ca: 125.0, cl: 105.0, inv: 16.0, da: 7.5, tax: 0.5, pretax: -1.5 },
    growth: [0.0, 0.05, 0.11, 0.16, 0.07, -0.18, -0.03, 0.0], nmDrift: [0.021, 0.013, 0.01, -0.02, 0.1, -0.01, 0.0, 0.005],
  },
  {
    ticker: 'TGT', cik: 27419, name: 'Target Corporation', sector: 'Consumer Staples',
    industry: 'Discount Stores', fiscal_year_end: '02-01', latest_fy: 2025, price: 95,
    f: { revenue: 106.6, cost_of_revenue: 76.5, operating_income: 5.6, net_income: 4.1, shares: 0.463,
      ocf: 7.4, capex: 2.9, div: 2.0, cash: 4.8, assets: 57.8, liab: 43.4, equity: 14.4, debt: 19.9,
      ca: 19.5, cl: 20.5, inv: 12.7, da: 2.9, tax: 1.2, pretax: 5.3 },
    growth: [-0.008, -0.017, 0.029, 0.13, 0.20, 0.037, 0.034, 0.03], nmDrift: [0.0, 0.0, 0.017, 0.0, -0.02, 0.0, 0.0, 0.0],
  },
];

const r6 = (x) => (x === null || !Number.isFinite(x) ? null : Math.round(x * 1e6) / 1e6);
const r2 = (x) => (x === null || !Number.isFinite(x) ? null : Math.round(x * 100) / 100);
const div = (a, b) => (a === null || b === null || b === 0 ? null : a / b);

function build(c) {
  const f = c.f;
  const fund = {
    revenue: f.revenue * B,
    cost_of_revenue: f.cost_of_revenue * B,
    gross_profit: (f.revenue - f.cost_of_revenue) * B,
    operating_income: f.operating_income * B,
    net_income: f.net_income * B,
    eps_diluted: r2(f.net_income / f.shares),
    shares_diluted: Math.round(f.shares * B),
    operating_cash_flow: f.ocf * B,
    capex: f.capex * B,
    free_cash_flow: Math.round((f.ocf - f.capex) * B),
    dividends_paid: f.div * B,
    cash: f.cash * B,
    total_assets: f.assets * B,
    total_liabilities: f.liab * B,
    total_equity: f.equity * B,
    total_debt: f.debt * B,
    current_assets: f.ca * B,
    current_liabilities: f.cl * B,
    inventory: f.inv * B,
    d_and_a: f.da * B,
    income_tax: f.tax * B,
    pretax_income: f.pretax * B,
  };
  for (const k of Object.keys(fund)) fund[k] = Math.round(fund[k] * 100) / 100;

  // History: walk revenue backwards with the growth list (growth[i] = growth INTO year latest-i).
  const years = c.growth.length + 1; // up to 9 points (within the 10y cap)
  const latestNm = f.net_income / f.revenue;
  const latestGm = (f.revenue - f.cost_of_revenue) / f.revenue;
  const latestOm = f.operating_income / f.revenue;
  const latestFcfM = (f.ocf - f.capex) / f.revenue;
  const rev = [f.revenue];
  for (let i = 0; i < c.growth.length; i++) rev.push(rev[i] / (1 + c.growth[i]));
  const hist = { revenue: [], net_income: [], free_cash_flow: [], eps_diluted: [], gross_margin: [], operating_margin: [], total_debt: [], cash: [] };
  for (let i = years - 1; i >= 0; i--) {
    const fy = c.latest_fy - i;
    const drift = i === 0 ? 0 : c.nmDrift.slice(0, i).reduce((a, b) => a + b, 0);
    const nm = latestNm + drift;
    const gm = latestGm + drift * 0.6;
    const om = latestOm + drift * 0.9;
    const shares = f.shares * (1 + 0.012 * i);
    const r = rev[i] * B;
    const ni = i === 0 ? fund.net_income : r * nm;
    hist.revenue.push([fy, Math.round(r)]);
    hist.net_income.push([fy, Math.round(ni)]);
    hist.free_cash_flow.push([fy, i === 0 ? fund.free_cash_flow : Math.round(r * (latestFcfM + drift * 0.8))]);
    hist.eps_diluted.push([fy, i === 0 ? fund.eps_diluted : r2(ni / (shares * B))]);
    hist.gross_margin.push([fy, i === 0 ? r6(fund.gross_profit / fund.revenue) : r6(gm)]);
    hist.operating_margin.push([fy, i === 0 ? r6(fund.operating_income / fund.revenue) : r6(om)]);
    hist.total_debt.push([fy, Math.round(f.debt * B * (1 - 0.03 * i))]);
    hist.cash.push([fy, Math.round(f.cash * B * (1 - 0.05 * i))]);
  }

  // Metrics — exact CONTRACT.md formulas.
  const price = c.price;
  const mcap = price * fund.shares_diluted;
  const ev = mcap + fund.total_debt - fund.cash;
  const ebitda = fund.operating_income + fund.d_and_a;
  let taxRate = fund.pretax_income > 0 ? fund.income_tax / fund.pretax_income : 0.21;
  taxRate = Math.min(0.35, Math.max(0, taxRate));
  const investedCapital = fund.total_debt + fund.total_equity - fund.cash;
  const eps = hist.eps_diluted;
  const priorEps = eps.length > 1 ? eps[eps.length - 2][1] : null;
  const revH = hist.revenue;
  const metrics = {
    market_cap: Math.round(mcap),
    enterprise_value: Math.round(ev),
    pe: fund.eps_diluted > 0 ? r2(price / fund.eps_diluted) : null,
    ps: r2(mcap / fund.revenue),
    pb: fund.total_equity > 0 ? r2(mcap / fund.total_equity) : null,
    ev_ebitda: ebitda > 0 ? r2(ev / ebitda) : null,
    fcf_yield: r6(fund.free_cash_flow / mcap),
    earnings_yield: r6(fund.eps_diluted / price),
    dividend_yield: r6(fund.dividends_paid / mcap),
    gross_margin: r6(fund.gross_profit / fund.revenue),
    operating_margin: r6(fund.operating_income / fund.revenue),
    net_margin: r6(fund.net_income / fund.revenue),
    fcf_margin: r6(fund.free_cash_flow / fund.revenue),
    roe: r6(div(fund.net_income, fund.total_equity)),
    roa: r6(div(fund.net_income, fund.total_assets)),
    roic: investedCapital > 0 ? r6((fund.operating_income * (1 - taxRate)) / investedCapital) : null,
    debt_to_equity: fund.total_equity > 0 ? r6(fund.total_debt / fund.total_equity) : null,
    current_ratio: r6(div(fund.current_assets, fund.current_liabilities)),
    net_cash: Math.round(fund.cash - fund.total_debt),
    revenue_growth_yoy: r6(revH.at(-1)[1] / revH.at(-2)[1] - 1),
    eps_growth_yoy: priorEps && priorEps > 0 ? r6(fund.eps_diluted / priorEps - 1) : null,
    revenue_cagr_3y: r6(Math.pow(revH.at(-1)[1] / revH.at(-4)[1], 1 / 3) - 1),
  };

  return {
    ticker: c.ticker, cik: c.cik, name: c.name, sector: c.sector, industry: c.industry,
    fiscal_year_end: c.fiscal_year_end, price, price_date: '2026-09-08', price_is_sample: true,
    latest_fy: c.latest_fy, fundamentals: fund, metrics, history: hist,
  };
}

const companies = BASE.map(build);
const byT = Object.fromEntries(companies.map((c) => [c.ticker, c]));

writeFileSync(
  join(outDir, 'companies.sample.json'),
  JSON.stringify({ schema_version: 1, generated_at: '2026-09-25T00:00:00Z', source: 'fixture', companies }, null, 2) + '\n',
);

// ---------- Lessons (answers computed from the companies above) ----------
const pct = (x, d = 1) => `${(x * 100).toFixed(d)}%`;
const usdB = (x) => `$${(x / B).toFixed(1)}B`;
const mult = (x) => `${x.toFixed(1)}x`;
// Deterministic "shuffle": put the correct answer at a fixed slot.
function placeAt(correct, distractors, slot) {
  const arr = [...distractors];
  arr.splice(slot, 0, correct);
  return { choices: arr, answer: slot };
}
function rank(tickers, metric, dir = 'desc') {
  const idx = tickers.map((t, i) => i);
  idx.sort((a, b) => {
    const va = byT[tickers[a]].metrics[metric];
    const vb = byT[tickers[b]].metrics[metric];
    return dir === 'desc' ? vb - va : va - vb;
  });
  return idx;
}
const src = (t, metrics, formula) => ({ ticker: t, fy: byT[t].latest_fy, metrics, formula });

const cost = byT.COST;
const aapl = byT.AAPL;
const msft = byT.MSFT;
const ko = byT.KO;
const f = byT.F;
const mu = byT.MU;
const nvda = byT.NVDA;
const tgt = byT.TGT;

const costGm = cost.metrics.gross_margin;
const u1l1 = {
  id: 'u1-l1', title: 'Gross margin', xp: 10,
  intro:
    '# Gross margin\n\nEvery dollar a company sells has a cost attached. **Gross margin** tells you how much of each sales dollar is left after paying for the goods themselves.\n\n- Gross profit = revenue − cost of revenue\n- Gross margin = gross profit / revenue\n\nA warehouse club and a software company can both be great businesses with very different gross margins.',
  questions: [
    {
      id: 'q-u1l1-1', type: 'multiple_choice',
      prompt: `Costco had ${usdB(cost.fundamentals.revenue)} of revenue and ${usdB(cost.fundamentals.cost_of_revenue)} cost of revenue in FY${cost.latest_fy}. What is its gross margin?`,
      ...placeAt(pct(costGm), [pct(cost.fundamentals.cost_of_revenue / cost.fundamentals.revenue), pct(cost.metrics.net_margin), pct(costGm * 2)], 1),
      unit: 'percent',
      explanation: `Gross margin = gross profit / revenue = ${usdB(cost.fundamentals.gross_profit)} / ${usdB(cost.fundamentals.revenue)} = ${pct(costGm)}.`,
      source: src('COST', ['gross_margin'], 'gross_profit / revenue'),
    },
    {
      id: 'q-u1l1-2', type: 'numeric',
      prompt: `Microsoft: revenue ${usdB(msft.fundamentals.revenue)}, gross profit ${usdB(msft.fundamentals.gross_profit)}. Enter its gross margin in %.`,
      answer: msft.metrics.gross_margin, tolerance: 0.005, unit: 'percent',
      explanation: `${usdB(msft.fundamentals.gross_profit)} / ${usdB(msft.fundamentals.revenue)} = ${pct(msft.metrics.gross_margin)}. Software costs little to copy, so most of each sale is gross profit.`,
      source: src('MSFT', ['gross_margin'], 'gross_profit / revenue'),
    },
    {
      id: 'q-u1l1-3', type: 'true_false',
      prompt: `True or false: Costco's gross margin (${pct(costGm)}) is higher than Apple's.`,
      answer: costGm > aapl.metrics.gross_margin, unit: 'none',
      explanation: `Apple's gross margin is ${pct(aapl.metrics.gross_margin)} vs Costco's ${pct(costGm)}. Costco deliberately prices goods close to cost and earns money from membership fees.`,
      source: src('AAPL', ['gross_margin'], 'gross_profit / revenue'),
    },
    {
      id: 'q-u1l1-4', type: 'compare',
      prompt: 'Which company keeps more of each sales dollar after the cost of goods?',
      choices: ['KO', 'TGT'], answer: ko.metrics.gross_margin > tgt.metrics.gross_margin ? 0 : 1, unit: 'percent',
      explanation: `Coca-Cola's gross margin is ${pct(ko.metrics.gross_margin)} vs Target's ${pct(tgt.metrics.gross_margin)}. Selling a branded syrup costs far less than stocking shelves.`,
      source: src('KO', ['gross_margin'], 'gross_profit / revenue'),
    },
    {
      id: 'q-u1l1-5', type: 'order',
      prompt: 'Rank these by gross margin, highest first.',
      choices: ['COST', 'MSFT', 'KO'], answer: rank(['COST', 'MSFT', 'KO'], 'gross_margin'), unit: 'percent',
      explanation: `MSFT ${pct(msft.metrics.gross_margin)}, KO ${pct(ko.metrics.gross_margin)}, COST ${pct(costGm)}.`,
      source: src('MSFT', ['gross_margin'], 'gross_profit / revenue'),
    },
  ],
};

const u1l2 = {
  id: 'u1-l2', title: 'Operating & net margin', xp: 10,
  intro:
    '# Below the gross line\n\nAfter the cost of goods come salaries, rent, R&D and marketing. What remains is **operating income**. Then interest and taxes leave **net income**.\n\n- Operating margin = operating income / revenue\n- Net margin = net income / revenue\n\nMargins can be negative when a company loses money.',
  questions: [
    {
      id: 'q-u1l2-1', type: 'numeric',
      prompt: `Apple earned ${usdB(aapl.fundamentals.operating_income)} of operating income on ${usdB(aapl.fundamentals.revenue)} of revenue. Operating margin in %?`,
      answer: aapl.metrics.operating_margin, tolerance: 0.005, unit: 'percent',
      explanation: `${usdB(aapl.fundamentals.operating_income)} / ${usdB(aapl.fundamentals.revenue)} = ${pct(aapl.metrics.operating_margin)}.`,
      source: src('AAPL', ['operating_margin'], 'operating_income / revenue'),
    },
    {
      id: 'q-u1l2-2', type: 'multiple_choice',
      prompt: `Ford had ${usdB(f.fundamentals.net_income)} net income on ${usdB(f.fundamentals.revenue)} revenue. What's its net margin?`,
      ...placeAt(pct(f.metrics.net_margin), [pct(-f.metrics.net_margin), pct(f.metrics.operating_margin), pct(f.metrics.gross_margin)], 2),
      unit: 'percent',
      explanation: `Net margin = ${usdB(f.fundamentals.net_income)} / ${usdB(f.fundamentals.revenue)} = ${pct(f.metrics.net_margin)}. A loss makes the margin negative.`,
      source: src('F', ['net_margin'], 'net_income / revenue'),
    },
    {
      id: 'q-u1l2-3', type: 'true_false',
      prompt: "True or false: a company's operating margin is always lower than its gross margin.",
      answer: true, unit: 'none',
      explanation: `Operating income = gross profit − operating expenses, so it can't exceed gross profit. Costco: gross ${pct(costGm)}, operating ${pct(cost.metrics.operating_margin)}.`,
      source: src('COST', ['gross_margin', 'operating_margin'], 'operating_income / revenue'),
    },
    {
      id: 'q-u1l2-4', type: 'compare',
      prompt: 'Which chipmaker had the higher net margin in its latest year?',
      choices: ['NVDA', 'MU'], answer: nvda.metrics.net_margin > mu.metrics.net_margin ? 0 : 1, unit: 'percent',
      explanation: `NVIDIA ${pct(nvda.metrics.net_margin)} vs Micron ${pct(mu.metrics.net_margin)}.`,
      source: src('NVDA', ['net_margin'], 'net_income / revenue'),
    },
    {
      id: 'q-u1l2-5', type: 'order',
      prompt: 'Rank by operating margin, highest first.',
      choices: ['TGT', 'AAPL', 'F', 'MSFT'], answer: rank(['TGT', 'AAPL', 'F', 'MSFT'], 'operating_margin'), unit: 'percent',
      explanation: `MSFT ${pct(msft.metrics.operating_margin)}, AAPL ${pct(aapl.metrics.operating_margin)}, TGT ${pct(tgt.metrics.operating_margin)}, F ${pct(f.metrics.operating_margin)}.`,
      source: src('MSFT', ['operating_margin'], 'operating_income / revenue'),
    },
  ],
};

const u2l1 = {
  id: 'u2-l1', title: 'The P/E ratio', xp: 15,
  intro:
    '# Price-to-earnings\n\n**P/E** compares a share\'s price with the profit per share (EPS) behind it.\n\n- P/E = price / diluted EPS\n- If EPS is zero or negative, P/E is not meaningful (we show "—").\n\nA P/E of 20 means you pay $20 for each $1 of this year\'s earnings. It is a description, not a verdict.',
  questions: [
    {
      id: 'q-u2l1-1', type: 'numeric',
      prompt: `Costco's sample price is $${cost.price} and diluted EPS is $${cost.fundamentals.eps_diluted}. What is its P/E?`,
      answer: cost.metrics.pe, tolerance: 0.5, unit: 'multiple',
      explanation: `P/E = ${cost.price} / ${cost.fundamentals.eps_diluted} = ${mult(cost.metrics.pe)}.`,
      source: src('COST', ['pe'], 'price / eps_diluted'),
    },
    {
      id: 'q-u2l1-2', type: 'true_false',
      prompt: `Ford's EPS was $${f.fundamentals.eps_diluted}. True or false: Ford has a meaningful P/E this year.`,
      answer: false, unit: 'none',
      explanation: 'With negative earnings, price / EPS gives a negative number that tells you nothing useful, so P/E is shown as "—".',
      source: src('F', ['pe', 'eps_diluted'], 'price / eps_diluted'),
    },
    {
      id: 'q-u2l1-3', type: 'multiple_choice',
      prompt: `Microsoft trades at ${mult(msft.metrics.pe)} earnings. What's its earnings yield (EPS / price)?`,
      ...placeAt(pct(msft.metrics.earnings_yield), [pct(msft.metrics.pe / 100), pct(msft.metrics.dividend_yield), pct(msft.metrics.fcf_yield * 2)], 0),
      unit: 'percent',
      explanation: `Earnings yield is the flip side of P/E: 1 / ${mult(msft.metrics.pe)} ≈ ${pct(msft.metrics.earnings_yield)}.`,
      source: src('MSFT', ['earnings_yield'], 'eps_diluted / price'),
    },
    {
      id: 'q-u2l1-4', type: 'compare',
      prompt: 'Which has the lower P/E (you pay less per $1 of earnings)?',
      choices: ['KO', 'NVDA'], answer: ko.metrics.pe < nvda.metrics.pe ? 0 : 1, unit: 'multiple',
      explanation: `KO ${mult(ko.metrics.pe)} vs NVDA ${mult(nvda.metrics.pe)}. A lower P/E is not automatically "better" — growth expectations differ.`,
      source: src('KO', ['pe'], 'price / eps_diluted'),
    },
    {
      id: 'q-u2l1-5', type: 'order',
      prompt: 'Rank by P/E, lowest first.',
      choices: ['MSFT', 'TGT', 'AAPL'], answer: rank(['MSFT', 'TGT', 'AAPL'], 'pe', 'asc'), unit: 'multiple',
      explanation: `TGT ${mult(tgt.metrics.pe)}, AAPL ${mult(aapl.metrics.pe)}, MSFT ${mult(msft.metrics.pe)}.`,
      source: src('TGT', ['pe'], 'price / eps_diluted'),
    },
  ],
};

const u2l2 = {
  id: 'u2-l2', title: 'Free cash flow', xp: 15,
  intro:
    '# Cash that is actually free\n\nProfits are an accounting number. **Free cash flow (FCF)** is the cash left after running the business *and* investing in it.\n\n- FCF = operating cash flow − capital expenditures\n- FCF yield = FCF / market cap\n\nHeavy builders (chip fabs, factories) can show big profits but small FCF.',
  questions: [
    {
      id: 'q-u2l2-1', type: 'numeric',
      prompt: `Micron: operating cash flow ${usdB(mu.fundamentals.operating_cash_flow)}, capex ${usdB(mu.fundamentals.capex)}. Free cash flow in $B?`,
      answer: mu.fundamentals.free_cash_flow, tolerance: 0.05 * B, unit: 'usd',
      explanation: `FCF = ${usdB(mu.fundamentals.operating_cash_flow)} − ${usdB(mu.fundamentals.capex)} = ${usdB(mu.fundamentals.free_cash_flow)}. Building fabs eats most of the cash.`,
      source: src('MU', ['free_cash_flow'], 'operating_cash_flow - capex'),
    },
    {
      id: 'q-u2l2-2', type: 'multiple_choice',
      prompt: `Apple's FCF is ${usdB(aapl.fundamentals.free_cash_flow)} on ${usdB(aapl.fundamentals.revenue)} revenue. FCF margin?`,
      ...placeAt(pct(aapl.metrics.fcf_margin), [pct(aapl.metrics.net_margin), pct(aapl.metrics.fcf_yield), pct(aapl.metrics.gross_margin)], 3),
      unit: 'percent',
      explanation: `FCF margin = ${usdB(aapl.fundamentals.free_cash_flow)} / ${usdB(aapl.fundamentals.revenue)} = ${pct(aapl.metrics.fcf_margin)}.`,
      source: src('AAPL', ['fcf_margin'], 'free_cash_flow / revenue'),
    },
    {
      id: 'q-u2l2-3', type: 'true_false',
      prompt: `True or false: Micron's free cash flow was larger than its net income in FY${mu.latest_fy}.`,
      answer: mu.fundamentals.free_cash_flow > mu.fundamentals.net_income, unit: 'none',
      explanation: `FCF ${usdB(mu.fundamentals.free_cash_flow)} vs net income ${usdB(mu.fundamentals.net_income)}. Capex is a cash cost that doesn't hit profit all at once.`,
      source: src('MU', ['free_cash_flow', 'net_income'], 'operating_cash_flow - capex'),
    },
    {
      id: 'q-u2l2-4', type: 'compare',
      prompt: 'Which has the higher FCF yield (FCF / market cap)?',
      choices: ['F', 'MSFT'], answer: f.metrics.fcf_yield > msft.metrics.fcf_yield ? 0 : 1, unit: 'percent',
      explanation: `Ford ${pct(f.metrics.fcf_yield)} vs Microsoft ${pct(msft.metrics.fcf_yield)}. A high yield can reflect low expectations as much as cheapness.`,
      source: src('F', ['fcf_yield'], 'free_cash_flow / market_cap'),
    },
    {
      id: 'q-u2l2-5', type: 'order',
      prompt: 'Rank by FCF margin, highest first.',
      choices: ['COST', 'NVDA', 'KO'], answer: rank(['COST', 'NVDA', 'KO'], 'fcf_margin'), unit: 'percent',
      explanation: `NVDA ${pct(nvda.metrics.fcf_margin)}, KO ${pct(ko.metrics.fcf_margin)}, COST ${pct(cost.metrics.fcf_margin)}.`,
      source: src('NVDA', ['fcf_margin'], 'free_cash_flow / revenue'),
    },
  ],
};

const lessons = {
  schema_version: 1,
  units: [
    { id: 'u1-margins', title: 'Margins', summary: 'How much of each sales dollar a business keeps.', order: 1, lessons: [u1l1, u1l2] },
    { id: 'u2-valuation', title: 'Valuation basics', summary: 'What you pay for profits and cash flow.', order: 2, lessons: [u2l1, u2l2] },
  ],
};

writeFileSync(join(outDir, 'lessons.sample.json'), JSON.stringify(lessons, null, 2) + '\n');
console.log(`wrote ${companies.length} companies and ${lessons.units.length} units to ${outDir}`);

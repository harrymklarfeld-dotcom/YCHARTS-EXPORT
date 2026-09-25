// Weighted-metric math with HAND-CHECKED expected values.
import { assertAlmostEquals, assertEquals } from "jsr:@std/assert@1";
import { computePortfolioSummary, type PortfolioRow } from "../supabase/functions/_shared/portfolio.ts";

const co = (sector: string, m: Record<string, number | null>) => ({ name: `${sector} Co`, sector, industry: null, metrics: m });

// Portfolio (USD):
//   A  5,000 (split 3,000 + 2,000 across two accounts)  P/E 10  EY .100  FCFy .08  ROIC .20  Tech
//   B  3,000                                             P/E 40  EY .025  FCFy .02  ROIC .10  Staples
//   C  1,000  loss-maker                                 P/E —   EY −.05  FCFy −.10 ROIC —    Auto
//   EWZ ETF 1,000 (not in companies universe)
//   Cash 1,000
//   RY 1,400 CAD  (excluded from USD totals)
// total = 11,000 ; invested (non-cash) = 10,000 ; covered by metrics = 9,000
const rows: PortfolioRow[] = [
  { ticker: "A", name: "A", asset_class: "equity", market_value: 3000, cost_basis: 2000, currency: "USD", company: co("Technology", { pe: 10, earnings_yield: 0.1, fcf_yield: 0.08, roic: 0.2 }) },
  { ticker: "A", name: "A", asset_class: "equity", market_value: 2000, cost_basis: null, currency: "USD", company: co("Technology", { pe: 10, earnings_yield: 0.1, fcf_yield: 0.08, roic: 0.2 }) },
  { ticker: "B", name: "B", asset_class: "equity", market_value: 3000, cost_basis: 3300, currency: "USD", company: co("Consumer Staples", { pe: 40, earnings_yield: 0.025, fcf_yield: 0.02, roic: 0.1 }) },
  { ticker: "C", name: "C", asset_class: "equity", market_value: 1000, cost_basis: null, currency: "USD", company: co("Autos", { pe: null, earnings_yield: -0.05, fcf_yield: -0.1, roic: null }) },
  { ticker: "EWZ", name: "iShares Brazil", asset_class: "etf", market_value: 1000, cost_basis: null, currency: "USD", company: null },
  { ticker: null, name: "Cash (USD)", asset_class: "cash", market_value: 1000, cost_basis: 1000, currency: "USD", company: null },
  { ticker: "RY", name: "Royal Bank", asset_class: "equity", market_value: 1400, cost_basis: 1200, currency: "CAD", company: null },
];

Deno.test("portfolio P/E is the harmonic (earnings-yield) weighted mean", () => {
  const s = computePortfolioSummary(rows, "2026-09-25");
  // EY = (5000·.1 + 3000·.025 + 1000·(−.05)) / 9000 = 525/9000 = 0.058333…
  assertAlmostEquals(s.weighted.earnings_yield.value!, 525 / 9000, 1e-6);
  // P/E = 9000/525 = 17.142857…   (naive arithmetic Σw·PE over A,B would be 21.25)
  assertAlmostEquals(s.weighted.pe.value!, 17.142857, 1e-6);
  assertAlmostEquals(s.weighted.pe.coverage, 0.9, 1e-9); // 9000 / 10000 invested
});

Deno.test("FCF yield, ROIC, sector mix, concentration, cost basis", () => {
  const s = computePortfolioSummary(rows, "2026-09-25");
  // FCF yield = (400 + 60 − 100) / 9000 = 0.04
  assertAlmostEquals(s.weighted.fcf_yield.value!, 0.04, 1e-9);
  // ROIC over A,B only (C null) = (1000 + 300) / 8000 = 0.1625 ; coverage 8000/10000
  assertAlmostEquals(s.weighted.roic.value!, 0.1625, 1e-9);
  assertAlmostEquals(s.weighted.roic.coverage, 0.8, 1e-9);

  assertEquals(s.total_market_value, 11000);
  assertEquals(s.invested_market_value, 10000);
  assertAlmostEquals(s.cash_weight, 1 / 11, 1e-6);
  assertEquals(s.position_count, 5); // A merged across accounts; RY excluded (CAD)
  assertEquals(s.warnings.length, 1);

  assertEquals(s.sector_mix.map((x) => x.sector), ["Technology", "Consumer Staples", "Autos", "Cash", "Funds & ETFs"]);
  assertAlmostEquals(s.sector_mix[0].weight, 5 / 11, 1e-6); // 0.454545
  assertAlmostEquals(s.sector_mix[1].weight, 3 / 11, 1e-6);

  assertEquals(s.largest_holding!.ticker, "A");
  assertAlmostEquals(s.largest_holding!.weight, 5 / 11, 1e-6);
  // HHI = (25 + 9 + 1 + 1 + 1)/121 = 37/121 = 0.305785 ; effective positions = 121/37 = 3.27027
  assertAlmostEquals(s.concentration.hhi, 37 / 121, 1e-6);
  assertAlmostEquals(s.concentration.effective_positions!, 121 / 37, 1e-5);
  assertEquals(s.concentration.top5_weight, 1);

  // Cost basis known for A(3000 mv / 2000 cost) and B(3000 / 3300) only.
  assertEquals(s.cost_basis_total, 5300);
  assertEquals(s.unrealized_gain, 700); // 6000 − 5300
  assertAlmostEquals(s.cost_basis_coverage, 0.6, 1e-9);
});

Deno.test("lesson_context exposes {holding} template variables", () => {
  const s = computePortfolioSummary(rows, "2026-09-25");
  assertEquals(s.lesson_context.holding!.ticker, "A");
  assertEquals(s.lesson_context.holdings_in_universe, ["A", "B", "C"]);
  const v = s.lesson_context.variables;
  assertEquals(v.holding, "A");
  assertEquals(v.holding_pe, 10);
  assertEquals(v.top_sector, "Technology");
  assertAlmostEquals(v.portfolio_pe as number, 17.142857, 1e-6);
});

Deno.test("edge cases: empty portfolio, all-cash, aggregate losses → P/E null, no NaN", () => {
  const empty = computePortfolioSummary([], "2026-09-25");
  assertEquals([empty.total_market_value, empty.weighted.pe.value, empty.largest_holding, empty.concentration.effective_positions], [0, null, null, null]);
  const cash = computePortfolioSummary([{ ticker: null, name: "Cash", asset_class: "cash", market_value: 500, cost_basis: 500, currency: "USD" }], "2026-09-25");
  assertEquals([cash.cash_weight, cash.weighted.pe.value, cash.weighted.pe.coverage, cash.lesson_context.holding], [1, null, 0, null]);
  const loss = computePortfolioSummary([rows[3]], "2026-09-25");
  assertEquals(loss.weighted.pe.value, null);
  assertAlmostEquals(loss.weighted.earnings_yield.value!, -0.05, 1e-9);
  const txt = JSON.stringify([empty, cash, loss]);
  assertEquals(/NaN|Infinity/.test(txt), false);
});

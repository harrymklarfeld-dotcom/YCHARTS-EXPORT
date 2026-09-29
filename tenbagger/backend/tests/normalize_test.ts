import { assert, assertEquals } from "jsr:@std/assert@1";
import { normalizePlaidHoldings, type PlaidHoldingsResponse } from "../supabase/functions/_shared/normalize_plaid.ts";
import { normalizeSnapTradeHoldings, type SnapTradeAccountHoldings } from "../supabase/functions/_shared/normalize_snaptrade.ts";
import { normalizeTicker } from "../supabase/functions/_shared/tickers.ts";
import { toContractHoldings } from "../supabase/functions/_shared/types.ts";

const plaidFx: PlaidHoldingsResponse = JSON.parse(await Deno.readTextFile(new URL("./fixtures/plaid_investments_holdings_get.json", import.meta.url)));
const snapFx: SnapTradeAccountHoldings[] = JSON.parse(await Deno.readTextFile(new URL("./fixtures/snaptrade_account_holdings.json", import.meta.url)));

const BROKERAGE = "BxBXxLj1m4HMXBm9WZZmCWVbPjX16EHwv99vp";
const K401 = "dVzbVMLjrxTnLjX4G66XUp5GLklm4oiZy88yK";

Deno.test("normalizeTicker: case, whitespace, share classes, cash pseudo-tickers", () => {
  assertEquals(normalizeTicker(" aapl "), "AAPL");
  assertEquals(normalizeTicker("BRK.B"), "BRK-B");
  assertEquals(normalizeTicker("BRK/B"), "BRK-B");
  assertEquals(normalizeTicker("VFV.TO"), "VFV.TO");
  assertEquals(normalizeTicker("CUR:USD"), null);
  assertEquals(normalizeTicker(""), null);
  assertEquals(normalizeTicker(null), null);
  assertEquals(normalizeTicker("NOT A TICKER!!"), null);
});

Deno.test("plaid: full sandbox-shaped response normalizes to contract holdings", () => {
  const snap = normalizePlaidHoldings(structuredClone(plaidFx), { institutionName: "Fidelity", asOf: "2026-09-25" });
  assertEquals(snap.provider, "plaid");
  assertEquals(snap.accounts.length, 2);
  // 16 input rows − 1 zero-quantity (ACHN) − 1 unknown security = 14
  assertEquals(snap.holdings.length, 14);

  const mu = snap.holdings.find((h) => h.ticker === "MU" && h.provider_account_id === BROKERAGE)!;
  assertEquals(mu, {
    provider_account_id: BROKERAGE,
    provider_security_id: "sec_mu",
    institution: "Fidelity",
    ticker: "MU",
    name: "Micron Technology Inc",
    asset_class: "equity",
    quantity: 10.5,
    cost_basis: 950,
    market_value: 1050,
    currency: "USD",
    as_of: "2026-09-24",
  });

  // contract shape (CONTRACT.md "Holdings shape")
  const contract = toContractHoldings(snap, (id) => (id === BROKERAGE ? "acct-1" : "acct-2"));
  const c = contract.find((h) => h.ticker === "MU" && h.account_id === "acct-1")!;
  assertEquals(
    { account_id: c.account_id, institution: c.institution, ticker: c.ticker, quantity: c.quantity, cost_basis: c.cost_basis, market_value: c.market_value, as_of: c.as_of, source: c.source },
    { account_id: "acct-1", institution: "Fidelity", ticker: "MU", quantity: 10.5, cost_basis: 950.0, market_value: 1050.0, as_of: "2026-09-24", source: "plaid" },
  );
});

Deno.test("plaid: cash, money market, crypto, options, fixed income, proxy, missing data", () => {
  const snap = normalizePlaidHoldings(structuredClone(plaidFx), { institutionName: "Fidelity", asOf: "2026-09-25" });
  const by = (sid: string) => snap.holdings.find((h) => h.provider_security_id === sid)!;
  const codes = (sid: string) => snap.warnings.filter((w) => w.provider_security_id === sid).map((w) => w.code).sort();

  // CUR:USD -> cash, ticker null, as_of falls back to asOf
  assertEquals([by("sec_cash_usd").asset_class, by("sec_cash_usd").ticker, by("sec_cash_usd").market_value, by("sec_cash_usd").as_of], ["cash", null, 1200.55, "2026-09-25"]);
  // money-market fund flagged is_cash_equivalent -> cash but keeps its ticker
  assertEquals([by("sec_spaxx").asset_class, by("sec_spaxx").ticker], ["cash", "SPAXX"]);
  // crypto kept with warning
  assertEquals([by("sec_btc").asset_class, by("sec_btc").ticker], ["crypto", "BTC"]);
  assertEquals(codes("sec_btc"), ["crypto_position"]);
  // option: no ticker, underlying recorded on the security
  assertEquals([by("sec_nflx_opt").asset_class, by("sec_nflx_opt").ticker, by("sec_nflx_opt").market_value], ["option", null, 525]);
  assertEquals(snap.securities.find((s) => s.provider_security_id === "sec_nflx_opt")!.underlying_ticker, "NFLX");
  // treasury: fixed income, no ticker, no unmapped warning (expected to be ticker-less)
  assertEquals([by("sec_ust").asset_class, by("sec_ust").ticker], ["fixed_income", null]);
  assertEquals(codes("sec_ust"), []);
  assertEquals(snap.securities.find((s) => s.provider_security_id === "sec_ust")!.cusip, "91282CKA8");
  // 401k collective trust with no ticker -> proxy security's ticker
  assertEquals(by("sec_tr2050_cit").ticker, "VFIFX");
  assertEquals(codes("sec_tr2050_cit"), ["missing_cost_basis", "proxy_ticker_used"]);
  // lowercase/space ticker cleaned; null cost basis kept null (Plaid often lacks tax lots)
  assertEquals([by("sec_aapl").ticker, by("sec_aapl").cost_basis], ["AAPL", null]);
  // malformed CUSIP dropped, no ticker -> unmapped
  assertEquals(by("sec_private").ticker, null);
  assertEquals(codes("sec_private"), ["invalid_identifier_dropped", "unmapped_security"]);
  // non-USD flagged, not converted
  assertEquals(by("sec_ry_cad").currency, "CAD");
  assertEquals(codes("sec_ry_cad"), ["non_usd"]);
  // institution_value null -> quantity × institution_price; as_of from security close date
  const cost401k = snap.holdings.find((h) => h.provider_security_id === "sec_cost" && h.provider_account_id === K401)!;
  assertEquals([cost401k.market_value, cost401k.as_of], [1350, "2026-09-24"]);
  // skipped rows are explained
  assert(snap.warnings.some((w) => w.code === "zero_quantity_skipped" && w.provider_security_id === "sec_achn"));
  assert(snap.warnings.some((w) => w.code === "unknown_security" && w.provider_security_id === "sec_missing"));
});

Deno.test("plaid: CUSIP resolver fills a missing ticker", () => {
  const fx = structuredClone(plaidFx);
  fx.securities.find((s) => s.security_id === "sec_private")!.cusip = "00123X109";
  const snap = normalizePlaidHoldings(fx, { institutionName: null, asOf: "2026-09-25", tickerByCusip: { "00123X109": "acme" } });
  assertEquals(snap.holdings.find((h) => h.provider_security_id === "sec_private")!.ticker, "ACME");
  assert(snap.warnings.some((w) => w.code === "cusip_ticker_used"));
});

Deno.test("plaid: empty response is a valid empty snapshot", () => {
  const snap = normalizePlaidHoldings({ accounts: [], holdings: [], securities: [] }, { institutionName: null, asOf: "2026-09-25" });
  assertEquals([snap.accounts.length, snap.holdings.length, snap.warnings.length], [0, 0, 0]);
});

Deno.test("snaptrade: positions, cash balances, options, crypto, share class, non-USD", () => {
  const snap = normalizeSnapTradeHoldings(structuredClone(snapFx), { asOf: "2026-09-25" });
  assertEquals(snap.provider, "snaptrade");
  assertEquals(snap.accounts.length, 3);
  assertEquals(snap.accounts[0].mask, "8443");
  // acct1: MU, KO, VOO, BTC (XYZ zero skipped) + 1 option + USD cash = 6
  // acct2: RIVN, BRK-B (cash 0 skipped) = 2 ; acct3: VFV.TO + CAD cash = 2
  assertEquals(snap.holdings.length, 10);

  const mu = snap.holdings.find((h) => h.ticker === "MU")!;
  assertEquals([mu.quantity, mu.market_value, mu.cost_basis, mu.institution, mu.asset_class], [3, 300, 240, "Robinhood", "equity"]);
  const voo = snap.holdings.find((h) => h.ticker === "VOO")!;
  assertEquals([voo.asset_class, voo.cost_basis, voo.market_value], ["etf", null, 750]);
  const btc = snap.holdings.find((h) => h.ticker === "BTC")!;
  assertEquals([btc.asset_class, btc.market_value, btc.cost_basis], ["crypto", 300, 200]);
  assertEquals(snap.holdings.find((h) => h.name === "Berkshire Hathaway Inc Class B")!.ticker, "BRK-B");
  const opt = snap.holdings.find((h) => h.asset_class === "option")!;
  assertEquals([opt.ticker, opt.market_value, opt.cost_basis], [null, 320, null]); // 1 × 3.20 × 100
  assertEquals(snap.securities.find((s) => s.asset_class === "option")!.underlying_ticker, "AAPL");
  const usdCash = snap.holdings.find((h) => h.asset_class === "cash" && h.currency === "USD")!;
  assertEquals([usdCash.market_value, usdCash.ticker, usdCash.provider_security_id], [250.75, null, "cash:USD"]);
  const vfv = snap.holdings.find((h) => h.ticker === "VFV.TO")!;
  assertEquals([vfv.currency, vfv.market_value], ["CAD", 1300]);
  const codes = snap.warnings.map((w) => w.code);
  for (const c of ["missing_cost_basis", "crypto_position", "option_position", "non_usd", "zero_quantity_skipped"]) assert(codes.includes(c as never), c);
  assertEquals(codes.filter((c) => c === "non_usd").length, 2); // VFV.TO + CAD cash
});

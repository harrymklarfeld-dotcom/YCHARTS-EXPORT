// SnapTrade GET /accounts/{accountId}/holdings (one response per account) -> NormalizedSnapshot
import type {
  AssetClass,
  NormalizedAccount,
  NormalizedHolding,
  NormalizedSecurity,
  NormalizedSnapshot,
  SyncWarning,
} from "./types.ts";
import { clean, normalizeTicker, num } from "./tickers.ts";

export interface SnapTradeUniversalSymbol {
  id: string;
  symbol: string;
  raw_symbol?: string | null;
  description?: string | null;
  currency?: { code?: string | null } | null;
  type?: { code?: string | null; description?: string | null } | null;
  figi_code?: string | null;
}
export interface SnapTradePosition {
  symbol?: { id?: string; symbol?: SnapTradeUniversalSymbol | null; description?: string | null } | null;
  units?: number | null;
  price?: number | null;
  average_purchase_price?: number | null;
  currency?: { code?: string | null } | null;
}
export interface SnapTradeOptionPosition {
  symbol?: {
    id?: string;
    option_symbol?: {
      id?: string;
      ticker?: string;
      option_type?: string;
      strike_price?: number;
      expiration_date?: string;
      is_mini_option?: boolean;
      underlying_symbol?: { symbol?: string | null } | null;
    } | null;
  } | null;
  units?: number | null;
  price?: number | null;
  average_purchase_price?: number | null;
  currency?: { code?: string | null } | null;
}
export interface SnapTradeAccount {
  id: string;
  brokerage_authorization: string;
  name?: string | null;
  number?: string | null;
  institution_name?: string | null;
  balance?: { total?: { amount?: number | null; currency?: string | null } | null } | null;
  meta?: { type?: string | null } | null;
  raw_type?: string | null;
}
export interface SnapTradeAccountHoldings {
  account: SnapTradeAccount;
  balances?: Array<{ currency?: { code?: string | null } | null; cash?: number | null }> | null;
  positions?: SnapTradePosition[] | null;
  option_positions?: SnapTradeOptionPosition[] | null;
}

// SnapTrade security type codes: cs common stock, ad ADR, ps preferred, et ETF, oef open-ended fund,
// cef closed-end fund, crypto, bnd bond, rt right, wt warrant, struct, ut unit.
function snapAssetClass(code: string | null | undefined): AssetClass {
  switch ((code ?? "").toLowerCase()) {
    case "cs":
    case "ad":
    case "ps":
    case "cef":
    case "ut":
      return "equity";
    case "et":
      return "etf";
    case "oef":
      return "mutual_fund";
    case "crypto":
      return "crypto";
    case "bnd":
      return "fixed_income";
    default:
      return "other";
  }
}

export function normalizeSnapTradeHoldings(
  responses: SnapTradeAccountHoldings[],
  opts: { asOf: string },
): NormalizedSnapshot {
  const warnings: SyncWarning[] = [];
  const accounts: NormalizedAccount[] = [];
  const securities = new Map<string, NormalizedSecurity>();
  const holdings: NormalizedHolding[] = [];

  for (const r of responses) {
    const a = r.account;
    const institution = a.institution_name ?? null;
    accounts.push({
      provider_account_id: a.id,
      name: a.name || "Brokerage account",
      mask: a.number ? a.number.replace(/\s/g, "").slice(-4) : null,
      type: a.meta?.type ?? a.raw_type ?? null,
      subtype: null,
      institution_name: institution,
      balance_current: num(a.balance?.total?.amount),
      currency: a.balance?.total?.currency ?? "USD",
    });

    for (const p of r.positions ?? []) {
      const us = p.symbol?.symbol;
      if (!us?.id) {
        warnings.push({ code: "unknown_security", message: "Position without a symbol; skipped", provider_account_id: a.id });
        continue;
      }
      const asset_class = snapAssetClass(us.type?.code);
      const ticker = normalizeTicker(us.symbol);
      if (!ticker) {
        warnings.push({ code: "unmapped_security", message: `No usable ticker for ${us.description ?? us.id}`, provider_security_id: us.id });
      }
      if (!securities.has(us.id)) {
        securities.set(us.id, {
          provider_security_id: us.id,
          ticker,
          cusip: null,
          isin: null,
          name: us.description ?? null,
          asset_class,
          is_cash_equivalent: false,
          underlying_ticker: null,
        });
      }
      const units = num(p.units) ?? 0;
      const price = num(p.price);
      if (units === 0) {
        warnings.push({ code: "zero_quantity_skipped", message: `Skipped zero position in ${ticker ?? us.id}`, provider_security_id: us.id });
        continue;
      }
      if (price === null) {
        warnings.push({ code: "missing_market_value", message: `No price for ${ticker ?? us.id}; market value set to 0`, provider_security_id: us.id });
      }
      const avg = num(p.average_purchase_price);
      if (avg === null) {
        warnings.push({ code: "missing_cost_basis", message: `Brokerage did not report cost basis for ${ticker ?? us.id}`, provider_security_id: us.id, provider_account_id: a.id });
      }
      const currency = p.currency?.code ?? us.currency?.code ?? "USD";
      if (currency !== "USD") {
        warnings.push({ code: "non_usd", message: `${ticker ?? us.id} is priced in ${currency}; excluded from USD totals`, provider_security_id: us.id });
      }
      if (asset_class === "crypto") {
        warnings.push({ code: "crypto_position", message: `Crypto ${ticker} kept; no company fundamentals`, provider_security_id: us.id });
      }
      holdings.push({
        provider_account_id: a.id,
        provider_security_id: us.id,
        institution,
        ticker,
        name: us.description ?? null,
        asset_class,
        quantity: clean(units),
        cost_basis: avg === null ? null : clean(avg * units),
        market_value: clean(price === null ? 0 : units * price),
        currency,
        as_of: opts.asOf,
      });
    }

    for (const op of r.option_positions ?? []) {
      const os = op.symbol?.option_symbol;
      const id = os?.id ?? op.symbol?.id;
      if (!id) continue;
      const underlying = normalizeTicker(os?.underlying_symbol?.symbol);
      const name = os?.ticker ?? `${underlying ?? "?"} ${os?.option_type ?? ""} ${os?.strike_price ?? ""} ${os?.expiration_date ?? ""}`.trim();
      if (!securities.has(id)) {
        securities.set(id, {
          provider_security_id: id,
          ticker: null,
          cusip: null,
          isin: null,
          name,
          asset_class: "option",
          is_cash_equivalent: false,
          underlying_ticker: underlying,
        });
      }
      const units = num(op.units) ?? 0;
      if (units === 0) continue;
      const multiplier = os?.is_mini_option ? 10 : 100;
      const price = num(op.price);
      warnings.push({ code: "option_position", message: `Option ${name} kept (no ticker; cost basis not normalized)`, provider_security_id: id });
      holdings.push({
        provider_account_id: a.id,
        provider_security_id: id,
        institution,
        ticker: null,
        name,
        asset_class: "option",
        quantity: clean(units),
        cost_basis: null,
        market_value: clean(price === null ? 0 : units * price * multiplier),
        currency: op.currency?.code ?? "USD",
        as_of: opts.asOf,
      });
    }

    for (const b of r.balances ?? []) {
      const cash = num(b.cash);
      const code = b.currency?.code ?? "USD";
      if (cash === null || cash === 0) continue;
      const id = `cash:${code}`;
      if (!securities.has(id)) {
        securities.set(id, {
          provider_security_id: id,
          ticker: null,
          cusip: null,
          isin: null,
          name: `Cash (${code})`,
          asset_class: "cash",
          is_cash_equivalent: true,
          underlying_ticker: null,
        });
      }
      if (code !== "USD") {
        warnings.push({ code: "non_usd", message: `Cash balance in ${code}; excluded from USD totals`, provider_security_id: id });
      }
      holdings.push({
        provider_account_id: a.id,
        provider_security_id: id,
        institution,
        ticker: null,
        name: `Cash (${code})`,
        asset_class: "cash",
        quantity: clean(cash),
        cost_basis: clean(cash),
        market_value: clean(cash),
        currency: code,
        as_of: opts.asOf,
      });
    }
  }

  return { provider: "snaptrade", as_of: opts.asOf, accounts, securities: [...securities.values()], holdings, warnings };
}

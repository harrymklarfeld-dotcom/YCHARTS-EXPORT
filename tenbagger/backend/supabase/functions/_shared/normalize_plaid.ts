// Plaid /investments/holdings/get  ->  NormalizedSnapshot
// Handles: cash pseudo-securities (CUR:USD), cash-equivalent money-market funds, crypto,
// options (derivative w/ option_contract), fixed income without tickers, proxy securities
// (401k CITs), CUSIP->ticker fallback, null cost basis (common: Plaid often lacks tax lots),
// non-USD currency, zero-quantity rows.
import type {
  AssetClass,
  NormalizedAccount,
  NormalizedHolding,
  NormalizedSecurity,
  NormalizedSnapshot,
  SyncWarning,
} from "./types.ts";
import { clean, normalizeTicker, num, validCusip, validIsin } from "./tickers.ts";

// Minimal structural types for the parts of Plaid's response we read.
export interface PlaidAccount {
  account_id: string;
  balances?: { current?: number | null; iso_currency_code?: string | null; unofficial_currency_code?: string | null };
  mask?: string | null;
  name?: string | null;
  official_name?: string | null;
  type?: string | null;
  subtype?: string | null;
}
export interface PlaidHolding {
  account_id: string;
  security_id: string;
  quantity: number;
  cost_basis?: number | null;
  institution_price?: number | null;
  institution_price_as_of?: string | null;
  institution_value?: number | null;
  iso_currency_code?: string | null;
  unofficial_currency_code?: string | null;
}
export interface PlaidSecurity {
  security_id: string;
  name?: string | null;
  ticker_symbol?: string | null;
  cusip?: string | null;
  isin?: string | null;
  type?: string | null;
  is_cash_equivalent?: boolean | null;
  proxy_security_id?: string | null;
  close_price_as_of?: string | null;
  iso_currency_code?: string | null;
  option_contract?: {
    contract_type?: string;
    expiration_date?: string;
    strike_price?: number;
    underlying_security_ticker?: string | null;
  } | null;
}
export interface PlaidHoldingsResponse {
  accounts: PlaidAccount[];
  holdings: PlaidHolding[];
  securities: PlaidSecurity[];
  item?: { item_id?: string; institution_id?: string | null };
}

export interface NormalizeOptions {
  institutionName: string | null;
  /** Fallback as-of date (YYYY-MM-DD) when Plaid omits price dates. */
  asOf: string;
  /** Optional CUSIP -> ticker lookup (e.g. from an OpenFIGI cache) for ticker-less securities. */
  tickerByCusip?: Record<string, string>;
}

function plaidAssetClass(s: PlaidSecurity): AssetClass {
  const t = (s.type ?? "").toLowerCase();
  if (t === "cash" || (s.ticker_symbol ?? "").toUpperCase().startsWith("CUR:")) return "cash";
  if (s.is_cash_equivalent) return "cash";
  switch (t) {
    case "equity":
      return "equity";
    case "etf":
      return "etf";
    case "mutual fund":
      return "mutual_fund";
    case "cryptocurrency":
      return "crypto";
    case "fixed income":
      return "fixed_income";
    case "derivative":
      return s.option_contract ? "option" : "other";
    default:
      return "other";
  }
}

const TICKERED: AssetClass[] = ["equity", "etf", "mutual_fund", "crypto", "cash"];

export function normalizePlaidHoldings(resp: PlaidHoldingsResponse, opts: NormalizeOptions): NormalizedSnapshot {
  const warnings: SyncWarning[] = [];
  const secById = new Map(resp.securities.map((s) => [s.security_id, s]));

  const accounts: NormalizedAccount[] = resp.accounts
    .filter((a) => !a.type || a.type === "investment" || a.type === "brokerage")
    .map((a) => ({
      provider_account_id: a.account_id,
      name: a.official_name || a.name || "Investment account",
      mask: typeof a.mask === "string" ? a.mask.slice(-4) : null,
      type: a.type ?? null,
      subtype: a.subtype ?? null,
      institution_name: opts.institutionName,
      balance_current: num(a.balances?.current),
      currency: a.balances?.iso_currency_code ?? a.balances?.unofficial_currency_code ?? "USD",
    }));
  const accountIds = new Set(accounts.map((a) => a.provider_account_id));

  const securities = new Map<string, NormalizedSecurity>();
  const resolveSecurity = (s: PlaidSecurity): NormalizedSecurity => {
    const cached = securities.get(s.security_id);
    if (cached) return cached;
    const asset_class = plaidAssetClass(s);
    let ticker: string | null = null;
    let underlying: string | null = null;

    if (asset_class === "option") {
      underlying = normalizeTicker(s.option_contract?.underlying_security_ticker);
    } else if (TICKERED.includes(asset_class)) {
      ticker = normalizeTicker(s.ticker_symbol);
    }

    const cusip = validCusip(s.cusip);
    if (s.cusip && !cusip) {
      warnings.push({ code: "invalid_identifier_dropped", message: `Dropped malformed CUSIP for ${s.name ?? s.security_id}`, provider_security_id: s.security_id });
    }
    if (!ticker && asset_class !== "cash" && asset_class !== "option") {
      // 1) proxy security (Plaid uses these for unlisted funds, e.g. 401k collective trusts)
      const proxy = s.proxy_security_id ? secById.get(s.proxy_security_id) : undefined;
      const proxyTicker = proxy ? normalizeTicker(proxy.ticker_symbol) : null;
      if (proxyTicker) {
        ticker = proxyTicker;
        warnings.push({ code: "proxy_ticker_used", message: `${s.name ?? s.security_id}: using proxy ticker ${proxyTicker}`, provider_security_id: s.security_id });
      } else if (cusip && opts.tickerByCusip?.[cusip]) {
        ticker = normalizeTicker(opts.tickerByCusip[cusip]);
        warnings.push({ code: "cusip_ticker_used", message: `${s.name ?? s.security_id}: ticker ${ticker} resolved from CUSIP`, provider_security_id: s.security_id });
      } else if (asset_class !== "fixed_income" && asset_class !== "other") {
        warnings.push({ code: "unmapped_security", message: `No ticker for ${s.name ?? s.security_id}; kept without ticker`, provider_security_id: s.security_id });
      }
    }

    const ns: NormalizedSecurity = {
      provider_security_id: s.security_id,
      ticker,
      cusip,
      isin: validIsin(s.isin),
      name: s.name ?? null,
      asset_class,
      is_cash_equivalent: asset_class === "cash",
      underlying_ticker: underlying,
    };
    securities.set(s.security_id, ns);
    return ns;
  };

  const holdings: NormalizedHolding[] = [];
  for (const h of resp.holdings) {
    if (!accountIds.has(h.account_id)) continue;
    const raw = secById.get(h.security_id);
    if (!raw) {
      warnings.push({ code: "unknown_security", message: `Holding references unknown security ${h.security_id}; skipped`, provider_security_id: h.security_id, provider_account_id: h.account_id });
      continue;
    }
    const sec = resolveSecurity(raw);
    const qty = num(h.quantity) ?? 0;
    let mv = num(h.institution_value);
    if (mv === null) {
      const px = num(h.institution_price);
      mv = px === null ? null : qty * px;
    }
    if (qty === 0 && (mv ?? 0) === 0) {
      warnings.push({ code: "zero_quantity_skipped", message: `Skipped zero position in ${sec.name ?? sec.provider_security_id}`, provider_security_id: sec.provider_security_id });
      continue;
    }
    if (mv === null) {
      warnings.push({ code: "missing_market_value", message: `No price/value for ${sec.name}; market value set to 0`, provider_security_id: sec.provider_security_id });
      mv = 0;
    }
    const currency = h.iso_currency_code ?? h.unofficial_currency_code ?? raw.iso_currency_code ?? "USD";
    if (currency !== "USD") {
      warnings.push({ code: "non_usd", message: `${sec.name ?? sec.provider_security_id} is priced in ${currency}; excluded from USD totals`, provider_security_id: sec.provider_security_id });
    }
    const cost = num(h.cost_basis);
    if (cost === null && sec.asset_class !== "cash") {
      warnings.push({ code: "missing_cost_basis", message: `Institution did not report cost basis for ${sec.name ?? sec.provider_security_id}`, provider_security_id: sec.provider_security_id, provider_account_id: h.account_id });
    }
    if (sec.asset_class === "option") {
      warnings.push({ code: "option_position", message: `Option ${sec.name ?? ""} kept (no ticker; underlying ${sec.underlying_ticker ?? "unknown"})`, provider_security_id: sec.provider_security_id });
    }
    if (sec.asset_class === "crypto") {
      warnings.push({ code: "crypto_position", message: `Crypto ${sec.ticker ?? sec.name} kept; no company fundamentals`, provider_security_id: sec.provider_security_id });
    }
    holdings.push({
      provider_account_id: h.account_id,
      provider_security_id: sec.provider_security_id,
      institution: opts.institutionName,
      ticker: sec.ticker,
      name: sec.asset_class === "cash" && !sec.name ? `Cash (${currency})` : sec.name,
      asset_class: sec.asset_class,
      quantity: clean(qty),
      cost_basis: cost === null ? (sec.asset_class === "cash" ? clean(mv) : null) : clean(cost),
      market_value: clean(mv),
      currency,
      as_of: (h.institution_price_as_of ?? raw.close_price_as_of ?? opts.asOf).slice(0, 10),
    });
  }

  return {
    provider: "plaid",
    as_of: opts.asOf,
    accounts,
    securities: [...securities.values()],
    holdings,
    warnings,
  };
}

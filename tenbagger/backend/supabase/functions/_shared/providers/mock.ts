// In-memory AggregatorProvider for tests and PROVIDER_MODE=mock local development.
// It runs the REAL normalizers over provider-shaped JSON, so handler tests exercise the
// same code path production uses — only the network hop is faked.
import { normalizePlaidHoldings, type PlaidHoldingsResponse } from "../normalize_plaid.ts";
import { normalizeSnapTradeHoldings, type SnapTradeAccountHoldings } from "../normalize_snaptrade.ts";
import {
  foldTransactionsSync,
  normalizePlaidBalances,
  normalizePlaidLiabilities,
  normalizePlaidRecurring,
  type PlaidAccountsResponse,
  type PlaidLiabilitiesResponse,
  type PlaidRecurringResponse,
  type PlaidTransactionsSyncResponse,
} from "../normalize_plaid_money.ts";
import type { NormalizedBalances, NormalizedLiabilities, NormalizedRecurring, NormalizedSnapshot, ProviderName, TransactionsDelta } from "../types.ts";
import {
  type AggregatorProvider,
  type ExchangeResult,
  type FetchHoldingsContext,
  type LinkSession,
  type ProviderConnection,
  type ProviderCredential,
  ProviderError,
} from "./types.ts";

export interface MockCall {
  method: string;
  args: unknown[];
}

/** Plaid-shaped Money-hub responses replayed by the mock (transactions as ordered sync pages). */
export interface MockMoneyData {
  accounts?: PlaidAccountsResponse;
  liabilities?: PlaidLiabilitiesResponse;
  transactionsPages?: PlaidTransactionsSyncResponse[];
  recurring?: PlaidRecurringResponse;
}

type MoneyMethod = "getBalances" | "getLiabilities" | "syncTransactions" | "getRecurring";

export class MockProvider implements AggregatorProvider {
  readonly calls: MockCall[] = [];
  /** Set to make the next fetchHoldings throw (e.g. ITEM_LOGIN_REQUIRED). */
  failNextFetch: ProviderError | null = null;
  failRemove: ProviderError | null = null;
  /** Make a Money-hub method throw (persistent until cleared), e.g. NO_LIABILITY_ACCOUNTS. */
  failMoney: Partial<Record<MoneyMethod, ProviderError>> = {};
  removed: string[] = [];
  private seq = 0;

  constructor(
    readonly name: ProviderName,
    private readonly data: {
      plaid?: PlaidHoldingsResponse;
      snaptrade?: SnapTradeAccountHoldings[];
      institution?: { id: string; name: string };
      money?: MockMoneyData;
    },
  ) {}

  registerUser(providerUserId: string) {
    this.calls.push({ method: "registerUser", args: [providerUserId] });
    return Promise.resolve({ providerUserId, secret: `mock-secret-${providerUserId}` });
  }

  createLinkSession(input: { appUserId: string; credential?: ProviderCredential; moneyHub?: boolean }): Promise<LinkSession> {
    this.calls.push({ method: "createLinkSession", args: [input.appUserId, !!input.credential, input.moneyHub === true] });
    return Promise.resolve(
      this.name === "plaid"
        ? { linkToken: `link-sandbox-mock-${++this.seq}`, expiration: "2099-01-01T00:00:00Z" }
        : { redirectUrl: `https://app.snaptrade.com/snapTrade/redeemToken?token=mock${++this.seq}` },
    );
  }

  exchangePublicToken(publicToken: string): Promise<ExchangeResult> {
    this.calls.push({ method: "exchangePublicToken", args: [publicToken] });
    const n = ++this.seq;
    return Promise.resolve({
      providerItemId: `mock-item-${n}`,
      accessToken: `access-sandbox-mock-${n}-SECRET`,
      institution: this.data.institution ?? { id: "ins_mock", name: "Mock Brokerage" },
    });
  }

  listConnections(_cred: ProviderCredential): Promise<ProviderConnection[]> {
    this.calls.push({ method: "listConnections", args: [] });
    const ids = [...new Set((this.data.snaptrade ?? []).map((r) => r.account.brokerage_authorization))];
    return Promise.resolve(
      ids.map((id) => ({
        providerItemId: id,
        institution: { id: null, name: (this.data.snaptrade ?? []).find((r) => r.account.brokerage_authorization === id)?.account.institution_name ?? null },
        disabled: false,
      })),
    );
  }

  fetchHoldings(cred: ProviderCredential, ctx: FetchHoldingsContext): Promise<NormalizedSnapshot> {
    this.calls.push({ method: "fetchHoldings", args: [cred.kind, ctx.providerItemId] });
    if (this.failNextFetch) {
      const e = this.failNextFetch;
      this.failNextFetch = null;
      return Promise.reject(e);
    }
    if (this.name === "plaid") {
      return Promise.resolve(normalizePlaidHoldings(structuredClone(this.data.plaid!), { institutionName: ctx.institutionName, asOf: ctx.asOf }));
    }
    const mine = (this.data.snaptrade ?? []).filter((r) => r.account.brokerage_authorization === ctx.providerItemId);
    return Promise.resolve(normalizeSnapTradeHoldings(structuredClone(mine), { asOf: ctx.asOf }));
  }

  removeConnection(_cred: ProviderCredential, providerItemId: string): Promise<void> {
    this.calls.push({ method: "removeConnection", args: [providerItemId] });
    if (this.failRemove) return Promise.reject(this.failRemove);
    this.removed.push(providerItemId);
    return Promise.resolve();
  }

  deleteUser(_cred: ProviderCredential): Promise<void> {
    this.calls.push({ method: "deleteUser", args: [] });
    return Promise.resolve();
  }

  // ---- Money hub: real normalizers over Plaid-shaped fixtures -----------------------------
  private money<T>(method: MoneyMethod, args: unknown[], fn: () => T): Promise<T> {
    this.calls.push({ method, args });
    const e = this.failMoney[method];
    return e ? Promise.reject(e) : Promise.resolve(fn());
  }

  getBalances(cred: ProviderCredential): Promise<NormalizedBalances> {
    return this.money("getBalances", [cred.kind], () => normalizePlaidBalances(structuredClone(this.data.money?.accounts ?? { accounts: [] })));
  }

  getLiabilities(cred: ProviderCredential): Promise<NormalizedLiabilities> {
    return this.money("getLiabilities", [cred.kind], () =>
      normalizePlaidLiabilities(structuredClone(this.data.money?.liabilities ?? { accounts: [], liabilities: {} })));
  }

  /** null cursor => every page; otherwise the pages after the one that returned `cursor`. */
  syncTransactions(cred: ProviderCredential, cursor: string | null): Promise<TransactionsDelta> {
    return this.money("syncTransactions", [cred.kind, cursor], () => {
      const pages = this.data.money?.transactionsPages ?? [];
      const start = cursor === null ? 0 : pages.findIndex((p) => p.next_cursor === cursor) + 1;
      const out: PlaidTransactionsSyncResponse[] = [];
      if (cursor !== null && start === 0) return foldTransactionsSync(out, cursor); // unknown cursor: nothing new
      for (let i = start; i < pages.length; i++) {
        out.push(structuredClone(pages[i]));
        if (!pages[i].has_more) break;
      }
      return foldTransactionsSync(out, cursor);
    });
  }

  getRecurring(cred: ProviderCredential): Promise<NormalizedRecurring> {
    return this.money("getRecurring", [cred.kind], () => normalizePlaidRecurring(structuredClone(this.data.money?.recurring ?? { inflow_streams: [] })));
  }
}

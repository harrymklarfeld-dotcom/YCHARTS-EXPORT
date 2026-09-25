// In-memory AggregatorProvider for tests and PROVIDER_MODE=mock local development.
// It runs the REAL normalizers over provider-shaped JSON, so handler tests exercise the
// same code path production uses — only the network hop is faked.
import { normalizePlaidHoldings, type PlaidHoldingsResponse } from "../normalize_plaid.ts";
import { normalizeSnapTradeHoldings, type SnapTradeAccountHoldings } from "../normalize_snaptrade.ts";
import type { NormalizedSnapshot, ProviderName } from "../types.ts";
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

export class MockProvider implements AggregatorProvider {
  readonly calls: MockCall[] = [];
  /** Set to make the next fetchHoldings throw (e.g. ITEM_LOGIN_REQUIRED). */
  failNextFetch: ProviderError | null = null;
  failRemove: ProviderError | null = null;
  removed: string[] = [];
  private seq = 0;

  constructor(
    readonly name: ProviderName,
    private readonly data: {
      plaid?: PlaidHoldingsResponse;
      snaptrade?: SnapTradeAccountHoldings[];
      institution?: { id: string; name: string };
    },
  ) {}

  registerUser(providerUserId: string) {
    this.calls.push({ method: "registerUser", args: [providerUserId] });
    return Promise.resolve({ providerUserId, secret: `mock-secret-${providerUserId}` });
  }

  createLinkSession(input: { appUserId: string; credential?: ProviderCredential }): Promise<LinkSession> {
    this.calls.push({ method: "createLinkSession", args: [input.appUserId, !!input.credential] });
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
}

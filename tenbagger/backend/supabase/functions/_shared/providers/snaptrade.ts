// SnapTrade REST client (no SDK; injectable fetch). Read-only connections only.
// Auth: query params clientId + timestamp (+ userId/userSecret for user-scoped calls) and a
// `Signature` header = base64(HMAC-SHA256(consumerKey, JSON{content,path,query} with sorted keys)).
// Docs: https://docs.snaptrade.com/docs/getting-started , https://docs.snaptrade.com/reference
import { normalizeSnapTradeHoldings, type SnapTradeAccount, type SnapTradeAccountHoldings } from "../normalize_snaptrade.ts";
import type { NormalizedSnapshot, SyncWarning } from "../types.ts";
import {
  type AggregatorProvider,
  type FetchHoldingsContext,
  type FetchLike,
  type LinkSession,
  type ProviderConnection,
  type ProviderCredential,
  ProviderError,
} from "./types.ts";

export interface SnapTradeConfig {
  clientId: string;
  consumerKey: string;
  baseUrl?: string; // default https://api.snaptrade.com/api/v1
  fetch?: FetchLike;
  now?: () => number;
}

/** JSON.stringify with recursively sorted object keys and no whitespace (matches SnapTrade's signing). */
export function canonicalJson(v: unknown): string {
  if (v === null || typeof v !== "object") return JSON.stringify(v ?? null);
  if (Array.isArray(v)) return `[${v.map(canonicalJson).join(",")}]`;
  const o = v as Record<string, unknown>;
  return `{${Object.keys(o).sort().filter((k) => o[k] !== undefined).map((k) => `${JSON.stringify(k)}:${canonicalJson(o[k])}`).join(",")}}`;
}

export async function snaptradeSignature(consumerKey: string, path: string, query: string, content: unknown): Promise<string> {
  const msg = canonicalJson({ content: content ?? null, path, query });
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(consumerKey), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(msg)));
  let s = "";
  for (const b of sig) s += String.fromCharCode(b);
  return btoa(s);
}

const REAUTH_STATUS = new Set([401, 403]);

export class SnapTradeProvider implements AggregatorProvider {
  readonly name = "snaptrade" as const;
  private readonly base: string;
  private readonly fetch: FetchLike;

  constructor(private readonly cfg: SnapTradeConfig) {
    this.base = cfg.baseUrl ?? "https://api.snaptrade.com/api/v1";
    this.fetch = cfg.fetch ?? fetch;
  }

  async call<T>(method: string, path: string, opts: { user?: ProviderCredential; body?: unknown; extraQuery?: Record<string, string> } = {}): Promise<T> {
    const params = new URLSearchParams({ clientId: this.cfg.clientId, timestamp: String(Math.floor((this.cfg.now?.() ?? Date.now()) / 1000)) });
    if (opts.user) {
      if (opts.user.kind !== "snaptrade") throw new ProviderError("snaptrade", "BAD_CREDENTIAL", "SnapTrade credential required");
      params.set("userId", opts.user.userId);
      params.set("userSecret", opts.user.userSecret);
    }
    for (const [k, v] of Object.entries(opts.extraQuery ?? {})) params.set(k, v);
    const query = params.toString();
    const fullPath = new URL(this.base).pathname.replace(/\/$/, "") + path;
    const signature = await snaptradeSignature(this.cfg.consumerKey, fullPath, query, opts.body ?? null);
    let res: Response;
    try {
      res = await this.fetch(`${this.base}${path}?${query}`, {
        method,
        headers: { "content-type": "application/json", Signature: signature },
        body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
      });
    } catch (e) {
      throw new ProviderError("snaptrade", "NETWORK_ERROR", `SnapTrade unreachable: ${(e as Error).message}`, undefined, false, true);
    }
    if (res.status === 204) return undefined as T;
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const code = String(data.code ?? data.status_code ?? `HTTP_${res.status}`);
      throw new ProviderError("snaptrade", code, String(data.detail ?? data.message ?? "SnapTrade request failed"), res.status, REAUTH_STATUS.has(res.status) && !!opts.user, res.status === 429 || res.status >= 500);
    }
    return data as T;
  }

  async registerUser(providerUserId: string): Promise<{ providerUserId: string; secret: string }> {
    const r = await this.call<{ userId: string; userSecret: string }>("POST", "/snapTrade/registerUser", { body: { userId: providerUserId } });
    return { providerUserId: r.userId, secret: r.userSecret };
  }

  async createLinkSession(input: { appUserId: string; credential?: ProviderCredential; redirectUri?: string; broker?: string }): Promise<LinkSession> {
    if (!input.credential) throw new ProviderError("snaptrade", "BAD_CREDENTIAL", "register the SnapTrade user first");
    const body: Record<string, unknown> = { connectionType: "read" }; // read-only: no trading permissions
    if (input.broker) body.broker = input.broker;
    if (input.redirectUri) body.customRedirect = input.redirectUri;
    const r = await this.call<{ redirectURI: string; sessionId?: string }>("POST", "/snapTrade/login", { user: input.credential, body });
    return { redirectUrl: r.redirectURI };
  }

  async listConnections(cred: ProviderCredential): Promise<ProviderConnection[]> {
    const auths = await this.call<Array<{ id: string; name?: string; disabled?: boolean; brokerage?: { id?: string; name?: string; slug?: string } }>>(
      "GET",
      "/authorizations",
      { user: cred },
    );
    return auths.map((a) => ({
      providerItemId: a.id,
      institution: { id: a.brokerage?.slug ?? a.brokerage?.id ?? null, name: a.brokerage?.name ?? a.name ?? null },
      disabled: !!a.disabled,
    }));
  }

  async fetchHoldings(cred: ProviderCredential, ctx: FetchHoldingsContext): Promise<NormalizedSnapshot> {
    const accounts = await this.call<SnapTradeAccount[]>("GET", "/accounts", { user: cred });
    const mine = accounts.filter((a) => a.brokerage_authorization === ctx.providerItemId);
    const responses: SnapTradeAccountHoldings[] = [];
    const failures: SyncWarning[] = [];
    for (const a of mine) {
      try {
        responses.push(await this.call<SnapTradeAccountHoldings>("GET", `/accounts/${encodeURIComponent(a.id)}/holdings`, { user: cred }));
      } catch (e) {
        if (e instanceof ProviderError && e.needsReauth) throw e;
        failures.push({ code: "account_fetch_failed", message: `Could not fetch holdings for account ${a.name ?? a.id}`, provider_account_id: a.id });
      }
    }
    const snap = normalizeSnapTradeHoldings(responses, { asOf: ctx.asOf });
    snap.warnings.push(...failures);
    return snap;
  }

  async removeConnection(cred: ProviderCredential, providerItemId: string): Promise<void> {
    try {
      await this.call("DELETE", `/authorizations/${encodeURIComponent(providerItemId)}`, { user: cred });
    } catch (e) {
      if (e instanceof ProviderError && e.httpStatus === 404) return;
      throw e;
    }
  }

  async deleteUser(cred: ProviderCredential): Promise<void> {
    if (cred.kind !== "snaptrade") throw new ProviderError("snaptrade", "BAD_CREDENTIAL", "SnapTrade credential required");
    await this.call("DELETE", "/snapTrade/deleteUser", { extraQuery: { userId: cred.userId } });
  }
}

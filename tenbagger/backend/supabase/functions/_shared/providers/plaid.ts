// Plaid REST client (no SDK dependency, injectable fetch for tests).
// Docs: https://plaid.com/docs/api/products/investments/  (read-only "investments" product)
import { normalizePlaidHoldings, type PlaidHoldingsResponse } from "../normalize_plaid.ts";
import type { NormalizedSnapshot } from "../types.ts";
import {
  type AggregatorProvider,
  type ExchangeResult,
  type FetchHoldingsContext,
  type FetchLike,
  type LinkSession,
  type ProviderCredential,
  ProviderError,
} from "./types.ts";

export type PlaidEnv = "sandbox" | "development" | "production";

export interface PlaidConfig {
  clientId: string;
  secret: string;
  env: PlaidEnv;
  clientName?: string;
  countryCodes?: string[];
  fetch?: FetchLike;
  tickerByCusip?: Record<string, string>;
}

// Error codes that require the user to re-authenticate via Link update mode.
const REAUTH_CODES = new Set(["ITEM_LOGIN_REQUIRED", "PENDING_EXPIRATION", "INVALID_CREDENTIALS", "INSUFFICIENT_CREDENTIALS", "USER_PERMISSION_REVOKED"]);
const RETRYABLE_CODES = new Set(["PRODUCT_NOT_READY", "RATE_LIMIT_EXCEEDED", "INSTITUTION_DOWN", "INSTITUTION_NOT_RESPONDING", "INTERNAL_SERVER_ERROR"]);
// Removing an item that Plaid already considers gone is success for our purposes.
const ALREADY_GONE = new Set(["ITEM_NOT_FOUND", "INVALID_ACCESS_TOKEN"]);

export class PlaidProvider implements AggregatorProvider {
  readonly name = "plaid" as const;
  private readonly base: string;
  private readonly fetch: FetchLike;

  constructor(private readonly cfg: PlaidConfig) {
    this.base = `https://${cfg.env}.plaid.com`;
    this.fetch = cfg.fetch ?? fetch;
  }

  /** POST with client_id/secret in the body (Plaid's auth scheme). Never logs the body. */
  async call<T>(path: string, body: Record<string, unknown>): Promise<T> {
    let res: Response;
    try {
      res = await this.fetch(`${this.base}${path}`, {
        method: "POST",
        headers: { "content-type": "application/json", "plaid-version": "2020-09-14" },
        body: JSON.stringify({ client_id: this.cfg.clientId, secret: this.cfg.secret, ...body }),
      });
    } catch (e) {
      throw new ProviderError("plaid", "NETWORK_ERROR", `Plaid unreachable: ${(e as Error).message}`, undefined, false, true);
    }
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const code = String(data.error_code ?? `HTTP_${res.status}`);
      throw new ProviderError(
        "plaid",
        code,
        String(data.error_message ?? "Plaid request failed"),
        res.status,
        REAUTH_CODES.has(code),
        RETRYABLE_CODES.has(code) || res.status >= 500,
      );
    }
    return data as T;
  }

  private token(cred?: ProviderCredential): string {
    if (!cred || cred.kind !== "plaid") throw new ProviderError("plaid", "BAD_CREDENTIAL", "Plaid credential required");
    return cred.accessToken;
  }

  async createLinkSession(input: { appUserId: string; credential?: ProviderCredential; redirectUri?: string; webhookUrl?: string }): Promise<LinkSession> {
    const body: Record<string, unknown> = {
      client_name: this.cfg.clientName ?? "Tenbagger",
      language: "en",
      country_codes: this.cfg.countryCodes ?? ["US"],
      user: { client_user_id: input.appUserId },
    };
    if (input.credential) {
      body.access_token = this.token(input.credential); // update mode (re-auth) — no products
    } else {
      body.products = ["investments"];
    }
    if (input.webhookUrl) body.webhook = input.webhookUrl;
    if (input.redirectUri) body.redirect_uri = input.redirectUri;
    const r = await this.call<{ link_token: string; expiration: string }>("/link/token/create", body);
    return { linkToken: r.link_token, expiration: r.expiration };
  }

  async exchangePublicToken(publicToken: string): Promise<ExchangeResult> {
    const ex = await this.call<{ access_token: string; item_id: string }>("/item/public_token/exchange", { public_token: publicToken });
    let institution: ExchangeResult["institution"] = { id: null, name: null };
    try {
      const item = await this.call<{ item: { institution_id: string | null } }>("/item/get", { access_token: ex.access_token });
      const instId = item.item.institution_id;
      if (instId) {
        const inst = await this.call<{ institution: { name: string } }>("/institutions/get_by_id", {
          institution_id: instId,
          country_codes: this.cfg.countryCodes ?? ["US"],
        });
        institution = { id: instId, name: inst.institution.name };
      }
    } catch {
      // Institution name is cosmetic; linking must not fail because of it.
    }
    return { providerItemId: ex.item_id, accessToken: ex.access_token, institution };
  }

  async fetchHoldingsRaw(cred: ProviderCredential): Promise<PlaidHoldingsResponse> {
    return await this.call<PlaidHoldingsResponse>("/investments/holdings/get", { access_token: this.token(cred) });
  }

  async fetchHoldings(cred: ProviderCredential, ctx: FetchHoldingsContext): Promise<NormalizedSnapshot> {
    const raw = await this.fetchHoldingsRaw(cred);
    return normalizePlaidHoldings(raw, { institutionName: ctx.institutionName, asOf: ctx.asOf, tickerByCusip: this.cfg.tickerByCusip });
  }

  async removeConnection(cred: ProviderCredential): Promise<void> {
    try {
      await this.call("/item/remove", { access_token: this.token(cred) });
    } catch (e) {
      if (e instanceof ProviderError && ALREADY_GONE.has(e.code)) return;
      throw e;
    }
  }

  /** Used by webhook verification: fetch the JWK for a given key id. */
  async getWebhookVerificationKey(keyId: string): Promise<JsonWebKey & { expired_at?: number | null }> {
    const r = await this.call<{ key: JsonWebKey & { expired_at?: number | null } }>("/webhook_verification_key/get", { key_id: keyId });
    return r.key;
  }
}

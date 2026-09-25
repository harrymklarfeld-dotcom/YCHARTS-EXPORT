// Plaid webhook verification + event classification.
//
// Plaid signs each webhook with a JWT in the `Plaid-Verification` header:
//   header  {alg:"ES256", kid, typ:"JWT"}
//   payload {iat, request_body_sha256}
// Verification (https://plaid.com/docs/api/webhooks/webhook-verification/):
//   1. alg must be ES256; 2. fetch JWK for kid via /webhook_verification_key/get (cache it);
//   3. verify ES256 signature; 4. iat no older than 5 minutes;
//   5. SHA-256(raw body) must equal request_body_sha256 (constant-time compare).
// STATUS: implemented against Plaid's documented scheme and unit-tested with a locally
// generated P-256 key. NOT yet exercised against a live Plaid webhook (needs real keys).
import { b64urlDecode, sha256Hex, timingSafeEqual } from "./crypto.ts";

export type JwkFetcher = (kid: string) => Promise<(JsonWebKey & { expired_at?: number | null }) | null>;

export interface VerifyResult {
  ok: boolean;
  reason?: string;
}

const MAX_AGE_SEC = 5 * 60;

export async function verifyPlaidWebhook(
  rawBody: string,
  jwt: string | null,
  getKey: JwkFetcher,
  nowSec: number = Math.floor(Date.now() / 1000),
): Promise<VerifyResult> {
  if (!jwt) return { ok: false, reason: "missing Plaid-Verification header" };
  const parts = jwt.split(".");
  if (parts.length !== 3) return { ok: false, reason: "malformed JWT" };
  let header: { alg?: string; kid?: string };
  let payload: { iat?: number; request_body_sha256?: string };
  try {
    header = JSON.parse(new TextDecoder().decode(b64urlDecode(parts[0])));
    payload = JSON.parse(new TextDecoder().decode(b64urlDecode(parts[1])));
  } catch {
    return { ok: false, reason: "malformed JWT" };
  }
  if (header.alg !== "ES256") return { ok: false, reason: "unexpected alg" };
  if (!header.kid) return { ok: false, reason: "missing kid" };

  const jwk = await getKey(header.kid).catch(() => null);
  if (!jwk) return { ok: false, reason: "unknown kid" };
  if (jwk.expired_at && jwk.expired_at < nowSec) return { ok: false, reason: "key expired" };

  let valid = false;
  try {
    const { expired_at: _e, ...pub } = jwk as JsonWebKey & { expired_at?: unknown; created_at?: unknown; use?: string };
    const key = await crypto.subtle.importKey(
      "jwk",
      { kty: pub.kty, crv: pub.crv, x: pub.x, y: pub.y, ext: true },
      { name: "ECDSA", namedCurve: "P-256" },
      false,
      ["verify"],
    );
    valid = await crypto.subtle.verify(
      { name: "ECDSA", hash: "SHA-256" },
      key,
      b64urlDecode(parts[2]) as BufferSource,
      new TextEncoder().encode(`${parts[0]}.${parts[1]}`),
    );
  } catch {
    return { ok: false, reason: "bad key or signature encoding" };
  }
  if (!valid) return { ok: false, reason: "bad signature" };
  if (typeof payload.iat !== "number" || nowSec - payload.iat > MAX_AGE_SEC || payload.iat - nowSec > 60) {
    return { ok: false, reason: "stale or future iat" };
  }
  const bodyHash = await sha256Hex(rawBody);
  if (!payload.request_body_sha256 || !timingSafeEqual(bodyHash, payload.request_body_sha256)) {
    return { ok: false, reason: "body hash mismatch" };
  }
  return { ok: true };
}

/** Cache JWKs by kid (Plaid rotates rarely; re-fetch on miss). */
export function cachedJwkFetcher(fetcher: JwkFetcher, ttlMs = 60 * 60 * 1000): JwkFetcher {
  const cache = new Map<string, { at: number; key: Awaited<ReturnType<JwkFetcher>> }>();
  return async (kid) => {
    const hit = cache.get(kid);
    if (hit && Date.now() - hit.at < ttlMs) return hit.key;
    const key = await fetcher(kid);
    if (key) cache.set(kid, { at: Date.now(), key });
    return key;
  };
}

export type WebhookAction =
  | { kind: "status"; status: "needs_reauth" | "revoked" | "active" | "error"; reason: string }
  | { kind: "sync" }
  | { kind: "ignore" };

export interface PlaidWebhookBody {
  webhook_type?: string;
  webhook_code?: string;
  item_id?: string;
  error?: { error_code?: string; error_message?: string } | null;
}

/** Map a Plaid webhook to what we should do with the linked item. */
export function classifyPlaidWebhook(b: PlaidWebhookBody): WebhookAction {
  const type = b.webhook_type ?? "";
  const code = b.webhook_code ?? "";
  if (type === "ITEM") {
    if (code === "ERROR" && b.error?.error_code === "ITEM_LOGIN_REQUIRED") {
      return { kind: "status", status: "needs_reauth", reason: "ITEM_LOGIN_REQUIRED" };
    }
    if (code === "ITEM_LOGIN_REQUIRED") return { kind: "status", status: "needs_reauth", reason: "ITEM_LOGIN_REQUIRED" };
    if (code === "PENDING_EXPIRATION" || code === "PENDING_DISCONNECT") return { kind: "status", status: "needs_reauth", reason: code };
    if (code === "USER_PERMISSION_REVOKED" || code === "USER_ACCOUNT_REVOKED") return { kind: "status", status: "revoked", reason: code };
    if (code === "LOGIN_REPAIRED") return { kind: "status", status: "active", reason: code };
    if (code === "ERROR") return { kind: "status", status: "error", reason: b.error?.error_code ?? "ERROR" };
  }
  if (type === "HOLDINGS" && code === "DEFAULT_UPDATE") return { kind: "sync" };
  return { kind: "ignore" };
}

/** Money-hub webhooks (acted on only for items that opted in; holdings logic above is unchanged). */
export function isMoneyHubWebhook(b: PlaidWebhookBody): boolean {
  const type = b.webhook_type ?? "";
  const code = b.webhook_code ?? "";
  return (type === "TRANSACTIONS" && (code === "SYNC_UPDATES_AVAILABLE" || code === "RECURRING_TRANSACTIONS_UPDATE")) ||
    (type === "LIABILITIES" && code === "DEFAULT_UPDATE");
}

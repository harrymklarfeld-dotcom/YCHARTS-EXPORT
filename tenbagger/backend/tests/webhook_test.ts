import { assertEquals } from "jsr:@std/assert@1";
import { b64urlEncode, sha256Hex } from "../supabase/functions/_shared/crypto.ts";
import { classifyPlaidWebhook, verifyPlaidWebhook } from "../supabase/functions/_shared/webhook.ts";

const enc = (o: unknown) => b64urlEncode(new TextEncoder().encode(JSON.stringify(o)));

async function setup() {
  const kp = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]);
  const jwk = await crypto.subtle.exportKey("jwk", kp.publicKey);
  const sign = async (body: string, iat: number, kid = "kid-1", alg = "ES256", bodyHashOverride?: string) => {
    const h = enc({ alg, kid, typ: "JWT" });
    const p = enc({ iat, request_body_sha256: bodyHashOverride ?? (await sha256Hex(body)) });
    const sig = new Uint8Array(await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, kp.privateKey, new TextEncoder().encode(`${h}.${p}`)));
    return `${h}.${p}.${b64urlEncode(sig)}`;
  };
  const getKey = (kid: string) => Promise.resolve(kid === "kid-1" ? { ...jwk, expired_at: null } : null);
  return { sign, getKey };
}

const NOW = 1_790_000_000;
const BODY = JSON.stringify({ webhook_type: "ITEM", webhook_code: "ERROR", item_id: "item-1", error: { error_code: "ITEM_LOGIN_REQUIRED" } });

Deno.test("valid Plaid-Verification JWT is accepted", async () => {
  const { sign, getKey } = await setup();
  assertEquals(await verifyPlaidWebhook(BODY, await sign(BODY, NOW - 10), getKey, NOW), { ok: true });
});

Deno.test("rejects: missing header, tampered body, stale iat, wrong alg, unknown kid, bad signature", async () => {
  const { sign, getKey } = await setup();
  assertEquals((await verifyPlaidWebhook(BODY, null, getKey, NOW)).ok, false);
  const jwt = await sign(BODY, NOW);
  assertEquals((await verifyPlaidWebhook(BODY.replace("item-1", "item-2"), jwt, getKey, NOW)).reason, "body hash mismatch");
  assertEquals((await verifyPlaidWebhook(BODY, await sign(BODY, NOW - 301), getKey, NOW)).reason, "stale or future iat");
  assertEquals((await verifyPlaidWebhook(BODY, await sign(BODY, NOW, "kid-1", "HS256"), getKey, NOW)).reason, "unexpected alg");
  assertEquals((await verifyPlaidWebhook(BODY, await sign(BODY, NOW, "kid-x"), getKey, NOW)).reason, "unknown kid");
  const [h, p, s] = jwt.split(".");
  const forged = `${h}.${enc({ iat: NOW, request_body_sha256: await sha256Hex("{}") })}.${s}`;
  assertEquals((await verifyPlaidWebhook("{}", forged, getKey, NOW)).reason, "bad signature");
  assertEquals((await verifyPlaidWebhook(BODY, `${h}.${p}`, getKey, NOW)).reason, "malformed JWT");
});

Deno.test("classifyPlaidWebhook maps ITEM/HOLDINGS events", () => {
  assertEquals(classifyPlaidWebhook(JSON.parse(BODY)), { kind: "status", status: "needs_reauth", reason: "ITEM_LOGIN_REQUIRED" });
  assertEquals(classifyPlaidWebhook({ webhook_type: "ITEM", webhook_code: "PENDING_EXPIRATION" }).kind, "status");
  assertEquals(classifyPlaidWebhook({ webhook_type: "ITEM", webhook_code: "USER_PERMISSION_REVOKED" }), { kind: "status", status: "revoked", reason: "USER_PERMISSION_REVOKED" });
  assertEquals(classifyPlaidWebhook({ webhook_type: "ITEM", webhook_code: "LOGIN_REPAIRED" }), { kind: "status", status: "active", reason: "LOGIN_REPAIRED" });
  assertEquals(classifyPlaidWebhook({ webhook_type: "ITEM", webhook_code: "ERROR", error: { error_code: "INSTITUTION_DOWN" } }), { kind: "status", status: "error", reason: "INSTITUTION_DOWN" });
  assertEquals(classifyPlaidWebhook({ webhook_type: "HOLDINGS", webhook_code: "DEFAULT_UPDATE" }), { kind: "sync" });
  assertEquals(classifyPlaidWebhook({ webhook_type: "TRANSACTIONS", webhook_code: "SYNC_UPDATES_AVAILABLE" }), { kind: "ignore" });
});

// deno-lint-ignore-file no-explicit-any
// Provider REST clients exercised against a fake fetch that replays sandbox-shaped JSON.
// Verifies request construction (endpoints, auth, read-only flags) and error mapping.
import { assert, assertEquals, assertRejects } from "jsr:@std/assert@1";
import { PlaidProvider } from "../supabase/functions/_shared/providers/plaid.ts";
import { canonicalJson, SnapTradeProvider, snaptradeSignature } from "../supabase/functions/_shared/providers/snaptrade.ts";
import { ProviderError } from "../supabase/functions/_shared/providers/types.ts";

const plaidFx = JSON.parse(await Deno.readTextFile(new URL("./fixtures/plaid_investments_holdings_get.json", import.meta.url)));
const snapFx = JSON.parse(await Deno.readTextFile(new URL("./fixtures/snaptrade_account_holdings.json", import.meta.url)));

type Seen = { url: string; method: string; headers: Headers; body: unknown };
function fakeFetch(routes: Record<string, (body: any, url: URL) => { status?: number; json: unknown }>) {
  const seen: Seen[] = [];
  const f = (input: string | URL | Request, init?: RequestInit) => {
    const url = new URL(String(input));
    const body = init?.body ? JSON.parse(String(init.body)) : undefined;
    seen.push({ url: url.toString(), method: init?.method ?? "GET", headers: new Headers(init?.headers), body });
    const key = `${init?.method ?? "GET"} ${url.pathname}`;
    const h = routes[key];
    if (!h) return Promise.resolve(new Response(JSON.stringify({ error: "no route " + key }), { status: 404 }));
    const r = h(body, url);
    return Promise.resolve(new Response(JSON.stringify(r.json), { status: r.status ?? 200, headers: { "content-type": "application/json" } }));
  };
  return { f, seen };
}

Deno.test("plaid: link token (investments product), exchange, holdings, remove", async () => {
  const { f, seen } = fakeFetch({
    "POST /link/token/create": () => ({ json: { link_token: "link-sandbox-abc", expiration: "2026-09-25T04:00:00Z", request_id: "r" } }),
    "POST /item/public_token/exchange": () => ({ json: { access_token: "access-sandbox-xyz", item_id: "item-1", request_id: "r" } }),
    "POST /item/get": () => ({ json: { item: { item_id: "item-1", institution_id: "ins_115616" } } }),
    "POST /institutions/get_by_id": () => ({ json: { institution: { institution_id: "ins_115616", name: "Fidelity" } } }),
    "POST /investments/holdings/get": () => ({ json: plaidFx }),
    "POST /item/remove": () => ({ json: { request_id: "r" } }),
  });
  const p = new PlaidProvider({ clientId: "cid", secret: "sec", env: "sandbox", fetch: f });
  const s = await p.createLinkSession({ appUserId: "u1", webhookUrl: "https://x.test/hook" });
  assertEquals(s.linkToken, "link-sandbox-abc");
  assert(seen[0].url.startsWith("https://sandbox.plaid.com/link/token/create"));
  assertEquals((seen[0].body as any).products, ["investments"]);
  assertEquals((seen[0].body as any).user, { client_user_id: "u1" });
  assertEquals([(seen[0].body as any).client_id, (seen[0].body as any).secret], ["cid", "sec"]);

  const ex = await p.exchangePublicToken("public-sandbox-00000000-0000-0000-0000-000000000000");
  assertEquals(ex, { providerItemId: "item-1", accessToken: "access-sandbox-xyz", institution: { id: "ins_115616", name: "Fidelity" } });

  const snap = await p.fetchHoldings({ kind: "plaid", accessToken: "access-sandbox-xyz" }, { providerItemId: "item-1", institutionName: "Fidelity", asOf: "2026-09-25" });
  assertEquals(snap.holdings.length, 14);

  // update mode: access_token instead of products
  await p.createLinkSession({ appUserId: "u1", credential: { kind: "plaid", accessToken: "access-sandbox-xyz" } });
  const upd = seen.at(-1)!.body as any;
  assertEquals([upd.access_token, upd.products], ["access-sandbox-xyz", undefined]);

  await p.removeConnection({ kind: "plaid", accessToken: "access-sandbox-xyz" });
  assertEquals(seen.at(-1)!.url, "https://sandbox.plaid.com/item/remove");
});

Deno.test("plaid: error mapping (ITEM_LOGIN_REQUIRED → needsReauth, PRODUCT_NOT_READY → retryable, ITEM_NOT_FOUND on remove is ok)", async () => {
  const { f } = fakeFetch({
    "POST /investments/holdings/get": () => ({ status: 400, json: { error_type: "ITEM_ERROR", error_code: "ITEM_LOGIN_REQUIRED", error_message: "the login details of this item have changed" } }),
    "POST /item/remove": () => ({ status: 400, json: { error_type: "ITEM_ERROR", error_code: "ITEM_NOT_FOUND", error_message: "gone" } }),
  });
  const p = new PlaidProvider({ clientId: "c", secret: "s", env: "sandbox", fetch: f });
  const e = await assertRejects(() => p.fetchHoldings({ kind: "plaid", accessToken: "t" }, { providerItemId: "i", institutionName: null, asOf: "2026-09-25" }), ProviderError);
  assertEquals([e.code, e.needsReauth, e.retryable], ["ITEM_LOGIN_REQUIRED", true, false]);
  await p.removeConnection({ kind: "plaid", accessToken: "t" }); // no throw

  const { f: f2 } = fakeFetch({ "POST /investments/holdings/get": () => ({ status: 400, json: { error_code: "PRODUCT_NOT_READY" } }) });
  const e2 = await assertRejects(() => new PlaidProvider({ clientId: "c", secret: "s", env: "sandbox", fetch: f2 }).fetchHoldingsRaw({ kind: "plaid", accessToken: "t" }), ProviderError);
  assertEquals([e2.needsReauth, e2.retryable], [false, true]);
});

Deno.test("snaptrade: canonical signing string + HMAC matches independent computation", async () => {
  assertEquals(canonicalJson({ query: "a=1", path: "/p", content: { b: 1, a: [2, { d: 1, c: 2 }] } }), '{"content":{"a":[2,{"c":2,"d":1}],"b":1},"path":"/p","query":"a=1"}');
  assertEquals(canonicalJson({ content: null, path: "/x", query: "" }), '{"content":null,"path":"/x","query":""}');
  // Independent HMAC via WebCrypto on the literal string
  const msg = '{"content":null,"path":"/api/v1/accounts","query":"clientId=C&timestamp=1"}';
  const k = await crypto.subtle.importKey("raw", new TextEncoder().encode("secret-key"), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const expected = btoa(String.fromCharCode(...new Uint8Array(await crypto.subtle.sign("HMAC", k, new TextEncoder().encode(msg)))));
  assertEquals(await snaptradeSignature("secret-key", "/api/v1/accounts", "clientId=C&timestamp=1", null), expected);
});

Deno.test("snaptrade: register, read-only login, connections, holdings per authorization, remove", async () => {
  const AUTH1 = "87b24961-b51e-4db8-9226-f198f6518a89";
  const { f, seen } = fakeFetch({
    "POST /api/v1/snapTrade/registerUser": (b) => ({ json: { userId: b.userId, userSecret: "st-secret" } }),
    "POST /api/v1/snapTrade/login": () => ({ json: { redirectURI: "https://app.snaptrade.com/snapTrade/redeemToken?token=t", sessionId: "s" } }),
    "GET /api/v1/authorizations": () => ({ json: [{ id: AUTH1, disabled: false, brokerage: { name: "Robinhood", slug: "ROBINHOOD" } }] }),
    "GET /api/v1/accounts": () => ({ json: snapFx.map((r: any) => r.account) }),
    "GET /api/v1/accounts/917c8734-8470-4a3e-a18f-57c3f2ee6631/holdings": () => ({ json: snapFx[0] }),
    "GET /api/v1/accounts/0c5a2f36-4a0b-4c1d-9b8e-2b1e5d3f7a10/holdings": () => ({ status: 500, json: { detail: "brokerage timeout" } }),
    "DELETE /api/v1/authorizations/87b24961-b51e-4db8-9226-f198f6518a89": () => ({ status: 404, json: { detail: "not found" } }),
  });
  const p = new SnapTradeProvider({ clientId: "CID", consumerKey: "CK", fetch: f, now: () => 1_790_000_000_000 });
  const reg = await p.registerUser("opaque-1");
  assertEquals(reg, { providerUserId: "opaque-1", secret: "st-secret" });
  assert(seen[0].headers.get("Signature"));
  assertEquals(new URL(seen[0].url).searchParams.get("clientId"), "CID");
  assertEquals(new URL(seen[0].url).searchParams.get("timestamp"), "1790000000");
  // signature covers path + query + body
  const u0 = new URL(seen[0].url);
  assertEquals(seen[0].headers.get("Signature"), await snaptradeSignature("CK", u0.pathname, u0.search.slice(1), { userId: "opaque-1" }));

  const cred = { kind: "snaptrade" as const, userId: "opaque-1", userSecret: "st-secret" };
  const s = await p.createLinkSession({ appUserId: "u", credential: cred });
  assert(s.redirectUrl!.startsWith("https://app.snaptrade.com/"));
  assertEquals((seen[1].body as any).connectionType, "read");

  const conns = await p.listConnections(cred);
  assertEquals(conns, [{ providerItemId: AUTH1, institution: { id: "ROBINHOOD", name: "Robinhood" }, disabled: false }]);

  const snap = await p.fetchHoldings(cred, { providerItemId: AUTH1, institutionName: "Robinhood", asOf: "2026-09-25" });
  assertEquals(snap.accounts.length, 1); // 2nd account failed, 3rd belongs to another authorization
  assertEquals(snap.holdings.length, 6);
  assert(snap.warnings.some((w) => w.code === "account_fetch_failed"));

  await p.removeConnection(cred, AUTH1); // 404 treated as already removed
});

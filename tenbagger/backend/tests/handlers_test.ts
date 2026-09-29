// End-to-end handler tests: real handlers + real Repo SQL (PGlite w/ migrations + seed)
// + real AES-GCM cipher + MockProvider replaying sandbox-shaped fixtures.
import { assert, assertEquals, assertFalse } from "jsr:@std/assert@1";
import { TokenCipher } from "../supabase/functions/_shared/crypto.ts";
import {
  type AuthContext,
  type Deps,
  plaidExchange,
  plaidLinkToken,
  plaidSyncHoldings,
  plaidWebhook,
  portfolioSummary,
  snaptradeRegister,
  snaptradeSync,
  unlink,
} from "../supabase/functions/_shared/handlers.ts";
import { MockProvider } from "../supabase/functions/_shared/providers/mock.ts";
import { ProviderError } from "../supabase/functions/_shared/providers/types.ts";
import { Repo } from "../supabase/functions/_shared/repo.ts";
import { createUser, executor, freshDb } from "./helpers/db.ts";

const plaidFx = JSON.parse(await Deno.readTextFile(new URL("./fixtures/plaid_investments_holdings_get.json", import.meta.url)));
const snapFx = JSON.parse(await Deno.readTextFile(new URL("./fixtures/snaptrade_account_holdings.json", import.meta.url)));

const ALICE = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const BOB = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const PUBLIC_TOKEN = "public-sandbox-b0e2c4ee-a763-4df5-bfe9-46a46bce993d";

const db = await freshDb({ seed: true });
await createUser(db, ALICE);
await createUser(db, BOB);

const plaid = new MockProvider("plaid", { plaid: plaidFx, institution: { id: "ins_115616", name: "Fidelity" } });
const snaptrade = new MockProvider("snaptrade", { snaptrade: snapFx });
// Wall-clock based: last_synced_at is stamped by Postgres now().
let clock = new Date();
let webhookOk = true;
const logs: string[] = [];

const deps: Deps = {
  repo: new Repo(executor(db)),
  cipher: await TokenCipher.fromRawKeys({ k1: new Uint8Array(32).fill(7) }, "k1"),
  authenticate: (req) => {
    const t = req.headers.get("authorization")?.replace("Bearer ", "") ?? "";
    const [uid, aal] = t.split(":");
    if (!uid) return Promise.reject(new (class extends Error {})());
    return Promise.resolve({ userId: uid, aal: (aal ?? "aal2") as AuthContext["aal"] });
  },
  plaid,
  snaptrade,
  verifyPlaidWebhook: () => Promise.resolve(webhookOk ? { ok: true } : { ok: false, reason: "bad signature" }),
  config: { requireMfaForLinking: true, allowedOrigins: ["http://localhost:8081"], minSyncIntervalSec: 60 },
  now: () => clock,
  log: (_l, msg, f) => logs.push(JSON.stringify({ msg, ...f })),
};

const req = (user: string | null, body?: unknown, method = "POST", headers: Record<string, string> = {}) =>
  new Request("http://localhost/fn", {
    method,
    headers: { ...(user ? { authorization: `Bearer ${user}` } : {}), "content-type": "application/json", ...headers },
    body: body === undefined ? undefined : typeof body === "string" ? body : JSON.stringify(body),
  });

const SECRET_PATTERNS = [/access-sandbox/, /mock-secret/, /v1\.k1\./, /access_token/, /secret_ciphertext/];
function assertNoSecrets(text: string) {
  for (const p of SECRET_PATTERNS) assertFalse(p.test(text), `response leaked ${p}`);
}

let aliceItem = "";

Deno.test("plaid-link-token requires MFA (aal2) and returns only a link token", async () => {
  const denied = await plaidLinkToken(req(`${ALICE}:aal1`, {}), deps);
  assertEquals(denied.status, 403);
  assertEquals((await denied.json()).error, "mfa_required");
  const ok = await plaidLinkToken(req(ALICE, {}, "POST", { origin: "http://localhost:8081" }), deps);
  assertEquals(ok.status, 200);
  assertEquals(ok.headers.get("access-control-allow-origin"), "http://localhost:8081");
  assertEquals(ok.headers.get("cache-control"), "no-store");
  const body = await ok.json();
  assert(body.link_token.startsWith("link-sandbox-"));
  assertEquals(body.mode, "create");
});

Deno.test("input validation: unknown fields, bad token format, bad JSON, wrong method", async () => {
  assertEquals((await plaidExchange(req(ALICE, { public_token: PUBLIC_TOKEN, user_id: BOB }), deps)).status, 400);
  assertEquals((await plaidExchange(req(ALICE, { public_token: "public-sandbox-'; drop table x;--" }), deps)).status, 400);
  assertEquals((await plaidExchange(req(ALICE, "{not json"), deps)).status, 400);
  assertEquals((await plaidExchange(req(ALICE, "x".repeat(20000)), deps)).status, 413);
  assertEquals((await plaidExchange(req(ALICE, undefined, "GET"), deps)).status, 405);
  assertEquals((await unlink(req(ALICE, { item_id: "not-a-uuid" }), deps)).status, 400);
  assertEquals((await plaidExchange(req(ALICE, { public_token: PUBLIC_TOKEN }, "OPTIONS"), deps)).status, 204);
});

Deno.test("plaid-exchange encrypts + stores token, syncs, and never returns secrets", async () => {
  const res = await plaidExchange(req(ALICE, { public_token: PUBLIC_TOKEN }), deps);
  const text = await res.text();
  assertEquals(res.status, 200, text);
  assertNoSecrets(text);
  const body = JSON.parse(text);
  aliceItem = body.item.id;
  assertEquals(body.item.institution_name, "Fidelity");
  assertEquals(body.item.status, "active");
  assertEquals(body.sync.status, "succeeded");
  assertEquals(body.sync.holdings_count, 14);

  const row = (await db.query<Record<string, string>>(`select access_token_ciphertext, access_token_key_id from linked_items where id = $1`, [aliceItem])).rows[0];
  assert(row.access_token_ciphertext.startsWith("v1.k1."));
  assertFalse(row.access_token_ciphertext.includes("access-sandbox"));
  assertEquals(row.access_token_key_id, "k1");
  // decrypts only with the right AAD
  const pt = await deps.cipher.decrypt(row.access_token_ciphertext, `plaid:${ALICE}:mock-item-2`);
  assert(pt.startsWith("access-sandbox-mock-"));

  const runs = (await db.query<Record<string, unknown>>(`select status, trigger, holdings_count from sync_runs where linked_item_id = $1`, [aliceItem])).rows;
  assertEquals(runs, [{ status: "succeeded", trigger: "link", holdings_count: 14 }]);
  const contract = (await db.query<Record<string, unknown>>(`select institution, ticker, quantity::float8 q, cost_basis::float8 c, market_value::float8 mv, as_of::text, source from holdings_contract hc join accounts a on a.id = hc.account_id where a.provider_account_id = 'BxBXxLj1m4HMXBm9WZZmCWVbPjX16EHwv99vp' and ticker = 'MU'`)).rows;
  assertEquals(contract, [{ institution: "Fidelity", ticker: "MU", q: 10.5, c: 950, mv: 1050, as_of: "2026-09-24", source: "plaid" }]);
  assertEquals(logs.filter((l) => /access-sandbox/.test(l)), []);
});

Deno.test("plaid-link-token update mode for an existing item; other users get 404", async () => {
  const r = await plaidLinkToken(req(ALICE, { item_id: aliceItem }), deps);
  assertEquals((await r.json()).mode, "update");
  assertEquals((await plaidLinkToken(req(BOB, { item_id: aliceItem }), deps)).status, 404);
  assertEquals((await plaidSyncHoldings(req(BOB, { item_id: aliceItem }), deps)).status, 404);
  assertEquals((await unlink(req(BOB, { item_id: aliceItem }), deps)).status, 404);
});

Deno.test("plaid-sync-holdings throttles, then ITEM_LOGIN_REQUIRED marks needs_reauth", async () => {
  const throttled = await (await plaidSyncHoldings(req(ALICE, {}), deps)).json();
  assertEquals(throttled.results[0].error_code, "throttled");
  clock = new Date(clock.getTime() + 120_000);
  plaid.failNextFetch = new ProviderError("plaid", "ITEM_LOGIN_REQUIRED", "login changed", 400, true);
  const failed = await (await plaidSyncHoldings(req(ALICE, { item_id: aliceItem }), deps)).json();
  assertEquals([failed.results[0].status, failed.results[0].item_status], ["failed", "needs_reauth"]);
  const st = (await db.query(`select status, status_reason from linked_items where id = $1`, [aliceItem])).rows[0];
  assertEquals(st, { status: "needs_reauth", status_reason: "ITEM_LOGIN_REQUIRED" });
  // holdings from the last good sync are preserved
  assertEquals((await db.query<{ n: number }>(`select count(*)::int n from holdings where user_id = $1`, [ALICE])).rows[0].n, 14);
  const skipped = await (await plaidSyncHoldings(req(ALICE, { force: true }), deps)).json();
  assertEquals(skipped.results[0].status, "skipped");
});

Deno.test("plaid-webhook: signature enforced; LOGIN_REPAIRED, ITEM_LOGIN_REQUIRED, DEFAULT_UPDATE", async () => {
  webhookOk = false;
  assertEquals((await plaidWebhook(req(null, { webhook_type: "ITEM", webhook_code: "LOGIN_REPAIRED", item_id: "mock-item-2" }), deps)).status, 401);
  webhookOk = true;
  const repaired = await (await plaidWebhook(req(null, { webhook_type: "ITEM", webhook_code: "LOGIN_REPAIRED", item_id: "mock-item-2" }), deps)).json();
  assertEquals(repaired.item_status, "active");
  const lr = await (await plaidWebhook(req(null, { webhook_type: "ITEM", webhook_code: "ERROR", item_id: "mock-item-2", error: { error_code: "ITEM_LOGIN_REQUIRED" } }), deps)).json();
  assertEquals(lr.item_status, "needs_reauth");
  assertEquals((await db.query(`select status from linked_items where id = $1`, [aliceItem])).rows[0], { status: "needs_reauth" });
  await plaidWebhook(req(null, { webhook_type: "ITEM", webhook_code: "LOGIN_REPAIRED", item_id: "mock-item-2" }), deps);
  const upd = await (await plaidWebhook(req(null, { webhook_type: "HOLDINGS", webhook_code: "DEFAULT_UPDATE", item_id: "mock-item-2" }), deps)).json();
  assertEquals(upd.sync, "succeeded");
  const unknown = await plaidWebhook(req(null, { webhook_type: "HOLDINGS", webhook_code: "DEFAULT_UPDATE", item_id: "nope" }), deps);
  assertEquals(unknown.status, 200);
});

Deno.test("portfolio-summary joins holdings with company metrics", async () => {
  const res = await portfolioSummary(req(ALICE, undefined, "GET"), deps);
  const s = await res.json();
  assertEquals(res.status, 200);
  // USD total: 1050+1800+1000+855+1200.55+600+525+100+500+5000+980+300+1350 = 15260.55 (RY in CAD excluded)
  assertEquals(s.total_market_value, 15260.55);
  assertEquals(s.largest_holding.ticker, "VFIFX");
  assertEquals(s.lesson_context.holding.ticker, "COST"); // largest position that is in companies.json
  assertEquals(s.lesson_context.holdings_in_universe, ["COST", "MU", "AAPL"]);
  // Harmonic P/E over COST 3150, MU 1550, AAPL 1000 using seeded earnings yields
  const ey = (3150 * 0.020233 + 1550 * 0.0759 + 1000 * 0.02984) / 5700;
  assert(Math.abs(s.weighted.pe.value - 1 / ey) < 1e-3, `${s.weighted.pe.value} vs ${1 / ey}`);
  assertEquals(s.sector_mix.find((x: { sector: string }) => x.sector === "Technology").market_value, 2550);
  assert(s.warnings.some((w: string) => w.includes("CAD")));
  assertNoSecrets(JSON.stringify(s));
  const bob = await (await portfolioSummary(req(BOB, undefined, "GET"), deps)).json();
  assertEquals([bob.total_market_value, bob.position_count], [0, 0]);
});

Deno.test("snaptrade-register + snaptrade-sync create one item per authorization", async () => {
  assertEquals((await snaptradeRegister(req(`${BOB}:aal1`, {}), deps)).status, 403);
  const reg = await snaptradeRegister(req(BOB, { broker: "ROBINHOOD" }), deps);
  const regText = await reg.text();
  assertEquals(reg.status, 200, regText);
  assertNoSecrets(regText);
  assert(JSON.parse(regText).redirect_url.startsWith("https://app.snaptrade.com/"));
  const au = (await db.query<Record<string, string>>(`select provider_user_id, secret_ciphertext from aggregator_users where user_id = $1`, [BOB])).rows[0];
  assert(au.secret_ciphertext.startsWith("v1.k1."));
  assert(au.provider_user_id !== BOB); // opaque id, not our user uuid
  // idempotent: second register reuses the user
  await snaptradeRegister(req(BOB, {}), deps);
  assertEquals(snaptrade.calls.filter((c) => c.method === "registerUser").length, 1);

  const sync = await snaptradeSync(req(BOB, {}), deps);
  const text = await sync.text();
  assertEquals(sync.status, 200, text);
  assertNoSecrets(text);
  const body = JSON.parse(text);
  assertEquals(body.items.length, 2);
  assertEquals(body.results.map((r: { holdings_count: number }) => r.holdings_count).sort(), [2, 8]);
  const s = await (await portfolioSummary(req(BOB, undefined, "GET"), deps)).json();
  assertEquals(s.lesson_context.holdings_in_universe, ["KO", "RIVN", "MU"]);
  // Alice cannot sync Bob's SnapTrade (no registration)
  assertEquals((await snaptradeSync(req(ALICE, {}), deps)).status, 409);
});

Deno.test("unlink: provider removal + local deletion; all:true deletes SnapTrade user", async () => {
  const one = await (await unlink(req(ALICE, { item_id: aliceItem }), deps)).json();
  assertEquals(one, { removed: [aliceItem], provider_errors: [] });
  assertEquals(plaid.removed, ["mock-item-2"]);
  assertEquals((await db.query<{ n: number }>(`select count(*)::int n from holdings where user_id = $1`, [ALICE])).rows[0].n, 0);
  assertEquals((await db.query<{ n: number }>(`select count(*)::int n from linked_items where user_id = $1`, [ALICE])).rows[0].n, 0);

  snaptrade.failRemove = new ProviderError("snaptrade", "HTTP_500", "boom", 500, false, true);
  const all = await (await unlink(req(BOB, { all: true }), deps)).json();
  assertEquals(all.removed.length, 2);
  assertEquals(all.provider_errors.length, 2); // still deleted locally, logged for ops
  assert(snaptrade.calls.some((c) => c.method === "deleteUser"));
  assertEquals((await db.query<{ n: number }>(`select count(*)::int n from aggregator_users where user_id = $1`, [BOB])).rows[0].n, 0);
  assertEquals((await db.query<{ n: number }>(`select count(*)::int n from holdings where user_id = $1`, [BOB])).rows[0].n, 0);
  const audit = (await db.query<{ action: string }>(`select action from audit_log where user_id = $1 order by id`, [BOB])).rows.map((r) => r.action);
  assert(audit.includes("unlink.provider_remove_failed") && audit.includes("unlink.item_deleted"));
  assertEquals((await unlink(req(ALICE, {}), deps)).status, 400);
});

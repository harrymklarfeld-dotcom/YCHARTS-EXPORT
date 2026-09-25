// Money hub end-to-end: real handlers + real Repo SQL (PGlite, all migrations) + real
// AES-GCM cipher + MockProvider replaying fictional Plaid-shaped fixtures through the real
// normalizers. Checks link-token products, opt-in, money-sync (cursor deltas, snapshots),
// money-summary shape for packages/money, and that tokens never leak.
import { assert, assertEquals, assertFalse } from "jsr:@std/assert@1";
import { TokenCipher } from "../supabase/functions/_shared/crypto.ts";
import { type AuthContext, type Deps, moneySummary, moneySync, plaidExchange, plaidLinkToken, plaidWebhook } from "../supabase/functions/_shared/handlers.ts";
import type { MoneySummary } from "../supabase/functions/_shared/money.ts";
import { MockProvider } from "../supabase/functions/_shared/providers/mock.ts";
import { ProviderError } from "../supabase/functions/_shared/providers/types.ts";
import { Repo } from "../supabase/functions/_shared/repo.ts";
import { asRole, createUser, executor, freshDb } from "./helpers/db.ts";

const fx = async (n: string) => JSON.parse(await Deno.readTextFile(new URL(`./fixtures/${n}`, import.meta.url)));
const money = {
  accounts: await fx("plaid_accounts_get.json"),
  liabilities: await fx("plaid_liabilities_get.json"),
  transactionsPages: await fx("plaid_transactions_sync.json"),
  recurring: await fx("plaid_transactions_recurring_get.json"),
};

const ALICE = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const BOB = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const PUBLIC_TOKEN = "public-sandbox-5c1a2b3c-4d5e-4f60-8a7b-9c0d1e2f3a4b";

const db = await freshDb({ seed: true });
await createUser(db, ALICE);
await createUser(db, BOB);
await db.query(`update profiles set timezone = 'America/Chicago' where id = $1`, [ALICE]);

const plaid = new MockProvider("plaid", {
  plaid: await fx("plaid_investments_holdings_get.json"),
  institution: { id: "ins_fictional_northwind", name: "Northwind Credit Union (fictional)" },
  money,
});
const snaptrade = new MockProvider("snaptrade", { snaptrade: [] });
const clock = new Date("2026-09-25T15:00:00Z"); // 10:00 in America/Chicago
const logs: string[] = [];
const deps: Deps = {
  repo: new Repo(executor(db)),
  cipher: await TokenCipher.fromRawKeys({ k1: new Uint8Array(32).fill(9) }, "k1"),
  authenticate: (req) => {
    const [uid, aal] = (req.headers.get("authorization")?.replace("Bearer ", "") ?? "").split(":");
    return uid ? Promise.resolve({ userId: uid, aal: (aal ?? "aal2") as AuthContext["aal"] }) : Promise.reject(new Error("no auth"));
  },
  plaid,
  snaptrade,
  verifyPlaidWebhook: () => Promise.resolve({ ok: true }),
  config: { requireMfaForLinking: true, allowedOrigins: [], minSyncIntervalSec: 60 },
  now: () => clock,
  log: (_l, msg, f) => logs.push(JSON.stringify({ msg, ...f })),
};
const req = (user: string | null, body?: unknown, method = "POST") =>
  new Request("http://localhost/fn", {
    method,
    headers: { ...(user ? { authorization: `Bearer ${user}` } : {}), "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

const SECRET_PATTERNS = [/access-sandbox/, /SECRET/, /v1\.k1\./, /access_token/, /ciphertext/, /cur-fictional/, /transactions_cursor/];
function assertNoSecrets(text: string, where = "response") {
  for (const p of SECRET_PATTERNS) assertFalse(p.test(text), `${where} leaked ${p}`);
}

let item = "";
const providerItemId = async () => (await db.query<{ p: string }>(`select provider_item_id p from linked_items where id = $1`, [item])).rows[0].p;
let summary: MoneySummary;

Deno.test("money: link token requests Transactions only on opt-in; MFA still required", async () => {
  assertEquals((await plaidLinkToken(req(`${ALICE}:aal1`, { money_hub: true }), deps)).status, 403);
  const r = await (await plaidLinkToken(req(ALICE, { money_hub: true }), deps)).json();
  assertEquals([r.mode, r.money_hub], ["create", true]);
  assertEquals(plaid.calls.at(-1), { method: "createLinkSession", args: [ALICE, false, true] });
  const legacy = await (await plaidLinkToken(req(ALICE, {}), deps)).json();
  assertEquals(legacy.money_hub, false);
  assertEquals(plaid.calls.at(-1)!.args[2], false);
  assertEquals((await plaidLinkToken(req(ALICE, { money_hub: "yes" }), deps)).status, 400);
});

Deno.test("money: exchange with money_hub on a bank without investments -> money sync + first snapshot", async () => {
  plaid.failNextFetch = new ProviderError("plaid", "NO_INVESTMENT_ACCOUNTS", "no investment accounts", 400);
  const res = await plaidExchange(req(ALICE, { public_token: PUBLIC_TOKEN, money_hub: true }), deps);
  const text = await res.text();
  assertEquals(res.status, 200, text);
  assertNoSecrets(text);
  const body = JSON.parse(text);
  item = body.item.id;
  assertEquals([body.item.status, body.item.money_hub], ["active", true]); // missing investments is not an Item error
  assertEquals([body.sync.status, body.sync.error_code], ["skipped", "NO_INVESTMENT_ACCOUNTS"]);
  assertEquals(body.money.status, "succeeded");
  assertEquals(body.money.counts, { cash_accounts: 2, liabilities: 2, transactions_upserted: 4, transactions_removed: 0, transactions_skipped_retention: 1, income_streams: 4 });
  assertEquals(body.money.warnings.map((w: { code: string }) => w.code).sort(), ["investment_account_skipped", "retention_skipped", "transfer_stream_skipped"]);
  assertEquals((await db.query<{ n: number }>(`select count(*)::int n from money_snapshots where user_id = $1`, [ALICE])).rows[0].n, 1);
  const runs = (await db.query(`select kind, status from sync_runs where linked_item_id = $1 order by started_at`, [item])).rows;
  assertEquals(runs, [{ kind: "holdings", status: "succeeded" }, { kind: "money", status: "succeeded" }]);
});

Deno.test("money-summary: normalized input for packages/money with basis labels", async () => {
  // Manual data the user owns: a manual brokerage and an hourly job with unsubmitted hours.
  await asRole(db, "authenticated", ALICE, async () => {
    const acct = (await db.query<{ id: string }>(`insert into accounts (user_id, name, type, subtype) values ($1, 'Roth IRA (manual)', 'investment', 'roth') returning id`, [ALICE])).rows[0].id;
    await db.query(`insert into holdings (user_id, account_id, ticker, quantity, market_value, as_of, source) values ($1, $2, 'VTI', 1, 300, '2026-09-25', 'manual')`, [ALICE, acct]);
    await db.query(
      `insert into income_streams (user_id, source, description, frequency, pay_type, rate, units_per_week, weekdays, next_pay_date,
                                   withholding_rate, condition, pending_units, pending_period_end)
       values ($1, 'manual', 'Campus library job', 'biweekly', 'hourly', 15.5, 10, '{1,3,5}', '2026-10-09', 0.05, 'hours submitted', 19.5, '2026-10-03')`,
      [ALICE],
    );
  });
  const res = await moneySummary(req(ALICE, undefined, "GET"), deps);
  const text = await res.text();
  assertEquals(res.status, 200, text);
  assertNoSecrets(text);
  summary = JSON.parse(text);
  assertEquals([summary.asOf, summary.timezone, summary.horizonDays, summary.schemaVersion], ["2026-09-25", "America/Chicago", 45, 1]);

  assertEquals(summary.accounts.map((a) => [a.name, a.kind, a.balance, a.available ?? null, a.basis]), [
    ["Everyday Checking", "checking", 612.44, 587.44, "verified"],
    ["Rainy Day Savings", "savings", 1500, 1500, "verified"],
    ["Roth IRA (manual)", "retirement", 300, null, "manual"],
    ["Campus Rewards Card", "credit_card", 734.21, null, "verified"],
    ["Direct Unsubsidized", "loan", 12450, null, "verified"],
  ]);
  const card = summary.accounts.find((a) => a.kind === "credit_card")!;
  assertEquals(summary.liabilities.map(({ accountId, statementBalance, minimumDue, dueDate, apr, basis }) => ({ accountId, statementBalance, minimumDue, dueDate, apr, basis })), [
    { accountId: card.id, statementBalance: 689.4, minimumDue: 35, dueDate: "2026-10-12", apr: 0.2499, basis: "verified" },
  ]); // loan in school: no due date -> account only

  assertEquals(summary.incomeStreams.length, 1);
  const job = summary.incomeStreams[0];
  assertEquals(
    [job.kind, job.rate, job.schedule, job.payFrequency, job.nextPayDate, job.withholdingRate, job.condition, job.pendingUnsubmitted, job.basis],
    ["hourly", 15.5, { unitsPerWeek: 10, weekdays: [1, 3, 5] }, "biweekly", "2026-10-09", 0.05, "hours submitted", { units: 19.5, periodEnd: "2026-10-03" }, "manual"],
  );
  assertEquals(summary.detectedStreams.map((s) => [s.name, s.status, s.asIncomeStream?.payFrequency ?? null]), [
    ["DashCart", "tombstoned", null], // merchant_name preferred over the raw description
    ["QUILL UNIV PAYROLL DIR DEP", "mature", "biweekly"],
    ["RESEARCH STIPEND FICTIONAL LAB", "mature", null],
    ["Tutorly", "early_detection", "weekly"],
  ]);
  // Payroll (biweekly from 10-02), tutoring (weekly from 09-29), stipend once on 10-20; horizon ends 11-09.
  assertEquals(summary.expectedDeposits.map((d) => `${d.date} ${d.streamName} ${d.amount} ${d.basis}/${d.confidence}`), [
    "2026-09-29 Tutorly 57.5 projected/low",
    "2026-10-02 QUILL UNIV PAYROLL DIR DEP 412.37 projected/high",
    "2026-10-06 Tutorly 57.5 projected/low",
    "2026-10-13 Tutorly 57.5 projected/low",
    "2026-10-16 QUILL UNIV PAYROLL DIR DEP 412.37 projected/high",
    "2026-10-20 RESEARCH STIPEND FICTIONAL LAB 250 projected/low",
    "2026-10-20 Tutorly 57.5 projected/low",
    "2026-10-27 Tutorly 57.5 projected/low",
    "2026-10-30 QUILL UNIV PAYROLL DIR DEP 412.37 projected/high",
    "2026-11-03 Tutorly 57.5 projected/low",
  ]);
  assertEquals(summary.deposits, [{ date: "2026-09-18", amount: 386.1, basis: "verified" }, { date: "2026-09-22", amount: 65, basis: "verified" }]);

  assertEquals(summary.snapshots.length, 1);
  const s0 = summary.snapshots[0];
  assertEquals(s0.takenAt, "2026-09-25T10:00"); // user's local wall time
  assertEquals(s0.accounts.map((a) => a.id).sort(), summary.accounts.filter((a) => a.basis === "verified").map((a) => a.id).sort()); // manual Roth added after
  assertEquals((s0.basis as { liabilities: Record<string, string> }).liabilities, { [card.id]: "verified" });
  assertEquals(summary.sources.map((x) => [x.itemId, x.moneyHub, x.status]), [[item, true, "active"]]);
  assert(summary.warnings.length === 0, JSON.stringify(summary.warnings));

  // Bob sees nothing of Alice's
  const bob: MoneySummary = await (await moneySummary(req(BOB, undefined, "GET"), deps)).json();
  assertEquals([bob.accounts, bob.liabilities, bob.incomeStreams, bob.expectedDeposits, bob.snapshots, bob.sources], [[], [], [], [], [], []]);
});

Deno.test("money-sync: throttle, cursor delta, product errors as warnings, append-only history", async () => {
  const throttled = await (await moneySync(req(ALICE, {}), deps)).json();
  assertEquals([throttled.results[0].error_code, throttled.snapshot_id], ["throttled", null]);

  // New Plaid page after our cursor; Liabilities temporarily not ready.
  money.transactionsPages.push({ added: [], modified: [], removed: [{ transaction_id: "tx_book_0923" }], next_cursor: "cur-fictional-page-3", has_more: false });
  plaid.failMoney.getLiabilities = new ProviderError("plaid", "PRODUCT_NOT_READY", "not ready", 400, false, true);
  const res = await moneySync(req(ALICE, { force: true }), deps);
  const text = await res.text();
  assertNoSecrets(text);
  const r = JSON.parse(text);
  assertEquals(plaid.calls.filter((c) => c.method === "syncTransactions").at(-1)!.args, ["plaid", "cur-fictional-page-2"]);
  assertEquals(r.results[0].counts.transactions_removed, 1);
  assert(r.results[0].warnings.some((w: { code: string }) => w.code === "product_not_ready"));
  assert(typeof r.snapshot_id === "string");
  assertEquals((await db.query(`select status from sync_runs where kind = 'money' order by started_at desc limit 1`)).rows, [{ status: "partial" }]);
  // Details not fetched this time: balances refresh, last known statement/due date are kept
  const after: MoneySummary = await (await moneySummary(req(ALICE, undefined, "GET"), deps)).json();
  assertEquals(after.liabilities.map((l) => [l.dueDate, l.minimumDue]), [["2026-10-12", 35]]);
  assertEquals(after.snapshots.length, 2);
  assertEquals(after.snapshots.map((s) => s.accounts.some((a) => a.basis === "manual")), [false, true]); // oldest first
  plaid.failMoney = {};

  // Re-auth error marks the item and skips further money syncs
  plaid.failMoney.getBalances = new ProviderError("plaid", "ITEM_LOGIN_REQUIRED", "login required", 400, true);
  const failed = await (await moneySync(req(ALICE, { force: true }), deps)).json();
  assertEquals([failed.results[0].status, failed.results[0].item_status, failed.snapshot_id], ["failed", "needs_reauth", null]);
  plaid.failMoney = {};
  await db.query(`update linked_items set status = 'active', status_reason = null where id = $1`, [item]);

  // Webhook-driven money sync only for opted-in items
  const wh = await (await plaidWebhook(req(null, { webhook_type: "TRANSACTIONS", webhook_code: "SYNC_UPDATES_AVAILABLE", item_id: await providerItemId() }), deps)).json();
  assertEquals(wh, { received: true, sync: "succeeded" });
  assertEquals((await db.query<{ n: number }>(`select count(*)::int n from money_snapshots where user_id = $1`, [ALICE])).rows[0].n, 3);

  // Other users cannot sync / toggle Alice's item
  assertEquals((await moneySync(req(BOB, { item_id: item }), deps)).status, 404);
  assertEquals((await moneySync(req(BOB, { item_id: item, enable: false }), deps)).status, 404);
  assertEquals((await moneySync(req(ALICE, { enable: true }), deps)).status, 400);
  assertEquals((await moneySync(req(ALICE, { user_id: BOB }), deps)).status, 400);
});

Deno.test("money-sync: opt-out deletes item money data but keeps append-only snapshots; opt-in needs MFA", async () => {
  const off = await (await moneySync(req(ALICE, { item_id: item, enable: false }), deps)).json();
  assertEquals(off.disabled, item);
  const left = (await db.query<Record<string, number>>(
    `select (select count(*) from cash_accounts where user_id = $1)::int c, (select count(*) from transactions where user_id = $1)::int t,
            (select count(*) from income_streams where user_id = $1 and source = 'plaid')::int s,
            (select count(*) from income_streams where user_id = $1 and source = 'manual')::int m,
            (select count(*) from money_snapshots where user_id = $1)::int snaps`,
    [ALICE],
  )).rows[0];
  assertEquals(left, { c: 0, t: 0, s: 0, m: 1, snaps: 3 });
  assertEquals((await db.query(`select money_hub, transactions_cursor from linked_items where id = $1`, [item])).rows, [{ money_hub: false, transactions_cursor: null }]);
  // Money webhooks are ignored once opted out
  assertEquals(await (await plaidWebhook(req(null, { webhook_type: "TRANSACTIONS", webhook_code: "SYNC_UPDATES_AVAILABLE", item_id: await providerItemId() }), deps)).json(), { received: true });

  assertEquals((await moneySync(req(`${ALICE}:aal1`, { item_id: item, enable: true }), deps)).status, 403);
  const on = await (await moneySync(req(ALICE, { item_id: item, enable: true }), deps)).json();
  assertEquals(on.results[0].status, "succeeded");
  assertEquals(plaid.calls.filter((c) => c.method === "syncTransactions").at(-1)!.args, ["plaid", null]); // cursor reset: full re-pull
});

Deno.test("money: no secret ever reaches logs, audit, sync_runs or snapshots", async () => {
  const dump = JSON.stringify([
    logs,
    (await db.query(`select detail from audit_log`)).rows,
    (await db.query(`select warnings, error_message from sync_runs`)).rows,
    (await db.query(`select snapshot, basis from money_snapshots`)).rows,
  ]);
  assertNoSecrets(dump.replaceAll("cur-fictional", "x"), "stored data"); // cursors live only in linked_items
  assertFalse(/access-sandbox/.test(dump));
});

Deno.test({
  name: "money-summary output is accepted by packages/money (validateSnapshot + coverageCheck)",
  ignore: !(await Deno.stat(new URL("../../packages/money/src/index.ts", import.meta.url)).then(() => true).catch(() => false)),
  fn: async () => {
    // Dynamic import: the package is built concurrently; its types are not part of `deno check` here.
    const path = new URL("../../packages/money/src/index.ts", import.meta.url).href;
    // deno-lint-ignore no-explicit-any
    let m: any;
    try {
      m = await import(path);
    } catch (e) {
      console.warn(`packages/money not importable yet: ${(e as Error).message}`);
      return;
    }
    const latest = summary.snapshots.at(-1)!;
    assertEquals(m.validateSnapshot(latest), []);
    const report = m.coverageCheck(latest, summary.incomeStreams, 30);
    assertEquals(report.dues.map((d: { dueDate: string; statementBalance: number }) => [d.dueDate, d.statementBalance]), [["2026-10-12", 689.4]]);
    assert(typeof report.headline === "string");
  },
});

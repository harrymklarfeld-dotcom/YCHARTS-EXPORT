// Runs the REAL migrations + seed in PGlite (Postgres 17 in WASM) and checks RLS by
// switching to the Supabase API roles with a JWT subject, exactly as PostgREST does.
import { assert, assertEquals, assertRejects } from "jsr:@std/assert@1";
import { asRole, createUser, freshDb, migrationFiles } from "./helpers/db.ts";

const ALICE = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const BOB = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

const db = await freshDb({ seed: true });
await createUser(db, ALICE);
await createUser(db, BOB);

// Service-role style setup (superuser == postgres connection used by edge functions)
const item = (await db.query<{ id: string }>(
  `insert into linked_items (user_id, provider, provider_item_id, institution_name, access_token_ciphertext, access_token_key_id)
   values ($1, 'plaid', 'item-alice', 'Fidelity', 'v1.k1.iv.ct', 'k1') returning id`,
  [ALICE],
)).rows[0].id;
await db.query(`select replace_item_holdings($1, $2, $3::jsonb)`, [
  ALICE,
  item,
  JSON.stringify({
    as_of: "2026-09-25",
    accounts: [{ provider_account_id: "acc-1", name: "Brokerage", mask: "4321", type: "investment", subtype: "brokerage", balance_current: 2850, currency: "USD" }],
    securities: [
      { provider_security_id: "sec_mu", ticker: "MU", cusip: "595112103", name: "Micron", asset_class: "equity" },
      { provider_security_id: "sec_cash", ticker: null, name: "Cash", asset_class: "cash", is_cash_equivalent: true },
    ],
    holdings: [
      { provider_account_id: "acc-1", provider_security_id: "sec_mu", ticker: "MU", name: "Micron", asset_class: "equity", quantity: 10.5, cost_basis: 950, market_value: 1050, currency: "USD", as_of: "2026-09-24" },
      { provider_account_id: "acc-1", provider_security_id: "sec_cash", ticker: null, name: "Cash", asset_class: "cash", quantity: 1800, cost_basis: 1800, market_value: 1800, currency: "USD" },
    ],
  }),
]);

Deno.test("all migrations apply cleanly and every public table has RLS enabled", async () => {
  assert((await migrationFiles()).length >= 3);
  const r = await db.query<{ relname: string; relrowsecurity: boolean }>(
    `select c.relname, c.relrowsecurity from pg_class c join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relkind = 'r' order by 1`,
  );
  const tables = r.rows.map((x) => x.relname);
  for (const t of ["profiles", "lesson_progress", "daily_activity", "linked_items", "accounts", "holdings", "securities", "sync_runs", "companies", "company_metrics", "aggregator_users", "audit_log"]) {
    assert(tables.includes(t), `missing table ${t}`);
  }
  assertEquals(r.rows.filter((x) => !x.relrowsecurity).map((x) => x.relname), []);
  const pol = await db.query<{ n: number }>(`select count(*)::int n from pg_policies where schemaname = 'public'`);
  assert(pol.rows[0].n >= 15);
});

Deno.test("new auth user gets profile + lesson_progress via trigger", async () => {
  const r = await db.query(`select hearts, xp from lesson_progress where user_id = $1`, [ALICE]);
  assertEquals(r.rows, [{ hearts: 5, xp: 0 }]);
});

Deno.test("RLS: users see only their own holdings / accounts / items", async () => {
  const alice = await asRole(db, "authenticated", ALICE, () => db.query(`select ticker, market_value::float8 mv from holdings_contract order by mv`));
  assertEquals(alice.rows, [{ ticker: "MU", mv: 1050 }, { ticker: null, mv: 1800 }]);
  const bob = await asRole(db, "authenticated", BOB, async () => ({
    h: (await db.query(`select * from holdings`)).rows.length,
    v: (await db.query(`select * from holdings_contract`)).rows.length,
    a: (await db.query(`select * from accounts`)).rows.length,
    i: (await db.query(`select id from linked_items`)).rows.length,
    s: (await db.query(`select * from securities`)).rows.length,
  }));
  assertEquals(bob, { h: 0, v: 0, a: 0, i: 0, s: 0 });
  const aliceSec = await asRole(db, "authenticated", ALICE, () => db.query(`select ticker from securities order by ticker`));
  assertEquals(aliceSec.rows.length, 2);
  const anon = await asRole(db, "anon", null, () => db.query(`select * from holdings`).then((r) => r.rows.length).catch(() => "denied"));
  assertEquals(anon, "denied");
});

Deno.test("RLS: encrypted token columns are not selectable by clients", async () => {
  await asRole(db, "authenticated", ALICE, async () => {
    const ok = await db.query(`select id, institution_name, status from linked_items`);
    assertEquals(ok.rows.length, 1);
    await assertRejects(() => db.query(`select access_token_ciphertext from linked_items`), Error, "permission denied");
    await assertRejects(() => db.query(`select * from linked_items`), Error, "permission denied");
    await assertRejects(() => db.query(`select * from aggregator_users`), Error, "permission denied");
    await assertRejects(() => db.query(`select * from audit_log`), Error, "permission denied");
  });
});

Deno.test("RLS: clients cannot write aggregator holdings; may manage manual holdings", async () => {
  const acct = (await db.query<{ id: string }>(`select id from accounts where user_id = $1`, [ALICE])).rows[0].id;
  await asRole(db, "authenticated", ALICE, async () => {
    // forged provider-sourced holding into own linked account -> blocked
    await assertRejects(
      () => db.query(`insert into holdings (user_id, account_id, ticker, quantity, market_value, as_of, source) values ($1, $2, 'AAPL', 1, 1, current_date, 'plaid')`, [ALICE, acct]),
      Error,
      "row-level security",
    );
    // manual holding into a linked account -> blocked
    await assertRejects(
      () => db.query(`insert into holdings (user_id, account_id, ticker, quantity, market_value, as_of, source) values ($1, $2, 'AAPL', 1, 1, current_date, 'manual')`, [ALICE, acct]),
      Error,
      "row-level security",
    );
    // update / delete of synced rows silently affects 0 rows
    assertEquals((await db.query(`update holdings set quantity = 999 where source = 'plaid'`)).affectedRows, 0);
    assertEquals((await db.query(`delete from holdings where source = 'plaid'`)).affectedRows, 0);
    // manual account + holding -> allowed
    const m = (await db.query<{ id: string }>(`insert into accounts (user_id, name) values ($1, 'My notebook') returning id`, [ALICE])).rows[0].id;
    await db.query(`insert into holdings (user_id, account_id, ticker, quantity, market_value, as_of, source) values ($1, $2, 'KO', 3, 210, current_date, 'manual')`, [ALICE, m]);
  });
  await asRole(db, "authenticated", BOB, async () => {
    // Bob cannot write into Alice's manual account
    const m = (await db.query<{ id: string }>(`select id from accounts`)).rows;
    assertEquals(m.length, 0);
    await assertRejects(() => db.query(`insert into accounts (user_id, name) values ($1, 'x')`, [ALICE]), Error, "row-level security");
  });
  // service-only RPC is not executable by clients
  await asRole(db, "authenticated", ALICE, async () => {
    await assertRejects(() => db.query(`select replace_item_holdings($1, $2, '{}'::jsonb)`, [ALICE, acct]), Error, "permission denied");
    await assertRejects(() => db.query(`select load_companies('{}'::jsonb)`), Error, "permission denied");
  });
});

Deno.test("replace_item_holdings: snapshot replace, stale accounts removed, ownership enforced", async () => {
  const before = (await db.query<{ n: number }>(`select count(*)::int n from holdings where user_id = $1 and source = 'plaid'`, [ALICE])).rows[0].n;
  assertEquals(before, 2);
  const r = await db.query<{ r: unknown }>(`select replace_item_holdings($1, $2, $3::jsonb) r`, [
    ALICE,
    item,
    JSON.stringify({ accounts: [{ provider_account_id: "acc-2", name: "IRA" }], securities: [{ provider_security_id: "sec_mu", ticker: "MU", asset_class: "equity" }], holdings: [{ provider_account_id: "acc-2", provider_security_id: "sec_mu", ticker: "MU", asset_class: "equity", quantity: 1, market_value: 100 }] }),
  ]);
  assertEquals(r.rows[0].r, { holdings: 1, accounts: 1 });
  const acc = await db.query(`select provider_account_id from accounts where linked_item_id = $1`, [item]);
  assertEquals(acc.rows, [{ provider_account_id: "acc-2" }]);
  await assertRejects(() => db.query(`select replace_item_holdings($1, $2, '{}'::jsonb)`, [BOB, item]), Error, "not found for user");
});

Deno.test("lesson RPCs: xp, streak, hearts, daily_activity; direct writes blocked", async () => {
  await asRole(db, "authenticated", BOB, async () => {
    const d0 = (await db.query<{ d: string }>(`select (current_date - 1)::text d`)).rows[0].d;
    await db.query(`select record_lesson_completion('u1-l1', 10, $1::date)`, [d0]);
    const r1 = await db.query<Record<string, unknown>>(`select * from record_lesson_completion('u1-l2', 15, current_date)`);
    assertEquals([r1.rows[0].xp, r1.rows[0].streak_current, r1.rows[0].streak_longest], [25, 2, 2]);
    const r2 = await db.query<Record<string, unknown>>(`select * from record_lesson_completion('u1-l2', 5)`); // same day, repeat lesson
    assertEquals([r2.rows[0].xp, r2.rows[0].streak_current, r2.rows[0].completed_lessons], [30, 2, ["u1-l1", "u1-l2"]]);
    const da = await db.query(`select xp_earned, lessons_completed from daily_activity where activity_date = current_date`);
    assertEquals(da.rows, [{ xp_earned: 20, lessons_completed: 2 }]);
    assertEquals((await db.query<{ h: number }>(`select spend_heart() h`)).rows[0].h, 4);
    assertEquals((await db.query<{ h: number }>(`select spend_heart() h`)).rows[0].h, 3);
    await assertRejects(() => db.query(`select record_lesson_completion('u1-l3', 1000)`), Error, "xp out of range");
    await assertRejects(() => db.query(`select record_lesson_completion('../etc', 10)`), Error, "invalid lesson id");
    await assertRejects(() => db.query(`select record_lesson_completion('u1-l3', 10, current_date - 30)`), Error, "out of range");
    await assertRejects(() => db.query(`update lesson_progress set xp = 1000000`), Error, "permission denied");
    // Bob can update his display name but not Alice's
    await db.query(`update profiles set display_name = 'Bob'`);
    assertEquals((await db.query(`select display_name from profiles`)).rows, [{ display_name: "Bob" }]);
  });
  const alice = await db.query(`select display_name from profiles where id = $1`, [ALICE]);
  assertEquals(alice.rows, [{ display_name: null }]);
});

Deno.test("companies: public read, run_screen filters/sort/validation", async () => {
  const anon = await asRole(db, "anon", null, () => db.query<{ ticker: string }>(`select ticker from run_screen('[{"metric":"pe","op":"<","value":30}]', '{"metric":"pe","dir":"asc"}')`));
  assertEquals(anon.rows.map((r) => r.ticker), ["MU", "KO"]);
  const q = (f: string, s = "null") => db.query<{ ticker: string }>(`select ticker from run_screen($1::jsonb, $2::jsonb)`, [f, s]).then((r) => r.rows.map((x) => x.ticker));
  assertEquals(await q(`[{"metric":"roic","op":"between","value":[0.3,1]}]`, `{"metric":"roic","dir":"desc"}`), ["AAPL", "COST"]);
  assertEquals(await q(`[{"metric":"revenue","op":">=","value":100000000000},{"metric":"gross_margin","op":">","value":0.4}]`), ["AAPL"]);
  assertEquals(await q(`[{"metric":"pe","op":">","value":0}]`, `{"metric":"pe","dir":"desc"}`), ["COST", "AAPL", "KO", "MU"]); // RIVN null pe excluded
  assertEquals(await q(`[]`), ["AAPL", "COST", "KO", "MU", "RIVN"]);
  await assertRejects(() => q(`[{"metric":"pe; drop table companies","op":"<","value":1}]`), Error, "unknown metric");
  await assertRejects(() => q(`[{"metric":"pe","op":"like","value":1}]`), Error, "unknown op");
  await assertRejects(() => q(`[{"metric":"pe","op":"between","value":5}]`), Error, "between");
  await assertRejects(() => q(`{"metric":"pe"}`), Error, "array");
  await asRole(db, "anon", null, async () => {
    await assertRejects(() => db.query(`delete from companies`), Error, "permission denied");
  });
});

Deno.test("cascade: deleting the auth user removes all their data", async () => {
  const U = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
  await createUser(db, U);
  await db.query(`insert into linked_items (user_id, provider, provider_item_id) values ($1, 'snaptrade', 'auth-c')`, [U]);
  await db.query(`delete from auth.users where id = $1`, [U]);
  const left = await db.query<{ n: number }>(
    `select (select count(*) from linked_items where user_id = $1) + (select count(*) from profiles where id = $1)
          + (select count(*) from lesson_progress where user_id = $1) as n`,
    [U],
  );
  assertEquals(Number(left.rows[0].n), 0);
});

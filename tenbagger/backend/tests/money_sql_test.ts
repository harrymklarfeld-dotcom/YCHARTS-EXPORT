// Money hub SQL: real migrations in PGlite. RLS isolation for the new tables, client write
// rules (manual income streams + snapshot notes only), append-only snapshots, atomic
// replace_item_money() with cursor + retention, and account-deletion cascade.
import { assert, assertEquals, assertRejects } from "jsr:@std/assert@1";
import { asRole, createUser, freshDb } from "./helpers/db.ts";

const ALICE = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const BOB = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

const db = await freshDb();
await createUser(db, ALICE);
await createUser(db, BOB);

const newItem = async (user: string, pid: string) =>
  (await db.query<{ id: string }>(
    `insert into linked_items (user_id, provider, provider_item_id, institution_name, access_token_ciphertext, access_token_key_id, money_hub)
     values ($1, 'plaid', $2, 'Northwind CU (fictional)', 'v1.k1.iv.ct', 'k1', true) returning id`,
    [user, pid],
  )).rows[0].id;
const aliceItem = await newItem(ALICE, "item-money-alice");
const bobItem = await newItem(BOB, "item-money-bob");

const payload = (o: Record<string, unknown> = {}) =>
  JSON.stringify({
    as_of: "2026-09-25",
    cash_accounts: [{
      provider_account_id: "chk",
      name: "Checking",
      mask: "0101",
      subtype: "checking",
      balance_current: 612.44,
      balance_available: 587.44,
      currency: "USD",
    }],
    liabilities: [{
      provider_account_id: "card",
      kind: "credit_card",
      name: "Card",
      balance_current: 734.21,
      credit_limit: 2000,
      last_statement_balance: 689.4,
      minimum_payment_amount: 35,
      next_payment_due_date: "2026-10-12",
      apr_percentage: 24.99,
      details_available: true,
    }],
    transactions: {
      added: [
        {
          provider_transaction_id: "t1",
          provider_account_id: "chk",
          date: "2026-09-18",
          amount: 386.1,
          name: "PAYROLL",
          category: "INCOME",
          pending: false,
        },
        {
          provider_transaction_id: "t2",
          provider_account_id: "chk",
          date: "2023-01-15",
          amount: -12,
          name: "OLD",
          category: null,
          pending: false,
        },
        {
          provider_transaction_id: "t3",
          provider_account_id: "card",
          date: "2026-09-23",
          amount: -89.99,
          name: "BOOKS",
          category: null,
          pending: false,
        },
      ],
      modified: [{
        provider_transaction_id: "t1",
        provider_account_id: "chk",
        date: "2026-09-18",
        amount: 390,
        name: "PAYROLL",
        category: "INCOME",
        pending: false,
      }],
      removed: [],
      next_cursor: "cursor-1",
    },
    income_streams: [{
      provider_stream_id: "st1",
      provider_account_id: "chk",
      description: "PAYROLL",
      frequency: "biweekly",
      average_amount: 412.37,
      last_amount: 386.1,
      last_date: "2026-09-18",
      predicted_next_date: "2026-10-02",
      status: "mature",
    }],
    ...o,
  });
const replace = (user: string, item: string, p: string) =>
  db.query<{ r: Record<string, number> }>(`select replace_item_money($1, $2, $3::jsonb) r`, [user, item, p]);

const counts0 = (await replace(ALICE, aliceItem, payload())).rows[0].r;
await replace(BOB, bobItem, payload());
const snap = async (user: string) =>
  (await db.query<{ id: string }>(
    `insert into money_snapshots (user_id, snapshot, basis) values ($1, '{"takenAt":"2026-09-25T10:00","accounts":[],"liabilities":[],"note":""}', '{"accounts":{}}') returning id`,
    [user],
  ))
    .rows[0].id;
const aliceSnap = await snap(ALICE);
const bobSnap = await snap(BOB);

Deno.test("money sql: replace_item_money upserts, folds modified, skips >24-month rows, stores cursor", async () => {
  assertEquals(counts0, {
    cash_accounts: 1,
    liabilities: 1,
    transactions_upserted: 2,
    transactions_removed: 0,
    transactions_skipped_retention: 1,
    income_streams: 1,
  });
  const tx = await db.query(`select provider_transaction_id id, amount::float8 a from transactions where user_id = $1 order by 1`, [ALICE]);
  assertEquals(tx.rows, [{ id: "t1", a: 390 }, { id: "t3", a: -89.99 }]);
  assertEquals(
    (await db.query(`select transactions_cursor c, money_synced_at is not null s from linked_items where id = $1`, [aliceItem])).rows,
    [{ c: "cursor-1", s: true }],
  );

  // Next delta: remove t3; null sections keep existing rows; missing cash account deleted.
  const r = (await replace(
    ALICE,
    aliceItem,
    payload({
      cash_accounts: [],
      transactions: { added: [], modified: [], removed: ["t3"], next_cursor: "cursor-2" },
      income_streams: null,
    }),
  )).rows[0].r;
  assertEquals([r.transactions_removed, r.cash_accounts], [1, 0]);
  assertEquals((await db.query<{ n: number }>(`select count(*)::int n from cash_accounts where user_id = $1`, [ALICE])).rows[0].n, 0);
  assertEquals((await db.query<{ n: number }>(`select count(*)::int n from income_streams where user_id = $1`, [ALICE])).rows[0].n, 1);
  assertEquals((await db.query(`select transactions_cursor c from linked_items where id = $1`, [aliceItem])).rows, [{ c: "cursor-2" }]);
  await replace(ALICE, aliceItem, payload({ transactions: null })); // restore cash account for later tests

  await assertRejects(() => replace(BOB, aliceItem, payload()), Error, "not found for user");

  // Retention purge (service-only)
  await db.query(
    `insert into transactions (user_id, linked_item_id, provider_transaction_id, provider_account_id, date, amount) values ($1, $2, 'ancient', 'chk', current_date - 800, -1)`,
    [ALICE, aliceItem],
  );
  assertEquals((await db.query<{ n: number }>(`select purge_money_retention() n`)).rows[0].n, 1);
});

Deno.test("money sql: RLS isolates every new table; token cursor not selectable", async () => {
  const count = (t: string) => db.query<{ n: number }>(`select count(*)::int n from ${t}`).then((r) => r.rows[0].n);
  const tables = ["cash_accounts", "liabilities", "transactions", "income_streams", "money_snapshots", "money_snapshot_notes"];
  const bobView = await asRole(
    db,
    "authenticated",
    BOB,
    async () => Object.fromEntries(await Promise.all(tables.map(async (t) => [t, await count(t)]))),
  );
  assertEquals(bobView, {
    cash_accounts: 1,
    liabilities: 1,
    transactions: 2,
    income_streams: 1,
    money_snapshots: 1,
    money_snapshot_notes: 0,
  });
  const bobIds = await asRole(
    db,
    "authenticated",
    BOB,
    () => db.query<{ user_id: string }>(`select distinct user_id from transactions union select user_id from money_snapshots`),
  );
  assertEquals(bobIds.rows.map((r) => r.user_id), [BOB]);
  const stranger = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
  const none = await asRole(
    db,
    "authenticated",
    stranger,
    async () => Object.values(Object.fromEntries(await Promise.all(tables.map(async (t) => [t, await count(t)])))),
  );
  assertEquals(none, [0, 0, 0, 0, 0, 0]);
  for (const t of tables) {
    assertEquals(await asRole(db, "anon", null, () => count(t).then(() => "allowed").catch(() => "denied")), "denied", t);
  }
  await asRole(db, "authenticated", ALICE, async () => {
    assertEquals((await db.query(`select money_hub, money_synced_at is not null s from linked_items`)).rows, [{
      money_hub: true,
      s: true,
    }]);
    await assertRejects(() => db.query(`select transactions_cursor from linked_items`), Error, "permission denied");
    await assertRejects(() => db.query(`select replace_item_money($1, $2, '{}'::jsonb)`, [ALICE, aliceItem]), Error, "permission denied");
    await assertRejects(() => db.query(`select purge_money_retention()`), Error, "permission denied");
  });
});

Deno.test("money sql: clients cannot write provider data; may manage manual income streams", async () => {
  await asRole(db, "authenticated", ALICE, async () => {
    await assertRejects(
      () => db.query(`insert into cash_accounts (user_id, linked_item_id, provider_account_id) values ($1, $2, 'x')`, [ALICE, aliceItem]),
      Error,
      "permission denied",
    );
    await assertRejects(() => db.query(`update liabilities set minimum_payment_amount = 0`), Error, "permission denied");
    await assertRejects(
      () =>
        db.query(
          `insert into transactions (user_id, linked_item_id, provider_transaction_id, provider_account_id, date, amount) values ($1, $2, 'f', 'chk', current_date, 1e6)`,
          [ALICE, aliceItem],
        ),
      Error,
      "permission denied",
    );
    await assertRejects(() => db.query(`delete from transactions`), Error, "permission denied");
    // forged detected stream -> RLS (source must be manual; linked_item_id not even grantable)
    await assertRejects(
      () =>
        db.query(`insert into income_streams (user_id, source, description, frequency) values ($1, 'plaid', 'fake', 'weekly')`, [ALICE]),
      Error,
      "row-level security",
    );
    await assertRejects(
      () =>
        db.query(`insert into income_streams (user_id, source, linked_item_id, description) values ($1, 'manual', $2, 'x')`, [
          ALICE,
          aliceItem,
        ]),
      Error,
      "permission denied",
    );
    // manual stream for someone else -> RLS
    await assertRejects(
      () =>
        db.query(
          `insert into income_streams (user_id, source, description, frequency, pay_type, rate, next_pay_date) values ($1, 'manual', 'x', 'weekly', 'hourly', 15, '2026-10-09')`,
          [BOB],
        ),
      Error,
      "row-level security",
    );
    // valid manual stream
    const id = (await db.query<{ id: string }>(
      `insert into income_streams (user_id, source, description, frequency, pay_type, rate, units_per_week, weekdays, next_pay_date,
                                   withholding_rate, condition, pending_units, pending_period_end)
       values ($1, 'manual', 'Campus library job', 'biweekly', 'hourly', 15.5, 10, '{1,3,5}', '2026-10-09', 0.05, 'hours submitted', 19.5, '2026-10-03')
       returning id`,
      [ALICE],
    )).rows[0].id;
    // CHECKs: manual streams need a regular cadence, withholding < 1, valid weekdays
    await assertRejects(() => db.query(`update income_streams set withholding_rate = 1 where id = $1`, [id]), Error, "check");
    await assertRejects(() => db.query(`update income_streams set weekdays = '{7}' where id = $1`, [id]), Error, "check");
    await assertRejects(() => db.query(`update income_streams set frequency = 'irregular' where id = $1`, [id]), Error, "check");
    assertEquals((await db.query(`update income_streams set rate = 16, status = 'paused' where id = $1`, [id])).affectedRows, 1);
    // detected streams are read-only for clients
    await assertRejects(() => db.query(`update income_streams set average_amount = 9999`), Error, "permission denied");
    assertEquals((await db.query(`update income_streams set description = 'renamed' where source = 'plaid'`)).affectedRows, 0);
    assertEquals((await db.query(`delete from income_streams where source = 'plaid'`)).affectedRows, 0);
    assertEquals((await db.query(`delete from income_streams where id = $1`, [id])).affectedRows, 1);
  });
  await asRole(db, "authenticated", BOB, async () => {
    assertEquals((await db.query(`update income_streams set description = 'mine' where user_id = $1`, [ALICE])).affectedRows, 0);
  });
});

Deno.test("money sql: snapshots are append-only for every role; notes appendable by owner only", async () => {
  // Superuser (postgres, as edge functions connect) and service_role are both blocked.
  await assertRejects(() => db.query(`update money_snapshots set snapshot = '{}' where id = $1`, [aliceSnap]), Error, "append-only");
  await assertRejects(() => db.query(`delete from money_snapshots where id = $1`, [aliceSnap]), Error, "append-only");
  await assertRejects(() => db.query(`truncate money_snapshots cascade`), Error, "append-only");
  await asRole(db, "service_role", null, async () => {
    await assertRejects(() => db.query(`update money_snapshots set basis = '{}' where id = $1`, [aliceSnap]), Error, "append-only");
    await assertRejects(() => db.query(`delete from money_snapshots`), Error, "append-only");
    await db.query(`insert into money_snapshots (user_id, snapshot, basis) values ($1, '{}', '{}')`, [BOB]); // appends are fine
  });
  await asRole(db, "authenticated", ALICE, async () => {
    await assertRejects(
      () => db.query(`insert into money_snapshots (user_id, snapshot, basis) values ($1, '{}', '{}')`, [ALICE]),
      Error,
      "permission denied",
    );
    await assertRejects(() => db.query(`update money_snapshots set snapshot = '{}'`), Error, "permission denied");
    await assertRejects(() => db.query(`delete from money_snapshots`), Error, "permission denied");
    await db.query(`insert into money_snapshot_notes (user_id, snapshot_id, note) values ($1, $2, 'Statement posted; due Oct 12')`, [
      ALICE,
      aliceSnap,
    ]);
    await assertRejects(
      () => db.query(`insert into money_snapshot_notes (user_id, snapshot_id, note) values ($1, $2, 'hi')`, [ALICE, bobSnap]),
      Error,
      "row-level security",
    );
    await assertRejects(() => db.query(`update money_snapshot_notes set note = 'edited'`), Error, "permission denied");
    await assertRejects(
      () => db.query(`insert into money_snapshot_notes (user_id, snapshot_id, note) values ($1, $2, '')`, [ALICE, aliceSnap]),
      Error,
      "check",
    );
  });
  await assertRejects(() => db.query(`update money_snapshot_notes set note = 'x'`), Error, "append-only");
  await assertRejects(() => db.query(`delete from money_snapshot_notes`), Error, "append-only");
  // Unlinking an item never touches snapshots (they are per user, not per item).
  await db.query(`delete from linked_items where id = $1`, [bobItem]);
  assertEquals((await db.query<{ n: number }>(`select count(*)::int n from money_snapshots where user_id = $1`, [BOB])).rows[0].n, 2);
  assertEquals((await db.query<{ n: number }>(`select count(*)::int n from transactions where user_id = $1`, [BOB])).rows[0].n, 0);
});

Deno.test("money sql: account deletion cascades through append-only tables", async () => {
  const C = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
  await createUser(db, C);
  const item = await newItem(C, "item-money-c");
  await replace(C, item, payload());
  const s = await snap(C);
  await db.query(`insert into money_snapshot_notes (user_id, snapshot_id, note) values ($1, $2, 'note')`, [C, s]);
  await db.query(
    `insert into income_streams (user_id, source, description, frequency, pay_type, rate, next_pay_date) values ($1, 'manual', 'Tutoring', 'weekly', 'per_session', 30, '2026-10-01')`,
    [C],
  );
  await db.query(`delete from auth.users where id = $1`, [C]);
  const left = await db.query<{ n: number }>(
    `select ((select count(*) from money_snapshots where user_id = $1) + (select count(*) from money_snapshot_notes where user_id = $1)
           + (select count(*) from transactions where user_id = $1) + (select count(*) from income_streams where user_id = $1)
           + (select count(*) from cash_accounts where user_id = $1) + (select count(*) from liabilities where user_id = $1))::int n`,
    [C],
  );
  assertEquals(left.rows[0].n, 0);
  assert((await db.query<{ n: number }>(`select count(*)::int n from money_snapshots where user_id = $1`, [ALICE])).rows[0].n >= 1);
});

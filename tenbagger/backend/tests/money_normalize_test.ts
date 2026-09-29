// deno-lint-ignore-file no-explicit-any
// Money hub: pure normalizers over fictional Plaid-shaped fixtures, the expected-deposit
// projection, and the Plaid REST client (fake fetch) for the new endpoints.
import { assert, assertEquals, assertFalse, assertRejects } from "jsr:@std/assert@1";
import { type IncomeStreamRow, localParts, nextOccurrence, projectExpectedDeposits } from "../supabase/functions/_shared/money.ts";
import {
  foldTransactionsSync,
  mergeLiabilities,
  normalizePlaidBalances,
  normalizePlaidLiabilities,
  normalizePlaidRecurring,
} from "../supabase/functions/_shared/normalize_plaid_money.ts";
import { PlaidProvider } from "../supabase/functions/_shared/providers/plaid.ts";
import { ProviderError } from "../supabase/functions/_shared/providers/types.ts";

const fx = async (n: string) => JSON.parse(await Deno.readTextFile(new URL(`./fixtures/${n}`, import.meta.url)));
const accountsFx = await fx("plaid_accounts_get.json");
const liabFx = await fx("plaid_liabilities_get.json");
const txPages = await fx("plaid_transactions_sync.json");
const recurringFx = await fx("plaid_transactions_recurring_get.json");

const CHK = "mhChk7Qm2vXbL0pZr1aYtN3kWs9dEe4fGh5jK";
const CARD = "mhCrd3Xz8uZdN2rBt3cAvP5mYu1fGg6hIj7lM";
const LOAN = "mhLon5Rt1tAeO3sCu4dBwQ6nZv2gHh7iJk8mN";

Deno.test("money: balances split cash vs debt; investments left to the holdings sync", () => {
  const b = normalizePlaidBalances(structuredClone(accountsFx));
  assertEquals(b.cash_accounts.map((a) => [a.name, a.subtype, a.balance_current, a.balance_available, a.mask]), [
    ["Everyday Checking", "checking", 612.44, 587.44, "0101"],
    ["Rainy Day Savings", "savings", 1500, 1500, "0202"],
  ]);
  assertEquals(b.debt_accounts.map((d) => [d.provider_account_id, d.kind, d.balance_current, d.credit_limit, d.details_available]), [
    [CARD, "credit_card", 734.21, 2000, false],
    [LOAN, "student_loan", 12450, null, false],
  ]);
  assertEquals(b.warnings.map((w) => w.code), ["investment_account_skipped"]);
});

Deno.test("money: liabilities keep only payment fields (no account numbers, servicer, references)", () => {
  const l = normalizePlaidLiabilities(structuredClone(liabFx));
  assertEquals(l.liabilities.length, 2); // credit entry with null account_id dropped
  const card = l.liabilities.find((x) => x.kind === "credit_card")!;
  assertEquals(
    [
      card.last_statement_balance,
      card.minimum_payment_amount,
      card.next_payment_due_date,
      card.last_payment_amount,
      card.last_payment_date,
      card.last_statement_date,
    ],
    [689.4, 35, "2026-10-12", 150, "2026-09-08", "2026-09-17"],
  );
  assertEquals([card.apr_percentage, card.is_overdue, card.details_available, card.balance_current], [24.99, false, true, 734.21]); // purchase APR, not cash APR
  const loan = l.liabilities.find((x) => x.kind === "student_loan")!;
  assertEquals([loan.name, loan.apr_percentage, loan.next_payment_due_date, loan.minimum_payment_amount], [
    "Direct Unsubsidized",
    5.5,
    null,
    0,
  ]);
  const text = JSON.stringify(l);
  for (const leak of ["FAKE-ACCT", "FAKE-REF", "Servicer", "GUARANTY", "Faketown", "pslf", "origination"]) {
    assertFalse(text.includes(leak), `leaked ${leak}`);
  }

  const merged = mergeLiabilities(normalizePlaidBalances(structuredClone(accountsFx)).debt_accounts, l.liabilities);
  assertEquals(merged.map((m) => [m.kind, m.details_available, m.credit_limit]), [["credit_card", true, 2000], [
    "student_loan",
    true,
    null,
  ]]);
  // Liabilities product unavailable => balance-only rows survive
  assertEquals(
    mergeLiabilities(normalizePlaidBalances(structuredClone(accountsFx)).debt_accounts, null).every((m) => !m.details_available),
    true,
  );
});

Deno.test("money: /transactions/sync pages fold into one minimized delta (sign flipped)", () => {
  const d = foldTransactionsSync(structuredClone(txPages), null);
  assertEquals(d.next_cursor, "cur-fictional-page-2");
  const byId = Object.fromEntries(d.added.map((t) => [t.provider_transaction_id, t]));
  assertEquals(Object.keys(byId).sort(), ["tx_book_0923", "tx_coffee_0920", "tx_old_2023", "tx_pay_0918", "tx_tutor_0922"]);
  assertEquals(byId.tx_pay_0918, {
    provider_transaction_id: "tx_pay_0918",
    provider_account_id: CHK,
    date: "2026-09-18",
    amount: 386.1, // inflow positive
    name: "QUILL UNIV PAYROLL DIR DEP",
    category: "INCOME",
    pending: false,
    currency: "USD",
  });
  assertEquals(byId.tx_tutor_0922.amount, 65); // later "modified" wins
  assertEquals([byId.tx_book_0923.amount, byId.tx_coffee_0920.name, byId.tx_coffee_0920.pending], [-89.99, "Bean There Cafe", false]);
  assertEquals(d.modified, []);
  assertEquals(d.removed, ["tx_coffee_0920_pending"]);
  const text = JSON.stringify(d);
  assertFalse(text.includes("Fictional Ave") || text.includes("lat") || text.includes("payment_channel"));
  // A later page with only a removal
  const d2 = foldTransactionsSync([{
    added: [],
    modified: [],
    removed: [{ transaction_id: "tx_book_0923" }],
    next_cursor: "c3",
    has_more: false,
  }], "cur-fictional-page-2");
  assertEquals([d2.removed, d2.next_cursor], [["tx_book_0923"], "c3"]);
  assertEquals(foldTransactionsSync([], "keep").next_cursor, "keep");
});

Deno.test("money: recurring inflows -> income streams (transfers skipped, irregular payroll kept)", () => {
  const r = normalizePlaidRecurring(structuredClone(recurringFx));
  assertEquals(r.income_streams.map((s) => s.provider_stream_id), [
    "stream_payroll_quill",
    "stream_tutorly",
    "stream_lab_stipend",
    "stream_dashcart_old",
  ]);
  const pay = r.income_streams[0];
  assertEquals(
    [pay.description, pay.frequency, pay.status, pay.average_amount, pay.last_amount, pay.last_date, pay.predicted_next_date, pay.category],
    ["QUILL UNIV PAYROLL DIR DEP", "biweekly", "mature", 412.37, 386.1, "2026-09-18", "2026-10-02", "INCOME_WAGES"],
  );
  assertEquals([r.income_streams[1].description, r.income_streams[1].status], ["Tutorly", "early_detection"]);
  assertEquals(r.income_streams[2].frequency, "unknown");
  assertEquals(r.income_streams[3].status, "tombstoned");
  assertEquals(r.warnings.map((w) => w.code), ["transfer_stream_skipped"]);
  assertFalse(JSON.stringify(r).includes("RENT")); // outflows ignored
  assertFalse(JSON.stringify(r).includes("tx_pay_0904")); // transaction_ids not kept
});

Deno.test("money: expected deposits roll predictions forward by cadence within the horizon", () => {
  const row = (o: Partial<IncomeStreamRow>): IncomeStreamRow => ({
    id: "s",
    source: "plaid",
    description: "x",
    category: null,
    frequency: "biweekly",
    average_amount: 100,
    last_amount: 90,
    last_date: null,
    predicted_next_date: "2026-10-02",
    status: "mature",
    pay_type: null,
    rate: null,
    units_per_week: null,
    weekdays: null,
    next_pay_date: null,
    withholding_rate: null,
    condition: null,
    pending_units: null,
    pending_period_end: null,
    semimonthly_days: null,
    period_lag_days: null,
    weekend_rule: null,
    currency: "USD",
    ...o,
  });
  const out = projectExpectedDeposits(
    [
      row({ id: "pay" }),
      row({ id: "stale", frequency: "weekly", predicted_next_date: "2026-09-10", status: "early_detection" }), // stale: 09-17, 09-24 are past -> starts 10-01
      row({ id: "odd", frequency: "unknown", predicted_next_date: "2026-10-20" }),
      row({ id: "gone", status: "tombstoned" }),
      row({ id: "manual", source: "manual" }),
      row({ id: "cad", currency: "CAD" }),
    ],
    "2026-09-25",
    21,
  );
  assertEquals(out.map((d) => `${d.streamId}@${d.date}:${d.confidence}`), [
    "stale@2026-10-01:low",
    "pay@2026-10-02:high",
    "stale@2026-10-08:low",
    "stale@2026-10-15:low",
    "pay@2026-10-16:high", // horizon end is inclusive
  ]);
  assert(out.every((d) => d.basis === "projected" && d.amount === 100 && d.gross === 100));
  assertEquals([
    nextOccurrence("2026-01-31", "monthly"),
    nextOccurrence("2026-10-01", "semimonthly"),
    nextOccurrence("2026-10-16", "semimonthly"),
  ], [
    "2026-02-28",
    "2026-10-16",
    "2026-11-01",
  ]);
  assertEquals(localParts(new Date("2026-09-26T03:30:00Z"), "America/Chicago"), { date: "2026-09-25", time: "22:30" });
  assertEquals(localParts(new Date("2026-09-26T03:30:00Z"), "Not/AZone").date, "2026-09-26"); // bad tz -> UTC
});

type Seen = { path: string; body: any };
function fakePlaid(routes: Record<string, (body: any, n: number) => { status?: number; json: unknown }>) {
  const seen: Seen[] = [];
  const counts: Record<string, number> = {};
  const f = (input: string | URL | Request, init?: RequestInit) => {
    const path = new URL(String(input)).pathname;
    const body = JSON.parse(String(init?.body ?? "{}"));
    seen.push({ path, body });
    counts[path] = (counts[path] ?? 0) + 1;
    const h = routes[path];
    const r = h ? h(body, counts[path]) : { status: 404, json: { error_code: "NOT_FOUND" } };
    return Promise.resolve(new Response(JSON.stringify(r.json), { status: r.status ?? 200 }));
  };
  return { f, seen };
}
const CRED = { kind: "plaid" as const, accessToken: "access-sandbox-money-SECRET" };

Deno.test("plaid money: link token products (create / update / default unchanged)", async () => {
  const { f, seen } = fakePlaid({
    "/link/token/create": () => ({ json: { link_token: "link-sandbox-m", expiration: "2026-09-25T04:00:00Z" } }),
  });
  const p = new PlaidProvider({ clientId: "cid", secret: "sec", env: "sandbox", fetch: f });
  await p.createLinkSession({ appUserId: "u1", moneyHub: true });
  assertEquals([seen[0].body.products, seen[0].body.optional_products, seen[0].body.transactions], [["transactions"], [
    "liabilities",
    "investments",
  ], { days_requested: 180 }]);
  await p.createLinkSession({ appUserId: "u1", credential: CRED, moneyHub: true });
  assertEquals([seen[1].body.products, seen[1].body.additional_consented_products, seen[1].body.access_token], [undefined, [
    "transactions",
    "liabilities",
  ], CRED.accessToken]);
  await p.createLinkSession({ appUserId: "u1" });
  assertEquals([seen[2].body.products, seen[2].body.optional_products, seen[2].body.transactions], [["investments"], undefined, undefined]);
});

Deno.test("plaid money: balances, liabilities, recurring endpoints + normalizers", async () => {
  const { f, seen } = fakePlaid({
    "/accounts/get": () => ({ json: accountsFx }),
    "/accounts/balance/get": () => ({ json: accountsFx }),
    "/liabilities/get": () => ({ json: liabFx }),
    "/transactions/recurring/get": () => ({ json: recurringFx }),
  });
  const p = new PlaidProvider({ clientId: "cid", secret: "sec", env: "sandbox", fetch: f });
  assertEquals((await p.getBalances(CRED)).cash_accounts.length, 2);
  assertEquals(seen.at(-1)!.path, "/accounts/get"); // cached balances by default (no per-call Balance fee)
  await new PlaidProvider({ clientId: "cid", secret: "sec", env: "sandbox", fetch: f, realtimeBalances: true }).getBalances(CRED);
  assertEquals(seen.at(-1)!.path, "/accounts/balance/get");
  assertEquals((await p.getLiabilities(CRED)).liabilities.length, 2);
  assertEquals((await p.getRecurring(CRED)).income_streams.length, 4);
  assert(seen.every((s) => s.body.access_token === CRED.accessToken && s.body.client_id === "cid"));
});

Deno.test("plaid money: /transactions/sync pages with cursor and restarts on mutation during pagination", async () => {
  let mutated = false;
  const { f, seen } = fakePlaid({
    "/transactions/sync": (b) => {
      if (!b.cursor || b.cursor === "start") return { json: txPages[0] };
      if (b.cursor === "cur-fictional-page-1") {
        if (!mutated) {
          mutated = true;
          return { status: 400, json: { error_type: "TRANSACTIONS_ERROR", error_code: "TRANSACTIONS_SYNC_MUTATION_DURING_PAGINATION" } };
        }
        return { json: txPages[1] };
      }
      return { json: { added: [], modified: [], removed: [], next_cursor: b.cursor, has_more: false } };
    },
  });
  const p = new PlaidProvider({ clientId: "cid", secret: "sec", env: "sandbox", fetch: f });
  const d = await p.syncTransactions(CRED, "start");
  assertEquals(seen.map((s) => s.body.cursor), ["start", "cur-fictional-page-1", "start", "cur-fictional-page-1"]); // restarted from original cursor
  assertEquals([d.added.length, d.removed.length, d.next_cursor], [5, 1, "cur-fictional-page-2"]);
  assertEquals(seen[0].body.count, 500);
  // initial pull omits cursor entirely
  await p.syncTransactions(CRED, null);
  assertEquals("cursor" in seen.at(-2)!.body, false);

  const { f: f2 } = fakePlaid({ "/transactions/sync": () => ({ status: 400, json: { error_code: "ITEM_LOGIN_REQUIRED" } }) });
  const e = await assertRejects(
    () => new PlaidProvider({ clientId: "c", secret: "s", env: "sandbox", fetch: f2 }).syncTransactions(CRED, null),
    ProviderError,
  );
  assertEquals([e.code, e.needsReauth], ["ITEM_LOGIN_REQUIRED", true]);
  assertFalse(e.message.includes("SECRET"));
});

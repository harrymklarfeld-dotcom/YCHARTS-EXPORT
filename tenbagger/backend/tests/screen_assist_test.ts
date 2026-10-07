// screen-assist handler: offline-first path, cache, rate limit, mock mode, and strict validation of a
// mocked Anthropic Messages API response. No network.
import { assert, assertEquals, assertFalse, assertMatch } from "jsr:@std/assert@1";
import {
  ANTHROPIC_URL,
  AssistCache,
  buildAnthropicRequest,
  RateLimiter,
  screenAssist,
  type ScreenAssistDeps,
} from "../supabase/functions/_shared/screen_assist.ts";
import { HttpError } from "../supabase/functions/_shared/http.ts";

type Call = { url: string; init: RequestInit; body: Record<string, unknown> };

function anthropicReply(input: unknown, extra: Record<string, unknown> = {}) {
  return new Response(
    JSON.stringify({
      id: "msg_test",
      type: "message",
      role: "assistant",
      stop_reason: "tool_use",
      content: [{ type: "tool_use", id: "toolu_1", name: "build_screen", input }],
      usage: { input_tokens: 40, output_tokens: 90, cache_read_input_tokens: 5000, cache_creation_input_tokens: 0 },
      ...extra,
    }),
    { status: 200, headers: { "content-type": "application/json" } },
  );
}

function makeDeps(reply: (call: Call) => Response | Promise<Response>, over: Partial<ScreenAssistDeps> = {}) {
  const calls: Call[] = [];
  const logs: string[] = [];
  let clock = Date.UTC(2026, 8, 25, 12, 0, 0);
  const deps: ScreenAssistDeps = {
    authenticate: (req) => {
      const t = req.headers.get("authorization")?.replace("Bearer ", "");
      if (!t) return Promise.reject(new HttpError(401, "unauthorized", "missing bearer token"));
      return Promise.resolve({ userId: t });
    },
    fetch: (async (url: string | URL | Request, init?: RequestInit) => {
      const call = { url: String(url), init: init ?? {}, body: JSON.parse(String(init?.body ?? "{}")) };
      calls.push(call);
      return await reply(call);
    }) as typeof fetch,
    apiKey: "sk-ant-test",
    model: "claude-haiku-4-5",
    maxTokens: 600,
    timeoutMs: 1000,
    allowedOrigins: ["http://localhost:8081"],
    cache: new AssistCache(),
    limiter: new RateLimiter({ perMinute: 2, perDay: 3 }),
    now: () => clock,
    log: (_l, msg, f) => logs.push(JSON.stringify({ msg, ...f })),
    ...over,
  };
  return { deps, calls, logs, tick: (ms: number) => (clock += ms) };
}

const post = (body: unknown, user: string | null = "user-a") =>
  new Request("http://localhost/screen-assist", {
    method: "POST",
    headers: { ...(user ? { authorization: `Bearer ${user}` } : {}), "content-type": "application/json", origin: "http://localhost:8081" },
    body: JSON.stringify(body),
  });

const GOOD = {
  filters: [
    { metric: "gross_margin", op: ">", value: 0.7, high: null },
    { metric: "revenue_cagr_3y", op: "between", value: 0.1, high: 0.3 },
  ],
  restatement: "Companies with gross margin above 70% and 3-year revenue CAGR between 10% and 30%.",
  assumptions: ["software-like margins → gross margin above 70%"],
  unsupported: [],
};

Deno.test("exact queries and fully-understood fuzzy words never call the model", async () => {
  const { deps, calls } = makeDeps(() => anthropicReply(GOOD));
  const a = await (await screenAssist(post({ text: "pe < 20 and roic > 15%" }), deps)).json();
  assertEquals(a.source, "parser");
  assertEquals(a.filters, [{ metric: "pe", op: "<", value: 20 }, { metric: "roic", op: ">", value: 0.15 }]);
  const b = await (await screenAssist(post({ text: "cheap profitable companies" }), deps)).json();
  assertEquals(b.source, "synonyms");
  assertMatch(b.notes[0], /“cheap” was read as P\/E below 15x and P\/B below 2x/);
  assertEquals(b.disclaimer, "AI only builds the filters; results come from company filings.");
  assertEquals(calls.length, 0);
});

Deno.test("fuzzy text calls Anthropic with a cached system prompt and forced tool; output is validated", async () => {
  const { deps, calls, logs } = makeDeps(() => anthropicReply(GOOD));
  const res = await screenAssist(post({ text: "software-like margins, growing steadily for years" }), deps);
  assertEquals(res.status, 200);
  assertEquals(res.headers.get("access-control-allow-origin"), "http://localhost:8081");
  const out = await res.json();
  assertEquals(out.source, "model");
  assertEquals(out.filters, [
    { metric: "gross_margin", op: ">", value: 0.7 },
    { metric: "revenue_cagr_3y", op: "between", value: [0.1, 0.3] },
  ]);
  assertEquals(out.restatement, GOOD.restatement);
  assertEquals(out.notes, GOOD.assumptions);

  assertEquals(calls.length, 1);
  const c = calls[0];
  assertEquals(c.url, ANTHROPIC_URL);
  const h = new Headers(c.init.headers);
  assertEquals(h.get("x-api-key"), "sk-ant-test");
  assertEquals(h.get("anthropic-version"), "2023-06-01");
  assertEquals(c.body.model, "claude-haiku-4-5");
  assertEquals(c.body.max_tokens, 600);
  assertEquals(c.body.tool_choice, { type: "tool", name: "build_screen" });
  const system = c.body.system as Array<{ text: string; cache_control?: unknown }>;
  assertEquals(system[0].cache_control, { type: "ephemeral" });
  assert(system[0].text.includes("- roic |"));
  const messages = c.body.messages as Array<{ content: string }>;
  assertEquals(messages.length, 1);
  assertEquals(messages[0].content, "<request>software-like margins, growing steadily for years</request>");
  // Token usage is logged, the request text is not.
  assert(logs.some((l) => l.includes("cache_read_input_tokens")));
  assertFalse(logs.some((l) => l.includes("software-like")));
});

Deno.test("identical prompts are served from cache (one model call)", async () => {
  const { deps, calls } = makeDeps(() => anthropicReply(GOOD));
  await screenAssist(post({ text: "Software-like margins, growing steadily" }), deps);
  const again = await (await screenAssist(post({ text: "  software-like   margins, growing steadily " }, "user-b"), deps)).json();
  assertEquals(again.source, "cache");
  assertEquals(calls.length, 1);
});

Deno.test("unknown metrics, advice words and company numbers from the model are rejected", async () => {
  const { deps } = makeDeps(() =>
    anthropicReply({
      filters: [
        { metric: "analyst_rating", op: ">", value: 4, high: null },
        { metric: "pe", op: "<", value: 15, high: null },
      ],
      restatement: "Attractive stocks to buy: Acme trades at 9.1x.",
      assumptions: ["these are undervalued", "cheap → P/E below 15x"],
      unsupported: [],
    })
  );
  const out = await (await screenAssist(post({ text: "stocks wall street loves" }), deps)).json();
  assertEquals(out.filters, [{ metric: "pe", op: "<", value: 15 }]);
  assertEquals(out.restatement, "Companies with P/E below 15x.");
  assertEquals(out.notes, ["cheap → P/E below 15x", "Ignored 1 filter the screener does not support."]);
  assertFalse(JSON.stringify(out).includes("Acme"));
});

Deno.test("model outage or truncated output degrades to the offline reading", async () => {
  for (const reply of [
    () => new Response("overloaded", { status: 529 }),
    () => anthropicReply(GOOD, { stop_reason: "max_tokens" }),
    () => anthropicReply(GOOD, { content: [{ type: "text", text: "hi" }] }),
    () => Promise.reject(new TypeError("network down")),
  ]) {
    const { deps } = makeDeps(reply);
    const res = await screenAssist(post({ text: "cheap and loved by founders" }), deps);
    assertEquals(res.status, 200);
    const out = await res.json();
    assertEquals(out.degraded, true);
    assertEquals(out.filters, [{ metric: "pe", op: "<", value: 15 }, { metric: "pb", op: "<", value: 2 }]);
  }
});

Deno.test("mock mode (no ANTHROPIC_API_KEY) never touches the network", async () => {
  const { deps, calls } = makeDeps(() => anthropicReply(GOOD), { apiKey: undefined });
  const out = await (await screenAssist(post({ text: "cheap companies run by founders" }), deps)).json();
  assertEquals(out.degraded, true);
  assertEquals(out.source, "synonyms");
  assert(out.unrecognized.length > 0);
  assertEquals(calls.length, 0);
});

Deno.test("per-user rate limit applies to model calls only", async () => {
  const { deps, calls, tick } = makeDeps(() => anthropicReply(GOOD));
  const ask = (t: string, u = "user-a") => screenAssist(post({ text: t }, u), deps);
  assertEquals((await ask("wide moat one")).status, 200);
  assertEquals((await ask("wide moat two")).status, 200);
  const limited = await ask("wide moat three");
  assertEquals(limited.status, 429);
  assert(Number(limited.headers.get("retry-after")) > 0);
  assertEquals((await ask("pe < 10")).status, 200); // parser path is free
  assertEquals((await ask("wide moat one")).status, 200); // cache hit is free
  assertEquals((await ask("wide moat three", "user-b")).status, 200); // other user unaffected
  tick(61_000);
  assertEquals((await ask("wide moat four")).status, 200);
  assertEquals((await ask("wide moat five")).status, 429); // daily cap (3)
  assertEquals(calls.length, 4);
});

Deno.test("auth, method and body validation", async () => {
  const { deps } = makeDeps(() => anthropicReply(GOOD));
  assertEquals((await screenAssist(post({ text: "cheap" }, null), deps)).status, 401);
  assertEquals((await screenAssist(post({ text: "" }), deps)).status, 400);
  assertEquals((await screenAssist(post({ text: "x".repeat(301) }), deps)).status, 400);
  assertEquals((await screenAssist(post({ text: "cheap", user_id: "x" }), deps)).status, 400);
  assertEquals((await screenAssist(post({ text: 42 }), deps)).status, 400);
  const get = await screenAssist(new Request("http://localhost/screen-assist"), deps);
  assertEquals(get.status, 405);
  await get.body?.cancel();
  const pre = await screenAssist(new Request("http://localhost/screen-assist", { method: "OPTIONS", headers: { origin: "http://localhost:8081" } }), deps);
  assertEquals(pre.status, 204);
});

Deno.test("request body contains no company data and strips markup from the request", () => {
  const body = buildAnthropicRequest("<script>cheap</script>", "claude-haiku-4-5", 600);
  assertEquals((body.messages[0] as { content: string }).content, "<request>scriptcheap/script</request>");
  const s = JSON.stringify(body);
  for (const word of ["price_is_sample", "\"ticker\"", "Micron", "Costco"]) assertFalse(s.includes(word), word);
});

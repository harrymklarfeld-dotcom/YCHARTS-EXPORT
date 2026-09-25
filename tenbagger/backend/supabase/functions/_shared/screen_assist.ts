// "Ask the screener" backend: natural language → screener filters.
//
// Cost design (cheapest path first; the model is the LAST resort):
//   1. Offline reader (`mockAssist`): the exact query parser + house synonyms. If it explains
//      every word, we answer without calling any model (free, ~0 ms).
//   2. Response cache keyed by the normalized text (identical prompts never pay twice).
//   3. Per-user rate limit (only model calls count).
//   4. Anthropic Messages API, `claude-haiku-4-5`, temperature 0, max_tokens 600, forced
//      `build_screen` tool with a strict JSON schema. The system prompt (catalog keys, units,
//      ops, conventions, examples; NO company data) is byte-stable and marked
//      `cache_control: ephemeral`, so after the first call the ~5K-token prefix is billed at
//      the cache-read rate. The user message is only the request text (≤ 300 chars).
//
// Safety: the model never sees company data, and its output is re-validated here with the
// screener package (`validateAssistOutput` → `validateFilter`): unknown metrics are rejected,
// numbers must be finite, the restatement is replaced if it uses advice words or mentions any
// number that is not a filter threshold. Results always come from filings, on the device.
//
// No SDK: plain `fetch` (injectable) like the Plaid/SnapTrade providers, so tests run offline.
import {
  ASSIST_DISCLAIMER,
  ASSIST_LIMITS,
  ASSIST_TOOL,
  ASSIST_TOOL_NAME,
  type AssistResult,
  buildAssistSystemPrompt,
  mockAssist,
  needsModel,
  normalizeAssistText,
  validateAssistOutput,
} from "../../../../packages/screener/src/index.ts";
import { corsHeaders, HttpError, json, readJsonObject } from "./http.ts";
import { onlyKeys } from "./validate.ts";

export const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
export const ANTHROPIC_VERSION = "2023-06-01";
export const DEFAULT_ASSIST_MODEL = "claude-haiku-4-5";

export interface AssistResponse extends AssistResult {
  disclaimer: string;
  /** true when the AI helper was unavailable and the offline reading was used instead. */
  degraded?: boolean;
}

// ------------------------------------------------------------------ cache

/** Tiny LRU with TTL. Per isolate (edge isolates are recycled; see README for a durable option). */
export class AssistCache {
  #m = new Map<string, { at: number; value: AssistResult }>();
  constructor(readonly maxEntries = 500, readonly ttlMs = 24 * 3600_000) {}
  get(key: string, now: number): AssistResult | undefined {
    const hit = this.#m.get(key);
    if (!hit) return undefined;
    if (now - hit.at > this.ttlMs) {
      this.#m.delete(key);
      return undefined;
    }
    this.#m.delete(key); // refresh LRU order
    this.#m.set(key, hit);
    return hit.value;
  }
  set(key: string, value: AssistResult, now: number): void {
    this.#m.delete(key);
    this.#m.set(key, { at: now, value });
    while (this.#m.size > this.maxEntries) this.#m.delete(this.#m.keys().next().value!);
  }
  get size() {
    return this.#m.size;
  }
}

// ------------------------------------------------------------------ rate limit

export interface RateLimitConfig {
  perMinute: number;
  perDay: number;
}

/** Fixed-window counters per user (minute + UTC day). Only model calls are counted. */
export class RateLimiter {
  #m = new Map<string, { minute: number; minuteCount: number; day: number; dayCount: number }>();
  constructor(readonly cfg: RateLimitConfig) {}
  /** Returns seconds to wait, or 0 when allowed (and records the call). */
  take(userId: string, nowMs: number): number {
    const minute = Math.floor(nowMs / 60_000);
    const day = Math.floor(nowMs / 86_400_000);
    const s = this.#m.get(userId) ?? { minute, minuteCount: 0, day, dayCount: 0 };
    if (s.minute !== minute) Object.assign(s, { minute, minuteCount: 0 });
    if (s.day !== day) Object.assign(s, { day, dayCount: 0 });
    if (s.dayCount >= this.cfg.perDay) return Math.ceil(((day + 1) * 86_400_000 - nowMs) / 1000);
    if (s.minuteCount >= this.cfg.perMinute) return Math.ceil(((minute + 1) * 60_000 - nowMs) / 1000);
    s.minuteCount++;
    s.dayCount++;
    this.#m.set(userId, s);
    return 0;
  }
}

// ------------------------------------------------------------------ deps

export interface ScreenAssistDeps {
  authenticate(req: Request): Promise<{ userId: string }>;
  fetch: typeof fetch;
  /** Unset → mock mode (offline reader only; no network). */
  apiKey?: string;
  model: string;
  maxTokens: number;
  timeoutMs: number;
  allowedOrigins: string[];
  cache: AssistCache;
  limiter: RateLimiter;
  now(): number;
  log?(level: "info" | "warn" | "error", msg: string, fields?: Record<string, unknown>): void;
}

/** Build production deps from env. `authenticate` comes from the caller (Supabase client). */
export function screenAssistDepsFromEnv(
  env: (k: string) => string | undefined,
  authenticate: ScreenAssistDeps["authenticate"],
): ScreenAssistDeps {
  const num = (k: string, d: number) => {
    const n = Number(env(k));
    return Number.isFinite(n) && n > 0 ? n : d;
  };
  return {
    authenticate,
    fetch: (...a) => fetch(...a),
    apiKey: env("ANTHROPIC_API_KEY") || undefined,
    model: env("SCREEN_ASSIST_MODEL") || DEFAULT_ASSIST_MODEL,
    maxTokens: num("SCREEN_ASSIST_MAX_TOKENS", 600),
    timeoutMs: num("SCREEN_ASSIST_TIMEOUT_MS", 12_000),
    allowedOrigins: (env("ALLOWED_ORIGINS") ?? "").split(",").map((s) => s.trim()).filter(Boolean),
    cache: new AssistCache(num("SCREEN_ASSIST_CACHE_ENTRIES", 500)),
    limiter: new RateLimiter({ perMinute: num("SCREEN_ASSIST_PER_MINUTE", 6), perDay: num("SCREEN_ASSIST_PER_DAY", 60) }),
    now: () => Date.now(),
    log: (level, msg, fields) => console[level === "info" ? "log" : level](JSON.stringify({ level, msg, ...fields })),
  };
}

// ------------------------------------------------------------------ model call

// Built once per isolate; byte-identical on every request so the prompt cache hits.
const SYSTEM_PROMPT = buildAssistSystemPrompt();

/** The exact Messages API body. Exported for tests (cache_control, tool_choice, no company data). */
export function buildAnthropicRequest(text: string, model: string, maxTokens: number) {
  return {
    model,
    max_tokens: maxTokens,
    temperature: 0,
    // tools render before system, so this one breakpoint caches tools + system together.
    system: [{ type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } }],
    tools: [ASSIST_TOOL],
    tool_choice: { type: "tool", name: ASSIST_TOOL_NAME },
    messages: [{ role: "user", content: `<request>${text.replace(/[<>]/g, "")}</request>` }],
  };
}

class ModelUnavailable extends Error {}

async function callModel(text: string, deps: ScreenAssistDeps): Promise<unknown> {
  let res: Response;
  try {
    res = await deps.fetch(ANTHROPIC_URL, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": deps.apiKey!,
        "anthropic-version": ANTHROPIC_VERSION,
      },
      body: JSON.stringify(buildAnthropicRequest(text, deps.model, deps.maxTokens)),
      signal: AbortSignal.timeout(deps.timeoutMs),
    });
  } catch (e) {
    throw new ModelUnavailable(`network: ${(e as Error).name}`);
  }
  if (!res.ok) {
    await res.body?.cancel();
    throw new ModelUnavailable(`status ${res.status}`);
  }
  const body = await res.json() as {
    stop_reason?: string;
    content?: Array<{ type: string; name?: string; input?: unknown }>;
    usage?: Record<string, number>;
  };
  // Token accounting only; never log the request text.
  deps.log?.("info", "screen_assist_usage", { model: deps.model, stop_reason: body.stop_reason, ...body.usage });
  if (body.stop_reason === "max_tokens" || body.stop_reason === "refusal") throw new ModelUnavailable(`stop ${body.stop_reason}`);
  const block = body.content?.find((b) => b.type === "tool_use" && b.name === ASSIST_TOOL_NAME);
  if (!block) throw new ModelUnavailable("no tool_use block");
  return block.input;
}

// ------------------------------------------------------------------ handler

function withDisclaimer(r: AssistResult, extra: Partial<AssistResponse> = {}): AssistResponse {
  return { ...r, disclaimer: ASSIST_DISCLAIMER, ...extra };
}

/**
 * POST { text } → AssistResponse.
 * 400 bad body · 401 no session · 429 rate limited (Retry-After) · 200 otherwise
 * (a model outage degrades to the offline reading instead of failing).
 */
export async function screenAssist(req: Request, deps: ScreenAssistDeps): Promise<Response> {
  const cors = corsHeaders(req, deps.allowedOrigins);
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
  if (req.method !== "POST") return json(405, { error: "method_not_allowed" }, cors);
  try {
    const { userId } = await deps.authenticate(req);
    const body = await readJsonObject(req, 4 * 1024);
    onlyKeys(body, ["text"]);
    if (typeof body.text !== "string") throw new HttpError(400, "invalid_request", "text must be a string");
    const text = body.text.replace(/\s+/g, " ").trim();
    if (!text) throw new HttpError(400, "invalid_request", "text is empty");
    if (text.length > ASSIST_LIMITS.maxTextLength) {
      throw new HttpError(400, "invalid_request", `text is longer than ${ASSIST_LIMITS.maxTextLength} characters`);
    }

    // 1. Offline reader. Free; good enough whenever it explains every word.
    const offline = mockAssist(text);
    if (!needsModel(offline)) return json(200, withDisclaimer(offline), cors);

    // 2. Cache.
    const key = normalizeAssistText(text);
    const now = deps.now();
    const cached = deps.cache.get(key, now);
    if (cached) return json(200, withDisclaimer({ ...cached, source: "cache" }), cors);

    // 3. Mock mode (no key): the offline reading, honestly labelled.
    if (!deps.apiKey) {
      return json(200, withDisclaimer(offline, { degraded: true }), cors);
    }

    // 4. Rate limit (model calls only).
    const wait = deps.limiter.take(userId, now);
    if (wait > 0) {
      return json(429, { error: "rate_limited", message: "Too many requests to the AI helper. Try again soon.", retry_after: wait }, {
        ...cors,
        "retry-after": String(wait),
      });
    }

    // 5. Model, then strict validation with the screener package.
    let input: unknown;
    try {
      input = await callModel(text, deps);
    } catch (e) {
      if (!(e instanceof ModelUnavailable)) throw e;
      deps.log?.("warn", "screen_assist_model_unavailable", { reason: e.message });
      return json(200, withDisclaimer(offline, { degraded: true }), cors);
    }
    const v = validateAssistOutput(input);
    if (v.errors.length) deps.log?.("warn", "screen_assist_output_rejected", { errors: v.errors.length });
    const notes = [...v.assumptions];
    const dropped = v.errors.filter((e) => e.startsWith("Filter ")).length;
    if (dropped) notes.push(`Ignored ${dropped} filter${dropped === 1 ? "" : "s"} the screener does not support.`);
    const result: AssistResult = {
      filters: v.filters,
      restatement: v.restatement,
      notes,
      unrecognized: v.unsupported,
      interpreted: [],
      source: "model",
    };
    deps.cache.set(key, result, now);
    return json(200, withDisclaimer(result), cors);
  } catch (e) {
    if (e instanceof HttpError) return json(e.status, { error: e.code, message: e.message }, cors);
    deps.log?.("error", "screen_assist_unhandled", { err: (e as Error).name });
    return json(500, { error: "internal_error" }, cors);
  }
}

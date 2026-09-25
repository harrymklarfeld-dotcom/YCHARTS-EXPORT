// All edge-function request logic lives here, dependency-injected so tests can run it
// with a MockProvider + PGlite. Each supabase/functions/<name>/index.ts is a 3-line shim.
//
// Invariants enforced here:
//   * Access tokens / user secrets are decrypted only in memory and NEVER appear in a
//     response body, log line, audit detail, or error message.
//   * Linking brokerage accounts requires an MFA session (aal2) unless explicitly disabled.
//   * Request bodies are allow-listed (unknown keys rejected) and size-capped.
import { aad, type TokenCipher } from "./crypto.ts";
import { corsHeaders, HttpError, json, readBody, readJsonObject } from "./http.ts";
import { computePortfolioSummary } from "./portfolio.ts";
import type { AggregatorProvider, ProviderCredential } from "./providers/types.ts";
import { ProviderError } from "./providers/types.ts";
import { type LinkedItemRow, type Repo, toPublicItem } from "./repo.ts";
import { onlyKeys, optBool, optString, PLAID_PUBLIC_TOKEN_RE, reqString, SLUG_RE, UUID_RE } from "./validate.ts";
import { classifyPlaidWebhook, type PlaidWebhookBody } from "./webhook.ts";

export interface AuthContext {
  userId: string;
  /** Supabase Auth assurance level: "aal1" password/OTP, "aal2" MFA verified. */
  aal: "aal1" | "aal2";
}

export interface Deps {
  repo: Repo;
  cipher: TokenCipher;
  authenticate(req: Request): Promise<AuthContext>;
  plaid: AggregatorProvider;
  snaptrade: AggregatorProvider;
  verifyPlaidWebhook(rawBody: string, headers: Headers): Promise<{ ok: boolean; reason?: string }>;
  config: {
    requireMfaForLinking: boolean;
    allowedOrigins: string[];
    plaidWebhookUrl?: string;
    plaidRedirectUri?: string;
    snaptradeRedirectUri?: string;
    minSyncIntervalSec: number;
  };
  now(): Date;
  log?(level: "info" | "warn" | "error", msg: string, fields?: Record<string, unknown>): void;
}

type Handler = (req: Request, deps: Deps) => Promise<Response>;

/** Wrap a handler with CORS, method check and error mapping (no internal details leak). */
export function route(methods: string[], h: Handler): Handler {
  return async (req, deps) => {
    const cors = corsHeaders(req, deps.config.allowedOrigins);
    if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
    if (!methods.includes(req.method)) return json(405, { error: "method_not_allowed" }, cors);
    try {
      const res = await h(req, deps);
      for (const [k, v] of Object.entries(cors)) res.headers.set(k, v);
      return res;
    } catch (e) {
      if (e instanceof HttpError) return json(e.status, { error: e.code, message: e.message }, cors);
      if (e instanceof ProviderError) {
        deps.log?.("warn", "provider_error", { provider: e.provider, code: e.code, status: e.httpStatus });
        return json(e.needsReauth ? 409 : 502, { error: e.needsReauth ? "needs_reauth" : "provider_error", provider: e.provider, code: e.code }, cors);
      }
      deps.log?.("error", "unhandled", { err: (e as Error).name, msg: (e as Error).message });
      return json(500, { error: "internal_error" }, cors);
    }
  };
}

function requireMfa(ctx: AuthContext, deps: Deps) {
  if (deps.config.requireMfaForLinking && ctx.aal !== "aal2") {
    throw new HttpError(403, "mfa_required", "Enable and verify multi-factor authentication before linking a brokerage account");
  }
}

const today = (d: Date) => d.toISOString().slice(0, 10);

async function credentialFor(deps: Deps, item: LinkedItemRow): Promise<ProviderCredential> {
  if (item.provider === "plaid") {
    if (!item.access_token_ciphertext) throw new HttpError(409, "needs_reauth", "item has no credential");
    return { kind: "plaid", accessToken: await deps.cipher.decrypt(item.access_token_ciphertext, aad.plaidItem(item.user_id, item.provider_item_id)) };
  }
  return snaptradeCredential(deps, item.user_id);
}

async function snaptradeCredential(deps: Deps, userId: string): Promise<ProviderCredential> {
  const u = await deps.repo.getAggregatorUser(userId, "snaptrade");
  if (!u?.secret_ciphertext) throw new HttpError(409, "not_registered", "SnapTrade user not registered");
  return { kind: "snaptrade", userId: u.provider_user_id, userSecret: await deps.cipher.decrypt(u.secret_ciphertext, aad.snaptradeUser(userId, u.provider_user_id)) };
}

function providerFor(deps: Deps, item: LinkedItemRow): AggregatorProvider {
  return item.provider === "plaid" ? deps.plaid : deps.snaptrade;
}

export interface SyncOutcome {
  item_id: string;
  status: "succeeded" | "failed" | "skipped";
  holdings_count?: number;
  warnings?: Array<{ code: string; message: string }>;
  error_code?: string;
  item_status?: string;
}

/** Fetch -> normalize -> atomic replace, recording a sync_runs row. Never throws for provider errors. */
export async function syncItem(deps: Deps, item: LinkedItemRow, trigger: "user" | "webhook" | "link" | "schedule", force = false): Promise<SyncOutcome> {
  if (item.status === "revoked" || item.status === "needs_reauth") {
    return { item_id: item.id, status: "skipped", item_status: item.status, error_code: item.status };
  }
  if (!force && item.last_synced_at) {
    const age = (deps.now().getTime() - new Date(item.last_synced_at).getTime()) / 1000;
    if (age < deps.config.minSyncIntervalSec) return { item_id: item.id, status: "skipped", error_code: "throttled", item_status: item.status };
  }
  const runId = await deps.repo.startSyncRun(item.user_id, item.id, item.provider, trigger);
  try {
    const cred = await credentialFor(deps, item);
    const snap = await providerFor(deps, item).fetchHoldings(cred, {
      providerItemId: item.provider_item_id,
      institutionName: item.institution_name,
      asOf: today(deps.now()),
    });
    const res = await deps.repo.replaceItemHoldings(item.user_id, item.id, snap);
    const partial = snap.warnings.some((w) => w.code === "account_fetch_failed");
    await deps.repo.finishSyncRun(runId, { status: partial ? "partial" : "succeeded", holdingsCount: res.holdings, warnings: snap.warnings });
    return {
      item_id: item.id,
      status: "succeeded",
      holdings_count: res.holdings,
      warnings: snap.warnings.map((w) => ({ code: w.code, message: w.message })),
      item_status: "active",
    };
  } catch (e) {
    const code = e instanceof ProviderError ? e.code : e instanceof HttpError ? e.code : "internal_error";
    const msg = e instanceof ProviderError || e instanceof HttpError ? e.message : "sync failed";
    let itemStatus: "needs_reauth" | "error" = "error";
    if (e instanceof ProviderError && e.needsReauth) itemStatus = "needs_reauth";
    if (!(e instanceof ProviderError && e.retryable)) await deps.repo.setItemStatus(item.id, itemStatus, code);
    await deps.repo.finishSyncRun(runId, { status: "failed", errorCode: code, errorMessage: msg });
    deps.log?.("warn", "sync_failed", { item: item.id, code });
    return { item_id: item.id, status: "failed", error_code: code, item_status: e instanceof ProviderError && e.retryable ? item.status : itemStatus };
  }
}

// ---------------------------------------------------------------------------
// plaid-link-token  POST {item_id?}  -> {link_token, expiration}
// ---------------------------------------------------------------------------
export const plaidLinkToken = route(["POST"], async (req, deps) => {
  const ctx = await deps.authenticate(req);
  requireMfa(ctx, deps);
  const body = await readJsonObject(req);
  onlyKeys(body, ["item_id"]);
  const itemId = optString(body, "item_id", UUID_RE);
  let credential: ProviderCredential | undefined;
  if (itemId) {
    const item = await deps.repo.getLinkedItem(ctx.userId, itemId);
    if (!item || item.provider !== "plaid") throw new HttpError(404, "not_found", "item not found");
    credential = await credentialFor(deps, item); // update mode (re-auth)
  }
  const s = await deps.plaid.createLinkSession({
    appUserId: ctx.userId,
    credential,
    webhookUrl: deps.config.plaidWebhookUrl,
    redirectUri: deps.config.plaidRedirectUri,
  });
  return json(200, { link_token: s.linkToken, expiration: s.expiration, mode: credential ? "update" : "create" });
});

// ---------------------------------------------------------------------------
// plaid-exchange  POST {public_token}  -> {item, sync}
// ---------------------------------------------------------------------------
export const plaidExchange = route(["POST"], async (req, deps) => {
  const ctx = await deps.authenticate(req);
  requireMfa(ctx, deps);
  const body = await readJsonObject(req);
  onlyKeys(body, ["public_token"]);
  const publicToken = reqString(body, "public_token", PLAID_PUBLIC_TOKEN_RE);
  if (!deps.plaid.exchangePublicToken) throw new HttpError(500, "misconfigured", "provider cannot exchange tokens");

  const ex = await deps.plaid.exchangePublicToken(publicToken);
  const { ciphertext, keyId } = await deps.cipher.encrypt(ex.accessToken, aad.plaidItem(ctx.userId, ex.providerItemId));
  const item = await deps.repo.upsertLinkedItem({
    userId: ctx.userId,
    provider: "plaid",
    providerItemId: ex.providerItemId,
    institutionId: ex.institution.id,
    institutionName: ex.institution.name,
    tokenCiphertext: ciphertext,
    tokenKeyId: keyId,
    status: "active",
  });
  await deps.repo.audit(ctx.userId, "plaid.item_linked", { item_id: item.id, institution: ex.institution.name });
  const sync = await syncItem(deps, item, "link", true);
  const fresh = (await deps.repo.getLinkedItem(ctx.userId, item.id))!;
  return json(200, { item: toPublicItem(fresh), sync });
});

// ---------------------------------------------------------------------------
// plaid-sync-holdings  POST {item_id?, force?}  -> {results}
// ---------------------------------------------------------------------------
export const plaidSyncHoldings = route(["POST"], async (req, deps) => {
  const ctx = await deps.authenticate(req);
  const body = await readJsonObject(req);
  onlyKeys(body, ["item_id", "force"]);
  const itemId = optString(body, "item_id", UUID_RE);
  const force = optBool(body, "force") ?? false;
  let items: LinkedItemRow[];
  if (itemId) {
    const it = await deps.repo.getLinkedItem(ctx.userId, itemId);
    if (!it || it.provider !== "plaid") throw new HttpError(404, "not_found", "item not found");
    items = [it];
  } else {
    items = await deps.repo.listLinkedItems(ctx.userId, "plaid");
  }
  const results: SyncOutcome[] = [];
  for (const it of items) results.push(await syncItem(deps, it, "user", force));
  return json(200, { results });
});

// ---------------------------------------------------------------------------
// plaid-webhook  POST (from Plaid; no user JWT; signature verified)
// ---------------------------------------------------------------------------
export const plaidWebhook = route(["POST"], async (req, deps) => {
  const raw = await readBody(req, 64 * 1024);
  const v = await deps.verifyPlaidWebhook(raw, req.headers);
  if (!v.ok) {
    deps.log?.("warn", "webhook_rejected", { reason: v.reason });
    return json(401, { error: "invalid_signature" });
  }
  let body: PlaidWebhookBody;
  try {
    body = JSON.parse(raw);
  } catch {
    return json(400, { error: "invalid_request" });
  }
  const action = classifyPlaidWebhook(body);
  const item = typeof body.item_id === "string" ? await deps.repo.getLinkedItemByProviderId("plaid", body.item_id) : null;
  // Always 200 for verified webhooks (even unknown items) so Plaid does not retry forever.
  if (!item || action.kind === "ignore") return json(200, { received: true });
  await deps.repo.audit(item.user_id, "plaid.webhook", { item_id: item.id, type: body.webhook_type, code: body.webhook_code });
  if (action.kind === "status") {
    await deps.repo.setItemStatus(item.id, action.status, action.status === "active" ? null : action.reason);
    return json(200, { received: true, item_status: action.status });
  }
  const r = await syncItem(deps, item, "webhook", true);
  return json(200, { received: true, sync: r.status });
});

// ---------------------------------------------------------------------------
// snaptrade-register  POST {broker?}  -> {redirect_url}
// ---------------------------------------------------------------------------
export const snaptradeRegister = route(["POST"], async (req, deps) => {
  const ctx = await deps.authenticate(req);
  requireMfa(ctx, deps);
  const body = await readJsonObject(req);
  onlyKeys(body, ["broker"]);
  const broker = optString(body, "broker", SLUG_RE);
  const st = deps.snaptrade;
  if (!st.registerUser) throw new HttpError(500, "misconfigured", "provider cannot register users");

  let existing = await deps.repo.getAggregatorUser(ctx.userId, "snaptrade");
  if (!existing) {
    // Opaque random id: SnapTrade never learns our internal user UUID or email.
    const reg = await st.registerUser(crypto.randomUUID());
    const { ciphertext, keyId } = await deps.cipher.encrypt(reg.secret, aad.snaptradeUser(ctx.userId, reg.providerUserId));
    existing = { user_id: ctx.userId, provider: "snaptrade", provider_user_id: reg.providerUserId, secret_ciphertext: ciphertext, secret_key_id: keyId };
    await deps.repo.insertAggregatorUser(existing);
    await deps.repo.audit(ctx.userId, "snaptrade.user_registered", {});
  }
  const cred = await snaptradeCredential(deps, ctx.userId);
  const s = await st.createLinkSession({ appUserId: ctx.userId, credential: cred, redirectUri: deps.config.snaptradeRedirectUri, broker });
  return json(200, { redirect_url: s.redirectUrl });
});

// ---------------------------------------------------------------------------
// snaptrade-sync  POST {force?}  -> {items, results}
// ---------------------------------------------------------------------------
export const snaptradeSync = route(["POST"], async (req, deps) => {
  const ctx = await deps.authenticate(req);
  const body = await readJsonObject(req);
  onlyKeys(body, ["force"]);
  const force = optBool(body, "force") ?? false;
  const st = deps.snaptrade;
  const cred = await snaptradeCredential(deps, ctx.userId);
  const conns = await st.listConnections!(cred);
  const seen = new Set<string>();
  const results: SyncOutcome[] = [];
  for (const c of conns) {
    seen.add(c.providerItemId);
    const prev = await deps.repo.getLinkedItemByProviderId("snaptrade", c.providerItemId);
    const item = await deps.repo.upsertLinkedItem({
      userId: ctx.userId,
      provider: "snaptrade",
      providerItemId: c.providerItemId,
      institutionId: c.institution.id,
      institutionName: c.institution.name,
      tokenCiphertext: null,
      tokenKeyId: null,
      status: c.disabled ? "needs_reauth" : prev?.status === "needs_reauth" ? "active" : undefined,
    });
    results.push(await syncItem(deps, item, "user", force || !prev));
  }
  // Connections removed at the brokerage/SnapTrade side -> mark revoked locally.
  for (const it of await deps.repo.listLinkedItems(ctx.userId, "snaptrade")) {
    if (!seen.has(it.provider_item_id) && it.status !== "revoked") await deps.repo.setItemStatus(it.id, "revoked", "connection_removed_at_provider");
  }
  const items = (await deps.repo.listLinkedItems(ctx.userId, "snaptrade")).map(toPublicItem);
  return json(200, { items, results });
});

// ---------------------------------------------------------------------------
// unlink  POST {item_id} | {all: true}  -> {removed, provider_errors}
// ---------------------------------------------------------------------------
export const unlink = route(["POST"], async (req, deps) => {
  const ctx = await deps.authenticate(req);
  const body = await readJsonObject(req);
  onlyKeys(body, ["item_id", "all"]);
  const itemId = optString(body, "item_id", UUID_RE);
  const all = optBool(body, "all") ?? false;
  if (!itemId && !all) throw new HttpError(400, "invalid_request", "item_id or all:true required");

  let items: LinkedItemRow[];
  if (itemId) {
    const it = await deps.repo.getLinkedItem(ctx.userId, itemId);
    if (!it) throw new HttpError(404, "not_found", "item not found");
    items = [it];
  } else {
    items = await deps.repo.listLinkedItems(ctx.userId);
  }

  const removed: string[] = [];
  const provider_errors: Array<{ item_id: string; code: string }> = [];
  for (const it of items) {
    try {
      const cred = await credentialFor(deps, it);
      await providerFor(deps, it).removeConnection(cred, it.provider_item_id);
    } catch (e) {
      // The user asked us to delete their data: we still delete locally, and log for ops
      // follow-up (e.g. remove the Item from the Plaid dashboard to stop billing).
      const code = e instanceof ProviderError || e instanceof HttpError ? e.code : "internal_error";
      provider_errors.push({ item_id: it.id, code });
      await deps.repo.audit(ctx.userId, "unlink.provider_remove_failed", { item_id: it.id, provider: it.provider, code });
    }
    await deps.repo.deleteLinkedItem(ctx.userId, it.id);
    removed.push(it.id);
    await deps.repo.audit(ctx.userId, "unlink.item_deleted", { item_id: it.id, provider: it.provider });
  }

  if (all) {
    const su = await deps.repo.getAggregatorUser(ctx.userId, "snaptrade");
    if (su) {
      try {
        await deps.snaptrade.deleteUser?.(await snaptradeCredential(deps, ctx.userId));
      } catch (e) {
        provider_errors.push({ item_id: "snaptrade-user", code: e instanceof ProviderError ? e.code : "internal_error" });
      }
      await deps.repo.deleteAggregatorUser(ctx.userId, "snaptrade");
    }
  }
  return json(200, { removed, provider_errors });
});

// ---------------------------------------------------------------------------
// portfolio-summary  GET|POST  -> PortfolioSummary
// ---------------------------------------------------------------------------
export const portfolioSummary = route(["GET", "POST"], async (req, deps) => {
  const ctx = await deps.authenticate(req);
  if (req.method === "POST") onlyKeys(await readJsonObject(req), []);
  const rows = await deps.repo.getPortfolioRows(ctx.userId);
  return json(200, computePortfolioSummary(rows, today(deps.now())));
});

// Production dependency wiring. Imported ONLY by supabase/functions/<name>/index.ts,
// never by tests (tests build Deps from MockProvider + PGlite).
//
// Required secrets (supabase secrets set ...):
//   TOKEN_ENCRYPTION_KEYS, TOKEN_ENCRYPTION_ACTIVE_KEY_ID
//   PLAID_CLIENT_ID, PLAID_SECRET, PLAID_ENV (sandbox|development|production)
//   SNAPTRADE_CLIENT_ID, SNAPTRADE_CONSUMER_KEY
// Optional: PROVIDER_MODE=mock, REQUIRE_MFA_FOR_LINKING=false (dev only), ALLOWED_ORIGINS,
//   PLAID_WEBHOOK_URL, PLAID_REDIRECT_URI, SNAPTRADE_REDIRECT_URI, MIN_SYNC_INTERVAL_SEC,
//   PLAID_REALTIME_BALANCES=true (Money hub: /accounts/balance/get, billed per call),
//   PLAID_TRANSACTIONS_DAYS_REQUESTED (Money hub link-time history, default 180)
// Provided by Supabase automatically: SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_DB_URL
import postgres from "npm:postgres@3.4.5";
import { createClient } from "npm:@supabase/supabase-js@2.45.4";
import { b64urlDecode, TokenCipher } from "./crypto.ts";
import type { AuthContext, Deps } from "./handlers.ts";
import { HttpError } from "./http.ts";
import { MockProvider } from "./providers/mock.ts";
import { type PlaidEnv, PlaidProvider } from "./providers/plaid.ts";
import { SnapTradeProvider } from "./providers/snaptrade.ts";
import { Repo, type SqlExecutor } from "./repo.ts";
import { cachedJwkFetcher, verifyPlaidWebhook } from "./webhook.ts";

const env = (k: string) => Deno.env.get(k);
const must = (k: string) => {
  const v = env(k);
  if (!v) throw new Error(`missing env ${k}`);
  return v;
};

let cached: Promise<Deps> | null = null;

export function getDeps(): Promise<Deps> {
  cached ??= build();
  return cached;
}

async function build(): Promise<Deps> {
  const sql = postgres(must("SUPABASE_DB_URL"), { max: 3, prepare: false });
  const exec: SqlExecutor = {
    query: async <T,>(text: string, params: unknown[] = []) =>
      (await sql.unsafe(text, params as never[])) as unknown as T[],
  };
  const supabase = createClient(must("SUPABASE_URL"), must("SUPABASE_ANON_KEY"), { auth: { persistSession: false } });

  const mock = env("PROVIDER_MODE") === "mock";
  const plaid = mock
    ? new MockProvider("plaid", { plaid: { accounts: [], holdings: [], securities: [] } })
    : new PlaidProvider({
      clientId: must("PLAID_CLIENT_ID"),
      secret: must("PLAID_SECRET"),
      env: (env("PLAID_ENV") ?? "sandbox") as PlaidEnv,
      realtimeBalances: env("PLAID_REALTIME_BALANCES") === "true",
      transactionsDaysRequested: Number(env("PLAID_TRANSACTIONS_DAYS_REQUESTED") ?? "180"),
    });
  const snaptrade = mock
    ? new MockProvider("snaptrade", { snaptrade: [] })
    : new SnapTradeProvider({ clientId: must("SNAPTRADE_CLIENT_ID"), consumerKey: must("SNAPTRADE_CONSUMER_KEY") });

  const jwk = cachedJwkFetcher((kid) => (plaid instanceof PlaidProvider ? plaid.getWebhookVerificationKey(kid) : Promise.resolve(null)));

  return {
    repo: new Repo(exec),
    cipher: await TokenCipher.fromEnv(),
    plaid,
    snaptrade,
    authenticate: async (req: Request): Promise<AuthContext> => {
      const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
      if (!token) throw new HttpError(401, "unauthorized", "missing bearer token");
      const { data, error } = await supabase.auth.getUser(token); // server-side validation of the JWT
      if (error || !data.user) throw new HttpError(401, "unauthorized", "invalid session");
      let aal: "aal1" | "aal2" = "aal1";
      try {
        const payload = JSON.parse(new TextDecoder().decode(b64urlDecode(token.split(".")[1])));
        if (payload.aal === "aal2") aal = "aal2";
      } catch { /* token already validated above; default aal1 */ }
      return { userId: data.user.id, aal };
    },
    verifyPlaidWebhook: (raw, headers) => verifyPlaidWebhook(raw, headers.get("plaid-verification"), jwk),
    config: {
      requireMfaForLinking: env("REQUIRE_MFA_FOR_LINKING") !== "false",
      allowedOrigins: (env("ALLOWED_ORIGINS") ?? "").split(",").map((s) => s.trim()).filter(Boolean),
      plaidWebhookUrl: env("PLAID_WEBHOOK_URL"),
      plaidRedirectUri: env("PLAID_REDIRECT_URI"),
      snaptradeRedirectUri: env("SNAPTRADE_REDIRECT_URI"),
      minSyncIntervalSec: Number(env("MIN_SYNC_INTERVAL_SEC") ?? "60"),
    },
    now: () => new Date(),
    // Structured logs: never pass tokens, secrets, or raw provider payloads here.
    log: (level, msg, fields) => console[level === "info" ? "log" : level](JSON.stringify({ level, msg, ...fields })),
  };
}

/** Deno.serve entrypoint helper used by every function. */
export function serve(handler: (req: Request, deps: Deps) => Promise<Response>) {
  Deno.serve(async (req) => handler(req, await getDeps()));
}

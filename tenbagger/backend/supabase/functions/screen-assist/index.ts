// Thin entrypoint; logic lives in ../_shared/screen_assist.ts (screenAssist).
// Env: ANTHROPIC_API_KEY (unset = mock mode, offline reader only), SUPABASE_URL, SUPABASE_ANON_KEY,
// optional SCREEN_ASSIST_MODEL (default claude-haiku-4-5), SCREEN_ASSIST_MAX_TOKENS (600),
// SCREEN_ASSIST_PER_MINUTE (6), SCREEN_ASSIST_PER_DAY (60), SCREEN_ASSIST_CACHE_ENTRIES (500),
// SCREEN_ASSIST_TIMEOUT_MS (12000), ALLOWED_ORIGINS.
// Deliberately does NOT use _shared/deps.ts: this function needs no DB, cipher or brokerage keys.
import { createClient } from "npm:@supabase/supabase-js@2.45.4";
import { HttpError } from "../_shared/http.ts";
import { screenAssist, screenAssistDepsFromEnv } from "../_shared/screen_assist.ts";

const env = (k: string) => Deno.env.get(k);
const supabase = createClient(env("SUPABASE_URL") ?? "", env("SUPABASE_ANON_KEY") ?? "", { auth: { persistSession: false } });

const deps = screenAssistDepsFromEnv(env, async (req) => {
  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) throw new HttpError(401, "unauthorized", "missing bearer token");
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) throw new HttpError(401, "unauthorized", "invalid session");
  return { userId: data.user.id };
});

Deno.serve((req) => screenAssist(req, deps));

/**
 * "Ask the screener" client.
 *
 *   askScreener(text)
 *     1. exact query parser on the device (free, instant) → done if it parses
 *     2. otherwise the active adapter:
 *        - backend: POST {EXPO_PUBLIC_SUPABASE_URL}/functions/v1/screen-assist (needs a session token)
 *        - mock:    the package's offline reader (parser + house synonyms), no network
 *
 * The backend adapter is used only when EXPO_PUBLIC_SUPABASE_URL is set AND an auth-token getter
 * has been registered (setAssistAuthTokenGetter). Any backend failure falls back to the mock,
 * with a note saying so. The AI only ever returns filters; results are computed on the device
 * from company filings.
 */
import {
  ASSIST_DISCLAIMER,
  mockAssist,
  needsModel,
  safeParseQuery,
  restateFilters,
  type AssistResult,
} from '../lib/screener';
import { coerceAssistResult } from '../../../packages/screener/src/index';

export { ASSIST_DISCLAIMER };
export type { AssistResult };

export type AssistAnswer = AssistResult & { adapter: 'device' | 'mock' | 'backend'; degraded?: boolean };

export interface AssistAdapter {
  name: 'mock' | 'backend';
  ask(text: string, signal?: AbortSignal): Promise<AssistAnswer>;
}

export class AssistHttpError extends Error {
  constructor(readonly status: number, readonly code: string, message: string, readonly retryAfter?: number) {
    super(message);
  }
}

export function createMockAdapter(): AssistAdapter {
  return {
    name: 'mock',
    ask: async (text) => ({ ...mockAssist(text), adapter: 'mock' }),
  };
}

export interface BackendAdapterOptions {
  /** e.g. https://abc.supabase.co (no trailing slash needed). */
  supabaseUrl: string;
  anonKey?: string;
  getAccessToken: () => Promise<string | null> | string | null;
  fetchImpl?: typeof fetch;
}

export function createBackendAdapter(opts: BackendAdapterOptions): AssistAdapter {
  const url = `${opts.supabaseUrl.replace(/\/+$/, '')}/functions/v1/screen-assist`;
  const doFetch = opts.fetchImpl ?? ((...a: Parameters<typeof fetch>) => fetch(...a));
  return {
    name: 'backend',
    ask: async (text, signal) => {
      const token = await opts.getAccessToken();
      if (!token) throw new AssistHttpError(401, 'unauthorized', 'Sign in to use the AI helper.');
      const headers: Record<string, string> = { 'content-type': 'application/json', authorization: `Bearer ${token}` };
      if (opts.anonKey) headers.apikey = opts.anonKey;
      const res = await doFetch(url, { method: 'POST', headers, body: JSON.stringify({ text }), signal });
      const body = (await res.json().catch(() => null)) as Record<string, unknown> | null;
      if (!res.ok) {
        const retry = Number(res.headers.get('retry-after') ?? body?.retry_after ?? NaN);
        throw new AssistHttpError(
          res.status,
          String(body?.error ?? 'http_error'),
          String(body?.message ?? `The AI helper returned ${res.status}.`),
          Number.isFinite(retry) ? retry : undefined,
        );
      }
      // Never trust the network: filters are re-validated against the catalog here too.
      const r = coerceAssistResult(body);
      if (!r) throw new AssistHttpError(502, 'bad_response', 'The AI helper sent something unexpected.');
      return { ...r, adapter: 'backend', degraded: body?.degraded === true };
    },
  };
}

// ---------------------------------------------------------------- active adapter

let tokenGetter: (() => Promise<string | null> | string | null) | null = null;
let override: AssistAdapter | null = null;

/** Wire the signed-in session (the lead adds this where Supabase auth lives). */
export function setAssistAuthTokenGetter(fn: (() => Promise<string | null> | string | null) | null) {
  tokenGetter = fn;
}

/** Tests / demos: force an adapter. Pass null to go back to env-based selection. */
export function setAssistAdapter(a: AssistAdapter | null) {
  override = a;
}

export function getAssistAdapter(env: Record<string, string | undefined> = readEnv()): AssistAdapter {
  if (override) return override;
  const url = env.EXPO_PUBLIC_SUPABASE_URL;
  if (url && tokenGetter) {
    return createBackendAdapter({ supabaseUrl: url, anonKey: env.EXPO_PUBLIC_SUPABASE_ANON_KEY, getAccessToken: tokenGetter });
  }
  return createMockAdapter();
}

function readEnv(): Record<string, string | undefined> {
  // Expo inlines EXPO_PUBLIC_* at build time when referenced literally.
  return {
    EXPO_PUBLIC_SUPABASE_URL: process.env.EXPO_PUBLIC_SUPABASE_URL,
    EXPO_PUBLIC_SUPABASE_ANON_KEY: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
  };
}

/**
 * Turn a description into filters. Exact queries never leave the device; fuzzy ones go to the
 * active adapter; a failing backend falls back to the offline reader with an honest note.
 */
export async function askScreener(text: string, adapter: AssistAdapter = getAssistAdapter(), signal?: AbortSignal): Promise<AssistAnswer> {
  const trimmed = text.trim();
  if (!trimmed) return { filters: [], restatement: restateFilters([]), notes: [], unrecognized: [], interpreted: [], source: 'parser', adapter: 'device' };
  const exact = safeParseQuery(trimmed);
  if (exact.ok && exact.filters.length) {
    return {
      filters: exact.filters,
      restatement: restateFilters(exact.filters),
      notes: exact.warnings.map((w) => w.message),
      unrecognized: [],
      interpreted: [{ phrase: trimmed, filters: exact.filters }],
      source: 'parser',
      adapter: 'device',
    };
  }
  // Fully understood by the offline reader? Then no need to spend a model call either.
  const offline = mockAssist(trimmed);
  if (!needsModel(offline) || adapter.name === 'mock') return { ...offline, adapter: adapter.name === 'mock' ? 'mock' : 'device' };
  try {
    return await adapter.ask(trimmed, signal);
  } catch (e) {
    const reason =
      e instanceof AssistHttpError && e.status === 429
        ? 'The AI helper is busy (rate limit), so this is the offline reading.'
        : e instanceof AssistHttpError && e.status === 401
          ? 'Sign in to use the AI helper; this is the offline reading.'
          : 'The AI helper is unavailable, so this is the offline reading.';
    return { ...offline, notes: [reason, ...offline.notes], adapter: 'mock', degraded: true };
  }
}

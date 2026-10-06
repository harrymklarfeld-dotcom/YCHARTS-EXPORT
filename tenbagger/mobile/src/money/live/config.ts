/**
 * Picks the MoneyClient. Mock (sandbox, in memory) unless a Supabase URL + anon key are set:
 *
 *   EXPO_PUBLIC_SUPABASE_URL=https://<project>.supabase.co
 *   EXPO_PUBLIC_SUPABASE_ANON_KEY=<anon key>          (public by design; RLS protects rows)
 *   EXPO_PUBLIC_MONEY_MODE=mock|http                  (optional override; http needs the two above)
 *
 * The user JWT is supplied by the app's auth layer via setMoneyAccessTokenProvider() (there is no
 * auth screen yet, so http mode reports "signed_out" until one exists). Never put a service-role
 * key or Plaid secret in EXPO_PUBLIC_* vars: they ship inside the app bundle.
 */
import { HttpMoneyClient } from './HttpMoneyClient';
import { MockMoneyClient } from './MockMoneyClient';
import type { MoneyClient } from './types';

export type MoneyClientConfig = { mode: 'mock' | 'http'; supabaseUrl: string | null; anonKey: string | null };

export function readMoneyConfig(
  env: { url?: string; key?: string; mode?: string } = {
    // Static property access so Expo inlines EXPO_PUBLIC_* at build time.
    url: process.env.EXPO_PUBLIC_SUPABASE_URL,
    key: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
    mode: process.env.EXPO_PUBLIC_MONEY_MODE,
  },
): MoneyClientConfig {
  const url = env.url?.trim() || null;
  const key = env.key?.trim() || null;
  const canHttp = !!url && !!key;
  const mode = env.mode === 'mock' || !canHttp ? 'mock' : 'http';
  return { mode, supabaseUrl: url, anonKey: key };
}

let accessToken: () => Promise<string | null> = async () => null;
export function setMoneyAccessTokenProvider(fn: () => Promise<string | null>): void {
  accessToken = fn;
}

export function createMoneyClient(cfg: MoneyClientConfig = readMoneyConfig()): MoneyClient {
  if (cfg.mode === 'http' && cfg.supabaseUrl && cfg.anonKey) {
    return new HttpMoneyClient({ baseUrl: cfg.supabaseUrl, anonKey: cfg.anonKey, getAccessToken: () => accessToken() });
  }
  return new MockMoneyClient();
}

let client: MoneyClient | null = null;
export function getMoneyClient(): MoneyClient {
  if (!client) client = createMoneyClient();
  return client;
}
/** Tests / auth changes: swap the client (null = rebuild from config on next use). */
export function setMoneyClient(c: MoneyClient | null): void {
  client = c;
}

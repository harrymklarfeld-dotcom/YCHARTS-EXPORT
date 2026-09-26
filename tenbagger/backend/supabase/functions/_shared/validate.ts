// Tiny allow-list validators (no deps). Unknown keys are rejected so clients cannot
// smuggle fields (e.g. user_id) into handlers.
import { badRequest } from "./http.ts";

export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export const PLAID_PUBLIC_TOKEN_RE = /^public-(sandbox|development|production)-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
export const SLUG_RE = /^[A-Z0-9_-]{1,64}$/i;

export function onlyKeys(body: Record<string, unknown>, allowed: string[]): void {
  for (const k of Object.keys(body)) {
    if (!allowed.includes(k)) throw badRequest(`unexpected field: ${k.slice(0, 40)}`);
  }
}

export function optString(body: Record<string, unknown>, key: string, re: RegExp): string | undefined {
  const v = body[key];
  if (v === undefined || v === null) return undefined;
  if (typeof v !== "string" || !re.test(v)) throw badRequest(`invalid ${key}`);
  return v;
}

export function reqString(body: Record<string, unknown>, key: string, re: RegExp): string {
  const v = optString(body, key, re);
  if (v === undefined) throw badRequest(`missing ${key}`);
  return v;
}

export function optBool(body: Record<string, unknown>, key: string): boolean | undefined {
  const v = body[key];
  if (v === undefined || v === null) return undefined;
  if (typeof v !== "boolean") throw badRequest(`invalid ${key}`);
  return v;
}

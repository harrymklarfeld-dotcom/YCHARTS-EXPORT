/**
 * Reads a JWT payload WITHOUT verifying it. Only used client-side to learn `exp` and `aal`
 * (when to refresh, whether two-step sign-in is done). The backend verifies every token
 * (functions/_shared/deps.ts → auth.getUser), so nothing here is a security decision.
 */
import type { Aal } from './types';

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

function b64urlToUtf8(s: string): string {
  const clean = s.replace(/-/g, '+').replace(/_/g, '/').replace(/=+$/, '');
  const bytes: number[] = [];
  let buf = 0;
  let bits = 0;
  for (const ch of clean) {
    const v = B64.indexOf(ch);
    if (v < 0) throw new Error('bad base64');
    buf = (buf << 6) | v;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      bytes.push((buf >> bits) & 0xff);
    }
  }
  // UTF-8 decode (emails may contain non-ASCII).
  let out = '';
  for (let i = 0; i < bytes.length; ) {
    const b = bytes[i++];
    let cp: number;
    if (b < 0x80) cp = b;
    else if (b < 0xe0) cp = ((b & 0x1f) << 6) | (bytes[i++] & 0x3f);
    else if (b < 0xf0) cp = ((b & 0x0f) << 12) | ((bytes[i++] & 0x3f) << 6) | (bytes[i++] & 0x3f);
    else cp = ((b & 0x07) << 18) | ((bytes[i++] & 0x3f) << 12) | ((bytes[i++] & 0x3f) << 6) | (bytes[i++] & 0x3f);
    out += String.fromCodePoint(cp);
  }
  return out;
}

function utf8ToB64url(s: string): string {
  const bytes: number[] = [];
  for (const ch of s) {
    const cp = ch.codePointAt(0)!;
    if (cp < 0x80) bytes.push(cp);
    else if (cp < 0x800) bytes.push(0xc0 | (cp >> 6), 0x80 | (cp & 0x3f));
    else if (cp < 0x10000) bytes.push(0xe0 | (cp >> 12), 0x80 | ((cp >> 6) & 0x3f), 0x80 | (cp & 0x3f));
    else bytes.push(0xf0 | (cp >> 18), 0x80 | ((cp >> 12) & 0x3f), 0x80 | ((cp >> 6) & 0x3f), 0x80 | (cp & 0x3f));
  }
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const n = (bytes[i] << 16) | ((bytes[i + 1] ?? 0) << 8) | (bytes[i + 2] ?? 0);
    out += B64[(n >> 18) & 63] + B64[(n >> 12) & 63];
    if (i + 1 < bytes.length) out += B64[(n >> 6) & 63];
    if (i + 2 < bytes.length) out += B64[n & 63];
  }
  return out.replace(/\+/g, '-').replace(/\//g, '_');
}

export type JwtClaims = { sub?: string; email?: string; exp?: number; aal?: string; [k: string]: unknown };

export function decodeJwtPayload(token: string): JwtClaims | null {
  const part = token.split('.')[1];
  if (!part) return null;
  try {
    const v = JSON.parse(b64urlToUtf8(part));
    return v && typeof v === 'object' ? (v as JwtClaims) : null;
  } catch {
    return null;
  }
}

export function aalOf(claims: JwtClaims | null): Aal {
  return claims?.aal === 'aal2' ? 'aal2' : 'aal1';
}

/** Sandbox only: an UNSIGNED token with the given claims (the fake backend never verifies it). */
export function makeUnsignedJwt(claims: JwtClaims): string {
  return `${utf8ToB64url(JSON.stringify({ alg: 'none', typ: 'JWT' }))}.${utf8ToB64url(JSON.stringify(claims))}.sandbox`;
}

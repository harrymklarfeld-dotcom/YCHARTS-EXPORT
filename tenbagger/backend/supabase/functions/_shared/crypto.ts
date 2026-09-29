// AES-256-GCM envelope for provider credentials (Plaid access_token, SnapTrade userSecret).
//
// Env:
//   TOKEN_ENCRYPTION_KEYS          JSON object {"<key_id>": "<base64 32-byte key>", ...}
//   TOKEN_ENCRYPTION_ACTIVE_KEY_ID key id used for NEW encryptions (old ids stay for decrypt → rotation)
//
// Ciphertext format:  v1.<key_id>.<iv base64url (12 bytes)>.<ciphertext+tag base64url>
// AAD (additional authenticated data) binds a ciphertext to its row context, e.g.
// "plaid:<user_id>:<item_id>", so copying a ciphertext onto another user's row fails to decrypt.

const KEY_ID_RE = /^[A-Za-z0-9_-]{1,32}$/;
const enc = new TextEncoder();
const dec = new TextDecoder();

export function b64urlEncode(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function b64urlDecode(s: string): Uint8Array {
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((s.length + 3) % 4);
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export class CryptoConfigError extends Error {}
export class DecryptError extends Error {}

export class TokenCipher {
  private constructor(private readonly keys: Map<string, CryptoKey>, readonly activeKeyId: string) {}

  static async fromRawKeys(rawKeys: Record<string, Uint8Array>, activeKeyId: string): Promise<TokenCipher> {
    const keys = new Map<string, CryptoKey>();
    for (const [id, raw] of Object.entries(rawKeys)) {
      if (!KEY_ID_RE.test(id)) throw new CryptoConfigError(`invalid key id ${JSON.stringify(id)}`);
      if (raw.length !== 32) throw new CryptoConfigError(`key ${id} must be 32 bytes (AES-256)`);
      keys.set(id, await crypto.subtle.importKey("raw", raw as BufferSource, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]));
    }
    if (!keys.has(activeKeyId)) throw new CryptoConfigError("active key id not present in key set");
    return new TokenCipher(keys, activeKeyId);
  }

  static fromEnv(get: (k: string) => string | undefined = (k) => Deno.env.get(k)): Promise<TokenCipher> {
    const json = get("TOKEN_ENCRYPTION_KEYS");
    const active = get("TOKEN_ENCRYPTION_ACTIVE_KEY_ID");
    if (!json || !active) return Promise.reject(new CryptoConfigError("TOKEN_ENCRYPTION_KEYS / TOKEN_ENCRYPTION_ACTIVE_KEY_ID not set"));
    let parsed: Record<string, string>;
    try {
      parsed = JSON.parse(json);
    } catch {
      return Promise.reject(new CryptoConfigError("TOKEN_ENCRYPTION_KEYS is not valid JSON"));
    }
    const raw: Record<string, Uint8Array> = {};
    try {
      for (const [id, v] of Object.entries(parsed)) raw[id] = b64urlDecode(String(v).replace(/=+$/, ""));
    } catch {
      return Promise.reject(new CryptoConfigError("TOKEN_ENCRYPTION_KEYS values must be base64"));
    }
    return TokenCipher.fromRawKeys(raw, active);
  }

  async encrypt(plaintext: string, aad: string): Promise<{ ciphertext: string; keyId: string }> {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const key = this.keys.get(this.activeKeyId)!;
    const ct = new Uint8Array(
      await crypto.subtle.encrypt({ name: "AES-GCM", iv, additionalData: enc.encode(aad) }, key, enc.encode(plaintext)),
    );
    return { ciphertext: `v1.${this.activeKeyId}.${b64urlEncode(iv)}.${b64urlEncode(ct)}`, keyId: this.activeKeyId };
  }

  async decrypt(ciphertext: string, aad: string): Promise<string> {
    const parts = ciphertext.split(".");
    if (parts.length !== 4 || parts[0] !== "v1") throw new DecryptError("unrecognized ciphertext format");
    const [, keyId, ivB64, ctB64] = parts;
    const key = this.keys.get(keyId);
    if (!key) throw new DecryptError(`unknown key id ${keyId}`);
    try {
      const pt = await crypto.subtle.decrypt(
        { name: "AES-GCM", iv: b64urlDecode(ivB64) as BufferSource, additionalData: enc.encode(aad) },
        key,
        b64urlDecode(ctB64) as BufferSource,
      );
      return dec.decode(pt);
    } catch {
      throw new DecryptError("decryption failed (wrong key, AAD, or tampered ciphertext)");
    }
  }

  /** True when a ciphertext was produced under a non-active key (candidate for re-encryption). */
  needsRotation(ciphertext: string): boolean {
    return ciphertext.split(".")[1] !== this.activeKeyId;
  }
}

/** Constant-time string comparison (for hashes / signatures). */
export function timingSafeEqual(a: string, b: string): boolean {
  const ab = enc.encode(a);
  const bb = enc.encode(b);
  let diff = ab.length ^ bb.length;
  const n = Math.max(ab.length, bb.length);
  for (let i = 0; i < n; i++) diff |= (ab[i] ?? 0) ^ (bb[i] ?? 0);
  return diff === 0;
}

export async function sha256Hex(data: string): Promise<string> {
  const h = new Uint8Array(await crypto.subtle.digest("SHA-256", enc.encode(data)));
  return [...h].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export const aad = {
  plaidItem: (userId: string, itemId: string) => `plaid:${userId}:${itemId}`,
  snaptradeUser: (userId: string, providerUserId: string) => `snaptrade-user:${userId}:${providerUserId}`,
};

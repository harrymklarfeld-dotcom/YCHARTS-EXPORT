import { assert, assertEquals, assertNotEquals, assertRejects } from "jsr:@std/assert@1";
import { b64urlEncode, CryptoConfigError, DecryptError, TokenCipher } from "../supabase/functions/_shared/crypto.ts";

const key = (fill: number) => new Uint8Array(32).fill(fill);
const TOKEN = "access-sandbox-de3ce8ef-33f8-452c-a685-8671031fc0f6";
const AAD = "plaid:11111111-1111-4111-8111-111111111111:item-1";

Deno.test("AES-GCM round trip; ciphertext is opaque and randomized", async () => {
  const c = await TokenCipher.fromRawKeys({ k1: key(1) }, "k1");
  const a = await c.encrypt(TOKEN, AAD);
  const b = await c.encrypt(TOKEN, AAD);
  assertEquals(a.keyId, "k1");
  assert(a.ciphertext.startsWith("v1.k1."));
  assert(!a.ciphertext.includes("access-sandbox"));
  assertNotEquals(a.ciphertext, b.ciphertext); // fresh IV each time
  assertEquals(await c.decrypt(a.ciphertext, AAD), TOKEN);
});

Deno.test("AAD binding: ciphertext moved to another user's row does not decrypt", async () => {
  const c = await TokenCipher.fromRawKeys({ k1: key(1) }, "k1");
  const { ciphertext } = await c.encrypt(TOKEN, AAD);
  await assertRejects(() => c.decrypt(ciphertext, "plaid:22222222-2222-4222-8222-222222222222:item-1"), DecryptError);
});

Deno.test("tampering and wrong key are detected", async () => {
  const c = await TokenCipher.fromRawKeys({ k1: key(1) }, "k1");
  const { ciphertext } = await c.encrypt(TOKEN, AAD);
  const parts = ciphertext.split(".");
  const last = parts[3];
  parts[3] = (last[0] === "A" ? "B" : "A") + last.slice(1);
  await assertRejects(() => c.decrypt(parts.join("."), AAD), DecryptError);
  const other = await TokenCipher.fromRawKeys({ k1: key(9) }, "k1");
  await assertRejects(() => other.decrypt(ciphertext, AAD), DecryptError);
  await assertRejects(() => c.decrypt("garbage", AAD), DecryptError);
});

Deno.test("key rotation: old ciphertexts still decrypt, new ones use the active key", async () => {
  const old = await TokenCipher.fromRawKeys({ k1: key(1) }, "k1");
  const { ciphertext } = await old.encrypt(TOKEN, AAD);
  const rotated = await TokenCipher.fromRawKeys({ k1: key(1), k2: key(2) }, "k2");
  assertEquals(await rotated.decrypt(ciphertext, AAD), TOKEN);
  assert(rotated.needsRotation(ciphertext));
  const fresh = await rotated.encrypt(TOKEN, AAD);
  assertEquals(fresh.keyId, "k2");
  assert(!rotated.needsRotation(fresh.ciphertext));
});

Deno.test("fromEnv validates configuration", async () => {
  const good = { TOKEN_ENCRYPTION_KEYS: JSON.stringify({ k1: b64urlEncode(key(3)) }), TOKEN_ENCRYPTION_ACTIVE_KEY_ID: "k1" };
  const c = await TokenCipher.fromEnv((k) => good[k as keyof typeof good]);
  assertEquals(await c.decrypt((await c.encrypt("x", "a")).ciphertext, "a"), "x");
  await assertRejects(() => TokenCipher.fromEnv(() => undefined), CryptoConfigError);
  await assertRejects(() => TokenCipher.fromEnv((k) => (k === "TOKEN_ENCRYPTION_KEYS" ? JSON.stringify({ k1: b64urlEncode(new Uint8Array(16)) }) : "k1")), CryptoConfigError);
  await assertRejects(() => TokenCipher.fromEnv((k) => (k === "TOKEN_ENCRYPTION_KEYS" ? good.TOKEN_ENCRYPTION_KEYS : "missing")), CryptoConfigError);
});

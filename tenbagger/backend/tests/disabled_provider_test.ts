import { assertEquals, assertRejects } from "jsr:@std/assert@1";
import { HttpError } from "../supabase/functions/_shared/http.ts";
import { notConfiguredProvider } from "../supabase/functions/_shared/providers/disabled.ts";

Deno.test("an unconfigured provider rejects every call with 503 instead of crashing startup", async () => {
  const p = notConfiguredProvider("snaptrade");
  assertEquals(p.name, "snaptrade");
  const err = await assertRejects(() => p.createLinkSession({ appUserId: "u" }), HttpError);
  assertEquals((err as HttpError).status, 503);
});

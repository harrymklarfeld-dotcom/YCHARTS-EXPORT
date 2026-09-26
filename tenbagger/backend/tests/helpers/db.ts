// Spins up an in-process Postgres 17 (PGlite/WASM), applies the Supabase shim, every
// migration in order, and optionally seed.sql. Used by SQL/RLS and handler tests.
import { PGlite } from "npm:@electric-sql/pglite@0.3.16";
import type { SqlExecutor } from "../../supabase/functions/_shared/repo.ts";

const root = new URL("../../", import.meta.url);

export async function migrationFiles(): Promise<string[]> {
  const dir = new URL("supabase/migrations/", root);
  const names: string[] = [];
  for await (const e of Deno.readDir(dir)) if (e.isFile && e.name.endsWith(".sql")) names.push(e.name);
  return names.sort().map((n) => new URL(n, dir).pathname);
}

export async function freshDb(opts: { seed?: boolean } = {}): Promise<PGlite> {
  const db = new PGlite();
  await db.exec(await Deno.readTextFile(new URL("tests/helpers/supabase_shim.sql", root)));
  for (const f of await migrationFiles()) {
    try {
      await db.exec(await Deno.readTextFile(f));
    } catch (e) {
      throw new Error(`migration ${f} failed: ${(e as Error).message}`);
    }
  }
  if (opts.seed) await db.exec(await Deno.readTextFile(new URL("supabase/seed.sql", root)));
  return db;
}

export function executor(db: PGlite): SqlExecutor {
  return { query: async <T,>(text: string, params: unknown[] = []) => (await db.query<T>(text, params)).rows };
}

export async function createUser(db: PGlite, id: string, email = `${id.slice(0, 8)}@example.test`) {
  await db.query(`insert into auth.users (id, email) values ($1, $2)`, [id, email]);
}

/** Run `fn` as a Supabase API role with the given JWT subject, then reset to superuser. */
export async function asRole<T>(db: PGlite, role: "anon" | "authenticated" | "service_role", sub: string | null, fn: () => Promise<T>): Promise<T> {
  await db.exec(`reset role`);
  await db.query(`select set_config('request.jwt.claim.sub', $1, false)`, [sub ?? ""]);
  await db.exec(`set role ${role}`);
  try {
    return await fn();
  } finally {
    await db.exec(`reset role`);
    await db.query(`select set_config('request.jwt.claim.sub', '', false)`);
  }
}

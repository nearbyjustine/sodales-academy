import "server-only";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import { userProfile } from "@/db/schema";

// A note on the `import "server-only"` above, for whoever next runs this file directly (not
// through Next.js): the installed `server-only@0.0.1` package's `exports` map only resolves to
// its no-op `empty.js` under Node's `react-server` condition (set by Next.js's own bundler) —
// its default `index.js` unconditionally throws. `@/db` (imported below) carries the same guard.
// Both this file and `@/db` are correct to guard themselves this way — the intent is exactly
// "never let this get pulled into a client bundle" — but it means `seed-cli.ts`'s bare Node/tsx
// invocation must pass `--conditions=react-server` (see `package.json`'s `db:seed` script) or
// every import below throws immediately, before `runSeed` ever runs.

/**
 * Promotes `ADMIN_EMAIL` to `admin`. Safe to re-run.
 *
 * This used to also do a one-time migration of Phase 1's Markdown course fixtures into Postgres
 * (`content/` → `course`/`course_module`/`lesson`, via `loadAllCourses`). That migration ran for
 * real once (Task 17, Step 1) and its output is now permanent data in this database; the
 * migration code itself was deleted along with `content/` and the loader in the same task, since
 * its only caller was about to stop existing. What's left here is just the admin-promotion half,
 * kept for any future admin-promotion needs (e.g. re-running after `ADMIN_EMAIL` changes).
 */
export async function runSeed(): Promise<void> {
  await promoteAdmin();
}

/**
 * Promotes `ADMIN_EMAIL`'s `user_profile` row to `admin`, matching spec §6's "First admin" rule:
 * idempotent, no-ops if already admin, throws with an actionable message if that user hasn't
 * signed up yet.
 *
 * Resolves `ADMIN_EMAIL` to a real Neon Auth user id via a raw SQL read of `neon_auth."user"`
 * (spec §5: "Auth users live in `neon_auth.\"user\"`" — a real schema in the same Postgres
 * database `db` already talks to, confirmed live: `select table_name from information_schema
 * .tables where table_schema = 'neon_auth'` returns `user`, `account`, `session`, etc.).
 *
 * This is the sanctioned fallback, not a first choice taken without checking the SDK: the
 * installed `@neondatabase/auth@0.5.0-beta`'s server surface (`ServerAuthMethods`, verified in
 * `dist/types-CnMXQlnQ.d.mts`) does expose `admin.listUsers`/`admin.getUser` endpoints (Better
 * Auth's admin plugin), which is where a real by-email lookup would otherwise belong. But every
 * one of those endpoints' `use` middleware requires an already-authenticated admin *session*
 * (`dist/adapter-core-TGYh5CXP.d.mts`: `getUser`/`listUsers` both list a `use` array whose
 * middleware resolves `session: { user: UserWithRole; session: {...} }` from request cookies) —
 * there is no service-role/API-key bypass in this package. A headless seed script has no request,
 * no cookies, and by definition no admin yet (that's the whole point of "first admin"), so calling
 * `auth.admin.listUsers(...)` here is circular: it requires an admin to already exist in order to
 * find the person who should become the admin. The raw-SQL read has no such bootstrapping problem.
 */
async function promoteAdmin(): Promise<void> {
  const { id, name } = await findAdminAuthUser();

  await db
    .insert(userProfile)
    .values({ userId: id, name, role: "admin" })
    .onConflictDoUpdate({
      target: userProfile.userId,
      set: { role: "admin", updatedAt: new Date() },
    });
}

async function findAdminAuthUser(): Promise<{ id: string; name: string }> {
  const adminEmail = process.env.ADMIN_EMAIL;
  if (!adminEmail) throw new Error("ADMIN_EMAIL is not set — needed to promote/assign migrated courses.");

  const result = await db.execute<{ id: string; name: string }>(
    sql`select id, name from neon_auth."user" where email = ${adminEmail} limit 1`,
  );
  const authUser = result.rows[0];
  if (!authUser) {
    throw new Error(
      "ADMIN_EMAIL has no matching Neon Auth user yet — they must complete the real invite-code " +
        "+ Google OAuth sign-up (see /sign-up) before the seed can promote or assign courses to " +
        "them. Re-run `pnpm db:seed` afterward.",
    );
  }
  return authUser;
}

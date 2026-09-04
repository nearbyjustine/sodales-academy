import "server-only";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { course, courseModule, lesson, userProfile } from "@/db/schema";
import { loadAllCourses } from "@/lib/content/loader";

// A note on the `import "server-only"` above, for whoever next runs this file directly (not
// through Next.js): the installed `server-only@0.0.1` package's `exports` map only resolves to
// its no-op `empty.js` under Node's `react-server` condition (set by Next.js's own bundler) —
// its default `index.js` unconditionally throws. `@/db` (imported below) carries the same guard.
// Both this file and `@/db` are correct to guard themselves this way — the intent is exactly
// "never let this get pulled into a client bundle" — but it means `seed-cli.ts`'s bare Node/tsx
// invocation must pass `--conditions=react-server` (see `package.json`'s `db:seed` script) or
// every import below throws immediately, before `runSeed` ever runs.

/**
 * One-time migration: import Phase 1's Markdown course fixtures into Postgres, and promote
 * `ADMIN_EMAIL` to `admin`. Safe to re-run — including after a crash mid-course, not just before
 * any insert has happened.
 *
 * NOT wrapped in `db.transaction(...)`, despite spec §7 describing "a single transaction" —
 * `src/db/index.ts` connects via `drizzle-orm/neon-http`, and that driver's `NeonHttpSession`
 * throws `"No transactions support in neon-http driver"` synchronously the moment `.transaction()`
 * is called (`node_modules/drizzle-orm/neon-http/session.cjs`, confirmed by reading the compiled
 * session class — not just the `.d.ts`, since the type signature alone doesn't reveal the runtime
 * throw). `drizzle-kit`'s own migrator docs carry the same caveat for this driver.
 *
 * Because there's no transaction, a crash between two inserts is a real possibility (e.g. after a
 * course row and 2 of its 3 modules land, before the third module's lessons do), so idempotency is
 * enforced at every level, not just per-course: `getOrCreateCourse`/`getOrCreateModule` check for
 * an existing row before inserting, and the lesson insert leans on `lesson`'s real
 * `unique(course_id, slug)` constraint via `onConflictDoNothing()`. A re-run after a partial crash
 * resumes and fills in whatever's missing, rather than seeing the course row exists and skipping
 * the rest of it.
 */
export async function runSeed(): Promise<{ coursesImported: number; lessonsImported: number }> {
  await promoteAdmin();
  const instructorUserId = await resolveInstructorUserId();

  const courses = await loadAllCourses();
  let coursesImported = 0;
  let lessonsImported = 0;

  for (const c of courses) {
    const { id: courseId, wasCreated } = await getOrCreateCourse(c, instructorUserId);
    if (wasCreated) coursesImported++;

    for (const m of c.modules) {
      const moduleId = await getOrCreateModule(courseId, m);

      for (const l of m.lessons) {
        const [insertedLesson] = await db
          .insert(lesson)
          .values({
            moduleId,
            courseId,
            slug: l.slug,
            title: l.title,
            content: l.content,
            position: l.position,
            isPreview: l.isPreview,
          })
          .onConflictDoNothing() // idempotent — backed by lesson's unique(course_id, slug)
          .returning({ id: lesson.id });
        if (insertedLesson) lessonsImported++;
      }
    }
  }

  return { coursesImported, lessonsImported };
}

async function getOrCreateCourse(
  c: Awaited<ReturnType<typeof loadAllCourses>>[number],
  instructorUserId: string,
): Promise<{ id: string; wasCreated: boolean }> {
  const [existing] = await db.select({ id: course.id }).from(course).where(eq(course.slug, c.slug));
  if (existing) return { id: existing.id, wasCreated: false };

  const [insertedCourse] = await db
    .insert(course)
    .values({
      slug: c.slug,
      title: c.title,
      description: c.description,
      category: c.category,
      level: c.level,
      status: c.status,
      instructorUserId,
    })
    .returning();
  return { id: insertedCourse.id, wasCreated: true };
}

async function getOrCreateModule(
  courseId: string,
  m: { title: string; position: number },
): Promise<string> {
  // course_module has no unique constraint to back onConflictDoNothing() — the loader guarantees
  // module titles are unique within a course (they're the grouping key lessons are bucketed by),
  // so an explicit existence check on (courseId, title) is the equivalent idempotency guard.
  const [existing] = await db
    .select({ id: courseModule.id })
    .from(courseModule)
    .where(and(eq(courseModule.courseId, courseId), eq(courseModule.title, m.title)));
  if (existing) return existing.id;

  const [insertedModule] = await db
    .insert(courseModule)
    .values({ courseId, title: m.title, position: m.position })
    .returning();
  return insertedModule.id;
}

/**
 * Every migrated course defaults to `ADMIN_EMAIL`'s Neon Auth user id (spec §7 step 3) —
 * reassignable afterward through the edit form. Looked up fresh (not cached from `promoteAdmin`)
 * so this function stays independently correct if ever called on its own.
 */
async function resolveInstructorUserId(): Promise<string> {
  const { id } = await findAdminAuthUser();
  return id;
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

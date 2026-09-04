import "server-only";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { userProfile, enrollment, course } from "@/db/schema";
import { auth } from "@/lib/auth/server";

export type Role = "learner" | "instructor" | "admin";

export type Session = {
  userId: string;
  name: string;
  email: string;
  initials: string;
  role: Role;
};

export type Enrollment = { courseSlug: string };

function initialsFor(name: string): string {
  const parts = name.trim().split(/\s+/);
  return parts
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

/**
 * PHASE 2 SEAM — real implementation.
 *
 * Signatures unchanged from Phase 1. Every page that already calls these keeps working.
 *
 * `auth.getSession()` verified against the installed `@neondatabase/auth@0.5.0-beta`'s actual
 * runtime (`dist/server-b0OzGjXl.mjs`), not the plan's guessed `auth.api.getSession({ headers })`:
 *
 * - It's `auth.getSession(...)`, not `auth.api.getSession(...)` — there is no `api` namespace.
 *   `NeonAuthServer` (the type of `auth`) is `Pick<VanillaBetterAuthClient, ServerAuthMethods>`,
 *   so every Better Auth server method (`getSession`, `signIn`, ...) hangs directly off `auth`.
 * - It takes no `headers` argument. The Next.js server wrapper builds its `RequestContext` from
 *   `createNextRequestContext` (`dist/next/server/index.mjs`), which calls `cookies()`/`headers()`
 *   from `next/headers` itself — ambiently, inside the request's async context. Passing headers
 *   explicitly isn't part of the contract; the createNeonAuth doc comment's own RSC example calls
 *   it bare: `const { data: session } = await auth.getSession();`.
 * - It returns `{ data, error }`, matching every other Neon Auth server method's return shape
 *   (see `fetchWithAuth` in the same file). `data` is `SessionData` — `{ session, user }` on
 *   success, or `{ session: null, user: null }` when there's no session — never a bare `null`.
 */

export async function getSession(): Promise<Session | null> {
  const { data } = await auth.getSession();
  const user = data?.user;
  if (!user) return null;

  const [profile] = await db
    .select({ role: userProfile.role })
    .from(userProfile)
    .where(eq(userProfile.userId, user.id));

  return {
    userId: user.id,
    name: user.name,
    email: user.email,
    initials: initialsFor(user.name),
    role: profile?.role ?? "learner",
  };
}

export async function requireUser(): Promise<Session> {
  const session = await getSession();
  if (!session) redirect("/login");
  return session;
}

export async function requireRole(...roles: Role[]): Promise<Session> {
  const session = await requireUser();
  if (!roles.includes(session.role)) redirect("/");
  return session;
}

export async function getEnrollments(): Promise<Enrollment[]> {
  const session = await getSession();
  if (!session) return [];

  const rows = await db
    .select({ courseSlug: course.slug })
    .from(enrollment)
    .innerJoin(course, eq(enrollment.courseId, course.id))
    .where(eq(enrollment.userId, session.userId));

  return rows;
}

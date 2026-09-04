import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { userProfile, enrollment, course } from "@/db/schema";
import { auth } from "@/lib/auth/server";
import { verifyInviteToken, INVITE_TOKEN_COOKIE } from "@/lib/auth/invite";

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
 *
 * **First-sign-in provisioning (Task 7):** `@neondatabase/auth` exposes no in-process
 * user-creation hook — Neon Auth is a hosted proxy, so the Google OAuth exchange and user-record
 * creation happen on Neon's own server, not ours. `getSession()` is the one place in our code
 * that reliably runs after every sign-in regardless of which internal path Neon's hosted service
 * redirects through, so it does the provisioning itself: when an authenticated Neon Auth user has
 * no `user_profile` row yet, that's treated as "first sign-in" — a valid invite token cookie
 * provisions the row (role `learner`) and returns the new session; a missing/invalid one returns
 * `null`, exactly as if the user were never signed in. Neon Auth considering the user "signed in"
 * is not the same as this app granting them access.
 */

export async function getSession(): Promise<Session | null> {
  const { data } = await auth.getSession();
  const user = data?.user;
  if (!user) return null;

  const [profile] = await db
    .select({ role: userProfile.role })
    .from(userProfile)
    .where(eq(userProfile.userId, user.id));

  if (profile) {
    return {
      userId: user.id,
      name: user.name,
      email: user.email,
      initials: initialsFor(user.name),
      role: profile.role,
    };
  }

  // No user_profile row — this is a fresh Google sign-in. Only provision one if they arrived
  // with a valid, unexpired invite token.
  const store = await cookies();
  const token = store.get(INVITE_TOKEN_COOKIE)?.value;
  const verified = token ? verifyInviteToken(token) : null;
  if (!verified) return null;

  await db
    .insert(userProfile)
    .values({ userId: user.id, name: user.name, role: "learner" })
    .onConflictDoNothing(); // idempotent — a retried request shouldn't insert twice

  try {
    store.delete(INVITE_TOKEN_COOKIE);
  } catch {
    // `getSession()` is called from Server Components during render (e.g. `SiteHeader`, which is
    // what a user lands on right after the OAuth redirect to `/dashboard`), and Next.js only
    // allows cookie mutation inside a Server Action or Route Handler — during render, `cookies()`
    // returns a read-only sealed proxy and `.delete()` throws. This cleanup is best-effort, not
    // security-load-bearing: the profile row above is already committed, and once it exists the
    // `if (profile) return` branch above makes this whole block unreachable, so a stale cookie is
    // inert. The cookie's own 30-minute `maxAge` (see `verifyInviteToken`'s TTL) expires it on its
    // own if this delete can't happen here.
  }

  return {
    userId: user.id,
    name: user.name,
    email: user.email,
    initials: initialsFor(user.name),
    role: "learner",
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

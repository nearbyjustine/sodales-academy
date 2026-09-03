import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { DEMO_USER, DEMO_ENROLLMENTS, type Enrollment } from "@/content/session";

export type Role = "learner" | "instructor" | "admin";

export type Session = {
  userId: string;
  name: string;
  email: string;
  initials: string;
  role: Role;
};

export const ROLE_COOKIE = "sodales-demo-role";
const ROLES: Role[] = ["learner", "instructor", "admin"];

/**
 * PHASE 2 SEAM.
 *
 * Signatures match what Neon Auth will provide. Phase 1 returns a hardcoded user
 * whose role comes from a cookie set by the demo role switcher. Phase 2 replaces
 * the bodies; every call site stays as written.
 */

export async function getSession(): Promise<Session | null> {
  const store = await cookies();
  const raw = store.get(ROLE_COOKIE)?.value;
  const role: Role = ROLES.includes(raw as Role) ? (raw as Role) : DEMO_USER.defaultRole;

  return {
    userId: DEMO_USER.userId,
    name: DEMO_USER.name,
    email: DEMO_USER.email,
    initials: DEMO_USER.initials,
    role,
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
  return DEMO_ENROLLMENTS;
}

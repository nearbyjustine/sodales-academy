import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { course } from "@/db/schema";
import type { Session } from "@/lib/session";

/**
 * Course-management authorization (spec §8): an admin may manage any course; an instructor may
 * manage only a course whose `instructor_user_id` matches their own session user id.
 *
 * Deliberately NOT in `mutations.ts`. That file has a top-of-file `"use server"` directive, which
 * makes every one of its exports a network-reachable Server Action — including, previously, this
 * function, whose second parameter is the `Session` used for the authorization DECISION. Nothing
 * exploited that (every caller already re-derives its own session before calling this), but it sat
 * on the public network surface for no reason and violated the "no Server Action ever trusts a
 * client-supplied role/ownership claim" invariant by existing there at all. Living in a plain
 * module without `"use server"` means it can never be invoked directly over the network, full stop
 * — the only way to reach it is by importing it from server code that already re-derived its own
 * `viewer` session.
 */
export async function assertCanManageCourse(courseId: string, viewer: Session): Promise<void> {
  const [row] = await db
    .select({ instructorUserId: course.instructorUserId })
    .from(course)
    .where(eq(course.id, courseId));

  if (!row) throw new Error("Course not found.");

  if (viewer.role === "admin") return;
  if (viewer.role === "instructor" && row.instructorUserId === viewer.userId) return;

  throw new Error("Not authorized to manage this course.");
}

/**
 * Non-throwing wrapper around `assertCanManageCourse`, for call sites that want a boolean rather
 * than a try/catch — e.g. `queries.ts`'s `getLesson` (an admin/instructor preview bypass) and
 * `mutations.ts`'s `toggleLessonComplete` (an admin/instructor can mark a lesson complete in their
 * own unpublished course without first self-enrolling).
 */
export async function canManageCourse(courseId: string, viewer: Session): Promise<boolean> {
  try {
    await assertCanManageCourse(courseId, viewer);
    return true;
  } catch {
    return false;
  }
}

"use server";

import { and, eq, or } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { course, courseModule, enrollment, lesson, lessonProgress, userProfile } from "@/db/schema";
import { requireRole, requireUser } from "@/lib/session";
import { courseInputSchema, type CourseInput } from "@/lib/validation";
import { assertCanManageCourse, canManageCourse } from "./authz";
import { isEnrolled } from "./queries";

// `assertCanManageCourse`/`canManageCourse` used to live in this file, but this file has a
// top-of-file `"use server"` directive — every export here is a POST-reachable Server Action. That
// made the authorization DECISION function itself network-reachable (its second parameter is the
// `Session` the caller supplies), which is safe only as long as it never returns data and every
// caller re-derives its own session first — true today, but fragile to depend on forever. Both now
// live in `./authz`, a plain module with no `"use server"`, so they can never be invoked directly
// over the network. Deliberately NOT re-exported from here — a re-export from a `"use server"` file
// would put it right back on the network surface this fix removes it from. Every former importer
// of `assertCanManageCourse` from this file now imports it from `./authz` instead.

export type MutationResult = { ok: true } | { ok: false; message: string };

export async function createCourse(input: CourseInput): Promise<MutationResult> {
  const viewer = await requireRole("instructor", "admin");

  const parsed = courseInputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Invalid course." };
  }

  const instructorUserId = viewer.role === "instructor" ? viewer.userId : parsed.data.instructorUserId;

  const [existing] = await db.select({ id: course.id }).from(course).where(eq(course.slug, parsed.data.slug));
  if (existing) {
    return { ok: false, message: "That slug is already in use." };
  }

  // NOT wrapped in `db.transaction(...)` — `src/db/index.ts` connects via `drizzle-orm/neon-http`,
  // and that driver's `NeonHttpSession` throws `"No transactions support in neon-http driver"`
  // synchronously the moment `.transaction()` is called (confirmed against the compiled driver
  // during Task 9, `node_modules/drizzle-orm/neon-http/session.cjs`, not just its `.d.ts`). Every
  // insert below runs directly against `db`, sequentially; a crash mid-createCourse can leave an
  // orphaned course/module row, which is an accepted limitation of this driver for a low-volume
  // admin-authored write path, not something this task papers over.
  const [insertedCourse] = await db
    .insert(course)
    .values({
      slug: parsed.data.slug,
      title: parsed.data.title,
      description: parsed.data.description,
      category: parsed.data.category,
      level: parsed.data.level,
      status: "draft",
      instructorUserId,
    })
    .returning();

  for (const m of parsed.data.modules) {
    const [insertedModule] = await db
      .insert(courseModule)
      .values({ courseId: insertedCourse.id, title: m.title, position: m.position })
      .returning();

    for (const l of m.lessons) {
      await db.insert(lesson).values({
        moduleId: insertedModule.id,
        courseId: insertedCourse.id,
        slug: l.slug,
        title: l.title,
        content: l.content,
        position: l.position,
        isPreview: l.isPreview,
      });
    }
  }

  revalidatePath("/admin/courses");
  return { ok: true };
}

export async function updateCourse(courseId: string, input: CourseInput): Promise<MutationResult> {
  const viewer = await requireRole("instructor", "admin");
  await assertCanManageCourse(courseId, viewer);

  const parsed = courseInputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Invalid course." };
  }

  const [slugConflict] = await db
    .select({ id: course.id })
    .from(course)
    .where(eq(course.slug, parsed.data.slug));
  if (slugConflict && slugConflict.id !== courseId) {
    return { ok: false, message: "That slug is already in use." };
  }

  // Not wrapped in `db.transaction(...)` — same `neon-http` driver limitation as `createCourse`
  // above.
  await db
    .update(course)
    .set({
      title: parsed.data.title,
      slug: parsed.data.slug,
      description: parsed.data.description,
      category: parsed.data.category,
      level: parsed.data.level,
      updatedAt: new Date(),
    })
    .where(eq(course.id, courseId));

  // Reconcile modules/lessons in place instead of delete-and-reinsert. `lesson` carries a real
  // `unique(course_id, slug)` constraint (`src/db/schema/course.ts`) — a lesson sharing
  // (courseId, slug) with the submitted input IS that lesson, regardless of which module it's
  // nested under in the form, so updating it in place preserves its `id` and therefore every
  // `lesson_progress` row pointing at it. A delete-and-reinsert here would hand every lesson a
  // fresh UUID on ANY edit (even a pure title/description tweak) and cascade-delete every enrolled
  // learner's progress for the course — that was the bug this reconcile replaces.
  //
  // `course_module` has no equivalent unique constraint, so modules are matched on a best-effort
  // basis by (courseId, title). A module whose title changed is indistinguishable from "deleted
  // old module + new module" under this scheme — acceptable, since only lesson identity (via slug)
  // is load-bearing for progress data; module identity is not.
  //
  // Order matters, to avoid transient FK violations and to avoid deleting a lesson that's actually
  // being reparented:
  //   1. Resolve/create every submitted module FIRST, so every lesson below has a real `moduleId`
  //      to point at before any lesson row is touched.
  //   2. Reconcile every submitted lesson by (courseId, slug): UPDATE in place (preserving id) if
  //      a lesson with that slug already exists, INSERT if not.
  //   3. Only now delete lessons whose slug is no longer present in the submission at all (the
  //      admin genuinely removed them — cascading their `lesson_progress` rows is correct,
  //      expected behavior here, not a bug), then delete modules no submitted module matched. By
  //      the time step 3 deletes a stale module, every lesson that survived has already been
  //      reparented onto its (possibly new) module in step 2, and every lesson that didn't survive
  //      has already been deleted — so no lesson row still references a module about to be
  //      removed.
  const existingModules = await db
    .select({ id: courseModule.id, title: courseModule.title })
    .from(courseModule)
    .where(eq(courseModule.courseId, courseId));
  const existingLessons = await db
    .select({ id: lesson.id, slug: lesson.slug })
    .from(lesson)
    .where(eq(lesson.courseId, courseId));

  // Step 1: resolve/create modules.
  const usedModuleIds = new Set<string>();
  const moduleIdByIndex: string[] = [];
  for (const m of parsed.data.modules) {
    const match = existingModules.find((em) => !usedModuleIds.has(em.id) && em.title === m.title);
    if (match) {
      usedModuleIds.add(match.id);
      await db
        .update(courseModule)
        .set({ position: m.position, updatedAt: new Date() })
        .where(eq(courseModule.id, match.id));
      moduleIdByIndex.push(match.id);
    } else {
      const [inserted] = await db
        .insert(courseModule)
        .values({ courseId, title: m.title, position: m.position })
        .returning();
      moduleIdByIndex.push(inserted.id);
    }
  }

  // Step 2: reconcile lessons by (courseId, slug) identity.
  const existingLessonIdBySlug = new Map(existingLessons.map((l) => [l.slug, l.id]));
  const submittedSlugs = new Set<string>();
  for (const [i, m] of parsed.data.modules.entries()) {
    const moduleId = moduleIdByIndex[i];
    for (const l of m.lessons) {
      submittedSlugs.add(l.slug);
      const existingLessonId = existingLessonIdBySlug.get(l.slug);
      if (existingLessonId) {
        await db
          .update(lesson)
          .set({
            moduleId,
            title: l.title,
            content: l.content,
            position: l.position,
            isPreview: l.isPreview,
            updatedAt: new Date(),
          })
          .where(eq(lesson.id, existingLessonId));
      } else {
        await db.insert(lesson).values({
          moduleId,
          courseId,
          slug: l.slug,
          title: l.title,
          content: l.content,
          position: l.position,
          isPreview: l.isPreview,
        });
      }
    }
  }

  // Step 3: delete now-absent lessons first, then now-orphaned modules.
  for (const existing of existingLessons) {
    if (!submittedSlugs.has(existing.slug)) {
      await db.delete(lesson).where(eq(lesson.id, existing.id));
    }
  }
  for (const em of existingModules) {
    if (!usedModuleIds.has(em.id)) {
      await db.delete(courseModule).where(eq(courseModule.id, em.id));
    }
  }

  revalidatePath("/admin/courses");
  revalidatePath(`/courses/${parsed.data.slug}`);
  return { ok: true };
}

export async function publishCourse(courseId: string): Promise<MutationResult> {
  return setStatus(courseId, "published");
}

export async function unpublishCourse(courseId: string): Promise<MutationResult> {
  return setStatus(courseId, "draft");
}

async function setStatus(courseId: string, status: "published" | "draft"): Promise<MutationResult> {
  const viewer = await requireRole("instructor", "admin");
  await assertCanManageCourse(courseId, viewer);

  await db.update(course).set({ status, updatedAt: new Date() }).where(eq(course.id, courseId));
  revalidatePath("/admin/courses");
  return { ok: true };
}

export async function deleteCourse(courseId: string): Promise<MutationResult> {
  const viewer = await requireRole("instructor", "admin");
  await assertCanManageCourse(courseId, viewer);

  await db.delete(course).where(eq(course.id, courseId)); // CASCADE handles modules/lessons/enrollments/progress
  revalidatePath("/admin/courses");
  return { ok: true };
}

export async function listInstructors(): Promise<{ userId: string; name: string }[]> {
  await requireRole("admin");
  const rows = await db
    .select({ userId: userProfile.userId, name: userProfile.name })
    .from(userProfile)
    .where(or(eq(userProfile.role, "instructor"), eq(userProfile.role, "admin")));
  return rows;
}

export async function enrollInCourse(courseSlug: string): Promise<MutationResult> {
  const viewer = await requireUser();

  const [row] = await db.select({ id: course.id }).from(course).where(eq(course.slug, courseSlug));
  if (!row) return { ok: false, message: "Course not found." };

  await db.insert(enrollment).values({ courseId: row.id, userId: viewer.userId }).onConflictDoNothing();

  revalidatePath(`/courses/${courseSlug}`);
  revalidatePath("/dashboard");
  return { ok: true };
}

export type ToggleLessonCompleteResult =
  | { ok: true; complete: boolean }
  | { ok: false; message: string };

export async function toggleLessonComplete(lessonId: string): Promise<ToggleLessonCompleteResult> {
  const viewer = await requireUser();

  const [lessonRow] = await db
    .select({ courseId: lesson.courseId })
    .from(lesson)
    .where(eq(lesson.id, lessonId));
  if (!lessonRow) return { ok: false, message: "Lesson not found." };

  // Every sibling mutation in this file gates on `isEnrolled`/`canManageCourse` — this is the one
  // write that didn't: without this check, any signed-in user could write a `lesson_progress` row
  // for a lesson in a course they're not enrolled in (including unpublished drafts), since nothing
  // here previously checked enrollment or course ownership.
  const allowed =
    (await isEnrolled(lessonRow.courseId, viewer.userId)) ||
    (await canManageCourse(lessonRow.courseId, viewer));
  if (!allowed) {
    return { ok: false, message: "Not authorized to update this lesson." };
  }

  const [existing] = await db
    .select({ id: lessonProgress.id })
    .from(lessonProgress)
    .where(and(eq(lessonProgress.lessonId, lessonId), eq(lessonProgress.userId, viewer.userId)));

  if (existing) {
    await db.delete(lessonProgress).where(eq(lessonProgress.id, existing.id));
    revalidatePath("/dashboard");
    return { ok: true, complete: false };
  }

  await db.insert(lessonProgress).values({ lessonId, userId: viewer.userId }).onConflictDoNothing();
  revalidatePath("/dashboard");
  return { ok: true, complete: true };
}

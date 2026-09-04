"use server";

import { eq, or } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { course, courseModule, lesson, userProfile } from "@/db/schema";
import { requireRole, type Session } from "@/lib/session";
import { courseInputSchema, type CourseInput } from "@/lib/validation";

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

  // Replace modules/lessons wholesale — simpler and correct for admin-form-sized courses,
  // where reconciling a diff against reordered/renamed rows isn't worth the complexity.
  await db.delete(courseModule).where(eq(courseModule.courseId, courseId));

  for (const m of parsed.data.modules) {
    const [insertedModule] = await db
      .insert(courseModule)
      .values({ courseId, title: m.title, position: m.position })
      .returning();

    for (const l of m.lessons) {
      await db.insert(lesson).values({
        moduleId: insertedModule.id,
        courseId,
        slug: l.slug,
        title: l.title,
        content: l.content,
        position: l.position,
        isPreview: l.isPreview,
      });
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

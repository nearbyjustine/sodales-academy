import "server-only";
import { eq, and, or, ilike, asc, inArray } from "drizzle-orm";
import { db } from "@/db";
import { course, courseModule, enrollment, lesson, lessonProgress, userProfile } from "@/db/schema";
import type { Session } from "@/lib/session";
import { assertCanManageCourse } from "./mutations";
import type { CourseDetail, CourseModule, CourseSummary, Lesson, Level } from "./types";

export type LessonRef = { courseSlug: string; slug: string; title: string };

export type LessonWithNav = Lesson & {
  course: CourseSummary;
  modules: CourseModule[];
  prev: LessonRef | null;
  next: LessonRef | null;
};

/**
 * PHASE 2 SEAM — real implementation. Signatures unchanged from Phase 1.
 */

export async function getCourses(
  filters: { q?: string; level?: Level } = {},
): Promise<CourseSummary[]> {
  const conditions = [eq(course.status, "published")];
  if (filters.level) conditions.push(eq(course.level, filters.level));

  const q = filters.q?.trim();
  const rows = await db
    .select()
    .from(course)
    .where(
      q
        ? and(...conditions, or(ilike(course.title, `%${q}%`), ilike(course.description, `%${q}%`)))
        : and(...conditions),
    );

  const withCounts = await Promise.all(rows.map((r) => toSummaryWithCount(r)));
  return withCounts;
}

export async function getCourseBySlug(slug: string): Promise<CourseDetail | null> {
  const [row] = await db.select().from(course).where(eq(course.slug, slug));
  if (!row || row.status !== "published") return null;
  return toDetail(row);
}

/**
 * Status-agnostic variant of `getCourseBySlug` for admin use (e.g. the course edit page), where a
 * draft course must remain visible to whoever can manage it. `getCourseBySlug` itself stays
 * published-only — the public catalog/lesson pages must never surface a draft.
 */
export async function getCourseBySlugForAdmin(slug: string): Promise<CourseDetail | null> {
  const [row] = await db.select().from(course).where(eq(course.slug, slug));
  if (!row) return null;
  return toDetail(row);
}

export async function getAllCourses(): Promise<CourseSummary[]> {
  const rows = await db.select().from(course);
  return Promise.all(rows.map((r) => toSummaryWithCount(r)));
}

export async function getLesson(
  courseSlug: string,
  lessonSlug: string,
  viewer: Session | null,
): Promise<LessonWithNav | null> {
  const detail = await getCourseBySlug(courseSlug);
  if (!detail) return null;

  const flat = detail.modules.flatMap((m) => m.lessons);
  const index = flat.findIndex((l) => l.slug === lessonSlug);
  if (index === -1) return null;

  const target = flat[index];
  const canAccess =
    target.isPreview ||
    (viewer !== null &&
      ((await isEnrolled(detail.id, viewer.userId)) || (await canManageCourse(detail.id, viewer))));

  if (!canAccess) return null;

  const { modules: _modules, ...summary } = detail;

  return {
    ...target,
    course: summary,
    // `modules` backs the client-rendered lesson sidebar (title/slug/isPreview only — see
    // `LessonSidebar`), which never needs any lesson's body text. `canAccess` above only gates the
    // *target* lesson's own `content`; without stripping it here too, every other lesson's full
    // content — including non-preview ones the viewer was never checked against — would ride along
    // in this array and get serialized into the client component's RSC payload regardless.
    modules: withoutLessonContent(detail.modules),
    prev: index > 0 ? toRef(flat[index - 1]) : null,
    next: index < flat.length - 1 ? toRef(flat[index + 1]) : null,
  };
}

/**
 * Wraps `assertCanManageCourse` (Task 9, `./mutations`) as a boolean check: it throws on failure
 * rather than returning one. Reusing it here (spec §8: "Draft visibility, edit, publish/unpublish,
 * delete, and lesson access all reuse this same rule") lets an admin or the course's own instructor
 * open a non-preview lesson for review/authoring without first self-enrolling.
 */
async function canManageCourse(courseId: string, viewer: Session): Promise<boolean> {
  try {
    await assertCanManageCourse(courseId, viewer);
    return true;
  } catch {
    return false;
  }
}

function withoutLessonContent(modules: CourseModule[]): CourseModule[] {
  return modules.map((m) => ({
    ...m,
    lessons: m.lessons.map((l) => ({ ...l, content: "" })),
  }));
}

export async function getCatalogStats(): Promise<{
  courses: number;
  lessons: number;
  categories: number;
}> {
  const published = await db.select().from(course).where(eq(course.status, "published"));
  const counts = await Promise.all(published.map((c) => countLessons(c.id)));

  return {
    courses: published.length,
    lessons: counts.reduce((sum, n) => sum + n, 0),
    categories: new Set(published.map((c) => c.category)).size,
  };
}

export async function isEnrolled(courseId: string, userId: string): Promise<boolean> {
  const [row] = await db
    .select({ id: enrollment.id })
    .from(enrollment)
    .where(and(eq(enrollment.courseId, courseId), eq(enrollment.userId, userId)));
  return Boolean(row);
}

export async function getCompletedLessonIds(
  userId: string,
  lessonIds: string[],
): Promise<Set<string>> {
  if (lessonIds.length === 0) return new Set();

  const rows = await db
    .select({ lessonId: lessonProgress.lessonId })
    .from(lessonProgress)
    .where(and(eq(lessonProgress.userId, userId), inArray(lessonProgress.lessonId, lessonIds)));

  return new Set(rows.map((r) => r.lessonId));
}

async function countLessons(courseId: string): Promise<number> {
  const rows = await db.select({ id: lesson.id }).from(lesson).where(eq(lesson.courseId, courseId));
  return rows.length;
}

async function resolveInstructorName(instructorUserId: string): Promise<string> {
  const [profile] = await db
    .select({ name: userProfile.name })
    .from(userProfile)
    .where(eq(userProfile.userId, instructorUserId));
  return profile?.name ?? "Unknown instructor";
}

async function toSummaryWithCount(row: typeof course.$inferSelect): Promise<CourseSummary> {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    description: row.description,
    category: row.category,
    level: row.level,
    status: row.status,
    instructorName: await resolveInstructorName(row.instructorUserId),
    lessonCount: await countLessons(row.id),
  };
}

async function toDetail(row: typeof course.$inferSelect): Promise<CourseDetail> {
  const summary = await toSummaryWithCount(row);
  const modules = await db
    .select()
    .from(courseModule)
    .where(eq(courseModule.courseId, row.id))
    .orderBy(asc(courseModule.position));

  const modulesWithLessons: CourseModule[] = await Promise.all(
    modules.map(async (m) => {
      const lessons = await db
        .select()
        .from(lesson)
        .where(eq(lesson.moduleId, m.id))
        .orderBy(asc(lesson.position));

      return {
        id: m.id,
        title: m.title,
        position: m.position,
        lessons: lessons.map((l) => ({
          id: l.id,
          courseSlug: row.slug,
          slug: l.slug,
          title: l.title,
          moduleTitle: m.title,
          position: l.position,
          isPreview: l.isPreview,
          content: l.content,
        })),
      };
    }),
  );

  return { ...summary, modules: modulesWithLessons };
}

function toRef(lesson: Lesson): LessonRef {
  return { courseSlug: lesson.courseSlug, slug: lesson.slug, title: lesson.title };
}

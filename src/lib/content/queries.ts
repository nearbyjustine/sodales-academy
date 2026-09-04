import "server-only";
import { eq, and, or, ilike, asc } from "drizzle-orm";
import { db } from "@/db";
import { course, courseModule, lesson, userProfile } from "@/db/schema";
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

export async function getAllCourses(): Promise<CourseSummary[]> {
  const rows = await db.select().from(course);
  return Promise.all(rows.map((r) => toSummaryWithCount(r)));
}

export async function getLesson(
  courseSlug: string,
  lessonSlug: string,
): Promise<LessonWithNav | null> {
  const detail = await getCourseBySlug(courseSlug);
  if (!detail) return null;

  const flat = detail.modules.flatMap((m) => m.lessons);
  const index = flat.findIndex((l) => l.slug === lessonSlug);
  if (index === -1) return null;

  const { modules, ...summary } = detail;

  return {
    ...flat[index],
    course: summary,
    modules,
    prev: index > 0 ? toRef(flat[index - 1]) : null,
    next: index < flat.length - 1 ? toRef(flat[index + 1]) : null,
  };
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

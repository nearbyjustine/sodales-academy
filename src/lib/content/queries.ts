import "server-only";
import { loadAllCourses } from "./loader";
import type { CourseDetail, CourseModule, CourseSummary, Lesson, Level } from "./types";

export type LessonRef = { courseSlug: string; slug: string; title: string };

export type LessonWithNav = Lesson & {
  course: CourseSummary;
  modules: CourseModule[];
  prev: LessonRef | null;
  next: LessonRef | null;
};

/**
 * PHASE 2 SEAM.
 *
 * These four functions are the entire data interface of the app. In Phase 1 they
 * read Markdown from disk; in Phase 2 they run SQL against Neon. Their signatures
 * must not change. No page or component may bypass them.
 */

export async function getCourses(
  filters: { q?: string; level?: Level } = {},
): Promise<CourseSummary[]> {
  const published = (await loadAllCourses()).filter((c) => c.status === "published");
  const q = filters.q?.trim().toLowerCase();

  return published
    .filter((course) => (filters.level ? course.level === filters.level : true))
    .filter((course) => {
      if (!q) return true;
      return (
        course.title.toLowerCase().includes(q) ||
        course.description.toLowerCase().includes(q) ||
        course.category.toLowerCase().includes(q)
      );
    })
    .map(toSummary);
}

export async function getCourseBySlug(slug: string): Promise<CourseDetail | null> {
  const course = (await loadAllCourses()).find((c) => c.slug === slug);
  if (!course || course.status !== "published") return null;
  return course;
}

export async function getLesson(
  courseSlug: string,
  lessonSlug: string,
): Promise<LessonWithNav | null> {
  const course = await getCourseBySlug(courseSlug);
  if (!course) return null;

  const flat = course.modules.flatMap((m) => m.lessons);
  const index = flat.findIndex((l) => l.slug === lessonSlug);
  if (index === -1) return null;

  return {
    ...flat[index],
    course: toSummary(course),
    modules: course.modules,
    prev: index > 0 ? toRef(flat[index - 1]) : null,
    next: index < flat.length - 1 ? toRef(flat[index + 1]) : null,
  };
}

export async function getCatalogStats(): Promise<{
  courses: number;
  lessons: number;
  categories: number;
}> {
  const published = (await loadAllCourses()).filter((c) => c.status === "published");
  return {
    courses: published.length,
    lessons: published.reduce((sum, c) => sum + c.lessonCount, 0),
    categories: new Set(published.map((c) => c.category)).size,
  };
}

/** Admin-only: every course regardless of status. Public pages must use getCourses. */
export async function getAllCourses(): Promise<CourseSummary[]> {
  return (await loadAllCourses()).map(toSummary);
}

function toSummary(course: CourseDetail): CourseSummary {
  return {
    id: course.id,
    slug: course.slug,
    title: course.title,
    description: course.description,
    category: course.category,
    level: course.level,
    status: course.status,
    instructorName: course.instructorName,
    lessonCount: course.lessonCount,
  };
}

function toRef(lesson: Lesson): LessonRef {
  return { courseSlug: lesson.courseSlug, slug: lesson.slug, title: lesson.title };
}

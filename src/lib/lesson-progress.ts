import type { CourseModule, Lesson } from "@/lib/content/types";

/**
 * Pure, framework-agnostic helpers over server-fetched completion data. No `localStorage`, no
 * hooks — importable from both Server Components (course detail page) and presentational
 * components (`EnrolledCourseCard`) alike, which is why this lives outside `content/queries.ts`
 * (that file is `import "server-only"`) and outside any client-only module.
 */

/**
 * The lesson a "Continue learning" / "Start learning" CTA should link to: the first incomplete
 * lesson in module/position order, or the first lesson overall if every lesson is complete (or
 * the course has none). Returns `null` only when the course has no lessons at all.
 */
export function firstIncompleteLesson(
  modules: CourseModule[],
  completedLessonIds: Set<string> | string[],
): Lesson | null {
  const lessons = modules.flatMap((m) => m.lessons);
  if (lessons.length === 0) return null;

  const completed =
    completedLessonIds instanceof Set ? completedLessonIds : new Set(completedLessonIds);

  return lessons.find((l) => !completed.has(l.id)) ?? lessons[0];
}

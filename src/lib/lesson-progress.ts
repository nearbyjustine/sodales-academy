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

export type CourseProgress = {
  completedLessons: number;
  totalLessons: number;
  /** 0–100, rounded. 0 when the course has no lessons at all. */
  percent: number;
  /** A course counts as finished only once it has lessons AND all of them are complete — the
   *  same rule `track-progress.ts`'s `isComplete` applies at the track level. A lessonless
   *  course is not "finished"; there is nothing there to finish. */
  isComplete: boolean;
};

/**
 * Derives percent-complete and the "finished" predicate for a single course from a lesson count
 * and a completed-lesson count. Takes counts rather than lesson objects or ids because callers
 * arrive with different shapes — full `CourseModule[]` (`EnrolledCourseCard`), a flattened id
 * array (`LessonSidebar`), or counts already resolved from a query (`DashboardPage`) — and
 * counting is the one step every caller can only do for itself; the maths that must not drift
 * (rounding, the divide-by-zero guard, the over-100% clamp, and the finished predicate) is
 * centralized here instead.
 */
export function courseProgress(totalLessons: number, completedLessons: number): CourseProgress {
  // Clamp: a stale or duplicated progress row must never report more done than exist, which
  // would push percent above 100 (mirrors the same guard in track-progress.ts).
  const completed = Math.min(completedLessons, totalLessons);

  return {
    completedLessons: completed,
    totalLessons,
    percent: totalLessons === 0 ? 0 : Math.round((completed / totalLessons) * 100),
    isComplete: totalLessons > 0 && completed >= totalLessons,
  };
}

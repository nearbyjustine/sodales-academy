import type { TrackCourse } from "@/lib/content/types";

/**
 * Pure, framework-agnostic derivation over server-fetched track data — the same
 * contract as `lesson-progress.ts`. No database access and no hooks, so it is
 * importable from Server Components and presentational components alike, and
 * testable without a database.
 */

export type TrackProgress = {
  completedLessons: number;
  totalLessons: number;
  /** 0–100, rounded. 0 when the track has no lessons at all. */
  percent: number;
  completedCourses: number;
  totalCourses: number;
  /** The single unambiguous "continue here". Null when nothing is left to do. */
  nextCourse: TrackCourse | null;
};

/** A course counts only once it has lessons AND all of them are complete. A
 *  lessonless course is not "finished" — there is nothing there to finish.
 *  Exported so `TrackMap`'s "Done" badge uses the exact same rule as the
 *  progress bar above it instead of a hand-copied inline expression that
 *  could quietly drift from this one. */
export function isComplete(c: TrackCourse): boolean {
  return c.lessonCount > 0 && c.completedLessonCount >= c.lessonCount;
}

export function trackProgress(courses: TrackCourse[]): TrackProgress {
  const ordered = [...courses].sort((a, b) => a.position - b.position);

  const totalLessons = ordered.reduce((n, c) => n + c.lessonCount, 0);
  const completedLessons = ordered.reduce(
    // Clamp: a stale or duplicated progress row must never report more done
    // than exist, which would push percent above 100.
    (n, c) => n + Math.min(c.completedLessonCount, c.lessonCount),
    0,
  );

  return {
    completedLessons,
    totalLessons,
    percent: totalLessons === 0 ? 0 : Math.round((completedLessons / totalLessons) * 100),
    completedCourses: ordered.filter(isComplete).length,
    totalCourses: ordered.length,
    nextCourse: ordered.find((c) => c.lessonCount > 0 && !isComplete(c)) ?? null,
  };
}

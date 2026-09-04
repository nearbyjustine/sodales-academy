/**
 * These types mirror the Phase 2 database schema in docs/02-academy.md §9
 * field for field, including fields Phase 1 does not yet use (status, isPreview).
 * Do not "simplify" them — Phase 2 swaps the loader, not these shapes.
 */

export type Level = "beginner" | "intermediate" | "advanced";
export type CourseStatus = "draft" | "published";

export type Lesson = {
  id: string;
  courseSlug: string;
  slug: string;
  title: string;
  moduleTitle: string;
  position: number;
  isPreview: boolean;
  content: string;
};

export type CourseModule = {
  id: string;
  title: string;
  position: number;
  lessons: Lesson[];
};

export type CourseSummary = {
  id: string;
  slug: string;
  title: string;
  description: string;
  category: string;
  level: Level;
  status: CourseStatus;
  instructorName: string;
  lessonCount: number;
};

export type CourseDetail = CourseSummary & {
  modules: CourseModule[];
};

export const LEVELS: Level[] = ["beginner", "intermediate", "advanced"];

export type TrackStatus = "draft" | "published";

export type TrackSummary = {
  id: string;
  slug: string;
  title: string;
  promise: string;
  outcome: string;
  status: TrackStatus;
  position: number;
  courseCount: number;
  /** Total lessons across every course in the track. */
  lessonCount: number;
};

/** A course as it appears inside a track: its normal summary, plus position and
 *  the viewer's completion. `completedLessonCount` is 0 for a signed-out viewer. */
export type TrackCourse = CourseSummary & {
  position: number;
  completedLessonCount: number;
};

export type TrackDetail = TrackSummary & {
  courses: TrackCourse[];
};

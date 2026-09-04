import { describe, it, expect } from "vitest";
import { trackProgress } from "./track-progress";
import type { TrackCourse } from "@/lib/content/types";

function makeCourse(overrides: Partial<TrackCourse> & { slug: string }): TrackCourse {
  return {
    id: overrides.slug,
    slug: overrides.slug,
    title: overrides.slug,
    description: "",
    category: "Testing",
    level: "beginner",
    status: "published",
    instructorName: "Someone",
    lessonCount: 0,
    position: 0,
    completedLessonCount: 0,
    ...overrides,
  };
}

describe("trackProgress", () => {
  it("reports zero for an empty track", () => {
    expect(trackProgress([])).toEqual({
      completedLessons: 0,
      totalLessons: 0,
      percent: 0,
      completedCourses: 0,
      totalCourses: 0,
      nextCourse: null,
    });
  });

  it("sums lessons across courses and rounds the percentage", () => {
    const result = trackProgress([
      makeCourse({ slug: "a", lessonCount: 4, completedLessonCount: 4, position: 0 }),
      makeCourse({ slug: "b", lessonCount: 5, completedLessonCount: 1, position: 1 }),
    ]);

    expect(result.completedLessons).toBe(5);
    expect(result.totalLessons).toBe(9);
    expect(result.percent).toBe(56); // 5/9 = 55.55… → 56
    expect(result.completedCourses).toBe(1);
    expect(result.totalCourses).toBe(2);
    expect(result.nextCourse?.slug).toBe("b");
  });

  it("has no next course when every course is finished", () => {
    const result = trackProgress([
      makeCourse({ slug: "a", lessonCount: 2, completedLessonCount: 2, position: 0 }),
    ]);

    expect(result.percent).toBe(100);
    expect(result.nextCourse).toBeNull();
  });

  it("never divides by zero when a track has courses but no lessons", () => {
    const result = trackProgress([makeCourse({ slug: "a", lessonCount: 0, position: 0 })]);
    expect(result.percent).toBe(0);
  });

  it("treats a lessonless course as neither complete nor next", () => {
    // A course with no lessons yet must not inflate completedCourses (0 === 0 is
    // technically "all done") and must not be offered as the next thing to do,
    // because there is nothing there to do.
    const result = trackProgress([
      makeCourse({ slug: "empty", lessonCount: 0, position: 0 }),
      makeCourse({ slug: "real", lessonCount: 3, completedLessonCount: 0, position: 1 }),
    ]);

    expect(result.completedCourses).toBe(0);
    expect(result.nextCourse?.slug).toBe("real");
  });

  it("picks the next course by position, not array order", () => {
    const result = trackProgress([
      makeCourse({ slug: "second", lessonCount: 2, completedLessonCount: 0, position: 1 }),
      makeCourse({ slug: "first", lessonCount: 2, completedLessonCount: 0, position: 0 }),
    ]);

    expect(result.nextCourse?.slug).toBe("first");
  });
});

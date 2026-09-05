import { describe, it, expect } from "vitest";
import { courseProgress } from "./lesson-progress";

describe("courseProgress", () => {
  it("reports zero for a course with no lessons", () => {
    expect(courseProgress(0, 0)).toEqual({
      completedLessons: 0,
      totalLessons: 0,
      percent: 0,
      isComplete: false,
    });
  });

  it("rounds the percentage", () => {
    const result = courseProgress(9, 5);
    expect(result.percent).toBe(56); // 5/9 = 55.55… → 56
  });

  it("is complete only when every lesson is done", () => {
    expect(courseProgress(4, 4).isComplete).toBe(true);
    expect(courseProgress(4, 3).isComplete).toBe(false);
  });

  it("treats a lessonless course as not complete", () => {
    // 0 === 0 is technically "all done"; a course with no lessons yet must not read as
    // finished, because there is nothing there to finish.
    expect(courseProgress(0, 0).isComplete).toBe(false);
  });

  it("clamps completedLessons and percent when completed exceeds total", () => {
    const result = courseProgress(3, 99);
    expect(result.completedLessons).toBe(3);
    expect(result.percent).toBe(100);
    expect(result.isComplete).toBe(true);
  });

  it("never divides by zero when total is 0 but a stale completed count is passed", () => {
    expect(courseProgress(0, 5).percent).toBe(0);
  });
});

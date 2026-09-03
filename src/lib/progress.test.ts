import { describe, it, expect, beforeEach } from "vitest";
import {
  PROGRESS_STORAGE_KEY,
  getCompletedLessonIds,
  isLessonComplete,
  toggleLessonComplete,
  getCourseProgress,
  resetProgress,
} from "./progress";

beforeEach(() => {
  window.localStorage.clear();
});

describe("seeding", () => {
  it("seeds from the demo enrollments on first read", () => {
    const ids = getCompletedLessonIds();
    expect(ids.has("landing-your-first-client/why-nobody-replies")).toBe(true);
    expect(ids.has("pricing-and-proposals/hourly-vs-fixed")).toBe(false);
  });

  it("does not re-seed once a value exists", () => {
    window.localStorage.setItem(PROGRESS_STORAGE_KEY, JSON.stringify([]));
    expect(getCompletedLessonIds().size).toBe(0);
  });
});

describe("toggleLessonComplete", () => {
  it("marks an incomplete lesson complete and persists it", () => {
    const id = "pricing-and-proposals/hourly-vs-fixed";
    expect(toggleLessonComplete(id)).toBe(true);
    expect(isLessonComplete(id)).toBe(true);

    const stored = JSON.parse(window.localStorage.getItem(PROGRESS_STORAGE_KEY)!);
    expect(stored).toContain(id);
  });

  it("unmarks a complete lesson", () => {
    const id = "landing-your-first-client/why-nobody-replies";
    expect(toggleLessonComplete(id)).toBe(false);
    expect(isLessonComplete(id)).toBe(false);
  });
});

describe("getCourseProgress", () => {
  it("computes completed, total, and percent", () => {
    const lessonIds = [
      "web-development-foundations/how-the-web-works",
      "web-development-foundations/html-structure",
      "web-development-foundations/css-layout",
      "web-development-foundations/responsive-design",
    ];
    expect(getCourseProgress("web-development-foundations", lessonIds)).toEqual({
      completed: 2,
      total: 4,
      percent: 50,
    });
  });

  it("returns 0 percent for a course with no lessons rather than dividing by zero", () => {
    expect(getCourseProgress("empty", [])).toEqual({ completed: 0, total: 0, percent: 0 });
  });

  it("rounds percent to a whole number", () => {
    const lessonIds = ["a", "b", "c"];
    toggleLessonComplete("a");
    expect(getCourseProgress("x", lessonIds).percent).toBe(33);
  });
});

describe("resetProgress", () => {
  it("clears storage and re-seeds on the next read", () => {
    toggleLessonComplete("pricing-and-proposals/hourly-vs-fixed");
    resetProgress();
    const ids = getCompletedLessonIds();
    expect(ids.has("pricing-and-proposals/hourly-vs-fixed")).toBe(false);
    expect(ids.has("landing-your-first-client/why-nobody-replies")).toBe(true);
  });
});

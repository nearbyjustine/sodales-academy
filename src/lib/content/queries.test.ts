import { describe, it, expect } from "vitest";
import { getCourses, getCourseBySlug, getLesson, getCatalogStats } from "./queries";

describe("getCourses", () => {
  it("returns only published courses", async () => {
    const courses = await getCourses();
    expect(courses).toHaveLength(4);
    expect(courses.some((c) => c.slug === "test-fixture-course")).toBe(false);
  });

  it("filters by level", async () => {
    const courses = await getCourses({ level: "intermediate" });
    expect(courses.map((c) => c.slug).sort()).toEqual([
      "brand-identity-essentials",
      "pricing-and-proposals",
    ]);
  });

  it("matches the search term against title and description, case-insensitively", async () => {
    const courses = await getCourses({ q: "PROPOSAL" });
    expect(courses.map((c) => c.slug)).toContain("pricing-and-proposals");
  });

  it("returns an empty array when nothing matches", async () => {
    expect(await getCourses({ q: "zzzznotacourse" })).toEqual([]);
  });

  it("combines search and level filters", async () => {
    const courses = await getCourses({ q: "client", level: "advanced" });
    expect(courses).toEqual([]);
  });
});

describe("getCourseBySlug", () => {
  it("returns a published course with its modules", async () => {
    const course = await getCourseBySlug("landing-your-first-client");
    expect(course).not.toBeNull();
    expect(course!.modules.length).toBeGreaterThan(0);
    expect(course!.lessonCount).toBe(5);
  });

  it("returns null for a draft course", async () => {
    expect(await getCourseBySlug("test-fixture-course")).toBeNull();
  });

  it("returns null for an unknown slug", async () => {
    expect(await getCourseBySlug("nope")).toBeNull();
  });
});

describe("getLesson", () => {
  it("returns the lesson with its course and navigation", async () => {
    const lesson = await getLesson("landing-your-first-client", "where-clients-actually-are");
    expect(lesson).not.toBeNull();
    expect(lesson!.course.slug).toBe("landing-your-first-client");
    expect(lesson!.prev!.slug).toBe("why-nobody-replies");
    expect(lesson!.next!.slug).toBe("the-first-message");
  });

  it("has no prev on the first lesson and no next on the last", async () => {
    const first = await getLesson("landing-your-first-client", "why-nobody-replies");
    expect(first!.prev).toBeNull();

    const last = await getLesson("landing-your-first-client", "closing-without-being-pushy");
    expect(last!.next).toBeNull();
  });

  it("returns null for a lesson in a draft course", async () => {
    expect(await getLesson("test-fixture-course", "first-lesson")).toBeNull();
  });

  it("returns null for an unknown lesson", async () => {
    expect(await getLesson("landing-your-first-client", "nope")).toBeNull();
  });
});

describe("getCatalogStats", () => {
  it("counts published courses, their lessons, and distinct categories", async () => {
    const stats = await getCatalogStats();
    expect(stats.courses).toBe(4);
    expect(stats.lessons).toBe(19);
    expect(stats.categories).toBe(3);
  });
});

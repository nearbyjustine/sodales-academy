import { describe, it, expect } from "vitest";
import { loadAllCourses } from "./loader";

describe("loadAllCourses", () => {
  it("parses course frontmatter into a CourseDetail", async () => {
    const courses = await loadAllCourses();
    const fixture = courses.find((c) => c.slug === "test-fixture-course");

    expect(fixture).toBeDefined();
    expect(fixture!.title).toBe("Test Fixture Course");
    expect(fixture!.level).toBe("beginner");
    expect(fixture!.status).toBe("draft");
    expect(fixture!.instructorName).toBe("Test Instructor");
  });

  it("groups lessons under their module and keeps file order", async () => {
    const courses = await loadAllCourses();
    const fixture = courses.find((c) => c.slug === "test-fixture-course")!;

    expect(fixture.modules).toHaveLength(1);
    expect(fixture.modules[0].title).toBe("Getting Started");
    expect(fixture.modules[0].lessons[0].slug).toBe("first-lesson");
    expect(fixture.modules[0].lessons[0].position).toBe(1);
    expect(fixture.modules[0].lessons[0].isPreview).toBe(true);
  });

  it("strips the numeric prefix from the lesson slug", async () => {
    const courses = await loadAllCourses();
    const fixture = courses.find((c) => c.slug === "test-fixture-course")!;
    expect(fixture.modules[0].lessons[0].slug).not.toContain("01-");
  });

  it("keeps the Markdown body as raw content", async () => {
    const courses = await loadAllCourses();
    const fixture = courses.find((c) => c.slug === "test-fixture-course")!;
    expect(fixture.modules[0].lessons[0].content).toContain("**first**");
  });

  it("counts lessons across all modules", async () => {
    const courses = await loadAllCourses();
    const fixture = courses.find((c) => c.slug === "test-fixture-course")!;
    expect(fixture.lessonCount).toBe(1);
  });
});

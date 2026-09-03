import { describe, it, expect } from "vitest";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import os from "node:os";
import path from "node:path";
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

  it("loads all four published courses plus the draft fixture", async () => {
    const courses = await loadAllCourses();
    const published = courses.filter((c) => c.status === "published");
    expect(published).toHaveLength(4);
    expect(published.map((c) => c.slug).sort()).toEqual([
      "brand-identity-essentials",
      "landing-your-first-client",
      "pricing-and-proposals",
      "web-development-foundations",
    ]);
  });

  it("every lesson has a non-trivial body", async () => {
    const courses = await loadAllCourses();
    const lessons = courses
      .filter((c) => c.status === "published")
      .flatMap((c) => c.modules.flatMap((m) => m.lessons));

    expect(lessons).toHaveLength(19);
    for (const lesson of lessons) {
      expect(lesson.content.length).toBeGreaterThan(400);
    }
  });

  it("rejects an invalid level with its course frontmatter field", async () => {
    await withTemporaryCourse({ level: "expert", status: "published" }, async (slug, root) => {
      await expect(loadAllCourses(root)).rejects.toThrow(
        `Invalid level — ${slug}/course.md: level`,
      );
    });
  });

  it("rejects an invalid status with its course frontmatter field", async () => {
    await withTemporaryCourse({ level: "beginner", status: "archived" }, async (slug, root) => {
      await expect(loadAllCourses(root)).rejects.toThrow(
        `Invalid status — ${slug}/course.md: status`,
      );
    });
  });
});

// Isolated from content/courses/ — loadAllCourses() scans that directory for
// the real app and for queries.test.ts concurrently; writing temporary fixtures
// there would race those reads.
async function withTemporaryCourse(
  frontmatter: { level: string; status: string },
  run: (slug: string, root: string) => Promise<void>,
): Promise<void> {
  const slug = `invalid-course-${randomUUID()}`;
  const root = await mkdtemp(path.join(os.tmpdir(), "academy-loader-test-"));
  const directory = path.join(root, slug);

  await mkdir(directory);

  try {
    await writeFile(
      path.join(directory, "course.md"),
      `---
title: Invalid Course
description: A temporary invalid course fixture.
category: Testing
level: ${frontmatter.level}
status: ${frontmatter.status}
instructorName: Test Instructor
---
`,
    );

    await run(slug, root);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { course, courseModule, lesson, userProfile } from "@/db/schema";
import { getCourses, getCourseBySlug, getLesson, getCatalogStats } from "./queries";

const TEST_INSTRUCTOR = "test-instructor-id";

beforeAll(async () => {
  await db
    .insert(userProfile)
    .values({ userId: TEST_INSTRUCTOR, name: "Test Instructor", role: "instructor" })
    .onConflictDoNothing();

  const [publishedCourse] = await db
    .insert(course)
    .values({
      slug: "queries-test-course",
      title: "Queries Test Course",
      description: "A course that exists only for this test file.",
      category: "Testing",
      level: "beginner",
      status: "published",
      instructorUserId: TEST_INSTRUCTOR,
    })
    .returning();

  await db
    .insert(course)
    .values({
      slug: "queries-test-draft",
      title: "Queries Test Draft",
      description: "A draft course that must not be publicly visible.",
      category: "Testing",
      level: "beginner",
      status: "draft",
      instructorUserId: TEST_INSTRUCTOR,
    })
    .returning();

  const [mod] = await db
    .insert(courseModule)
    .values({ courseId: publishedCourse.id, title: "Module One", position: 1 })
    .returning();

  await db.insert(lesson).values([
    {
      moduleId: mod.id,
      courseId: publishedCourse.id,
      slug: "first-lesson",
      title: "First Lesson",
      content: "x".repeat(60),
      position: 1,
      isPreview: true,
    },
    {
      moduleId: mod.id,
      courseId: publishedCourse.id,
      slug: "second-lesson",
      title: "Second Lesson",
      content: "y".repeat(60),
      position: 2,
      isPreview: false,
    },
  ]);
});

afterAll(async () => {
  await db.delete(course).where(eq(course.slug, "queries-test-course"));
  await db.delete(course).where(eq(course.slug, "queries-test-draft"));
  await db.delete(userProfile).where(eq(userProfile.userId, TEST_INSTRUCTOR));
});

describe("getCourses", () => {
  it("returns only published courses", async () => {
    const courses = await getCourses();
    expect(courses.some((c) => c.slug === "queries-test-course")).toBe(true);
    expect(courses.some((c) => c.slug === "queries-test-draft")).toBe(false);
  });

  it("resolves the instructor's real name via a user_profile join", async () => {
    const courses = await getCourses();
    const target = courses.find((c) => c.slug === "queries-test-course");
    expect(target!.instructorName).toBe("Test Instructor");
  });
});

describe("getCourseBySlug", () => {
  it("returns a published course with its modules and lessons in position order", async () => {
    const result = await getCourseBySlug("queries-test-course");
    expect(result).not.toBeNull();
    expect(result!.modules).toHaveLength(1);
    expect(result!.modules[0].lessons.map((l) => l.slug)).toEqual(["first-lesson", "second-lesson"]);
  });

  it("returns null for a draft course", async () => {
    expect(await getCourseBySlug("queries-test-draft")).toBeNull();
  });
});

describe("getLesson", () => {
  it("returns navigation and full content", async () => {
    const result = await getLesson("queries-test-course", "second-lesson");
    expect(result).not.toBeNull();
    expect(result!.prev!.slug).toBe("first-lesson");
    expect(result!.next).toBeNull();
    expect(result!.content).toBe("y".repeat(60));
  });
});

describe("getCatalogStats", () => {
  it("counts only published courses", async () => {
    const stats = await getCatalogStats();
    const before = stats.courses;
    expect(before).toBeGreaterThanOrEqual(1);
  });
});

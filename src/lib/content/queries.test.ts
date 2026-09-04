import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { course, courseModule, enrollment, lesson, userProfile } from "@/db/schema";
import type { Session } from "@/lib/session";

/**
 * `queries.ts`'s `getLesson` imports `canManageCourse` from `./authz` (the admin/instructor bypass
 * added alongside the enrollment gate). `./authz` only imports `@/db`, `@/db/schema`, and
 * `type Session` from `@/lib/session` (type-only, erased at compile time) — it never transitively
 * pulls in the real `@neondatabase/auth@0.5.0-beta` package the way importing the runtime
 * `@/lib/session` module would, so this file doesn't need the `@/lib/auth/server` mock that
 * `authz.test.ts`/`session.test.ts` document for files that DO import `@/lib/session` at runtime.
 * `@/db` stays real and unmocked, same as every other test in this file.
 */
const { getCourses, getCourseBySlug, getLesson, getCatalogStats, getAllCourses } =
  await import("./queries");

const TEST_INSTRUCTOR = "test-instructor-id";
const TEST_INSTRUCTOR_2 = "queries-test-instructor-2";
const TEST_LEARNER = "queries-test-enrolled-learner";

function testViewer(userId: string, role: Session["role"]): Session {
  return { userId, name: "Test Viewer", email: "viewer@queries-test.example", initials: "TV", role };
}

beforeAll(async () => {
  await db
    .insert(userProfile)
    .values([
      { userId: TEST_INSTRUCTOR, name: "Test Instructor", role: "instructor" },
      { userId: TEST_INSTRUCTOR_2, name: "Queries Test Instructor Two", role: "instructor" },
    ])
    .onConflictDoNothing();

  await db
    .insert(course)
    .values({
      slug: "queries-test-instructor-2-course",
      title: "Queries Test Instructor Two's Course",
      description: "A course owned by a different instructor, for getAllCourses scoping tests.",
      category: "Testing",
      level: "beginner",
      status: "draft",
      instructorUserId: TEST_INSTRUCTOR_2,
    });

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

  await db.insert(enrollment).values({ courseId: publishedCourse.id, userId: TEST_LEARNER });
});

afterAll(async () => {
  await db.delete(course).where(eq(course.slug, "queries-test-course"));
  await db.delete(course).where(eq(course.slug, "queries-test-draft"));
  await db.delete(course).where(eq(course.slug, "queries-test-instructor-2-course"));
  await db.delete(userProfile).where(eq(userProfile.userId, TEST_INSTRUCTOR));
  await db.delete(userProfile).where(eq(userProfile.userId, TEST_INSTRUCTOR_2));
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
  it("returns navigation and full content for a preview lesson with no viewer", async () => {
    const result = await getLesson("queries-test-course", "first-lesson", null);
    expect(result).not.toBeNull();
    expect(result!.next!.slug).toBe("second-lesson");
    expect(result!.prev).toBeNull();
    expect(result!.content).toBe("x".repeat(60));
  });

  it("never leaks other lessons' content through the modules field, regardless of the viewer's access to the target lesson", async () => {
    // `first-lesson` is a preview, so `canAccess` is true for a null viewer — but that must not
    // also hand back `second-lesson`'s (non-preview) full content by way of the `modules` array
    // the client-rendered sidebar receives.
    const result = await getLesson("queries-test-course", "first-lesson", null);
    expect(result).not.toBeNull();
    const flatLessons = result!.modules.flatMap((m) => m.lessons);
    expect(flatLessons.some((l) => l.slug === "second-lesson")).toBe(true);
    expect(flatLessons.every((l) => l.isPreview || !l.content)).toBe(true);
    expect(flatLessons.every((l) => l.content === "")).toBe(true);
  });

  it("returns null for a non-preview lesson with no viewer", async () => {
    const result = await getLesson("queries-test-course", "second-lesson", null);
    expect(result).toBeNull();
  });

  it("returns null for a non-preview lesson with an unenrolled viewer", async () => {
    const result = await getLesson(
      "queries-test-course",
      "second-lesson",
      testViewer("queries-test-unenrolled-learner", "learner"),
    );
    expect(result).toBeNull();
  });

  it("returns navigation and full content for a non-preview lesson with an enrolled viewer", async () => {
    const result = await getLesson(
      "queries-test-course",
      "second-lesson",
      testViewer(TEST_LEARNER, "learner"),
    );
    expect(result).not.toBeNull();
    expect(result!.prev!.slug).toBe("first-lesson");
    expect(result!.next).toBeNull();
    expect(result!.content).toBe("y".repeat(60));
  });

  it("returns full content for a non-preview lesson to an admin who isn't enrolled", async () => {
    const result = await getLesson(
      "queries-test-course",
      "second-lesson",
      testViewer("queries-test-unenrolled-admin", "admin"),
    );
    expect(result).not.toBeNull();
    expect(result!.content).toBe("y".repeat(60));
  });

  it("returns full content for a non-preview lesson to the course's own instructor who isn't enrolled", async () => {
    const result = await getLesson(
      "queries-test-course",
      "second-lesson",
      testViewer(TEST_INSTRUCTOR, "instructor"),
    );
    expect(result).not.toBeNull();
    expect(result!.content).toBe("y".repeat(60));
  });

  it("returns null for a non-preview lesson to an instructor of a different course", async () => {
    const result = await getLesson(
      "queries-test-course",
      "second-lesson",
      testViewer("queries-test-other-instructor", "instructor"),
    );
    expect(result).toBeNull();
  });
});

describe("getCatalogStats", () => {
  it("counts only published courses", async () => {
    const stats = await getCatalogStats();
    const before = stats.courses;
    expect(before).toBeGreaterThanOrEqual(1);
  });
});

describe("getAllCourses", () => {
  it("scopes an instructor's listing to only their own courses", async () => {
    const courses = await getAllCourses(testViewer(TEST_INSTRUCTOR, "instructor"));
    expect(courses.some((c) => c.slug === "queries-test-course")).toBe(true);
    expect(courses.some((c) => c.slug === "queries-test-draft")).toBe(true);
    expect(courses.some((c) => c.slug === "queries-test-instructor-2-course")).toBe(false);
  });

  it("scopes a different instructor's listing to only their own courses", async () => {
    const courses = await getAllCourses(testViewer(TEST_INSTRUCTOR_2, "instructor"));
    expect(courses.some((c) => c.slug === "queries-test-instructor-2-course")).toBe(true);
    expect(courses.some((c) => c.slug === "queries-test-course")).toBe(false);
    expect(courses.some((c) => c.slug === "queries-test-draft")).toBe(false);
  });

  it("lets an admin see every instructor's courses, including drafts", async () => {
    const courses = await getAllCourses(testViewer("queries-test-admin", "admin"));
    expect(courses.some((c) => c.slug === "queries-test-course")).toBe(true);
    expect(courses.some((c) => c.slug === "queries-test-draft")).toBe(true);
    expect(courses.some((c) => c.slug === "queries-test-instructor-2-course")).toBe(true);
  });
});

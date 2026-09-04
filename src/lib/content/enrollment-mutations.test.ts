import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { course, courseModule, enrollment, lesson, lessonProgress, userProfile } from "@/db/schema";

/**
 * `enrollInCourse`/`toggleLessonComplete` are exercised against the real test database (same
 * pattern as `queries.test.ts`/`seed.test.ts`), not the deep `db`-mocking `mutations.test.ts` uses
 * for `assertCanManageCourse` — the brief's own Step 1 explicitly calls for this, since re-deriving
 * `db`'s chained query builder in a mock says nothing about whether the real unique constraints
 * (`enrollment`'s `unique(course_id, user_id)`, `lesson_progress`'s `unique(lesson_id, user_id)`)
 * actually back the `onConflictDoNothing()` calls.
 *
 * This can't simply live inside `mutations.test.ts`: that file's `vi.mock("@/db", ...)` is hoisted
 * and applies to every import of `@/db` for the entire file, including transitively through
 * `./mutations` — there's no way to get the real `db` back for a subset of tests in a file that
 * already mocks it at module scope. A separate file sidesteps that entirely.
 *
 * Two mocks are still needed here, neither of which touches `db`:
 * - `@/lib/session`'s `requireUser` — the real one reads `next/headers` cookies via
 *   `@neondatabase/auth`, which (per `session.test.ts`/`mutations.test.ts`'s own comments) can't
 *   load outside Next's bundler in a plain Vitest/Node ESM loader. Both mutations under test call
 *   `requireUser()` and use its `viewer.userId` for every write, so the test drives that directly.
 * - `next/cache`'s `revalidatePath` — confirmed by direct probe that calling it outside a Next.js
 *   request/render context throws `Invariant: static generation store missing`; it's irrelevant to
 *   what these tests verify (real row writes), so it's stubbed to a no-op.
 */
const mockRequireUser = vi.fn();
vi.mock("@/lib/session", () => ({
  requireUser: () => mockRequireUser(),
  requireRole: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const { enrollInCourse, toggleLessonComplete } = await import("./mutations");

const TEST_INSTRUCTOR = "enrollment-mutations-test-instructor";
const TEST_LEARNER = "enrollment-mutations-test-learner";
const TEST_UNAUTHORIZED_LEARNER = "enrollment-mutations-test-unauthorized-learner";
const TEST_SLUG = "enrollment-mutations-test-course";

let testCourseId: string;
let testLessonId: string;

beforeAll(async () => {
  await db
    .insert(userProfile)
    .values({ userId: TEST_INSTRUCTOR, name: "Enrollment Mutations Test Instructor", role: "instructor" })
    .onConflictDoNothing();

  const [insertedCourse] = await db
    .insert(course)
    .values({
      slug: TEST_SLUG,
      title: "Enrollment Mutations Test Course",
      description: "A course that exists only for this test file.",
      category: "Testing",
      level: "beginner",
      status: "published",
      instructorUserId: TEST_INSTRUCTOR,
    })
    .returning();
  testCourseId = insertedCourse.id;

  const [mod] = await db
    .insert(courseModule)
    .values({ courseId: testCourseId, title: "Module One", position: 1 })
    .returning();

  const [insertedLesson] = await db
    .insert(lesson)
    .values({
      moduleId: mod.id,
      courseId: testCourseId,
      slug: "test-lesson",
      title: "Test Lesson",
      content: "x".repeat(60),
      position: 1,
      isPreview: true,
    })
    .returning();
  testLessonId = insertedLesson.id;

  mockRequireUser.mockResolvedValue({
    userId: TEST_LEARNER,
    name: "Test Learner",
    email: "learner@enrollment-mutations-test.example",
    initials: "TL",
    role: "learner",
  });
});

afterAll(async () => {
  // CASCADE handles course_module/lesson/enrollment/lesson_progress rows tied to this course.
  await db.delete(course).where(eq(course.slug, TEST_SLUG));
  await db.delete(userProfile).where(eq(userProfile.userId, TEST_INSTRUCTOR));
});

describe("enrollInCourse", () => {
  it("looks up the course by slug and inserts a real enrollment row", async () => {
    const result = await enrollInCourse(TEST_SLUG);
    expect(result).toEqual({ ok: true });

    const rows = await db
      .select()
      .from(enrollment)
      .where(and(eq(enrollment.courseId, testCourseId), eq(enrollment.userId, TEST_LEARNER)));
    expect(rows).toHaveLength(1);
  });

  it("ignores a duplicate enrollment instead of erroring or duplicating the row", async () => {
    const result = await enrollInCourse(TEST_SLUG);
    expect(result).toEqual({ ok: true });

    const rows = await db
      .select()
      .from(enrollment)
      .where(and(eq(enrollment.courseId, testCourseId), eq(enrollment.userId, TEST_LEARNER)));
    expect(rows).toHaveLength(1);
  });

  it("returns an error for an unknown course slug", async () => {
    const result = await enrollInCourse("no-such-course-slug");
    expect(result).toEqual({ ok: false, message: "Course not found." });
  });
});

describe("toggleLessonComplete", () => {
  it("marks a lesson complete on first toggle, inserting a real lesson_progress row", async () => {
    const result = await toggleLessonComplete(testLessonId);
    expect(result).toEqual({ ok: true, complete: true });

    const rows = await db
      .select()
      .from(lessonProgress)
      .where(and(eq(lessonProgress.lessonId, testLessonId), eq(lessonProgress.userId, TEST_LEARNER)));
    expect(rows).toHaveLength(1);
  });

  it("marks it incomplete again on the second toggle, deleting the row", async () => {
    const result = await toggleLessonComplete(testLessonId);
    expect(result).toEqual({ ok: true, complete: false });

    const rows = await db
      .select()
      .from(lessonProgress)
      .where(and(eq(lessonProgress.lessonId, testLessonId), eq(lessonProgress.userId, TEST_LEARNER)));
    expect(rows).toHaveLength(0);
  });

  it("rejects an unenrolled, non-managing user and does not insert a lesson_progress row", async () => {
    mockRequireUser.mockResolvedValue({
      userId: TEST_UNAUTHORIZED_LEARNER,
      name: "Unauthorized Learner",
      email: "unauthorized@enrollment-mutations-test.example",
      initials: "UL",
      role: "learner",
    });

    const result = await toggleLessonComplete(testLessonId);
    expect(result.ok).toBe(false);

    const rows = await db
      .select()
      .from(lessonProgress)
      .where(
        and(
          eq(lessonProgress.lessonId, testLessonId),
          eq(lessonProgress.userId, TEST_UNAUTHORIZED_LEARNER),
        ),
      );
    expect(rows).toHaveLength(0);

    // Restore the enrolled learner as the "logged in" viewer for any tests that run after this one.
    mockRequireUser.mockResolvedValue({
      userId: TEST_LEARNER,
      name: "Test Learner",
      email: "learner@enrollment-mutations-test.example",
      initials: "TL",
      role: "learner",
    });
  });
});

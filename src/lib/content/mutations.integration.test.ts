import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { course, courseModule, enrollment, lesson, lessonProgress, userProfile } from "@/db/schema";
import type { Session } from "@/lib/session";
import type { CourseInput } from "@/lib/validation";

/**
 * `updateCourse`/`deleteCourse` are exercised here against the real test database, not the
 * `vi.mock("@/db", ...)`-backed `mutations.test.ts` which only unit-tests `assertCanManageCourse`
 * in isolation. That file's `vi.mock("@/db", ...)` is hoisted to the top of the module and applies
 * to every import of `@/db` for the entire file, including transitively through `./mutations` —
 * there's no way to get the real `db` back for a subset of tests in a file that already mocks it
 * at module scope (the exact conflict Task 12 hit and solved the same way — see
 * `enrollment-mutations.test.ts`'s own top-of-file comment — independently verified correct by
 * that task's reviewer). A separate file sidesteps that entirely, and lets these tests do what a
 * mocked `db` structurally cannot: prove `updateCourse` rejects a cross-instructor write against a
 * real owned row, and that `deleteCourse`'s cascade genuinely removes child rows via the schema's
 * real `onDelete: "cascade"` foreign keys (Task 2) — a mocked test can't catch a missing
 * `onDelete` clause.
 *
 * Only `requireRole` (from `@/lib/session`) is mocked, narrowly, so each test can drive which
 * instructor is "logged in" without needing a real Neon Auth session (the same `next/headers`
 * ESM-resolution problem `mutations.test.ts`/`session.test.ts`/`enrollment-mutations.test.ts`
 * document and mock around). `next/cache`'s `revalidatePath` is stubbed to a no-op for the same
 * reason `enrollment-mutations.test.ts` stubs it: calling it outside a Next.js request/render
 * context throws `Invariant: static generation store missing`, and it's irrelevant to what these
 * tests verify (real row writes/deletes).
 */
const mockRequireRole = vi.fn();
vi.mock("@/lib/session", () => ({
  requireRole: (...roles: string[]) => mockRequireRole(...roles),
  requireUser: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const { updateCourse, deleteCourse } = await import("./mutations");

const TEST_INSTRUCTOR_A = "mutations-integration-test-instructor-a";
const TEST_INSTRUCTOR_B = "mutations-integration-test-instructor-b";
const TEST_LEARNER = "mutations-integration-test-learner";
const TEST_SLUG_A = "mutations-integration-test-course-a";
const TEST_SLUG_DELETE = "mutations-integration-test-course-delete";

let courseAId: string;
let courseDeleteId: string;
let moduleDeleteId: string;
let lessonDeleteId: string;

function sessionFor(userId: string): Session {
  return { userId, name: "Test Instructor", email: "instructor@mutations-integration-test.example", initials: "TI", role: "instructor" };
}

function validInput(overrides: Partial<CourseInput> = {}): CourseInput {
  return {
    title: "Updated Course Title",
    slug: "mutations-integration-test-course-a-updated",
    description: "A description that is definitely at least twenty characters long.",
    category: "Development",
    level: "beginner",
    instructorUserId: "00000000-0000-0000-0000-000000000000",
    modules: [
      {
        title: "Module One",
        position: 1,
        lessons: [
          {
            title: "Lesson One",
            slug: "lesson-one",
            position: 1,
            isPreview: true,
            content: "x".repeat(60),
          },
        ],
      },
    ],
    ...overrides,
  };
}

beforeAll(async () => {
  await db
    .insert(userProfile)
    .values([
      { userId: TEST_INSTRUCTOR_A, name: "Mutations Integration Test Instructor A", role: "instructor" },
      { userId: TEST_INSTRUCTOR_B, name: "Mutations Integration Test Instructor B", role: "instructor" },
    ])
    .onConflictDoNothing();

  const [insertedCourseA] = await db
    .insert(course)
    .values({
      slug: TEST_SLUG_A,
      title: "Mutations Integration Test Course A",
      description: "A course that exists only for this test file.",
      category: "Development",
      level: "beginner",
      status: "draft",
      instructorUserId: TEST_INSTRUCTOR_A,
    })
    .returning();
  courseAId = insertedCourseA.id;
});

afterAll(async () => {
  // CASCADE handles course_module/lesson/enrollment/lesson_progress rows tied to these courses.
  await db.delete(course).where(eq(course.slug, TEST_SLUG_A));
  await db.delete(course).where(eq(course.slug, validInput().slug));
  await db.delete(course).where(eq(course.slug, TEST_SLUG_DELETE));
  await db
    .delete(userProfile)
    .where(eq(userProfile.userId, TEST_INSTRUCTOR_A));
  await db.delete(userProfile).where(eq(userProfile.userId, TEST_INSTRUCTOR_B));
});

describe("updateCourse authorization (integration)", () => {
  it("an instructor cannot update a course owned by a different instructor", async () => {
    mockRequireRole.mockResolvedValue(sessionFor(TEST_INSTRUCTOR_B));

    await expect(updateCourse(courseAId, validInput())).rejects.toThrow(/not authorized/i);

    const [row] = await db.select().from(course).where(eq(course.id, courseAId));
    expect(row.title).toBe("Mutations Integration Test Course A");
    expect(row.slug).toBe(TEST_SLUG_A);
  });

  it("an instructor CAN update their own course", async () => {
    mockRequireRole.mockResolvedValue(sessionFor(TEST_INSTRUCTOR_A));

    const result = await updateCourse(courseAId, validInput());
    expect(result).toEqual({ ok: true });

    const [row] = await db.select().from(course).where(eq(course.id, courseAId));
    expect(row.title).toBe("Updated Course Title");
    expect(row.slug).toBe("mutations-integration-test-course-a-updated");

    const modules = await db.select().from(courseModule).where(eq(courseModule.courseId, courseAId));
    expect(modules).toHaveLength(1);
    expect(modules[0].title).toBe("Module One");
  });
});

describe("deleteCourse cascade (integration)", () => {
  beforeAll(async () => {
    const [insertedCourse] = await db
      .insert(course)
      .values({
        slug: TEST_SLUG_DELETE,
        title: "Mutations Integration Test Course To Delete",
        description: "A course that exists only to be deleted by this test file.",
        category: "Development",
        level: "beginner",
        status: "draft",
        instructorUserId: TEST_INSTRUCTOR_A,
      })
      .returning();
    courseDeleteId = insertedCourse.id;

    const [insertedModule] = await db
      .insert(courseModule)
      .values({ courseId: courseDeleteId, title: "Module To Delete", position: 1 })
      .returning();
    moduleDeleteId = insertedModule.id;

    const [insertedLesson] = await db
      .insert(lesson)
      .values({
        moduleId: moduleDeleteId,
        courseId: courseDeleteId,
        slug: "lesson-to-delete",
        title: "Lesson To Delete",
        content: "x".repeat(60),
        position: 1,
        isPreview: true,
      })
      .returning();
    lessonDeleteId = insertedLesson.id;

    await db.insert(enrollment).values({ courseId: courseDeleteId, userId: TEST_LEARNER });
    await db.insert(lessonProgress).values({ lessonId: lessonDeleteId, userId: TEST_LEARNER });
  });

  it("cascades to modules, lessons, enrollments, and progress", async () => {
    mockRequireRole.mockResolvedValue(sessionFor(TEST_INSTRUCTOR_A));

    const result = await deleteCourse(courseDeleteId);
    expect(result).toEqual({ ok: true });

    const courseRows = await db.select().from(course).where(eq(course.id, courseDeleteId));
    expect(courseRows).toHaveLength(0);

    const moduleRows = await db.select().from(courseModule).where(eq(courseModule.id, moduleDeleteId));
    expect(moduleRows).toHaveLength(0);

    const lessonRows = await db.select().from(lesson).where(eq(lesson.id, lessonDeleteId));
    expect(lessonRows).toHaveLength(0);

    const enrollmentRows = await db.select().from(enrollment).where(eq(enrollment.courseId, courseDeleteId));
    expect(enrollmentRows).toHaveLength(0);

    const progressRows = await db
      .select()
      .from(lessonProgress)
      .where(eq(lessonProgress.lessonId, lessonDeleteId));
    expect(progressRows).toHaveLength(0);
  });
});

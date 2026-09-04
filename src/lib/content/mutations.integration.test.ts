import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { and, eq } from "drizzle-orm";
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
const TEST_SLUG_RECONCILE_PERSIST = "mutations-integration-test-reconcile-persist";
const TEST_SLUG_RECONCILE_DELETE = "mutations-integration-test-reconcile-delete";
const TEST_SLUG_RECONCILE_MOVE = "mutations-integration-test-reconcile-move";

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
  await db.delete(course).where(eq(course.slug, TEST_SLUG_RECONCILE_PERSIST));
  await db.delete(course).where(eq(course.slug, TEST_SLUG_RECONCILE_DELETE));
  await db.delete(course).where(eq(course.slug, TEST_SLUG_RECONCILE_MOVE));
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

/**
 * Finding 1 (final-review fix wave): `updateCourse` used to delete every `course_module` row for
 * the course and reinsert modules/lessons from scratch with fresh UUIDs on ANY edit — including a
 * pure title/content tweak that didn't touch modules at all. Since `course_module → lesson` and
 * `lesson → lesson_progress` both cascade on delete, that destroyed every enrolled learner's
 * progress the moment anyone edited the course. These three tests exercise the reconcile-by-slug
 * replacement directly against the real DB (a mocked `db` can't prove a real `unique(course_id,
 * slug)`-keyed UPDATE preserved a real row's `id`, or that a real FK-cascaded DELETE actually fired
 * for the ones that should be gone).
 */
describe("updateCourse reconcile (integration)", () => {
  let persistCourseId: string;
  let persistLessonId: string;

  let deleteCourseId: string;
  let deleteLessonToRemoveId: string;

  let moveCourseId: string;
  let moveLessonId: string;

  beforeAll(async () => {
    // --- Scenario 1 setup: a lesson that survives an edit (title/content change, same slug). ---
    const [persistCourse] = await db
      .insert(course)
      .values({
        slug: TEST_SLUG_RECONCILE_PERSIST,
        title: "Reconcile Persist Course",
        description: "A course used to verify a lesson's identity survives an edit.",
        category: "Development",
        level: "beginner",
        status: "draft",
        instructorUserId: TEST_INSTRUCTOR_A,
      })
      .returning();
    persistCourseId = persistCourse.id;

    const [persistModule] = await db
      .insert(courseModule)
      .values({ courseId: persistCourseId, title: "Module One", position: 1 })
      .returning();

    const [persistLesson] = await db
      .insert(lesson)
      .values({
        moduleId: persistModule.id,
        courseId: persistCourseId,
        slug: "persist-me",
        title: "Original Title",
        content: "x".repeat(60),
        position: 1,
        isPreview: true,
      })
      .returning();
    persistLessonId = persistLesson.id;

    await db.insert(lessonProgress).values({ lessonId: persistLessonId, userId: TEST_LEARNER });

    // --- Scenario 2 setup: a lesson genuinely removed from the submitted input. ---
    const [deleteCourseRow] = await db
      .insert(course)
      .values({
        slug: TEST_SLUG_RECONCILE_DELETE,
        title: "Reconcile Delete Course",
        description: "A course used to verify a removed lesson's progress is correctly deleted.",
        category: "Development",
        level: "beginner",
        status: "draft",
        instructorUserId: TEST_INSTRUCTOR_A,
      })
      .returning();
    deleteCourseId = deleteCourseRow.id;

    const [deleteModule] = await db
      .insert(courseModule)
      .values({ courseId: deleteCourseId, title: "Module One", position: 1 })
      .returning();

    await db.insert(lesson).values({
      moduleId: deleteModule.id,
      courseId: deleteCourseId,
      slug: "keep-me",
      title: "Keep Me",
      content: "x".repeat(60),
      position: 1,
      isPreview: true,
    });

    const [deleteLessonToRemove] = await db
      .insert(lesson)
      .values({
        moduleId: deleteModule.id,
        courseId: deleteCourseId,
        slug: "delete-me",
        title: "Delete Me",
        content: "y".repeat(60),
        position: 2,
        isPreview: true,
      })
      .returning();
    deleteLessonToRemoveId = deleteLessonToRemove.id;

    await db.insert(lessonProgress).values({ lessonId: deleteLessonToRemoveId, userId: TEST_LEARNER });

    // --- Scenario 3 setup: a lesson that moves from one module to a different (new) module. ---
    const [moveCourseRow] = await db
      .insert(course)
      .values({
        slug: TEST_SLUG_RECONCILE_MOVE,
        title: "Reconcile Move Course",
        description: "A course used to verify a lesson survives moving between modules.",
        category: "Development",
        level: "beginner",
        status: "draft",
        instructorUserId: TEST_INSTRUCTOR_A,
      })
      .returning();
    moveCourseId = moveCourseRow.id;

    const [moveModule] = await db
      .insert(courseModule)
      .values({ courseId: moveCourseId, title: "Module One", position: 1 })
      .returning();

    await db.insert(lesson).values({
      moduleId: moveModule.id,
      courseId: moveCourseId,
      slug: "stay-lesson",
      title: "Stay Lesson",
      content: "x".repeat(60),
      position: 1,
      isPreview: true,
    });

    const [moveLesson] = await db
      .insert(lesson)
      .values({
        moduleId: moveModule.id,
        courseId: moveCourseId,
        slug: "move-me",
        title: "Move Me",
        content: "y".repeat(60),
        position: 2,
        isPreview: true,
      })
      .returning();
    moveLessonId = moveLesson.id;

    await db.insert(lessonProgress).values({ lessonId: moveLessonId, userId: TEST_LEARNER });
  });

  it("preserves a lesson's id and lesson_progress rows when it's edited but keeps its slug", async () => {
    mockRequireRole.mockResolvedValue(sessionFor(TEST_INSTRUCTOR_A));

    const result = await updateCourse(persistCourseId, {
      title: "Reconcile Persist Course (edited)",
      slug: TEST_SLUG_RECONCILE_PERSIST,
      description: "A description that is definitely at least twenty characters long, edited.",
      category: "Development",
      level: "beginner",
      instructorUserId: "00000000-0000-0000-0000-000000000000",
      modules: [
        {
          title: "Module One",
          position: 1,
          lessons: [
            {
              title: "Edited Title",
              slug: "persist-me",
              position: 1,
              isPreview: true,
              content: "z".repeat(60),
            },
          ],
        },
      ],
    });
    expect(result).toEqual({ ok: true });

    const [lessonRow] = await db
      .select()
      .from(lesson)
      .where(and(eq(lesson.courseId, persistCourseId), eq(lesson.slug, "persist-me")));
    expect(lessonRow.id).toBe(persistLessonId);
    expect(lessonRow.title).toBe("Edited Title");
    expect(lessonRow.content).toBe("z".repeat(60));

    const progressRows = await db
      .select()
      .from(lessonProgress)
      .where(and(eq(lessonProgress.lessonId, persistLessonId), eq(lessonProgress.userId, TEST_LEARNER)));
    expect(progressRows).toHaveLength(1);
  });

  it("deletes a lesson (and its lesson_progress rows) that is omitted from the submitted input", async () => {
    mockRequireRole.mockResolvedValue(sessionFor(TEST_INSTRUCTOR_A));

    const result = await updateCourse(deleteCourseId, {
      title: "Reconcile Delete Course",
      slug: TEST_SLUG_RECONCILE_DELETE,
      description: "A description that is definitely at least twenty characters long, edited.",
      category: "Development",
      level: "beginner",
      instructorUserId: "00000000-0000-0000-0000-000000000000",
      modules: [
        {
          title: "Module One",
          position: 1,
          lessons: [
            { title: "Keep Me", slug: "keep-me", position: 1, isPreview: true, content: "x".repeat(60) },
          ],
        },
      ],
    });
    expect(result).toEqual({ ok: true });

    const removedLessonRows = await db.select().from(lesson).where(eq(lesson.id, deleteLessonToRemoveId));
    expect(removedLessonRows).toHaveLength(0);

    const removedProgressRows = await db
      .select()
      .from(lessonProgress)
      .where(eq(lessonProgress.lessonId, deleteLessonToRemoveId));
    expect(removedProgressRows).toHaveLength(0);

    // The lesson that WAS submitted must still be there, untouched.
    const keptLessonRows = await db
      .select()
      .from(lesson)
      .where(and(eq(lesson.courseId, deleteCourseId), eq(lesson.slug, "keep-me")));
    expect(keptLessonRows).toHaveLength(1);
  });

  it("preserves a lesson's id and lesson_progress rows when it moves to a different module", async () => {
    mockRequireRole.mockResolvedValue(sessionFor(TEST_INSTRUCTOR_A));

    const result = await updateCourse(moveCourseId, {
      title: "Reconcile Move Course",
      slug: TEST_SLUG_RECONCILE_MOVE,
      description: "A description that is definitely at least twenty characters long, edited.",
      category: "Development",
      level: "beginner",
      instructorUserId: "00000000-0000-0000-0000-000000000000",
      modules: [
        {
          title: "Module One",
          position: 1,
          lessons: [
            { title: "Stay Lesson", slug: "stay-lesson", position: 1, isPreview: true, content: "x".repeat(60) },
          ],
        },
        {
          title: "Module Two",
          position: 2,
          lessons: [
            { title: "Move Me", slug: "move-me", position: 1, isPreview: true, content: "y".repeat(60) },
          ],
        },
      ],
    });
    expect(result).toEqual({ ok: true });

    const [moduleTwoRow] = await db
      .select()
      .from(courseModule)
      .where(and(eq(courseModule.courseId, moveCourseId), eq(courseModule.title, "Module Two")));
    expect(moduleTwoRow).toBeDefined();

    const [movedLessonRow] = await db
      .select()
      .from(lesson)
      .where(and(eq(lesson.courseId, moveCourseId), eq(lesson.slug, "move-me")));
    expect(movedLessonRow.id).toBe(moveLessonId);
    expect(movedLessonRow.moduleId).toBe(moduleTwoRow.id);

    const progressRows = await db
      .select()
      .from(lessonProgress)
      .where(and(eq(lessonProgress.lessonId, moveLessonId), eq(lessonProgress.userId, TEST_LEARNER)));
    expect(progressRows).toHaveLength(1);
  });
});

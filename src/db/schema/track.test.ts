import { describe, it, expect, afterAll } from "vitest";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { course, courseModule, lesson, enrollment, lessonProgress, track, trackCourse } from "@/db/schema";

/**
 * Runs against the real Postgres database in DATABASE_URL, like the other
 * schema/integration suites. Proves two things a mocked db structurally cannot:
 * the `unique(track_id, course_id)` constraint really exists, and deleting a
 * track destroys no learner data.
 */
const P = "track-schema-test";
const USER = `${P}-user`;

// Each test seeds its OWN rows. `track.slug` and `course.slug` are both UNIQUE,
// so a single fixed-slug seed() called from two tests violates the constraint on
// the second call and the failure looks like a schema bug rather than a test bug.
const SUFFIXES = ["unique", "cascade"];

afterAll(async () => {
  for (const s of SUFFIXES) {
    await db.delete(track).where(eq(track.slug, `${P}-track-${s}`));
    await db.delete(course).where(eq(course.slug, `${P}-course-${s}`));
  }
});

async function seed(suffix: string) {
  const [t] = await db
    .insert(track)
    .values({
      slug: `${P}-track-${suffix}`,
      title: "Test Track",
      promise: "A promise.",
      outcome: "You finish able to test.",
      status: "published",
      position: 0,
    })
    .returning();

  const [c] = await db
    .insert(course)
    .values({
      slug: `${P}-course-${suffix}`,
      title: "Test Course",
      description: "d",
      category: "Testing",
      level: "beginner",
      status: "published",
      instructorUserId: USER,
    })
    .returning();

  const [m] = await db
    .insert(courseModule)
    .values({ courseId: c.id, title: "M", position: 0 })
    .returning();

  const [l] = await db
    .insert(lesson)
    .values({ moduleId: m.id, courseId: c.id, slug: "l", title: "L", content: "x", position: 0 })
    .returning();

  await db.insert(trackCourse).values({ trackId: t.id, courseId: c.id, position: 0 });
  await db.insert(enrollment).values({ courseId: c.id, userId: USER });
  await db.insert(lessonProgress).values({ lessonId: l.id, userId: USER });

  return { t, c, l };
}

describe("track schema", () => {
  it("rejects the same course twice in one track", async () => {
    const { t, c } = await seed("unique");
    await expect(
      db.insert(trackCourse).values({ trackId: t.id, courseId: c.id, position: 1 }),
    ).rejects.toThrow();
  });

  it("deleting a track destroys no enrolment or lesson progress", async () => {
    const { t, c, l } = await seed("cascade");

    await db.delete(track).where(eq(track.id, t.id));

    const links = await db.select().from(trackCourse).where(eq(trackCourse.trackId, t.id));
    expect(links).toHaveLength(0);

    const enrolments = await db
      .select()
      .from(enrollment)
      .where(and(eq(enrollment.courseId, c.id), eq(enrollment.userId, USER)));
    expect(enrolments).toHaveLength(1);

    const progress = await db
      .select()
      .from(lessonProgress)
      .where(and(eq(lessonProgress.lessonId, l.id), eq(lessonProgress.userId, USER)));
    expect(progress).toHaveLength(1);
  });
});

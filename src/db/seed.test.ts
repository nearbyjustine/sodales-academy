import { describe, it, expect, afterAll } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { course, courseModule, lesson } from "@/db/schema";
import { runSeed } from "./seed";

afterAll(async () => {
  const rows = await db.select({ id: course.id, slug: course.slug }).from(course);
  const seededSlugs = [
    "brand-identity-essentials",
    "landing-your-first-client",
    "pricing-and-proposals",
    "web-development-foundations",
    "test-fixture-course",
  ];
  for (const row of rows) {
    if (seededSlugs.includes(row.slug)) {
      await db.delete(course).where(eq(course.id, row.id));
    }
  }
});

describe("runSeed", () => {
  it("imports every course and lesson from content/", async () => {
    const result = await runSeed();
    expect(result.coursesImported).toBe(5); // 4 published + the draft fixture
    expect(result.lessonsImported).toBe(20); // 19 real + 1 fixture lesson
  });

  it("preserves status, including the draft fixture", async () => {
    await runSeed();
    const [fixture] = await db
      .select({ status: course.status })
      .from(course)
      .where(eq(course.slug, "test-fixture-course"));
    expect(fixture.status).toBe("draft");
  });

  it("preserves module and lesson ordering", async () => {
    await runSeed();
    const [landingCourse] = await db
      .select()
      .from(course)
      .where(eq(course.slug, "landing-your-first-client"));

    const modules = await db
      .select()
      .from(courseModule)
      .where(eq(courseModule.courseId, landingCourse.id));
    expect(modules).toHaveLength(3);

    const firstModule = modules.find((m) => m.position === 1)!;
    const lessons = await db.select().from(lesson).where(eq(lesson.moduleId, firstModule.id));
    expect(lessons.map((l) => l.slug).sort()).toEqual(
      ["why-nobody-replies", "where-clients-actually-are"].sort(),
    );
  });

  it("is idempotent — re-running does not create duplicates", async () => {
    await runSeed();
    const before = await db.select({ id: course.id }).from(course).where(eq(course.slug, "pricing-and-proposals"));

    await runSeed();
    const after = await db.select({ id: course.id }).from(course).where(eq(course.slug, "pricing-and-proposals"));

    expect(after).toHaveLength(before.length);
  });

  it("resumes a partially-seeded course — fills in missing modules and lessons without duplicating what's already there", async () => {
    // Earlier tests in this file already ran runSeed() to completion, so this slug exists —
    // clear it first to actually simulate a crash mid-course, not a re-run of a finished one.
    await db.delete(course).where(eq(course.slug, "landing-your-first-client"));

    // Simulate a crash mid-course: the course row and its first module exist, but that
    // module's lessons — and the other two modules entirely — never landed.
    const [partialCourse] = await db
      .insert(course)
      .values({
        slug: "landing-your-first-client",
        title: "Landing Your First Client",
        description: "Pre-existing row simulating a crash partway through seeding.",
        category: "Freelancing",
        level: "beginner",
        status: "published",
        instructorUserId: "test-partial-seed-instructor",
      })
      .returning();

    const [partialModule] = await db
      .insert(courseModule)
      .values({ courseId: partialCourse.id, title: "Finding Work", position: 1 })
      .returning();

    await runSeed();

    const courses = await db.select().from(course).where(eq(course.slug, "landing-your-first-client"));
    expect(courses).toHaveLength(1); // no duplicate course row
    expect(courses[0].instructorUserId).toBe("test-partial-seed-instructor"); // pre-existing row untouched

    const modules = await db.select().from(courseModule).where(eq(courseModule.courseId, partialCourse.id));
    expect(modules).toHaveLength(3); // the other two modules got filled in
    expect(modules.find((m) => m.title === "Finding Work")!.id).toBe(partialModule.id); // reused, not duplicated

    const finderLessons = await db.select().from(lesson).where(eq(lesson.moduleId, partialModule.id));
    expect(finderLessons.map((l) => l.slug).sort()).toEqual(
      ["why-nobody-replies", "where-clients-actually-are"].sort(),
    ); // this module's lessons got filled in too

    const allLessons = await db.select().from(lesson).where(eq(lesson.courseId, partialCourse.id));
    expect(allLessons).toHaveLength(5); // all 5 real lessons present, none duplicated
  });
});

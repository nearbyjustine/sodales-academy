import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { course, courseModule, enrollment, lesson, lessonProgress, track, trackCourse } from "@/db/schema";

const mockRequireRole = vi.fn();
vi.mock("@/lib/session", () => ({
  requireRole: (...roles: string[]) => mockRequireRole(...roles),
  requireUser: vi.fn(),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const { createTrack, updateTrack, deleteTrack, publishTrack, unpublishTrack } = await import("./mutations");

const P = "track-admin-test";
const COURSE_A = `${P}-course-a`;
const COURSE_B = `${P}-course-b`;
const USER = `${P}-user`;

const admin = { userId: `${P}-admin`, name: "A", email: "a@x.test", initials: "A", role: "admin" };

let courseIds: string[] = [];
let lessonId = "";
const createdSlugs: string[] = [];

beforeAll(async () => {
  const rows = await db.insert(course).values([
    { slug: COURSE_A, title: "A", description: "d", category: "T", level: "beginner", status: "published", instructorUserId: `${P}-ins` },
    { slug: COURSE_B, title: "B", description: "d", category: "T", level: "beginner", status: "published", instructorUserId: `${P}-ins` },
  ]).returning();
  courseIds = rows.map((r) => r.id);

  const [m] = await db.insert(courseModule).values({ courseId: rows[0].id, title: "M", position: 0 }).returning();
  const [l] = await db.insert(lesson).values({
    moduleId: m.id, courseId: rows[0].id, slug: "l", title: "L", content: "x", position: 0,
  }).returning();
  lessonId = l.id;

  await db.insert(enrollment).values({ courseId: rows[0].id, userId: USER });
  await db.insert(lessonProgress).values({ lessonId: l.id, userId: USER });
});

afterAll(async () => {
  if (createdSlugs.length > 0) await db.delete(track).where(inArray(track.slug, createdSlugs));
  await db.delete(course).where(inArray(course.id, courseIds));
});

function input(slug: string, ids: string[]) {
  createdSlugs.push(slug);
  return { slug, title: "T", promise: "p", outcome: "o", position: 0, courseIds: ids };
}

describe("track admin mutations", () => {
  it("refuses an instructor", async () => {
    // requireRole("admin") is what rejects here — mirror that by throwing.
    mockRequireRole.mockRejectedValue(new Error("redirect to /"));
    await expect(createTrack(input(`${P}-nope`, courseIds))).rejects.toThrow();
    expect(mockRequireRole).toHaveBeenCalledWith("admin");
  });

  it("creates a draft track with its courses in order", async () => {
    mockRequireRole.mockResolvedValue(admin);

    const result = await createTrack(input(`${P}-created`, [courseIds[1], courseIds[0]]));
    expect(result.ok).toBe(true);

    const [row] = await db.select().from(track).where(eq(track.slug, `${P}-created`));
    expect(row.status).toBe("draft");

    const links = await db.select().from(trackCourse).where(eq(trackCourse.trackId, row.id));
    const ordered = links.sort((a, b) => a.position - b.position).map((l) => l.courseId);
    expect(ordered).toEqual([courseIds[1], courseIds[0]]);
  });

  it("reconciles course membership on update without orphaning rows", async () => {
    mockRequireRole.mockResolvedValue(admin);

    await createTrack(input(`${P}-updated`, courseIds));
    const [row] = await db.select().from(track).where(eq(track.slug, `${P}-updated`));

    await updateTrack(row.id, { slug: `${P}-updated`, title: "T2", promise: "p2", outcome: "o2", position: 3, courseIds: [courseIds[0]] });

    const links = await db.select().from(trackCourse).where(eq(trackCourse.trackId, row.id));
    expect(links.map((l) => l.courseId)).toEqual([courseIds[0]]);

    const [after] = await db.select().from(track).where(eq(track.id, row.id));
    expect(after.title).toBe("T2");
    expect(after.position).toBe(3);
  });

  it("publishes a track", async () => {
    mockRequireRole.mockResolvedValue(admin);

    await createTrack(input(`${P}-publish`, courseIds));
    const [row] = await db.select().from(track).where(eq(track.slug, `${P}-publish`));

    expect((await publishTrack(row.id)).ok).toBe(true);

    const [after] = await db.select().from(track).where(eq(track.id, row.id));
    expect(after.status).toBe("published");
  });

  it("deleting a track destroys no enrolment or lesson progress", async () => {
    mockRequireRole.mockResolvedValue(admin);

    await createTrack(input(`${P}-deleted`, courseIds));
    const [row] = await db.select().from(track).where(eq(track.slug, `${P}-deleted`));

    expect((await deleteTrack(row.id)).ok).toBe(true);

    expect(await db.select().from(track).where(eq(track.id, row.id))).toHaveLength(0);
    expect(await db.select().from(enrollment).where(eq(enrollment.userId, USER))).toHaveLength(1);
    expect(await db.select().from(lessonProgress).where(eq(lessonProgress.lessonId, lessonId))).toHaveLength(1);
  });

  // The "refuses an instructor" test above only proves createTrack's guard is real.
  // Every other write calls `requireRole("admin")` too, and a guard nobody exercises
  // is a guard nobody would notice deleting — so prove each sibling rejects the same
  // way before trusting it's there for a reason.
  it("refuses an instructor on update, publish, unpublish, and delete", async () => {
    mockRequireRole.mockResolvedValue(admin);
    await createTrack(input(`${P}-guarded`, courseIds));
    const [row] = await db.select().from(track).where(eq(track.slug, `${P}-guarded`));

    mockRequireRole.mockRejectedValue(new Error("redirect to /"));
    await expect(
      updateTrack(row.id, { slug: `${P}-guarded`, title: "x", promise: "x", outcome: "x", position: 0, courseIds: [] }),
    ).rejects.toThrow();
    await expect(publishTrack(row.id)).rejects.toThrow();
    await expect(unpublishTrack(row.id)).rejects.toThrow();
    await expect(deleteTrack(row.id)).rejects.toThrow();

    // None of the rejected calls should have changed anything.
    mockRequireRole.mockResolvedValue(admin);
    const [after] = await db.select().from(track).where(eq(track.id, row.id));
    expect(after.title).toBe("T");
    expect(after.status).toBe("draft");
  });

  it("refuses a duplicate slug on create", async () => {
    mockRequireRole.mockResolvedValue(admin);
    await createTrack(input(`${P}-dup`, courseIds));

    createdSlugs.push(`${P}-dup`); // second createTrack call also pushes it; harmless dupe in cleanup list
    const result = await createTrack({ slug: `${P}-dup`, title: "T2", promise: "p", outcome: "o", position: 0, courseIds: [] });
    expect(result).toEqual({ ok: false, message: "A track with that slug already exists." });

    const rows = await db.select().from(track).where(eq(track.slug, `${P}-dup`));
    expect(rows).toHaveLength(1);
  });

  it("returns ok:false instead of throwing when update/publish/unpublish/delete target a nonexistent track", async () => {
    mockRequireRole.mockResolvedValue(admin);
    const bogusId = "00000000-0000-0000-0000-000000000000";

    expect(
      await updateTrack(bogusId, { slug: "whatever", title: "x", promise: "x", outcome: "x", position: 0, courseIds: [] }),
    ).toEqual({ ok: false, message: "Track not found." });
    expect(await publishTrack(bogusId)).toEqual({ ok: false, message: "Track not found." });
    expect(await unpublishTrack(bogusId)).toEqual({ ok: false, message: "Track not found." });
    expect(await deleteTrack(bogusId)).toEqual({ ok: false, message: "Track not found." });
  });
});

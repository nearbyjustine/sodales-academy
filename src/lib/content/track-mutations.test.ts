import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { course, enrollment, track, trackCourse } from "@/db/schema";

/**
 * Only `@/lib/session` and `next/cache` are mocked, narrowly, for the same two
 * reasons the sibling integration suites document: `@neondatabase/auth` has a
 * bare `next/headers` import Node's strict ESM loader can't resolve outside
 * Next's bundler, and `revalidatePath` throws outside a request context.
 * Everything else runs against the real database.
 */
const mockRequireUser = vi.fn();
vi.mock("@/lib/session", () => ({
  requireUser: () => mockRequireUser(),
  requireRole: vi.fn(),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const { enrollInTrack } = await import("./mutations");

const P = "track-mutations-test";
const TRACK_SLUG = `${P}-track`;
const DRAFT_SLUG = `${P}-draft`;
const COURSE_A = `${P}-course-a`;
const COURSE_B = `${P}-course-b`;
const LEARNER = `${P}-learner`;

const learner = { userId: LEARNER, name: "L", email: "l@x.test", initials: "L", role: "learner" };

let courseIds: string[] = [];

beforeAll(async () => {
  const rows = await db.insert(course).values([
    { slug: COURSE_A, title: "A", description: "d", category: "T", level: "beginner", status: "published", instructorUserId: `${P}-ins` },
    { slug: COURSE_B, title: "B", description: "d", category: "T", level: "beginner", status: "published", instructorUserId: `${P}-ins` },
  ]).returning();
  courseIds = rows.map((r) => r.id);

  const [t] = await db.insert(track).values({
    slug: TRACK_SLUG, title: "T", promise: "p", outcome: "o", status: "published", position: 0,
  }).returning();
  await db.insert(track).values({
    slug: DRAFT_SLUG, title: "D", promise: "p", outcome: "o", status: "draft", position: 1,
  });

  await db.insert(trackCourse).values(rows.map((r, i) => ({ trackId: t.id, courseId: r.id, position: i })));
});

afterAll(async () => {
  await db.delete(enrollment).where(inArray(enrollment.courseId, courseIds));
  await db.delete(track).where(eq(track.slug, TRACK_SLUG));
  await db.delete(track).where(eq(track.slug, DRAFT_SLUG));
  await db.delete(course).where(inArray(course.id, courseIds));
});

describe("enrollInTrack", () => {
  it("creates exactly one enrollment per course in the track", async () => {
    mockRequireUser.mockResolvedValue(learner);

    const result = await enrollInTrack(TRACK_SLUG);
    expect(result.ok).toBe(true);

    const rows = await db
      .select()
      .from(enrollment)
      .where(and(inArray(enrollment.courseId, courseIds), eq(enrollment.userId, LEARNER)));
    expect(rows).toHaveLength(2);
  });

  it("is idempotent — enrolling twice changes nothing", async () => {
    mockRequireUser.mockResolvedValue(learner);

    await enrollInTrack(TRACK_SLUG);
    const result = await enrollInTrack(TRACK_SLUG);
    expect(result.ok).toBe(true);

    const rows = await db
      .select()
      .from(enrollment)
      .where(and(inArray(enrollment.courseId, courseIds), eq(enrollment.userId, LEARNER)));
    expect(rows).toHaveLength(2);
  });

  it("reports a real failure for an unknown track", async () => {
    mockRequireUser.mockResolvedValue(learner);

    const result = await enrollInTrack(`${P}-does-not-exist`);
    expect(result).toEqual({ ok: false, message: "Track not found." });
  });

  it("refuses to enrol a learner in a draft track", async () => {
    mockRequireUser.mockResolvedValue(learner);

    const result = await enrollInTrack(DRAFT_SLUG);
    expect(result.ok).toBe(false);
  });

  it("rejects an unauthenticated caller", async () => {
    mockRequireUser.mockRejectedValue(new Error("redirect to /login"));
    await expect(enrollInTrack(TRACK_SLUG)).rejects.toThrow();
  });
});

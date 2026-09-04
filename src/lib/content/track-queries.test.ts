import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { course, courseModule, enrollment, lesson, lessonProgress, track, trackCourse, userProfile } from "@/db/schema";
import { getFullyEnrolledTrackSlugs, getTrackBySlug, getTracks, getTracksForAdmin, getTracksForCourse } from "./queries";
import type { Session } from "@/lib/session";

const P = "track-queries-test";
const PUBLISHED = `${P}-published`;
const DRAFT = `${P}-draft`;
const WITH_DRAFT_COURSE = `${P}-with-draft-course`;
const COURSE_A = `${P}-course-a`;
const COURSE_B = `${P}-course-b`;
const COURSE_DRAFT = `${P}-course-draft`;
const ORPHAN_COURSE = `${P}-orphan`;
const INSTRUCTOR = `${P}-instructor`;
const LEARNER = `${P}-learner`;

const adminSession: Session = {
  userId: `${P}-admin`, name: "Admin", email: "a@x.test", initials: "A", role: "admin",
};
const learnerSession: Session = {
  userId: LEARNER, name: "Learner", email: "l@x.test", initials: "L", role: "learner",
};

beforeAll(async () => {
  // `user_profile` has NO email column — userId, name, role only. Verified
  // against src/db/schema/user.ts; do not add one here.
  await db.insert(userProfile).values({ userId: INSTRUCTOR, name: "Ins", role: "instructor" }).onConflictDoNothing();

  const [ca] = await db.insert(course).values({
    slug: COURSE_A, title: "Course A", description: "d", category: "Testing",
    level: "beginner", status: "published", instructorUserId: INSTRUCTOR,
  }).returning();
  const [cb] = await db.insert(course).values({
    slug: COURSE_B, title: "Course B", description: "d", category: "Testing",
    level: "beginner", status: "published", instructorUserId: INSTRUCTOR,
  }).returning();
  const [cDraft] = await db.insert(course).values({
    slug: COURSE_DRAFT, title: "Course Draft", description: "d", category: "Testing",
    level: "beginner", status: "draft", instructorUserId: INSTRUCTOR,
  }).returning();

  const [ma] = await db.insert(courseModule).values({ courseId: ca.id, title: "M", position: 0 }).returning();
  const lessons = await db.insert(lesson).values([
    { moduleId: ma.id, courseId: ca.id, slug: "l1", title: "L1", content: "x", position: 0 },
    { moduleId: ma.id, courseId: ca.id, slug: "l2", title: "L2", content: "x", position: 1 },
  ]).returning();

  // Learner has completed exactly one of Course A's two lessons.
  await db.insert(lessonProgress).values({ lessonId: lessons[0].id, userId: LEARNER });

  const [pub] = await db.insert(track).values({
    slug: PUBLISHED, title: "Published Track", promise: "p", outcome: "o",
    status: "published", position: 0,
  }).returning();
  await db.insert(track).values({
    slug: DRAFT, title: "Draft Track", promise: "p", outcome: "o", status: "draft", position: 1,
  });

  // Inserted out of order on purpose: reads must order by `position`, not insertion.
  await db.insert(trackCourse).values([
    { trackId: pub.id, courseId: cb.id, position: 1 },
    { trackId: pub.id, courseId: ca.id, position: 0 },
  ]);

  // A separate published track (kept apart from `pub` above so it doesn't
  // perturb `getTracks`'s course/lesson-count assertions, which are out of
  // scope for this fix) with a draft course linked in — must stay invisible
  // to non-admin viewers (Fix 1).
  const [withDraft] = await db.insert(track).values({
    slug: WITH_DRAFT_COURSE, title: "Track With Draft Course", promise: "p", outcome: "o",
    status: "published", position: 2,
  }).returning();
  await db.insert(trackCourse).values([
    { trackId: withDraft.id, courseId: ca.id, position: 0 },
    { trackId: withDraft.id, courseId: cDraft.id, position: 1 },
  ]);
});

afterAll(async () => {
  await db.delete(track).where(eq(track.slug, PUBLISHED));
  await db.delete(track).where(eq(track.slug, DRAFT));
  await db.delete(track).where(eq(track.slug, WITH_DRAFT_COURSE));
  await db.delete(course).where(eq(course.slug, COURSE_A));
  await db.delete(course).where(eq(course.slug, COURSE_B));
  await db.delete(course).where(eq(course.slug, COURSE_DRAFT));
  await db.delete(course).where(eq(course.slug, ORPHAN_COURSE));
  await db.delete(userProfile).where(eq(userProfile.userId, INSTRUCTOR));
});

describe("getTracks", () => {
  it("returns published tracks with course and lesson counts", async () => {
    const tracks = await getTracks();
    const found = tracks.find((t) => t.slug === PUBLISHED);

    expect(found).toBeDefined();
    expect(found!.courseCount).toBe(2);
    expect(found!.lessonCount).toBe(2);
  });

  it("never returns a draft track", async () => {
    const tracks = await getTracks();
    expect(tracks.find((t) => t.slug === DRAFT)).toBeUndefined();
  });

  it("does not inflate course/lesson counts with a draft course (Fix 1)", async () => {
    // WITH_DRAFT_COURSE links a published course (COURSE_A, 2 lessons) and a
    // draft course (COURSE_DRAFT). The raw aggregate over every link would
    // report 2 courses; a signed-out visitor must see the same numbers here
    // that getTrackBySlug shows them on click-through, or the mismatch itself
    // leaks the existence of a hidden course. Revert the `showDrafts` filter
    // in `toTrackSummaries`'s query to see this fail (2 courses / more lessons
    // vs. the 1 course / 2 lessons `getTrackBySlug` reports).
    const tracks = await getTracks();
    const summary = tracks.find((t) => t.slug === WITH_DRAFT_COURSE);
    const detail = await getTrackBySlug(WITH_DRAFT_COURSE, null);

    expect(summary).toBeDefined();
    expect(detail).not.toBeNull();
    expect(summary!.courseCount).toBe(detail!.courseCount);
    expect(summary!.lessonCount).toBe(detail!.lessonCount);
  });
});

describe("getTrackBySlug", () => {
  it("returns courses in position order", async () => {
    const found = await getTrackBySlug(PUBLISHED);
    expect(found!.courses.map((c) => c.slug)).toEqual([COURSE_A, COURSE_B]);
  });

  it("reports zero completion for a signed-out viewer", async () => {
    const found = await getTrackBySlug(PUBLISHED);
    expect(found!.courses[0].completedLessonCount).toBe(0);
  });

  it("reports real completion for the viewer who has it", async () => {
    const found = await getTrackBySlug(PUBLISHED, learnerSession);
    expect(found!.courses[0].completedLessonCount).toBe(1);
    expect(found!.courses[1].completedLessonCount).toBe(0);
  });

  it("hides a draft track from a signed-out viewer", async () => {
    expect(await getTrackBySlug(DRAFT)).toBeNull();
  });

  it("hides a draft track from a learner", async () => {
    expect(await getTrackBySlug(DRAFT, learnerSession)).toBeNull();
  });

  it("shows a draft track to an admin", async () => {
    const found = await getTrackBySlug(DRAFT, adminSession);
    expect(found?.slug).toBe(DRAFT);
  });

  it("hides a draft course linked into a published track from a signed-out viewer", async () => {
    const found = await getTrackBySlug(WITH_DRAFT_COURSE);
    expect(found!.courses.map((c) => c.slug)).toEqual([COURSE_A]);
    expect(found!.courses.some((c) => c.slug === COURSE_DRAFT)).toBe(false);
    // courseCount/lessonCount must agree with the (filtered) `courses` array.
    expect(found!.courseCount).toBe(1);
    expect(found!.lessonCount).toBe(2);
  });

  it("hides a draft course linked into a published track from a learner", async () => {
    const found = await getTrackBySlug(WITH_DRAFT_COURSE, learnerSession);
    expect(found!.courses.map((c) => c.slug)).toEqual([COURSE_A]);
    expect(found!.courses.some((c) => c.slug === COURSE_DRAFT)).toBe(false);
    expect(found!.courseCount).toBe(1);
  });

  it("shows a draft course linked into a published track to an admin", async () => {
    const found = await getTrackBySlug(WITH_DRAFT_COURSE, adminSession);
    expect(found!.courses.map((c) => c.slug).sort()).toEqual([COURSE_A, COURSE_DRAFT].sort());
    expect(found!.courseCount).toBe(2);
  });
});

describe("getTracksForAdmin", () => {
  it("includes drafts", async () => {
    const tracks = await getTracksForAdmin(adminSession);
    expect(tracks.find((t) => t.slug === DRAFT)).toBeDefined();
  });

  it("returns an empty array for a non-admin viewer", async () => {
    const tracks = await getTracksForAdmin(learnerSession);
    expect(tracks).toEqual([]);
  });
});

describe("getTracksForCourse", () => {
  it("returns the published tracks a course belongs to", async () => {
    // COURSE_B (unlike COURSE_A) sits in exactly one track (PUBLISHED) per the
    // beforeAll fixtures above — COURSE_A is also linked into
    // WITH_DRAFT_COURSE, which would make this assertion about a *single*
    // track membership fail for the wrong reason.
    const [c] = await db.select().from(course).where(eq(course.slug, COURSE_B));
    const tracks = await getTracksForCourse(c.id);
    expect(tracks.map((t) => t.slug)).toEqual([PUBLISHED]);
  });

  it("returns an empty list for a course in no track", async () => {
    const [orphan] = await db
      .insert(course)
      .values({
        slug: ORPHAN_COURSE, title: "Orphan", description: "d", category: "Testing",
        level: "beginner", status: "published", instructorUserId: INSTRUCTOR,
      })
      .returning();

    expect(await getTracksForCourse(orphan.id)).toEqual([]);
  });

  it("omits a draft track a course belongs to", async () => {
    // A course in a draft track must not advertise that track on its public
    // page — that would leak an unreleased track's title and slug. Uses
    // COURSE_B (see note above) so the only other membership is PUBLISHED.
    const [c] = await db.select().from(course).where(eq(course.slug, COURSE_B));
    const [draft] = await db.select().from(track).where(eq(track.slug, DRAFT));
    await db.insert(trackCourse).values({ trackId: draft.id, courseId: c.id, position: 0 });

    const tracks = await getTracksForCourse(c.id);
    expect(tracks.map((t) => t.slug)).toEqual([PUBLISHED]);
  });
});

describe("getFullyEnrolledTrackSlugs", () => {
  const FULL_LEARNER = `${P}-full-learner`;
  const PARTIAL_LEARNER = `${P}-partial-learner`;
  const NO_ENROLLMENT_LEARNER = `${P}-no-enrollment-learner`;
  const ZERO_COURSE_TRACK = `${P}-zero-course-track`;

  beforeAll(async () => {
    const [ca] = await db.select().from(course).where(eq(course.slug, COURSE_A));
    const [cb] = await db.select().from(course).where(eq(course.slug, COURSE_B));
    const [draft] = await db.select().from(track).where(eq(track.slug, DRAFT));

    // FULL_LEARNER is enrolled in every course PUBLISHED links (Course A + B).
    await db.insert(enrollment).values([
      { courseId: ca.id, userId: FULL_LEARNER },
      { courseId: cb.id, userId: FULL_LEARNER },
    ]);

    // PARTIAL_LEARNER is enrolled in only one of PUBLISHED's two courses.
    await db.insert(enrollment).values({ courseId: ca.id, userId: PARTIAL_LEARNER });

    // Link DRAFT to Course A too (in addition to whatever `getTracksForCourse`'s
    // "omits a draft track" test above already linked) so FULL_LEARNER is
    // enrolled in every course DRAFT links, regardless of file execution order —
    // the test below must fail because of the status filter, not because DRAFT
    // happens to have an unenrolled course.
    await db.insert(trackCourse).values({ trackId: draft.id, courseId: ca.id, position: 1 });

    // A published track with zero linked courses — nothing to be "fully
    // enrolled" in, so it must never qualify no matter who asks.
    await db.insert(track).values({
      slug: ZERO_COURSE_TRACK, title: "Zero Course Track", promise: "p", outcome: "o",
      status: "published", position: 3,
    });
  });

  afterAll(async () => {
    await db.delete(enrollment).where(eq(enrollment.userId, FULL_LEARNER));
    await db.delete(enrollment).where(eq(enrollment.userId, PARTIAL_LEARNER));
    await db.delete(track).where(eq(track.slug, ZERO_COURSE_TRACK));
  });

  it("returns a track the user is fully enrolled in", async () => {
    const slugs = await getFullyEnrolledTrackSlugs(FULL_LEARNER);
    expect(slugs).toContain(PUBLISHED);
  });

  it("omits a track the user is only partially enrolled in", async () => {
    const slugs = await getFullyEnrolledTrackSlugs(PARTIAL_LEARNER);
    expect(slugs).not.toContain(PUBLISHED);
  });

  it("omits a published track with zero linked courses, even for a user enrolled in everything else", async () => {
    const slugs = await getFullyEnrolledTrackSlugs(FULL_LEARNER);
    expect(slugs).not.toContain(ZERO_COURSE_TRACK);
  });

  it("omits a draft track even when the user is enrolled in every course it links", async () => {
    const slugs = await getFullyEnrolledTrackSlugs(FULL_LEARNER);
    expect(slugs).not.toContain(DRAFT);
  });

  it("returns an empty list for a user enrolled in nothing", async () => {
    expect(await getFullyEnrolledTrackSlugs(NO_ENROLLMENT_LEARNER)).toEqual([]);
  });
});

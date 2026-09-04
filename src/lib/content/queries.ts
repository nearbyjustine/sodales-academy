import "server-only";
import { eq, and, or, ilike, asc, inArray, count, sql } from "drizzle-orm";
import { db } from "@/db";
import { course, courseModule, enrollment, lesson, lessonProgress, track, trackCourse, userProfile } from "@/db/schema";
import type { Session } from "@/lib/session";
import { canManageCourse } from "./authz";
import type {
  CourseDetail,
  CourseModule,
  CourseSummary,
  Lesson,
  Level,
  TrackCourse,
  TrackDetail,
  TrackSummary,
} from "./types";

export type LessonRef = { courseSlug: string; slug: string; title: string };

export type LessonWithNav = Lesson & {
  course: CourseSummary;
  modules: CourseModule[];
  prev: LessonRef | null;
  next: LessonRef | null;
};

/**
 * PHASE 2 SEAM — real implementation. Signatures unchanged from Phase 1.
 */

export async function getCourses(
  filters: { q?: string; level?: Level } = {},
): Promise<CourseSummary[]> {
  const conditions = [eq(course.status, "published")];
  if (filters.level) conditions.push(eq(course.level, filters.level));

  const q = filters.q?.trim();
  const rows = await db
    .select()
    .from(course)
    .where(
      q
        ? and(...conditions, or(ilike(course.title, `%${q}%`), ilike(course.description, `%${q}%`)))
        : and(...conditions),
    );

  return toSummariesWithCounts(rows);
}

export async function getCourseBySlug(slug: string): Promise<CourseDetail | null> {
  const [row] = await db.select().from(course).where(eq(course.slug, slug));
  if (!row || row.status !== "published") return null;
  return toDetail(row);
}

/**
 * Status-agnostic variant of `getCourseBySlug` for admin use (e.g. the course edit page), where a
 * draft course must remain visible to whoever can manage it. `getCourseBySlug` itself stays
 * published-only — the public catalog/lesson pages must never surface a draft.
 */
export async function getCourseBySlugForAdmin(slug: string): Promise<CourseDetail | null> {
  const [row] = await db.select().from(course).where(eq(course.slug, slug));
  if (!row) return null;
  return toDetail(row);
}

/**
 * Admin/instructor course listing (spec §8's ownership invariant applies to the LISTING, not just
 * the mutations behind it): an admin sees every course; an instructor sees only courses whose
 * `instructor_user_id` is their own. Without this filter an instructor could see every peer's
 * course titles/categories/statuses, including unpublished drafts, even though they could never
 * actually act on them.
 */
export async function getAllCourses(viewer: Session): Promise<CourseSummary[]> {
  const rows =
    viewer.role === "admin"
      ? await db.select().from(course)
      : await db.select().from(course).where(eq(course.instructorUserId, viewer.userId));
  return toSummariesWithCounts(rows);
}

export async function getLesson(
  courseSlug: string,
  lessonSlug: string,
  viewer: Session | null,
): Promise<LessonWithNav | null> {
  const detail = await getCourseBySlug(courseSlug);
  if (!detail) return null;

  const flat = detail.modules.flatMap((m) => m.lessons);
  const index = flat.findIndex((l) => l.slug === lessonSlug);
  if (index === -1) return null;

  const target = flat[index];
  const canAccess =
    target.isPreview ||
    (viewer !== null &&
      ((await isEnrolled(detail.id, viewer.userId)) || (await canManageCourse(detail.id, viewer))));

  if (!canAccess) return null;

  const { modules: _modules, ...summary } = detail;

  return {
    ...target,
    course: summary,
    // `modules` backs the client-rendered lesson sidebar (title/slug/isPreview only — see
    // `LessonSidebar`), which never needs any lesson's body text. `canAccess` above only gates the
    // *target* lesson's own `content`; without stripping it here too, every other lesson's full
    // content — including non-preview ones the viewer was never checked against — would ride along
    // in this array and get serialized into the client component's RSC payload regardless.
    modules: withoutLessonContent(detail.modules),
    prev: index > 0 ? toRef(flat[index - 1]) : null,
    next: index < flat.length - 1 ? toRef(flat[index + 1]) : null,
  };
}

function withoutLessonContent(modules: CourseModule[]): CourseModule[] {
  return modules.map((m) => ({
    ...m,
    lessons: m.lessons.map((l) => ({ ...l, content: "" })),
  }));
}

export async function getCatalogStats(): Promise<{
  courses: number;
  lessons: number;
  categories: number;
}> {
  const published = await db.select().from(course).where(eq(course.status, "published"));
  if (published.length === 0) return { courses: 0, lessons: 0, categories: 0 };

  const [{ value: lessonCount }] = await db
    .select({ value: count() })
    .from(lesson)
    .where(
      inArray(
        lesson.courseId,
        published.map((c) => c.id),
      ),
    );

  return {
    courses: published.length,
    lessons: lessonCount,
    categories: new Set(published.map((c) => c.category)).size,
  };
}

export async function isEnrolled(courseId: string, userId: string): Promise<boolean> {
  const [row] = await db
    .select({ id: enrollment.id })
    .from(enrollment)
    .where(and(eq(enrollment.courseId, courseId), eq(enrollment.userId, userId)));
  return Boolean(row);
}

export async function getCompletedLessonIds(
  userId: string,
  lessonIds: string[],
): Promise<Set<string>> {
  if (lessonIds.length === 0) return new Set();

  const rows = await db
    .select({ lessonId: lessonProgress.lessonId })
    .from(lessonProgress)
    .where(and(eq(lessonProgress.userId, userId), inArray(lessonProgress.lessonId, lessonIds)));

  return new Set(rows.map((r) => r.lessonId));
}

/**
 * Batched replacement for what used to be one `resolveInstructorName` + one `countLessons` query
 * PER course row (2N+1 total for N courses). Collapses to 2 queries total regardless of N: one
 * grouped lesson count across every course id, one instructor-name lookup across every distinct
 * instructor id — both `inArray`, both independent of `rows.length`.
 */
async function toSummariesWithCounts(rows: (typeof course.$inferSelect)[]): Promise<CourseSummary[]> {
  if (rows.length === 0) return [];

  const courseIds = rows.map((r) => r.id);
  const instructorIds = [...new Set(rows.map((r) => r.instructorUserId))];

  const [counts, profiles] = await Promise.all([
    db
      .select({ courseId: lesson.courseId, value: count() })
      .from(lesson)
      .where(inArray(lesson.courseId, courseIds))
      .groupBy(lesson.courseId),
    db
      .select({ userId: userProfile.userId, name: userProfile.name })
      .from(userProfile)
      .where(inArray(userProfile.userId, instructorIds)),
  ]);

  const lessonCountByCourseId = new Map(counts.map((c) => [c.courseId, c.value]));
  const nameByInstructorId = new Map(profiles.map((p) => [p.userId, p.name]));

  return rows.map((row) => ({
    id: row.id,
    slug: row.slug,
    title: row.title,
    description: row.description,
    category: row.category,
    level: row.level,
    status: row.status,
    instructorName: nameByInstructorId.get(row.instructorUserId) ?? "Unknown instructor",
    lessonCount: lessonCountByCourseId.get(row.id) ?? 0,
  }));
}

async function toDetail(row: typeof course.$inferSelect): Promise<CourseDetail> {
  const [[summary], modules, lessons] = await Promise.all([
    toSummariesWithCounts([row]),
    db.select().from(courseModule).where(eq(courseModule.courseId, row.id)).orderBy(asc(courseModule.position)),
    // One query for every lesson in the course instead of one query per module — grouped by
    // module id in JS below, same N+1 fix as `toSummariesWithCounts` above.
    db.select().from(lesson).where(eq(lesson.courseId, row.id)).orderBy(asc(lesson.position)),
  ]);

  const lessonsByModuleId = new Map<string, typeof lessons>();
  for (const l of lessons) {
    const bucket = lessonsByModuleId.get(l.moduleId);
    if (bucket) bucket.push(l);
    else lessonsByModuleId.set(l.moduleId, [l]);
  }

  const modulesWithLessons: CourseModule[] = modules.map((m) => ({
    id: m.id,
    title: m.title,
    position: m.position,
    lessons: (lessonsByModuleId.get(m.id) ?? []).map((l) => ({
      id: l.id,
      courseSlug: row.slug,
      slug: l.slug,
      title: l.title,
      moduleTitle: m.title,
      position: l.position,
      isPreview: l.isPreview,
      content: l.content,
    })),
  }));

  return { ...summary, modules: modulesWithLessons };
}

function toRef(lesson: Lesson): LessonRef {
  return { courseSlug: lesson.courseSlug, slug: lesson.slug, title: lesson.title };
}

/** A track is visible to a non-admin only once published. Admins see drafts so
 *  they can preview a track before releasing it — the same rule
 *  `getCourseBySlug`/`getCourseBySlugForAdmin` split on for courses. */
function canSeeDraftTracks(viewer?: Session | null): boolean {
  return viewer?.role === "admin";
}

/**
 * Two queries total regardless of how many tracks or courses exist: one for the
 * tracks, one grouped aggregate for their counts. Do not turn this into a
 * per-track lookup.
 */
async function toTrackSummaries(rows: (typeof track.$inferSelect)[]): Promise<TrackSummary[]> {
  if (rows.length === 0) return [];

  const trackIds = rows.map((r) => r.id);

  const counts = await db
    .select({
      trackId: trackCourse.trackId,
      courseCount: sql<number>`count(distinct ${trackCourse.courseId})`.mapWith(Number),
      lessonCount: sql<number>`count(${lesson.id})`.mapWith(Number),
    })
    .from(trackCourse)
    .leftJoin(lesson, eq(lesson.courseId, trackCourse.courseId))
    .where(inArray(trackCourse.trackId, trackIds))
    .groupBy(trackCourse.trackId);

  const byTrackId = new Map(counts.map((c) => [c.trackId, c]));

  return rows.map((row) => ({
    id: row.id,
    slug: row.slug,
    title: row.title,
    promise: row.promise,
    outcome: row.outcome,
    status: row.status,
    position: row.position,
    courseCount: byTrackId.get(row.id)?.courseCount ?? 0,
    lessonCount: byTrackId.get(row.id)?.lessonCount ?? 0,
  }));
}

export async function getTracks(): Promise<TrackSummary[]> {
  const rows = await db
    .select()
    .from(track)
    .where(eq(track.status, "published"))
    .orderBy(asc(track.position), asc(track.id));
  return toTrackSummaries(rows);
}

/**
 * Admin/instructor track listing. Unlike `getAllCourses(viewer)` this is not
 * ownership-scoped: a track can contain courses owned by several instructors,
 * so there is no coherent single owner. Tracks are admin-managed — the caller
 * calls `requireRole("admin")` itself and passes the session in.
 */
export async function getTracksForAdmin(viewer: Session): Promise<TrackSummary[]> {
  if (viewer.role !== "admin") return [];
  const rows = await db.select().from(track).orderBy(asc(track.position), asc(track.id));
  return toTrackSummaries(rows);
}

export async function getTrackBySlug(
  slug: string,
  viewer?: Session | null,
): Promise<TrackDetail | null> {
  const [row] = await db.select().from(track).where(eq(track.slug, slug));
  if (!row) return null;
  if (row.status !== "published" && !canSeeDraftTracks(viewer)) return null;

  const links = await db
    .select({ courseId: trackCourse.courseId, position: trackCourse.position })
    .from(trackCourse)
    .where(eq(trackCourse.trackId, row.id))
    .orderBy(asc(trackCourse.position), asc(trackCourse.courseId));

  const [summary] = await toTrackSummaries([row]);
  if (links.length === 0) return { ...summary, courses: [] };

  const courseIds = links.map((l) => l.courseId);
  const showDrafts = canSeeDraftTracks(viewer);

  // Same rule `getCourseBySlug`/`getCourses` apply to the public catalog: a
  // DRAFT course must never surface its title/description/category/lessonCount
  // outside admin preview — even when an admin has linked it into an otherwise
  // PUBLISHED track. Filtered here in SQL (not by trimming the array afterward)
  // so the query count doesn't change regardless of how many courses a track has.
  // Reuses the existing batched helper — one grouped lesson count and one
  // instructor-name lookup for the whole set, not per course.
  const courseRows = await db
    .select()
    .from(course)
    .where(
      showDrafts
        ? inArray(course.id, courseIds)
        : and(inArray(course.id, courseIds), eq(course.status, "published")),
    );
  const summaries = await toSummariesWithCounts(courseRows);
  const summaryById = new Map(summaries.map((s) => [s.id, s]));

  // The viewer's completion per course, as one grouped query. Signed-out
  // viewers skip it entirely rather than querying for a user id that is null.
  const completionByCourseId = new Map<string, number>();
  if (viewer) {
    const completions = await db
      .select({ courseId: lesson.courseId, value: count() })
      .from(lessonProgress)
      .innerJoin(lesson, eq(lesson.id, lessonProgress.lessonId))
      .where(and(eq(lessonProgress.userId, viewer.userId), inArray(lesson.courseId, courseIds)))
      .groupBy(lesson.courseId);
    for (const c of completions) completionByCourseId.set(c.courseId, c.value);
  }

  const courses: TrackCourse[] = links.flatMap((link) => {
    const s = summaryById.get(link.courseId);
    if (!s) return [];
    return [{ ...s, position: link.position, completedLessonCount: completionByCourseId.get(link.courseId) ?? 0 }];
  });

  // `toTrackSummaries`'s `courseCount`/`lessonCount` aggregate every linked
  // course regardless of status — for a non-admin viewer that would disagree
  // with `courses` above (e.g. "3 courses" alongside only 2 listed), which is
  // worse than either number alone. Recomputed here from the same filtered set
  // backing `courses` so the two always agree; free of extra queries since
  // `courses`/`summaries` are already in hand. For an admin (who sees every
  // linked course including drafts) this recomputation lands on the same value
  // the unfiltered aggregate would have produced anyway.
  const courseCount = courses.length;
  const lessonCount = courses.reduce((sum, c) => sum + c.lessonCount, 0);

  return { ...summary, courseCount, lessonCount, courses };
}

/**
 * The published tracks a viewer is FULLY enrolled in — enrolled in every
 * course the track links, which is exactly what `enrollInTrack` produces.
 * Someone who bought one course that happens to sit in a track has not
 * bought the track, and the dashboard must not imply they have.
 *
 * A single grouped query (fixed cost regardless of catalog size — see the
 * N+1 fix this replaced in the dashboard, same class of problem `0d1de0d`
 * removed from `getCourses`/`getCatalogStats`): start from every published
 * track, LEFT JOIN its course links, LEFT JOIN this user's enrollments
 * against those links, then compare the two counts per track. A track with
 * zero linked courses has `courseCount === 0 === enrolledCount` — trivially
 * "equal" — so the `courseCount > 0` guard is load-bearing, not decorative:
 * drop it and an empty track would count as "fully enrolled".
 */
export async function getFullyEnrolledTrackSlugs(userId: string): Promise<string[]> {
  const rows = await db
    .select({
      slug: track.slug,
      courseCount: sql<number>`count(distinct ${trackCourse.courseId})`.mapWith(Number),
      enrolledCount: sql<number>`count(distinct ${enrollment.courseId})`.mapWith(Number),
    })
    .from(track)
    .leftJoin(trackCourse, eq(trackCourse.trackId, track.id))
    .leftJoin(
      enrollment,
      and(eq(enrollment.courseId, trackCourse.courseId), eq(enrollment.userId, userId)),
    )
    .where(eq(track.status, "published"))
    .groupBy(track.id, track.slug);

  return rows
    .filter((r) => r.courseCount > 0 && r.courseCount === r.enrolledCount)
    .map((r) => r.slug);
}

/**
 * The published tracks a course belongs to. A course may sit in several, so
 * this returns a list — a single-value version would silently pick one and
 * render a confidently wrong "you are here".
 */
export async function getTracksForCourse(
  courseId: string,
): Promise<Pick<TrackSummary, "slug" | "title">[]> {
  return db
    .select({ slug: track.slug, title: track.title })
    .from(trackCourse)
    .innerJoin(track, eq(track.id, trackCourse.trackId))
    .where(and(eq(trackCourse.courseId, courseId), eq(track.status, "published")))
    .orderBy(asc(track.position), asc(track.slug));
}

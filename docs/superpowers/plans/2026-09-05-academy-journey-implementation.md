# Academy Journey (Tracks) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the curriculum legible as an ordered climb — tracks of courses with a stated outcome — used as the pitch to a visitor who has not bought and as the map for a learner who has.

**Architecture:** Two new tables (`track`, `track_course`) sit *above* the existing enrolment model rather than replacing it. Enrolling in a track writes one ordinary `enrollment` row per member course, so `lesson_progress`, the dashboard, the lesson player and every existing query keep working untouched, and deleting a track can never destroy learner progress. All reads go through `src/lib/content/queries.ts`, all writes through `src/lib/content/mutations.ts`, and progress arithmetic lives in a pure module with no database access.

**Tech Stack:** Next.js 16 (App Router, Turbopack), React 19, Drizzle ORM on `drizzle-orm/neon-http`, Neon Postgres, Neon Auth, Tailwind v4, Base UI via shadcn, Vitest + Testing Library.

**Spec:** `docs/superpowers/specs/2026-09-05-academy-journey-design.md`

## Global Constraints

Copied verbatim from the spec and `CLAUDE.md`. Every task's requirements implicitly include this section.

- **The seam is absolute.** Pages, components and layouts never import `@/db`, `@/db/schema`, or the auth session directly. They go through `queries.ts` / `mutations.ts` / `session.ts`. Verify with `grep -rn "@/db" src` before assuming otherwise.
- **Every Server Action re-derives its own session server-side** and never trusts a client-supplied role, user id, or ownership claim.
- **Never fake success for a write that failed.** Mutations return `MutationResult` (`{ ok: true } | { ok: false; message: string }`); every client caller branches on `result.ok` and surfaces `result.message` via `toast.error(...)`.
- **`drizzle-orm/neon-http` does not support transactions.** `db.transaction(...)` throws synchronously. Multi-statement mutations run sequentially against `db` with a comment at the call site acknowledging the partial-write risk.
- **Next 16: `params`, `searchParams`, and `cookies()` are async.** `await` them.
- **`next lint` does not exist.** Run `pnpm lint`.
- **Inter only, weights 400 and 700.** No serif. No second typeface.
- **Electric Violet `#5E4FB3` is the only action colour.** Never violet text on Obsidian — use `text-violet-accessible` (`#887bd8`) on dark surfaces.
- **The wordmark renders only through `<BrandWordmark />`.**
- **26.2° is the brand shear axis** (`MARK_SHEAR` in `src/lib/brand/course-artwork.ts`), measured off the supplied artwork. Track artwork reuses it.
- **No invented proof.** No testimonials, no student work, no completion statistics, no fabricated numbers anywhere in this feature.
- **Tracks are admin-managed.** Every track write calls `requireRole("admin")`, not `requireRole("instructor", "admin")`.
- Test fixture rows are prefixed with the test file's own name and cleaned up in `afterAll`.

---

### Task 1: Track schema, types, and migration

**Files:**
- Create: `src/db/schema/track.ts`
- Modify: `src/db/schema/index.ts`
- Modify: `src/lib/content/types.ts`
- Create: `src/db/schema/track.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: Drizzle tables `track` and `trackCourse`; types `TrackStatus`, `TrackSummary`, `TrackCourse`, `TrackDetail`.

- [ ] **Step 1: Write the failing test**

Create `src/db/schema/track.test.ts`:

```ts
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
const TRACK_SLUG = `${P}-track`;
const COURSE_SLUG = `${P}-course`;
const USER = `${P}-user`;

afterAll(async () => {
  await db.delete(track).where(eq(track.slug, TRACK_SLUG));
  await db.delete(course).where(eq(course.slug, COURSE_SLUG));
});

async function seed() {
  const [t] = await db
    .insert(track)
    .values({
      slug: TRACK_SLUG,
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
      slug: COURSE_SLUG,
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
    const { t, c } = await seed();
    await expect(
      db.insert(trackCourse).values({ trackId: t.id, courseId: c.id, position: 1 }),
    ).rejects.toThrow();
  });

  it("deleting a track destroys no enrolment or lesson progress", async () => {
    const { t, c, l } = await seed();

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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/db/schema/track.test.ts`
Expected: FAIL — `track` and `trackCourse` are not exported from `@/db/schema`.

- [ ] **Step 3: Create the schema**

Create `src/db/schema/track.ts`:

```ts
import { pgTable, pgEnum, uuid, text, integer, timestamp, unique, index } from "drizzle-orm/pg-core";
import { course } from "./course";

export const trackStatus = pgEnum("track_status", ["draft", "published"]);

export const track = pgTable("track", {
  id: uuid("id").primaryKey().defaultRandom(),
  slug: text("slug").notNull().unique(),
  title: text("title").notNull(),
  /** One line, shown on cards and the hero. */
  promise: text("promise").notNull(),
  /** "You finish able to: ..." — the sell. Author-supplied copy. */
  outcome: text("outcome").notNull(),
  status: trackStatus("status").notNull().default("draft"),
  position: integer("position").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

/**
 * Join table only — it holds no learner data. That is why `track` cascades into
 * it safely: `enrollment` and `lesson_progress` are keyed to COURSES, not
 * tracks, so deleting a track can never destroy anyone's progress. This is the
 * load-bearing reason enrolment fans out to per-course rows instead of being
 * recorded against the track.
 */
export const trackCourse = pgTable(
  "track_course",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    trackId: uuid("track_id")
      .notNull()
      .references(() => track.id, { onDelete: "cascade" }),
    courseId: uuid("course_id")
      .notNull()
      .references(() => course.id, { onDelete: "cascade" }),
    position: integer("position").notNull(),
  },
  // `unique(track_id, course_id)` also serves track_id-alone lookups (track_id is
  // its leading column). The extra index is on (track_id, position) because every
  // read orders by position within a track.
  (table) => [
    unique().on(table.trackId, table.courseId),
    index().on(table.trackId, table.position),
  ],
);
```

- [ ] **Step 4: Export it from the schema barrel**

Modify `src/db/schema/index.ts` — add the new line, keeping the others:

```ts
export * from "./user";
export * from "./course";
export * from "./enrollment";
export * from "./invite";
export * from "./track";
```

- [ ] **Step 5: Add the shared types**

Append to `src/lib/content/types.ts`:

```ts
export type TrackStatus = "draft" | "published";

export type TrackSummary = {
  id: string;
  slug: string;
  title: string;
  promise: string;
  outcome: string;
  status: TrackStatus;
  position: number;
  courseCount: number;
  /** Total lessons across every course in the track. */
  lessonCount: number;
};

/** A course as it appears inside a track: its normal summary, plus position and
 *  the viewer's completion. `completedLessonCount` is 0 for a signed-out viewer. */
export type TrackCourse = CourseSummary & {
  position: number;
  completedLessonCount: number;
};

export type TrackDetail = TrackSummary & {
  courses: TrackCourse[];
};
```

- [ ] **Step 6: Typecheck, then generate and apply the migration**

```bash
pnpm typecheck
pnpm exec drizzle-kit generate
pnpm exec drizzle-kit migrate
```

Expected: typecheck passes; a new SQL file appears under `src/db/migrations/`; it applies to the `DATABASE_URL` database with no errors. Never hand-edit the generated SQL. If `drizzle-kit migrate` is not the installed version's command name, run `pnpm exec drizzle-kit --help` — prefer generate+migrate over `push` so a migration file is committed.

- [ ] **Step 7: Run the test to verify it passes**

Run: `pnpm vitest run src/db/schema/track.test.ts`
Expected: PASS — both tests.

- [ ] **Step 8: Commit**

```bash
git add src/db/schema/track.ts src/db/schema/index.ts src/db/schema/track.test.ts src/lib/content/types.ts src/db/migrations
git commit -m "feat: add track and track_course schema"
```

---

### Task 2: Pure track progress derivation

**Files:**
- Create: `src/lib/track-progress.ts`
- Create: `src/lib/track-progress.test.ts`

**Interfaces:**
- Consumes: `TrackCourse` from `@/lib/content/types` (Task 1).
- Produces: `type TrackProgress = { completedLessons: number; totalLessons: number; percent: number; completedCourses: number; totalCourses: number; nextCourse: TrackCourse | null }` and `function trackProgress(courses: TrackCourse[]): TrackProgress`.

This module is pure and has no database access, exactly like `src/lib/lesson-progress.ts`. That is deliberate: it must be importable from both Server Components and presentational components, and it must be unit-testable without a database.

- [ ] **Step 1: Write the failing test**

Create `src/lib/track-progress.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { trackProgress } from "./track-progress";
import type { TrackCourse } from "@/lib/content/types";

function makeCourse(overrides: Partial<TrackCourse> & { slug: string }): TrackCourse {
  return {
    id: overrides.slug,
    slug: overrides.slug,
    title: overrides.slug,
    description: "",
    category: "Testing",
    level: "beginner",
    status: "published",
    instructorName: "Someone",
    lessonCount: 0,
    position: 0,
    completedLessonCount: 0,
    ...overrides,
  };
}

describe("trackProgress", () => {
  it("reports zero for an empty track", () => {
    expect(trackProgress([])).toEqual({
      completedLessons: 0,
      totalLessons: 0,
      percent: 0,
      completedCourses: 0,
      totalCourses: 0,
      nextCourse: null,
    });
  });

  it("sums lessons across courses and rounds the percentage", () => {
    const result = trackProgress([
      makeCourse({ slug: "a", lessonCount: 4, completedLessonCount: 4, position: 0 }),
      makeCourse({ slug: "b", lessonCount: 5, completedLessonCount: 1, position: 1 }),
    ]);

    expect(result.completedLessons).toBe(5);
    expect(result.totalLessons).toBe(9);
    expect(result.percent).toBe(56); // 5/9 = 55.55… → 56
    expect(result.completedCourses).toBe(1);
    expect(result.totalCourses).toBe(2);
    expect(result.nextCourse?.slug).toBe("b");
  });

  it("has no next course when every course is finished", () => {
    const result = trackProgress([
      makeCourse({ slug: "a", lessonCount: 2, completedLessonCount: 2, position: 0 }),
    ]);

    expect(result.percent).toBe(100);
    expect(result.nextCourse).toBeNull();
  });

  it("never divides by zero when a track has courses but no lessons", () => {
    const result = trackProgress([makeCourse({ slug: "a", lessonCount: 0, position: 0 })]);
    expect(result.percent).toBe(0);
  });

  it("treats a lessonless course as neither complete nor next", () => {
    // A course with no lessons yet must not inflate completedCourses (0 === 0 is
    // technically "all done") and must not be offered as the next thing to do,
    // because there is nothing there to do.
    const result = trackProgress([
      makeCourse({ slug: "empty", lessonCount: 0, position: 0 }),
      makeCourse({ slug: "real", lessonCount: 3, completedLessonCount: 0, position: 1 }),
    ]);

    expect(result.completedCourses).toBe(0);
    expect(result.nextCourse?.slug).toBe("real");
  });

  it("picks the next course by position, not array order", () => {
    const result = trackProgress([
      makeCourse({ slug: "second", lessonCount: 2, completedLessonCount: 0, position: 1 }),
      makeCourse({ slug: "first", lessonCount: 2, completedLessonCount: 0, position: 0 }),
    ]);

    expect(result.nextCourse?.slug).toBe("first");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/lib/track-progress.test.ts`
Expected: FAIL — cannot resolve `./track-progress`.

- [ ] **Step 3: Write the implementation**

Create `src/lib/track-progress.ts`:

```ts
import type { TrackCourse } from "@/lib/content/types";

/**
 * Pure, framework-agnostic derivation over server-fetched track data — the same
 * contract as `lesson-progress.ts`. No database access and no hooks, so it is
 * importable from Server Components and presentational components alike, and
 * testable without a database.
 */

export type TrackProgress = {
  completedLessons: number;
  totalLessons: number;
  /** 0–100, rounded. 0 when the track has no lessons at all. */
  percent: number;
  completedCourses: number;
  totalCourses: number;
  /** The single unambiguous "continue here". Null when nothing is left to do. */
  nextCourse: TrackCourse | null;
};

/** A course counts only once it has lessons AND all of them are complete. A
 *  lessonless course is not "finished" — there is nothing there to finish. */
function isComplete(c: TrackCourse): boolean {
  return c.lessonCount > 0 && c.completedLessonCount >= c.lessonCount;
}

export function trackProgress(courses: TrackCourse[]): TrackProgress {
  const ordered = [...courses].sort((a, b) => a.position - b.position);

  const totalLessons = ordered.reduce((n, c) => n + c.lessonCount, 0);
  const completedLessons = ordered.reduce(
    // Clamp: a stale or duplicated progress row must never report more done
    // than exist, which would push percent above 100.
    (n, c) => n + Math.min(c.completedLessonCount, c.lessonCount),
    0,
  );

  return {
    completedLessons,
    totalLessons,
    percent: totalLessons === 0 ? 0 : Math.round((completedLessons / totalLessons) * 100),
    completedCourses: ordered.filter(isComplete).length,
    totalCourses: ordered.length,
    nextCourse: ordered.find((c) => c.lessonCount > 0 && !isComplete(c)) ?? null,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run src/lib/track-progress.test.ts`
Expected: PASS — all six tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/track-progress.ts src/lib/track-progress.test.ts
git commit -m "feat: add pure track progress derivation"
```

---

### Task 3: Track reads

**Files:**
- Modify: `src/lib/content/queries.ts`
- Create: `src/lib/content/track-queries.test.ts`

**Interfaces:**
- Consumes: `track`, `trackCourse` (Task 1); `TrackSummary`, `TrackDetail`, `TrackCourse` (Task 1); the existing private helper `toSummariesWithCounts` in the same file; `Session` from `@/lib/session`.
- Produces:
  - `getTracks(): Promise<TrackSummary[]>`
  - `getTrackBySlug(slug: string, viewer?: Session | null): Promise<TrackDetail | null>`
  - `getTracksForAdmin(viewer: Session): Promise<TrackSummary[]>`

Each read must stay O(1) in queries regardless of track/course count. The recent `getCourses`/`getCatalogStats` work removed N+1 fan-out; do not reintroduce it.

- [ ] **Step 1: Write the failing test**

Create `src/lib/content/track-queries.test.ts`:

```ts
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { course, courseModule, lesson, lessonProgress, track, trackCourse, userProfile } from "@/db/schema";
import { getTrackBySlug, getTracks, getTracksForAdmin } from "./queries";
import type { Session } from "@/lib/session";

const P = "track-queries-test";
const PUBLISHED = `${P}-published`;
const DRAFT = `${P}-draft`;
const COURSE_A = `${P}-course-a`;
const COURSE_B = `${P}-course-b`;
const INSTRUCTOR = `${P}-instructor`;
const LEARNER = `${P}-learner`;

const adminSession: Session = {
  userId: `${P}-admin`, name: "Admin", email: "a@x.test", initials: "A", role: "admin",
};
const learnerSession: Session = {
  userId: LEARNER, name: "Learner", email: "l@x.test", initials: "L", role: "learner",
};

beforeAll(async () => {
  await db.insert(userProfile).values({ userId: INSTRUCTOR, name: "Ins", email: "i@x.test", role: "instructor" }).onConflictDoNothing();

  const [ca] = await db.insert(course).values({
    slug: COURSE_A, title: "Course A", description: "d", category: "Testing",
    level: "beginner", status: "published", instructorUserId: INSTRUCTOR,
  }).returning();
  const [cb] = await db.insert(course).values({
    slug: COURSE_B, title: "Course B", description: "d", category: "Testing",
    level: "beginner", status: "published", instructorUserId: INSTRUCTOR,
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
});

afterAll(async () => {
  await db.delete(track).where(eq(track.slug, PUBLISHED));
  await db.delete(track).where(eq(track.slug, DRAFT));
  await db.delete(course).where(eq(course.slug, COURSE_A));
  await db.delete(course).where(eq(course.slug, COURSE_B));
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
});

describe("getTracksForAdmin", () => {
  it("includes drafts", async () => {
    const tracks = await getTracksForAdmin(adminSession);
    expect(tracks.find((t) => t.slug === DRAFT)).toBeDefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/lib/content/track-queries.test.ts`
Expected: FAIL — `getTracks` is not exported from `./queries`.

- [ ] **Step 3: Write the implementation**

In `src/lib/content/queries.ts`, extend the existing import lines to include the new tables and types, then append the three reads at the end of the file:

```ts
// Add `track, trackCourse` to the existing `@/db/schema` import.
// Add `TrackCourse, TrackDetail, TrackSummary` to the existing `./types` import.
// Add `sql` to the existing `drizzle-orm` import.

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

  // Reuses the existing batched helper — one grouped lesson count and one
  // instructor-name lookup for the whole set, not per course.
  const courseRows = await db.select().from(course).where(inArray(course.id, courseIds));
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

  return { ...summary, courses };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run src/lib/content/track-queries.test.ts`
Expected: PASS — all nine tests.

- [ ] **Step 5: Typecheck and lint**

```bash
pnpm typecheck && pnpm lint
```

Expected: typecheck clean; lint reports only the two pre-existing warnings in `sign-out-button.tsx` and `queries.ts:93`.

- [ ] **Step 6: Commit**

```bash
git add src/lib/content/queries.ts src/lib/content/track-queries.test.ts
git commit -m "feat: add track reads to the query seam"
```

---

### Task 4: `enrollInTrack`

**Files:**
- Modify: `src/lib/content/mutations.ts`
- Create: `src/lib/content/track-mutations.test.ts`

**Interfaces:**
- Consumes: `track`, `trackCourse` (Task 1); `requireUser` from `@/lib/session`; `MutationResult` from the same file.
- Produces: `enrollInTrack(trackSlug: string): Promise<MutationResult>`.

- [ ] **Step 1: Write the failing test**

Create `src/lib/content/track-mutations.test.ts`:

```ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/lib/content/track-mutations.test.ts`
Expected: FAIL — `enrollInTrack` is not exported from `./mutations`.

- [ ] **Step 3: Write the implementation**

Add `track, trackCourse` to the existing `@/db/schema` import in `src/lib/content/mutations.ts`, then append:

```ts
export async function enrollInTrack(trackSlug: string): Promise<MutationResult> {
  const viewer = await requireUser();

  const [row] = await db
    .select({ id: track.id, status: track.status })
    .from(track)
    .where(eq(track.slug, trackSlug));
  if (!row) return { ok: false, message: "Track not found." };

  // A draft track is not for sale. Admins can preview it via `getTrackBySlug`,
  // but nobody enrols in something that hasn't been released.
  if (row.status !== "published" && viewer.role !== "admin") {
    return { ok: false, message: "That track isn't available yet." };
  }

  const links = await db
    .select({ courseId: trackCourse.courseId })
    .from(trackCourse)
    .where(eq(trackCourse.trackId, row.id));

  if (links.length === 0) return { ok: false, message: "That track has no courses yet." };

  // `neon-http` has no transactions (`db.transaction(...)` throws synchronously),
  // so this fans out sequentially. The failure mode is mild and self-healing: a
  // crash mid-loop leaves the learner enrolled in a prefix of the track, and
  // re-running completes it, because the insert is idempotent.
  await db
    .insert(enrollment)
    .values(links.map((l) => ({ courseId: l.courseId, userId: viewer.userId })))
    .onConflictDoNothing();

  revalidatePath(`/tracks/${trackSlug}`);
  revalidatePath("/dashboard");
  return { ok: true };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run src/lib/content/track-mutations.test.ts`
Expected: PASS — all five tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/content/mutations.ts src/lib/content/track-mutations.test.ts
git commit -m "feat: add enrollInTrack fan-out mutation"
```

---

### Task 5: Track admin mutations and validation

**Files:**
- Modify: `src/lib/validation.ts`
- Modify: `src/lib/content/mutations.ts`
- Create: `src/lib/content/track-admin-mutations.test.ts`

**Interfaces:**
- Consumes: `requireRole` from `@/lib/session`; `track`, `trackCourse` (Task 1).
- Produces:
  - `trackInputSchema` and `type TrackInput = { slug: string; title: string; promise: string; outcome: string; position: number; courseIds: string[] }` in `src/lib/validation.ts`
  - `createTrack(input: TrackInput): Promise<MutationResult>`
  - `updateTrack(trackId: string, input: TrackInput): Promise<MutationResult>`
  - `publishTrack(trackId: string): Promise<MutationResult>`
  - `unpublishTrack(trackId: string): Promise<MutationResult>`
  - `deleteTrack(trackId: string): Promise<MutationResult>`

- [ ] **Step 1: Write the failing test**

Create `src/lib/content/track-admin-mutations.test.ts`:

```ts
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

const { createTrack, updateTrack, deleteTrack, publishTrack } = await import("./mutations");

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
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/lib/content/track-admin-mutations.test.ts`
Expected: FAIL — `createTrack` is not exported from `./mutations`.

- [ ] **Step 3: Add the validation schema**

Append to `src/lib/validation.ts`:

```ts
export const trackInputSchema = z.object({
  slug: z
    .string()
    .trim()
    .min(1, "Slug is required.")
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use lowercase letters, numbers and hyphens."),
  title: z.string().trim().min(1, "Title is required."),
  promise: z.string().trim().min(1, "Promise is required."),
  // This is the sentence someone reads before paying. It is author-supplied and
  // unverifiable by the app, so the only thing enforced here is that it exists.
  outcome: z.string().trim().min(1, "Outcome is required."),
  position: z.number().int().min(0),
  courseIds: z.array(z.string().uuid()),
});

export type TrackInput = z.infer<typeof trackInputSchema>;
```

- [ ] **Step 4: Write the mutations**

Append to `src/lib/content/mutations.ts` (add `trackInputSchema, type TrackInput` to the existing `@/lib/validation` import):

```ts
/**
 * Tracks are ADMIN-managed, not instructor-managed, and that is a deliberate
 * narrowing of the rule the course mutations use. `assertCanManageCourse`
 * answers "does this viewer own this course"; a track can contain courses owned
 * by several different instructors, so there is no coherent single owner to
 * check. Letting any contributing instructor edit the track would let them
 * reorder or remove a peer's course; requiring they own all of them makes most
 * tracks uneditable. Revisit only with a real `track.owner_user_id`.
 */

export async function createTrack(input: TrackInput): Promise<MutationResult> {
  await requireRole("admin");

  const parsed = trackInputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Invalid track." };
  }
  const data = parsed.data;

  const [existing] = await db.select({ id: track.id }).from(track).where(eq(track.slug, data.slug));
  if (existing) return { ok: false, message: "A track with that slug already exists." };

  // No transactions on neon-http — insert the track, then its courses. A crash
  // between the two leaves an empty draft track, which an admin can see and fix.
  const [row] = await db
    .insert(track)
    .values({
      slug: data.slug,
      title: data.title,
      promise: data.promise,
      outcome: data.outcome,
      position: data.position,
      status: "draft",
    })
    .returning({ id: track.id });

  if (data.courseIds.length > 0) {
    await db
      .insert(trackCourse)
      .values(data.courseIds.map((courseId, i) => ({ trackId: row.id, courseId, position: i })))
      .onConflictDoNothing();
  }

  revalidatePath("/admin/tracks");
  revalidatePath("/tracks");
  return { ok: true };
}

export async function updateTrack(trackId: string, input: TrackInput): Promise<MutationResult> {
  await requireRole("admin");

  const parsed = trackInputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Invalid track." };
  }
  const data = parsed.data;

  const [row] = await db.select({ id: track.id }).from(track).where(eq(track.id, trackId));
  if (!row) return { ok: false, message: "Track not found." };

  await db
    .update(track)
    .set({
      slug: data.slug,
      title: data.title,
      promise: data.promise,
      outcome: data.outcome,
      position: data.position,
      updatedAt: new Date(),
    })
    .where(eq(track.id, trackId));

  // Reconcile membership by courseId rather than delete-and-reinsert. These rows
  // carry no learner data so a rebuild would be survivable, but `updateCourse`
  // established the pattern for a reason and diverging invites someone to copy
  // the wrong one back into a table where it does matter.
  const existingLinks = await db
    .select({ id: trackCourse.id, courseId: trackCourse.courseId })
    .from(trackCourse)
    .where(eq(trackCourse.trackId, trackId));

  const submitted = new Set(data.courseIds);
  const existingByCourseId = new Map(existingLinks.map((l) => [l.courseId, l]));

  for (const link of existingLinks) {
    if (!submitted.has(link.courseId)) {
      await db.delete(trackCourse).where(eq(trackCourse.id, link.id));
    }
  }

  for (const [i, courseId] of data.courseIds.entries()) {
    const existingLink = existingByCourseId.get(courseId);
    if (existingLink) {
      await db.update(trackCourse).set({ position: i }).where(eq(trackCourse.id, existingLink.id));
    } else {
      await db.insert(trackCourse).values({ trackId, courseId, position: i }).onConflictDoNothing();
    }
  }

  revalidatePath("/admin/tracks");
  revalidatePath(`/tracks/${data.slug}`);
  revalidatePath("/tracks");
  return { ok: true };
}

async function setTrackStatus(
  trackId: string,
  status: "draft" | "published",
): Promise<MutationResult> {
  await requireRole("admin");

  const [row] = await db.select({ slug: track.slug }).from(track).where(eq(track.id, trackId));
  if (!row) return { ok: false, message: "Track not found." };

  await db.update(track).set({ status, updatedAt: new Date() }).where(eq(track.id, trackId));

  revalidatePath("/admin/tracks");
  revalidatePath(`/tracks/${row.slug}`);
  revalidatePath("/tracks");
  return { ok: true };
}

export async function publishTrack(trackId: string): Promise<MutationResult> {
  return setTrackStatus(trackId, "published");
}

export async function unpublishTrack(trackId: string): Promise<MutationResult> {
  return setTrackStatus(trackId, "draft");
}

export async function deleteTrack(trackId: string): Promise<MutationResult> {
  await requireRole("admin");

  const [row] = await db.select({ id: track.id }).from(track).where(eq(track.id, trackId));
  if (!row) return { ok: false, message: "Track not found." };

  // CASCADE removes `track_course` only. `enrollment` and `lesson_progress` are
  // keyed to courses, so no learner loses progress when a track is deleted —
  // asserted in track-admin-mutations.test.ts rather than assumed.
  await db.delete(track).where(eq(track.id, trackId));

  revalidatePath("/admin/tracks");
  revalidatePath("/tracks");
  return { ok: true };
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm vitest run src/lib/content/track-admin-mutations.test.ts`
Expected: PASS — all five tests.

- [ ] **Step 6: Run the whole suite and commit**

```bash
pnpm test
git add src/lib/validation.ts src/lib/content/mutations.ts src/lib/content/track-admin-mutations.test.ts
git commit -m "feat: add admin track mutations"
```

Expected: every suite passes before committing.

---

### Task 6: Seed the first track

**Files:**
- Create: `src/db/seed-tracks.ts`
- Create: `src/db/seed-tracks-cli.ts`
- Modify: `package.json`

**Interfaces:**
- Consumes: `track`, `trackCourse` (Task 1).
- Produces: `seedTracks(): Promise<{ created: number; skipped: number }>` and a `pnpm db:seed:tracks` script.

Idempotent, like `src/db/seed.ts`. Running it twice must not duplicate anything. The spec's open decision #2 says the first release may honestly support only one track — this seeds exactly one from the existing courses.

- [ ] **Step 1: Write the seed module**

Create `src/db/seed-tracks.ts`:

```ts
import { asc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { course, track, trackCourse } from "@/db/schema";

/**
 * Idempotent, like `seed.ts`. Safe to re-run: an existing track is left alone
 * rather than rebuilt, so re-seeding can never reorder a track an admin has
 * since edited by hand.
 */
const TRACKS = [
  {
    slug: "freelance-brand-designer",
    title: "Freelance Brand Designer",
    promise: "Take a brand project from cold DM to invoice, solo.",
    outcome:
      "You finish able to find a client, scope and price the work, build a brand system, present it, and get paid for it.",
    position: 0,
    // Ordered by the sequence a learner should actually work through them.
    courseSlugs: [
      "landing-your-first-client",
      "pricing-and-proposals",
      "brand-identity-essentials",
    ],
  },
];

export async function seedTracks(): Promise<{ created: number; skipped: number }> {
  let created = 0;
  let skipped = 0;

  for (const def of TRACKS) {
    const [existing] = await db.select({ id: track.id }).from(track).where(eq(track.slug, def.slug));
    if (existing) {
      skipped += 1;
      continue;
    }

    const courses = await db
      .select({ id: course.id, slug: course.slug })
      .from(course)
      .where(inArray(course.slug, def.courseSlugs))
      .orderBy(asc(course.slug));

    const idBySlug = new Map(courses.map((c) => [c.slug, c.id]));
    const missing = def.courseSlugs.filter((s) => !idBySlug.has(s));
    if (missing.length > 0) {
      throw new Error(
        `Cannot seed track "${def.slug}": missing courses ${missing.join(", ")}. ` +
          `Create them first — a track that silently drops courses is worse than one that fails loudly.`,
      );
    }

    const [row] = await db
      .insert(track)
      .values({
        slug: def.slug,
        title: def.title,
        promise: def.promise,
        outcome: def.outcome,
        position: def.position,
        status: "draft",
      })
      .returning({ id: track.id });

    await db.insert(trackCourse).values(
      def.courseSlugs.map((slug, i) => ({ trackId: row.id, courseId: idBySlug.get(slug)!, position: i })),
    );

    created += 1;
  }

  return { created, skipped };
}
```

- [ ] **Step 2: Write the CLI wrapper**

Create `src/db/seed-tracks-cli.ts`, mirroring `src/db/seed-cli.ts`:

```ts
import { seedTracks } from "./seed-tracks";

seedTracks()
  .then(({ created, skipped }) => {
    console.log(`Tracks seeded. created=${created} skipped=${skipped}`);
    process.exit(0);
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
```

- [ ] **Step 3: Add the script**

In `package.json`, add to `"scripts"`:

```json
"db:seed:tracks": "dotenv -e .env.local -- tsx --conditions=react-server src/db/seed-tracks-cli.ts"
```

- [ ] **Step 4: Run it twice to prove idempotence**

```bash
pnpm db:seed:tracks
pnpm db:seed:tracks
```

Expected: first run prints `created=1 skipped=0`; second prints `created=0 skipped=1`. If the first run throws about missing courses, the course slugs in `TRACKS` do not match the database — check with a query and correct the list rather than deleting the guard.

- [ ] **Step 5: Commit**

```bash
git add src/db/seed-tracks.ts src/db/seed-tracks-cli.ts package.json
git commit -m "feat: add idempotent track seed"
```

---

### Task 7: Track artwork

**Files:**
- Modify: `src/lib/brand/course-artwork.ts`
- Modify: `src/lib/brand/course-artwork.test.ts`

**Interfaces:**
- Consumes: existing `courseArtwork(seed, lessonCount)` and `MARK_SHEAR`.
- Produces: nothing new — this task resolves spec open decision #3 by confirming tracks reuse `CourseArtwork` seeded by the track slug, and documents why.

The existing generator is already slug-seeded and density-scaled. A track is just a different seed with a larger lesson count, so no new code is needed — only a test locking the behaviour in and a comment recording the decision.

- [ ] **Step 1: Write the failing test**

Append to `src/lib/brand/course-artwork.test.ts`:

```ts
it("gives a track a different cover from any of its courses", () => {
  // Tracks reuse this generator seeded by the TRACK slug. A track whose art
  // happened to match one of its member courses would read as a duplicate, so
  // this locks in that the seed space separates them.
  const trackArt = courseArtwork("freelance-brand-designer", 12);
  const courseArt = courseArtwork("brand-identity-essentials", 4);
  expect(trackArt.bands).not.toEqual(courseArt.bands);
});

it("keeps a high-lesson-count track at the legible band ceiling", () => {
  // A 60-lesson track must not render 60 bands.
  expect(courseArtwork("big-track", 60).bands).toHaveLength(9);
});
```

- [ ] **Step 2: Run test to verify it passes or fails**

Run: `pnpm vitest run src/lib/brand/course-artwork.test.ts`
Expected: PASS. If either fails, the generator has drifted from its documented contract — fix the generator, not the test.

- [ ] **Step 3: Record the decision**

Add to the module docblock at the top of `src/lib/brand/course-artwork.ts`:

```
 * Tracks reuse this generator unchanged, seeded by the track slug and its total
 * lesson count. A track therefore gets art in the same visual language as its
 * courses without being mistakable for any one of them (spec open decision #3).
```

- [ ] **Step 4: Commit**

```bash
git add src/lib/brand/course-artwork.ts src/lib/brand/course-artwork.test.ts
git commit -m "test: lock in track artwork reuse of the course generator"
```

---

### Task 8: The journey map component

**Files:**
- Create: `src/components/track/track-map.tsx`
- Create: `src/components/track/track-map.test.tsx`
- Create: `src/components/track/enroll-track-button.tsx`

**Interfaces:**
- Consumes: `TrackDetail`, `TrackCourse` (Task 1); `trackProgress` (Task 2); `enrollInTrack` (Task 4); `CourseArtwork` from `@/components/brand/course-artwork`.
- Produces:
  - `<TrackMap track={TrackDetail} enrolled={boolean} />`
  - `<EnrollTrackButton trackSlug={string} />`

One component, two states. Unenrolled it is the sell: the whole climb visible, every course legible, outcome prominent. Enrolled it is the map: real completion, the learner's position, one unambiguous next action.

- [ ] **Step 1: Write the failing test**

Create `src/components/track/track-map.test.tsx`:

```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { TrackMap } from "./track-map";
import type { TrackDetail, TrackCourse } from "@/lib/content/types";

function course(slug: string, position: number, lessonCount: number, done: number): TrackCourse {
  return {
    id: slug, slug, title: `Course ${slug}`, description: "d", category: "T",
    level: "beginner", status: "published", instructorName: "Ins",
    lessonCount, position, completedLessonCount: done,
  };
}

const track: TrackDetail = {
  id: "t", slug: "freelance", title: "Freelance Brand Designer",
  promise: "Cold DM to invoice.", outcome: "You finish able to ship a brand system.",
  status: "published", position: 0, courseCount: 2, lessonCount: 7,
  courses: [course("a", 0, 4, 4), course("b", 1, 3, 1)],
};

describe("TrackMap", () => {
  it("states the outcome for a visitor who has not enrolled", () => {
    render(<TrackMap track={track} enrolled={false} />);
    expect(screen.getByText(/You finish able to ship a brand system\./)).toBeDefined();
  });

  it("shows every course in the climb even when not enrolled", () => {
    render(<TrackMap track={track} enrolled={false} />);
    expect(screen.getByText("Course a")).toBeDefined();
    expect(screen.getByText("Course b")).toBeDefined();
  });

  it("shows real progress and one next action when enrolled", () => {
    render(<TrackMap track={track} enrolled />);
    expect(screen.getByText("5 of 7 lessons")).toBeDefined();
    const next = screen.getByRole("link", { name: /continue/i });
    expect(next.getAttribute("href")).toBe("/courses/b");
  });

  it("claims no progress for someone who has not enrolled", () => {
    // The unenrolled view must never imply the visitor has done anything.
    render(<TrackMap track={track} enrolled={false} />);
    expect(screen.queryByText(/of 7 lessons/)).toBeNull();
  });

  it("offers review rather than continue once the track is finished", () => {
    const finished: TrackDetail = { ...track, courses: [course("a", 0, 4, 4), course("b", 1, 3, 3)] };
    render(<TrackMap track={finished} enrolled />);
    expect(screen.getByText("7 of 7 lessons")).toBeDefined();
    expect(screen.queryByRole("link", { name: /continue/i })).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/components/track/track-map.test.tsx`
Expected: FAIL — cannot resolve `./track-map`.

- [ ] **Step 3: Write the enrol button**

Create `src/components/track/enroll-track-button.tsx`:

```tsx
"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { enrollInTrack } from "@/lib/content/mutations";

export function EnrollTrackButton({ trackSlug }: { trackSlug: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  async function handleClick() {
    const result = await enrollInTrack(trackSlug);

    // Branch on result.ok — never assume the write happened. A track enrolment
    // that silently failed would leave the learner staring at a map they have
    // no access to.
    if (!result.ok) {
      toast.error(result.message);
      return;
    }

    toast.success("You're in. Start whenever you're ready.");
    startTransition(() => router.refresh());
  }

  return (
    <Button onClick={handleClick} disabled={pending}>
      {pending ? "Enrolling…" : "Start this track"}
    </Button>
  );
}
```

- [ ] **Step 4: Write the map**

Create `src/components/track/track-map.tsx`:

```tsx
import Link from "next/link";
import { CourseArtwork } from "@/components/brand/course-artwork";
import { ButtonLink } from "@/components/ui/button-link";
import { Badge } from "@/components/ui/badge";
import { Progress, ProgressTrack, ProgressIndicator } from "@/components/ui/progress";
import { EnrollTrackButton } from "@/components/track/enroll-track-button";
import { trackProgress } from "@/lib/track-progress";
import type { TrackDetail } from "@/lib/content/types";

/**
 * The journey map, in two states.
 *
 * Unenrolled it is the pitch: the whole climb is visible, every course legible,
 * the outcome prominent. It deliberately shows NO progress — a visitor who has
 * done nothing must never see a progress figure implying otherwise.
 *
 * Enrolled it is the map: real completion from `lesson_progress`, and exactly
 * one unambiguous next action.
 */
export function TrackMap({ track, enrolled }: { track: TrackDetail; enrolled: boolean }) {
  const progress = trackProgress(track.courses);
  const ordered = [...track.courses].sort((a, b) => a.position - b.position);

  return (
    <div className="flex flex-col gap-10">
      <header className="flex flex-col gap-4">
        <p className="label-eyebrow text-violet">Track</p>
        <h1 className="text-4xl font-bold tracking-tight md:text-5xl">{track.title}</h1>
        <p className="max-w-xl text-lg text-graphite">{track.promise}</p>

        <div className="label-eyebrow flex flex-wrap gap-4 text-graphite">
          <span>{track.courseCount} courses</span>
          <span>{track.lessonCount} lessons</span>
        </div>

        {enrolled ? (
          <div className="max-w-md space-y-2">
            <Progress value={progress.percent}>
              <ProgressTrack>
                <ProgressIndicator />
              </ProgressTrack>
            </Progress>
            <p className="label-eyebrow text-graphite">
              {progress.completedLessons} of {progress.totalLessons} lessons
            </p>
          </div>
        ) : (
          <div className="pt-2">
            <EnrollTrackButton trackSlug={track.slug} />
          </div>
        )}
      </header>

      <ol className="flex flex-col gap-4">
        {ordered.map((c, index) => {
          const isNext = enrolled && progress.nextCourse?.slug === c.slug;
          const isDone = c.lessonCount > 0 && c.completedLessonCount >= c.lessonCount;

          return (
            <li key={c.slug}>
              <Link
                href={`/courses/${c.slug}`}
                className="group/stage flex flex-col gap-4 overflow-hidden rounded-md border border-border outline-none transition-colors hover:border-violet focus-visible:ring-2 focus-visible:ring-violet sm:flex-row sm:items-stretch sm:gap-5"
              >
                <div className="h-24 w-full shrink-0 sm:h-auto sm:w-32">
                  <CourseArtwork seed={c.slug} lessonCount={c.lessonCount} />
                </div>

                <div className="flex flex-1 flex-col gap-2 p-5 sm:pl-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="label-eyebrow text-graphite">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <Badge variant="outline" className="capitalize">
                      {c.level}
                    </Badge>
                    {enrolled && isDone ? <Badge variant="secondary">Done</Badge> : null}
                  </div>

                  <h2 className="text-xl font-bold group-hover/stage:text-violet">{c.title}</h2>
                  <p className="line-clamp-2 max-w-2xl text-graphite">{c.description}</p>

                  <p className="label-eyebrow text-graphite">
                    {enrolled
                      ? `${Math.min(c.completedLessonCount, c.lessonCount)} of ${c.lessonCount} lessons`
                      : `${c.lessonCount} lessons`}
                  </p>
                </div>

                {/* "Next", not "Continue here": the footer CTA below is the one
                    control named /continue/, so the accessible name of this row
                    link must not collide with it. */}
                {isNext ? (
                  <div className="flex items-center p-5 sm:pl-0">
                    <span className="label-eyebrow shrink-0 text-violet">Next</span>
                  </div>
                ) : null}
              </Link>
            </li>
          );
        })}
      </ol>

      <footer className="rounded-md border border-border bg-deep-ink p-8 text-ivory">
        <p className="label-eyebrow text-violet-accessible">What you walk away with</p>
        <p className="mt-3 max-w-2xl text-2xl leading-tight font-bold tracking-tight">
          {track.outcome}
        </p>
      </footer>

      {enrolled && progress.nextCourse ? (
        <div>
          <ButtonLink href={`/courses/${progress.nextCourse.slug}`}>
            Continue: {progress.nextCourse.title}
          </ButtonLink>
        </div>
      ) : null}
    </div>
  );
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm vitest run src/components/track/track-map.test.tsx`
Expected: PASS — all five tests.

- [ ] **Step 6: Commit**

```bash
git add src/components/track
git commit -m "feat: add the track journey map component"
```

---

### Task 9: `/tracks` and `/tracks/[slug]` routes

**Files:**
- Create: `src/app/(site)/tracks/page.tsx`
- Create: `src/app/(site)/tracks/loading.tsx`
- Create: `src/app/(site)/tracks/[slug]/page.tsx`
- Create: `src/app/(site)/tracks/[slug]/loading.tsx`
- Create: `src/components/track/track-row.tsx`

**Interfaces:**
- Consumes: `getTracks`, `getTrackBySlug` (Task 3); `getSession`, `getEnrollments` from `@/lib/session`; `<TrackMap />` (Task 8).
- Produces: `<TrackRow track={TrackSummary} />`.

Remember Next 16: `params` is a Promise and must be awaited.

- [ ] **Step 1: Write the track row**

Create `src/components/track/track-row.tsx`:

```tsx
import Link from "next/link";
import { CourseArtwork } from "@/components/brand/course-artwork";
import type { TrackSummary } from "@/lib/content/types";

export function TrackRow({ track }: { track: TrackSummary }) {
  return (
    <Link
      href={`/tracks/${track.slug}`}
      className="group/track flex flex-col overflow-hidden rounded-md border border-border outline-none transition-colors hover:border-violet focus-visible:ring-2 focus-visible:ring-violet"
    >
      <div className="h-32">
        <CourseArtwork seed={track.slug} lessonCount={track.lessonCount} ratio="wide" />
      </div>

      <div className="flex flex-1 flex-col gap-3 p-6">
        <p className="label-eyebrow text-graphite">Track</p>
        <h2 className="text-2xl font-bold tracking-tight group-hover/track:text-violet">
          {track.title}
        </h2>
        <p className="text-graphite">{track.promise}</p>
        <p className="label-eyebrow mt-auto flex gap-4 text-graphite">
          <span>{track.courseCount} courses</span>
          <span>{track.lessonCount} lessons</span>
        </p>
      </div>
    </Link>
  );
}
```

- [ ] **Step 2: Write the index route**

Create `src/app/(site)/tracks/page.tsx`:

```tsx
import type { Metadata } from "next";
import { TrackRow } from "@/components/track/track-row";
import { getTracks } from "@/lib/content/queries";

export const metadata: Metadata = {
  title: "Tracks",
  description: "Ordered paths through Sodales Academy, each ending in a stated capability.",
};

export default async function TracksPage() {
  const tracks = await getTracks();

  return (
    <div className="mx-auto max-w-6xl px-4 py-16">
      <h1 className="text-4xl font-bold tracking-tight">Tracks</h1>
      <p className="mt-4 max-w-xl text-lg text-graphite">
        Each track is an ordered path. Start at the beginning and you finish able to do the
        thing it names.
      </p>

      {tracks.length === 0 ? (
        <p className="mt-12 text-graphite">No tracks are published yet.</p>
      ) : (
        <div className="mt-10 grid gap-6 md:grid-cols-2">
          {tracks.map((track) => (
            <TrackRow key={track.slug} track={track} />
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Write the detail route**

Create `src/app/(site)/tracks/[slug]/page.tsx`:

```tsx
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { TrackMap } from "@/components/track/track-map";
import { getTrackBySlug } from "@/lib/content/queries";
import { getEnrollments, getSession } from "@/lib/session";

type PageProps = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const session = await getSession();
  const track = await getTrackBySlug(slug, session);
  if (!track) return { title: "Track not found" };
  return { title: track.title, description: track.promise };
}

export default async function TrackPage({ params }: PageProps) {
  const { slug } = await params;

  // getSession is React-cached, so calling it here and in generateMetadata is
  // one round-trip per request, not two.
  const session = await getSession();
  const track = await getTrackBySlug(slug, session);
  if (!track) notFound();

  // "Enrolled in the track" means enrolled in every course it contains — which
  // is exactly what enrollInTrack produces. A partial enrolment (someone who
  // bought one course earlier) reads as not-enrolled and is offered the track,
  // which is the honest answer: they do not have all of it.
  const enrolledSlugs = new Set(
    session ? (await getEnrollments()).map((e) => e.courseSlug) : [],
  );
  const enrolled =
    track.courses.length > 0 && track.courses.every((c) => enrolledSlugs.has(c.slug));

  return (
    <div className="mx-auto max-w-6xl px-4 py-16">
      <TrackMap track={track} enrolled={enrolled} />
    </div>
  );
}
```

- [ ] **Step 4: Add loading boundaries**

Create `src/app/(site)/tracks/loading.tsx`:

```tsx
import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div aria-busy="true" className="mx-auto max-w-6xl px-4 py-16">
      <span className="sr-only">Loading</span>
      <Skeleton className="h-10 w-40" />
      <Skeleton className="mt-4 h-16 w-full max-w-xl" />
      <div className="mt-10 grid gap-6 md:grid-cols-2">
        <Skeleton className="h-72" />
        <Skeleton className="h-72" />
      </div>
    </div>
  );
}
```

Create `src/app/(site)/tracks/[slug]/loading.tsx`:

```tsx
import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div aria-busy="true" className="mx-auto max-w-6xl px-4 py-16">
      <span className="sr-only">Loading</span>
      <Skeleton className="h-4 w-16" />
      <Skeleton className="mt-4 h-12 w-96 max-w-full" />
      <Skeleton className="mt-4 h-6 w-full max-w-xl" />
      <div className="mt-10 flex flex-col gap-4">
        <Skeleton className="h-32" />
        <Skeleton className="h-32" />
        <Skeleton className="h-32" />
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Verify in the browser**

```bash
pnpm dev
```

Visit `http://localhost:3000/tracks` and `http://localhost:3000/tracks/freelance-brand-designer`.

Expected: the index lists the seeded track only if it has been published — the seed creates it as a draft, so first publish it via the admin UI in Task 11, or temporarily flip `status` in the database to check. Signed out, the detail page shows the full climb, the outcome, and no progress figures.

- [ ] **Step 6: Typecheck, lint, build, commit**

```bash
pnpm typecheck && pnpm lint && pnpm build
git add src/app/\(site\)/tracks src/components/track/track-row.tsx
git commit -m "feat: add /tracks and /tracks/[slug] routes"
```

---

### Task 10: Track context on dashboard, course, and lesson pages

**Files:**
- Modify: `src/app/(site)/dashboard/page.tsx`
- Modify: `src/app/(site)/courses/[slug]/page.tsx`
- Create: `src/components/track/track-breadcrumb.tsx`
- Modify: `src/lib/content/queries.ts`
- Modify: `src/lib/content/track-queries.test.ts`

**Interfaces:**
- Consumes: `track`, `trackCourse` (Task 1).
- Produces: `getTracksForCourse(courseId: string): Promise<Pick<TrackSummary, "slug" | "title">[]>` and `<TrackBreadcrumb tracks={...} />`.

A course can belong to more than one track, so the breadcrumb must handle a list, not a single value. Getting this wrong produces a confident, wrong "you are here".

- [ ] **Step 1: Write the failing test**

Append to `src/lib/content/track-queries.test.ts`:

```ts
describe("getTracksForCourse", () => {
  it("returns the published tracks a course belongs to", async () => {
    const [c] = await db.select().from(course).where(eq(course.slug, COURSE_A));
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
    // page — that would leak an unreleased track's title and slug.
    const [c] = await db.select().from(course).where(eq(course.slug, COURSE_A));
    const [draft] = await db.select().from(track).where(eq(track.slug, DRAFT));
    await db.insert(trackCourse).values({ trackId: draft.id, courseId: c.id, position: 0 });

    const tracks = await getTracksForCourse(c.id);
    expect(tracks.map((t) => t.slug)).toEqual([PUBLISHED]);
  });
});
```

Add `getTracksForCourse` to the file's import from `./queries`, add `const ORPHAN_COURSE = `${P}-orphan`;` beside the other slug constants, and add its cleanup to `afterAll`:

```ts
await db.delete(course).where(eq(course.slug, ORPHAN_COURSE));
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/lib/content/track-queries.test.ts`
Expected: FAIL — `getTracksForCourse` is not exported.

- [ ] **Step 3: Write the query**

Append to `src/lib/content/queries.ts`:

```ts
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
```

- [ ] **Step 4: Write the breadcrumb**

Create `src/components/track/track-breadcrumb.tsx`:

```tsx
import Link from "next/link";

export function TrackBreadcrumb({
  tracks,
}: {
  tracks: { slug: string; title: string }[];
}) {
  if (tracks.length === 0) return null;

  return (
    <p className="label-eyebrow flex flex-wrap items-center gap-2 text-graphite">
      <span>{tracks.length === 1 ? "Part of" : "Part of"}</span>
      {tracks.map((t) => (
        <Link
          key={t.slug}
          href={`/tracks/${t.slug}`}
          className="text-violet hover:underline focus-visible:ring-2 focus-visible:ring-violet"
        >
          {t.title}
        </Link>
      ))}
    </p>
  );
}
```

- [ ] **Step 5: Wire it into the course page**

In `src/app/(site)/courses/[slug]/page.tsx`, after the course is resolved, fetch and render the breadcrumb above the title:

```tsx
const tracks = await getTracksForCourse(course.id);
```

```tsx
<div className="mt-6">
  <TrackBreadcrumb tracks={tracks} />
</div>
```

Add the imports for `getTracksForCourse` and `TrackBreadcrumb`.

- [ ] **Step 6: Add a track progress card**

Create `src/components/track/track-progress-card.tsx`:

```tsx
import { ButtonLink } from "@/components/ui/button-link";
import { Progress, ProgressTrack, ProgressIndicator } from "@/components/ui/progress";
import { trackProgress } from "@/lib/track-progress";
import type { TrackDetail } from "@/lib/content/types";

export function TrackProgressCard({ track }: { track: TrackDetail }) {
  const progress = trackProgress(track.courses);

  return (
    <div className="flex flex-col gap-4 rounded-md border border-border p-6">
      <div>
        <p className="label-eyebrow text-graphite">Track</p>
        <h3 className="mt-1 text-xl font-bold">{track.title}</h3>
      </div>

      <Progress value={progress.percent}>
        <ProgressTrack>
          <ProgressIndicator />
        </ProgressTrack>
      </Progress>

      <div className="flex flex-wrap items-center justify-between gap-4">
        <span className="label-eyebrow text-graphite">
          {progress.completedCourses} of {progress.totalCourses} courses ·{" "}
          {progress.completedLessons} of {progress.totalLessons} lessons
        </span>
        <ButtonLink size="sm" variant="outline" href={`/tracks/${track.slug}`}>
          {progress.nextCourse ? "Continue track" : "Review track"}
        </ButtonLink>
      </div>
    </div>
  );
}
```

- [ ] **Step 7: Wire it into the dashboard**

In `src/app/(site)/dashboard/page.tsx`, add these imports:

```tsx
import { TrackProgressCard } from "@/components/track/track-progress-card";
import { getTrackBySlug, getTracks } from "@/lib/content/queries";
```

After the existing `enrollments` line, derive the learner's fully-enrolled tracks:

```tsx
  // A track shows here only when the learner is enrolled in EVERY course in it —
  // which is exactly what enrollInTrack produces. Someone who bought one course
  // that happens to sit in a track has not bought the track, and the dashboard
  // must not imply they have.
  const enrolledSlugs = new Set(enrollments.map((e) => e.courseSlug));
  const trackDetails = (
    await Promise.all((await getTracks()).map((t) => getTrackBySlug(t.slug, session)))
  ).filter((t) => t !== null);
  const myTracks = trackDetails.filter(
    (t) => t.courses.length > 0 && t.courses.every((c) => enrolledSlugs.has(c.slug)),
  );
```

Then render them above `DashboardStats`, inside the non-empty branch:

```tsx
          {myTracks.length > 0 ? (
            <div className="mt-10 grid gap-6 lg:grid-cols-2">
              {myTracks.map((t) => (
                <TrackProgressCard key={t.slug} track={t} />
              ))}
            </div>
          ) : null}
```

- [ ] **Step 8: Add track context to the lesson player**

Spec §7 requires the lesson player to carry track context so "what do I do next" always has an answer. In `src/app/(site)/learn/[courseSlug]/[lessonSlug]/page.tsx`, add the import:

```tsx
import { TrackBreadcrumb } from "@/components/track/track-breadcrumb";
import { getCompletedLessonIds, getLesson, getTracksForCourse } from "@/lib/content/queries";
```

After `const completed = ...`, fetch the tracks:

```tsx
  const tracks = await getTracksForCourse(lesson.course.id);
```

Then render the breadcrumb in the sticky header bar, after the existing back-link, so it sits beside the course title rather than pushing the lesson body down:

```tsx
          <TrackBreadcrumb tracks={tracks} />
```

The header row is `flex items-center justify-between gap-4`; place the breadcrumb between the back-link and the "Lesson N of M" span, and add `hidden sm:flex` to it so it does not crowd the bar on mobile.

- [ ] **Step 9: Run tests, typecheck, lint, build**

```bash
pnpm test && pnpm typecheck && pnpm lint && pnpm build
```

Expected: all green.

- [ ] **Step 10: Commit**

```bash
git add src/lib/content/queries.ts src/lib/content/track-queries.test.ts src/components/track src/app/\(site\)
git commit -m "feat: show track context on course, lesson and dashboard pages"
```

---

### Task 11: Admin tracks UI

**Files:**
- Create: `src/app/admin/tracks/page.tsx`
- Create: `src/app/admin/tracks/new/page.tsx`
- Create: `src/app/admin/tracks/[id]/edit/page.tsx`
- Create: `src/components/admin/track-form.tsx`
- Create: `src/components/admin/track-row-actions.tsx`
- Modify: `src/components/admin/admin-nav.tsx`

**Interfaces:**
- Consumes: `getTracksForAdmin`, `getTrackBySlug` (Task 3); `createTrack`, `updateTrack`, `publishTrack`, `unpublishTrack`, `deleteTrack` (Task 5); `TrackInput` (Task 5).
- Produces: nothing consumed by later tasks.

Read `src/components/admin/course-form.tsx` and `src/components/admin/course-row-actions.tsx` first and mirror their structure, prop shapes, and error handling. Do not invent a new form pattern.

- [ ] **Step 1: Add the nav entry**

In `src/components/admin/admin-nav.tsx`, add to `LINKS`:

```ts
{ href: "/admin/tracks", label: "Tracks" },
```

- [ ] **Step 2: Build the list page**

Create `src/app/admin/tracks/page.tsx`. It must call `requireRole("admin")` itself — the layout's check is not a substitute, per the existing convention that every admin page re-derives its own session:

```tsx
import type { Metadata } from "next";
import { ButtonLink } from "@/components/ui/button-link";
import { TrackRowActions } from "@/components/admin/track-row-actions";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { getTracksForAdmin } from "@/lib/content/queries";
import { requireRole } from "@/lib/session";

export const metadata: Metadata = { robots: { index: false } };

export default async function AdminTracksPage() {
  const session = await requireRole("admin");
  const tracks = await getTracksForAdmin(session);

  return (
    <div className="p-6 lg:p-10">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-3xl font-bold tracking-tight">Tracks</h1>
        <ButtonLink href="/admin/tracks/new">New track</ButtonLink>
      </div>

      {tracks.length === 0 ? (
        <div className="flex flex-col items-center gap-4 py-24 text-center">
          <h2 className="text-xl font-bold">No tracks yet</h2>
          <p className="max-w-sm text-graphite">A track is an ordered path through courses.</p>
          <ButtonLink href="/admin/tracks/new">New track</ButtonLink>
        </div>
      ) : (
        <div className="mt-8 rounded-md border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead>Courses</TableHead>
                <TableHead>Status</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {tracks.map((track) => (
                <TableRow key={track.id}>
                  <TableCell className="font-bold">{track.title}</TableCell>
                  <TableCell>{track.courseCount}</TableCell>
                  <TableCell>
                    <Badge variant={track.status === "published" ? "secondary" : "outline"}>
                      {track.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <TrackRowActions
                      id={track.id}
                      trackTitle={track.title}
                      status={track.status}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Build the row actions**

Create `src/components/admin/track-row-actions.tsx`. Read `src/components/admin/course-row-actions.tsx` first — this mirrors it exactly, including the dropdown structure, the delete confirmation dialog, `toast.error(result.message)` on `!result.ok`, and `router.refresh()` on success:

```tsx
"use client";

import { useRouter } from "next/navigation";
import { MoreHorizontalIcon } from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { deleteTrack, publishTrack, unpublishTrack } from "@/lib/content/mutations";
import type { TrackStatus } from "@/lib/content/types";

export function TrackRowActions({
  id,
  trackTitle,
  status,
}: {
  id: string;
  trackTitle: string;
  status: TrackStatus;
}) {
  const router = useRouter();

  async function handleTogglePublish() {
    const result = status === "published" ? await unpublishTrack(id) : await publishTrack(id);

    if (!result.ok) {
      toast.error(result.message);
      return;
    }

    toast.success(status === "published" ? "Track unpublished." : "Track published.");
    router.refresh();
  }

  async function handleDelete() {
    const result = await deleteTrack(id);

    if (!result.ok) {
      toast.error(result.message);
      return;
    }

    toast.success("Track deleted. Learner progress is untouched.");
    router.refresh();
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={<Button variant="ghost" size="icon-sm" aria-label={`Actions for ${trackTitle}`} />}
      >
        <MoreHorizontalIcon />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem render={<Link href={`/admin/tracks/${id}/edit`} />}>
          Edit
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleTogglePublish}>
          {status === "published" ? "Unpublish" : "Publish"}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleDelete}>Delete</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
```

If `course-row-actions.tsx` wraps its delete in a confirmation `Dialog`, wrap this one identically — deleting a track is not destructive to learner data, but it is still irreversible and the two screens must behave the same way.

- [ ] **Step 4: Build the form**

Create `src/components/admin/track-form.tsx`. Read `src/components/admin/course-form.tsx` first and match its prop shape and submit handling:

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { createTrack, updateTrack } from "@/lib/content/mutations";
import type { CourseSummary, TrackDetail } from "@/lib/content/types";

export function TrackForm({
  track,
  courses,
}: {
  /** Omitted when creating. */
  track?: TrackDetail;
  courses: CourseSummary[];
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  // Order matters: createTrack/updateTrack derive each course's `position` from
  // this array's index. Selection order IS the curriculum order.
  const [selected, setSelected] = useState<string[]>(
    track ? [...track.courses].sort((a, b) => a.position - b.position).map((c) => c.id) : [],
  );

  function toggle(courseId: string) {
    setSelected((prev) =>
      prev.includes(courseId) ? prev.filter((id) => id !== courseId) : [...prev, courseId],
    );
  }

  function move(index: number, delta: number) {
    setSelected((prev) => {
      const next = [...prev];
      const target = index + delta;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  async function handleSubmit(formData: FormData) {
    setPending(true);

    const input = {
      slug: String(formData.get("slug") ?? ""),
      title: String(formData.get("title") ?? ""),
      promise: String(formData.get("promise") ?? ""),
      outcome: String(formData.get("outcome") ?? ""),
      position: Number(formData.get("position") ?? 0),
      courseIds: selected,
    };

    const result = track ? await updateTrack(track.id, input) : await createTrack(input);
    setPending(false);

    // Branch on result.ok — never assume the write landed.
    if (!result.ok) {
      toast.error(result.message);
      return;
    }

    toast.success(track ? "Track saved." : "Track created as a draft.");
    router.push("/admin/tracks");
    router.refresh();
  }

  const courseById = new Map(courses.map((c) => [c.id, c]));

  return (
    <form action={handleSubmit} className="flex max-w-2xl flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Label htmlFor="title">Title</Label>
        <Input id="title" name="title" defaultValue={track?.title ?? ""} required />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="slug">Slug</Label>
        <Input id="slug" name="slug" defaultValue={track?.slug ?? ""} required />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="promise">Promise</Label>
        <Input id="promise" name="promise" defaultValue={track?.promise ?? ""} required />
        <p className="text-sm text-graphite">One line. Shown on cards and the hero.</p>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="outcome">Outcome</Label>
        <Textarea id="outcome" name="outcome" defaultValue={track?.outcome ?? ""} required />
        <p className="text-sm text-graphite">
          Completes &ldquo;You finish able to&hellip;&rdquo;. This is the sentence someone reads
          before paying — the app cannot verify it, so make it true.
        </p>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="position">Position</Label>
        <Input id="position" name="position" type="number" min={0}
          defaultValue={track?.position ?? 0} required />
      </div>

      <fieldset className="flex flex-col gap-3">
        <legend className="label-eyebrow text-graphite">Courses, in order</legend>

        {selected.length === 0 ? (
          <p className="text-sm text-graphite">No courses selected yet.</p>
        ) : (
          <ol className="flex flex-col gap-2">
            {selected.map((id, index) => (
              <li key={id} className="flex items-center gap-3 rounded-md border border-border p-3">
                <span className="label-eyebrow text-graphite">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <span className="flex-1 font-bold">{courseById.get(id)?.title ?? id}</span>
                <Button type="button" variant="ghost" size="sm"
                  aria-label={`Move ${courseById.get(id)?.title ?? id} up`}
                  onClick={() => move(index, -1)}>↑</Button>
                <Button type="button" variant="ghost" size="sm"
                  aria-label={`Move ${courseById.get(id)?.title ?? id} down`}
                  onClick={() => move(index, 1)}>↓</Button>
                <Button type="button" variant="ghost" size="sm"
                  onClick={() => toggle(id)}>Remove</Button>
              </li>
            ))}
          </ol>
        )}

        <div className="flex flex-col gap-2 rounded-md border border-border p-3">
          {courses.filter((c) => !selected.includes(c.id)).map((c) => (
            <label key={c.id} className="flex items-center gap-3 text-sm">
              <input type="checkbox" checked={false} onChange={() => toggle(c.id)} />
              {c.title}
            </label>
          ))}
        </div>
      </fieldset>

      <div>
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : track ? "Save track" : "Create track"}
        </Button>
      </div>
    </form>
  );
}
```

If `course-form.tsx` uses a different primitive for text areas or labels, use whatever it uses instead — do not introduce a new component.

- [ ] **Step 5: Build new and edit pages**

Create `src/app/admin/tracks/new/page.tsx`:

```tsx
import type { Metadata } from "next";
import { TrackForm } from "@/components/admin/track-form";
import { getAllCourses } from "@/lib/content/queries";
import { requireRole } from "@/lib/session";

export const metadata: Metadata = { robots: { index: false } };

export default async function NewTrackPage() {
  const session = await requireRole("admin");
  const courses = await getAllCourses(session);

  return (
    <div className="p-6 lg:p-10">
      <h1 className="text-3xl font-bold tracking-tight">New track</h1>
      <div className="mt-8">
        <TrackForm courses={courses} />
      </div>
    </div>
  );
}
```

Create `src/app/admin/tracks/[id]/edit/page.tsx`:

```tsx
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { TrackForm } from "@/components/admin/track-form";
import { getAllCourses, getTrackBySlug, getTracksForAdmin } from "@/lib/content/queries";
import { requireRole } from "@/lib/session";

export const metadata: Metadata = { robots: { index: false } };

type PageProps = { params: Promise<{ id: string }> };

export default async function EditTrackPage({ params }: PageProps) {
  const { id } = await params;
  const session = await requireRole("admin");

  // Resolve id → slug through the seam rather than importing @/db here. Pages
  // never touch the database directly; that is the one rule every visibility
  // and authorization guarantee in this app depends on.
  const summary = (await getTracksForAdmin(session)).find((t) => t.id === id);
  if (!summary) notFound();

  const [track, courses] = await Promise.all([
    getTrackBySlug(summary.slug, session),
    getAllCourses(session),
  ]);
  if (!track) notFound();

  return (
    <div className="p-6 lg:p-10">
      <h1 className="text-3xl font-bold tracking-tight">{track.title}</h1>
      <div className="mt-8">
        <TrackForm track={track} courses={courses} />
      </div>
    </div>
  );
}
```

Remove the unused `eq` import if your editor does not — `pnpm lint` will flag it.

- [ ] **Step 6: Manual verification**

```bash
pnpm dev
```

Sign in as the `ADMIN_EMAIL` user. Create a track, add courses in a deliberate order, save, reopen the edit page and confirm the order round-trips. Publish it and confirm it appears on `/tracks`. Confirm a non-admin is redirected away from `/admin/tracks`.

- [ ] **Step 7: Typecheck, lint, build, test, commit**

```bash
pnpm typecheck && pnpm lint && pnpm build && pnpm test
git add src/app/admin/tracks src/components/admin
git commit -m "feat: add admin tracks UI"
```

---

### Task 12: Rebuild the home page as the pitch

**Files:**
- Modify: `src/app/(site)/page.tsx`

**Interfaces:**
- Consumes: `getTracks` (Task 3); `getCatalogStats`, `getCourses` (existing); `<TrackRow />` (Task 9).
- Produces: nothing.

The scroll, in order: the promise with one track previewed; "pick your climb" with tracks side by side; what the week-to-week rhythm is; what you walk away with; request a seat.

**No proof section.** No testimonials, no student work, no completion statistics, no invented numbers. The product has no graduates. `getCatalogStats` returns real counts and may be used; nothing else may be asserted.

- [ ] **Step 1: Write the page**

Replace `src/app/(site)/page.tsx` entirely. This keeps the existing hero artwork treatment (`CourseArtwork` behind a scrim) and type scale, and replaces the category list and featured-course list with the track sections:

```tsx
import type { Metadata } from "next";
import { CourseArtwork } from "@/components/brand/course-artwork";
import { TrackRow } from "@/components/track/track-row";
import { ButtonLink } from "@/components/ui/button-link";
import { getCatalogStats, getTracks } from "@/lib/content/queries";

export const metadata: Metadata = {
  title: "Sodales Academy",
  description:
    "Ordered tracks in freelancing, branding, and web development. Each one ends in a stated capability.",
};

/**
 * The rhythm section is fixed copy, not derived data. It describes how the
 * Academy is actually run — if that changes, this changes. It deliberately
 * makes no claim about outcomes, graduates, or how long anything takes for a
 * given person.
 */
const RHYTHM = [
  {
    label: "Read",
    body: "Each lesson is written to be finished in one sitting, not skimmed across a week.",
  },
  {
    label: "Build",
    body: "Every course produces something real. You are not collecting notes, you are collecting work.",
  },
  {
    label: "Mark it done",
    body: "Progress is yours and it persists. Pick up exactly where you stopped, on any device.",
  },
];

export default async function Home() {
  const [stats, tracks] = await Promise.all([getCatalogStats(), getTracks()]);
  const lead = tracks[0] ?? null;

  return (
    <>
      {/* 1. The promise, with one real track previewed rather than described */}
      <section className="mx-auto grid max-w-6xl gap-10 px-4 py-20 md:grid-cols-2 md:py-28">
        <div className="flex flex-col gap-6">
          <p className="label-eyebrow text-violet">Sodales Academy</p>
          <h1 className="text-5xl leading-[0.95] font-bold tracking-tight md:text-7xl">
            Learn the craft. Ship the work.
          </h1>
          <p className="max-w-md text-lg text-graphite">
            {lead
              ? "Ordered tracks, not a pile of videos. Start at lesson one and finish able to do the thing the track names."
              : "Practical courses in freelancing, branding, and web development, built by the Sodales collective."}
          </p>
          <div className="flex flex-wrap gap-3 pt-2">
            {lead ? (
              <ButtonLink href={`/tracks/${lead.slug}`}>See the {lead.title} track</ButtonLink>
            ) : (
              <ButtonLink href="/courses">Browse courses</ButtonLink>
            )}
            <ButtonLink variant="outline" href="/courses">
              Browse all courses
            </ButtonLink>
          </div>
        </div>

        <div className="relative isolate min-h-64 overflow-hidden rounded-md border border-border">
          <div className="absolute inset-0 -z-10">
            <CourseArtwork
              seed={lead?.slug ?? "sodales-academy"}
              lessonCount={lead?.lessonCount ?? 9}
            />
          </div>
          <div
            aria-hidden="true"
            className="absolute inset-0 -z-10 bg-linear-to-t from-obsidian/95 via-obsidian/40 to-transparent"
          />
          <div className="flex h-full flex-col justify-end gap-3 p-10 text-ivory">
            {lead ? (
              <>
                <p className="label-eyebrow text-violet-accessible">Track</p>
                <p className="text-3xl leading-tight font-bold tracking-tight">{lead.title}</p>
                <p className="text-ivory/70">
                  {lead.courseCount} courses · {lead.lessonCount} lessons
                </p>
              </>
            ) : (
              <p className="text-3xl leading-tight font-bold tracking-tight">
                Creative Intelligence. Collective Impact.
              </p>
            )}
          </div>
        </div>
      </section>

      {/* Live catalog counts — the only numbers on this page, and all real */}
      <section className="border-y border-border">
        <div className="mx-auto grid max-w-6xl divide-y divide-border sm:grid-cols-3 sm:divide-x sm:divide-y-0">
          {[
            { label: "Tracks", value: tracks.length },
            { label: "Courses", value: stats.courses },
            { label: "Lessons", value: stats.lessons },
          ].map((stat) => (
            <div key={stat.label} className="flex flex-col gap-1 px-4 py-10 text-center">
              <span className="text-5xl font-bold tracking-tight">{stat.value}</span>
              <span className="label-eyebrow text-graphite">{stat.label}</span>
            </div>
          ))}
        </div>
      </section>

      {/* 2. Pick your climb. Rendered only when there is something to pick — an
          empty grid of slots reads as broken and costs more trust than omitting
          the section entirely. */}
      {tracks.length > 0 ? (
        <section className="mx-auto max-w-6xl px-4 py-20">
          <h2 className="text-3xl font-bold tracking-tight">Pick your climb</h2>
          <p className="mt-3 max-w-xl text-graphite">
            Each track is an ordered path through several courses. The order is the point.
          </p>
          <div className="mt-10 grid gap-6 md:grid-cols-2">
            {tracks.map((track) => (
              <TrackRow key={track.slug} track={track} />
            ))}
          </div>
        </section>
      ) : null}

      {/* 3. What the week-to-week rhythm actually is */}
      <section className="mx-auto max-w-6xl px-4 py-20">
        <h2 className="text-3xl font-bold tracking-tight">What it&apos;s actually like</h2>
        <ul className="mt-8 divide-y divide-border border-t border-border">
          {RHYTHM.map((item, index) => (
            <li key={item.label} className="flex flex-col gap-2 py-6 md:flex-row md:gap-8">
              <span className="label-eyebrow shrink-0 text-graphite md:w-12">
                {String(index + 1).padStart(2, "0")}
              </span>
              <span className="shrink-0 text-xl font-bold md:w-48">{item.label}</span>
              <p className="max-w-xl text-graphite">{item.body}</p>
            </li>
          ))}
        </ul>
      </section>

      {/* 4. What you walk away with — the lead track's real outcome copy */}
      {lead ? (
        <section className="bg-deep-ink text-ivory">
          <div className="mx-auto max-w-6xl px-4 py-20">
            <p className="label-eyebrow text-violet-accessible">What you walk away with</p>
            <p className="mt-4 max-w-3xl text-3xl leading-tight font-bold tracking-tight md:text-4xl">
              {lead.outcome}
            </p>
          </div>
        </section>
      ) : null}

      {/* 5. Request a seat */}
      <section className="bg-obsidian text-ivory">
        <div className="mx-auto flex max-w-6xl flex-col items-start gap-6 px-4 py-20">
          <h2 className="text-3xl font-bold tracking-tight">Ready to start?</h2>
          <p className="max-w-xl text-ivory/70">
            Seats are issued by invite code. If you have one, sign in and it&apos;ll let you
            through.
          </p>
          <ButtonLink href="/login">I have an invite code</ButtonLink>
        </div>
      </section>
    </>
  );
}
```

- [ ] **Step 2: Check the honesty of every claim on the page**

Re-read the rendered page and confirm each of these:

- The only numbers are `tracks.length`, `stats.courses`, and `stats.lessons` — all real counts.
- `lead.outcome` and `lead.title` come from the database, not from this file.
- The `RHYTHM` copy describes how the product works and claims no outcome, no timeline, and no graduate.
- Nothing implies anyone has completed anything.

If the "request a seat" copy does not match how seats are actually issued once the Seats & access spec lands, update it then — do not leave it describing a flow that does not exist.

- [ ] **Step 3: Verify in the browser**

```bash
pnpm dev
```

Visit `http://localhost:3000/` signed out. Confirm: the promise is legible without scrolling; every track shows its stages, lesson count and outcome; nothing on the page claims a graduate, testimonial, or statistic that is not `getCatalogStats`.

- [ ] **Step 4: Check both breakpoints**

Resize to 390px and 1440px. Confirm no horizontal scroll and that the hero type scale still reads.

- [ ] **Step 5: Typecheck, lint, build, commit**

```bash
pnpm typecheck && pnpm lint && pnpm build
git add src/app/\(site\)/page.tsx
git commit -m "feat: rebuild the home page as the track pitch"
```

---

### Task 13: Scope the intro splash to the home page

**Files:**
- Modify: `src/proxy.ts`
- Modify: `src/components/brand/brand-intro-gate.tsx`
- Modify: `CLAUDE.md`

**Interfaces:**
- Consumes: `INTRO_COOKIE` from `@/lib/brand/intro-cookie`.
- Produces: nothing.

This resolves spec open decision #1. Server Components cannot read the pathname, and moving the gate into `(site)/page.tsx` puts it back behind `app/loading.tsx`'s Suspense boundary — the ivory skeleton flash the root-layout placement exists to avoid. The fix is a header set by the proxy.

- [ ] **Step 1: Read the proxy first**

```bash
cat src/proxy.ts
```

Understand its current matcher before changing it. `CLAUDE.md` documents it as running on exactly `/dashboard`, `/learn`, and `/admin`, and explicitly as **not** an authorization gate. Widening the matcher must not change that.

- [ ] **Step 2: Set the pathname header**

`src/proxy.ts` currently exports `auth.middleware({ loginUrl: "/login" })` directly. It now needs to wrap that, because `/` must NOT go through `auth.middleware` — that helper redirects unauthenticated visitors on matched paths to `loginUrl`, and the home page is deliberately world-readable. Sending `/` through it would put the entire pitch page behind a login wall.

Replace the export and matcher, keeping the existing docblock above them:

```ts
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/server";

// ... keep the existing docblock ...

const authMiddleware = auth.middleware({ loginUrl: "/login" });

/**
 * `/` was added to the matcher for ONE reason: Server Components cannot read the
 * request pathname, and `BrandIntroGate` needs it to scope the intro to the home
 * page. It is handled separately and deliberately never reaches
 * `auth.middleware` — that helper redirects unauthenticated visitors on matched
 * paths to `loginUrl`, and the home page is world-readable. This is still not an
 * authorization gate; every authenticated route re-derives its own session via
 * `requireUser`/`requireRole`.
 */
export default function proxy(request: NextRequest) {
  if (request.nextUrl.pathname === "/") {
    const headers = new Headers(request.headers);
    headers.set("x-pathname", "/");
    return NextResponse.next({ request: { headers } });
  }

  return authMiddleware(request);
}

export const config = {
  matcher: ["/", "/dashboard/:path*", "/learn/:path*", "/admin/:path*"],
};
```

If `auth.middleware(...)` returns something whose call signature does not accept a bare `NextRequest` (check `node_modules/@neondatabase/auth/dist/next/server/index.d.mts`), pass through whatever second argument Next supplies rather than guessing — do not silently drop it.

- [ ] **Step 2b: Verify the home page is still public**

```bash
pnpm dev
```

In a private window (signed out), load `http://localhost:3000/`. Expected: the page renders. If it redirects to `/login`, `/` is reaching `auth.middleware` and Step 2's branch is wrong — fix it before continuing, because this would take the entire pitch offline for every prospective customer.

- [ ] **Step 3: Gate on it**

In `src/components/brand/brand-intro-gate.tsx`, read `headers()` (async in Next 16) and return `null` unless the path is exactly `/`:

```tsx
import { cookies, headers } from "next/headers";
import { BrandIntro } from "@/components/brand/brand-intro";
import { INTRO_COOKIE } from "@/lib/brand/intro-cookie";

export async function BrandIntroGate() {
  const [store, headerList] = await Promise.all([cookies(), headers()]);

  // Home page only. The proxy sets x-pathname because Server Components have no
  // access to the pathname, and mounting this inside (site)/page.tsx instead
  // would put it back behind app/loading.tsx's Suspense boundary — the ivory
  // skeleton flash this component's root-layout placement exists to avoid.
  if (headerList.get("x-pathname") !== "/") return null;
  if (store.has(INTRO_COOKIE)) return null;

  return <BrandIntro />;
}
```

- [ ] **Step 4: Verify**

```bash
pnpm dev
```

Clear the `sodales_intro` cookie. Confirm: the intro plays on `/`; it does not play on `/courses`, `/tracks`, `/login`, or `/admin`; and there is no ivory skeleton flash before it on `/`.

- [ ] **Step 5: Update the documentation**

In `CLAUDE.md`, correct the `src/proxy.ts` bullet — it currently says the proxy runs only on `/dashboard`, `/learn`, and `/admin`. State the new matcher, that `/` was added solely to set `x-pathname` for the intro gate, and that it is still not an authorization gate.

- [ ] **Step 6: Typecheck, lint, build, commit**

```bash
pnpm typecheck && pnpm lint && pnpm build
git add src/proxy.ts src/components/brand/brand-intro-gate.tsx CLAUDE.md
git commit -m "feat: scope the brand intro to the home page"
```

---

### Task 14: Correct the positioning in the docs

**Files:**
- Modify: `CLAUDE.md`
- Modify: `docs/superpowers/specs/2026-09-03-academy-frontend-design.md`

**Interfaces:**
- Consumes: nothing.
- Produces: nothing.

Spec §2 records a breaking positioning change: the Academy sells seats to customers; it is no longer "for team members first". `CLAUDE.md` is the most-read file in the repo and currently states the old model, which makes it actively wrong.

- [ ] **Step 1: Update `CLAUDE.md`**

- Rewrite the "Context — The Playbook PH" section: the Academy sells seats to customers. An invite code is a receipt for a paid seat, sold and fulfilled manually — no payment provider in the codebase. The public catalog still doubles as Agency proof-of-work, but that is now a side effect, not the purpose.
- Add tracks to "Where things live": `src/db/schema/track.ts`, `src/lib/track-progress.ts`, `src/components/track/`, `src/app/(site)/tracks/`, `src/app/admin/tracks/`.
- Add to "Rules that get broken most": **tracks are admin-managed** — every track write calls `requireRole("admin")`, not `requireRole("instructor", "admin")`, because a track can contain courses owned by several instructors and `assertCanManageCourse` has no single owner to check.
- Add: **enrolling in a track fans out to per-course `enrollment` rows.** Nothing is recorded against the track, which is why deleting a track destroys no learner progress. Do not "optimise" this into a `track_enrollment` table without re-deciding that guarantee.
- Update the "Outstanding / deferred" list: single-use invite codes, progression locking, and points/streaks/badges are now specced follow-ups, not indefinite deferrals.

- [ ] **Step 2: Update the frontend spec's §11**

Add a deviation entry recording that the "team members first" positioning in §11 is superseded by `2026-09-05-academy-journey-design.md` §2, with a one-line reason. Do not delete the original entry — the deviation log is a history, not a current-state document.

- [ ] **Step 3: Verify no stale claims remain**

```bash
grep -rn "team members first" CLAUDE.md docs/
```

Expected: only the superseded-and-annotated entry in the frontend spec's deviation log.

- [ ] **Step 4: Commit**

```bash
git add CLAUDE.md docs/superpowers/specs/2026-09-03-academy-frontend-design.md
git commit -m "docs: correct positioning to direct-to-customer"
```

---

### Task 15: Full verification

**Files:** none.

- [ ] **Step 1: Run everything**

```bash
pnpm typecheck && pnpm lint && pnpm test && pnpm build
```

Expected: typecheck clean; lint reports only the two pre-existing warnings (`sign-out-button.tsx:10`, `queries.ts:93`); every test passes; the build succeeds.

- [ ] **Step 2: Confirm the seam is intact**

```bash
grep -rn "@/db" src | grep -v "src/lib/content/" | grep -v "src/lib/session.ts" | grep -v "src/db/" | grep -v "src/app/actions/verify-invite-code.ts"
```

Expected: no output. Any hit means a page or component reached around the seam.

- [ ] **Step 3: Walk the acceptance criteria**

Check each item in spec §11 by hand against the running app:

- A signed-out visitor on `/` can state what a track will make them able to do.
- A signed-out visitor can view any published track's full structure.
- A draft track is invisible to non-managers on `/tracks` and `/tracks/[slug]`.
- Enrolling produces one `enrollment` row per member course; enrolling twice changes nothing.
- An enrolled learner sees real completion and exactly one obvious next action.
- Deleting a track destroys no learner progress.
- No page claims a graduate, testimonial, or statistic that does not exist.
- `CLAUDE.md` and the frontend spec no longer say "team members first".

- [ ] **Step 4: Commit any fixes**

```bash
git add -A
git commit -m "chore: journey acceptance fixes"
```

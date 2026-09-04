# Sodales Academy — The Journey (Tracks, Onboarding, Progression Surface)

Status: proposed
Date: 2026-09-05
Supersedes: nothing. Amends the positioning recorded in
`2026-09-03-academy-frontend-design.md` §11 and `CLAUDE.md` (see §2).

## 1. Purpose

Today the Academy renders as a list. A visitor sees four course titles and a
lesson count, and nothing tells them what they would be able to *do* after
working through it. This spec makes the curriculum legible as a climb — an
ordered path with stated outcomes — and uses that same structure twice: as the
pitch to someone who has not bought, and as the map for someone who has.

This is the first of four specs. The others, in order:

| Spec | Scope | Why after this one |
| --- | --- | --- |
| Seats & access | Single-use invite codes, redemption bound to a real user, admin minting | Independent, but pointless to sell access to a product with no visible shape |
| Locked progression | Courses/lessons unlock in sequence within a track | Needs tracks to exist before "in sequence" means anything |
| Points, streaks, badges | Retention mechanics over real write paths | Easiest to design once the journey it decorates is real |

## 2. Positioning change (breaking, documented)

The prior specs and `CLAUDE.md` describe the Academy as "for team members
first", with the public catalog as Agency proof-of-work for The Playbook PH.
**That is no longer the model.** The Academy sells seats to customers.

Consequences this spec accepts:

- An invite code is a **receipt for a paid seat**, sold and fulfilled manually
  (off-site payment, code minted and sent). No payment provider enters the
  codebase; `docs/02-academy.md`'s deferral of payments still holds.
- A code must therefore be **single-use, bound to one person**. That is the
  Seats & access spec, not this one — but it is a prerequisite for taking money,
  and today one code admits unlimited people.
- `CLAUDE.md` and the frontend spec's §11 must be rewritten as part of
  implementing this spec. Leaving them saying "team members first" would make
  the most-read file in the repo actively wrong.

## 3. Scope

### In scope

- `track` and `track_course` tables, migration, and seed data for the initial
  tracks.
- Reads: `getTracks`, `getTrackBySlug`, track progress derivation.
- Write: `enrollInTrack`.
- Home page rebuilt as the pitch.
- `/tracks/[slug]` — the journey map, dual-mode (unenrolled / enrolled).
- Track context on the dashboard, course pages, and the lesson player.
- Admin UI: create, edit, order, and publish tracks.
- Visual pass across the screens this spec touches.

### Out of scope

- Progression **locking**. This spec renders a course's position and completion
  in a track; it does not prevent access to a later course. Locking is its own
  spec because it is a product decision (it stops a buyer reaching the lesson
  they came for), not a rendering detail.
- Points, streaks, badges, certificates.
- Single-use invite codes and code minting (next spec).
- Payments, refunds, tax.
- Proof / testimonials / student work. See §8.
- An interactive "find your track" picker. Revisit once the catalog is large
  enough that a recommendation feels earned.

## 4. Data model

Two new tables. Nothing about `enrollment` or `lesson_progress` changes, which
is the load-bearing decision in this spec: every existing query, the dashboard,
the lesson player, and all current progress data keep working untouched.

```
track
  id                uuid pk default random
  slug              text not null unique
  title             text not null
  promise           text not null   -- one line, shown on cards and the hero
  outcome           text not null   -- "You finish able to: ..." — the sell
  status            text not null   -- 'draft' | 'published'
  position          integer not null default 0
  created_at        timestamp not null default now()
  updated_at        timestamp not null default now()

track_course
  id                uuid pk default random
  track_id          uuid not null references track(id) on delete cascade
  course_id         uuid not null references course(id) on delete cascade
  position          integer not null
  unique (track_id, course_id)
  index on (track_id, position)
```

Notes:

- `on delete cascade` from `track` is safe — `track_course` holds no learner
  data. `enrollment` and `lesson_progress` are keyed to courses, not tracks, so
  **deleting a track never destroys anyone's progress.** This is deliberate and
  is the reason enrolment fans out to courses rather than being recorded against
  the track.
- A course may belong to more than one track. `unique (track_id, course_id)`
  prevents a course appearing twice within a single track, which is the only
  duplication that would break ordering.
- `position` is unconstrained beyond the index; reordering rewrites the column
  for the affected track. It is not unique, so a transient duplicate during a
  reorder is not a constraint violation — ordering falls back to `position, id`
  for determinism.

## 5. Reads (`src/lib/content/queries.ts`)

- `getTracks(): Promise<TrackSummary[]>` — published tracks in `position` order,
  each with course count and total lesson count. One query with joins and
  aggregates, not a fan-out; the recent `getCourses`/`getCatalogStats` work
  removed N+1s and this must not reintroduce them.
- `getTrackBySlug(slug, viewer?): Promise<TrackDetail | null>` — the track, its
  courses in order, each course's lesson count, and — when `viewer` is present —
  that viewer's completed-lesson count per course. Draft tracks resolve only for
  a viewer who can manage them, mirroring `getCourseBySlug` /
  `getCourseBySlugForAdmin`.
- `getTracksForAdmin(viewer)` — every track, including drafts. Callers call
  `requireRole("admin")` themselves and pass the session in, matching the
  existing convention that a page re-derives its own session rather than
  trusting a caller.

Progress derivation stays a **pure function** in `src/lib/lesson-progress.ts`
over the counts the query returns. No progress arithmetic inside the query, so
it can be unit-tested without a database.

## 6. Write (`src/lib/content/mutations.ts`)

`enrollInTrack(trackSlug): Promise<MutationResult>`

1. `requireUser()` — the viewer is derived server-side; no client-supplied user
   id is trusted, per spec §8 of the backend design.
2. Resolve the track. A draft track is not enrollable by a non-manager.
3. Insert an `enrollment` row for every course in the track,
   `onConflictDoNothing` on `(user_id, course_id)` so re-clicking, a double
   submit, or a track the learner is partly enrolled in cannot double-write or
   fail.
4. Return `{ ok: true }` / `{ ok: false, message }`. The client branches on
   `result.ok` and surfaces the real message — no optimistic success.

`drizzle-orm/neon-http` has no transactions, so the inserts run sequentially
against `db` with the same acknowledging comment the other multi-statement
mutations carry. The failure mode here is mild and self-healing: a mid-write
crash leaves the learner enrolled in a prefix of the track, and re-running
`enrollInTrack` completes it, because step 3 is idempotent.

Admin writes — `createTrack`, `updateTrack`, `publishTrack`, `unpublishTrack`,
`deleteTrack` — each call `requireRole("admin")`.

**Tracks are admin-managed, not instructor-managed**, and this is a deliberate
narrowing of the existing rule rather than an oversight. `assertCanManageCourse`
answers "does this viewer own this course"; a track can contain courses owned by
several different instructors, so there is no coherent single owner to check
against. Letting any contributing instructor edit the track would let them
reorder or remove another instructor's course, and letting only an
all-courses-owner edit it makes most tracks uneditable. Admin-only sidesteps a
question that has no good answer at this size. Revisit if instructor-authored
tracks are ever actually wanted — that needs a real `track.owner_user_id` and
its own decision.

`updateTrack` reconciles `track_course` by `courseId`, not by
delete-and-reinsert; the rows carry no learner data, but the habit matters and
the existing `updateCourse` reconciliation is the pattern to follow.

## 7. Screens

**Home (`/`)** — rebuilt as one scroll:

1. The promise, with one live track previewed rather than described.
2. "Pick your climb" — tracks side by side, each showing its stages, lesson
   count, and outcome.
3. What the week-to-week rhythm actually is.
4. What you walk away with — the artifact, stated concretely.
5. Request a seat.

**`/tracks/[slug]`** — the journey map, one component in two states. Unenrolled:
the whole climb visible, every course legible, outcome prominent, CTA to request
a seat. Enrolled: the same map with real completion, the learner's position
marked, and a single unambiguous "continue here".

**Dashboard** — track-level progress alongside the existing per-course cards.

**Course page and lesson player** — track breadcrumb and "next in track", so
"what do I do now" always has an answer.

The visual pass happens inside these screens. Constraints unchanged: Inter only
at 400/700, Electric Violet `#5E4FB3` as the sole action colour, never violet
text on Obsidian, the wordmark only through `<BrandWordmark />`. Cover artwork
and the 26.2° shear axis established in `src/lib/brand/course-artwork.ts` extend
to tracks rather than being replaced.

**Admin** — a tracks section mirroring the existing courses admin: list, create,
edit, reorder member courses, publish/unpublish, delete. Reuses the course-form
and row-actions patterns rather than inventing new ones.

## 8. What this spec will not claim

The home page sells a product with no graduates. v1 therefore ships **no
testimonials, no student work, no completion statistics, and no invented
numbers**. The sell rests on the curriculum and the stated outcome, both of
which are real and checkable against the catalog.

`outcome` is author-supplied copy and the spec cannot verify it. It is a promise
made to someone who is about to pay, so it belongs to whoever writes the track,
not to the implementation.

## 9. Testing

- Pure unit tests for track progress derivation — percentages, the
  zero-lesson track, a fully-complete track, and a course present in two tracks.
- Integration tests against the real Postgres test database, following the
  existing fixture-prefix-and-clean-up-in-`afterAll` convention:
  - `enrollInTrack` creates exactly one enrollment per course in the track.
  - Calling it twice is a no-op the second time.
  - An unauthenticated call is rejected.
  - A non-manager cannot enrol in a draft track.
  - Deleting a track leaves `enrollment` and `lesson_progress` intact — the
    guarantee §4 depends on, asserted rather than assumed.
- Admin authorization tests mirroring the existing course-management coverage,
  including that an **instructor** cannot create, edit, or delete a track — the
  narrowing in §6 is a rule, so it gets a test.

## 10. Open decisions

1. **Intro splash scoping.** Decided: home page only. Not decided: how. Server
   Components cannot read the pathname, and moving `BrandIntroGate` into
   `(site)/page.tsx` puts it back behind `app/loading.tsx`'s Suspense boundary,
   which is the flash the current root-layout placement exists to avoid. Likely
   answer is `src/proxy.ts` setting an `x-pathname` header, which requires
   widening its matcher — a file `CLAUDE.md` documents as running on exactly
   three paths. Resolve during implementation and update `CLAUDE.md` with it.
2. **Initial tracks.** How many, and which existing courses go in each. Four
   courses will not fill several tracks; the first release may be one track.
3. **Track artwork.** Whether tracks get their own generated cover or reuse the
   first course's.

## 11. Acceptance criteria

- A signed-out visitor landing on `/` can state, without clicking, what a track
  will make them able to do.
- A signed-out visitor can view any published track's full structure.
- A draft track is invisible to non-managers on both `/tracks` and
  `/tracks/[slug]`.
- Enrolling in a track produces one `enrollment` row per member course, and
  enrolling twice changes nothing.
- An enrolled learner sees real completion on the track map and has exactly one
  obvious next action.
- Deleting a track destroys no learner progress.
- No page claims a graduate, a testimonial, or a statistic that does not exist.
- `pnpm build`, `pnpm lint`, `pnpm typecheck`, and `pnpm test` all pass.
- `CLAUDE.md` and the frontend spec's §11 no longer say "team members first".

## 12. Risks

- **Content volume.** A journey map is only as convincing as the climb it
  depicts. Four courses across nineteen lessons will render as a short path. The
  UI can scale up gracefully; the catalog is the real constraint on how
  compelling this is, and no amount of design fixes that.
- **Scope creep into locking.** A rendered path invites "and it should lock".
  Resisting that keeps this spec shippable; the locking spec exists for it.
- **Two audiences, one page.** The catalog was world-readable as Agency
  proof-of-work. It is now a storefront. If both matter, say so before
  implementation — the pages optimise differently.

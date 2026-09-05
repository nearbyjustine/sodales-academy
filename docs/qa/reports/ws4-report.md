# Workstream 4 report — Loading skeletons (D1–D4)

Plan followed: `docs/qa/plans/ws4-skeletons.md`, verbatim (all nine files match the plan's code
blocks exactly, byte-for-byte for the two intentionally-duplicated form skeletons).

## Files created

| File | Matched against |
| --- | --- |
| `src/app/admin/courses/loading.tsx` | `src/app/admin/courses/page.tsx` (header row + bordered table, Title/Status/Level/Category/Lessons/Actions) |
| `src/app/admin/tracks/loading.tsx` | `src/app/admin/tracks/page.tsx` (header row + bordered table, Title/Status/Courses/Actions) |
| `src/app/admin/courses/new/loading.tsx` | `src/app/admin/courses/new/page.tsx` + `src/components/admin/course-form.tsx` (flush, no-padding `<form className="flex flex-col gap-6">`; field order Title/Slug, Description, Category/Level, Instructor, Modules, Save) |
| `src/app/admin/courses/[id]/edit/loading.tsx` | Same as above — `src/app/admin/courses/[id]/edit/page.tsx` renders the identical `CourseForm` |
| `src/app/admin/tracks/new/loading.tsx` | `src/app/admin/tracks/new/page.tsx` + `src/components/admin/track-form.tsx` (`p-6 lg:p-10` wrapper, `max-w-2xl` form; Title/Slug, Promise, Outcome, Position, Courses fieldset, submit) |
| `src/app/admin/tracks/[id]/edit/loading.tsx` | Same as above — `src/app/admin/tracks/[id]/edit/page.tsx` renders the identical `TrackForm` |
| `src/app/(site)/loading.tsx` | `src/app/(site)/page.tsx`'s first three fixed-structure sections (hero grid, stat strip, track list) |

## Files edited

| File | Change | Matched against |
| --- | --- | --- |
| `src/app/(site)/tracks/loading.tsx` | Replaced `md:grid-cols-2` two-column grid with a `flex flex-col gap-6` vertical stack of `h-56 w-full` rows | `src/app/(site)/tracks/page.tsx` + `src/components/track/track-row.tsx` (full-width `min-h-56` rows, not a grid) |
| `src/app/(site)/courses/[slug]/loading.tsx` | Added `<Skeleton className="mb-10 h-40 w-full md:h-56" />` as the first placeholder | `src/app/(site)/courses/[slug]/page.tsx` (artwork banner renders before the level/category badges) |

No page component, shared component, or any file outside these nine `loading.tsx` files was
touched.

## Verification

### `pnpm typecheck`
```
$ tsc --noEmit
```
Exit 0, no output — clean.

### `pnpm lint`
```
$ eslint .

/Users/justine/Documents/sodales/src/components/layout/sign-out-button.tsx
  10:5  warning  Do not use `window.location.href` to navigate to internal Next.js pages. ...
  @next/next/no-location-assign-relative-destination

/Users/justine/Documents/sodales/src/lib/content/queries.ts
  110:20  warning  '_modules' is assigned a value but never used  @typescript-eslint/no-unused-vars

✖ 2 problems (0 errors, 2 warnings)
```
Exactly the two known pre-existing warnings. No new warnings from this workstream's files.

### `pnpm build`
```
$ next build
▲ Next.js 16.3.4 (Turbopack)
✓ Compiled successfully in 203ms
  Running TypeScript ...
  Finished TypeScript in 1082ms ...
  Collecting page data using 14 workers ...
  Generating static pages using 14 workers (0/16) ...
[neon-auth] Cookie validation error before getSession upstream call { ... Dynamic server usage ... }
  (repeated once per dynamic route: /, /courses, /tracks, /admin, /admin/courses, /admin/tracks,
   /admin/courses/new, /admin/tracks/new, ...)
✓ Generating static pages using 14 workers (16/16) in 613ms
  Finalizing page optimization ...

Route (app)
┌ ƒ /
├ ƒ /_not-found
├ ƒ /admin
├ ƒ /admin/courses
├ ƒ /admin/courses/[id]/edit
├ ƒ /admin/courses/new
├ ƒ /admin/tracks
├ ƒ /admin/tracks/[id]/edit
├ ƒ /admin/tracks/new
├ ƒ /api/auth/[...path]
├ ƒ /courses
├ ƒ /courses/[slug]
├ ƒ /dashboard
├ ƒ /learn/[courseSlug]/[lessonSlug]
├ ƒ /login
├ ○ /robots.txt
├ ƒ /sign-up
├ ○ /sitemap.xml
├ ƒ /tracks
└ ƒ /tracks/[slug]

ƒ Proxy (Middleware)
```
Exit 0. The `[neon-auth] Cookie validation error ... Dynamic server usage` lines are expected —
every route is dynamic because the root layout reads the session via `getSession` (documented in
`CLAUDE.md`'s "Streaming responses can't change their HTTP status after the fact" note); this is
unrelated to the skeleton files and present on `main` before this change.

### `pnpm test`
```
$ vitest run
 Test Files  18 passed (18)
      Tests  130 passed (130)
   Duration  7.71s
```
Exit 0, all green.

## Deviations from the plan

None. All nine files match the plan's specified content exactly (verified by diffing the written
files against the plan's code blocks before running verification).

## Concerns

- None new. The plan's own out-of-scope note (D1 section) about `/admin/courses/new` and
  `/admin/courses/[id]/edit` rendering `CourseForm` with no `p-6 lg:p-10` wrapper is a real layout
  inconsistency but is explicitly a page-component issue, not a skeleton issue — outside this
  workstream's scope, and left untouched. The two new course-form skeletons deliberately reproduce
  the flush (no-padding) layout so they don't contradict what the page actually renders today.
- At the time of this run, other workstreams had uncommitted changes in `src/app/(site)/dashboard/page.tsx`,
  `src/components/course/enrolled-course-card.tsx`, `src/components/lesson/lesson-sidebar.tsx`,
  `src/components/track/track-progress-card.tsx`, and `src/lib/lesson-progress.ts` (+ a new
  `src/lib/lesson-progress.test.ts`). None of those files were touched by this workstream and none
  were staged/committed here — this commit contains only the nine `loading.tsx` files listed above.
- Manual DevTools throttling check (plan's verification step 4) was not performed — it requires a
  running dev server and browser interaction outside this task's tooling; the four required
  automated commands above all pass.

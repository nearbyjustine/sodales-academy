# Workstream 1 report — Progress rendering + shared course-progress helper (A1, B1)

Ref: `docs/qa/2026-09-05-frontend-qa.md` §A1, §B1; plan `docs/qa/plans/ws1-progress.md`.

## Summary

A1 (double progress track, never fills) and B1 (course-progress maths copy-pasted three times)
are both fixed. The plan was followed exactly — no deviations.

## Files changed

- `src/lib/lesson-progress.ts` — added `CourseProgress` type and `courseProgress(totalLessons,
  completedLessons)` helper, appended after the existing `firstIncompleteLesson` export. No
  changes to imports; stays free of `@/db`, `@/lib/session`, and React hooks.
- `src/lib/lesson-progress.test.ts` (new) — 6 unit tests for `courseProgress`, mirroring
  `track-progress.test.ts`'s plain `describe`/`it`/`expect` shape, no mocks, no database.
- `src/components/course/enrolled-course-card.tsx` — removed the redundant
  `<ProgressTrack><ProgressIndicator/></ProgressTrack>` children (A1); replaced the inline
  `total`/`percent`/`isFinished` maths with `courseProgress(...)` (B1).
- `src/components/track/track-progress-card.tsx` — removed the redundant `ProgressTrack`/
  `ProgressIndicator` children only (A1). This file already used `trackProgress`, so it wasn't
  part of B1's duplication.
- `src/components/lesson/lesson-sidebar.tsx` — replaced the local `summarizeProgress` function
  with `courseProgress(...)` (B1); renamed the `progress` shape's fields
  (`completed`/`total` → `completedLessons`/`totalLessons`) and updated `SidebarContent`'s prop
  type to `CourseProgress`. Its `<Progress>` JSX usage was already correct per A1 and was left
  untouched beyond the field-name rename in the text below the bar.
- `src/app/(site)/dashboard/page.tsx` — routed `coursesFinished`'s finished-predicate through
  `courseProgress(total, completedLessonIds.length).isComplete` (B1). No other part of the file
  touched, per the constraint to keep this edit confined to the progress maths for the other
  workstream's later layout edit.
- `docs/qa/reports/ws1-report.md` (this file, new).

## Helper signature

```ts
export type CourseProgress = {
  completedLessons: number;
  totalLessons: number;
  percent: number;      // 0–100, rounded. 0 when the course has no lessons at all.
  isComplete: boolean;  // true only once the course has lessons AND all are complete
};

export function courseProgress(totalLessons: number, completedLessons: number): CourseProgress
```

Takes raw counts (not lesson objects or ids) because the three call sites arrive with different
shapes; centralizes rounding, the divide-by-zero guard, the over-100% clamp, and the "finished"
predicate so they can't drift between call sites.

## Verification — all five commands, real output

### `pnpm vitest run src/lib/lesson-progress.test.ts`

```
 RUN  v4.1.11 /Users/justine/Documents/sodales

 Test Files  1 passed (1)
      Tests  6 passed (6)
   Start at  21:33:03
   Duration  726ms
```

### `pnpm typecheck`

```
$ tsc --noEmit
```
Exit 0, no output — no type errors.

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
Exactly the two known pre-existing warnings named in the task — no new warnings (in particular no
`no-unused-vars` for the removed `ProgressTrack`/`ProgressIndicator` imports or the deleted
`summarizeProgress`).

### `pnpm test`

```
 RUN  v4.1.11 /Users/justine/Documents/sodales

 Test Files  18 passed (18)
      Tests  130 passed (130)
   Start at  21:33:15
   Duration  7.72s
```
Full suite green, including the new `lesson-progress.test.ts` and the untouched
`track-progress.test.ts`. No existing test file needed updating.

### `pnpm build`

```
▲ Next.js 16.3.4 (Turbopack)
✓ Compiled successfully in 196ms
✓ Running TypeScript ... Finished TypeScript in 1162ms
✓ Generating static pages using 14 workers (16/16) in 568ms
  Finalizing page optimization ...

Route (app)                                  ... (all 19 routes listed, all ƒ or ○)
ƒ Proxy (Middleware)
```
Build succeeded (exit 0). The `[neon-auth] Cookie validation error ... Dynamic server usage`
lines that print during static-page generation for `/`, `/courses`, `/dashboard`, `/tracks`, and
the `/admin/*` routes are the documented, expected behavior described in `CLAUDE.md` (every route
is dynamic because the root layout reads the session) — not build errors; the build still reports
success and every route resolves to `ƒ` (server-rendered) as expected.

Grep verifications from the plan's step 7 both matched the expected output exactly:
- `ProgressTrack`/`ProgressIndicator` hits are confined to `src/components/ui/progress.tsx`
  itself — zero hits in the two former offenders.
- No inline `Math.round((...done/completed.../total...)` pattern remains anywhere in
  `src/components` or `src/app`.

## How A1 was verified

Verified live in a browser, not just asserted. There was already a running `pnpm dev` server on
`localhost:3000` for this repo (PID 19926, up ~52 minutes, same working directory) that had picked
up the edits via HMR; I used the Chrome browser tool against it rather than starting a second dev
server (which correctly refused to bind, since Next detected the existing instance on port 3000).

Steps, signed in as the real dev-database user (Justine Castaneda, one enrollment in "Landing Your
First Client", 0/5 lessons complete beforehand):

1. Loaded `/dashboard` before making any UI change to confirm the pre-fix state (single empty
   bar visible at 0%, matching the "no fill" half of the bug — zoomed screenshot confirmed one
   track, not two, at that specific data point).
2. After the edits, clicked into the enrolled course, clicked "Mark complete" on lesson 1 of 5,
   and confirmed the lesson-sidebar progress bar updated to "1/5 COMPLETE" with a single track
   filled to 20% — one bar, correctly filled, matching `lesson-sidebar.tsx`'s reference pattern.
3. Navigated back to `/dashboard` and confirmed the `EnrolledCourseCard`'s progress bar (the
   actual A1 site named in the QA report) now shows a single track filled to 20% ("1 of 5
   lessons"), zoomed in to confirm no second/stacked empty track is rendered behind or after it.
4. Reverted the test mutation: clicked "Completed" → "Mark complete" toggle back off on the same
   lesson, confirmed the "Lesson marked incomplete" toast and the sidebar/dashboard both returned
   to 0/5, leaving the real dev-database user's progress unchanged from before this verification.

I did not additionally check `/tracks/<slug>` (`TrackProgressCard`) with a fully-enrolled track —
the only account available was enrolled in a single standalone course, not every course in any
track — but the same file-level fix (redundant children removed, `<Progress value={...} />`
self-closing exactly like `lesson-sidebar.tsx`) was applied there identically, and the grep
verification in step 7 confirms no `ProgressTrack`/`ProgressIndicator` import remains in that file
either.

## Deviations from the plan

None. Every file matched the plan's "old" snippets exactly before editing, and every edit was
applied as specified.

## Concerns

- None outstanding for this workstream. The dashboard page edit was kept to the single
  `coursesFinished` line specified, so it should not conflict with another workstream's later
  layout edit to the same file.
- `docs/qa/plans/ws1-progress.md` remains untracked in git (consistent with how workstream 4's
  plan file was also left untracked in its commit) — not included in this commit.

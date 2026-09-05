# Frontend QA — Sodales Academy

Date: 2026-09-05
Branch: `main` at `10980ba`
Method: browser pass across every public and authenticated surface at 1440px and ~400px, signed out and signed in as admin, plus three source audits (accessibility, states/edge cases, consistency/copy).

## Verdict

No route is broken and the console is clean. Every issue below is a defect in something that *renders* — not a missing feature.

Three are visible to a user today: a progress bar that draws itself twice and never fills, admin forms that invite a double submit, and a delete dialog that closes before it knows whether the delete worked.

## Checked and clean

- All 10 routes respond correctly; `/dashboard` and `/admin` redirect when signed out, unknown lessons 404.
- No console errors or warnings on any surface.
- No horizontal overflow at ~400px on the track detail page.
- Lesson player renders correctly with real content, sidebar, and track breadcrumb.
- Divide-by-zero and >100% are guarded in all progress maths.
- Singular/plural handled everywhere counted text appears.
- Heading order: one `h1` per page, no skipped levels, on every page checked.
- No off-system Tailwind colours remain; Inter-only; wordmark only via `BrandWordmark`.
- Contrast passes throughout. Closest margin is ivory/50 footer eyebrow on Obsidian at ≈4.9:1.
- Empty states exist and are intentional on `/courses`, `/dashboard`, `/admin/courses`, `/admin/tracks`, and both forms.

---

## A. Visible defects

### A1 — `Progress` renders two tracks and never fills · Critical
`src/components/ui/progress.tsx:20-22` renders its own `<ProgressTrack><ProgressIndicator/></ProgressTrack>` *after* `{children}`. Callers that also pass a track as children therefore get two.

Confirmed in the browser: two stacked `h-1.5 bg-muted` bars, 307px wide, no filled indicator.

- `src/components/course/enrolled-course-card.tsx:35-39` — passes redundant children
- `src/components/track/track-progress-card.tsx:16-20` — passes redundant children
- `src/components/lesson/lesson-sidebar.tsx:96` — calls it correctly with no children, and renders a single correct bar

This is on the learner's dashboard, the screen they see most.

### A2 — Admin create forms have no pending state · Critical
`src/components/admin/course-form.tsx:74-104` and `src/components/admin/track-form.tsx:91-121` await the Server Action, but the submit button is never disabled and never changes label. A second click on a slow network fires a second `createCourse`/`createTrack`. The slug-uniqueness guard only catches an identical slug, so a race can still land two rows.

`EnrollButton` already has the correct `useTransition` pattern to copy.

### A3 — Delete dialog closes before the result is known · Important
`src/components/admin/course-row-actions.tsx:93-95` and `track-row-actions.tsx:91-93` put the async delete handler on a `DialogClose`. Base UI closes the dialog synchronously; it does not await the handler. On failure the dialog vanishes, then an error toast appears while the undeleted row is still in the table behind it.

That is "report success, then contradict it" — the exact failure `CLAUDE.md`'s never-fake-success rule exists to prevent.

---

## B. Duplicated logic that can drift

### B1 — Course-progress maths copy-pasted three times · Important
`src/lib/track-progress.ts` deliberately centralises track maths with a comment warning against inline copies. The course-level equivalent is not centralised:

- `src/components/course/enrolled-course-card.tsx:14-20`
- `src/components/lesson/lesson-sidebar.tsx:76-79`
- `src/app/(site)/dashboard/page.tsx:40-47`

All three reimplement `Math.round((done/total)*100)` and the "finished" predicate. Three copies of a percentage shown to a paying learner is three chances to disagree.

### B2 — Site nav links duplicated · Important
`src/components/layout/main-nav.tsx:10-15` and `mobile-nav.tsx:23-28` hardcode the same array. Adding a link to one and not the other silently desyncs desktop and mobile. The admin nav already solves this correctly — `admin-mobile-nav.tsx` reuses `<AdminNav>`.

---

## C. Accessibility

### C1 — Module/lesson validation errors not announced · Important
`src/components/admin/modules-editor.tsx` sets `aria-invalid` on four fields (112, 182, 199, 228) but their error paragraphs (145, 185, 202, 231) have no `id` and no `aria-describedby`. A screen reader hears "invalid" with no reason. Trivially reachable: a fresh module fails `courseInputSchema` immediately. `course-form.tsx:118-125` already does this correctly.

### C2 — Invite-code error not announced · Important
`src/components/auth/invite-code-form.tsx:44-53` hardcodes `aria-describedby="invite-code-help"` and never references the error. This is the gate a paying customer hits first.

### C3 — Five controls miss the focus-ring convention · Important
The repo's convention is `outline-none focus-visible:ring-2 focus-visible:ring-violet`. Missing on:
- `src/components/layout/mobile-nav.tsx:50-57` — every mobile nav link
- `src/app/(site)/learn/[courseSlug]/[lessonSlug]/page.tsx:34-40` — the only way back from a lesson
- `src/app/(auth)/login/page.tsx:19-21` and `sign-up/page.tsx:19-21`
- `src/app/admin/layout.tsx:37-39` — mobile wordmark link
- `src/components/course/catalog-filters.tsx:53-67` — level filter pills

Nothing strips `outline`, so focus is not invisible — it is inconsistent and weaker than everything around it.

### C4 — Signed-in identity hidden from assistive tech · Minor
`src/components/layout/site-header.tsx:25-30` marks the initials badge `aria-hidden`, and it is the only on-screen indicator of who is signed in.

### C5 — Dead footer links announced as functional · Minor
`src/components/layout/site-footer.tsx:22-29` — sibling-product links are `href="#"` with a `title` explaining they are not live. That title is invisible on touch and to most users; the links still announce and activate.

---

## D. Loading skeletons that don't match their page

### D1 — Admin sub-routes inherit the wrong skeleton · Important
Only `src/app/admin/loading.tsx` exists, and it is a four-stat-card skeleton matching `/admin` only. `/admin/courses`, `/admin/tracks`, and all four form routes inherit it, so every navigation jolts from "four boxes in a row" into a table or a long form.

### D2 — Home page has no skeleton of its own · Important
`src/app/(site)/page.tsx` has no `loading.tsx`. `SiteHeader` is an async Server Component, so `/` suspends to the generic root skeleton, which looks nothing like the hero + stat strip + track list.

### D3 — `/tracks` skeleton contradicts the page · Minor
`src/app/(site)/tracks/loading.tsx:9-12` renders a two-column grid; the page renders a vertical stack of full-width rows.

### D4 — Course detail skeleton omits the hero banner · Minor
`courses/[slug]/loading.tsx` starts at the text, so the artwork banner pops in after load.

---

## E. Consistency and layout

### E1 — Admin course form pages break the admin page shell · Important
`src/app/admin/courses/new/page.tsx:12` and `courses/[id]/edit/page.tsx:65-73` omit the `p-6 lg:p-10` wrapper every other admin page uses, and `CourseForm`'s `<form>` has no `max-w-*` while `TrackForm` caps at `max-w-2xl`. The `<h1>` also lives inside `CourseForm` but inside the *page* for tracks — two conventions for parallel screens.

### E2 — Course row badge casing · Minor
`src/components/course/course-row.tsx` renders a title-case `Intermediate` badge beside an uppercase `BRANDING` eyebrow. The same clash was fixed on the track page; the catalog still has it.

### E3 — Dashboard renders one card in a three-column grid · Minor
Same "one card in an ocean" the `/tracks` index had before this week's pass.

### E4 — Admin tracks empty state has no icon · Minor
`admin/courses/page.tsx:30-38` uses an icon; `admin/tracks/page.tsx:29-34` does not.

### E5 — `/tracks` empty state is a bare paragraph · Minor
Next to `/courses`'s icon + heading + body + CTA, it reads unfinished.

### E6 — A course with no modules renders a silent gap · Minor
`src/components/course/course-outline.tsx:12-46` maps modules with no empty branch.

### E7 — `GoogleButton` has no pending state · Minor
`src/components/auth/google-button.tsx:35-44` — a double click fires the OAuth kickoff twice.

---

## Workstreams

Grouped so each can be planned and implemented independently.

| # | Workstream | Issues |
| --- | --- | --- |
| 1 | Progress rendering and shared course-progress helper | A1, B1 |
| 2 | Form submission safety | A2, A3, E7 |
| 3 | Accessibility | C1–C5 |
| 4 | Loading skeletons | D1–D4 |
| 5 | Consistency and layout | B2, E1–E6 |

## Out of scope

- Per-route `error.tsx`. One root boundary is a reasonable choice, not a gap.
- Admin table truncation. Long titles force horizontal scroll inside an `overflow-x-auto` container; nothing breaks.
- `test-fixture-course`, a stale row left in the production database by a test suite. Real data, not a UI defect — delete it directly.

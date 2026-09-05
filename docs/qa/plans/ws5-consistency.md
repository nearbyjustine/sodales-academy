# Workstream 5 — Consistency and layout (B2, E1–E6)

Source: `docs/qa/2026-09-05-frontend-qa.md` §B2 (lines 64–65) and §E (lines 111–129).

All defects were confirmed present by reading the exact files/lines named in the QA doc before
writing this plan. None were already fixed. One additional instance of E2's defect was found and
folded into Step 3 below (`src/app/(site)/courses/[slug]/page.tsx:74-77` — same clash, same fix,
same file family as `course-row.tsx`).

**Implementation order warning:** this plan is scheduled to land LAST, after WS1 (progress
rendering), WS2 (form submission safety), and WS3 (accessibility). Three files this plan edits are
also edited by those workstreams:
- `src/app/(site)/dashboard/page.tsx` — WS1 (A1/B1: fixes the doubled progress bar and centralises
  course-progress math on this page).
- `src/components/admin/course-form.tsx` — WS2 (A2: adds a pending/disabled-submit state).
- `src/components/layout/mobile-nav.tsx` — WS3 (C3: adds `focus-visible` ring classes to the link
  `className`).

**Do not trust this plan's line numbers or "Old" code blocks for those three files.** Re-read each
one fresh immediately before editing it, and re-derive the exact old/new snippet from what's
actually on disk at that point — WS1/WS2/WS3 will have already changed the surrounding lines by
the time this plan is implemented. The other nine files this plan touches (including the new
`site-nav-links.ts`) are not edited by any other workstream and should be unaffected.

Constraints carried through every step below:
- No new colours, fonts, or primitives. Icons come from `lucide-react` (already a dependency).
  `<ButtonLink>` for navigation, `<Button>` for actions. `label-eyebrow` is the uppercase
  micro-label class.
- Copy rule: no empty state may claim outcomes, testimonials, or statistics.

---

## Step 1 — B2: stop `main-nav.tsx`/`mobile-nav.tsx` hardcoding the same links array

**Decision: extract a shared constant/helper, not a full restructure like `AdminNav`.**
`AdminNav`'s two consumers (`admin/layout.tsx`'s sidebar and `AdminMobileNav`'s sheet) render the
*same* vertical link list with identical markup — only the wrapping container differs (`<aside>` vs
`<Sheet>`), so one shared component with an optional `onNavigate` prop is the correct fix there.
`MainNav` and `MobileNav` are not that case: `MainNav` renders a horizontal pill nav with
`aria-current`/active-violet-text/focus-ring styling (`main-nav.tsx:26-29`), while `MobileNav`
renders a plain vertical list with no active-state styling and closes the sheet on click. Forcing
both through one component would mean threading an orientation flag and conditionally suppressing
half the props — more indirection than the two-line array this is actually fixing. Extracting only
the data into one shared, typed constant removes the drift risk (the actual defect) without
inventing a false requirement that the two navs look alike, and it costs nothing to `MobileNav`'s
existing close-on-click handler, which stays exactly as-is.

### 1a. New file — `src/components/layout/site-nav-links.ts`

```ts
export type SiteNavLink = { href: string; label: string };

/**
 * Canonical site nav destinations, shared by `MainNav` (desktop) and `MobileNav`
 * (mobile sheet) so the two can never drift — see
 * docs/qa/2026-09-05-frontend-qa.md B2. Each caller still owns its own markup
 * (active-state styling on desktop, close-on-click in the mobile sheet); only
 * the link data is shared.
 */
export function getSiteNavLinks(showAdmin: boolean): SiteNavLink[] {
  return [
    { href: "/tracks", label: "Tracks" },
    { href: "/courses", label: "Courses" },
    { href: "/dashboard", label: "Dashboard" },
    ...(showAdmin ? [{ href: "/admin", label: "Admin" }] : []),
  ];
}
```

### 1b. Edit `src/components/layout/main-nav.tsx`

Old (lines 1–15):
```tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export function MainNav({ showAdmin }: { showAdmin: boolean }) {
  const pathname = usePathname();

  const links = [
    { href: "/tracks", label: "Tracks" },
    { href: "/courses", label: "Courses" },
    { href: "/dashboard", label: "Dashboard" },
    ...(showAdmin ? [{ href: "/admin", label: "Admin" }] : []),
  ];
```
New:
```tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { getSiteNavLinks } from "@/components/layout/site-nav-links";
import { cn } from "@/lib/utils";

export function MainNav({ showAdmin }: { showAdmin: boolean }) {
  const pathname = usePathname();

  const links = getSiteNavLinks(showAdmin);
```

### 1c. Edit `src/components/layout/mobile-nav.tsx`

Old (lines 1–28):
```tsx
"use client";

import { useState } from "react";
import Link from "next/link";
import { MenuIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

export function MobileNav({ showAdmin }: { showAdmin: boolean }) {
  // Controlled so the nav entries can stay plain <Link>s. Wrapping them in
  // SheetClose instead makes Base UI treat each one as a button — it warns, and
  // the documented `nativeButton={false}` escape hatch puts role="button" on the
  // anchor, which overrides the link role for screen readers. Closing the sheet
  // in onClick costs one state hook and keeps the links links.
  const [open, setOpen] = useState(false);

  const links = [
    { href: "/tracks", label: "Tracks" },
    { href: "/courses", label: "Courses" },
    { href: "/dashboard", label: "Dashboard" },
    ...(showAdmin ? [{ href: "/admin", label: "Admin" }] : []),
  ];
```
New:
```tsx
"use client";

import { useState } from "react";
import Link from "next/link";
import { MenuIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { getSiteNavLinks } from "@/components/layout/site-nav-links";

export function MobileNav({ showAdmin }: { showAdmin: boolean }) {
  // Controlled so the nav entries can stay plain <Link>s. Wrapping them in
  // SheetClose instead makes Base UI treat each one as a button — it warns, and
  // the documented `nativeButton={false}` escape hatch puts role="button" on the
  // anchor, which overrides the link role for screen readers. Closing the sheet
  // in onClick costs one state hook and keeps the links links.
  const [open, setOpen] = useState(false);

  const links = getSiteNavLinks(showAdmin);
```

The rest of both files (the `.map(...)` render bodies, including `MobileNav`'s
`onClick={() => setOpen(false)}`) is unchanged.

**Note on overlap with Workstream 3:** WS3's plan (`docs/qa/plans/ws3-accessibility.md`, C3) also
edits `mobile-nav.tsx` to add `focus-visible` classes to the link's `className` (a different line —
inside the `.map()` body, untouched here). The two edits don't overlap and can land in either order.

---

## Step 2 — E1: unify the admin course-form page shell

**Decision: header ownership belongs to the page, matching the track pages' already-correct
convention** (`admin/tracks/new/page.tsx`, `admin/tracks/[id]/edit/page.tsx`), not the course
pages' current convention of owning the `<h1>` inside `CourseForm`. Pages already own the
`p-6 lg:p-10` shell on every other admin route (`admin/courses/page.tsx`,
`admin/tracks/page.tsx`, both track form pages); forms should own only their fields, matching
`TrackForm`, which takes no `heading` prop at all. This also fixes the missing `p-6 lg:p-10`
wrapper and the missing `max-w-2xl` cap in the same move, since all three symptoms trace back to
the same page/form ownership split.

### 2a. Edit `src/components/admin/course-form.tsx`

Old (lines 46–58):
```tsx
export function CourseForm({
  initial,
  heading,
  courseId,
  viewerRole,
  instructors,
}: {
  initial?: CourseInput;
  heading: string;
  courseId?: string;
  viewerRole: Role;
  instructors: { userId: string; name: string }[];
}) {
```
New:
```tsx
export function CourseForm({
  initial,
  courseId,
  viewerRole,
  instructors,
}: {
  initial?: CourseInput;
  courseId?: string;
  viewerRole: Role;
  instructors: { userId: string; name: string }[];
}) {
```

Old (lines 106–110):
```tsx
  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      <h1 className="text-3xl font-bold tracking-tight">{heading}</h1>

      <div className="grid gap-4 sm:grid-cols-2">
```
New:
```tsx
  return (
    <form onSubmit={handleSubmit} className="flex max-w-2xl flex-col gap-6">
      <div className="grid gap-4 sm:grid-cols-2">
```

### 2b. Edit `src/app/admin/courses/new/page.tsx`

Old (lines 8–13):
```tsx
export default async function NewCoursePage() {
  const session = await requireRole("instructor", "admin");
  const instructors = session.role === "admin" ? await listInstructors() : [];

  return <CourseForm heading="New course" viewerRole={session.role} instructors={instructors} />;
}
```
New:
```tsx
export default async function NewCoursePage() {
  const session = await requireRole("instructor", "admin");
  const instructors = session.role === "admin" ? await listInstructors() : [];

  return (
    <div className="p-6 lg:p-10">
      <h1 className="text-3xl font-bold tracking-tight">New course</h1>
      <div className="mt-8">
        <CourseForm viewerRole={session.role} instructors={instructors} />
      </div>
    </div>
  );
}
```

### 2c. Edit `src/app/admin/courses/[id]/edit/page.tsx`

Old (lines 65–74):
```tsx
  return (
    <CourseForm
      heading={`Edit ${course.title}`}
      initial={toCourseInput(course)}
      courseId={course.id}
      viewerRole={session.role}
      instructors={instructors}
    />
  );
}
```
New:
```tsx
  return (
    <div className="p-6 lg:p-10">
      <h1 className="text-3xl font-bold tracking-tight">Edit {course.title}</h1>
      <div className="mt-8">
        <CourseForm
          initial={toCourseInput(course)}
          courseId={course.id}
          viewerRole={session.role}
          instructors={instructors}
        />
      </div>
    </div>
  );
}
```

**Verified full caller list.** `grep -rn "CourseForm" src` returns exactly three lines: the
definition (`src/components/admin/course-form.tsx:46`) and two call sites —
`src/app/admin/courses/new/page.tsx:12` and `src/app/admin/courses/[id]/edit/page.tsx:66-73`. Both
are updated in 2b/2c above. No other file imports or renders `<CourseForm>`, so removing the
`heading` prop cannot break a build outside these two files.

---

## Step 3 — E2: fix the badge-casing clash (`course-row.tsx` and `courses/[slug]/page.tsx`)

Match `track-map.tsx`'s resolution exactly: it dropped the `Badge`/`capitalize` combination for
`course.level` and instead renders it as a second `<span>` inside the same `label-eyebrow`
container as the other eyebrow text, so both pick up the class's own `text-transform: uppercase`
(`src/app/globals.css:74-79`) instead of fighting it (see the comment at `track-map.tsx:225-228`).

The identical clash also exists on the course detail page (`courses/[slug]/page.tsx:74-77`) —
same `Badge variant="outline" className="capitalize"` next to the same `label-eyebrow` category
span. Same defect, same file family as `course-row.tsx`, so it gets the same fix here rather than
being left for a separate pass.

### 3a. Edit `src/components/course/course-row.tsx`

Old (lines 1–21):
```tsx
import Link from "next/link";
import { CourseArtwork } from "@/components/brand/course-artwork";
import { Badge } from "@/components/ui/badge";
import type { CourseSummary } from "@/lib/content/types";

export function CourseRow({ course }: { course: CourseSummary }) {
  return (
    <Link
      href={`/courses/${course.slug}`}
      className="group/row flex flex-col gap-4 overflow-hidden rounded-md border border-border outline-none transition-colors hover:border-violet focus-visible:ring-2 focus-visible:ring-violet sm:flex-row sm:items-stretch sm:gap-5"
    >
      <div className="h-28 w-full shrink-0 sm:h-auto sm:w-36">
        <CourseArtwork seed={course.slug} lessonCount={course.lessonCount} />
      </div>

      <div className="flex flex-col gap-2 p-5 sm:pl-0">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline" className="capitalize">
            {course.level}
          </Badge>
          <span className="label-eyebrow text-graphite">{course.category}</span>
        </div>
```
New:
```tsx
import Link from "next/link";
import { CourseArtwork } from "@/components/brand/course-artwork";
import type { CourseSummary } from "@/lib/content/types";

export function CourseRow({ course }: { course: CourseSummary }) {
  return (
    <Link
      href={`/courses/${course.slug}`}
      className="group/row flex flex-col gap-4 overflow-hidden rounded-md border border-border outline-none transition-colors hover:border-violet focus-visible:ring-2 focus-visible:ring-violet sm:flex-row sm:items-stretch sm:gap-5"
    >
      <div className="h-28 w-full shrink-0 sm:h-auto sm:w-36">
        <CourseArtwork seed={course.slug} lessonCount={course.lessonCount} />
      </div>

      <div className="flex flex-col gap-2 p-5 sm:pl-0">
        <p className="label-eyebrow flex flex-wrap gap-3 text-graphite">
          <span>{course.level}</span>
          <span>{course.category}</span>
        </p>
```

The `Badge` import is dropped since this was its only use in the file (confirmed via
`grep -n "Badge" src/components/course/course-row.tsx`). Everything below (the `<h3>`, description,
lesson-count/instructor line) is unchanged.

### 3b. Edit `src/app/(site)/courses/[slug]/page.tsx`

Old (lines 1–10, 73–78):
```tsx
import type { Metadata } from "next";
import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { CourseArtwork } from "@/components/brand/course-artwork";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button-link";
import { CourseOutline } from "@/components/course/course-outline";
import { EnrollButton } from "@/components/course/enroll-button";
import { TrackBreadcrumb } from "@/components/track/track-breadcrumb";
import { getCompletedLessonIds, getCourseBySlug, getTracksForCourse, isEnrolled } from "@/lib/content/queries";
```
```tsx
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="outline" className="capitalize">
          {course.level}
        </Badge>
        <span className="label-eyebrow text-graphite">{course.category}</span>
      </div>
```
New:
```tsx
import type { Metadata } from "next";
import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { CourseArtwork } from "@/components/brand/course-artwork";
import { ButtonLink } from "@/components/ui/button-link";
import { CourseOutline } from "@/components/course/course-outline";
import { EnrollButton } from "@/components/course/enroll-button";
import { TrackBreadcrumb } from "@/components/track/track-breadcrumb";
import { getCompletedLessonIds, getCourseBySlug, getTracksForCourse, isEnrolled } from "@/lib/content/queries";
```
```tsx
      <p className="label-eyebrow flex flex-wrap gap-3 text-graphite">
        <span>{course.level}</span>
        <span>{course.category}</span>
      </p>
```

The `Badge` import is dropped since this was its only use in the file (confirmed via
`grep -n "Badge" "src/app/(site)/courses/[slug]/page.tsx"`). Everything else on the page
(artwork banner, breadcrumb, `<h1>`, description, CTA, `<CourseOutline>`) is unchanged.

---

## Step 4 — E3: fix the dashboard's one-card-in-three-columns grid

**Decision: not the same treatment as `/tracks`.** `/tracks` abandoned its grid entirely for
`TrackRow`'s full-width horizontal banners, because a track is a wide, image-backed hero-style
row, not a bounded card — a grid was never the right shape for it. `EnrolledCourseCard` (and its
sibling `TrackProgressCard`) are genuinely card-shaped (fixed border, portrait artwork strip,
bounded content) and belong in a wrapping grid at higher counts, so switching to full-width rows
here would make well-shaped small cards stretch edge-to-edge for no reason. The actual defect is
that `sm:grid-cols-2 lg:grid-cols-3` forces fixed-width columns regardless of how many cards exist,
so one card gets stretched into a column as wide as a third of a 6xl container. The fix is the
standard CSS Grid technique for this: `repeat(auto-fill, minmax(280px, 1fr))`, which wraps as many
280px-minimum columns as fit the container and reserves (but does not render) any columns beyond
the card count, so a lone card keeps a normal card width instead of stretching to fill unused
column budget, while still growing gracefully as more courses are enrolled.

Edit `src/app/(site)/dashboard/page.tsx`.

Old (line 78):
```tsx
          <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
```
New:
```tsx
          <div className="mt-10 grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-6">
```

(Bracket-notation `grid-cols-[...]` is an existing pattern in this codebase — see
`src/app/admin/layout.tsx:14` and `src/app/(site)/learn/[courseSlug]/[lessonSlug]/page.tsx:50` —
so this introduces no new convention.)

---

## Step 5 — E4: add an icon to the admin tracks empty state

Match `admin/courses/page.tsx:30-38`'s icon exactly (`FolderOpenIcon`, `size-10 text-graphite`,
`aria-hidden="true"`) — both are the same kind of state (an admin has created zero rows of admin-
owned content), so the same icon is the correct match, not a track-specific one.

Edit `src/app/admin/tracks/page.tsx`.

Old (lines 1–2, 29–34):
```tsx
import type { Metadata } from "next";
import { ButtonLink } from "@/components/ui/button-link";
```
```tsx
      {tracks.length === 0 ? (
        <div className="flex flex-col items-center gap-4 py-24 text-center">
          <h2 className="text-xl font-bold">No tracks yet</h2>
          <p className="max-w-sm text-graphite">A track is an ordered path through courses.</p>
          <ButtonLink href="/admin/tracks/new">New track</ButtonLink>
        </div>
      ) : (
```
New:
```tsx
import type { Metadata } from "next";
import { FolderOpenIcon } from "lucide-react";
import { ButtonLink } from "@/components/ui/button-link";
```
```tsx
      {tracks.length === 0 ? (
        <div className="flex flex-col items-center gap-4 py-24 text-center">
          <FolderOpenIcon aria-hidden="true" className="size-10 text-graphite" />
          <h2 className="text-xl font-bold">No tracks yet</h2>
          <p className="max-w-sm text-graphite">A track is an ordered path through courses.</p>
          <ButtonLink href="/admin/tracks/new">New track</ButtonLink>
        </div>
      ) : (
```

---

## Step 6 — E5: flesh out the public `/tracks` empty state

Match `/courses`'s icon + heading + body + CTA structure (`src/app/(site)/courses/page.tsx:35-45`).
Unlike `/courses`, `/tracks` has no filters to clear (no `CatalogFilters` equivalent), so "no
tracks published" is a true empty catalog, not a "no results for this filter" state — the CTA
should point at `/courses`, the one part of the catalog that's never empty when tracks are, rather
than a nonexistent "clear filters" action. The icon is `RouteIcon` (present in the installed
`lucide-react`, confirmed via `node -e "console.log(typeof require('lucide-react').RouteIcon)"` →
`"object"`), matching the "ordered path" concept a track is, the same way `/courses` uses
`SearchXIcon` for its own no-results concept. Copy stays factual — no claims about outcomes or
completions, consistent with the copy rule.

Edit `src/app/(site)/tracks/page.tsx`.

Old (full file):
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
        <div className="mt-10 flex flex-col gap-6">
          {tracks.map((track) => (
            <TrackRow key={track.slug} track={track} />
          ))}
        </div>
      )}
    </div>
  );
}
```
New (full file):
```tsx
import type { Metadata } from "next";
import { RouteIcon } from "lucide-react";
import { TrackRow } from "@/components/track/track-row";
import { ButtonLink } from "@/components/ui/button-link";
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
        <div className="flex flex-col items-center gap-4 py-24 text-center">
          <RouteIcon aria-hidden="true" className="size-10 text-graphite" />
          <h2 className="text-xl font-bold">No tracks are published yet</h2>
          <p className="max-w-sm text-graphite">
            Individual courses are still open — browse the catalog to get started.
          </p>
          <ButtonLink href="/courses">Browse courses</ButtonLink>
        </div>
      ) : (
        <div className="mt-10 flex flex-col gap-6">
          {tracks.map((track) => (
            <TrackRow key={track.slug} track={track} />
          ))}
        </div>
      )}
    </div>
  );
}
```

---

## Step 7 — E6: give `course-outline.tsx` an empty branch

Edit `src/components/course/course-outline.tsx`. This is a section inside an already-populated
course detail page (artwork, title, description, CTA all render above it), not a standalone route,
so a full icon+heading+CTA treatment would be disproportionate — a plain in-register line matches
the scale of similar inline empty notes elsewhere (e.g. `track-form.tsx`'s "No courses selected
yet." at line 234).

Old (lines 1–14):
```tsx
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import type { CourseModule } from "@/lib/content/types";

export function CourseOutline({
  modules,
  courseSlug,
}: {
  modules: CourseModule[];
  courseSlug: string;
}) {
  return (
    <div className="flex flex-col gap-10">
      {modules.map((module, index) => (
```
New:
```tsx
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import type { CourseModule } from "@/lib/content/types";

export function CourseOutline({
  modules,
  courseSlug,
}: {
  modules: CourseModule[];
  courseSlug: string;
}) {
  if (modules.length === 0) {
    return <p className="text-graphite">No modules yet.</p>;
  }

  return (
    <div className="flex flex-col gap-10">
      {modules.map((module, index) => (
```

The rest of the file (the `.map()` body, closing tags) is unchanged.

---

## Step 8 — Verification

Run in order; stop and fix before proceeding if any command fails.

```bash
pnpm typecheck
```
Expected: exits 0. `CourseForm`'s `heading` prop removal is the only signature change — both call
sites were updated in Step 2, and `grep -rn "CourseForm" src` (rerun after editing) should show no
remaining `heading=` usage.

```bash
pnpm lint
```
Expected: exits 0 modulo the two pre-existing known warnings noted in the QA doc's baseline — no
new warnings in `site-nav-links.ts`, `main-nav.tsx`, `mobile-nav.tsx`, `course-form.tsx`,
`admin/courses/new/page.tsx`, `admin/courses/[id]/edit/page.tsx`, `course-row.tsx`,
`courses/[slug]/page.tsx`, `dashboard/page.tsx`, `admin/tracks/page.tsx`, `tracks/page.tsx`, or
`course-outline.tsx`.

```bash
pnpm test
```
Expected: exits 0. `grep -rln "course-form\|main-nav\|mobile-nav\|course-outline\|course-row" src --include="*.test.ts*"`
turns up nothing today, so the bar is the full suite passing with no new failures, not new
coverage — this workstream is layout/consistency only.

```bash
pnpm build
```
Expected: exits 0, production build succeeds.

### Manual spot-check (`pnpm dev`)

- `/` header at ~1440px and ~400px: nav links identical on both, mobile sheet still closes on link
  click.
- `/admin/courses/new` and `/admin/courses/[id]/edit`: both now have the `p-6 lg:p-10` sidebar gap
  and a form capped at `max-w-2xl`, matching `/admin/tracks/new`'s look exactly.
- `/courses` and any individual `/courses/[slug]`: level badge and category eyebrow are both
  uppercase, no casing clash, on both the catalog row and the detail page.
- `/dashboard` signed in with exactly one enrolled course: the card no longer stretches to a third
  of the page width.
- `/admin/tracks` with zero tracks: icon now present, matching `/admin/courses`.
- `/tracks` with zero published tracks: icon + heading + body + "Browse courses" CTA now present.
- A course with zero modules (create one via `/admin/courses/new` with modules removed, if the
  form allows saving zero — otherwise verify via a temporary DB row): outline area shows "No
  modules yet." instead of a blank gap.

---

## Files touched (summary)

- `src/components/layout/site-nav-links.ts` (new file, B2)
- `src/components/layout/main-nav.tsx` (B2)
- `src/components/layout/mobile-nav.tsx` (B2)
- `src/components/admin/course-form.tsx` (E1)
- `src/app/admin/courses/new/page.tsx` (E1)
- `src/app/admin/courses/[id]/edit/page.tsx` (E1)
- `src/components/course/course-row.tsx` (E2)
- `src/app/(site)/courses/[slug]/page.tsx` (E2)
- `src/app/(site)/dashboard/page.tsx` (E3)
- `src/app/admin/tracks/page.tsx` (E4)
- `src/app/(site)/tracks/page.tsx` (E5)
- `src/components/course/course-outline.tsx` (E6)

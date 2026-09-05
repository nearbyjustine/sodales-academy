# Workstream 4 — Loading skeletons (D1–D4)

Source: `docs/qa/2026-09-05-frontend-qa.md` §D (lines 95–108).

## Method and findings

Every skeleton below was written by first reading the page file it stands in for (cited per
step) and matching container width, padding, and the order/approximate height of its blocks —
not by describing the page from memory. House pattern, confirmed by reading
`src/app/admin/loading.tsx` and `src/app/(site)/courses/loading.tsx`: a root element with
`aria-busy="true"`, a `<span className="sr-only">Loading</span>`, and `<Skeleton>` from
`@/components/ui/skeleton` for every placeholder block. No new components are introduced — this
workstream only adds/edits `loading.tsx` files, so duplication between the two course-form
skeletons and the two track-form skeletons (see Step 1 decision) is intentional, not an oversight.

One out-of-scope finding surfaced while reading pages, noted here so it isn't mistaken for a
skeleton bug: `src/app/admin/courses/new/page.tsx` and `src/app/admin/courses/[id]/edit/page.tsx`
render `<CourseForm .../>` with no wrapping `<div className="p-6 lg:p-10">` (unlike every other
admin page, including the two track-form routes, which do wrap in that padding). `CourseForm`'s
own root is `<form className="flex flex-col gap-6">` — no padding. This looks like a real layout
inconsistency, but it is a page-component issue, not a skeleton issue, and this workstream may not
touch page components — the two course-form skeletons below deliberately reproduce the flush
(no-padding) layout so they don't contradict what actually renders.

## Segment-placement decision (D1)

`/admin` has six children with three distinct shapes: two stat/table overview pages
(`/admin/courses`, `/admin/tracks`), and two form shapes used twice each (`CourseForm` powers
`/admin/courses/new` and `/admin/courses/[id]/edit`; `TrackForm` powers `/admin/tracks/new` and
`/admin/tracks/[id]/edit`). A single shared skeleton at `/admin` (the current bug) is wrong for
all six. A single skeleton per shape is impossible without a shared component (out of scope per
the constraints), because `/admin/courses` and `/admin/courses/new` are siblings under
`/admin/courses/` — Next 16 resolves the nearest ancestor `loading.tsx`, so leaving
`/admin/courses/` without its own file would make `/admin/courses/new` and
`/admin/courses/[id]/edit` inherit *its* table skeleton instead of `/admin`'s, trading one wrong
inherited skeleton for another.

Decision: **one `loading.tsx` per leaf segment, six files total**, each matching its own page
exactly. `src/app/admin/loading.tsx` is left unchanged — it already matches `/admin` itself (per
D1's own wording, "a four-stat-card skeleton matching `/admin` only"); the bug is purely that nothing
overrides it lower in the tree, which these six new files fix.

`/` (D2) is the mirror image: `src/app/(site)/page.tsx` is the only route directly inside the
`(site)` group with no segment folder of its own, and every sibling segment
(`courses/`, `courses/[slug]/`, `tracks/`, `tracks/[slug]/`, `dashboard/`, `learn/[courseSlug]/[lessonSlug]/`)
already has its own `loading.tsx` (confirmed with `find "src/app/(site)" -iname loading.tsx`).
So a single new `src/app/(site)/loading.tsx` is safe — every sibling already overrides it — and
is the correct (not six-near-identical-files) fix for D2.

---

## Step 1 — D1: `src/app/admin/courses/loading.tsx` (new)

Matched against `src/app/admin/courses/page.tsx`: `<div className="p-6 lg:p-10">` wrapper, a
`flex items-center justify-between` header row (`h1` + "New course" `ButtonLink`), then
(non-empty case) `<div className="mt-8 rounded-md border border-border"><Table>...` with columns
Title/Status/Level/Category/Lessons/Actions.

```tsx
import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div aria-busy="true" className="p-6 lg:p-10">
      <span className="sr-only">Loading</span>
      <div className="flex items-center justify-between gap-4">
        <Skeleton className="h-9 w-32" />
        <Skeleton className="h-10 w-32" />
      </div>
      <div className="mt-8 rounded-md border border-border">
        <Skeleton className="h-10 w-full rounded-none" />
        <div className="flex flex-col divide-y divide-border">
          <Skeleton className="h-12 w-full rounded-none" />
          <Skeleton className="h-12 w-full rounded-none" />
          <Skeleton className="h-12 w-full rounded-none" />
          <Skeleton className="h-12 w-full rounded-none" />
          <Skeleton className="h-12 w-full rounded-none" />
        </div>
      </div>
    </div>
  );
}
```

## Step 2 — D1: `src/app/admin/tracks/loading.tsx` (new)

Matched against `src/app/admin/tracks/page.tsx`: same `p-6 lg:p-10` + header-row + bordered-table
shape as courses, narrower table (Title/Status/Courses/Actions) and "New track" label.

```tsx
import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div aria-busy="true" className="p-6 lg:p-10">
      <span className="sr-only">Loading</span>
      <div className="flex items-center justify-between gap-4">
        <Skeleton className="h-9 w-28" />
        <Skeleton className="h-10 w-32" />
      </div>
      <div className="mt-8 rounded-md border border-border">
        <Skeleton className="h-10 w-full rounded-none" />
        <div className="flex flex-col divide-y divide-border">
          <Skeleton className="h-12 w-full rounded-none" />
          <Skeleton className="h-12 w-full rounded-none" />
          <Skeleton className="h-12 w-full rounded-none" />
        </div>
      </div>
    </div>
  );
}
```

## Step 3 — D1: `src/app/admin/courses/new/loading.tsx` (new)

Matched against `src/app/admin/courses/new/page.tsx` (returns `<CourseForm .../>` with no
wrapper — see the flush-layout finding above) and `src/components/admin/course-form.tsx`'s
actual field order: `<form className="flex flex-col gap-6">` containing an `h1`, a
`grid sm:grid-cols-2` row (Title, Slug), a full-width Description textarea, a
`grid sm:grid-cols-2` row (Category, Level), an admin-only Instructor select, a "Modules" label
+ `ModulesEditor`, and a submit `Button`. Each Label+Input pair is modeled as a short label bar
over a full-width input bar, matching their real heights.

```tsx
import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div aria-busy="true" className="flex flex-col gap-6">
      <span className="sr-only">Loading</span>
      <Skeleton className="h-9 w-40" />

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Skeleton className="h-4 w-10" />
          <Skeleton className="mt-1.5 h-9 w-full" />
        </div>
        <div>
          <Skeleton className="h-4 w-8" />
          <Skeleton className="mt-1.5 h-9 w-full" />
        </div>
      </div>

      <div>
        <Skeleton className="h-4 w-24" />
        <Skeleton className="mt-1.5 h-24 w-full" />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Skeleton className="h-4 w-16" />
          <Skeleton className="mt-1.5 h-9 w-full" />
        </div>
        <div>
          <Skeleton className="h-4 w-10" />
          <Skeleton className="mt-1.5 h-9 w-full" />
        </div>
      </div>

      <div>
        <Skeleton className="h-4 w-20" />
        <Skeleton className="mt-1.5 h-9 w-full" />
      </div>

      <div>
        <Skeleton className="h-4 w-20" />
        <Skeleton className="mt-3 h-56 w-full" />
      </div>

      <Skeleton className="h-10 w-32 self-start" />
    </div>
  );
}
```

## Step 4 — D1: `src/app/admin/courses/[id]/edit/loading.tsx` (new)

Same shape as Step 3, matched against the same `course-form.tsx` (the edit page renders the
identical `CourseForm`, just pre-filled — a skeleton has no content to differ on). File content
is byte-identical to Step 3's.

```tsx
import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div aria-busy="true" className="flex flex-col gap-6">
      <span className="sr-only">Loading</span>
      <Skeleton className="h-9 w-40" />

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Skeleton className="h-4 w-10" />
          <Skeleton className="mt-1.5 h-9 w-full" />
        </div>
        <div>
          <Skeleton className="h-4 w-8" />
          <Skeleton className="mt-1.5 h-9 w-full" />
        </div>
      </div>

      <div>
        <Skeleton className="h-4 w-24" />
        <Skeleton className="mt-1.5 h-24 w-full" />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Skeleton className="h-4 w-16" />
          <Skeleton className="mt-1.5 h-9 w-full" />
        </div>
        <div>
          <Skeleton className="h-4 w-10" />
          <Skeleton className="mt-1.5 h-9 w-full" />
        </div>
      </div>

      <div>
        <Skeleton className="h-4 w-20" />
        <Skeleton className="mt-1.5 h-9 w-full" />
      </div>

      <div>
        <Skeleton className="h-4 w-20" />
        <Skeleton className="mt-3 h-56 w-full" />
      </div>

      <Skeleton className="h-10 w-32 self-start" />
    </div>
  );
}
```

## Step 5 — D1: `src/app/admin/tracks/new/loading.tsx` (new)

Matched against `src/app/admin/tracks/new/page.tsx`: `<div className="p-6 lg:p-10">` wrapper,
`h1`, `<div className="mt-8">` containing `TrackForm`. Matched against
`src/components/admin/track-form.tsx`: `<form className="flex max-w-2xl flex-col gap-6">` with
Title/Slug (`grid sm:grid-cols-2`), Promise (input + helper line), Outcome (textarea + helper
line), Position (number input + helper line), a "Courses, in order" `fieldset` (selected-course
list + an available-courses checkbox box), and a submit `Button`.

```tsx
import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div aria-busy="true" className="p-6 lg:p-10">
      <span className="sr-only">Loading</span>
      <Skeleton className="h-9 w-40" />

      <div className="mt-8 flex max-w-2xl flex-col gap-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Skeleton className="h-4 w-10" />
            <Skeleton className="mt-1.5 h-9 w-full" />
          </div>
          <div>
            <Skeleton className="h-4 w-8" />
            <Skeleton className="mt-1.5 h-9 w-full" />
          </div>
        </div>

        <div>
          <Skeleton className="h-4 w-16" />
          <Skeleton className="mt-1.5 h-9 w-full" />
          <Skeleton className="mt-1 h-3 w-2/3" />
        </div>

        <div>
          <Skeleton className="h-4 w-16" />
          <Skeleton className="mt-1.5 h-20 w-full" />
          <Skeleton className="mt-1 h-3 w-3/4" />
        </div>

        <div>
          <Skeleton className="h-4 w-16" />
          <Skeleton className="mt-1.5 h-9 w-full" />
          <Skeleton className="mt-1 h-3 w-1/2" />
        </div>

        <div className="flex flex-col gap-3">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-24 w-full" />
        </div>

        <Skeleton className="h-10 w-32 self-start" />
      </div>
    </div>
  );
}
```

## Step 6 — D1: `src/app/admin/tracks/[id]/edit/loading.tsx` (new)

Same shape as Step 5, matched against the same `track-form.tsx` (edit renders the identical
`TrackForm`, pre-filled). File content is byte-identical to Step 5's.

```tsx
import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div aria-busy="true" className="p-6 lg:p-10">
      <span className="sr-only">Loading</span>
      <Skeleton className="h-9 w-40" />

      <div className="mt-8 flex max-w-2xl flex-col gap-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Skeleton className="h-4 w-10" />
            <Skeleton className="mt-1.5 h-9 w-full" />
          </div>
          <div>
            <Skeleton className="h-4 w-8" />
            <Skeleton className="mt-1.5 h-9 w-full" />
          </div>
        </div>

        <div>
          <Skeleton className="h-4 w-16" />
          <Skeleton className="mt-1.5 h-9 w-full" />
          <Skeleton className="mt-1 h-3 w-2/3" />
        </div>

        <div>
          <Skeleton className="h-4 w-16" />
          <Skeleton className="mt-1.5 h-20 w-full" />
          <Skeleton className="mt-1 h-3 w-3/4" />
        </div>

        <div>
          <Skeleton className="h-4 w-16" />
          <Skeleton className="mt-1.5 h-9 w-full" />
          <Skeleton className="mt-1 h-3 w-1/2" />
        </div>

        <div className="flex flex-col gap-3">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-24 w-full" />
        </div>

        <Skeleton className="h-10 w-32 self-start" />
      </div>
    </div>
  );
}
```

## Step 7 — D2: `src/app/(site)/loading.tsx` (new)

Matched against `src/app/(site)/page.tsx`'s first three sections (the ones with fixed,
non-decorative structure — the later "rhythm"/"outcome"/"CTA" sections are conditional-copy
blocks, not data-shaped, so a skeleton for them would just be more grey bars without adding
signal, same trade-off the existing `courses/[slug]/loading.tsx` already makes by stopping after
the outline): the hero (`grid md:grid-cols-2` of a text column and a `min-h-64` artwork banner),
the `border-y` three-column stat strip, and the track list (`h2` + paragraph + a vertical stack
of full-width rows, per `src/components/track/track-row.tsx`'s `min-h-56` row). No outer wrapper
div carries padding — matching the real page, which returns a `<>...</>` fragment of
self-padded `<section>`s, not a padded container.

```tsx
import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div aria-busy="true">
      <span className="sr-only">Loading</span>

      <section className="mx-auto grid max-w-6xl gap-10 px-4 py-20 md:grid-cols-2 md:py-28">
        <div className="flex flex-col gap-6">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-28 w-full" />
          <Skeleton className="h-16 w-5/6" />
          <div className="flex flex-wrap gap-3 pt-2">
            <Skeleton className="h-10 w-48" />
            <Skeleton className="h-10 w-40" />
          </div>
        </div>
        <Skeleton className="min-h-64 w-full" />
      </section>

      <section className="border-y border-border">
        <div className="mx-auto grid max-w-6xl divide-y divide-border sm:grid-cols-3 sm:divide-x sm:divide-y-0">
          <div className="flex flex-col items-center gap-2 px-4 py-10">
            <Skeleton className="h-10 w-16" />
            <Skeleton className="h-4 w-20" />
          </div>
          <div className="flex flex-col items-center gap-2 px-4 py-10">
            <Skeleton className="h-10 w-16" />
            <Skeleton className="h-4 w-20" />
          </div>
          <div className="flex flex-col items-center gap-2 px-4 py-10">
            <Skeleton className="h-10 w-16" />
            <Skeleton className="h-4 w-20" />
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-20">
        <Skeleton className="h-9 w-56" />
        <Skeleton className="mt-3 h-5 w-96 max-w-full" />
        <div className="mt-10 flex flex-col gap-6">
          <Skeleton className="h-56 w-full" />
          <Skeleton className="h-56 w-full" />
        </div>
      </section>
    </div>
  );
}
```

## Step 8 — D3: edit `src/app/(site)/tracks/loading.tsx`

Matched against `src/app/(site)/tracks/page.tsx` (renders `tracks.map` as
`<div className="mt-10 flex flex-col gap-6">` of `TrackRow`s) and
`src/components/track/track-row.tsx` (`min-h-56` full-width row, `rounded-md border border-border`).
The current file renders a `md:grid-cols-2` two-column grid at lines 9–12, contradicting the
vertical stack the page actually renders. Replace the grid with a matching vertical stack.

Old:
```tsx
      <div className="mt-10 grid gap-6 md:grid-cols-2">
        <Skeleton className="h-72" />
        <Skeleton className="h-72" />
      </div>
```

New:
```tsx
      <div className="mt-10 flex flex-col gap-6">
        <Skeleton className="h-56 w-full" />
        <Skeleton className="h-56 w-full" />
      </div>
```

## Step 9 — D4: edit `src/app/(site)/courses/[slug]/loading.tsx`

Matched against `src/app/(site)/courses/[slug]/page.tsx`, which renders the artwork banner
first: `<div className="mb-10 h-40 overflow-hidden rounded-md md:h-56"><CourseArtwork .../></div>`,
*before* the level/category badges. The current skeleton starts at the badge line, so the banner
pops in after the rest of the content has already painted. Add a matching banner block as the
first placeholder, carrying the page's own `mb-10` spacing so the following badge line doesn't
need its own top margin added.

Old:
```tsx
    <div aria-busy="true" className="mx-auto max-w-6xl px-4 py-16">
      <span className="sr-only">Loading</span>
      <Skeleton className="h-5 w-24" />
```

New:
```tsx
    <div aria-busy="true" className="mx-auto max-w-6xl px-4 py-16">
      <span className="sr-only">Loading</span>
      <Skeleton className="mb-10 h-40 w-full md:h-56" />
      <Skeleton className="h-5 w-24" />
```

(Everything below this line in the file is unchanged.)

---

## Verification

1. `pnpm typecheck` — expect a clean exit with no new errors (these files have no logic, so this
   mainly guards against a typo in JSX/className strings breaking the `.tsx` parse).
2. `pnpm lint` — expect a clean exit; matches existing `loading.tsx` conventions (default export,
   `Skeleton` import from `@/components/ui/skeleton`) so no new lint rules should trigger.
3. `pnpm build` — expect a successful production build; this also statically verifies every new
   route segment (`/admin/courses`, `/admin/tracks`, `/admin/courses/new`,
   `/admin/courses/[id]/edit`, `/admin/tracks/new`, `/admin/tracks/[id]/edit`, `/`) compiles with
   its new/edited `loading.tsx` in place.
4. Manual check, once (1)–(3) pass: in Chrome DevTools, Network tab, set throttling to "Slow 4G"
   (or add an artificial delay), then for each of the 10 touched routes — `/`, `/tracks`,
   `/courses/<any-slug>`, `/admin`, `/admin/courses`, `/admin/tracks`, `/admin/courses/new`,
   `/admin/courses/[id]/edit` (open any existing course), `/admin/tracks/new`,
   `/admin/tracks/[id]/edit` (open any existing track) — navigate to it and confirm: the skeleton
   that appears resembles the page that replaces it in container width, padding, and block
   layout, and there is no visible jolt (layout shift) at the moment real content swaps in.

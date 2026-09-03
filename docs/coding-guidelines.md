# Coding guidelines — Sodales Academy (Phase 1)

These are the conventions for this repository specifically. `CLAUDE.md` covers the seam and the
rules most likely to be broken; this file covers everything else. The older
`docs/00-platform.md`–`docs/06-store.md` describe a six-app monorepo with Drizzle, `packages/ui`,
and `make` — none of that applies here. Where anything below conflicts with those docs, this
repo's actual structure wins.

## TypeScript

- Strict mode is on (`tsconfig.json`) — keep it on.
- No `any`. If a type is genuinely unknown, use `unknown` and narrow it.
- No non-null assertion (`!`) outside test files. In app code, handle the `null`/`undefined` case
  explicitly instead of asserting it away.

## Components

- **Server components by default.** Add `"use client"` only when a component genuinely needs a
  browser API (`localStorage`, `window`), event handlers, or React state/effects. Most of the app
  — anything that just fetches and renders — should stay a server component.
- One responsibility per file, with a soft 200-line ceiling. A component that's grown past that is
  usually hiding a second component (e.g. `lesson-sidebar.tsx` splits its desktop `<aside>` and
  mobile `Sheet` rendering into one shared `SidebarContent` rather than duplicating markup).
- `kebab-case` filenames (`course-row.tsx`, `enrolled-course-card.tsx`), `PascalCase` component
  names (`CourseRow`, `EnrolledCourseCard`).

## State that crosses the server/client boundary

If a client component reads state that can differ between the server-rendered HTML and the
client's real value (localStorage, anything seeded then possibly diverged), don't read it in a
`useEffect` and `setState`. That's an extra render, and this project's `react-hooks/set-state-in-
effect` lint rule rejects it outright. Use `useSyncExternalStore` instead — see
`useCompletedLessonIds`/`useLessonComplete` in `src/lib/progress.ts` for the pattern: a
`getServerSnapshot` that matches what the server rendered, a cached `getClientSnapshot`, and a
`subscribe` that fires on both a same-tab custom event and the native `storage` event. This also
gets you free reactivity across sibling components (toggle a lesson complete in one place, every
other component reading progress updates without a reload) that a mount effect never would.

## List, form, and demo-action states

- **Every list needs loading, empty, and error states.** Loading is a route-level `loading.tsx`
  with `Skeleton` blocks and `aria-busy="true"`. Empty is a designed state (icon, one sentence, a
  way out — e.g. **Clear filters** or **Browse courses**), not a blank div. Error is the nearest
  `error.tsx` boundary.
- **Every form needs validation, pending, and error states.** Validate with the relevant `zod`
  schema from `src/lib/validation.ts` on submit; map failed issues to their field by dot-path
  (`modules.0.lessons.0.content`) and render each inline with `role="alert"`, `aria-invalid`, and
  `aria-describedby`; focus the first invalid field.
- **Honest states.** This is Phase 1's core promise: nothing here fakes success. A demo action
  (admin course form, publish/unpublish/delete, the Google/invite-code auth buttons) validates for
  real, then toasts `"Demo mode — changes aren't saved yet."` (or the auth-specific `"Sign-in
  isn't wired up yet."`) and stops — no redirect, no optimistic row, no success panel. See
  `CLAUDE.md` for why: a demo that lies about what it did is worse than no demo.

## Accessibility

Per `docs/02-academy.md` §14:

- Semantic landmarks (`header`/`nav`/`main`/`footer`), exactly one `h1` per page.
- Labeled inputs via `<Label htmlFor>`, `aria-describedby` and `aria-invalid` on errored fields,
  `role="alert"` on the error text itself.
- `aria-current="page"` on the active nav link (main nav, admin nav, lesson sidebar).
- Focus-visible rings from the shadcn/base-ui primitives — don't strip `focus-visible` classes.
- Keyboard-navigable menus, dialogs, and sheets (the base-ui primitives handle this; don't
  reimplement open/close/focus-trap logic by hand).
- Icons carry `aria-hidden="true"` plus an adjacent text label — never an icon alone as the only
  signal (this also applies to status: a published/draft badge always carries the word, never just
  a colour).
- Loading skeletons live inside an `aria-busy="true"` region with a visually-hidden "Loading"
  announcement.
- Progress bars use `role="progressbar"` with `aria-valuenow` (the shadcn `Progress` component
  sets this from its `value` prop automatically).
- Contrast: Electric Violet `#5E4FB3` on Soft Ivory/Paper for links and outlined controls; Ivory
  text on Electric Violet for filled actions; the accessible tint `#887bd8`
  (`text-violet-accessible`) for text/controls on Obsidian, never `#5E4FB3` there.

## Testing

- Vitest, colocated `*.test.ts`/`*.test.tsx` files next to the code they cover (`progress.ts` →
  `progress.test.ts`).
- Test real behavior, not implementation details — the loader tests parse real fixture Markdown,
  the query tests run filters against the real content set, the validation tests exercise the
  actual zod schemas.
- Isolate filesystem side effects. Don't write test fixtures into `content/` (the directory the
  app itself scans, and any other test file that also calls `loadAllCourses()`) — use an isolated
  temp directory, as `loader.test.ts`'s `withTemporaryCourse` does.
- `pnpm typecheck && pnpm lint && pnpm build` must all pass — the build prerenders every route via
  `generateStaticParams`, so a broken slug, bad metadata, or RSC violation fails the build itself,
  not just at runtime.

## Commit style

Conventional commit prefixes (`feat:`, `fix:`, `chore:`, `docs:`). Work happens on `main` for
Phase 1 given the single owner and the timeline; branch discipline arrives with Phase 2 and
additional contributors.

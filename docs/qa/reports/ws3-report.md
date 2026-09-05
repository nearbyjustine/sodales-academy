# Workstream 3 report — Accessibility (C1–C5)

Ref: `docs/qa/2026-09-05-frontend-qa.md` §C1–C5; plan `docs/qa/plans/ws3-accessibility.md`.

## Summary

All five defects (C1–C5) are fixed exactly per the plan. Every target file was re-read fresh
before editing (per the task's warning that WS1/WS2/WS4 had already landed and shifted line
numbers). Content at each edit site matched the plan's "Old" blocks verbatim in every file except
line numbers, which had drifted (e.g. `admin/layout.tsx`'s desktop sidebar link at line 21 already
carried the focus-ring class from an earlier workstream — only the mobile wordmark link at line 37
still needed it, exactly as the plan anticipated). No deviations from the plan's decisions.

## Files changed

- `src/components/admin/modules-editor.tsx` (C1) — added `aria-describedby` + a matching `id` on
  the error `<p>` for module title, lesson title, lesson slug, and lesson content fields, mirroring
  `course-form.tsx:118-129`'s `title`/`title-error` pattern.
- `src/components/auth/invite-code-form.tsx` (C2) — `aria-describedby` now includes
  `invite-code-error` (in addition to `invite-code-help`) when `error` is set; the error `<p>` got
  `id="invite-code-error"`.
- `src/components/layout/mobile-nav.tsx` (C3) — added `outline-none focus-visible:ring-2
  focus-visible:ring-violet` to each nav `Link`.
- `src/app/(site)/learn/[courseSlug]/[lessonSlug]/page.tsx` (C3) — same ring classes on the
  "back to course" `Link`.
- `src/app/(auth)/login/page.tsx` (C3) — same ring classes on the "Create an account" `Link`.
- `src/app/(auth)/sign-up/page.tsx` (C3) — same ring classes on the "Sign in" `Link`.
- `src/app/admin/layout.tsx` (C3) — same ring classes on the mobile wordmark `Link` (the desktop
  sidebar `Link` already had them from an earlier workstream, confirmed by re-reading the file
  before editing — left untouched).
- `src/components/course/catalog-filters.tsx` (C3) — added `outline-none ...
  focus-visible:ring-violet` to the level-filter pill `<button>`'s className (kept inside the
  existing `cn(...)` call, ahead of the active/inactive ternary).
- `src/components/layout/site-header.tsx` (C4) — replaced `aria-hidden="true"` with
  `aria-label={`Signed in as ${session.name}`}` on the initials badge `<span>`.
- `src/components/layout/site-footer.tsx` (C5) — the five sibling-product items are now
  non-interactive `<span title="...">` elements (no `href`, no `hover:underline`) with an added
  `sr-only` " (coming soon)" child, instead of `<a href="#">`.
- `docs/qa/reports/ws3-report.md` (this file, new).

## Manual verification steps (someone should still run these with a real screen reader — none of
this is covered by an automated a11y harness)

**C1** — On `/admin/courses/new`, submit the form with an empty module title. Tab to the "Module
title" input with VoiceOver/NVDA running. It must announce the field as invalid AND speak the error
text (e.g. "Module title, edit text, invalid data, Title is required"), not just "invalid data".
Repeat for a lesson's title, slug, and content fields (add a lesson, leave slug blank, submit).

**C2** — On `/sign-up`, submit an invalid invite code. With the screen reader on the "Invite code"
input, it must speak the error message text plus "Members receive this from their team lead." —
not just the help text alone.

**C3** — Keyboard only, no screen reader: Tab to each of the six controls in a real browser and
confirm a visible violet ring appears — mobile nav links (open hamburger menu on `/` at narrow
width), the lesson "back to course" link (`/learn/<course>/<lesson>`), "Create an account" on
`/login`, "Sign in" on `/sign-up`, the admin mobile wordmark link (`/admin` at mobile width), and
the level-filter pills on `/courses`.

**C4** — Sign in, then navigate the header with a screen reader. The initials badge must announce
"Signed in as `<full name>`", not bare letters and not silence. The very next stop, the sign-out
button, must announce "Sign out, button" only — no repeated "Signed in as..." (verified by reading
`sign-out-button.tsx:14`, whose `aria-label` is a static `"Sign out"` unrelated to the badge's new
label — no double-announcement risk).

**C5** — Tab through the footer. The five product names ("Main", "Persona", "Cinema", "Talents",
"Store") must never receive focus, and the Tab sequence must skip straight past them. With
Continuous Reading, each should announce as plain text, e.g. "Persona, coming soon" — not
"Persona, link". Confirmed nothing else in the codebase depends on these being links: `grep -rn
"SIBLING_PRODUCTS" src` shows only the declaration and the one map site in `site-footer.tsx`; no
other file references the sibling-product hrefs, click handlers, or expects `<a>` semantics there.

## Test-impact check (per the task's warning about `track-map.test.tsx` and WS2 tests)

`src/components/track/track-map.test.tsx` renders `TrackMap`, which does not import or render any
of the ten files touched here (`site-header`, `site-footer`, `mobile-nav`, `modules-editor`,
`invite-code-form`, `catalog-filters`, the login/sign-up pages, the lesson page, or
`admin/layout.tsx`) — confirmed by reading `track-map.tsx` in full. No adjustment needed.

Grepped the full test suite for references to any of the ten touched components/files
(`site-header|site-footer|SiteHeader|SiteFooter|mobile-nav|MobileNav|modules-editor|invite-code-form|catalog-filters|CatalogFilters`)
under `src/**/*.test.ts*` — zero matches. None of C1–C5's changes altered an accessible name or
role that any existing test queries by (`aria-describedby`/`id` additions don't change accessible
name computation; the C4 badge's `aria-hidden` → `aria-label` swap does add it to the accessibility
tree with a new name, but no test renders `SiteHeader` or queries for it). No test file was
modified.

## Verification output

### `pnpm typecheck`

```
$ tsc --noEmit
```
Exit 0, no output — clean.

### `pnpm lint`

```
$ eslint .

/Users/justine/Documents/sodales/src/components/layout/sign-out-button.tsx
  10:5  warning  Do not use `window.location.href` to navigate to internal Next.js pages. Use `redirect()` in the render phase, or `useRouter().push()` in Client Components' event handlers instead. See: https://nextjs.org/docs/messages/no-location-assign-relative-destination  @next/next/no-location-assign-relative-destination

/Users/justine/Documents/sodales/src/lib/content/queries.ts
  110:20  warning  '_modules' is assigned a value but never used  @typescript-eslint/no-unused-vars

✖ 2 problems (0 errors, 2 warnings)
```
Exactly the two known pre-existing warnings named in the plan's baseline — no new warnings in any
of the ten edited files.

### `pnpm test`

```
 Test Files  22 passed (22)
      Tests  138 passed (138)
   Start at  21:48:09
   Duration  7.11s (transform 2.15s, setup 0ms, import 10.86s, tests 24.92s, environment 13.23s)
```
All green, no new failures, no test files modified.

### `pnpm build`

Exit code 0. Output logs several `[neon-auth] Cookie validation error before getSession upstream
call ... Dynamic server usage: Route /admin... couldn't be rendered statically because it used
\`cookies\`` messages during static-page generation for `/admin`, `/admin/courses`,
`/admin/tracks`, `/admin/tracks/new` — this is expected noise, not a failure: `CLAUDE.md` documents
that every route reading the session via `getSession()`/`cookies()` is dynamic, and the final route
table confirms all affected routes are correctly marked `ƒ (Dynamic)`, not `○ (Static)`. Full
route table:

```
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

○  (Static)   prerendered as static content
ƒ  (Dynamic)  server-rendered on demand
```

## Deviations

None. Every edit matches the plan's prescribed "New" block exactly (id-naming style, decision
rationale for C4/C5, `sr-only` text, dropped `hover:underline`).

## Concerns

- None blocking. The `[neon-auth]` cookie-validation log lines during `pnpm build` are pre-existing
  behavior unrelated to this workstream's changes (none of the ten edited files touch session/auth
  logic) — flagged here only in case a future reviewer sees them in build output and mistakes them
  for a regression.
- As the plan notes, there's no automated a11y test harness in this repo, so the manual
  screen-reader verification steps above still need a human pass with VoiceOver/NVDA before this is
  fully closed out.

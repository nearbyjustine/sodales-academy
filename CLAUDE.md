# Sodales Academy

## What this is

**Sodales Academy, Phase 1** — a standalone, frontend-only Next.js 16 learning site. No database,
no authentication, no server persistence. Course content is Markdown on disk; the logged-in user
is hardcoded; progress lives in `localStorage`. The goal is a public, clickable demo on Vercel that
still reads as a real product.

- **Spec (binding authority):** `docs/superpowers/specs/2026-09-03-academy-frontend-design.md`
- **Plan:** `docs/superpowers/plans/2026-09-03-academy-phase-1.md`
- **Coding guidelines:** `docs/coding-guidelines.md`

`docs/00-platform.md` through `docs/06-store.md` describe a six-app Turborepo monorepo. **No such
code exists.** Those SDDs are the wider Sodales roadmap, not this repository. Where they conflict
with the spec above, **the spec wins** — it records eight explicit deviations in §11 (Inter-only
type, Google OAuth + invite code instead of email/password, a standalone repo instead of a
monorepo, Next.js 16 instead of 15, among others).

## The seam, and why it matters

Every page reads data through a small set of async functions whose signatures already match their
Phase 2 database equivalents:

- `src/lib/content/queries.ts` — `getCourses`, `getCourseBySlug`, `getLesson`, `getCatalogStats`
- `src/lib/session.ts` — `getSession`, `requireUser`, `requireRole`, `getEnrollments`

Phase 1 implements them over the filesystem and a cookie; Phase 2 reimplements the same signatures
over SQL and real auth. **Pages, components, and layouts change in neither direction** — that
swap-in is the entire point of Phase 1. Every one of these functions is `async` even though Phase 1
needs no `await`; making them synchronous now would force a call-site rewrite later. If a page ever
reads `content/`, `localStorage`, or the role cookie directly instead of going through one of these
functions, Phase 2 stops being a body-swap and becomes a rewrite.

## Rules that get broken most

- **Never import from `content/` outside `src/lib/content/loader.ts`.** It is the only module
  permitted to touch the filesystem for course data. Anywhere else breaks the seam and duplicates
  frontmatter-parsing logic that Phase 2 deletes wholesale.
- **Never touch `localStorage` outside `src/lib/progress.ts`.** Progress state has one owner;
  scattering reads/writes makes the seeded-vs-real-state hydration logic impossible to reason
  about and risks a hydration mismatch.
- **Never read the role cookie outside `src/lib/session.ts`.** `requireUser`/`requireRole` are the
  only sanctioned guards; reading the cookie elsewhere means Phase 2's real auth swap misses that
  call site and the guard silently stops working.
- **Never report success for an action that did not happen.** Demo actions (admin forms, auth
  buttons, publish/unpublish/delete) toast `"Demo mode — changes aren't saved yet."` (or, for auth,
  `"Sign-in isn't wired up yet."`) and stop. No fake success screens, no optimistic rows, no
  redirect that implies a write occurred. A demo that lies about what it did is worse than no demo.
- **Inter only, weights 400 and 700.** No serif anywhere — Source Serif 4 was dropped (spec §11,
  D-3). Loading a second typeface silently reopens a decision that's already closed.
- **Electric Violet `#5E4FB3` is the only action colour.** Never violet text on Obsidian — it fails
  contrast there; use the accessible tint `#887bd8` (`text-violet-accessible`) for text/controls on
  dark surfaces instead.
- **The wordmark renders only through `<BrandWordmark />`**, never as live text. Brand guidelines
  require it ship as artwork; setting it as text bypasses that requirement invisibly.
- **Next 16: `params`, `searchParams`, and `cookies()` are async.** `await` them. This is a
  breaking change from Next 15 and earlier training data — code that destructures them
  synchronously fails to compile.
- **`next lint` does not exist.** Run `pnpm lint` (it calls `eslint` directly); `next build` no
  longer lints either.
- **Streaming responses can't change their HTTP status after the fact.** Because the root layout
  reads `cookies()` (via `getSession`), every route is dynamic and streams its shell before
  `notFound()`/`redirect()` resolve — the browser navigates correctly, but a plain `curl` (or any
  non-JS client) sees `200` instead of `404`/`307`. This is documented Next.js behavior
  (`node_modules/next/dist/docs/.../not-found.md`, "Status Codes"), not a bug to work around.

## Commands

```bash
pnpm dev        # local dev server
pnpm build      # production build (also the strongest correctness check)
pnpm test       # vitest
pnpm lint       # eslint
pnpm typecheck  # tsc --noEmit
```

## Where things live

| Path | Responsibility |
| --- | --- |
| `content/courses/<slug>/course.md` | Course frontmatter — title, description, category, level, instructor |
| `content/courses/<slug>/<n>-<slug>.md` | One lesson: frontmatter + Markdown body |
| `src/lib/content/types.ts` | Types mirroring the Phase 2 DB schema field-for-field |
| `src/lib/content/loader.ts` | **The only file that reads `content/`.** Parses frontmatter, orders, validates uniqueness |
| `src/lib/content/queries.ts` | `getCourses` / `getCourseBySlug` / `getLesson` / `getCatalogStats` / `getAllCourses` (admin) — the Phase 2 seam |
| `src/lib/session.ts` | `getSession` / `requireUser` / `requireRole` / `getEnrollments`, role from cookie |
| `src/lib/progress.ts` | Client-only `localStorage` completion tracking, plus `useCompletedLessonIds`/`useLessonComplete` (`useSyncExternalStore`, not a mount effect) |
| `src/lib/validation.ts` | zod schemas (`courseInputSchema`, `signUpSchema`, `signInSchema`), shared verbatim with Phase 2 |
| `src/content/session.ts` | The hardcoded demo user and their enrollments (`DEMO_USER`, `DEMO_ENROLLMENTS`) |
| `src/components/brand/brand-wordmark.tsx` | The only place the wordmark is rendered |
| `src/components/layout/` | Header, footer, nav, role switcher |
| `src/components/course/` | Course row, outline, dashboard cards/stats |
| `src/components/lesson/` | Markdown body, sidebar, completion toggle |
| `src/components/admin/` | Course form, modules editor, row actions |
| `src/components/auth/` | Google button, invite-code form (both visual only) |
| `src/components/ui/` | shadcn primitives (base-ui under the hood) |
| `src/app/(site)/` | Public + learner routes — home, `/courses`, `/dashboard`, `/learn` (has `SiteHeader`/`SiteFooter`) |
| `src/app/(auth)/` | `/login`, `/sign-up` — split-screen layout, no site chrome |
| `src/app/admin/` | `/admin/*` — sidebar shell, gated by `requireRole` in its layout |

## Phase 2 backlog

Neon Postgres, Drizzle ORM, Neon Auth / Google OAuth, the shared invite code, enrolled-only lesson
comments, a Tiptap lesson editor, real server-side persistence, Docker. See spec §11 for the eight
recorded deviations from `docs/02-academy.md` and why each was made.

## Context — The Playbook PH

This supports The Playbook PH competition (Sept 1 – Dec 31, 2026), where teams compete across
Freelancing Agency, Short Film/Commercial, Digital Products, and Full Branding. Academy sits under
Branding and Websites, which feeds the Agency score.

The Academy is for team members first, but the public catalog is deliberately world-readable so it
doubles as proof of work for the Agency.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

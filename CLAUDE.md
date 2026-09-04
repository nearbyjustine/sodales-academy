# Sodales Academy

## What this is

**Sodales Academy, Phase 2** — a Next.js 16 learning site backed by real Neon Postgres and real
Neon Auth (Google OAuth + a DB-backed invite code), deployed to production at
`https://sodales.vercel.app`. There is no filesystem course content, no `localStorage`, no
hardcoded demo user, and no demo-mode toasts anymore — every write in this app is a real write
against a real database that real enrolled learners depend on.

- **Backend spec (binding authority):** `docs/superpowers/specs/2026-09-03-academy-backend-design.md`
- **Backend plan:** `docs/superpowers/plans/2026-09-03-academy-backend-implementation.md`
- **Frontend spec (Phase 1, still describes pages/components/layout):**
  `docs/superpowers/specs/2026-09-03-academy-frontend-design.md`
- **Coding guidelines:** `docs/coding-guidelines.md`

`docs/00-platform.md` through `docs/06-store.md` describe a six-app Turborepo monorepo. **No such
code exists.** Those SDDs are the wider Sodales roadmap, not this repository. Where they conflict
with the specs above, **the specs win** — the frontend spec's §11 records eight deviations from
`docs/02-academy.md` (Inter-only type, Google OAuth + invite code instead of email/password, a
standalone repo instead of a monorepo, among others); the backend spec adopts
`docs/00-platform.md`/`docs/02-academy.md`'s Drizzle/Neon Auth/env-contract conventions but adapts
them for this standalone app (no `apps/<app>/` prefix, no `packages/ui`, no port pinning, no `make`
commands).

## The seam, and why it's real now

Every page still reads/writes data through the same small set of functions Phase 1 established —
the signatures never changed, only what's behind them:

- `src/lib/content/queries.ts` — `getCourses`, `getCourseBySlug`, `getCourseBySlugForAdmin`,
  `getLesson`, `getCatalogStats`, `getAllCourses`, `isEnrolled`, `getCompletedLessonIds`. Real
  Drizzle `SELECT`s against Postgres.
- `src/lib/content/mutations.ts` — `createCourse`, `updateCourse`, `publishCourse`,
  `unpublishCourse`, `deleteCourse`, `enrollInCourse`, `toggleLessonComplete`, `listInstructors`.
  `"use server"` Server Actions — every export in this file is a POST-reachable network endpoint.
- `src/lib/content/authz.ts` — `assertCanManageCourse`/`canManageCourse`, the one authorization rule
  behind every course write and every draft-visibility check (spec §8). Deliberately NOT in
  `mutations.ts`: a plain module has no `"use server"` directive, so this decision function can
  never be invoked directly over the network, only imported by server code that already
  re-derived its own session.
- `src/lib/session.ts` — `getSession` (React-cached, see below), `requireUser` (redirect
  `/login`), `requireRole(...roles)` (redirect `/`), `getEnrollments`. Real Neon Auth session +
  `user_profile` role join.

Pages, components, and layouts still never read `@/db`/`@/db/schema` or the auth session directly —
they go through these functions. This is what made the Phase 1 → Phase 2 swap a body-swap instead
of a rewrite, and it's still the rule going forward: any new page/component that reaches around
`queries.ts`/`mutations.ts`/`session.ts` to touch the database or the auth session itself breaks the
one seam every authorization/visibility rule in this app depends on.

`@/db`/`@/db/schema` are currently imported directly only from: `src/lib/content/`
(`queries.ts`/`mutations.ts`/`authz.ts`), `src/lib/session.ts`, `src/db/` itself (`seed.ts`,
run once to promote `ADMIN_EMAIL` to admin — there is no more content-migration step, that ran once
and was deleted), and `src/app/actions/verify-invite-code.ts` (the invite-code Server Action, which
has to check the DB before Google OAuth can even be attempted — see below). Keep it that way; verify
with `grep -rn "@/db" src` before assuming otherwise, since this list is a description of current
reality, not an enforced boundary.

## Rules that get broken most

- **Every Server Action re-derives its own session server-side and never trusts a client-supplied
  role or ownership claim** (spec §8). `createCourse`/`updateCourse`/`publishCourse`/
  `unpublishCourse`/`deleteCourse` all call `requireRole("instructor", "admin")` and then
  `assertCanManageCourse(courseId, viewer)` using that freshly-derived `viewer` — never a role or
  user id passed in from the client. `enrollInCourse`/`toggleLessonComplete` call `requireUser()`
  and use `viewer.userId`, and `toggleLessonComplete` additionally checks the caller is enrolled in
  (or manages) the lesson's course before writing `lesson_progress` — a signed-in user is not
  automatically authorized to write progress for an arbitrary lesson id.
- **`assertCanManageCourse` stays out of `mutations.ts`.** It's the authorization DECISION for
  every course write; putting it in a `"use server"` file makes it a network-reachable endpoint
  whose second argument is the `Session` used for the decision. It lives in `src/lib/content/authz.ts`
  (no `"use server"`) instead — import it from there, not by re-exporting it through `mutations.ts`.
- **Never fake success for a write that failed.** Mutations return `MutationResult`
  (`{ ok: true } | { ok: false; message: string }`, or a small extension of it like
  `ToggleLessonCompleteResult`), and every client caller must branch on `result.ok` before assuming
  the write happened — surface `result.message` as an error toast (`toast.error(...)`), don't
  assume success and update local state optimistically. This replaces Phase 1's demo-mode-toast
  rule with the same underlying honesty principle: a UI that claims a write happened when it didn't
  (or silently swallows the failure) is worse than no feedback at all.
- **`updateCourse` reconciles modules/lessons by identity — it must never go back to
  delete-and-reinsert.** `lesson` has a real `unique(course_id, slug)` constraint; a lesson sharing
  (courseId, slug) with the submitted form input IS that lesson and must be UPDATEd in place
  (preserving its `id`), because `lesson → lesson_progress` cascades on delete and every enrolled
  learner's progress lives there. Only a lesson whose slug is genuinely absent from the submission
  should be deleted. `course_module` has no equivalent constraint and is matched best-effort by
  `(courseId, title)` — module identity isn't load-bearing for progress data the way lesson identity
  is.
- **Lesson reads are two-step and access-gated.** `getLesson` resolves published/draft status,
  role, ownership, preview status, and enrollment BEFORE returning `lesson.content` — an
  unauthorized request must never receive the lesson body, even if it can see the lesson's
  metadata/title via the sidebar (`getLesson`'s `modules` field strips every non-target lesson's
  `content` for exactly this reason — see its own code comment before changing that shape).
- **`getAllCourses(viewer)` takes the viewer and scopes accordingly** (spec §8's ownership
  invariant applies to the admin listing, not just the mutations behind it): an admin sees every
  course, an instructor sees only courses whose `instructor_user_id` is their own. Every caller
  (`/admin`, `/admin/courses`) calls `requireRole("instructor", "admin")` itself and passes the
  resulting session in — don't call `getAllCourses()` unscoped.
- **`getSession` is React-cached (`cache()` from `"react"`, spec §6).** A single request/render can
  call it 2-3 times (`SiteHeader`, the page itself via `requireUser`/`requireRole`,
  `getEnrollments`); `cache()` dedupes those into one `auth.getSession()` round-trip + one
  `user_profile` query per request. This is request-scoped memoization, not a cross-request cache —
  never reach for anything longer-lived here.
- **Inter only, weights 400 and 700.** No serif anywhere — Source Serif 4 was dropped (frontend
  spec §11, D-3). Loading a second typeface silently reopens a decision that's already closed.
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
  reads the session (via `getSession`), every route is dynamic and streams its shell before
  `notFound()`/`redirect()` resolve — the browser navigates correctly, but a plain `curl` (or any
  non-JS client) sees `200` instead of `404`/`307`. This is documented Next.js behavior
  (`node_modules/next/dist/docs/.../not-found.md`, "Status Codes"), not a bug to work around.
- **`drizzle-orm/neon-http` does not support transactions.** `db.transaction(...)` throws
  synchronously (`"No transactions support in neon-http driver"` — confirmed against the compiled
  driver, not just its `.d.ts`). Every multi-statement mutation in `mutations.ts` runs its inserts/
  updates/deletes directly against `db`, sequentially, with a code comment at the call site
  acknowledging the (accepted, low-volume-admin-write-path) risk of a mid-write crash leaving a
  partial state — this is a real limitation, not something to silently "fix" by wrapping in a
  transaction that will throw at runtime.
- **`src/proxy.ts` (Next 16's renamed `middleware.ts`) only runs on `/dashboard`, `/learn`, and
  `/admin`.** It exists solely to exchange Neon Auth's post-OAuth-redirect query param for a real
  session cookie before any Server Component reads `auth.getSession()` — it is NOT a second
  authorization gate in front of public pages (the catalog/home stay world-readable) and isn't a
  substitute for `requireUser`/`requireRole`, which every authenticated route still calls itself.

## Commands

```bash
pnpm dev        # local dev server
pnpm build      # production build (also the strongest correctness check)
pnpm test       # vitest — several suites hit the real Postgres test database, see below
pnpm lint       # eslint
pnpm typecheck  # tsc --noEmit
pnpm db:seed    # promote ADMIN_EMAIL to admin (idempotent) — dotenv -e .env.local -- tsx ... src/db/seed-cli.ts
```

Env contract: `DATABASE_URL`, `NEON_AUTH_BASE_URL`, `NEON_AUTH_COOKIE_SECRET`, `ADMIN_EMAIL`,
`INVITE_CODE_SECRET`. All in `.env.local` locally; mirrored in the Vercel project for production.
No Google Cloud OAuth client is needed — Neon Auth ships Google as a shared, pre-configured
provider the moment Neon Auth is enabled on the project.

Many test files (`*.integration.test.ts`, and several `*.test.ts` under `src/lib/content/`/`src/db/`)
run real queries against the Postgres database in `DATABASE_URL` rather than mocking `@/db` — they
insert their own fixture rows (prefixed with the test's own name, e.g.
`mutations-integration-test-*`) and clean up in `afterAll`. Only `@/lib/session`/`@/lib/auth/server`
get mocked, narrowly, in files that would otherwise transitively pull in `@neondatabase/auth`'s
bare `next/headers` import (which Node's strict ESM loader can't resolve outside Next's own
bundler) — see the top-of-file comments in `mutations.integration.test.ts`,
`enrollment-mutations.test.ts`, `queries.test.ts`, and `session.test.ts` for the exact mechanism
each one hits.

## Where things live

| Path | Responsibility |
| --- | --- |
| `src/db/index.ts` | Drizzle client (`drizzle-orm/neon-http` + `@neondatabase/serverless`), server-only |
| `src/db/schema/` | `user.ts` (`user_profile`), `course.ts` (`course`/`course_module`/`lesson`), `enrollment.ts` (`enrollment`/`lesson_progress`), `invite.ts` (`invite_code`) — UUID PKs, `snake_case`, `created_at`/`updated_at` on mutable tables |
| `src/db/migrations/` | Generated by `drizzle-kit`, never hand-edited |
| `src/db/seed.ts` / `seed-cli.ts` | One-off `ADMIN_EMAIL` → `role: "admin"` promotion, idempotent |
| `src/lib/auth/server.ts` | `createNeonAuth` instance (`auth`), Google-only OAuth provider |
| `src/lib/auth/invite.ts` | HMAC-signs/verifies the short-lived invite-code cookie token (`INVITE_TOKEN_COOKIE`) |
| `src/lib/auth/client.ts` | Client-side Neon Auth hooks/helpers |
| `src/app/api/auth/[...path]/route.ts` | Neon Auth's own route handler (`auth.handler()`) |
| `src/proxy.ts` | Next 16 middleware — exchanges the post-OAuth redirect param for a session cookie on `/dashboard`, `/learn`, `/admin` only |
| `src/app/actions/verify-invite-code.ts` | Server Action: checks a submitted code against `invite_code`, signs the invite-token cookie on success |
| `src/lib/content/types.ts` | Shared types mirroring the DB schema field-for-field |
| `src/lib/content/queries.ts` | Reads — `getCourses`/`getCourseBySlug`/`getCourseBySlugForAdmin`/`getLesson`/`getCatalogStats`/`getAllCourses`/`isEnrolled`/`getCompletedLessonIds` |
| `src/lib/content/mutations.ts` | `"use server"` writes — `createCourse`/`updateCourse`/`publishCourse`/`unpublishCourse`/`deleteCourse`/`enrollInCourse`/`toggleLessonComplete`/`listInstructors` |
| `src/lib/content/authz.ts` | `assertCanManageCourse`/`canManageCourse` — the one course-ownership rule, deliberately not `"use server"` |
| `src/lib/session.ts` | `getSession` (React-cached)/`requireUser`/`requireRole`/`getEnrollments`, real Neon Auth + `user_profile` |
| `src/lib/lesson-progress.ts` | Pure helpers over server-fetched completion data — no `localStorage`, no client-only state |
| `src/lib/validation.ts` | zod schemas (`courseInputSchema`, `signUpSchema`, `signInSchema`) — `courseInputSchema` carries `instructorUserId`, server-overwritten when the submitter is an instructor |
| `src/components/brand/brand-wordmark.tsx` | The only place the wordmark is rendered |
| `src/components/layout/` | Header, footer, nav, sign-out button (no more role switcher) |
| `src/components/course/` | Course row, outline, dashboard cards/stats, enroll button |
| `src/components/lesson/` | Markdown body, sidebar, `complete-toggle.tsx` (branches on `result.ok`, toasts the real error on failure) |
| `src/components/admin/` | Course form, modules editor, row actions |
| `src/components/auth/` | Google button, invite-code form, sign-up flow — all wired to real Server Actions now |
| `src/components/ui/` | shadcn primitives (base-ui under the hood) |
| `src/app/(site)/` | Public + learner routes — home, `/courses`, `/dashboard`, `/learn` (has `SiteHeader`/`SiteFooter`) |
| `src/app/(auth)/` | `/login`, `/sign-up` — split-screen layout, no site chrome |
| `src/app/admin/` | `/admin/*` — sidebar shell, gated by `requireRole` in its layout AND in each page (cheap, idempotent, React-cached) |

## Outstanding / deferred

- **Invite code rotation UX.** Codes live in the `invite_code` DB table so an admin *can* rotate one
  without a redeploy, but there's no admin UI for creating/revoking codes yet — rotation is still
  direct DB access. A fast-follow, not a blocker.
- **Enrolled-only lesson comments, a Tiptap lesson editor, video hosting, payments, certificates,
  quizzes, email notifications, branch-per-PR Neon preview infrastructure** — all explicitly out of
  scope for the backend spec, deferred to their own specs if/when they're picked up.
- **E2E tests** — still deferred; the test suite is Vitest unit/integration tests against the real
  test database, not browser-driven end-to-end coverage.

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

# Sodales Academy

A learning platform that sells **tracks** — ordered paths through several courses, each ending in a
stated capability. Next.js 16 on real Neon Postgres with real Neon Auth (Google OAuth behind a
DB-backed invite code).

Live at **https://sodales.vercel.app**.

Everything here is real: real rows, real sessions, real writes. There is no demo mode, no
`localStorage` progress, and no hardcoded user — every write is a write a real enrolled learner
depends on.

## Quickstart

```bash
pnpm install
cp .env.local.example .env.local   # then fill it in — see Environment below
pnpm dev
```

Open http://localhost:3000. Sign-in is Google OAuth gated by an invite code, so you need a row in
`invite_code` and a `DATABASE_URL` pointing at a database with the schema applied.

```bash
pnpm exec drizzle-kit migrate   # apply migrations
pnpm db:seed                    # promote ADMIN_EMAIL to role: admin (idempotent)
pnpm db:seed:tracks             # create the starter track as a draft (idempotent)
```

> **`DATABASE_URL` is shared with production.** There is no separate dev database. Running a
> migration or a seed locally changes what the live site serves, and a row you publish while
> testing is published for real. Check before you run.

## How content works

Courses and lessons live **in Postgres**, not in the filesystem. They are authored through the
admin UI at `/admin`, which is gated by `requireRole` and only reachable by an instructor or admin.

- **Courses** — `/admin/courses`. Title, description, category, level, instructor, and a
  modules/lessons editor. Lesson bodies are written in a Tiptap rich-text editor that stores
  **markdown**, so what the editor produces is exactly what `LessonBody` renders. Save a lesson
  without touching it and the markdown comes back byte-for-byte equivalent — there is a test
  asserting that against every lesson in the catalog.
- **Tracks** — `/admin/tracks`, admin-only. A track is an ordered list of courses plus a promise
  and an outcome. **Order is the product**, and the form's ordering control is what sets each
  course's position, so the sequence you build is the sequence a learner climbs.

Both start as drafts. A draft is invisible to everyone but an admin — not its title, not its slug,
not its counts.

## Architecture

Every page reads and writes through one small seam. Nothing else touches the database or the auth
session directly.

| Module | Responsibility |
| --- | --- |
| `src/lib/content/queries.ts` | All reads. Draft visibility and ownership scoping live here. |
| `src/lib/content/mutations.ts` | All writes. `"use server"` — every export is a POST-reachable endpoint. |
| `src/lib/content/authz.ts` | The one course-ownership rule. Deliberately **not** `"use server"`. |
| `src/lib/session.ts` | `getSession` (React-cached), `requireUser`, `requireRole`, `getEnrollments`. |

Two rules that explain most of the codebase:

- **Every Server Action re-derives its own session** and never trusts a client-supplied role or
  ownership claim.
- **Never fake success for a write that failed.** Mutations return
  `{ ok: true } | { ok: false; message }`, and every caller branches on it before claiming anything
  happened.

`CLAUDE.md` is the working document for the rules that get broken most — read it before changing
anything structural.

## Commands

```bash
pnpm dev             # local dev server
pnpm build           # production build — the strongest correctness check in this repo
pnpm test            # vitest; several suites run against the real database
pnpm lint            # eslint (note: `next lint` does not exist)
pnpm typecheck       # tsc --noEmit
pnpm db:seed         # promote ADMIN_EMAIL to admin (idempotent)
pnpm db:seed:tracks  # seed the starter track as a draft (idempotent)
```

Many test files hit the Postgres database in `DATABASE_URL` rather than mocking it. They insert
fixture rows prefixed with the test's own name and clean up in `afterAll`.

## Environment

All in `.env.local` locally, mirrored in the Vercel project for production:

```
DATABASE_URL             # Neon connection string
NEON_AUTH_BASE_URL       # e.g. http://localhost:3000 locally
NEON_AUTH_COOKIE_SECRET
INVITE_CODE_SECRET       # HMAC key for the short-lived invite-code cookie
ADMIN_EMAIL              # promoted to role: admin by `pnpm db:seed`
```

No Google Cloud OAuth client is needed — Neon Auth ships Google as a pre-configured provider.

## Deploying

Push to `main`; Vercel builds from GitHub. Migrations are **not** run by the build — apply them
yourself with `pnpm exec drizzle-kit migrate` before pushing code that depends on new columns, or
the deployed app will query tables that do not exist.

## More

- [`CLAUDE.md`](./CLAUDE.md) — architecture, the seam, and the rules that get broken most
- [`docs/coding-guidelines.md`](./docs/coding-guidelines.md) — TypeScript, component, testing and accessibility conventions
- [`docs/qa/2026-09-05-frontend-qa.md`](./docs/qa/2026-09-05-frontend-qa.md) — the last full frontend QA pass
- Specs — [tracks & journey](./docs/superpowers/specs/2026-09-05-academy-journey-design.md), [backend](./docs/superpowers/specs/2026-09-03-academy-backend-design.md), [frontend](./docs/superpowers/specs/2026-09-03-academy-frontend-design.md)

## Not built yet

Single-use invite codes (a code is currently reusable), progression locking, points/streaks/badges,
payments, certificates, quizzes, and email notifications. Each has its own spec before it has code.

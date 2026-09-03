# Sodales Academy

> ⚠️ **Interim file.** Task 20 of the implementation plan replaces this with the full version.
> An earlier draft of this file described a six-app Turborepo monorepo. **That is not what this
> repo is** — see "What changed", below.

## What this is

**Sodales Academy, Phase 1** — a standalone, frontend-only Next.js 16 learning site. No database,
no authentication, no server persistence. Course content is Markdown on disk; the logged-in user
is hardcoded. The goal is a public, clickable demo on Vercel.

- **Spec (binding authority):** `docs/superpowers/specs/2026-09-03-academy-frontend-design.md`
- **Plan:** `docs/superpowers/plans/2026-09-03-academy-phase-1.md`

## What changed from the older docs

`docs/00-platform.md` through `docs/06-store.md` describe a six-app monorepo and are written in the
past tense as though built. **No such code exists.** Those SDDs are the wider Sodales roadmap, not
this repository. Where they conflict with the spec above, **the spec wins** — it records seven
explicit deviations in §11. The most important:

| Older docs say | This repo does |
| --- | --- |
| `apps/academy` inside a monorepo with `packages/ui` | Standalone repo, app at the root |
| pnpm + Turborepo + Docker + `make` commands | pnpm only; no Turborepo, no Docker, no Makefile |
| Neon Postgres + Drizzle + Neon Auth | Nothing — Phase 2 |
| Email/password sign-up | Google OAuth + shared invite code — Phase 2 |
| Source Serif 4 for editorial text | **Inter only, no serif** |
| Next.js 15 | Next.js 16.3 |

## The seam — the one thing to understand

Every page reads data through a small set of async functions whose signatures already match their
Phase 2 database equivalents. Phase 2 swaps their bodies for SQL and real auth; **no page changes.**

- `src/lib/content/queries.ts` — `getCourses`, `getCourseBySlug`, `getLesson`, `getCatalogStats`
- `src/lib/session.ts` — `getSession`, `requireUser`, `requireRole`, `getEnrollments`

Breaking the seam breaks the whole point of Phase 1.

## Rules

- **Never** read from `content/` outside `src/lib/content/loader.ts`.
- **Never** touch `localStorage` outside `src/lib/progress.ts`.
- **Never** read the role cookie outside `src/lib/session.ts`.
- **Never report success for something that did not happen.** Demo actions toast
  `"Demo mode — changes aren't saved yet."` No fake success screens.
- **Inter only.** No serif. Weights 400 and 700.
- **Electric Violet `#5E4FB3` is the only action colour.** Never violet text on obsidian.
- **The wordmark renders only through `<BrandWordmark />`**, never as live text.
- **Next 16:** `params`, `searchParams`, and `cookies()` are async — `await` them.
- **`next lint` does not exist.** Run `pnpm lint` (it calls `eslint`).

## Commands

```bash
pnpm dev        # local dev server
pnpm build      # production build (also the strongest correctness check)
pnpm test       # vitest
pnpm lint       # eslint
pnpm typecheck  # tsc --noEmit
```

## Context — The Playbook PH

This supports The Playbook PH competition (Sept 1 – Dec 31, 2026), where teams compete across
Freelancing Agency, Short Film/Commercial, Digital Products, and Full Branding. Academy sits under
Branding and Websites, which feeds the Agency score.

The Academy is for team members first, but the public catalog is deliberately world-readable so it
doubles as proof of work for the Agency.

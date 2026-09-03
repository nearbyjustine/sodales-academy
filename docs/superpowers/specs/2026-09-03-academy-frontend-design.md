# Sodales Academy — Phase 1 (Frontend) Design

> Date: 2026-09-03 · Owner: Justine C. [B7] · Repo: `nearbyjustine/sodales-academy` (GitHub, public)
> Status: approved, not yet implemented
> Supersedes nothing. Extends and deviates from `docs/02-academy.md` — deviations recorded in §11.

---

## 1. Purpose

Sodales Academy is the learning product of the Sodales collective: a course site where members
browse a catalog, open a course, and read lessons with progress tracking.

**Phase 1 ships the entire interface with no backend.** Content comes from Markdown files in
the repo, the logged-in user is hardcoded, and nothing persists to a server. The goal is a
public, clickable, demo-quality site on Vercel that the team can react to.

Phase 2 adds the database, real authentication, and persistence. Phase 1 is explicitly built so
that Phase 2 replaces implementations, not pages.

## 2. Scope

### In scope (Phase 1)

- All eleven routes listed in §5, plus loading, error, and 404 states.
- Four realistic courses authored as Markdown, drawn from what Sodales actually teaches.
- Catalog search and level filtering over the static content set.
- Lesson completion that persists in the browser via `localStorage`.
- A development-only role switcher that makes every screen reachable without a login.
- Repository conventions: root `CLAUDE.md`, `docs/coding-guidelines.md`.
- Deployment to Vercel on a public URL.

### Out of scope (deferred to Phase 2)

Neon Postgres · Drizzle ORM · Neon Auth / Google OAuth · the shared invite code ·
enrolled-only lesson comments · Tiptap lesson editor · server-side persistence of any kind ·
Docker · certificates · quizzes · payments · video hosting · email.

### Out of scope (indefinitely, per `docs/02-academy.md` §5)

Multi-tenancy, cross-app integration, instructor onboarding flow, media uploads.

## 3. Architecture — the seam

Every page reads data through a small set of async functions whose signatures already match
their Phase 2 database equivalents. Phase 1 implements them over the filesystem; Phase 2
reimplements the same signatures over SQL. **Pages, components, and layouts change in neither
direction.**

```
src/lib/content/queries.ts
  getCourses(filters?: { q?: string; level?: Level }): Promise<CourseSummary[]>
  getCourseBySlug(slug: string): Promise<CourseDetail | null>
  getLesson(courseSlug: string, lessonSlug: string): Promise<Lesson | null>

src/lib/session.ts
  getSession(): Promise<Session | null>
  requireUser(): Promise<Session>
  requireRole(...roles: Role[]): Promise<Session>
```

Rules that make the seam hold:

- Every function is `async` even though Phase 1 needs no `await`. Making them synchronous now
  would force a call-site rewrite later.
- No page or component reads a Markdown file, imports the content directory, or touches
  `localStorage` directly. All of it goes through `src/lib/`.
- Types in `src/lib/content/types.ts` mirror the Phase 2 schema in `docs/02-academy.md` §9
  field for field, including fields Phase 1 does not use (`status`, `isPreview`).

### Directory layout

```
sodales/
├── content/courses/<course-slug>/
│   ├── course.md              (frontmatter: title, description, category, level, instructor)
│   └── 01-<lesson-slug>.md    (frontmatter: title, isPreview, module; body: Markdown)
├── src/
│   ├── app/                   (App Router routes — see §5)
│   ├── components/            (app UI; shadcn primitives under components/ui)
│   ├── content/session.ts     (the hardcoded demo user + enrollments)
│   └── lib/
│       ├── content/           (loader, queries, types)
│       ├── session.ts         (fake session, cookie-backed role)
│       ├── progress.ts        (localStorage completion, client-only)
│       └── validation.ts      (zod schemas — shared with Phase 2)
├── docs/                      (existing SDDs, brand, this spec)
└── CLAUDE.md
```

## 4. Stack

**Next.js 16.3** App Router · React 19.2 · TypeScript 5 (strict) · Tailwind v4.3 · shadcn/ui ·
zod v4 · pnpm · `gray-matter` + `react-markdown`/`remark-gfm` for Markdown · `sonner` for
toasts · Vitest 5 · Vercel (`sin1`).

**Version note.** The existing SDDs specify Next.js 15; current stable is 16.3.4. A greenfield
project starting today takes 16. Consequences carried through this spec:

- `middleware.ts` is deprecated in favour of `proxy.ts`. Phase 1 needs neither — all guarding
  happens in page-level guards, which is where `docs/02-academy.md` §3 puts authorization
  anyway. Phase 2 revisits this.
- `params`, `searchParams`, and `cookies()` are **async** and must be awaited.
- `next lint` is removed and `next build` no longer lints; ESLint runs as its own script.
- Turbopack is the default bundler.
- Requires Node 20.9+ (machine has 26.8.1) and TypeScript 5.1+.

pnpm is not currently installed on the development machine and will be installed via corepack.

**Docker is deferred, not dropped.** The platform SDD mandates it; with no database and no
second service in Phase 1 it would add setup cost and no value. It returns in Phase 2.

## 5. Route map

| Route | Access (simulated) | Notes |
| --- | --- | --- |
| `/` | public | Editorial split hero, catalog stats, learning tracks, CTA |
| `/courses` | public | `?q=` and `?level=` searchParams; result count; empty state |
| `/courses/[slug]` | public | Outline with module/lesson rows, preview badges, enroll CTA |
| `/login` | public | Visual only — "Continue with Google" toasts "not wired up yet" |
| `/sign-up` | public | Visual only — same |
| `/dashboard` | student+ | My courses, progress bars, next-lesson cards, empty state |
| `/learn/[courseSlug]/[lessonSlug]` | student+ | Reader, sticky outline, mark complete, prev/next |
| `/admin` | instructor+ | Stat cards, quick actions |
| `/admin/courses` | instructor+ | Table, status badges, row menu |
| `/admin/courses/new` | instructor+ | Full course form |
| `/admin/courses/[id]/edit` | instructor+ | Full course form, prefilled |

`generateStaticParams` on `/courses/[slug]` and the lesson route, so the build renders every
page and a broken slug fails CI rather than the demo.

## 6. Simulated authentication

`src/lib/session.ts` returns a hardcoded user (name, email, avatar initials) whose **role is read
from a cookie**, defaulting to `learner`. A `RoleSwitcher` control in the header writes that
cookie and refreshes.

- The switcher is visually marked as a development tool (violet outline, "DEMO" label).
- It is rendered behind `process.env.NEXT_PUBLIC_DEMO_MODE`, so Phase 2 removes it by flipping
  one environment variable before the component is deleted.
- Guard functions (`requireUser`, `requireRole`) exist and are called from the same places
  Phase 2 will call them. In Phase 1 they always succeed for a sufficient role and redirect
  otherwise — so the redirect logic is written and exercised now.

The demo user is enrolled in three of the four courses, at 100%, ~40%, and 0% completion, so
the dashboard shows a finished course, one in progress, and one just started.

## 7. Progress tracking

`src/lib/progress.ts` is a client-only module storing completed lesson ids under a single
`localStorage` key.

- Seeded on first load from the demo user's enrollment percentages, so a first-time visitor
  sees populated progress bars rather than an empty dashboard.
- "Mark complete" toggles genuinely work and survive a refresh.
- Progress bars use `role="progressbar"` with `aria-valuenow`.
- A "Reset demo progress" action lives in the role switcher menu.

## 8. Honest states

Following `docs/01-main.md` §8, **the demo never fakes success.**

- Admin forms render completely and run real zod validation with inline field errors.
- Submitting shows a toast: *"Demo mode — changes aren't saved yet."* No success screen, no
  optimistic row insertion, no redirect that implies a write occurred.
- Auth buttons toast *"Sign-in isn't wired up yet."*
- Every list has a designed empty state; every route has loading skeletons; the app has a root
  `error.tsx` with retry and a designed `not-found.tsx`.

## 9. Validation

`src/lib/validation.ts` carries the zod schemas from `docs/02-academy.md` §12 verbatim
(`courseInputSchema`, `signUpSchema`, `signInSchema`), including the super-refinements for
unique module positions and unique lesson slugs. Phase 1 runs them client-side only; Phase 2
reuses the same file server-side without modification.

## 10. Design system

Per `docs/brand/website-guidelines.md`, which is the source of truth.

- **Palette:** Obsidian `#111111`, Soft Ivory `#F4F2ED`, Graphite `#35373B`, Electric Violet
  `#5E4FB3` (the only primary-action color). Academy extensions: Deep Ink `#211C35`,
  Pale Lilac `#DED9EF`, Paper `#FBFAF7`.
- **Type: Inter only.** This resolves open item 1 in the brand guidelines §8 — Source Serif 4
  is dropped. See §11.
- Body 16px minimum. UI labels uppercase ~11–12px, tracking `0.08em`–`0.12em`. Two weights
  (400, 700).
- Flat surfaces, hairline Graphite rules, square or minimally rounded controls, generous
  negative space, indexed editorial rows over generic card grids.
- All motion respects `prefers-reduced-motion`.

### Logo — accepted compromise

Brand guidelines §4 require the wordmark to ship as SVG and forbid setting it as live text.
Only four 500×220 PNGs exist (`assets/1–4.png`); SVG and the reversed ivory variant are
outstanding from Rak A. [B2].

Phase 1 renders the PNG through a single `BrandWordmark` component via `next/image`. When SVG
arrives it is a one-file change. The product lockup `SODALES | ACADEMY` sets only the product
half in Inter, per §4 of the guidelines.

## 11. Deviations from `docs/02-academy.md`

Recorded explicitly so the SDD can be reconciled later.

| # | Deviation | Reason |
| --- | --- | --- |
| D-1 | Lesson comments are **in scope for Phase 2**; the SDD §5 lists Discussions as out of scope | Team brief calls for community learning ("similar to Skool"); enrolled-only threads are the minimum that serves it |
| D-2 | Authentication is **Google OAuth + a single shared invite code**, not email/password open sign-up | Owner decision; closed league membership |
| D-3 | **Inter only** — Source Serif 4 dropped | Brand deck is the signed-off artifact; resolves guidelines §8 open item 1 |
| D-4 | Lesson content is **Markdown**, edited via **Tiptap** in Phase 2 | Resolves SDD §19 open decision 1 |
| D-5 | **Standalone repo**, no monorepo, no `packages/ui` | Owner decision; each teammate owns a repo, compiled later |
| D-6 | Admin seeding by manual promotion after first Google sign-in, not `ADMIN_EMAIL` + password sign-up | Follows from D-2 |
| D-7 | Docker deferred to Phase 2 | No second service to containerize in Phase 1 |
| D-8 | **Next.js 16**, not 15 | 16.3.4 is current stable; greenfield project. See §4 |

## 12. Repository conventions

- **`CLAUDE.md`** at the repo root, written for agents per `writing-for-agents`: what the
  project is, where the seam is, the rules most likely to be broken (never bypass
  `src/lib/content` or `src/lib/session`; never fake success; Inter only; Electric Violet is
  the only action color; never redraw the logo as text).
- **`docs/coding-guidelines.md`**: TypeScript strictness, server-components-by-default,
  file size and single-responsibility expectations, naming, the honest-states rule, and the
  accessibility checklist from `docs/02-academy.md` §14.
- Conventional commit messages. Work happens on `main` for Phase 1 given the single owner and
  the timeline; branch discipline arrives with Phase 2 and additional contributors.

## 13. Accessibility

Semantic landmarks (`header`/`nav`/`main`/`footer`), exactly one `h1` per page, ordered heading
levels, labeled inputs with `aria-describedby` and `aria-invalid`, `role="alert"` on errors,
`aria-current="page"` on active nav, focus-visible Electric Violet rings, decorative artwork
`aria-hidden`, result counts `aria-live="polite"`, progress bars with `role="progressbar"`,
contrast ≥ 4.5:1 for body text, full keyboard operability including the mobile menu.

## 14. SEO

Root metadata template `%s | Sodales Academy`; per-page metadata; `generateMetadata` on course
detail; `sitemap.ts` and `robots.ts`. `robots: { index: false }` on `/dashboard`, `/admin`, and
`/learn` routes. All imagery bundled locally — no external image CDN.

## 15. Testing

- **Static:** `pnpm typecheck`, `pnpm lint`, `pnpm build` must pass. The build prerenders every
  route, so broken slugs, bad metadata, and RSC violations fail the build.
- **Unit (Vitest):** content loader (frontmatter parsing, ordering, missing-file handling),
  `validation.ts` schemas, progress calculation.
- **Content integrity:** duplicate course slug or duplicate lesson slug within a course throws
  at import time, failing the build.
- **Manual:** keyboard pass over header, menu, forms; 375 / 768 / 1280px widths; every role in
  the switcher reaches its screens; reduced-motion honored.
- E2E deferred to Phase 2.

## 16. Deployment

Vercel project, region `sin1`, **public URL** (owner-approved 2026-09-03). Repository pushed to
GitHub under `nearbyjustine`. Environment: `NEXT_PUBLIC_DEMO_MODE=true`. No secrets exist in
Phase 1.

## 17. Acceptance criteria

- [ ] All eleven routes in §5 render, are responsive at 375/768/1280, and are keyboard navigable
- [ ] Catalog search and level filter work over the static content set, with a designed empty state
- [ ] Four realistic courses with real Markdown lesson bodies render correctly
- [ ] Role switcher reaches student, instructor, and admin screens; guards redirect otherwise
- [ ] Mark-complete persists across refresh; dashboard progress reflects it
- [ ] No admin form or auth button ever reports success for an action that did not occur
- [ ] `loading.tsx`, `error.tsx`, `not-found.tsx` all present and designed
- [ ] Only Inter is loaded; no serif; Electric Violet is the only action color
- [ ] `BrandWordmark` renders the supplied asset; the wordmark is never set as live text
- [ ] Per-page metadata, `sitemap.xml`, `robots.txt` present; private routes `noindex`
- [ ] `pnpm typecheck && pnpm lint && pnpm build` all green
- [ ] `CLAUDE.md` and `docs/coding-guidelines.md` exist and match §12
- [ ] Deployed and reachable on a public Vercel URL

## 18. Open items

1. **Course content authorship.** Phase 1 ships four realistic but placeholder courses. Who
   writes the first real course, and by when, is unresolved. Not a build blocker; it is a
   launch blocker — an empty academy is worse than none.
2. **Logo SVG + reversed ivory variant** outstanding from Rak A. [B2]. Multi-day external
   dependency; should be requested now even though it is not needed until Phase 2 dark chrome.
3. **Phase 2 start date** not set.
4. **Google Cloud OAuth client** for production sign-in requires a published consent screen —
   several days of lead time. Should be started before Phase 2 begins.
5. **Missing referenced docs.** `docs/SODALES-IMPLEMENTATION.md`,
   `docs/patterns/neon-app-setup.md`, `docs/sdd/decision-log.md`, and
   `docs/brand/app-visual-directions.md` are cited as binding by the existing SDDs but are not
   present in this repository.

## 19. Risks

| Risk | Mitigation |
| --- | --- |
| Eleven routes in one session is optimistic | Build order is foundation → home → catalog → detail → reader → dashboard → auth → admin; stopping after the reader still yields a demo worth showing |
| The seam erodes under time pressure and pages read content directly | `CLAUDE.md` states the rule; the loader is the only module permitted to touch `content/` |
| Demo mistaken for a working product | Explicit demo-mode toasts and a visible role-switcher label; never fake success |
| Phase 1 decisions silently contradict the SDD | Every deviation recorded in §11 |
| Neon Auth is Beta (Better Auth 1.4.18) and its per-branch auth URLs complicate preview deploys | Phase 2 concern; verify against current Neon docs at wiring time |

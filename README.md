# Sodales Academy

> **This is a demo, not a live product.** Phase 1 is a frontend-only Next.js site: there's no
> database, no real authentication, and no server-side persistence. The logged-in user is
> hardcoded, "progress" lives in your browser's `localStorage`, and every admin/auth action that
> looks like it saves something is a validated no-op — it toasts `"Demo mode — changes aren't
> saved yet."` and stops. See [`CLAUDE.md`](./CLAUDE.md) for the architecture that makes the real
> version (Phase 2) a swap-in later rather than a rewrite.

Live at **https://sodales.vercel.app**.

## Quickstart

```bash
pnpm install
pnpm dev
```

Open http://localhost:3000. The header's **DEMO · learner** control switches roles (learner /
instructor / admin) without a real login — `/admin` only renders for instructor and admin.

## Course content

Courses live as Markdown under `content/courses/<course-slug>/`:

```
content/courses/pricing-and-proposals/
├── course.md                 # frontmatter: title, description, category, level, status, instructorName
├── 01-hourly-vs-fixed.md     # frontmatter: title, module, isPreview; body: the lesson in Markdown
├── 02-finding-your-number.md
└── ...
```

**To add a lesson:** drop a new `<n>-<lesson-slug>.md` file into an existing course directory,
numbered to control its order within the file listing. Its frontmatter needs `title`, `module`
(which module it groups under — reuses an existing module title or starts a new one), and
optionally `isPreview: true` to mark it viewable without progressing through the course. The body
is plain Markdown (GFM — tables, task lists, etc. all work) and becomes the lesson's content.

**To add a course:** create a new `content/courses/<slug>/` directory with a `course.md` (see
`pricing-and-proposals/course.md` for the shape) plus its lesson files. Set `status: draft` while
authoring — draft courses parse and validate normally but never appear in the public catalog.

The only code that reads `content/` is `src/lib/content/loader.ts`; everything else goes through
the query functions in `src/lib/content/queries.ts`.

## Commands

```bash
pnpm dev        # local dev server
pnpm build      # production build
pnpm test       # vitest
pnpm lint       # eslint
pnpm typecheck  # tsc --noEmit
```

## More

- [`CLAUDE.md`](./CLAUDE.md) — architecture, the Phase 1/Phase 2 seam, the rules that get broken most
- [`docs/coding-guidelines.md`](./docs/coding-guidelines.md) — TypeScript, component, testing, and accessibility conventions
- [Spec](./docs/superpowers/specs/2026-09-03-academy-frontend-design.md) — the binding design/scope document
- [Implementation plan](./docs/superpowers/plans/2026-09-03-academy-phase-1.md) — the 21-task build plan this repo followed

# 04 — Cinema SDD

> Owner: Kershey T. [B5] · Port 3003 · Neon project `sodales-cinema` (`wild-rain-07897341`)
> Status: Implemented (v2 visual system). This document matches the shipped implementation.

## 1. Purpose

Sodales Cinema is a curated, editorial film catalog: a dark, cinematic browsing experience
for classic and arthouse cinema. Editors curate films with rich metadata and YouTube
trailers; admins control publication; viewers browse the published catalog with no account.
It is the showcase app of the Sodales family — the visual bar is "film-poster quality".

## 2. Target users

- **Viewers** — film lovers browsing a curated catalog; no account needed.
- **Editors** — catalog curators who create, preview, and edit only their own film drafts.
- **Admins** — Sodales team; everything an editor can do plus publish/unpublish.
- Public visitors of cinema.sodales.com.

## 3. Roles and authorization matrix

Roles are stored app-side in `user_profile.role` (`viewer | editor | admin`), keyed by the
Neon Auth user id. All checks run server-side (data access + page guards); the client is
never trusted.

| Action                                      | Viewer (no auth) | Viewer | Editor | Admin |
| ------------------------------------------- | ---------------- | ------ | ------ | ----- |
| Browse published catalog / film detail      | ✓                | ✓      | ✓      | ✓     |
| See own drafts (staff preview on detail)    | –                | –      | ✓      | ✓     |
| Create film (draft)                         | –                | –      | ✓      | ✓     |
| Edit own draft metadata / categories / media | –              | –      | ✓      | ✓     |
| Edit another curator's draft or a live film | –               | –      | –      | ✓     |
| Publish / unpublish film                    | –                | –      | –      | ✓     |
| Delete film                                 | –                | –      | –      | ✓     |
| Admin area (`/admin/**`)                    | –                | –      | ✓      | ✓     |
| Sign up as viewer (self-service)            | ✓                | ✓      | –      | –     |

Server-side rules enforced in `features/films/actions.ts`:

- `requireRole("admin", "editor")` for create/update. Editors are additionally constrained
  by both `created_by_user_id` and `status = 'draft'` in the read and conditional-update
  boundaries; an editor can never change another curator's record or save directly into a
  published row. Admins may edit any status.
- `requireRole("admin")` for publish/unpublish and delete.
- Publication changes use a compare-and-set boundary over the rendered status and
  `updated_at`. If an editor saves a draft after the admin loaded the queue, publishing
  fails closed and asks the admin to refresh and review the changed version.
- Public lookups always filter `status = 'published'`. The separate draft-preview lookup
  verifies the current session has the `editor` or `admin` role before it queries a draft;
  editors are limited to their own drafts, so unpublished team content cannot leak through
  page data or generated metadata.
- Middleware guards the `/admin/:path*` prefix (login redirect only); role checks happen in
  page guards, not middleware.

## 4. MVP features

1. **Cinematic home (`/`)** — 70svh editorial entrance built around the local
   `cinema-programmer-hero.png` image, a separate featured-film spotlight, indexed
   browse-by-category paths, recent additions, catalog stats, and a final catalog CTA.
   The programmer image is explicitly captioned as an editorial image and is never presented
   as a still from the featured film.
2. **Catalog (`/films`)** — full-text search (title, original title, synopsis), category
   filter chips, sort by newest/oldest year and A–Z title; result count + designed empty
   state.
3. **Film detail (`/films/[slug]`)** — original, locally owned category-level program
   artwork (explicitly labelled as neither an official poster nor a still), metadata
   (year, runtime, country, language, director), synopsis, category badges,
   lazy YouTube trailer (youtube-nocookie embed), related films (shared category),
   staff-only "manage" link and draft badge.
4. **Auth (`/login`, `/sign-up`)** — Neon Auth email+password; sign-up self-registers as
   viewer; staff sign-in redirect target is `/admin`.
5. **Admin overview (`/admin`)** — catalog stats (published, drafts, categories, media),
   recently updated list, draft publish queue for admins.
6. **Admin films table (`/admin/films`)** — Table with status Badges, GET search across
   title, original title, and director, row
   DropdownMenu (edit / publish / unpublish / delete with confirm Dialog).
7. **Film editor (`/admin/films/new`, `/admin/films/[id]/edit`)** — full metadata form,
   category-driven live program-art preview, legacy fallback seed, categories multi-select (toggle
   chips), trailer/clip/teaser URL list editor (add/remove/reorder) with live YouTube URL
   validation; zod client validation + server action re-validation + toasts.

## 5. Out of scope

Uploaded/hosted video, transcoding, WebRTC, streaming · user reviews/ratings/watchlists ·
playback tracking · multi-tenancy · payments · external poster/backdrop images or CDNs ·
public API · scheduled publishing · multi-language UI.

## 6. User journeys

- **Viewer browses**: lands on `/` → sees spotlight → clicks category strip → `/films?category=sci-fi`
  → opens film detail → watches embedded trailer → related film → repeat. No account.
- **Editor curates**: signs in → `/admin/films/new` → fills metadata, selects categories
  that drive the program-art preview, adds trailer URL (validated live) → saves as draft → previews via
  staff link on the detail page.
- **Admin publishes**: opens `/admin` draft queue → publishes → film appears in catalog.

## 7. Route map

| Route                     | Type   | Auth                    | Notes                                   |
| ------------------------- | ------ | ----------------------- | --------------------------------------- |
| `/`                       | public | –                       | home (site route group)                 |
| `/films`                  | public | –                       | catalog with `?q=&category=&sort=`      |
| `/films/[slug]`           | public | –                       | published only (staff may preview draft)|
| `/login`, `/sign-up`      | public | redirects staff → `/admin` | (auth) group                         |
| `/admin`                  | staff  | `requireRole(admin, editor)` | overview                           |
| `/admin/films`            | staff  | `requireRole(admin, editor)` | table + row actions; `?q=` search  |
| `/admin/films/new`        | staff  | `requireRole(admin, editor)` | create                             |
| `/admin/films/[id]/edit`  | staff  | `requireRole(admin, editor)` | edit                               |
| `/api/auth/[...path]`     | public | –                       | Neon Auth handler                       |

Loading (`loading.tsx`), empty and error (`error.tsx`, root `not-found.tsx`) states exist
for every list page; forms have inline field errors + sonner toasts.

## 8. Page states

- Loading: skeletons shaped like the real content (cards/table rows/hero).
- Empty: icon + heading + description + CTA (catalog no-results, admin no films, no
  categories).
- Error: root `error.tsx` "Something went wrong" + retry; 404 for unknown/draft films.
- Form states: submitting (disabled button + spinner label), inline zod field errors,
  success/error toasts, slug auto-generated from title (editable).
- If the category table is empty, the film editor shows a designed explanatory state and
  makes clear that the film can still be saved uncategorized.
- Draft films on the public detail route render a "Draft — staff preview" badge and are
  `noindex`; everyone else gets 404.

## 9. Data model

All tables snake_case, UUID PKs, timestamps. Located in `src/db/schema/`.

```
film
  id uuid pk
  slug text not null unique            -- public URL
  title text not null
  original_title text                  -- nullable (== title when unset)
  synopsis text not null
  year integer not null                -- 1888..2100
  runtime_minutes integer not null     -- 1..600
  country text not null
  language text not null
  director text not null
  palette_seed integer not null        -- legacy deterministic fallback when no category is selected
  status film_status enum('draft','published') not null default 'draft'
  created_by_user_id uuid not null     -- neon_auth user id (no cross-schema FK; enforced in code)
  created_at / updated_at timestamptz not null

film_category
  id uuid pk
  slug text not null unique
  name text not null
  description text not null
  created_at / updated_at timestamptz not null

film_film_category                     -- join, many-to-many
  film_id uuid not null → film.id (cascade)
  category_id uuid not null → film_category.id (cascade)
  unique (film_id, category_id)

film_media
  id uuid pk
  film_id uuid not null → film.id (cascade)
  kind film_media_kind enum('trailer','teaser','clip') not null default 'trailer'
  youtube_url text not null            -- stored normalized (https://www.youtube.com/watch?v=ID)
  position integer not null            -- 1..n ordering
  created_at / updated_at timestamptz not null

user_profile
  id uuid pk
  user_id uuid not null unique         -- neon_auth user id (no cross-schema FK; enforced in code)
  name text not null
  role user_role enum('viewer','editor','admin') not null default 'viewer'
  created_at / updated_at timestamptz not null
```

**Visibility decision**: draft/publish is the `film.status` enum column (per platform SDD
§7); no separate visibility table. One enum covers the lifecycle and queries filter on it.

## 10. Auth rules

- Neon Auth (managed Better Auth) via `@neondatabase/auth`; exact pattern from
  `docs/patterns/neon-app-setup.md` §3 (`createNeonAuth`, `auth.handler()` API route,
  `auth.middleware({ loginUrl: "/login" })`, `createAuthClient`).
- Session via `auth.getSession()` in a React `cache()`; guards `requireUser` /
  `requireRole(...roles)` in `lib/auth/session.ts`.
- Sign-up self-service creates the auth user and links a `viewer` profile (self-healed on
  sign-in). Editor/admin roles are granted by seed/DB only.
- Signed-in staff visiting `/login` or `/sign-up` are redirected to `/admin`.
- Cookies are HTTP-only, host-only. No secrets client-side; `.env.local` values never
  printed.

## 11. Authorization rules

See matrix in §3. Implementation notes:

- Public queries live in `features/films/queries.ts` and hard-filter published status.
  Category enrichment, media counts, and detail media re-check publication in the same
  SQL statement that reads each association, preventing an in-flight unpublish/edit from
  exposing draft-only categories or media.
  `getDraftFilmBySlugForStaff` verifies the current server session role before reading a
  draft; admin list/edit queries remain behind page-level `requireRole` guards.
- Detail pages use the published lookup first. Only verified staff can invoke the guarded
  draft lookup; everyone else gets `notFound()`. Verified staff also get a manage link on
  published detail pages.
- Mutations recompute role server-side on every call; client-sent role/ownership data is
  ignored. `created_by` is always the session user on create.

## 12. Validation rules (zod, client + server)

`lib/validation.ts`, zod v4. Server actions re-validate everything.

- Film: title 1–200; slug `^[a-z0-9]+(-[a-z0-9]+)*$` (3–120, unique — server checks DB);
  synopsis 20–6000; year 1888–2100 int; runtime 1–600; country/language/director 1–120;
  palette_seed int 0–35; original_title ≤200 optional; status in enum.
- Film identifiers accepted by update, status, and delete actions must parse as UUIDs
  before any database comparison.
- Categories: ≥0, ≤6 category ids (UUIDs); ids are re-validated against `film_category`
  server-side.
- Media: 0–10 items, each `{ kind: trailer|teaser|clip, youtubeUrl }`, positions assigned
  by array order; per-item inline errors.
- Auth: name 2–80, valid email, password ≥8.
- Auth forms run the same zod schemas before submission and server actions re-run them;
  both layers return per-field errors connected to their inputs.

### YouTube URL validation (server + client, single source of truth)

Accepted forms only:

1. `https://www.youtube.com/watch?v=VIDEO_ID`
2. `https://youtube.com/watch?v=VIDEO_ID`
3. `https://youtu.be/VIDEO_ID`

- `VIDEO_ID` = `^[A-Za-z0-9_-]{11}$` exactly. For `youtu.be`, the complete pathname must
  match `^/[A-Za-z0-9_-]{11}$`; extra path segments are rejected. Query params other than
  `v` are ignored.
  Watch paths like `/watch?v=…&list=…` are accepted (playlist param dropped); anything not
  matching the three forms (e.g. `youtube.com/embed/…`, `m.youtube.com`, `shorts/…`,
  `http://`, extra path) is rejected with a clear error message.
- Normalization: stored as `https://www.youtube.com/watch?v=ID`; iframe `src` uses the
  **embed** form `https://www.youtube-nocookie.com/embed/ID?rel=0` (privacy-enhanced mode),
  rendered `loading="lazy"`, `allowfullscreen`, `title` attribute set.

## 13. Error handling

- Server actions return typed state `{ ok?, error?, fieldErrors? }`; forms surface them
  inline and as toasts. Unexpected action errors become friendly toasts.
- `error.tsx` boundaries at root (and admin group) with retry; console logged.
- `not-found.tsx` at root; unknown slugs call `notFound()`.
- Seed/migrations fail loudly with non-zero exit; seed is idempotent (`onConflictDoNothing`
  / skip-if-populated; auth sign-up treats `USER_ALREADY_EXISTS` as success).

## 14. Brand and accessibility

### Brand implementation

- The approved 2026 Sodales identity in `docs/brand/website-guidelines.md` is the visual
  source of truth and supersedes the original amber product-accent direction.
- Cinema remains dark-first: shared chrome uses Obsidian Black `#111111`, Soft Ivory
  `#F4F2ED`, Graphite Gray `#35373B`, and Electric Violet `#5E4FB3`. Interactive text,
  controls, and focus rings on Obsidian use the accessible violet tint `#887BD8`.
- Public header/footer, auth, and admin use the shared `BrandWordmark` text lockup with the
  `Cinema` division. The protected geometric icon is not approximated.
- Inter is loaded through `next/font` for shared UI, metadata, forms, and operational copy.
  Instrument Serif is loaded through `next/font` for expressive editorial display headings
  and film titles. Uppercase, wide-tracked Inter labels keep the hierarchy legible.
- Cinema extends the parent palette with the approved dark editorial derivatives Deep Violet
  `#211C35` and Lilac Highlight `#B9AFE8`. Obsidian and Soft Ivory remain the dominant frame.
- Public navigation, forms, admin surfaces, and calls to action are flat, square-edged, and
  restrained. Film shelves emphasize program-art scale and typographic captions instead of
  generic rounded card grids. Six original local raster artworks correspond to Drama,
  Sci-Fi, Documentary, Animation, Horror, and Comedy. They contain no film titles, actors,
  characters, logos, or copied stills and are visibly labelled as Sodales category-level
  program artwork. A film's first category selects the image; `palette_seed` only provides
  a deterministic fallback for uncategorized legacy records.
- The locally generated programmer-room image features recurring ambassador MARA in focus with
  NICO as a background collaborator. It is atmosphere for Cinema itself, not film artwork. Its
  visible caption prevents it from being misread as a still from a catalog title.

### Accessibility

- Semantic landmarks (`header/main/nav/footer`), one `h1` per page, logical heading order.
- Labeled inputs (`Label`+`Input`, `aria-invalid`, stable error/help ids connected with
  `aria-describedby`); form and live media validation changes are announced; search inputs
  have `aria-label`; icon-only buttons have `aria-label`.
- Focus-visible rings from primitives; keyboard-operable menus/dialogs/tabs (Radix).
- Program-art labels use ≥4.5:1 contrast against a near-black scrim. Film titles remain real,
  semantic text beside the image and never become part of a misleading generated poster.
- Trailer iframe has a `title`; decorative gradients are `aria-hidden`.
- `aria-live="polite"` result counts on the catalog; `aria-busy` on loading skeletons.
- Honor `prefers-reduced-motion` (hover lift/scale transitions are subtle and
  motion-reduced safe: `motion-reduce:transition-none motion-reduce:hover:transform-none`).

## 15. SEO

- Root metadata: title template `%s | Sodales Cinema`, dark cinematic description.
- `generateMetadata` on film detail (title, description from synopsis, `openGraph`).
- Draft film metadata is returned only to verified staff and is `noindex, nofollow`.
  Unauthorized draft and unknown-slug metadata is generic and also `noindex, nofollow`.
- Clean slugs (`/films/<slug>`); catalog filters are plain GET params (crawlable links).
- The editorial programmer-room image and six category-level program artworks are local and
  app-owned. They use no external image CDN; catalog art is explicitly distinguished from
  official posters and stills.

## 16. Acceptance criteria

- [ ] `db:generate`, `db:migrate`, `db:seed` all succeed; re-running seed is safe.
- [ ] `node scripts/db-smoke.mjs cinema` passes (dev branch + neon_auth reachable).
- [ ] `pnpm --filter @sodales/cinema typecheck && lint && build` all green.
- [ ] Seed: ADMIN_EMAIL bootstrapped as `admin` via auth API (with `origin` header);
      demo editor + viewer exist; 12–14 published films across 5–6 categories with real
      metadata + working trailer URLs; 1–2 drafts.
- [ ] Public catalog shows only published films; draft never renders publicly.
- [ ] Public slug and metadata lookups hard-filter published status; only verified
      editors/admins can fetch draft preview data, and unauthorized metadata is generic/noindex.
- [ ] Search + category filter + sort work on `/films` (server-rendered).
- [ ] Admin film search uses GET `?q=` and searches title, original title, and director via
      parameterized Drizzle predicates.
- [ ] Trailer embeds use youtube-nocookie embed URLs derived from validated watch URLs.
- [ ] Editor can create/edit drafts but cannot publish/unpublish or delete (server-enforced).
- [ ] Admin can publish/unpublish/delete; changes reflect on the site after revalidation.
- [ ] `/admin/**` requires auth (middleware) + role (page guard); viewer gets redirected home.
- [ ] Loading/empty/error states present on all list pages and forms; toasts on mutations.
- [ ] Mobile responsive; keyboard navigable; landmarks + labels present.
- [ ] Shared chrome uses the approved Obsidian / Ivory / Graphite / Violet system; no amber
      remains in navigation, buttons, links, focus, brand lockups, auth, or admin chrome.
- [ ] Public header/footer, auth, and admin render `BrandWordmark` with the Cinema division.
- [ ] Shared UI uses Inter, editorial display uses Instrument Serif, and uppercase
      wide-tracked labels preserve the Sodales hierarchy.
- [ ] Violet controls and interactive text on Obsidian use `#887BD8` and meet WCAG AA.
- [ ] Film artwork remains visually expressive without leaking its palette into shared UI.
- [ ] The 70svh home masthead uses the local programmer-room image with a visible editorial
      caption; the image is not attributed to or presented as a still from any specific film.
- [ ] Public shelves, film details, auth, loading/error states, and admin surfaces share the
      square-edged Deep Violet / Lilac Highlight editorial system.

## 17. Test plan

- Automated (this repo's gates): typecheck, lint, build, db smoke.
- Unit-level: `parseYouTubeUrl` covered by table-driven checks in code review (accept the
  three documented forms and optional query parameters; reject embed, shorts, mobile host,
  HTTP, bad ids, and `youtu.be/<id>/extra`) — kept pure for future vitest.
- Manual/E2E checklist: viewer browse + search + detail + trailer; editor create→edit→
  staff-preview draft; admin publish→visible→unpublish→hidden; invalid YouTube URL shows
  inline error and is rejected server-side; viewer blocked from `/admin`; repeat seed run.

## 18. Deployment

- One Vercel project `sodales-cinema`, root dir `apps/cinema`, region `sin1`.
- Production env: `DATABASE_URL` (Neon main, pooled), `NEON_AUTH_*`, `ADMIN_EMAIL`,
  `NEON_AUTH_COOKIE_SECRET` (≥32 chars). Preview envs use PR Neon branches.
- Register production/preview domains with `neon neon-auth domain add` before traffic.
- Migrations run via `pnpm --filter @sodales/cinema db:migrate` against the target branch;
  seed is dev-only.

## 19. Open decisions

- OG/social card images (needs an image pipeline decision) — deferred.
- Rich text/markdown for synopses (plain paragraphs now) — deferred.
- Additional media kinds (featurette, scene) if curation demands — trivial enum addition.

## 20. Risks

- YouTube URL drift (new ID charset / extra domains) — validation is centralized in one
  module; loosen there only.
- Trailer availability/region blocks on YouTube — curated URLs point at official trailers;
  embed is lazy so a broken video cannot block page render.
- Neon Auth env/SDK drift — pinned `@neondatabase/auth` beta, pattern verified against
  docs (see platform SDD §15).
- Artwork provenance confusion — every catalog image is labelled `Program artwork` and
  its accessible name states that it is not an official poster or film still.

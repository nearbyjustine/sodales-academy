# 05 — Talents SDD

> App: **Sodales Talents** (`apps/talents`, dev port 3004) · Owner: Gav D. [B1]
> Neon project: `sodales-talents` (`weathered-salad-79846921`, aws-ap-southeast-1)
> Stack: Next.js 15 App Router · TypeScript · Tailwind v4 · `@sodales/ui` · Neon Postgres +
> Neon Auth · Drizzle ORM · zod v4
> Implementation contract: `docs/patterns/neon-app-setup.md` (followed exactly).

## 1. Purpose

A curated marketplace for freelance creative talent. Visitors browse an approved directory of
designers, developers, photographers, writers, videographers and musicians; each talent owns
exactly one public profile (headline, bio, skills, portfolio links); anyone can record a
project inquiry for an approved talent with the Sodales team; admins moderate profiles
(approve/hide with an audit trail), read the complete inquiries, and coordinate any follow-up.

## 2. Target users

- **Visitor** — anyone browsing the public directory without an account.
- **Talent** — a signed-up creative who maintains one profile and wants to be found.
- **Admin** — a Sodales team member who moderates the directory and reads inquiries.

## 3. Roles & authorization matrix

Roles live app-side in a `user_role` table keyed by the Neon Auth user id and are **always
resolved server-side** (`getRoleForUserId`), never from client state.

| Capability | Visitor | Talent | Admin |
| --- | --- | --- | --- |
| View home, directory, approved profile pages | ✅ | ✅ | ✅ |
| Submit inquiry (public form, honeypot-protected) | ✅ | ✅ | ✅ |
| Sign up (becomes talent) / sign in | ✅ | — | — |
| Edit **own** profile (fields, skills, links, slug) | ❌ | ✅ | ❌ |
| Submit own profile for review (`draft/hidden → pending`) | ❌ | ✅ | ❌ |
| Access `/admin/*`, approve/hide profiles | ❌ | ❌ | ✅ |
| View/triage all inquiries (new/read/archived) | ❌ | ❌ | ✅ |
| See draft/pending/hidden profiles on public routes | ❌ | ❌ | ❌ (admin sees them only inside `/admin`) |

Enforcement points:
- `middleware.ts` guards `/dashboard/:path*`, `/admin/:path*`, `/api/auth/:path*`
  (authentication only, redirects to `/login`).
- Page-level guards: admin pages call `requireRole("admin")`; dashboard pages call
  `requireRole("talent", "admin")` (admins may view but do not edit talent content).
- The edit page and both profile mutations call `requireRole("talent")`; the shared dashboard
  hides edit/review controls from admins. Every server action re-validates session + role +
  ownership before writing.
- Public queries filter `status = 'approved'` **in SQL**, so draft/pending/hidden profiles can
  never leak through a slug guess or a stale link (they render the app 404).

## 4. Features

### 4a. Public (visitor)

- **`/` marketing home** — a search-first editorial hero in the approved Direction 1
  (Kinetic Manifesto) family: large Manrope statement copy, restrained violet emphasis, and
  a bundled original studio photograph showing the recurring NICO and MARA ambassadors
  working with references, a tablet and material swatches. The
  hero search posts directly to `/talents`; secondary actions lead to the full directory and
  talent sign-up. Live proof follows as approved-talent/category/skill/city SQL counts;
  categories use an indexed editorial list rather than a generic card grid; featured talent
  profiles use proof-of-work-forward rows; "How it works" remains Browse → Inquire →
  Collaborate; the final join CTA uses a high-authority Obsidian band.
- **`/talents` directory** — search box (`q` matches display name, headline, bio, skills,
  location via SQL ILIKE over a joined subquery), a clear category filter rail that is sticky
  on desktop and horizontally scrollable on mobile (incl. "All"), result count with
  `aria-live`, and responsive 1/2-column editorial profile rows; designed empty state when
  nothing matches. Unknown category slugs are normalized out before the talent query, so the
  selected-filter UI, heading and results always describe the same dataset.
- **`/talents/[slug]` public profile** — deliberately type-led proof-of-work masthead with
  display name, headline, category, location, member-since and an
  always-visible inquiry action; About (bio), Skills, and prominent labelled `https://`
  portfolio links with external-link icons; **"Share project brief"** opens a polished
  Dialog that identifies Sodales team review before submission.
- **Inquiry Dialog** — sender name, email, message, hidden honeypot field; zod-validated in
  the public server action with inline field errors rendered next to each input (clients are
  never trusted; inputs also carry native `required`/type constraints); success state
  replaces the form; error alert + toasts; honeypot submissions are discarded with a fake
  success response so bots learn nothing. Success is labelled "Inquiry recorded" and says
  the team will coordinate by email if there is a fit; it never claims direct talent delivery.
- **`/login`, `/sign-up`** — public; a signed-in visitor is redirected to `/dashboard`.
  Sign-up is branded "Join as a talent": creates the `talent` role row **and** a `draft`
  profile automatically, then lands on `/dashboard`.

### 4b. Talent (authenticated)

- **`/dashboard`** — profile status card with the lifecycle CTA: `draft` → "Submit for
  review"; `pending` → "Under review" (disabled state, no CTA); `approved` → "View public
  page"; `hidden` → explanation + "Resubmit for review" (→ `pending`). Profile completeness
  checklist for every publication requirement (headline, bio, location, category, ≥1 skill)
  with check icons, an explanatory disabled submit state until all pass, and explicit copy
  that portfolio links are optional; quick stats cover skills, links and category.
- **`/dashboard/profile`** — edit display name, headline, bio, location, category (Select),
  public slug/username (server-checked for uniqueness, excluding the own profile), skills
  editor (add/remove/reorder up/down, 1–15, deduped), portfolio links editor (label + URL,
  0–8, `https://` enforced). One zod-validated server action saves everything in a
  transaction (replace skills/links rows); inline field errors + success toast. A material
  edit to an approved profile atomically unpublishes it and moves the changed version to
  `pending`; an edit to a pending submission atomically withdraws it to `draft`, requiring an
  explicit resubmission. This prevents stale review screens from publishing unseen edits.

### 4c. Admin

- **`/admin`** — sidebar layout per patterns doc §5; overview with stat cards (total
  profiles, pending review, approved, new inquiries), a "Pending review" queue panel with
  links into each full profile review, and a "Newest inquiries" panel linking into each full
  message.
- **`/admin/talents`** — table of **all** profiles (name, category, location, skills count,
  status Badge, updated) with status filter chips + category filter chips (URL params);
  every row links to `/admin/talents/[id]`, an admin-only full-profile preview containing the
  complete bio, skills, portfolio links, metadata and publication checklist. **Approve** is
  available only on that detail route for a complete `pending` profile; the server compares
  the reviewed `updatedAt` version, locks the row, and conditionally updates a still-pending
  row. **Hide** remains available for pending/approved profiles. Each moderation write
  inserts a `profile_moderation` audit row (action + moderator id; optional `note` remains
  supported by the action but is not collected by the MVP UI).
- **`/admin/inquiries`** — table of all inquiries (sender, talent, message excerpt, status
  Badge, received date) with status filter chips; every sender/row menu links to
  `/admin/inquiries/[id]`, where the full message and sender email are available with a
  labelled `mailto:` contact action. Row/detail actions mark **read** / **unread** and
  **archive** / **restore**.

## 5. User flows

1. **Join** — visitor clicks "Join as a talent" → `/sign-up` → account + `talent` role +
   `draft` profile → `/dashboard` status card → completes every required review item in
   `/dashboard/profile` → "Submit for review" → `pending`.
2. **Moderate** — admin filters `/admin/talents` by pending → opens the full internal preview
   → reviews all fields and the publication checklist → Approve → version/status
   compare-and-set + audit row → profile appears in the public directory. If the talent edits
   while a review screen is open, the edit returns the profile to `draft` and stale approval
   fails; an approved profile edit is unpublished and requeued as `pending`.
3. **Inquire** — visitor searches/filters the directory, opens a profile, submits the inquiry
   Dialog → persisted with status `new` → admin triages in `/admin/inquiries`
   (new → read → archived). The UI states clearly that the inquiry reaches the Sodales review
   team, not the talent directly; talent delivery/replies remain a v2 feature.
4. **Hide** — admin hides a profile → audit row → profile 404s publicly; talent sees the
   hidden explanation on `/dashboard` and can edit + resubmit (`pending` again).

## 6. Data model (Drizzle, snake_case, UUID PKs, `pgEnum` for statuses)

| Table | Columns |
| --- | --- |
| `user_role` | `id`, `user_id` (UNIQUE — Neon Auth user id; cross-schema FK impossible, enforced in code), `role` enum `talent\|admin`, `created_at`, `updated_at` |
| `talent_category` | `id`, `slug` UNIQUE, `name`, `description`, `created_at` |
| `talent_profile` | `id`, `user_id` UNIQUE (auth user), `slug` UNIQUE, `display_name`, `headline`, `bio`, `location`, `category_id` → `talent_category.id`, `status` enum `draft\|pending\|approved\|hidden` default `draft`, `created_at`, `updated_at` |
| `talent_skill` | `id`, `profile_id` → profile (cascade), `name`, `position`; UNIQUE (`profile_id`, `name`) |
| `talent_portfolio_link` | `id`, `profile_id` → profile (cascade), `label`, `url` (validated `https://` at the app layer), `position` |
| `inquiry` | `id`, `talent_profile_id` → profile (cascade), `sender_name`, `sender_email`, `message`, `status` enum `new\|read\|archived` default `new`, `created_at` |
| `profile_moderation` | `id`, `profile_id` → profile (cascade), `action` enum `approved\|hidden`, `note`, `moderator_user_id` (auth user), `created_at` |

## 7. Validation (zod v4, `src/lib/validation.ts`)

- **Inquiry**: `name` 2–80; `email` valid; `message` 20–2000; hidden `website` honeypot must
  be empty (non-empty ⇒ pretend success, discard).
- **Profile**: `displayName` 2–80; `headline` 10–120; `bio` 50–2000; `location` 2–80;
  `categoryId` uuid (must exist); `slug` `^[a-z0-9]+(-[a-z0-9]+)*$`, 3–60, unique
  (server-checked excluding own profile); `skills` 1–15 strings of 1–40 chars, deduped;
  `links` 0–8 × { label 1–60, url `z.url()` + must start with `https://` }.
- **Auth**: name 2–80, email, password ≥ 8.
- Clients are never trusted: every action re-parses with the same schemas and recomputes
  role/ownership per request. Forms surface the server-parsed field errors inline next to
  each input. Inquiry, profile and auth forms also run the same zod schemas client-side,
  link errors with `aria-describedby`, and retain native `required`/length/type/pattern
  constraints; the profile editor is a semantic HTML form.
- **Admin mutations**: profile/inquiry ids are UUIDs; moderation action and inquiry status are
  enums; optional moderation note is trimmed and capped at 1000 characters. Submission and
  approval both re-check headline, bio, location, a valid category and ≥1 skill on the
  server; portfolio remains optional. Approval also validates the reviewed timestamp and
  locks/conditionally updates the pending row. Every update checks its returned affected row
  before reporting success.

## 8. Auth implementation

Neon Auth via `@neondatabase/auth` exactly per patterns doc §3: `createNeonAuth` server
instance, `auth.handler()` API route at `/api/auth/[...path]`, middleware with
`loginUrl: "/login"`, `createAuthClient`, `useActionState` server actions, cached
`getSession` + `requireUser` / `requireRole` guards. Sign-up creates the `talent` role row +
draft profile (slug derived from the name, uniquified with a numeric suffix on conflict);
sign-in self-heals role/profile rows for out-of-band users **without ever overwriting an
existing `admin` role**. Provisioning prefers the auth response's user id, falls back to a
bounded lookup retry for replication lag, verifies the app role/profile, and redirects only
after those rows exist (admins intentionally require only their existing admin role).

## 9. Seed (`src/db/seed.ts`, idempotent)

1. **First-admin bootstrap** — POST `${NEON_AUTH_BASE_URL}/sign-up/email` with JSON
   `{ email: ADMIN_EMAIL, name: "Sodales Admin", password: "sodales-admin-2026!" }` and the
   **required `origin` header**; `USER_ALREADY_EXISTS` treated as success; other failures
   warn and continue. Then upsert `user_role(admin)` for that user id, promoting a stale
   talent role if necessary. Talent seed upserts never overwrite an existing admin role.
2. **Six demo talents** — `lena@`, `marco@`, `yuki@`, `priya@`, `tomas@`, `nadia@sodales.app`
   (password `sodales-demo-2026!`) with realistic profiles: Lena (Product Design), Marco
   (Full-stack Development), Yuki (Photography), Priya (Copywriting), Tomás (Video) —
   **pending** for moderation demo — Nadia (Music) — **hidden** with a historical
   `profile_moderation` row. Approved profiles carry headlines, bios (50+ chars), locations,
   5–7 skills, 2–3 `https://` portfolio links.
3. **Categories** — Design, Development, Photography, Writing, Video, Music (slug unique).
4. **Inquiries** — four across statuses (`new`, `read`, `archived`) against approved
   profiles, realistic sender names/emails/messages.
5. Every insert `ON CONFLICT DO NOTHING` / skip-if-populated; `ADMIN_EMAIL` and other env
   values are never printed;
   documented in the app README.

## 10. Design system

- The Canva-derived corporate identity contract in `docs/brand/website-guidelines.md` is the
  visual source of truth. Shared chrome uses Obsidian `#111111`, Soft Ivory `#F4F2ED`,
  Graphite `#35373B`, and Electric Violet `#5E4FB3`; the accessible violet tint `#887BD8`
  is used for interactive elements on Obsidian surfaces.
- Typography is loaded through `next/font/google`: Manrope is the Talents display face for
  expressive headings and large numerals; Inter remains the shared UI/body face for
  navigation, forms, tables, dialogs and dense controls. Display hierarchy is bold and
  tightly tracked; UI labels are uppercase at approximately 12px with wide tracking. No
  serif product chrome is introduced.
- Shared skeleton: sticky restrained header, `max-w-7xl` public composition, Obsidian footer with
  sibling links + © 2026 Sodales, and `<Toaster richColors position="top-right" />` in the
  root layout. Public header/footer, auth, and admin shells use the shared
  `BrandWordmark` lockup (`SODALES | TALENTS`) rather than an approximated icon.
- Surfaces are flat and precise with restrained borders, square/editorial image frames and
  minimal shadows. Primary actions, links, focus rings, and the Talents division signal use
  Electric Violet sparingly. Derived product tones `#DAD4F5`, `#8072D2`, and `#2A2440`
  support artwork and large product surfaces while corporate chrome stays on the four core
  brand colors.
- **Photography**: `/media/talents-studio-hero.png` is an original, locally bundled NICO and
  MARA asset with a human, documentary studio aesthetic. It is rendered with `next/image`, responsive
  `sizes`, a stable aspect ratio and meaningful alt text; there are no runtime image-CDN
  dependencies.
- **Profile artwork**: member surfaces are deliberately type-led until real, consented profile
  uploads exist; the product never invents portraits or faux identity assets. NICO and MARA
  appear only in the clearly editorial product hero, not as directory members.
- **Talent card**: editorial bordered row with display name, headline, category,
  up to 4 skills, location, and an explicit profile affordance; no generic elevated card
  grid or decorative gradient.
- **Directory filters**: sticky desktop rail + horizontal mobile rail, with current filter
  status expressed through text, border and color. Search stays the dominant interaction.
- **Product states**: auth, dashboard, profile editor, admin tables, skeletons, empty/error
  pages and dialogs share the same typography, flat bordered surfaces and Talents-derived
  supporting colors without changing their existing behavior.
- **Admin status colors**: approved = emerald, pending = amber
  (`outline` Badge + amber classes), hidden = `destructive`, draft = `secondary`.
- Buttons/links via shared `Button` (+ `asChild` where Radix Slot applies).

## 11. States & error handling

- `loading.tsx` skeletons for directory, profile detail, dashboard, dashboard profile, each
  admin list page, full admin profile review, and full inquiry detail. Every boundary exposes
  `aria-busy="true"` with a concise screen-reader loading announcement.
- Designed empty states (icon + heading + description + CTA): no search results, empty
  admin tables, empty dashboard states, no portfolio links.
- Root `error.tsx` ("Something went wrong" + retry) and `not-found.tsx`; non-approved slugs
  render the app 404.
- Every form: zod-validated server actions (re-parsed from raw input, clients never
  trusted), inline field errors, success/error toasts, disabled pending submit state
  (`useActionState` / `useFormStatus`).

## 12. Accessibility

Semantic landmarks (`header`/`main`/`nav`/`footer`) and one explicit `h1` on auth and content
pages; labelled inputs (`Label` + `Input`),
`aria-label`s on icon-only controls, honeypot field `aria-hidden` + `tabIndex={-1}` +
`autocomplete="off"`, focus-visible rings from the primitives, Radix keyboard navigation for
Dialog/DropdownMenu/Select, color contrast ≥ 4.5:1, status conveyed by text (Badge label),
result counts `aria-live="polite"`.

## 13. SEO

Root metadata template `%s | Sodales Talents`; per-page static metadata for public pages;
`generateMetadata` on `/talents/[slug]` (name + headline title, bio excerpt description,
`openGraph`); `robots: { index: false }` for dashboard and admin pages.

## 14. Acceptance criteria

- [ ] All routes from §4 exist and work end to end against the seeded dev branch.
- [ ] Public directory/profile queries return **only** `approved` profiles (SQL-level).
- [ ] Draft/pending/hidden slugs render the app 404 on public routes, including direct URLs.
- [ ] Talents can edit only their own profile (ownership re-checked in every action).
- [ ] Material approved-profile edits move to `pending` in the same transaction and disappear
      from public SQL queries; pending-profile edits move to `draft` and require resubmission.
- [ ] Submit/approve reject incomplete profiles; portfolio links remain optional.
- [ ] Admin approval is shown only for pending profiles and fails if status or `updatedAt`
      changed since the reviewed detail page rendered.
- [ ] Admins can inspect every profile field before approval and read/contact the sender from
      every inquiry detail page.
- [ ] Admin approve/hide writes a `profile_moderation` audit row each time.
- [ ] Inquiry persists with status `new`; honeypot submissions are discarded (fake success).
- [ ] Sign-up creates `talent` role + draft profile; admins are never demoted by sign-in.
- [ ] `db:generate` → `db:migrate` → `db:seed` all succeed and are idempotent (re-run safe).
- [ ] `node scripts/db-smoke.mjs talents` passes.
- [ ] `pnpm --filter @sodales/talents typecheck && lint && build` all green.
- [ ] Loading/empty/error states present; toasts on every mutation; a11y checklist §12 met.
- [ ] Public, auth, dashboard, and admin chrome uses only the approved corporate palette;
      focus states and primary actions use Electric Violet (or its accessible dark tint).
- [ ] Public header/footer, auth, and admin shells render `BrandWordmark` with the Talents
      division lockup; no geometric icon is approximated.
- [ ] Shared UI uses Inter while expressive headings and large numerals use Manrope; uppercase
      wide-tracked labels remain consistent and no serif product chrome appears.
- [ ] The bundled hero photograph is responsive, locally served and described with useful alt
      text; no external image host is required.
- [ ] Talents-derived colors remain subordinate to the approved corporate palette, and
      semantic status colors remain distinguishable by text labels as well as color.

## 15. Test plan

- CI: `lint` / `typecheck` / `build` per PR (Turborepo).
- Manual smoke (this build): seed → directory shows 4 approved talents only; search +
  category filters; profile page + inquiry submit (row appears as `new` in admin); open the
  complete inquiry and its sender contact action; honeypot submission discarded; sign-up →
  draft → incomplete submit blocked → edit → submit for review → admin full-profile review →
  approve → appears publicly; stale review approval rejected after a talent edit; approved
  edit immediately 404s publicly and returns to pending; hide → 404 publicly; inquiry triage
  actions; auth guards redirect anonymous `/dashboard` + `/admin` to `/login`; non-admin at
  `/admin` redirected home.
- Unit tests (validation schemas, role-guard logic) follow up per platform test plan.

## 16. Deployment

Vercel project `sodales-talents`, root dir `apps/talents`, region `sin1`; env `DATABASE_URL`
(pooled), `DATABASE_URL_UNPOOLED`, `NEON_AUTH_*`, `ADMIN_EMAIL` configured in Vercel only.
Migrations applied against the Neon dev branch during development, `main` branch in
production. Every public origin registered via `neon neon-auth domain add`.

## 17. Performance

Server components everywhere; SQL-level filtering + search (no client-side filtering);
aggregated subqueries for counts (skills/links/categories — no N+1s); featured profiles are
limited by SQL rather than truncated after retrieval; single pooled postgres
client (`prepare: false`, max 10); `revalidatePath` after mutations; session-aware header
forces dynamic rendering (accepted MVP tradeoff, consistent with the platform skeleton).

## 18. Security

Authorization always server-side (§3); ownership re-checked per action; public read paths
filter status in SQL; approved/pending edit transitions are atomic; approval uses a locked,
version-checked, pending-only update after server-side completeness validation. The only
public write (inquiry) is honeypot-protected and zod-validated with length limits; admin
mutation ids/statuses/notes are runtime-validated and affected rows are verified; no secrets
in client bundles; auth cookies HTTP-only + host-only managed by Neon Auth; no cross-app data
access; `.env.local` values never printed or committed.

## 19. Open decisions

- Booking/payment flow for commissioned work — out of MVP scope (needs its own SDD).
- Talent-facing inquiry inbox (currently admin-triaged only) — candidate for v2.
- Rich-text bios / avatar image uploads — deferred (no object storage in MVP).

## 20. Risks

- Neon Auth beta SDK drift — mitigated by following the verified patterns doc exactly.
- Inquiry spam — honeypot + validation + length limits now; rate limiting is a platform
  concern (deferred).
- Slug squatting/rename churn — slugs unique + pattern-validated; renames allowed but old
  URLs are not redirected in MVP (documented).

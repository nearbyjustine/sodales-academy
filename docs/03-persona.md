# 03 — Persona SDD

> App: `apps/persona` (port 3002) · Neon project `sodales-persona` (`delicate-hall-04722477`)
> Owner: Rem E. [B3] · Status: implemented per this SDD
> Contract: `docs/patterns/neon-app-setup.md` (implementation patterns), `docs/sdd/00-platform.md`
> (platform conventions), `docs/SODALES-IMPLEMENTATION.md` (master brief, Persona section).

## 1. Purpose

Persona is the personal-brand product of the Sodales collective: every member gets one
beautiful, shareable profile page — a personal card with their name, headline, bio,
skills, and links — plus a public directory where profiles can be discovered.
Individuals control their own card (draft → published, public → unlisted); a small
admin team curates the directory.

## 2. Target users

- **Visitors** (no account): browse the marketing home, search the public directory,
  open individual profile pages (including search engines via JSON-LD).
- **Members / profile owners** (authenticated): create and polish their own profile
  card, choose a gradient identity, manage skills and links, publish or unpublish.
- **Admins** (authenticated, `admin` role): see and moderate every profile, publish or
  hide any profile, flip public/unlisted visibility.

## 3. Roles and authorization matrix

Roles are stored on the `profile` row (`profile_role` enum: `profile_owner` | `admin`).
The `profile` table doubles as the app-role mapping table (platform SDD §7): one row per
Neon Auth user (`user_id` UNIQUE). Every authenticated user is a `profile_owner` for
their own row; `admin` is promoted by the seed bootstrap (`ADMIN_EMAIL`).

| Capability                                    | Visitor | profile_owner      | admin |
| --------------------------------------------- | ------- | ------------------ | ----- |
| View marketing home                           | ✅      | ✅                 | ✅    |
| View directory (published + public only)      | ✅      | ✅                 | ✅    |
| Open published + public profile               | ✅      | ✅                 | ✅    |
| Open published + unlisted profile (direct URL)| ✅ (noindex) | ✅            | ✅    |
| Open draft/unpublished profile                | ❌      | ✅ own only (preview banner) | ✅ (preview banner) |
| Edit a profile                                | ❌      | ✅ own only        | ❌ (uses admin tools instead) |
| Publish / unpublish own profile               | ❌      | ✅ own only        | ✅ any |
| Change visibility (public ↔ unlisted) of any profile | ❌ | ✅ own only     | ✅ any |
| List ALL profiles incl. drafts in admin table | ❌      | ❌                 | ✅    |
| Change a user's role                          | ❌      | ❌                 | ❌ (seed only, out of MVP) |

Enforcement is ALWAYS server-side: page guards (`requireUser`, `requireRole("admin")`)
plus data-access functions that never trust client-supplied user ids. Middleware protects
the `/dashboard` and `/admin` prefixes (authentication only); role checks happen in the
routes/actions.

## 4. MVP features

**Public (no auth)**
- Marketing home `/`: Direction 1-derived editorial split hero, locally stored ambassador
  imagery generated from the supplied identity sheets, live stats, an asymmetric
  three-profile showcase pulled from the directory, a dark profile-studio explainer,
  CTA to sign up, and sibling-app footer.
- Directory `/profiles`: editorial two-column field of published+public profile previews
  (member gradient signal, neutral profile icon, name, headline, location, top skills), search
  box matching name, headline, username and skills (`?q=`), designed empty state for no
  results.
- Profile page `/profiles/[username]`: gradient cover, large ring avatar, display-size
  name, headline, location, bio paragraphs, skills as level-chips, links as icon chips,
  JSON-LD `Person` schema, `generateMetadata` (title/description), indexable when
  public, `noindex` when unlisted, draft preview with banner for owner/admin.

**Authenticated (profile owner)**
- `/login`, `/sign-up` (public; signed-in users redirect to `/dashboard`).
- Dashboard `/dashboard`: profile status card (status + visibility badges, public URL
  with copy button, publish/unpublish toggle), completion checklist with progress
  (headline, bio, ≥3 skills, ≥1 link, location), "create your profile" journey state
  for blank profiles, admin shortcut for admins.
- Profile editor `/dashboard/profile`: two-column desktop layout — form (display name,
  headline, bio, location, gradient picker with swatches, username with live
  availability check, skills list editor with levels + reorder, links list editor) and
  a live preview card; publish/unpublish and public/unlisted controls; zod-validated
  server action with inline field errors + toasts. Publishing a draft is disabled while
  editable fields are dirty, so the previewed values cannot be mistaken for the saved
  values that will go live. Dirty tracking compares only a
  canonical snapshot of editable values (never status, visibility, or row ids) and
  resets after a successful save.

**Admin**
- `/admin` overview: counts (total / published / drafts / unlisted), quick links.
- `/admin/profiles`: table of ALL profiles (any status/visibility) with status and
  visibility Badges, search, and per-row DropdownMenu actions: view, publish, unpublish
  (hide), make unlisted, make public. Admin overview + table guarded by
  `requireRole("admin")`.

**States (everywhere)**
- `loading.tsx` skeletons for every list/detail/dashboard route.
- Designed empty states (no search results, blank profile, admin no-results).
- Root `error.tsx` ("Something went wrong" + retry) and `not-found.tsx`.
- Inline field errors + sonner toasts on every form; pending/disabled submit states.

## 5. Out of scope

Profile photos/uploads (neutral profile icons + gradients only), messaging/contact forms,
verification badges, multi-language, themes, analytics, role management UI, profile
deletion (admins only unpublish), following, comments, custom domains, CSS/HTML
customization of profile pages.

## 6. User journeys

1. **Visitor → member**: lands on `/`, clicks "Create your profile", signs up, is
   redirected to `/dashboard`, sees the blank-profile journey, opens the editor, fills
   the form, saves (toast), publishes, copies the public URL, shares it.
2. **Visitor → discovery**: opens `/profiles`, searches "design", opens Ava's card,
   reads her bio, clicks through to her GitHub from the link chips.
3. **Owner → polish**: signs in, dashboard shows completion checklist at 60%, edits
   profile, adds two skills, saves, dashboard shows 90%, publishes.
4. **Admin → curation**: signs in as admin, opens `/admin/profiles`, searches "leo",
   unpublishes an inappropriate profile via row actions, gets a toast, table refreshes.
5. **Search engine**: crawls `/profiles/ava-thompson`, reads `Person` JSON-LD + meta
   title/description; unlisted/draft profiles return 404 to crawlers (noindex/404).

## 7. Route map

| Route | Type | Access | Notes |
| --- | --- | --- | --- |
| `/` | public | all | marketing home |
| `/profiles` | public | all | directory, `?q=` search |
| `/profiles/[username]` | public | all (see matrix) | 404 unless visible; JSON-LD |
| `/login`, `/sign-up` | public | all | redirect to `/dashboard` when signed in |
| `/dashboard` | auth | profile_owner | status card + completion |
| `/dashboard/profile` | auth | profile_owner | editor |
| `/admin` | auth | admin | overview + stats |
| `/admin/profiles` | auth | admin | all profiles table |
| `/api/auth/[...path]` | handler | all | Neon Auth (Better Auth) route |

Middleware matcher: `/dashboard/:path*`, `/admin/:path*`, `/api/auth/:path*`.

## 8. Page states

- **Directory**: loading skeletons (card grid), results grid, "no profiles yet"
  empty state, "no results for q" empty state with clear-search action.
- **Profile page**: loading skeleton, full profile, draft preview banner (owner/admin),
  404 (notFound) for invisible profiles.
- **Dashboard**: loading skeleton, blank-profile journey (create CTA), status card +
  checklist, 100% "ready to share" state.
- **Editor**: loading skeleton, form + preview, per-field inline errors, saving
  pending state, success/error toasts.
- **Admin table**: loading skeleton, table with badges, empty state, action toasts.

## 9. Data model

```
profile                 (one row per Neon Auth user; role mapping table)
  id            uuid PK defaultRandom
  user_id       uuid NOT NULL UNIQUE        -- neon_auth."user".id (no FK cross-schema; enforced in code)
  username      text NOT NULL UNIQUE        -- slug: ^[a-z0-9]+(-[a-z0-9]+)*$, 3–30
  display_name  text NOT NULL               -- 2–80
  headline      text                        -- optional, ≤120
  bio           text                        -- optional, ≤2000, blank lines = paragraphs
  avatar_gradient text NOT NULL DEFAULT 'rose'   -- key into AVATAR_GRADIENTS
  location      text                        -- optional, ≤80
  role          profile_role NOT NULL DEFAULT 'profile_owner'  -- profile_owner | admin
  status        profile_status NOT NULL DEFAULT 'draft'        -- draft | published
  visibility    profile_visibility NOT NULL DEFAULT 'public'   -- public | unlisted
  created_at / updated_at timestamptz NOT NULL DEFAULT now()

profile_skill
  id          uuid PK defaultRandom
  profile_id  uuid NOT NULL REFERENCES profile(id) ON DELETE CASCADE
  name        text NOT NULL               -- 1–40
  level       skill_level NOT NULL DEFAULT 'intermediate'  -- beginner|intermediate|advanced|expert
  position    integer NOT NULL DEFAULT 0  -- manual order

profile_link
  id          uuid PK defaultRandom
  profile_id  uuid NOT NULL REFERENCES profile(id) ON DELETE CASCADE
  label       text NOT NULL               -- 1–40
  url         text NOT NULL               -- http(s) URL
  position    integer NOT NULL DEFAULT 0  -- manual order
```

Enums: `profile_role`, `profile_status` (draft|published), `profile_visibility`
(public|unlisted), `skill_level`. Draft/publish lifecycle is an enum column (platform
SDD §7). Migrations via drizzle-kit; seed idempotent (§"seed" in app README).

Gradient keys (`AVATAR_GRADIENTS` in `lib/constants.ts`): `rose`, `sunset`, `ocean`,
`forest`, `violet`, `candy`, `ember`, `midnight` — each maps to avatar + banner
gradient classes (Tailwind, no external images).

## 10. Auth rules

- Neon Auth (managed Better Auth) via `@neondatabase/auth` exactly per patterns doc §3:
  `createNeonAuth` server instance, `auth.handler()` route, `auth.middleware` with
  `loginUrl: "/login"`, `createAuthClient`, server-action sign-in/sign-up/sign-out.
- Sessions read with `auth.getSession()` (React-cached). Guards: `requireUser()`
  (redirect `/login`), `requireRole("admin")` (redirect `/` for non-admins).
- On sign-up the server action creates the profile row (auto username from the name
  with conflict suffix, role `profile_owner`, status `draft`). Sign-in self-heals the
  row for out-of-band users (same as Academy's `ensureProfile`).
- Role checks query `profile.role` server-side only. Cookies are HTTP-only,
  secure, host-only (never a shared parent domain).
- Login/sign-up pages redirect signed-in users to `/dashboard`.

## 11. Authorization rules

- **Own-profile only**: the editor and all owner actions derive `userId` from the
  session; client data never contains a user id. `saveProfileAction` updates
  `where profile.userId = session.user.id`.
- **Admin actions** (`setProfileStatusAction`, `setProfileVisibilityAction`) verify
  `requireRole("admin")` inside the server action before touching data.
- **Public reads** always filter `status = 'published'` (+ `visibility = 'public'` for
  the directory). Direct profile access: published+public → anyone; published+unlisted
  → anyone but `noindex`; draft → only owner or admin (with preview banner), others get
  404. Unpublished profiles are never in the directory, never in home cards, never in
  stats.
- Username changes must stay unique — enforced by the UNIQUE index; the action maps the
  DB error to a friendly message ("That username is already taken") and a live
  availability check calls a server action for instant feedback.

## 12. Validation rules

zod v4 schemas in `lib/validation.ts`, validated client-side (inline errors) and
re-validated in every server action:

- `signUpSchema`: name 2–80, valid email, password ≥8. `signInSchema`: email, password.
  Both auth forms run the shared zod schemas client-side for accessible per-field
  errors, then re-run them in the server actions before calling Neon Auth.
- `profileInputSchema`:
  - `displayName` 2–80; `headline` ≤120 (optional); `bio` ≤2000 (optional);
    `location` ≤80 (optional).
  - `username`: lowercase slug pattern `^[a-z0-9]+(-[a-z0-9]+)*$`, 3–30, not in
    `RESERVED_USERNAMES` (admin, api, dashboard, login, sign-up, profiles, public,
    _next, static, favicon.ico).
  - `avatarGradient`: one of the 8 gradient keys.
  - `skills`: 0–12 items; `name` 1–40; `level` enum; positions unique;
    names unique case-insensitive.
  - `links`: 0–8 items; `label` 1–40; `url` must be `http(s)://`; labels unique
    case-insensitive; positions unique.
- Server actions return `{ error?: string, fieldErrors?: Record<string,string> }`;
  first error also toasted client-side.

## 13. Error handling

- Root `error.tsx` with retry; `not-found.tsx` with back-to-home CTA.
- `notFound()` for unknown/invisible usernames; `redirect()` for guards.
- Server actions catch unique-violations on username → friendly field error; other
  failures return a generic message and are logged server-side (no internals leaked).
- Auth failures map to "Invalid email or password"; sign-up conflicts surface the
  provider message ("email already registered" style).
- All forms: inline Alert + field errors + `toast.error`; successes `toast.success`.

## 14. Brand system and accessibility

**Brand implementation**
- Corporate chrome uses only Obsidian `#111111`, Soft Ivory `#F4F2ED`, Graphite
  `#35373B`, and Electric Violet `#5E4FB3`, inherited from `@sodales/ui` tokens.
- Inter is loaded through `next/font` for navigation, controls, labels and body copy.
  Fraunces is loaded through `next/font` as Persona's expressive display face for large
  public/member story headings only; it never replaces Inter in shared product chrome.
- Display headings use Fraunces at expressive optical sizes with tight leading; UI labels
  stay uppercase, approximately 11–12px, and wide-tracked in Inter. Layouts use the
  approved Direction 1 family system: strong split compositions, asymmetrical editorial
  grids, generous negative space, precise rules, and flat surfaces instead of generic
  rounded card grids.
- Public header/footer, auth lockup, and desktop/mobile admin shells render the shared
  `BrandWordmark` as `SODALES | PERSONA`. No geometric icon is approximated.
- Electric Violet is reserved for primary actions, links, focus states, and division
  signals. Profile avatar/banner gradients remain expressive member content and are
  not used to theme navigation or shared controls.
- The locally stored `public/media/persona-hero-collective.png`, generated from the
  supplied NICO and MARA identity sheets, is the primary people-first image for the
  marketing and authentication experiences. It uses meaningful alt text, responsive
  `next/image` delivery, no third-party CDN, and no text baked into the asset. Profile
  imagery remains out of scope; member gradients and neutral profile icons stay the functional profile
  identity system.

**Accessibility**

- Semantic landmarks (header/nav/main/footer), one `h1` per page, section
  `aria-labelledby`.
- All inputs paired with `Label htmlFor`; skill/link rows have explicit accessible
  labels ("Skill 1 name", "Skill 1 level"); icon-only buttons carry `aria-label`.
- Keyboard: native focus rings from primitives; the gradient picker uses a native radio
  group; dropdown/dialogs are Radix (focus-trapped, Esc closes); reorder uses buttons
  (not drag-only).
- Gradient profile icons use the Lucide `UserRound` symbol with accessible naming and
  high-contrast white on dark 700–900 gradient stops; status is never encoded by color alone.
- `aria-live` polite on the username availability hint; search input labeled; forms
  announce errors via `role="alert"`.

## 15. SEO

- Root metadata: title template `%s | Sodales Persona`, default title + description,
  `metadataBase` https://persona.sodales.com.
- Public profile pages: `generateMetadata` (title = "Display Name — headline",
  description = headline/bio excerpt) and are **indexable** when published+public;
  **unlisted** pages render `robots: { index: false }` while staying reachable by
  direct link; draft pages 404 for crawlers.
- Profile page embeds JSON-LD `Person` (name, alternateName=username, description,
  jobTitle=headline, homeLocation, url, sameAs = link URLs, knowsAbout = skills).
  The JSON-LD serializer escapes `<`, `>`, `&`, U+2028, and U+2029 before insertion
  into the script element, so user-controlled content cannot terminate the script.
- `/dashboard/**`, `/admin/**`, `/login`, `/sign-up`: `robots: { index: false,
  follow: false }`. No external images/CDNs anywhere (OG uses no image or a plain card).

## 16. Acceptance criteria

- [ ] SDD matches the implementation (routes, tables, roles, states).
- [ ] `db:generate` / `db:migrate` / `db:seed` run clean; re-seeding is idempotent.
- [ ] `node scripts/db-smoke.mjs persona` passes (dev branch + neon_auth reachable).
- [ ] `pnpm --filter @sodales/persona typecheck && lint && build` all green.
- [ ] Seed creates admin (ADMIN_EMAIL, role admin), ava/noah/mia published profiles,
      1 draft profile (leo); demo accounts documented in README.
- [ ] Sign-up creates a draft profile; sign-in/sign-out work; middleware protects
      /dashboard and /admin.
- [ ] Owner can edit ONLY their own profile (server-enforced); username uniqueness
      enforced with friendly error + live availability check.
- [ ] A draft with unsaved edits cannot be published until the editor saves successfully;
      lifecycle authorization remains enforced by the server action.
- [ ] Owner can change their own profile between public and unlisted from the editor;
      the mutation derives ownership exclusively from the authenticated session.
- [ ] Directory shows only published+public; unlisted reachable by URL only, noindex;
      drafts 404 for public (owner/admin preview banner).
- [ ] Admin can publish/unpublish and flip visibility of any profile; non-admins
      redirected from /admin.
- [ ] JSON-LD Person + meta present on public profiles; dashboard/admin noindex.
- [ ] Loading skeletons, empty states, error.tsx, not-found.tsx present.
- [ ] Mobile-first responsive; keyboard navigable; labeled inputs.
- [ ] Shared chrome uses only the corporate Obsidian/Soft Ivory/Graphite/Electric
      Violet foundation; rose remains confined to member-selected avatar/banner art.
- [ ] Inter is active in shared chrome, controls and body copy; Fraunces is confined to
      expressive Persona story/display headings.
- [ ] Public header/footer, auth lockup, and desktop/mobile admin shell all use
      `BrandWordmark` with the Persona division lockup.
- [ ] Display hierarchy is expressive and tight, UI labels are uppercase/wide-tracked,
      layouts use flat editorial rules rather than generic rounded card grids, and
      decorative chrome gradients have been removed.
- [ ] The local collective hero image is responsive, preserves both ambassadors in its
      mobile framing, has meaningful alt text, and is visible on the marketing home and
      desktop auth experience.

## 17. Test plan

Manual/verification (MVP, no test runner in app):
1. Seed → db-smoke → confirm counts (4+ auth users, 5 profiles incl. 1 draft).
2. Anonymous: `/` renders cards; `/profiles` search "react" returns Noah; unknown
   username 404s; draft username 404s anonymously.
3. Sign up new user → dashboard journey → edit profile (invalid username taken error,
   gradient pick, skills/links add+remove+reorder) → save → publish → public URL
   resolves → unpublish → 404 anonymous.
4. Unlisted flow: owner flips their own visibility in the editor (or admin moderates
   it); anonymous direct URL works but page is noindex and absent from directory.
5. Admin: `/admin` guarded (member redirected); `/admin/profiles` shows drafts;
   publish/hide/unlist actions toast + refresh.
6. typecheck + lint + build green; keyboard-only pass over editor + admin table;
   mobile viewport pass (375px) over home/directory/profile/editor.

## 18. Deployment

One Vercel project `sodales-persona`, root directory `apps/persona`, region `sin1`.
Env vars: `DATABASE_URL` (Neon main, pooled), `DATABASE_URL_UNPOOLED`,
`NEON_BRANCH`, `NEON_AUTH_BASE_URL`, `NEON_AUTH_JWKS_URL`,
`NEON_AUTH_COOKIE_SECRET` (≥32 chars), `ADMIN_EMAIL`, and optional
`NEXT_PUBLIC_SITE_URL`. `.env.example` documents names only; secret values remain
in environment-specific configuration.
Register production/preview domains with `neon neon-auth domain add`. `main` branch of
the repo holds verified state; migrations applied via `db:migrate` against the target
branch before traffic. No production DNS until the base domain decision lands.

## 19. Open decisions

- Final base domain (blocks production DNS only).
- Custom themes/cover patterns per profile (post-MVP).
- Whether admins should eventually get full "hide with reason / audit log" (Talents
  has moderation records; Persona MVP keeps actions lightweight).

## 20. Risks

- Neon Auth SDK beta drift — mitigated by following the verified patterns doc exactly.
- Username squatting/trolling — mitigated by slug validation, reserved list, and admin
  moderation (unpublish).
- Unlisted URLs shared publicly lose their obscurity — documented tradeoff; noindex
  keeps them out of search.
- Seed sign-up API rate limits (HTTP 429) — seed treats as non-fatal and can be
  re-run idempotently.

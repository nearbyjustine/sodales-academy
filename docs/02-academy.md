# 02 — Academy SDD

> App: `apps/academy` (dev port 3001) · Neon project `sodales-academy` (`billowing-truth-71213443`)
> Owner: Justine C. [B7] · Status: implemented (this document matches the code 1:1)

## 1. Purpose

Sodales Academy is the learning product of the Sodales collective: a focused online academy where
anyone can browse a curated catalog of courses, enroll for free, and learn through a distraction-free
lesson player with progress tracking. Instructors and admins manage the catalog through a clean
admin panel with a full draft → publish lifecycle.

## 2. Target users

- **Visitors** — discovering the catalog, reading course outlines and free preview lessons.
- **Learners** — enrolled users tracking progress across their courses.
- **Instructors** — subject-matter authors who create and maintain their own courses.
- **Admins** — the Sodales team; full control of all courses and catalog quality.

## 3. Roles and authorization matrix

Roles: `learner`, `instructor`, `admin` (stored on `user_profile.role`; anonymous visitors have no role).

| Capability                                          | Anonymous | Learner | Instructor | Admin |
| --------------------------------------------------- | --------- | ------- | ---------- | ----- |
| Browse catalog, search, filter, view course detail  | Y         | Y       | Y          | Y     |
| See preview badges / preview lesson titles in outlines | Y      | Y       | Y          | Y     |
| Sign up (defaults to `learner`) / sign in           | Y         | Y       | Y          | Y     |
| Read preview lessons in the player (`is_preview`)   | N (sign-in) | Y (no enrollment needed) | Y | Y |
| Enroll in a published course                        | N (login) | Y       | Y          | Y     |
| Open `/dashboard`                                   | N         | Y       | Y          | Y     |
| Read non-preview lessons of enrolled courses        | N         | enrolled only | enrolled only | Y |
| Complete / uncomplete lessons (enrolled courses)    | N         | enrolled only | enrolled only | Y |
| Open `/admin`                                       | N         | N       | Y          | Y     |
| Create courses                                      | N         | N       | Y (own)    | Y     |
| Edit / publish / unpublish / delete own courses     | N         | N       | Y (own)    | Y (all) |
| Assign course instructor                            | N         | N       | N (self)   | Y (any instructor/admin) |

Enforcement: middleware guards `/dashboard` and `/admin` prefixes (auth only); **all** role and
ownership checks run server-side in `lib/auth/session.ts` guards and the data-access layer.
Instructors can never read or write another instructor's course; learners can never read a
non-preview lesson of a course they are not enrolled in.

## 4. MVP features

### Public
- Marketing home: Direction 1 editorial split hero on Soft Ivory, locally stored NICO/MARA
  studio imagery generated from the supplied identity sheets, live catalog stats, a dark
  selected-learning edit, indexed learning tracks, CTA, and footer with sibling links.
- Catalog `/courses`: full-text-ish search (title/description ILIKE), level filter
  (all/beginner/intermediate/advanced), responsive 1/2/3-col course grid, result counts, empty state.
- Course detail `/courses/[slug]`: header (level badge, category, instructor, stats), description,
  module/lesson outline with preview badges and lesson counts, persistent full-row links for every
  openable lesson (including touch layouts), enroll CTA or "Continue learning".
- Preview lesson reading: preview lessons open in the player for any signed-in user without
  enrollment (banner + enroll CTA); anonymous visitors are redirected to sign in first.
- `/login`, `/sign-up` (Neon Auth email/password; sign-up assigns the `learner` role).

### Authenticated (learner)
- `/dashboard`: "My courses" with per-course progress bars, next-lesson cards, empty state.
- `/learn/[courseSlug]/[lessonSlug]`: focused reading layout (max-w-3xl), sticky course outline
  sidebar (desktop), completed-lesson checkmarks, "Mark complete" toggle, prev/next navigation,
  progress header. Enrollment is verified server-side on every request.

### Instructor + admin (`/admin`)
- Overview: stat cards (published, drafts, enrollments, learners) + quick actions.
- `/admin/courses`: Table with status badges (draft = muted, published = emerald), level,
  lesson counts, row `DropdownMenu` (edit, publish/unpublish, delete with confirm dialog).
- `/admin/courses/new`, `/admin/courses/[id]/edit`: full course form (title, slug, description,
  category, level) + modules/lessons editor (add/remove modules and lessons, reorder, per-lesson
  `is_preview`, markdown-ish plain-text content), zod validation client + server, toasts.

## 5. Out of scope

Video hosting, payments/pricing, certificates, quizzes/assignments, comments/Discussions,
email notifications, media uploads, instructor onboarding flow, admin user management UI,
multi-tenancy, cross-app anything. (Deferred per master brief; new SDDs required.)

## 6. User journeys

1. **Discover → enroll → learn**: visitor browses `/courses`, filters to beginner, opens a course,
   sees its preview lesson, creates a free account to read it, enrolls, completes lessons across sessions
   (progress persists), finishes the course.
2. **Returning learner**: signs in → lands on `/dashboard` → clicks "Continue" on a next-lesson
   card → completes the lesson → uses prev/next to keep going.
3. **Instructor**: signs in → `/admin` → creates a draft course with modules/lessons → publishes →
   course appears in the catalog instantly.
4. **Admin**: signs in → `/admin/courses` → edits any course, reassigns instructor, unpublishes
   a draft-quality course, deletes an obsolete one.

## 7. Route map

| Route | Group | Access | Notes |
| ----- | ----- | ------ | ----- |
| `/` | (site) | public | marketing home |
| `/courses` | (site) | public | `?q=` + `?level=` searchParams |
| `/courses/[slug]` | (site) | public | 404 for unknown/draft slugs (draft visible to admin/owner) |
| `/login`, `/sign-up` | (auth) | public | redirects to `/dashboard` if already signed in |
| `/dashboard` | (site) | auth (middleware) | learner home |
| `/learn/[courseSlug]/[lessonSlug]` | (learn) | auth (middleware) + page guard | preview lessons open for any signed-in user; non-preview requires enrollment/ownership |
| `/admin`, `/admin/courses`, `/admin/courses/new`, `/admin/courses/[id]/edit` | (admin) | instructor/admin (middleware + `requireRole`) | |
| `/api/auth/[...path]` | — | public | Neon Auth handler |
| middleware matcher | — | — | `/dashboard/:path*`, `/admin/:path*`, `/learn/:path*`, `/api/auth/:path*` |

Middleware enforces *authentication* on guarded prefixes; the lesson page guard then enforces
*authorization*: any signed-in user may read preview lessons without enrolling, while non-preview
lessons require enrollment (admins and the course's instructor may always read).

## 8. Page states

- **Loading**: `loading.tsx` skeletons for home, catalog, detail, dashboard, learn, admin list.
- **Empty**: designed empty states (icon + heading + description + CTA) for catalog results,
  dashboard enrollments, admin course list.
- **Error**: root `error.tsx` ("Something went wrong" + retry) + `not-found.tsx`.
- **Forms**: inline field errors (client zod), server re-validation, submitting/pending button
  states, success/error toasts (sonner).
- **Auth forms**: server error banner on invalid credentials; pending state on submit.
- **Lesson player**: completed/incomplete toggle state, preview banner, enrollment gate message.

### Brand design system

- Corporate chrome follows `docs/brand/website-guidelines.md`: Obsidian Black `#111111`, Soft
  Ivory `#F4F2ED`, Graphite Gray `#35373B`, and Electric Violet `#5E4FB3`.
- Academy extends the parent system with education-specific, accessible tones: deep ink `#211C35`,
  pale lilac `#DED9EF`, and paper `#FBFAF7`. Electric Violet remains the only primary-action color.
- Inter is loaded through `next/font/google` for navigation, labels, controls and product UI.
  Source Serif 4 is applied explicitly through `.academy-display` to public/auth editorial
  headings, public course titles and long-form lesson copy; admin and dashboard headings,
  controls, card titles and shared chrome remain Inter.
- The public header and footer, authentication lockup, lesson chrome, and desktop/mobile admin
  shell use the shared text-only `BrandWordmark` with the `SODALES | ACADEMY` product lockup.
- Navigation, form labels, table headings, and section eyebrows use restrained uppercase,
  approximately 11–12px labels with wide tracking. Layouts use flat paper-like surfaces, precise
  rules, square or minimally rounded controls, generous negative space, and reduced-motion-safe
  transitions. Public course discovery uses indexed editorial rows rather than a generic card grid.
- The local image `public/media/academy-hero-learning-studio.png` is the primary Academy art asset.
  It depicts the recurring NICO and MARA ambassadors learning through hands-on collaborative work, is
  rendered through `next/image`, and includes descriptive alt text. It appears in the public split
  hero and authentication story panel; course content remains typographic until dedicated course
  art exists.
- The authenticated dashboard uses progress-led editorial rows, lesson reading uses a focused
  paper-and-ink composition, and admin routes retain dense utility while sharing the same type,
  border, spacing and color language. Auth, loading, empty, error and 404 states use the same system.

## 9. Data model

All tables UUID PKs, snake_case, timestamps on mutable tables. Auth users live in
`neon_auth."user"` (no FK possible cross-schema — enforced in code).

| Table | Columns | Notes |
| ----- | ------- | ----- |
| `user_profile` | `id`, `user_id` (unique, NOT NULL), `name` (NOT NULL), `role` enum `user_role` default `learner`, `created_at`, `updated_at` | one row per auth user |
| `course` | `id`, `slug` (unique NOT NULL), `title` (NOT NULL), `description` (NOT NULL), `category` (NOT NULL), `level` enum `course_level` NOT NULL, `status` enum `course_status` default `draft` NOT NULL, `instructor_user_id` (uuid NOT NULL), `created_at`, `updated_at` | `instructor_user_id` = auth user id |
| `course_module` | `id`, `course_id` → course CASCADE, `title` (NOT NULL), `position` (int NOT NULL), `created_at`, `updated_at` | ordered by position |
| `lesson` | `id`, `module_id` → course_module CASCADE, `course_id` → course CASCADE, `slug` (NOT NULL), `title` (NOT NULL), `content` (text NOT NULL), `position` (int NOT NULL), `is_preview` (bool default false), `created_at`, `updated_at` | `unique(course_id, slug)` — slug unique per course |
| `enrollment` | `id`, `course_id` → course CASCADE, `user_id` (uuid NOT NULL), `enrolled_at` default now | `unique(course_id, user_id)` |
| `lesson_progress` | `id`, `lesson_id` → lesson CASCADE, `user_id` (uuid NOT NULL), `completed_at` default now | `unique(lesson_id, user_id)` |

Enums: `user_role` (`learner`,`instructor`,`admin`), `course_level` (`beginner`,`intermediate`,`advanced`),
`course_status` (`draft`,`published`).

## 10. Auth rules

- Neon Auth (managed Better Auth) via `@neondatabase/auth` exactly per `docs/patterns/neon-app-setup.md` §3.
- `src/lib/auth/server.ts` `createNeonAuth`; handler at `/api/auth/[...path]`; middleware from the same instance.
- Session helpers: `getSession` (React-cached), `requireUser` (redirect `/login`), `requireRole(...roles)`
  (redirect `/` when role missing) + `getRoleForUserId` reading `user_profile`.
- Sign-up creates the auth user **and** a `user_profile` row with role `learner` (server action),
  preferring the auth response's user id and otherwise using a bounded lookup retry. It reports
  an explicit setup failure instead of redirecting without a profile.
- Signed-in users visiting `/login` or `/sign-up` are redirected to `/dashboard`.
- Sign out via server action; admin layout and site header expose it.
- First admin: seed script signs up `ADMIN_EMAIL` via `POST $NEON_AUTH_BASE_URL/sign-up/email`
  (HTTP 422/400 `USER_ALREADY_EXISTS` treated as success) and upserts its profile as `admin`.

## 11. Authorization rules

- Middleware handles *authentication* for guarded prefixes; *authorization* always happens
  server-side after it, in `features/**/queries.ts` and `actions.ts`.
- Course management has one invariant everywhere: an admin may manage any course; an instructor
  may manage only a course whose `instructor_user_id` is their own user id. Draft visibility,
  edit, publish/unpublish, delete, and lesson access all use this same rule.
- Every admin mutation requires the `admin` or `instructor` role and calls
  `assertCanManageCourse(courseId, viewer)` before writing.
- Lesson reads first select metadata only and resolve published/draft visibility, role, ownership,
  preview status, and enrollment. `lesson.content` is selected in a separate query only after
  access is granted; inaccessible lesson metadata is generic and `noindex`.
- Enroll + progress mutations verify enrollment/role server-side; `onConflictDoNothing` keeps
  replays safe.

## 12. Validation rules

Zod v4 schemas in `src/lib/validation.ts` shared by client and server:

- `signUpSchema`: name 2–80, email, password ≥ 8. `signInSchema`: email + password required.
- `courseInputSchema`: title 3–120; slug `^[a-z0-9]+(-[a-z0-9]+)*$` 3–100; description 20–2 000;
  category from fixed list; level enum; instructorUserId uuid (admin only — server overwrites with
  session user id for instructors); modules 1–12, each title 3–100 + position int 1..999;
  lessons 1–30 per module, title 3–120, slug (same pattern), content ≥ 50 chars, position int,
  `isPreview` bool. Super-refinements: unique module positions, unique lesson slugs per course,
  unique lesson positions per module.
- Slug conflicts with *other* courses are rejected server-side (DB unique constraint as backstop).
- Server actions never trust client roles/ownership; they re-derive from the session.

## 13. Error handling

- Unknown course/lesson slugs → `notFound()` (404 page).
- Forbidden role/ownership in pages → `redirect("/")`; in actions → thrown error converted to
  `{ ok: false, message }` results surfaced as error toasts.
- Zod failures in actions → first issue's message returned to the client (inline + toast).
- DB unique violations on slug → friendly "Slug already in use" field error.
- `error.tsx` renders a retry affordance; `middleware.ts` handles expired sessions cleanly.

## 14. Accessibility

Semantic landmarks (`header`/`nav`/`main`/`footer`), one `h1` per page, labeled inputs via
`Label`, focus-visible rings from primitives, keyboard-navigable menus/dialogs, `aria-current`
for active nav, sufficient contrast (Electric Violet `#5E4FB3` on Soft Ivory for linked text;
Soft Ivory on Electric Violet for filled actions), icons with
`aria-hidden` + text labels, loading skeletons with `aria-busy` regions, progress bars with
`role="progressbar"` + `aria-valuenow`.

## 15. SEO

Root metadata template `%s | Sodales Academy`; per-page titles/descriptions;
`generateMetadata` on course detail (title + description from an authorization-aware query);
inaccessible courses/lessons use generic metadata with `noindex`; authenticated lesson pages
never derive descriptions from protected lesson content. Public marketing pages render statically
where possible (catalog is dynamic due to searchParams); imagery is bundled locally and no
external image host or runtime CDN dependency is required.

## 16. Acceptance criteria

- [ ] `db:generate` → `db:migrate` → `db:seed` run green and are idempotent (re-run safe).
- [ ] `node scripts/db-smoke.mjs academy` passes; seeded courses/users present.
- [ ] typecheck, lint, build all green via the WSL wrapper.
- [ ] Anonymous users can browse/search/filter catalog and view course details/preview titles;
      openable lesson rows remain visibly actionable on touch layouts, and a free signed-in
      account can open preview lessons without enrollment.
- [ ] Sign-up creates a learner; learner can enroll and complete lessons; progress bars update.
- [ ] `/dashboard` and `/admin` redirect anonymous → `/login`; learner hitting `/admin` → `/`.
- [ ] Instructor sees only own courses in `/admin` and cannot mutate others (server-enforced).
- [ ] Admin manages all courses; publish/unpublish reflects instantly in the catalog.
- [ ] Every list/form has loading, empty, error, and success states.
- [ ] Mobile-responsive across all pages; local optimized imagery only, with no external image CDN.
- [ ] Public/auth/admin/lesson chrome matches the approved brand system and uses the shared
      `BrandWordmark`; Academy typography uses Source Serif 4 for editorial display/reading and
      Inter for UI, while all primary interaction color remains Electric Violet.

## 17. Test plan

- **Static**: `typecheck` + `lint` + `build` (CI parity) via WSL wrapper.
- **Data**: `db-smoke.mjs`; seed idempotency (run seed twice, row counts stable); unique-constraint
  checks (duplicate slug, duplicate enrollment).
- **Auth/authorization (manual, documented)**: anonymous redirects; learner blocked from admin;
  instructor scoping; enrollment gate on non-preview lessons; preview lesson access after free
  sign-in; admin complete/uncomplete access; draft and inaccessible-route metadata remains generic.
- **UI flows (manual)**: sign-up → enroll → complete → dashboard progress; create → publish →
  catalog appears; edit lessons; delete with confirm; toasts on every mutation.

## 18. Deployment

Vercel project `sodales-academy` (root dir `apps/academy`), region `sin1`; production env vars
`DATABASE_URL` (Neon main), `NEON_AUTH_BASE_URL`, `NEON_AUTH_COOKIE_SECRET`, `ADMIN_EMAIL`;
register production/preview domains with `neon neon-auth domain add`; migrations applied via
`db:migrate` against main before first deploy.

## 19. Open decisions

- Rich-text/markdown lesson rendering (current MVP: structured plain-text paragraphs).
- Course pricing / paid enrollments (needs payment SDD per master brief).
- Dedicated course imagery per category (current release uses one authored Academy studio image
  plus typographic course rows to avoid repetitive or decorative placeholder art).
- Instructor application flow (instructors are provisioned by admins via seed today).

## 20. Risks

- Neon Auth SDK is beta — pin behavior to `docs/patterns/neon-app-setup.md`; verify at wiring time.
- Slug collisions across courses rely on DB unique index + server validation (mitigated).
- Instructor-owned content without review workflow (mitigated by admin publish control).
- Seed content volume must stay idempotent and fast (mitigated: `onConflictDoNothing` everywhere).

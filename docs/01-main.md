# 01 — Main Portfolio SDD (`apps/main`)

> Owner: Gale T. [B6] · Port 3000 · No database, no auth for the MVP · Status: built to this spec.
> Platform-wide conventions live in `00-platform.md`; implementation contract in
> `docs/patterns/neon-app-setup.md` §5–§6 (DB/auth sections do not apply to this app).

## 1. Purpose

`sodales.com` — the public face of the Sodales collective. It presents the studio, its services,
and selected case studies, routes visitors into the five sibling products, and converts
prospective clients through a contact form. It is also the **visual reference app** for the
family: the approved **Kinetic Manifesto** direction combines an oversized Syne display
hierarchy, generous whitespace, precise editorial rules, and authored motion with restrained
corporate chrome. The other apps echo its confidence while retaining industry-specific media.

## 2. Target users

- Prospective clients (founders, marketing leads, product owners) evaluating the studio.
- Peer/press visitors checking credibility and past work.
- Sodales team members pointing people at the portfolio and sibling products.

## 3. Roles

Public only. No accounts, no roles, no admin surface. (A future CMS/admin is out of scope until
there is a database.)

## 4. MVP features

1. **Homepage** — split manifesto hero with the member-made brand film, sibling-products
   roster, featured case studies, services teaser, CTA band.
2. **Work index** (`/work`) — all case studies in an editorial media-led archive.
3. **Case study detail** (`/work/[slug]`) — authored media when available (gradient identity
   fallback), challenge/approach/outcome, outcome stats, next-project navigation.
4. **Services** (`/services`) — five services with deliverables and engagement notes.
5. **About** (`/about`) — studio story, values, team, way of working.
6. **Contact** (`/contact`) — server-action form with inline validation, honest delivery states,
   mailto fallback.
7. **Designed system states** — `loading.tsx` skeletons, `error.tsx` retry, `not-found.tsx`,
   per-page SEO metadata, `sitemap.ts`, `robots.ts`.

## 5. Out of scope (MVP)

Database/CMS, auth, admin, blog/journal, search, comments, analytics dashboards, i18n, dark
theme toggle (light-first editorial), file uploads, payment of any kind.

## 6. User journeys

- **Prospective client**: lands on `/` → scans featured work → opens a case study → `/services`
  → `/contact` → submits brief → sees success (or mailto fallback) → receives reply by email.
- **Curiosity visitor**: `/` → sibling products strip → `academy.sodales.com` etc. (external).
- **Lost visitor**: any bad URL → designed 404 with route back into Work/Contact.

## 7. Route map

| Route          | Type            | Rendering | Notes                                    |
| -------------- | --------------- | --------- | ---------------------------------------- |
| `/`            | page            | static    | hero, siblings, featured work, services, CTA |
| `/work`        | page            | static    | all case studies                          |
| `/work/[slug]` | page            | static    | `generateStaticParams`; unknown slug → 404 |
| `/services`    | page            | static    | service detail + engagement models        |
| `/about`       | page            | static    | story, values, team                       |
| `/contact`     | page + form     | static shell | client form + server action            |
| `/sitemap.xml` | generated       | static    | all routes + case-study slugs             |
| `/robots.txt`  | generated       | static    | allow all, sitemap pointer                |

## 8. Page-by-page states

- **All pages**: root `loading.tsx` (skeleton hero + card rows); root `error.tsx` ("Something
  went wrong" + Try again + Home); `not-found.tsx` (designed 404). Content is compile-time
  static, so runtime empty/error states are not applicable on content pages — noted deliberately.
- **Contact form (the one stateful surface)**:
  - idle: labeled fields, helper text, submit button "Send message".
  - submitting: button disabled with spinner (pending from `useActionState`).
  - field errors: inline `role="alert"` messages under name/email/message; values preserved.
  - success: form replaced by success panel (check icon, "Message sent", what-happens-next).
  - unconfigured: honest panel — "Messaging isn't configured on this deployment" + mailto link
    prefilled with the typed subject/body. **Never fakes success.**
  - delivery error: panel with warning icon + mailto fallback; values preserved.
  - honeypot field: silently reported as success to bots without sending.

## 9. Content model (`src/content/`, static typed TS)

```ts
type GlyphKey = "compass" | "hexagon" | "layers" | "feather" | "chart" | "film" | "palette"
  | "code" | "bag" | "pen" | "cap" | "users" | "sparkles";

type CaseStudy = {
  slug: string; title: string; client: string; sector: string; year: number;
  projectType: "Internal project" | "Concept study";
  role: string; disciplines: string[]; summary: string; featured: boolean;
  challenge: string; approach: string; outcome: string;
  outcomeStats: { label: string; value: string }[];
  gradient: { from: string; to: string };   // fallback when authored media is absent
  glyph: GlyphKey;
  media?: { hero: string; alt: string; video?: string;
            process?: { src: string; alt: string; caption: string } };
};

type Service   = { slug: string; name: string; tagline: string; description: string;
                   deliverables: string[]; glyph: GlyphKey };
type TeamMember= { name: string; role: string; bio: string; initials: string; focus: string[] };
type Sibling   = { name: string; href: string; blurb: string; glyph: GlyphKey };
```

Seven studies ship: the team-authored Sodales Motion System plus six explicitly labelled fictional
concept briefs—Meridian Atlas, Loop & Ledger, Fieldnote, Copper & Crate, Northlight Festival, and
Verra Health. The motion study uses the supplied film and storyboard; every concept study has
original, production-owned editorial imagery with its distinct gradient retained as a robust
fallback. Concepts never claim client launches or performance metrics; their fact panels describe
only the illustrative scope or design target. Team of four including Gale T. as principal. All
copy lives in code; editing content = editing one module.

## 10. Validation rules (contact form, `src/lib/validation.ts`)

| Field   | Rule                                                        |
| ------- | ----------------------------------------------------------- |
| name    | required, trimmed, 2–80 chars                               |
| email   | required, RFC-ish pattern `x@y.z`, ≤ 160 chars              |
| company | optional, ≤ 120 chars                                       |
| budget  | optional, one of: "", "<10k", "10-25k", "25-75k", "75k+", "unsure" |
| message | required, trimmed, 20–2000 chars                            |
| website | honeypot — must stay empty                                  |

Errors return per-field messages; the server action re-validates everything (client messages
are convenience, not security). **Deviation note:** `zod` is not installed for `apps/main`
(pnpm workspace isolation; `pnpm install` is prohibited in this phase), so validation is a
small app-local composable validator with the same rules and a zod-like `safeParse` shape;
swapping in zod later is a drop-in change to one file.

## 11. Error handling

- Form: every failure path returns a typed state (`success | error | unconfigured`), never
  throws to the client; unknown failures surface as honest error panels with a mailto fallback.
- Resend integration: only runs when `RESEND_API_KEY` exists; non-2xx or fetch throw → `error`
  state (logged server-side, no secret leakage, no fake success).
- Routing: unknown case-study slug → `notFound()`; everything else static.
- `error.tsx` is a client boundary offering `reset()`.

## 12. Accessibility

Semantic landmarks (`header/nav/main/footer`), one `h1` per page, ordered heading levels,
`aria-label` on navs, `aria-current="page"` active nav states, labeled inputs with
`aria-describedby`/`aria-invalid` wiring, `role="alert"` on errors, decorative gradients/patterns
`aria-hidden`, focus-visible Electric Violet rings from primitives, color contrast ≥ 4.5:1 for
body text, full keyboard operability
(including the mobile menu button with `aria-expanded`).

## 13. SEO requirements

Per-page `export const metadata` (title via `%s | Sodales` template, description, openGraph with
`type/website|article`, `url`), `metadataBase` = `https://sodales.com` (proposed domain — see
open decisions), `generateMetadata` per case study, canonical-friendly static rendering,
`sitemap.xml` + `robots.txt`, semantic HTML, locally served project media, and optimized
`next/image` output. Shared chrome uses the text-only
`BrandWordmark`; the protected geometric logo is not approximated.

## 14. Design system (app layer)

The 2026 Sodales identity is the visual source of truth. Shared chrome uses Obsidian Black
`#111111`, Soft Ivory `#F4F2ED`, Graphite Gray `#35373B`, and sparse Electric Violet `#5E4FB3`
through the shared `@sodales/ui` tokens. Typography uses Inter for body/UI and Syne for
expressive display copy through `next/font`; headings are bold with tight leading and tracking,
while UI labels are 12px uppercase with wide tracking. Editorial serif chrome and the former
amber/ember accent are prohibited.

Homepage and archive sections use a 90rem editorial canvas with tighter reading columns nested
inside it. Surfaces are flat, bordered, and restrained (square media, no default card shadows);
hover and focus use Electric Violet. Authored case-study media takes priority over the existing
content-specific gradient fallback.
The sticky translucent header and Obsidian footer both use the shared text-only
`BrandWordmark`; no local approximation of the protected geometric icon is permitted.

The supplied `AI Model/TEST 5.mp4` remains untouched. Production uses a silent H.264,
fast-start 1920×1080 derivative under `public/media/`, plus a WebP poster and storyboard. Hero
playback is inline and plays once; pause/replay is keyboard accessible. Reduced-motion and
save-data visitors receive the poster until they explicitly choose to play.

## 15. Acceptance criteria

- [ ] All six routes render with designed, responsive, keyboard-navigable UI.
- [ ] Header shows active states; mobile menu opens/closes with correct aria state.
- [ ] Seven case studies render on `/work`; each slug page renders its identity, C/A/O + stats;
      unknown slug returns the designed 404.
- [ ] Contact form: inline field errors, preserved values, pending state, success screen;
      without `RESEND_API_KEY` → honest unconfigured state + mailto (never fake success);
      with key set and API failure → error state + mailto.
- [ ] `loading.tsx`, `error.tsx`, `not-found.tsx` exist and are designed.
- [ ] Per-page metadata + openGraph + sitemap.xml + robots.txt present.
- [ ] Shared chrome uses only the approved Obsidian/Ivory/Graphite/Violet palette; amber and
      editorial serif treatments do not appear.
- [ ] Header and footer render `BrandWordmark` from `@sodales/ui`; no geometric logo is redrawn.
- [ ] Display hierarchy is bold sans-serif, labels are uppercase/wide-tracked, and product
      gradients remain confined to case-study artwork.
- [ ] Brand film loads as web-compatible H.264 with a static poster, visible pause/replay,
      no forced audio, and reduced-motion/save-data restraint.
- [ ] `pnpm --filter @sodales/main typecheck && lint && build` all green.
- [ ] No db/auth files are introduced; platform-level UI configuration remains owned by the
      orchestrator and documented in the platform SDD.

## 16. Test plan

- Static verification: `typecheck`/`lint`/`build` (build prerenders every route — catches broken
  metadata, bad slugs, RSC violations).
- Content integrity: build fails on duplicate slugs via a dev-time `Set` check in the content
  module export path (duplicate slug throws at import time).
- Manual: keyboard pass over header/menu/form; 375px + 768px + 1280px widths; form submit in
  unconfigured mode; reduced-motion respects Tailwind defaults (transitions only).
- Playwright E2E: deferred (platform-level, Phase 6+).

## 17. Deployment notes

One Vercel project (`sodales-main`), root dir `apps/main`, region `sin1`. Env (both optional):
`RESEND_API_KEY`, `CONTACT_TO` (default `hello@sodales.com`). No database env files. Domain
`sodales.com` pending the platform domain decision (D-list, `00-platform.md` §14).

## 18. Open decisions

1. Final base domain (blocks `metadataBase`/canonicals being production-true).
2. Resend sender domain verification (MVP uses `onboarding@resend.dev` from-address).
3. CMS future: when work content needs editing by non-devs, a DB + admin SDD is required first.

## 19. Risks

- Brand drift across the family → mitigated by shared brand tokens and `BrandWordmark`, plus the
  explicit chrome contract in `docs/brand/website-guidelines.md`.
- Contact deliverability (spam, Resend limits) → honeypot + honest error states + mailto
  fallback; rate limiting deferred with the DB-less MVP.
- Static content can go stale → content lives in one typed module; README documents where.

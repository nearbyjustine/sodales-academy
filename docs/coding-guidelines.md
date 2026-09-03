# Sodales Monorepo Coding Guidelines

This document outlines the shared conventions and contracts for all six applications in the Sodales collective monorepo. App-specific behavior lives in each app's specific SDD (`docs/01-main.md` through `docs/06-store.md`).

## 1. App Structure Contract

Every database-backed application in `apps/` must adhere to the following structure:
- `src/app/`: Next.js App Router routes
- `src/auth/`: Neon Auth client, session helpers, role guards
- `src/db/`: `index.ts` (Drizzle client, server-only), `schema/`, `migrations/`, `seed.ts`
- `src/components/`: App-local UI components
- `src/features/`: Business logic modularized per domain
- `src/lib/`: Validation (zod), utils, constants

*Note: Shared DB, Auth, and Types packages are deliberately omitted to ensure strict data isolation.*

## 2. Authentication & Authorization

- **Neon Auth**: Managed Better Auth provisioned per project.
- **Server-Side Security**: All session lookups, role checks, and data scoping MUST run server-side (Server Components or Server Actions).
- **Isolation**: Auth users exist in the `neon_auth` schema. App-specific roles (e.g., `user_profile` in Academy) exist in app tables and link via `user_id`.
- **First Admin**: A seed script must be maintained to provision the first admin user (`ADMIN_EMAIL`).

## 3. Data Conventions

- **ORM**: Drizzle ORM is used across all apps.
- **Naming**: Use `snake_case` for tables and columns.
- **Primary Keys**: Always use UUIDs for primary keys.
- **Slugs**: Use unique indexes for public-facing slugs to prevent collisions.
- **Lifecycle Status**: Use an enum (`status`) for draft/publish lifecycles instead of boolean flags.
- **Mutations**: Timestamps (`created_at`, `updated_at`) are required on mutable tables.
- **Migrations**: Generated strictly via Drizzle Kit. Do not hand-edit committed migrations. Apply via `make db-migrate APP=<app>`.

## 4. UI & Styling Conventions

- **Primitives**: Sourced from `packages/ui` which implements `shadcn/ui`.
- **Design Tokens**: Tailwind design tokens are shared via `packages/ui`. Applications may theme tokens, but must not fork primitives.
- **Typography**: `Inter` is the standard UI/body typeface. App-specific display faces (like `Source Serif 4` for Academy) are allowed for expressive editorial content.
- **State Handling**: Every list view must have loading, empty, and error states. Every form must have robust validation, success, and error states (utilizing Zod and Sonner toasts).
- **Accessibility**: Must include semantic landmarks, single `h1` per page, labeled inputs, keyboard navigability, and sufficient contrast. Use `aria-` attributes where applicable.
- **Images**: Focus on locally stored NICO/MARA studio imagery; no external runtime CDN dependencies for core app functionality.

## 5. Course Structure (Academy Specific)

The initial Academy course categories are defined as follows:
- Freelancing Agency
- Short Film & Commercial
- Digital Products
- Branding & Design
- Design
- Development
- Marketing
- Business (Generic)

Learning progress is tracked individually per learner. While the Academy serves teams in the short-term, it uses a generic `learner` model to support public scaling.

## 6. Quality Gates

Before submitting a PR, ensure the following commands pass:
- `make lint`
- `make typecheck`
- `make build`

PRs require an independent reviewer to audit against the SDD and perform an auth/authorization security check prior to merge.

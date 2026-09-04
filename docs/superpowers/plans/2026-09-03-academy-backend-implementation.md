# Sodales Academy Phase 2 Backend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Swap Phase 1's filesystem/cookie/`localStorage` seam for Neon Postgres + Drizzle, Neon
Auth (Google OAuth gated by a DB-backed invite code), and Server Action mutations — without
rewriting any page, component, or layout that Phase 1 built.

**Architecture:** `src/db/` holds the Drizzle client, schema, and a one-time seed/migration
script. `src/lib/content/queries.ts` and `src/lib/session.ts` keep their exact Phase 1 exported
signatures; only their bodies change from filesystem/cookie reads to Drizzle reads. A new
`src/lib/content/mutations.ts` adds the write side Phase 1 never needed. Every Phase 1
localStorage/demo-mode stand-in (`src/lib/progress.ts`, `src/content/session.ts`,
`content/`, `<RoleSwitcher />`) is deleted once nothing depends on it — not kept as a fallback.

**Tech Stack:** Neon Postgres · Drizzle ORM + Drizzle Kit · Neon Auth (managed Better Auth) ·
Google OAuth · Next.js 16.3 App Router · zod v4 · Vitest — everything else unchanged from Phase 1.

**Spec:** `docs/superpowers/specs/2026-09-03-academy-backend-design.md`

## Global Constraints

- All DB tables: UUID primary keys, `snake_case` columns, `created_at`/`updated_at` on mutable
  tables (spec §5).
- `assertCanManageCourse(courseId, viewer)` gates every course write: admin manages any course;
  instructor manages only a course whose `instructor_user_id` matches their session user id
  (spec §8).
- No Server Action ever trusts a client-supplied role or ownership claim — every action re-derives
  the session server-side (spec §8).
- `courseInputSchema` (`src/lib/validation.ts`) runs server-side before every write, not just
  client-side (spec §8).
- Never fake success for a write that failed — real errors surface as error toasts, distinct
  wording from Phase 1's demo-mode toasts (spec §9).
- `params`, `searchParams`, and `cookies()` are async in Next 16 — `await` them (carried over from
  Phase 1's `CLAUDE.md`).
- `pnpm typecheck && pnpm lint && pnpm build` must pass before every commit that touches app code.

## Prerequisites — DONE (provisioned via `neon` CLI, 2026-09-03)

The below was originally written assuming a Google Cloud OAuth client and a `createNeonAuth`
config with explicit client/secret keys — neither turned out to be necessary. Real findings from
the live `neon neon-auth` CLI, kept here so Task 3 doesn't repeat the same wrong assumptions:

1. **Neon project created**: `sodales-academy` (id `weathered-cherry-68306158`), region
   `aws-ap-southeast-1` (Singapore — matches Vercel `sin1` per `docs/00-platform.md` §9), Postgres
   18. Pooled connection string is in `.env.local` as `DATABASE_URL`.
2. **Neon Auth enabled** on the `main` branch (`neon neon-auth enable`). Its `base_url` (in
   `.env.local` as `NEON_AUTH_BASE_URL`) and `jwks_url` are Neon's own hosted endpoints/signing
   keys, and needed no secret to set up via the CLI. **Correction (found during Task 3):** this
   does NOT mean the `@neondatabase/auth` npm SDK needs no secret of its own — `createNeonAuth`'s
   real config (at `@neondatabase/auth/next/server`) takes a required, runtime-validated
   `cookies: { secret }` (≥32 chars), a separate local secret from Neon's hosted keys. Generated
   via `openssl rand -base64 32` and added to `.env.local` as `NEON_AUTH_COOKIE_SECRET` once Task
   3 discovered this. The lesson: "the hosted service needs no secret" and "the SDK wrapping it
   needs no secret" are different claims — verify each independently rather than assuming one
   implies the other.
3. **Google OAuth needs no Google Cloud project at all** — `neon neon-auth oauth-provider list`
   showed Google already configured as `{"id": "google", "type": "shared"}`: Neon's own shared
   OAuth app, enabled by default the moment Neon Auth turns on. This removes the multi-day consent-
   screen dependency the original spec/plan flagged as a risk. (A dedicated Google Cloud client for
   a branded consent screen is still possible later via `neon neon-auth oauth-provider add
   --provider-id google --oauth-client-id ... --oauth-client-secret ...`, but is not needed to
   ship this plan.)
4. **Email/password sign-up disabled**: `neon neon-auth config email-password update --enabled
   false` — Google is now the only way to authenticate, matching deviation D-2.
5. **Trusted domains registered**: `localhost` (via `neon neon-auth domain allow-localhost
   enable`) and `https://sodales.vercel.app` (via `neon neon-auth domain add`).
6. **`INVITE_CODE_SECRET`** generated (`openssl rand -base64 32`) and in `.env.local`.
7. **`ADMIN_EMAIL`** — still needs a human answer (which Google account becomes the first admin);
   not yet in `.env.local`. Task 1 doesn't need it; Task 7/9 do.

**Still needed before Task 3, and only discoverable by installing the package:** the real
`@neondatabase/auth` npm package (`0.5.0-beta` as of this writing, depends on `better-auth@1.6.23`
+ `jose` + `@supabase/auth-js` + `@neondatabase/auth-ui`) ships its own `neon-auth-codemod` CLI
bin. Run that codemod (or read the package's own README/`dist/index.d.ts`) as the actual source
of truth for `createNeonAuth`'s config shape and the client-side hook-up — Task 3's code sample is
a best-effort sketch based on the CLI's `base_url`/`jwks_url` output, not a verified integration.

---

### Task 1: Install Drizzle and configure the Postgres connection

**Files:**
- Create: `drizzle.config.ts`, `src/db/index.ts`

**Interfaces:**
- Consumes: `DATABASE_URL` env var (Prerequisites)
- Produces: `db` — the Drizzle client, imported by every later task that touches Postgres

- [ ] **Step 1: Install dependencies**

```bash
pnpm add drizzle-orm @neondatabase/serverless
pnpm add -D drizzle-kit
```

- [ ] **Step 2: Configure drizzle-kit**

Create `drizzle.config.ts`:

```ts
import { defineConfig } from "drizzle-kit";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is not set — see Prerequisites in the backend implementation plan.");
}

export default defineConfig({
  schema: "./src/db/schema/index.ts",
  out: "./src/db/migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL,
  },
});
```

- [ ] **Step 3: Create the Drizzle client**

Create `src/db/index.ts`:

```ts
import "server-only";
import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
import * as schema from "./schema";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is not set.");
}

const sql = neon(process.env.DATABASE_URL);

export const db = drizzle(sql, { schema });
```

This will fail to typecheck until `./schema` exists — that's Task 2, not a bug in this task.

- [ ] **Step 4: Verify the package versions installed match this code**

`drizzle-orm`'s `neon-http` driver path and `defineConfig`'s exact shape have changed across
versions. Run:

```bash
cat node_modules/drizzle-orm/package.json | grep '"version"'
cat node_modules/drizzle-kit/package.json | grep '"version"'
```

If either major version is newer than `drizzle-orm@0.44`/`drizzle-kit@0.31`, check
`node_modules/drizzle-orm/neon-http/` and `node_modules/drizzle-kit/README.md` (or the installed
package's own `dist/index.d.ts`) for the current import paths and `defineConfig` shape before
proceeding — don't assume this snippet is still correct.

- [ ] **Step 5: Commit**

```bash
git add drizzle.config.ts src/db/index.ts package.json pnpm-lock.yaml
git commit -m "chore: add Drizzle ORM and Neon Postgres connection"
```

---

### Task 2: Define the schema and generate the first migration

**Files:**
- Create: `src/db/schema/user.ts`, `src/db/schema/course.ts`, `src/db/schema/enrollment.ts`, `src/db/schema/invite.ts`, `src/db/schema/index.ts`

**Interfaces:**
- Consumes: nothing
- Produces: `userProfile`, `userRole`, `course`, `courseModule`, `lesson`, `courseLevel`,
  `courseStatus`, `enrollment`, `lessonProgress`, `inviteCode` — every table/enum every later
  task imports from `@/db/schema`

- [ ] **Step 1: User profile schema**

Create `src/db/schema/user.ts`:

```ts
import { pgTable, pgEnum, uuid, text, timestamp } from "drizzle-orm/pg-core";

export const userRole = pgEnum("user_role", ["learner", "instructor", "admin"]);

export const userProfile = pgTable("user_profile", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id").notNull().unique(),
  name: text("name").notNull(),
  role: userRole("role").notNull().default("learner"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});
```

- [ ] **Step 2: Course schema**

Create `src/db/schema/course.ts`:

```ts
import { pgTable, pgEnum, uuid, text, integer, boolean, timestamp, unique } from "drizzle-orm/pg-core";

export const courseLevel = pgEnum("course_level", ["beginner", "intermediate", "advanced"]);
export const courseStatus = pgEnum("course_status", ["draft", "published"]);

export const course = pgTable("course", {
  id: uuid("id").primaryKey().defaultRandom(),
  slug: text("slug").notNull().unique(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  category: text("category").notNull(),
  level: courseLevel("level").notNull(),
  status: courseStatus("status").notNull().default("draft"),
  instructorUserId: text("instructor_user_id").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const courseModule = pgTable("course_module", {
  id: uuid("id").primaryKey().defaultRandom(),
  courseId: uuid("course_id")
    .notNull()
    .references(() => course.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  position: integer("position").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const lesson = pgTable(
  "lesson",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    moduleId: uuid("module_id")
      .notNull()
      .references(() => courseModule.id, { onDelete: "cascade" }),
    courseId: uuid("course_id")
      .notNull()
      .references(() => course.id, { onDelete: "cascade" }),
    slug: text("slug").notNull(),
    title: text("title").notNull(),
    content: text("content").notNull(),
    position: integer("position").notNull(),
    isPreview: boolean("is_preview").notNull().default(false),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [unique().on(table.courseId, table.slug)],
);
```

- [ ] **Step 3: Enrollment and progress schema**

Create `src/db/schema/enrollment.ts`:

```ts
import { pgTable, uuid, text, timestamp, unique } from "drizzle-orm/pg-core";
import { course, lesson } from "./course";

export const enrollment = pgTable(
  "enrollment",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    courseId: uuid("course_id")
      .notNull()
      .references(() => course.id, { onDelete: "cascade" }),
    userId: text("user_id").notNull(),
    enrolledAt: timestamp("enrolled_at").notNull().defaultNow(),
  },
  (table) => [unique().on(table.courseId, table.userId)],
);

export const lessonProgress = pgTable(
  "lesson_progress",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    lessonId: uuid("lesson_id")
      .notNull()
      .references(() => lesson.id, { onDelete: "cascade" }),
    userId: text("user_id").notNull(),
    completedAt: timestamp("completed_at").notNull().defaultNow(),
  },
  (table) => [unique().on(table.lessonId, table.userId)],
);
```

- [ ] **Step 4: Invite code schema**

Create `src/db/schema/invite.ts`:

```ts
import { pgTable, uuid, text, timestamp } from "drizzle-orm/pg-core";

export const inviteCode = pgTable("invite_code", {
  id: uuid("id").primaryKey().defaultRandom(),
  codeHash: text("code_hash").notNull().unique(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  revokedAt: timestamp("revoked_at"),
});
```

- [ ] **Step 5: Barrel export**

Create `src/db/schema/index.ts`:

```ts
export * from "./user";
export * from "./course";
export * from "./enrollment";
export * from "./invite";
```

- [ ] **Step 6: Typecheck, then generate and run the migration**

```bash
pnpm typecheck
```

Expected: PASS — this also confirms Task 1's `src/db/index.ts` now resolves `./schema` correctly.

```bash
pnpm exec drizzle-kit generate
pnpm exec drizzle-kit migrate
```

Expected: a new SQL file under `src/db/migrations/`, applied to the `DATABASE_URL` database with
no errors. If `drizzle-kit migrate` isn't the installed version's command name, check
`pnpm exec drizzle-kit --help` — command names have changed across `drizzle-kit` versions (some
use `push` for dev-only schema sync instead of generate+migrate; prefer generate+migrate so
there's a committed migration file).

- [ ] **Step 7: Commit**

```bash
git add src/db/schema src/db/migrations
git commit -m "feat: add Drizzle schema for courses, users, enrollment, and invite codes"
```

---

### Task 3: Neon Auth — server instance and handler route

**Files:**
- Create: `src/lib/auth/server.ts`, `src/app/api/auth/[...path]/route.ts`

**Interfaces:**
- Consumes: `NEON_AUTH_BASE_URL`, `NEON_AUTH_COOKIE_SECRET` env vars (Prerequisites — the
  cookie secret correction below)
- Produces: `auth` — the Neon Auth instance, consumed by `src/lib/session.ts` (Task 6) and the
  invite-code gate (Task 4)

**Verified real API (found by this task's implementer — supersedes the original speculative
sketch):** `createNeonAuth` lives at `@neondatabase/auth/next/server`, not the package root. Its
config is `{ baseUrl, cookies: { secret, ... } }` — note lowercase `baseUrl`, and `cookies.secret`
(≥32 chars) is required and runtime-validated, contrary to the Prerequisites section's original
(wrong) claim that no local SDK secret was needed. `auth.handler` is a **method**
(`auth.handler()`), not a destructurable property. `neon-auth-codemod` only migrates legacy UI
import paths — it does not scaffold `server.ts` or any config for you.

- [ ] **Step 1: Install the package**

```bash
pnpm add @neondatabase/auth
```

(Running `pnpm exec neon-auth-codemod` is optional and won't scaffold anything useful for a fresh
integration — it only rewrites legacy `@neondatabase/auth-ui` import paths, which don't exist yet
in this codebase.)

- [ ] **Step 2: Configure the server instance**

```ts
import "server-only";
import { createNeonAuth } from "@neondatabase/auth/next/server";

if (!process.env.NEON_AUTH_BASE_URL) {
  throw new Error("NEON_AUTH_BASE_URL is not set.");
}
if (!process.env.NEON_AUTH_COOKIE_SECRET) {
  throw new Error("NEON_AUTH_COOKIE_SECRET is not set.");
}

export const auth = createNeonAuth({
  baseUrl: process.env.NEON_AUTH_BASE_URL,
  cookies: {
    secret: process.env.NEON_AUTH_COOKIE_SECRET,
  },
});
```

No `socialProviders` config is needed — Google is already configured as Neon's shared OAuth
provider server-side (Prerequisites #3). If the installed package's types disagree, follow what
the types actually require over this snippet.

- [ ] **Step 3: Wire the handler route**

Create `src/app/api/auth/[...path]/route.ts`:

```ts
import { auth } from "@/lib/auth/server";

const handler = auth.handler();

export const GET = handler;
export const POST = handler;
```

`auth.handler` is a method that returns the actual Next.js route handler, not a
`{ GET, POST }` object itself — confirm this against the installed version's types if it doesn't
match (`auth.handler()`'s return type should satisfy Next's route handler signature for both
methods; if it returns something more specific per-verb, adjust accordingly).

- [ ] **Step 4: Typecheck and build**

```bash
pnpm typecheck && pnpm build
```

Expected: PASS. This won't yet be reachable from any page — that's Tasks 4-7.

- [ ] **Step 5: Commit**

```bash
git add src/lib/auth src/app/api/auth package.json pnpm-lock.yaml
git commit -m "feat: add Neon Auth server instance (Google via Neon's shared OAuth app)"
```

---

### Task 4: Invite-code verification

**Files:**
- Create: `src/lib/auth/invite.ts`, `src/lib/auth/invite.test.ts`, `src/app/actions/verify-invite-code.ts`

**Interfaces:**
- Consumes: `db`, `inviteCode` (Tasks 1-2), `INVITE_CODE_SECRET` env var (Prerequisites)
- Produces:
  - `signInviteToken(inviteCodeId: string): string`
  - `verifyInviteToken(token: string): { inviteCodeId: string } | null`
  - `INVITE_TOKEN_COOKIE = "sodales-invite-token"`
  - `verifyInviteCode(code: string): Promise<{ ok: true } | { ok: false; message: string }>` — the Server Action the sign-up form calls

- [ ] **Step 1: Write the failing token sign/verify tests**

Create `src/lib/auth/invite.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.stubEnv("INVITE_CODE_SECRET", "test-secret-at-least-32-characters-long");

const { signInviteToken, verifyInviteToken } = await import("./invite");

describe("invite token", () => {
  it("round-trips a valid token", () => {
    const token = signInviteToken("code-id-123");
    expect(verifyInviteToken(token)).toEqual({ inviteCodeId: "code-id-123" });
  });

  it("rejects a tampered token", () => {
    const token = signInviteToken("code-id-123");
    const tampered = token.slice(0, -1) + (token.at(-1) === "a" ? "b" : "a");
    expect(verifyInviteToken(tampered)).toBeNull();
  });

  it("rejects an expired token", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
    const token = signInviteToken("code-id-123");

    vi.setSystemTime(new Date("2026-01-01T00:31:00Z")); // 31 minutes later
    expect(verifyInviteToken(token)).toBeNull();
    vi.useRealTimers();
  });

  it("rejects garbage input", () => {
    expect(verifyInviteToken("not-a-real-token")).toBeNull();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm vitest run src/lib/auth/invite.test.ts`
Expected: FAIL — cannot resolve `./invite`.

- [ ] **Step 3: Implement the sign/verify helpers**

Create `src/lib/auth/invite.ts`:

```ts
import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

export const INVITE_TOKEN_COOKIE = "sodales-invite-token";
const TOKEN_TTL_MS = 30 * 60 * 1000; // 30 minutes — long enough to complete the Google redirect

function getSecret(): string {
  const secret = process.env.INVITE_CODE_SECRET;
  if (!secret) throw new Error("INVITE_CODE_SECRET is not set.");
  return secret;
}

function sign(payload: string): string {
  return createHmac("sha256", getSecret()).update(payload).digest("base64url");
}

export function signInviteToken(inviteCodeId: string): string {
  const issuedAt = Date.now().toString();
  const payload = `${inviteCodeId}.${issuedAt}`;
  return `${payload}.${sign(payload)}`;
}

export function verifyInviteToken(token: string): { inviteCodeId: string } | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;

  const [inviteCodeId, issuedAt, signature] = parts;
  const payload = `${inviteCodeId}.${issuedAt}`;
  const expected = sign(payload);

  const expectedBuf = Buffer.from(expected);
  const actualBuf = Buffer.from(signature);
  if (expectedBuf.length !== actualBuf.length || !timingSafeEqual(expectedBuf, actualBuf)) {
    return null;
  }

  const age = Date.now() - Number(issuedAt);
  if (!Number.isFinite(age) || age < 0 || age > TOKEN_TTL_MS) return null;

  return { inviteCodeId };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm vitest run src/lib/auth/invite.test.ts`
Expected: PASS, 4 tests.

- [ ] **Step 5: Write the invite-code verification Server Action**

Create `src/app/actions/verify-invite-code.ts`:

```ts
"use server";

import { cookies } from "next/headers";
import { createHash } from "node:crypto";
import { eq, isNull, and } from "drizzle-orm";
import { db } from "@/db";
import { inviteCode } from "@/db/schema";
import { signInviteToken, INVITE_TOKEN_COOKIE } from "@/lib/auth/invite";

function hashCode(code: string): string {
  return createHash("sha256").update(code.trim().toLowerCase()).digest("hex");
}

export async function verifyInviteCode(
  code: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  if (code.trim() === "") {
    return { ok: false, message: "Enter your invite code." };
  }

  const [match] = await db
    .select({ id: inviteCode.id })
    .from(inviteCode)
    .where(and(eq(inviteCode.codeHash, hashCode(code)), isNull(inviteCode.revokedAt)))
    .limit(1);

  if (!match) {
    return { ok: false, message: "That invite code isn't valid." };
  }

  const store = await cookies();
  store.set(INVITE_TOKEN_COOKIE, signInviteToken(match.id), {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 30 * 60,
  });

  return { ok: true };
}
```

- [ ] **Step 6: Typecheck, lint, test, build**

```bash
pnpm typecheck && pnpm lint && pnpm test && pnpm build
```

Expected: all green.

- [ ] **Step 7: Commit**

```bash
git add src/lib/auth/invite.ts src/lib/auth/invite.test.ts src/app/actions/verify-invite-code.ts
git commit -m "feat: add HMAC-signed invite code verification"
```

---

### Task 5: Wire the sign-up page to real invite-gated Google sign-in

**Files:**
- Modify: `src/components/auth/invite-code-form.tsx`, `src/components/auth/google-button.tsx`, `src/app/(auth)/sign-up/page.tsx`

**Interfaces:**
- Consumes: `verifyInviteCode` (Task 4), `INVITE_TOKEN_COOKIE` (Task 4), `auth` (Task 3)
- Produces: a working `/sign-up` flow — invite code unlocks the Google button, which redirects
  into the real OAuth flow

- [ ] **Step 1: Rewrite the invite-code form to call the real action**

Read the current file first: `src/components/auth/invite-code-form.tsx`. Replace its demo-toast
`handleSubmit` with a real call, and lift "is the code verified" state so the sign-up page can
disable/enable the Google button:

```tsx
"use client";

import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { verifyInviteCode } from "@/app/actions/verify-invite-code";

export function InviteCodeForm({ onVerified }: { onVerified: () => void }) {
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [verified, setVerified] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);

    const result = await verifyInviteCode(code);

    setPending(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }

    setError(null);
    setVerified(true);
    toast.success("Invite code accepted — continue with Google below.");
    onVerified();
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="invite-code">Invite code</Label>
        <Input
          id="invite-code"
          value={code}
          onChange={(event) => setCode(event.target.value)}
          disabled={verified}
          aria-invalid={error ? true : undefined}
          aria-describedby="invite-code-help"
        />
        <p id="invite-code-help" className="text-sm text-graphite">
          Members receive this from their team lead.
        </p>
        {error ? (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        ) : null}
      </div>
      <Button type="submit" className="w-full" disabled={pending || verified}>
        {verified ? "Code accepted" : pending ? "Checking…" : "Continue"}
      </Button>
    </form>
  );
}
```

- [ ] **Step 2: Make the Google button respect a disabled state**

Read `src/components/auth/google-button.tsx` and replace its demo `onClick` toast with a real
redirect into Neon Auth's Google sign-in, gated by a `disabled` prop:

```tsx
"use client";

import { Button } from "@/components/ui/button";

function GoogleGlyph() {
  return (
    <svg viewBox="0 0 24 24" className="size-4" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M23.52 12.27c0-.82-.07-1.6-.2-2.36H12v4.47h6.47a5.53 5.53 0 0 1-2.4 3.63v3.02h3.88c2.27-2.09 3.57-5.17 3.57-8.76Z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.96-1.07 7.95-2.9l-3.88-3.02c-1.08.72-2.45 1.15-4.07 1.15-3.13 0-5.78-2.11-6.73-4.96H1.26v3.11A12 12 0 0 0 12 24Z"
      />
      <path
        fill="#FBBC05"
        d="M5.27 14.27a7.2 7.2 0 0 1 0-4.54V6.62H1.26a12 12 0 0 0 0 10.76l4.01-3.11Z"
      />
      <path
        fill="#EA4335"
        d="M12 4.77c1.76 0 3.34.61 4.58 1.8l3.44-3.44C17.95 1.19 15.24 0 12 0A12 12 0 0 0 1.26 6.62l4.01 3.11C6.22 6.88 8.87 4.77 12 4.77Z"
      />
    </svg>
  );
}

export function GoogleButton({
  disabled = false,
  callbackURL = "/dashboard",
}: {
  disabled?: boolean;
  callbackURL?: string;
}) {
  async function handleClick() {
    const { authClient } = await import("@/lib/auth/client");
    await authClient.signIn.social({ provider: "google", callbackURL });
  }

  return (
    <Button type="button" variant="outline" className="w-full" disabled={disabled} onClick={handleClick}>
      <GoogleGlyph />
      Continue with Google
    </Button>
  );
}
```

This introduces `src/lib/auth/client.ts` (a browser-side Neon Auth client) as a new dependency —
add it in this same step:

```ts
"use client";

import { createAuthClient } from "@neondatabase/auth/client";

export const authClient = createAuthClient();
```

Verify `createAuthClient`'s exact import path against whatever `@neondatabase/auth` version Task
3 installed — client-side entry points are commonly under a `/client` or `/react` subpath, and the
exact name varies by version.

The `/login` page's Google button keeps its Phase 1 behavior for now — real sign-in for an
*existing* user doesn't need the invite gate, only sign-*up* does. `callbackURL` defaults to
`/dashboard` for both; that's Task 6's job to make meaningful.

- [ ] **Step 3: Update the sign-up page to gate the button on invite verification**

Read `src/app/(auth)/sign-up/page.tsx`. Since gating requires client state (whether the invite
code has been verified), the page needs a small client wrapper. Create
`src/components/auth/sign-up-flow.tsx`:

```tsx
"use client";

import { useState } from "react";
import { GoogleButton } from "@/components/auth/google-button";
import { InviteCodeForm } from "@/components/auth/invite-code-form";

export function SignUpFlow() {
  const [verified, setVerified] = useState(false);

  return (
    <div className="flex flex-col gap-6">
      <InviteCodeForm onVerified={() => setVerified(true)} />
      <div className="flex items-center gap-3">
        <span aria-hidden="true" className="h-px flex-1 bg-border" />
        <span className="label-eyebrow text-graphite">then</span>
        <span aria-hidden="true" className="h-px flex-1 bg-border" />
      </div>
      <GoogleButton disabled={!verified} />
    </div>
  );
}
```

Update `src/app/(auth)/sign-up/page.tsx` to render `<SignUpFlow />` in place of the separate
`<GoogleButton />`/`<InviteCodeForm />` pair it currently renders — keep the `h1`, intro sentence,
and footer link to `/login` as they are.

- [ ] **Step 4: Typecheck, lint, build**

```bash
pnpm typecheck && pnpm lint && pnpm build
```

- [ ] **Step 5: Verify by hand**

```bash
pnpm dev
```

Open `/sign-up`. Confirm: **Continue with Google** starts disabled; submitting a wrong code shows
an inline error and the button stays disabled; submitting a code that exists in `invite_code`
(insert one manually via `psql`/Neon console for this manual check, since Task 9 hasn't seeded
one yet) enables the button and clicking it redirects toward Google's OAuth screen.

- [ ] **Step 6: Commit**

```bash
git add src/components/auth src/app/\(auth\)/sign-up/page.tsx src/lib/auth/client.ts
git commit -m "feat: gate Google sign-up on a verified invite code"
```

---

### Task 6: Session seam swap

**Files:**
- Modify: `src/lib/session.ts`
- Create: `src/lib/session.test.ts` (replaces the Phase 1 version)

**Interfaces:**
- Consumes: `auth` (Task 3), `db`, `userProfile`, `enrollment` (Tasks 1-2)
- Produces: `getSession(): Promise<Session | null>`, `requireUser(): Promise<Session>`,
  `requireRole(...roles: Role[]): Promise<Session>`, `getEnrollments(): Promise<Enrollment[]>` —
  same signatures every page already calls; `type Enrollment = { courseSlug: string; lessonIds: string[] }`
  (Phase 1's `seededCompletedLessonIds` field is gone — real completion comes from `lesson_progress`,
  read separately in Task 14, not bundled into the enrollment shape)

- [ ] **Step 1: Write the failing session tests**

Create `src/lib/session.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const mockGetSession = vi.fn();
vi.mock("@/lib/auth/server", () => ({
  auth: { api: { getSession: mockGetSession } },
}));

const mockSelect = vi.fn();
vi.mock("@/db", () => ({
  db: { select: () => ({ from: () => ({ where: () => mockSelect() }) }) },
}));

const redirectMock = vi.fn(() => {
  throw new Error("NEXT_REDIRECT");
});
vi.mock("next/navigation", () => ({ redirect: redirectMock }));

vi.mock("next/headers", () => ({ headers: async () => new Headers() }));

const { getSession, requireUser, requireRole } = await import("./session");

beforeEach(() => {
  mockGetSession.mockReset();
  mockSelect.mockReset();
  redirectMock.mockClear();
});

describe("getSession", () => {
  it("returns null when there is no auth session", async () => {
    mockGetSession.mockResolvedValue(null);
    expect(await getSession()).toBeNull();
  });

  it("joins the user_profile role onto the auth session", async () => {
    mockGetSession.mockResolvedValue({
      user: { id: "user-1", name: "Alex Rivera", email: "alex@sodales.app" },
    });
    mockSelect.mockResolvedValue([{ role: "instructor" }]);

    const session = await getSession();
    expect(session).toEqual({
      userId: "user-1",
      name: "Alex Rivera",
      email: "alex@sodales.app",
      initials: "AR",
      role: "instructor",
    });
  });

  it("defaults to learner when no user_profile row exists yet", async () => {
    mockGetSession.mockResolvedValue({
      user: { id: "user-2", name: "New Person", email: "new@sodales.app" },
    });
    mockSelect.mockResolvedValue([]);

    expect((await getSession())!.role).toBe("learner");
  });
});

describe("requireUser", () => {
  it("redirects to /login when there is no session", async () => {
    mockGetSession.mockResolvedValue(null);
    await expect(requireUser()).rejects.toThrow("NEXT_REDIRECT");
    expect(redirectMock).toHaveBeenCalledWith("/login");
  });
});

describe("requireRole", () => {
  it("redirects when the role is insufficient", async () => {
    mockGetSession.mockResolvedValue({
      user: { id: "user-1", name: "Alex", email: "alex@sodales.app" },
    });
    mockSelect.mockResolvedValue([{ role: "learner" }]);

    await expect(requireRole("admin")).rejects.toThrow("NEXT_REDIRECT");
    expect(redirectMock).toHaveBeenCalledWith("/");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm vitest run src/lib/session.test.ts`
Expected: FAIL — the current `session.ts` still reads a role cookie, not `auth.api.getSession`.

- [ ] **Step 3: Implement the real session seam**

Replace the body of `src/lib/session.ts` — keep every exported name and signature, only the
implementation changes:

```ts
import "server-only";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { userProfile, enrollment, course } from "@/db/schema";
import { auth } from "@/lib/auth/server";

export type Role = "learner" | "instructor" | "admin";

export type Session = {
  userId: string;
  name: string;
  email: string;
  initials: string;
  role: Role;
};

export type Enrollment = { courseSlug: string };

function initialsFor(name: string): string {
  const parts = name.trim().split(/\s+/);
  return parts
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

/**
 * PHASE 2 SEAM — real implementation.
 *
 * Signatures unchanged from Phase 1. Every page that already calls these keeps working.
 */

export async function getSession(): Promise<Session | null> {
  const authSession = await auth.api.getSession({ headers: await headers() });
  if (!authSession) return null;

  const [profile] = await db
    .select({ role: userProfile.role })
    .from(userProfile)
    .where(eq(userProfile.userId, authSession.user.id));

  return {
    userId: authSession.user.id,
    name: authSession.user.name,
    email: authSession.user.email,
    initials: initialsFor(authSession.user.name),
    role: profile?.role ?? "learner",
  };
}

export async function requireUser(): Promise<Session> {
  const session = await getSession();
  if (!session) redirect("/login");
  return session;
}

export async function requireRole(...roles: Role[]): Promise<Session> {
  const session = await requireUser();
  if (!roles.includes(session.role)) redirect("/");
  return session;
}

export async function getEnrollments(): Promise<Enrollment[]> {
  const session = await getSession();
  if (!session) return [];

  const rows = await db
    .select({ courseSlug: course.slug })
    .from(enrollment)
    .innerJoin(course, eq(enrollment.courseId, course.id))
    .where(eq(enrollment.userId, session.userId));

  return rows;
}
```

Verify `auth.api.getSession`'s exact call shape (some Better-Auth-derived APIs want
`{ headers }`, others a plain `Headers` object, others a Next.js `Request`) against whatever Task
3's docs-check turned up — don't assume this snippet's shape is correct without checking.

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm vitest run src/lib/session.test.ts`
Expected: PASS, 5 tests.

- [ ] **Step 5: Update every call site that used the deleted `getEnrollments` shape**

`src/app/(site)/dashboard/page.tsx` currently does:

```ts
const courses = (
  await Promise.all(enrollments.map((e) => getCourseBySlug(e.courseSlug)))
).filter((c) => c !== null);
```

This still works unchanged — `Enrollment.courseSlug` still exists, just without
`seededCompletedLessonIds`. No page edit needed in this task; Task 14 is where dashboard progress
gets rewired to real `lesson_progress` reads.

- [ ] **Step 6: Typecheck, lint, build**

```bash
pnpm typecheck && pnpm lint && pnpm build
```

Expected: `pnpm build` will likely fail at this point because `src/app/actions/set-role.ts` and
`<RoleSwitcher />` still import `ROLE_COOKIE` from `session.ts`, which no longer exists. That's
expected — Task 17 deletes both files. For now, comment out the `<RoleSwitcher />` usage in
`src/components/layout/site-header.tsx` (don't delete the file yet) so the build succeeds; leave a
plain `{session ? <span>{session.initials}</span> : null}` in its place. Note this temporary state
in the commit message.

- [ ] **Step 7: Commit**

```bash
git add src/lib/session.ts src/lib/session.test.ts src/components/layout/site-header.tsx
git commit -m "feat: swap session seam for real Neon Auth + user_profile reads

Temporarily disables the role switcher in site-header.tsx (it reads the
now-deleted ROLE_COOKIE) — Task 17 removes it and the file entirely once
nothing else depends on it."
```

---

### Task 7: OAuth callback completes sign-up

**Files:**
- Create: `src/lib/auth/hooks.ts`

**Interfaces:**
- Consumes: `verifyInviteToken`, `INVITE_TOKEN_COOKIE` (Task 4), `db`, `userProfile`, `inviteCode` (Tasks 1-2)
- Produces: a Neon Auth lifecycle hook that creates the `user_profile` row on first sign-in,
  after checking the invite token cookie

- [ ] **Step 1: Verify the installed package's hook/callback mechanism**

Better-Auth-derived libraries commonly expose a `databaseHooks` or `hooks.after` option on
`createNeonAuth`'s config for running code after a user is created. Check
`node_modules/@neondatabase/auth`'s type definitions for the exact hook name and signature before
writing this — the shape below is illustrative of the *behavior* needed, not a verified API call.

- [ ] **Step 2: Implement the post-sign-up hook**

Create `src/lib/auth/hooks.ts`:

```ts
import "server-only";
import { cookies } from "next/headers";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { userProfile } from "@/db/schema";
import { verifyInviteToken, INVITE_TOKEN_COOKIE } from "@/lib/auth/invite";

export async function onUserCreated(user: { id: string; name: string }): Promise<void> {
  const store = await cookies();
  const token = store.get(INVITE_TOKEN_COOKIE)?.value;
  const verified = token ? verifyInviteToken(token) : null;

  if (!verified) {
    throw new Error(
      "No valid invite code found for this sign-up — the account was created but has no app access.",
    );
  }

  const [existing] = await db
    .select({ id: userProfile.id })
    .from(userProfile)
    .where(eq(userProfile.userId, user.id));

  if (existing) return; // idempotent — a retried callback shouldn't insert twice

  await db.insert(userProfile).values({
    userId: user.id,
    name: user.name,
    role: "learner",
  });

  store.delete(INVITE_TOKEN_COOKIE);
}
```

The thrown error on a missing/invalid invite token is intentional: per spec §6, a Google account
that reaches the callback without a valid invite token must not silently get a `user_profile` row
(and therefore no app access) — surfacing an explicit error is more honest than a silent partial
account, matching the demo-honesty principle carried over from Phase 1.

- [ ] **Step 3: Wire the hook into the auth instance**

Update `src/lib/auth/server.ts` (from Task 3) to register this hook — the exact config key depends
on Step 1's findings. Illustrative shape:

```ts
import { onUserCreated } from "@/lib/auth/hooks";

export const auth = createNeonAuth({
  // ...existing config from Task 3...
  databaseHooks: {
    user: {
      create: {
        after: onUserCreated,
      },
    },
  },
});
```

- [ ] **Step 4: Typecheck, lint, build**

```bash
pnpm typecheck && pnpm lint && pnpm build
```

- [ ] **Step 5: Verify by hand**

With a real invite code inserted manually (same as Task 5's manual check) and Google OAuth
credentials configured, run through `/sign-up` end-to-end: enter the code, click **Continue with
Google**, complete the Google consent screen, land back on `/dashboard`. Confirm a row now exists
in `user_profile` for that user with `role: "learner"`.

If the Google Cloud consent screen isn't published yet (Prerequisites #4), this manual check is
blocked — note that and move on; it isn't this task's fault and shouldn't block the rest of the
plan.

- [ ] **Step 6: Commit**

```bash
git add src/lib/auth/hooks.ts src/lib/auth/server.ts
git commit -m "feat: create user_profile on sign-up, gated by a verified invite token"
```

---

### Task 8: Content queries seam swap

**Files:**
- Modify: `src/lib/content/queries.ts`
- Create: `src/lib/content/queries.test.ts` (replaces the Phase 1 version)

**Interfaces:**
- Consumes: `db`, `course`, `courseModule`, `lesson`, `userProfile` (Tasks 1-2)
- Produces: same exported signatures as Phase 1 —
  `getCourses(filters?)`, `getCourseBySlug(slug)`, `getLesson(courseSlug, lessonSlug)`,
  `getCatalogStats()`, `getAllCourses()` — every page already calls these unchanged

- [ ] **Step 1: Write the failing query tests against a seeded test database**

This suite needs real rows, not mocks — course/module/lesson relationships are exactly what's
under test. Create `src/lib/content/queries.test.ts`:

```ts
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { course, courseModule, lesson, userProfile } from "@/db/schema";
import { getCourses, getCourseBySlug, getLesson, getCatalogStats } from "./queries";

const TEST_INSTRUCTOR = "test-instructor-id";

beforeAll(async () => {
  await db
    .insert(userProfile)
    .values({ userId: TEST_INSTRUCTOR, name: "Test Instructor", role: "instructor" })
    .onConflictDoNothing();

  const [publishedCourse] = await db
    .insert(course)
    .values({
      slug: "queries-test-course",
      title: "Queries Test Course",
      description: "A course that exists only for this test file.",
      category: "Testing",
      level: "beginner",
      status: "published",
      instructorUserId: TEST_INSTRUCTOR,
    })
    .returning();

  const [draftCourse] = await db
    .insert(course)
    .values({
      slug: "queries-test-draft",
      title: "Queries Test Draft",
      description: "A draft course that must not be publicly visible.",
      category: "Testing",
      level: "beginner",
      status: "draft",
      instructorUserId: TEST_INSTRUCTOR,
    })
    .returning();

  const [mod] = await db
    .insert(courseModule)
    .values({ courseId: publishedCourse.id, title: "Module One", position: 1 })
    .returning();

  await db.insert(lesson).values([
    {
      moduleId: mod.id,
      courseId: publishedCourse.id,
      slug: "first-lesson",
      title: "First Lesson",
      content: "x".repeat(60),
      position: 1,
      isPreview: true,
    },
    {
      moduleId: mod.id,
      courseId: publishedCourse.id,
      slug: "second-lesson",
      title: "Second Lesson",
      content: "y".repeat(60),
      position: 2,
      isPreview: false,
    },
  ]);
});

afterAll(async () => {
  await db.delete(course).where(eq(course.slug, "queries-test-course"));
  await db.delete(course).where(eq(course.slug, "queries-test-draft"));
  await db.delete(userProfile).where(eq(userProfile.userId, TEST_INSTRUCTOR));
});

describe("getCourses", () => {
  it("returns only published courses", async () => {
    const courses = await getCourses();
    expect(courses.some((c) => c.slug === "queries-test-course")).toBe(true);
    expect(courses.some((c) => c.slug === "queries-test-draft")).toBe(false);
  });

  it("resolves the instructor's real name via a user_profile join", async () => {
    const courses = await getCourses();
    const target = courses.find((c) => c.slug === "queries-test-course");
    expect(target!.instructorName).toBe("Test Instructor");
  });
});

describe("getCourseBySlug", () => {
  it("returns a published course with its modules and lessons in position order", async () => {
    const result = await getCourseBySlug("queries-test-course");
    expect(result).not.toBeNull();
    expect(result!.modules).toHaveLength(1);
    expect(result!.modules[0].lessons.map((l) => l.slug)).toEqual(["first-lesson", "second-lesson"]);
  });

  it("returns null for a draft course", async () => {
    expect(await getCourseBySlug("queries-test-draft")).toBeNull();
  });
});

describe("getLesson", () => {
  it("returns navigation and full content", async () => {
    const result = await getLesson("queries-test-course", "second-lesson");
    expect(result).not.toBeNull();
    expect(result!.prev!.slug).toBe("first-lesson");
    expect(result!.next).toBeNull();
    expect(result!.content).toBe("y".repeat(60));
  });
});

describe("getCatalogStats", () => {
  it("counts only published courses", async () => {
    const stats = await getCatalogStats();
    const before = stats.courses;
    expect(before).toBeGreaterThanOrEqual(1);
  });
});
```

This suite requires `DATABASE_URL` pointed at a real (dev/test) Neon branch when running — it is
an integration test, not a pure unit test, matching the spec's move away from filesystem fixtures.

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm vitest run src/lib/content/queries.test.ts`
Expected: FAIL — `queries.ts` still reads `loadAllCourses()` from the filesystem, so
`getCourses()` won't see the rows this test just inserted.

- [ ] **Step 3: Implement the real query seam**

Replace the body of `src/lib/content/queries.ts` — keep every exported type and function
signature:

```ts
import "server-only";
import { eq, and, or, ilike, asc } from "drizzle-orm";
import { db } from "@/db";
import { course, courseModule, lesson, userProfile } from "@/db/schema";
import type { CourseDetail, CourseModule, CourseSummary, Lesson, Level } from "./types";

export type LessonRef = { courseSlug: string; slug: string; title: string };

export type LessonWithNav = Lesson & {
  course: CourseSummary;
  modules: CourseModule[];
  prev: LessonRef | null;
  next: LessonRef | null;
};

/**
 * PHASE 2 SEAM — real implementation. Signatures unchanged from Phase 1.
 */

export async function getCourses(
  filters: { q?: string; level?: Level } = {},
): Promise<CourseSummary[]> {
  const conditions = [eq(course.status, "published")];
  if (filters.level) conditions.push(eq(course.level, filters.level));

  const q = filters.q?.trim();
  const rows = await db
    .select()
    .from(course)
    .where(
      q
        ? and(...conditions, or(ilike(course.title, `%${q}%`), ilike(course.description, `%${q}%`)))
        : and(...conditions),
    );

  const withCounts = await Promise.all(rows.map((r) => toSummaryWithCount(r)));
  return withCounts;
}

export async function getCourseBySlug(slug: string): Promise<CourseDetail | null> {
  const [row] = await db.select().from(course).where(eq(course.slug, slug));
  if (!row || row.status !== "published") return null;
  return toDetail(row);
}

export async function getAllCourses(): Promise<CourseSummary[]> {
  const rows = await db.select().from(course);
  return Promise.all(rows.map((r) => toSummaryWithCount(r)));
}

export async function getLesson(
  courseSlug: string,
  lessonSlug: string,
): Promise<LessonWithNav | null> {
  const detail = await getCourseBySlug(courseSlug);
  if (!detail) return null;

  const flat = detail.modules.flatMap((m) => m.lessons);
  const index = flat.findIndex((l) => l.slug === lessonSlug);
  if (index === -1) return null;

  const { modules: _modules, ...summary } = detail;

  return {
    ...flat[index],
    course: summary,
    modules: detail.modules,
    prev: index > 0 ? toRef(flat[index - 1]) : null,
    next: index < flat.length - 1 ? toRef(flat[index + 1]) : null,
  };
}

export async function getCatalogStats(): Promise<{
  courses: number;
  lessons: number;
  categories: number;
}> {
  const published = await db.select().from(course).where(eq(course.status, "published"));
  const counts = await Promise.all(published.map((c) => countLessons(c.id)));

  return {
    courses: published.length,
    lessons: counts.reduce((sum, n) => sum + n, 0),
    categories: new Set(published.map((c) => c.category)).size,
  };
}

async function countLessons(courseId: string): Promise<number> {
  const rows = await db.select({ id: lesson.id }).from(lesson).where(eq(lesson.courseId, courseId));
  return rows.length;
}

async function resolveInstructorName(instructorUserId: string): Promise<string> {
  const [profile] = await db
    .select({ name: userProfile.name })
    .from(userProfile)
    .where(eq(userProfile.userId, instructorUserId));
  return profile?.name ?? "Unknown instructor";
}

async function toSummaryWithCount(row: typeof course.$inferSelect): Promise<CourseSummary> {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    description: row.description,
    category: row.category,
    level: row.level,
    status: row.status,
    instructorName: await resolveInstructorName(row.instructorUserId),
    lessonCount: await countLessons(row.id),
  };
}

async function toDetail(row: typeof course.$inferSelect): Promise<CourseDetail> {
  const summary = await toSummaryWithCount(row);
  const modules = await db
    .select()
    .from(courseModule)
    .where(eq(courseModule.courseId, row.id))
    .orderBy(asc(courseModule.position));

  const modulesWithLessons: CourseModule[] = await Promise.all(
    modules.map(async (m) => {
      const lessons = await db
        .select()
        .from(lesson)
        .where(eq(lesson.moduleId, m.id))
        .orderBy(asc(lesson.position));

      return {
        id: m.id,
        title: m.title,
        position: m.position,
        lessons: lessons.map((l) => ({
          id: l.id,
          courseSlug: row.slug,
          slug: l.slug,
          title: l.title,
          moduleTitle: m.title,
          position: l.position,
          isPreview: l.isPreview,
          content: l.content,
        })),
      };
    }),
  );

  return { ...summary, modules: modulesWithLessons };
}

function toRef(lesson: Lesson): LessonRef {
  return { courseSlug: lesson.courseSlug, slug: lesson.slug, title: lesson.title };
}
```

`resolveInstructorName` falls back to `"Unknown instructor"` rather than throwing if a course's
`instructor_user_id` has no matching `user_profile` row — this can legitimately happen for the
migration's temporary state between Task 9 (courses inserted, assigned to whichever user happens
to exist) and a real instructor being assigned later, and a course detail page or admin table
should degrade gracefully rather than 500.

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm vitest run src/lib/content/queries.test.ts`
Expected: PASS, 7 tests.

- [ ] **Step 5: Typecheck, lint, build**

```bash
pnpm typecheck && pnpm lint && pnpm build
```

- [ ] **Step 6: Commit**

```bash
git add src/lib/content/queries.ts src/lib/content/queries.test.ts
git commit -m "feat: swap content query seam for real Drizzle reads

instructorName resolves the real display name via a user_profile join,
falling back to \"Unknown instructor\" if no profile matches yet."
```

---

### Task 9: Migration/seed script

**Files:**
- Create: `src/db/seed.ts`, `src/db/seed.test.ts`, `src/db/seed-cli.ts`
- Modify: `package.json` (adds the `db:seed` script and the `tsx`/`dotenv-cli` dev dependencies)

**Interfaces:**
- Consumes: `db`, full schema (Tasks 1-2), `loadAllCourses` (still exists at this point — deleted
  in Task 17, after this task has already used it one last time)
- Produces: `runSeed(): Promise<{ coursesImported: number; lessonsImported: number }>` — the
  function the seed script's CLI entry calls, and what Task 9's test exercises directly

- [ ] **Step 1: Write the failing seed test**

Create `src/db/seed.test.ts`. It runs against a real test database (same integration-test
convention as Task 8) and against Phase 1's actual fixture content, so it doubles as the schema's
first real integration check:

```ts
import { describe, it, expect, afterAll } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { course, courseModule, lesson } from "@/db/schema";
import { runSeed } from "./seed";

afterAll(async () => {
  const rows = await db.select({ id: course.id, slug: course.slug }).from(course);
  const seededSlugs = [
    "brand-identity-essentials",
    "landing-your-first-client",
    "pricing-and-proposals",
    "web-development-foundations",
    "test-fixture-course",
  ];
  for (const row of rows) {
    if (seededSlugs.includes(row.slug)) {
      await db.delete(course).where(eq(course.id, row.id));
    }
  }
});

describe("runSeed", () => {
  it("imports every course and lesson from content/", async () => {
    const result = await runSeed();
    expect(result.coursesImported).toBe(5); // 4 published + the draft fixture
    expect(result.lessonsImported).toBe(20); // 19 real + 1 fixture lesson
  });

  it("preserves status, including the draft fixture", async () => {
    await runSeed();
    const [fixture] = await db
      .select({ status: course.status })
      .from(course)
      .where(eq(course.slug, "test-fixture-course"));
    expect(fixture.status).toBe("draft");
  });

  it("preserves module and lesson ordering", async () => {
    await runSeed();
    const [landingCourse] = await db
      .select()
      .from(course)
      .where(eq(course.slug, "landing-your-first-client"));

    const modules = await db
      .select()
      .from(courseModule)
      .where(eq(courseModule.courseId, landingCourse.id));
    expect(modules).toHaveLength(3);

    const firstModule = modules.find((m) => m.position === 1)!;
    const lessons = await db.select().from(lesson).where(eq(lesson.moduleId, firstModule.id));
    expect(lessons.map((l) => l.slug).sort()).toEqual(
      ["why-nobody-replies", "where-clients-actually-are"].sort(),
    );
  });

  it("is idempotent — re-running does not create duplicates", async () => {
    await runSeed();
    const before = await db.select({ id: course.id }).from(course).where(eq(course.slug, "pricing-and-proposals"));

    await runSeed();
    const after = await db.select({ id: course.id }).from(course).where(eq(course.slug, "pricing-and-proposals"));

    expect(after).toHaveLength(before.length);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm vitest run src/db/seed.test.ts`
Expected: FAIL — cannot resolve `./seed`.

- [ ] **Step 3: Implement the seed script**

Create `src/db/seed.ts`:

```ts
import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { course, courseModule, lesson, userProfile } from "@/db/schema";
import { loadAllCourses } from "@/lib/content/loader";

export async function runSeed(): Promise<{ coursesImported: number; lessonsImported: number }> {
  await promoteAdmin();
  return db.transaction(async (tx) => {
    const courses = await loadAllCourses();
    let lessonsImported = 0;

    for (const c of courses) {
      const [existing] = await tx.select({ id: course.id }).from(course).where(eq(course.slug, c.slug));
      if (existing) continue; // idempotent — already imported

      const instructorUserId = await resolveInstructorUserId(tx);

      const [insertedCourse] = await tx
        .insert(course)
        .values({
          slug: c.slug,
          title: c.title,
          description: c.description,
          category: c.category,
          level: c.level,
          status: c.status,
          instructorUserId,
        })
        .returning();

      for (const m of c.modules) {
        const [insertedModule] = await tx
          .insert(courseModule)
          .values({ courseId: insertedCourse.id, title: m.title, position: m.position })
          .returning();

        for (const l of m.lessons) {
          await tx.insert(lesson).values({
            moduleId: insertedModule.id,
            courseId: insertedCourse.id,
            slug: l.slug,
            title: l.title,
            content: l.content,
            position: l.position,
            isPreview: l.isPreview,
          });
          lessonsImported++;
        }
      }
    }

    return { coursesImported: courses.length, lessonsImported };
  });
}

async function resolveInstructorUserId(tx: typeof db): Promise<string> {
  const adminEmail = process.env.ADMIN_EMAIL;
  if (!adminEmail) throw new Error("ADMIN_EMAIL is not set — needed to assign migrated courses.");

  // Neon Auth's user table isn't reachable via Drizzle's schema (it lives in the neon_auth
  // schema — see spec §5). Look up the admin's user_profile by a name/email match instead;
  // this assumes ADMIN_EMAIL has already completed sign-up (Prerequisites #5) before seeding.
  const [profile] = await tx.select({ userId: userProfile.userId }).from(userProfile).limit(1);
  if (!profile) {
    throw new Error(
      `No user_profile rows exist yet — ${adminEmail} must sign up before running the seed.`,
    );
  }
  return profile.userId;
}

async function promoteAdmin(): Promise<void> {
  const adminEmail = process.env.ADMIN_EMAIL;
  if (!adminEmail) throw new Error("ADMIN_EMAIL is not set.");
  // Promotion needs to match on email, which lives on the Neon Auth user, not user_profile.
  // Task 7's onUserCreated hook has access to the full user object at sign-up time; this
  // function's real implementation depends on how @neondatabase/auth exposes querying its
  // own user table from server code — verify against Task 3's docs-check before finishing
  // this function. A placeholder that promotes the single existing user_profile row is NOT
  // acceptable for the real implementation; it's only sketched above to keep resolveInstructorUserId
  // working for the seed test's idempotency check until this function is completed for real.
}
```

Note honestly: `promoteAdmin`'s real implementation needs to query the Neon Auth user table by
email (to find `ADMIN_EMAIL`'s user id) before it can promote the right `user_profile` row to
`admin` — and `resolveInstructorUserId`'s "just take the first `user_profile` row" is only correct
while there's exactly one user in the database (true immediately after Prerequisites, false once
more people sign up). Before this task is done, both functions need a real by-email lookup against
whatever `@neondatabase/auth` exposes for querying its user table server-side (check its exports
for something like `auth.api.listUsers` or direct access to its Drizzle adapter's user table) —
finish this using the real API once Task 3's docs-check has identified it, rather than shipping
the single-user assumption above.

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm vitest run src/db/seed.test.ts`
Expected: PASS, 4 tests — once `promoteAdmin`/`resolveInstructorUserId` are finished for real
per the note in Step 3.

- [ ] **Step 5: Add a CLI entry point**

`seed-cli.ts` runs as a bare script, outside Next.js's automatic `.env.local` loading — Task 2's
implementer hit exactly this gap with `drizzle-kit` and had to manually `source .env.local` as a
one-off workaround. Fix it properly here instead of leaving every future CLI script (and everyone
who ever runs `pnpm db:seed`) to rediscover the same problem: use `dotenv-cli`.

```bash
pnpm add -D dotenv-cli
```

Add to `package.json` scripts:

```json
"db:seed": "dotenv -e .env.local -- tsx src/db/seed-cli.ts"
```

Create `src/db/seed-cli.ts`:

```ts
import { runSeed } from "./seed";

runSeed()
  .then((result) => {
    console.log(`Seeded ${result.coursesImported} courses, ${result.lessonsImported} lessons.`);
    process.exit(0);
  })
  .catch((error) => {
    console.error("Seed failed:", error);
    process.exit(1);
  });
```

This needs `tsx` as a dev dependency: `pnpm add -D tsx`.

- [ ] **Step 6: Typecheck, lint, build**

```bash
pnpm typecheck && pnpm lint && pnpm build
```

- [ ] **Step 7: Commit**

```bash
git add src/db/seed.ts src/db/seed.test.ts src/db/seed-cli.ts package.json pnpm-lock.yaml
git commit -m "feat: add content migration/seed script

promoteAdmin and resolveInstructorUserId resolve ADMIN_EMAIL's real
Neon Auth user id by email — no single-user assumption. Task 17 runs
this for real against the working database before deleting content/."
```

---

### Task 10: Course mutations

**Files:**
- Create: `src/lib/content/mutations.ts`, `src/lib/content/mutations.test.ts`
- Modify: `src/lib/validation.ts` (add `instructorUserId`)

**Interfaces:**
- Consumes: `db`, `course`, `courseModule`, `lesson`, `userProfile` (Tasks 1-2), `requireRole`
  (Task 6), `courseInputSchema` (this task, modified)
- Produces: `assertCanManageCourse(courseId: string, viewer: Session): Promise<void>` (throws if
  unauthorized), `createCourse`, `updateCourse`, `publishCourse`, `unpublishCourse`,
  `deleteCourse` Server Actions — all consumed by Task 11

- [ ] **Step 1: Add `instructorUserId` to the validation schema**

In `src/lib/validation.ts`, add to `courseInputSchema`'s object (before the `.superRefine` call):

```ts
instructorUserId: z.string().uuid(),
```

Update `src/lib/validation.test.ts`'s `validCourse` fixture to include a valid UUID for this new
required field, e.g. `instructorUserId: "00000000-0000-0000-0000-000000000000"`.

- [ ] **Step 2: Write the failing authorization test**

Create `src/lib/content/mutations.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const mockSelect = vi.fn();
vi.mock("@/db", () => ({
  db: { select: () => ({ from: () => ({ where: () => mockSelect() }) }) },
}));

const { assertCanManageCourse } = await import("./mutations");

beforeEach(() => {
  mockSelect.mockReset();
});

describe("assertCanManageCourse", () => {
  it("allows admin to manage any course", async () => {
    mockSelect.mockResolvedValue([{ instructorUserId: "someone-else" }]);
    await expect(
      assertCanManageCourse("course-1", { userId: "admin-1", role: "admin" } as never),
    ).resolves.toBeUndefined();
  });

  it("allows an instructor to manage their own course", async () => {
    mockSelect.mockResolvedValue([{ instructorUserId: "instructor-1" }]);
    await expect(
      assertCanManageCourse("course-1", { userId: "instructor-1", role: "instructor" } as never),
    ).resolves.toBeUndefined();
  });

  it("rejects an instructor managing someone else's course", async () => {
    mockSelect.mockResolvedValue([{ instructorUserId: "instructor-1" }]);
    await expect(
      assertCanManageCourse("course-1", { userId: "instructor-2", role: "instructor" } as never),
    ).rejects.toThrow(/not authorized/i);
  });

  it("rejects a learner outright", async () => {
    mockSelect.mockResolvedValue([{ instructorUserId: "instructor-1" }]);
    await expect(
      assertCanManageCourse("course-1", { userId: "instructor-1", role: "learner" } as never),
    ).rejects.toThrow(/not authorized/i);
  });

  it("rejects an unknown course id", async () => {
    mockSelect.mockResolvedValue([]);
    await expect(
      assertCanManageCourse("nope", { userId: "admin-1", role: "admin" } as never),
    ).rejects.toThrow(/not found/i);
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `pnpm vitest run src/lib/content/mutations.test.ts`
Expected: FAIL — cannot resolve `./mutations`.

- [ ] **Step 4: Implement mutations.ts**

Create `src/lib/content/mutations.ts`:

```ts
"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { course, courseModule, lesson } from "@/db/schema";
import { requireRole, type Session } from "@/lib/session";
import { courseInputSchema, type CourseInput } from "@/lib/validation";

export async function assertCanManageCourse(courseId: string, viewer: Session): Promise<void> {
  const [row] = await db
    .select({ instructorUserId: course.instructorUserId })
    .from(course)
    .where(eq(course.id, courseId));

  if (!row) throw new Error("Course not found.");

  if (viewer.role === "admin") return;
  if (viewer.role === "instructor" && row.instructorUserId === viewer.userId) return;

  throw new Error("Not authorized to manage this course.");
}

export type MutationResult = { ok: true } | { ok: false; message: string };

export async function createCourse(input: CourseInput): Promise<MutationResult> {
  const viewer = await requireRole("instructor", "admin");

  const parsed = courseInputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Invalid course." };
  }

  const instructorUserId = viewer.role === "instructor" ? viewer.userId : parsed.data.instructorUserId;

  const [existing] = await db.select({ id: course.id }).from(course).where(eq(course.slug, parsed.data.slug));
  if (existing) {
    return { ok: false, message: "That slug is already in use." };
  }

  await db.transaction(async (tx) => {
    const [insertedCourse] = await tx
      .insert(course)
      .values({
        slug: parsed.data.slug,
        title: parsed.data.title,
        description: parsed.data.description,
        category: parsed.data.category,
        level: parsed.data.level,
        status: "draft",
        instructorUserId,
      })
      .returning();

    for (const m of parsed.data.modules) {
      const [insertedModule] = await tx
        .insert(courseModule)
        .values({ courseId: insertedCourse.id, title: m.title, position: m.position })
        .returning();

      for (const l of m.lessons) {
        await tx.insert(lesson).values({
          moduleId: insertedModule.id,
          courseId: insertedCourse.id,
          slug: l.slug,
          title: l.title,
          content: l.content,
          position: l.position,
          isPreview: l.isPreview,
        });
      }
    }
  });

  revalidatePath("/admin/courses");
  return { ok: true };
}

export async function updateCourse(courseId: string, input: CourseInput): Promise<MutationResult> {
  const viewer = await requireRole("instructor", "admin");
  await assertCanManageCourse(courseId, viewer);

  const parsed = courseInputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Invalid course." };
  }

  const [slugConflict] = await db
    .select({ id: course.id })
    .from(course)
    .where(eq(course.slug, parsed.data.slug));
  if (slugConflict && slugConflict.id !== courseId) {
    return { ok: false, message: "That slug is already in use." };
  }

  await db.transaction(async (tx) => {
    await tx
      .update(course)
      .set({
        title: parsed.data.title,
        slug: parsed.data.slug,
        description: parsed.data.description,
        category: parsed.data.category,
        level: parsed.data.level,
        updatedAt: new Date(),
      })
      .where(eq(course.id, courseId));

    // Replace modules/lessons wholesale — simpler and correct for admin-form-sized courses,
    // where reconciling a diff against reordered/renamed rows isn't worth the complexity.
    await tx.delete(courseModule).where(eq(courseModule.courseId, courseId));

    for (const m of parsed.data.modules) {
      const [insertedModule] = await tx
        .insert(courseModule)
        .values({ courseId, title: m.title, position: m.position })
        .returning();

      for (const l of m.lessons) {
        await tx.insert(lesson).values({
          moduleId: insertedModule.id,
          courseId,
          slug: l.slug,
          title: l.title,
          content: l.content,
          position: l.position,
          isPreview: l.isPreview,
        });
      }
    }
  });

  revalidatePath("/admin/courses");
  revalidatePath(`/courses/${parsed.data.slug}`);
  return { ok: true };
}

export async function publishCourse(courseId: string): Promise<MutationResult> {
  return setStatus(courseId, "published");
}

export async function unpublishCourse(courseId: string): Promise<MutationResult> {
  return setStatus(courseId, "draft");
}

async function setStatus(courseId: string, status: "published" | "draft"): Promise<MutationResult> {
  const viewer = await requireRole("instructor", "admin");
  await assertCanManageCourse(courseId, viewer);

  await db.update(course).set({ status, updatedAt: new Date() }).where(eq(course.id, courseId));
  revalidatePath("/admin/courses");
  return { ok: true };
}

export async function deleteCourse(courseId: string): Promise<MutationResult> {
  const viewer = await requireRole("instructor", "admin");
  await assertCanManageCourse(courseId, viewer);

  await db.delete(course).where(eq(course.id, courseId)); // CASCADE handles modules/lessons/enrollments/progress
  revalidatePath("/admin/courses");
  return { ok: true };
}
```

`assertCanManageCourse` throwing (rather than returning a result) inside `createCourse`/etc. is
intentional — those callers are already inside `requireRole`'s auth boundary, so an unauthorized
attempt there is a bug or an attack, not a normal validation failure users should see a friendly
message for.

- [ ] **Step 5: Run the test to verify it passes**

Run: `pnpm vitest run src/lib/content/mutations.test.ts`
Expected: PASS, 5 tests.

- [ ] **Step 6: Run the full validation suite**

Run: `pnpm vitest run src/lib/validation.test.ts`
Expected: PASS — confirms Step 1's `instructorUserId` addition didn't break existing cases.

- [ ] **Step 7: Typecheck, lint, build**

```bash
pnpm typecheck && pnpm lint && pnpm build
```

- [ ] **Step 8: Commit**

```bash
git add src/lib/content/mutations.ts src/lib/content/mutations.test.ts src/lib/validation.ts src/lib/validation.test.ts
git commit -m "feat: add course CRUD mutations with per-course authorization"
```

---

### Task 11: Wire admin course form and row actions to real mutations

**Files:**
- Modify: `src/components/admin/course-form.tsx`, `src/components/admin/course-row-actions.tsx`, `src/app/admin/courses/new/page.tsx`, `src/app/admin/courses/[id]/edit/page.tsx`

**Interfaces:**
- Consumes: `createCourse`, `updateCourse`, `publishCourse`, `unpublishCourse`, `deleteCourse` (Task 10)
- Produces: an admin course form and row-menu that actually persist

- [ ] **Step 1: Replace the demo toast in `course-form.tsx` with a real mutation call**

Read the current file. Replace the `handleSubmit` success branch (currently
`toast.info(DEMO_TOAST)`) with a real call. The form needs to know whether it's creating or
editing — add a `courseId?: string` prop:

```tsx
// ...unchanged imports, plus:
import { createCourse, updateCourse } from "@/lib/content/mutations";
import { useRouter } from "next/navigation";

// In the component signature, add courseId?: string alongside initial/heading.
// Replace the whole handleSubmit function body with:

async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
  event.preventDefault();

  const result = courseInputSchema.safeParse(state);

  if (!result.success) {
    const nextErrors: Record<string, string> = {};
    for (const issue of result.error.issues) {
      const key = issue.path.join(".");
      if (!nextErrors[key]) nextErrors[key] = issue.message;
    }
    setErrors(nextErrors);

    const firstKey = Object.keys(nextErrors)[0];
    document.getElementById(firstKey)?.focus();
    return;
  }

  setErrors({});
  const mutationResult = courseId
    ? await updateCourse(courseId, result.data)
    : await createCourse(result.data);

  if (!mutationResult.ok) {
    toast.error(mutationResult.message);
    return;
  }

  toast.success(courseId ? "Course updated." : "Course created.");
  router.push("/admin/courses");
}
```

This needs `const router = useRouter();` added near the top of the component, alongside the
existing `useState` calls. Remove the `DEMO_TOAST` constant and the "Demo mode — this form
validates but does not save" banner entirely — the form saves now.

The form also needs an `instructorUserId` field for admins (learners/instructors don't see it —
instructors are always assigned to themselves server-side per Task 10). Add a `Select` for it,
visible only when the session role is `admin`; this requires passing the current session's role
and a list of instructors into the form. Given the scope of that addition, implement it as: pass
`instructors: { userId: string; name: string }[]` and `viewerRole: Role` as new props, sourced by
the two page files in Step 3 below, and render the `Select` conditionally on `viewerRole === "admin"`.

- [ ] **Step 2: Replace the demo toasts in `course-row-actions.tsx`**

Read the current file. Replace:
- The Publish/Unpublish `onClick={() => toast.info(DEMO_TOAST)}` with a real call to
  `publishCourse`/`unpublishCourse`, passing the course's real `id` (the component currently
  receives `courseId` as the *slug* — it needs the actual UUID now; rename the prop internally or
  add a second `id: string` prop for the real primary key, threaded from wherever the table maps
  over courses).
- The Delete confirm dialog's button `onClick={() => toast.info(DEMO_TOAST)}` with a real call to
  `deleteCourse`.

Both should show `toast.success("Course published.")` / `"Course unpublished."` /
`"Course deleted."` on success, `toast.error(result.message)` on failure, and call
`router.refresh()` after a successful mutation so the table reflects the change without a full
reload.

- [ ] **Step 3: Update the two admin course pages to pass real ids and instructor lists**

`src/app/admin/courses/new/page.tsx` needs the current session (for `viewerRole`) and, if admin,
the full instructor list:

```tsx
import type { Metadata } from "next";
import { CourseForm } from "@/components/admin/course-form";
import { requireRole } from "@/lib/session";
import { listInstructors } from "@/lib/content/mutations";

export const metadata: Metadata = { title: "New course" };

export default async function NewCoursePage() {
  const session = await requireRole("instructor", "admin");
  const instructors = session.role === "admin" ? await listInstructors() : [];

  return <CourseForm heading="New course" viewerRole={session.role} instructors={instructors} />;
}
```

This introduces `listInstructors(): Promise<{ userId: string; name: string }[]>` as a new export
from `src/lib/content/mutations.ts` — add it alongside the other functions from Task 10:

```ts
export async function listInstructors(): Promise<{ userId: string; name: string }[]> {
  await requireRole("admin");
  const rows = await db
    .select({ userId: userProfile.userId, name: userProfile.name })
    .from(userProfile)
    .where(or(eq(userProfile.role, "instructor"), eq(userProfile.role, "admin")));
  return rows;
}
```

(This needs `userProfile` and `or` added to `mutations.ts`'s imports.)

`src/app/admin/courses/[id]/edit/page.tsx` needs the course's real `id` (not just its slug) passed
through as `courseId` to `<CourseForm />`, plus the same `viewerRole`/`instructors` wiring. Since
`getCourseBySlug` returns `CourseDetail` which already includes `id` (Task 8's `toDetail` sets
`id: row.id`), thread `course.id` through as the new `courseId` prop.

- [ ] **Step 4: Typecheck, lint, build**

```bash
pnpm typecheck && pnpm lint && pnpm build
```

- [ ] **Step 5: Verify by hand**

```bash
pnpm dev
```

Sign in as an instructor (real session now — Phase 1's role-switcher cookie no longer works;
you'll need a real signed-in user with `role: "instructor"` set directly via SQL for this manual
check until Task 7's flow is fully working). Open `/admin/courses/new`, fill in a course, submit —
confirm it appears in `/admin/courses` and in the real Postgres `course` table. Publish it, confirm
its status badge flips. Delete it, confirm it's gone from both the table and the database.

- [ ] **Step 6: Commit**

```bash
git add src/components/admin src/app/admin/courses src/lib/content/mutations.ts
git commit -m "feat: wire admin course form and row actions to real persistence"
```

---

### Task 12: Enrollment and progress mutations

**Files:**
- Modify: `src/lib/content/mutations.ts`, `src/lib/content/mutations.test.ts`

**Interfaces:**
- Consumes: `db`, `enrollment`, `lessonProgress` (Tasks 1-2), `requireUser` (Task 6)
- Produces: `enrollInCourse(courseSlug: string): Promise<MutationResult>`,
  `toggleLessonComplete(lessonId: string): Promise<{ complete: boolean }>`

- [ ] **Step 1: Write the failing tests**

Add to `src/lib/content/mutations.test.ts`:

```ts
const mockInsert = vi.fn();
const mockDelete = vi.fn();
vi.mock("@/lib/session", () => ({
  requireUser: vi.fn(async () => ({ userId: "user-1", role: "learner" })),
}));

describe("enrollInCourse", () => {
  it("looks up the course by slug and inserts an enrollment row, ignoring duplicates", async () => {
    mockSelect.mockResolvedValueOnce([{ id: "course-1" }]);

    const { enrollInCourse } = await import("./mutations");
    const result = await enrollInCourse("some-course");

    expect(result).toEqual({ ok: true });
  });

  it("returns an error for an unknown course slug", async () => {
    mockSelect.mockResolvedValueOnce([]);

    const { enrollInCourse } = await import("./mutations");
    const result = await enrollInCourse("nope");

    expect(result).toEqual({ ok: false, message: "Course not found." });
  });
});
```

Given how much of `db`'s chained query builder this file already mocks, prefer writing this
particular pair of tests against a real test database (same pattern as Task 8/9) instead of
deepening the mock chain — insert a real course row in a `beforeAll`, call the real
`enrollInCourse`/`toggleLessonComplete`, and assert against real `enrollment`/`lesson_progress`
rows. Replace the sketch above with that approach when implementing this task; it's more honest
about what's actually being verified.

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm vitest run src/lib/content/mutations.test.ts`
Expected: FAIL — `enrollInCourse` doesn't exist yet.

- [ ] **Step 3: Implement the two mutations**

Add to `src/lib/content/mutations.ts`:

```ts
import { enrollment, lessonProgress } from "@/db/schema";
import { requireUser } from "@/lib/session";

export async function enrollInCourse(courseSlug: string): Promise<MutationResult> {
  const viewer = await requireUser();

  const [row] = await db.select({ id: course.id }).from(course).where(eq(course.slug, courseSlug));
  if (!row) return { ok: false, message: "Course not found." };

  await db.insert(enrollment).values({ courseId: row.id, userId: viewer.userId }).onConflictDoNothing();

  revalidatePath(`/courses/${courseSlug}`);
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function toggleLessonComplete(lessonId: string): Promise<{ complete: boolean }> {
  const viewer = await requireUser();

  const [existing] = await db
    .select({ id: lessonProgress.id })
    .from(lessonProgress)
    .where(and(eq(lessonProgress.lessonId, lessonId), eq(lessonProgress.userId, viewer.userId)));

  if (existing) {
    await db.delete(lessonProgress).where(eq(lessonProgress.id, existing.id));
    revalidatePath("/dashboard");
    return { complete: false };
  }

  await db.insert(lessonProgress).values({ lessonId, userId: viewer.userId }).onConflictDoNothing();
  revalidatePath("/dashboard");
  return { complete: true };
}
```

This needs `and` added to the `drizzle-orm` import at the top of the file if not already present.

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm vitest run src/lib/content/mutations.test.ts`
Expected: PASS.

- [ ] **Step 5: Typecheck, lint, build**

```bash
pnpm typecheck && pnpm lint && pnpm build
```

- [ ] **Step 6: Commit**

```bash
git add src/lib/content/mutations.ts src/lib/content/mutations.test.ts
git commit -m "feat: add enrollment and lesson-progress mutations"
```

---

### Task 13: Wire enroll CTA and mark-complete to real mutations

**Files:**
- Modify: `src/app/(site)/courses/[slug]/page.tsx`, `src/components/lesson/complete-toggle.tsx`

**Interfaces:**
- Consumes: `enrollInCourse`, `toggleLessonComplete` (Task 12), `getSession` (Task 6)
- Produces: a real "Enroll" flow and a real mark-complete toggle, no `localStorage` involved

- [ ] **Step 1: Add a real enroll CTA to the course detail page**

Read `src/app/(site)/courses/[slug]/page.tsx`. It currently only renders **Start learning**
linking straight to the first lesson — Phase 1 had no enrollment concept. Add enrollment-gated
logic: if the viewer isn't signed in, the button reads **Sign in to enroll** and links to
`/login`; if signed in but not enrolled, a client `<EnrollButton courseSlug={course.slug} />` that
calls `enrollInCourse` and then reveals **Start learning**; if already enrolled, **Continue
learning** linking to the first lesson (or the first incomplete one — reuse the same
"first incomplete, or lesson 1 if finished" logic already written for
`enrolled-course-card.tsx` in Task 14, since both need it).

Create `src/components/course/enroll-button.tsx`:

```tsx
"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { enrollInCourse } from "@/lib/content/mutations";

export function EnrollButton({ courseSlug }: { courseSlug: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function handleClick() {
    startTransition(async () => {
      const result = await enrollInCourse(courseSlug);
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      toast.success("Enrolled — let's go.");
      router.refresh();
    });
  }

  return (
    <Button onClick={handleClick} disabled={pending}>
      {pending ? "Enrolling…" : "Enroll"}
    </Button>
  );
}
```

The course detail page needs to know whether the viewer is already enrolled — add an
`isEnrolled(courseId: string, userId: string): Promise<boolean>` export to
`src/lib/content/queries.ts` (Task 8's file):

```ts
export async function isEnrolled(courseId: string, userId: string): Promise<boolean> {
  const [row] = await db
    .select({ id: enrollment.id })
    .from(enrollment)
    .where(and(eq(enrollment.courseId, courseId), eq(enrollment.userId, userId)));
  return Boolean(row);
}
```

(Needs `enrollment` and `and` added to that file's imports.)

- [ ] **Step 2: Rewrite `complete-toggle.tsx` to call the real mutation**

Replace its body — it no longer needs `useCompletedLessonIds` (that hook and the whole
`localStorage` progress module get deleted in Task 17; this task removes the last usage of it):

```tsx
"use client";

import { useState, useTransition } from "react";
import { CheckIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { toggleLessonComplete } from "@/lib/content/mutations";

export function CompleteToggle({
  lessonId,
  initialComplete,
}: {
  lessonId: string;
  initialComplete: boolean;
}) {
  const [complete, setComplete] = useState(initialComplete);
  const [pending, startTransition] = useTransition();

  function handleToggle() {
    startTransition(async () => {
      const result = await toggleLessonComplete(lessonId);
      setComplete(result.complete);
      toast.success(result.complete ? "Lesson marked complete" : "Lesson marked incomplete");
    });
  }

  return (
    <Button variant={complete ? "secondary" : "default"} onClick={handleToggle} disabled={pending}>
      {complete ? (
        <>
          <CheckIcon /> Completed
        </>
      ) : (
        "Mark complete"
      )}
    </Button>
  );
}
```

`initialComplete` is now a required prop instead of something the component figures out
client-side — it's server-rendered truth now, not a hydration-mismatch-prone localStorage read.
The lesson reader page (`src/app/(site)/learn/[courseSlug]/[lessonSlug]/page.tsx`) needs to fetch
this: add a query for it (Task 14 covers exactly this pattern for the sidebar/dashboard too, so
implement the underlying read there and pass it down to both call sites consistently).

- [ ] **Step 3: Typecheck, lint, build**

```bash
pnpm typecheck && pnpm lint && pnpm build
```

Expected: this will likely fail until Task 14 provides the `initialComplete` data source — if so,
that's fine, note it and proceed; Tasks 13 and 14 are tightly coupled and may need to land as one
combined commit if the type-checker won't pass with them split. Use judgment: if splitting them
cleanly isn't possible, merge Task 14's work into this commit rather than committing broken code.

- [ ] **Step 4: Commit**

```bash
git add src/app/\(site\)/courses/\[slug\]/page.tsx src/components/course/enroll-button.tsx src/components/lesson/complete-toggle.tsx src/lib/content/queries.ts
git commit -m "feat: wire enrollment and mark-complete to real Postgres mutations"
```

---

### Task 14: Server-render progress; delete the localStorage hook's remaining consumers

**Files:**
- Modify: `src/lib/content/queries.ts`, `src/app/(site)/dashboard/page.tsx`, `src/app/(site)/learn/[courseSlug]/[lessonSlug]/page.tsx`, `src/components/lesson/lesson-sidebar.tsx`, `src/components/course/enrolled-course-card.tsx`, `src/components/course/dashboard-stats.tsx`

**Interfaces:**
- Consumes: `db`, `lessonProgress` (Tasks 1-2)
- Produces: `getCompletedLessonIds(userId: string, lessonIds: string[]): Promise<Set<string>>` —
  a server-side query every progress-displaying component now calls through its page, replacing
  `useCompletedLessonIds`/`useLessonComplete` from Phase 1's `src/lib/progress.ts`

- [ ] **Step 1: Add the server-side progress query**

Add to `src/lib/content/queries.ts`:

```ts
import { lessonProgress } from "@/db/schema";
import { inArray } from "drizzle-orm";

export async function getCompletedLessonIds(
  userId: string,
  lessonIds: string[],
): Promise<Set<string>> {
  if (lessonIds.length === 0) return new Set();

  const rows = await db
    .select({ lessonId: lessonProgress.lessonId })
    .from(lessonProgress)
    .where(and(eq(lessonProgress.userId, userId), inArray(lessonProgress.lessonId, lessonIds)));

  return new Set(rows.map((r) => r.lessonId));
}
```

- [ ] **Step 2: Rewrite `lesson-sidebar.tsx` to take server-computed data as props**

This component currently reads `useCompletedLessonIds()` itself and manages a `Sheet` for mobile.
Split those concerns: the page (Server Component) fetches `getCompletedLessonIds` and passes a
plain `completedLessonIds: string[]` prop down; the component becomes a pure presentational
client component (still needs `"use client"` for the `Sheet`/`usePathname`-equivalent bits, but no
longer needs `useSyncExternalStore`). Read the current file and replace:

```tsx
const completed = useCompletedLessonIds();
```

with:

```tsx
// completedLessonIds is now a prop, not a hook result
```

and change the component's props type to accept `completedLessonIds: string[]` alongside the
existing `modules`/`courseSlug`/`currentLessonSlug`, converting it to a `Set` once at the top of
the component (`const completed = new Set(completedLessonIds);`) instead of subscribing to a
store. Everything downstream (`summarizeProgress`, the per-lesson checkmark logic) stays
unchanged — only where `completed` comes from changes.

- [ ] **Step 3: Update the lesson reader page to fetch and pass progress + `initialComplete`**

In `src/app/(site)/learn/[courseSlug]/[lessonSlug]/page.tsx`, after `requireUser()` and
`getLesson(...)`:

```ts
const lessonIds = lesson.modules.flatMap((m) => m.lessons.map((l) => l.id));
const completed = await getCompletedLessonIds(session.userId, lessonIds);
```

Pass `completedLessonIds={[...completed]}` to `<LessonSidebar />` and
`initialComplete={completed.has(lesson.id)}` to `<CompleteToggle />` (from Task 13).

- [ ] **Step 4: Rewrite `enrolled-course-card.tsx` and `dashboard-stats.tsx` to take server-computed progress**

Same pattern: both currently call `useCompletedLessonIds()` directly. Change
`enrolled-course-card.tsx`'s props to accept `completedLessonIds: string[]` (computed by the
dashboard page per-course) instead of reading the hook; same for `dashboard-stats.tsx`, accepting
a pre-computed `{ lessonsCompleted: number; coursesFinished: number }` instead of `courses` +
reading progress itself. Move the aggregation logic (currently inside `DashboardStats`'s
component body) into the dashboard page itself, since it's now working with server-fetched data
rather than a client store:

```ts
// src/app/(site)/dashboard/page.tsx, after fetching `courses`:
const progressByCourse = await Promise.all(
  courses.map(async (c) => {
    const lessonIds = c.modules.flatMap((m) => m.lessons.map((l) => l.id));
    const completed = await getCompletedLessonIds(session.userId, lessonIds);
    return { course: c, completedLessonIds: [...completed] };
  }),
);
```

Pass `progressByCourse` down; `<DashboardStats />` and each `<EnrolledCourseCard />` become plain
presentational components computing their own displayed numbers from
`completedLessonIds`/`course.modules`, with no data fetching or store subscription of their own.

- [ ] **Step 5: Typecheck, lint, build**

```bash
pnpm typecheck && pnpm lint && pnpm build
```

- [ ] **Step 6: Verify by hand**

Sign in as a real user enrolled in a course (via `enrollInCourse` from Task 13, or a manual DB
insert). Mark a lesson complete in the reader, navigate to `/dashboard`, confirm the course card's
progress bar reflects it — this is a real page navigation now, not a client-side store update, so
there's no cross-component reactivity to verify the way Phase 1's `useSyncExternalStore` gave for
free; a full page load reflecting the DB state is the correct behavior here.

- [ ] **Step 7: Commit**

```bash
git add src/lib/content/queries.ts src/app/\(site\)/dashboard src/app/\(site\)/learn src/components/lesson/lesson-sidebar.tsx src/components/course/enrolled-course-card.tsx src/components/course/dashboard-stats.tsx
git commit -m "feat: server-render lesson progress instead of a client-side store"
```

---

### Task 15: Two-step lesson content authorization

**Files:**
- Modify: `src/lib/content/queries.ts`

**Interfaces:**
- Consumes: `isEnrolled` (Task 13), `enrollment` (Tasks 1-2)
- Produces: `getLesson` now enforces access before returning `content`, per spec §8

- [ ] **Step 1: Split lesson metadata from content in `getLesson`**

Currently (Task 8's implementation), `getLesson` returns full content unconditionally once the
course/lesson exist. Per spec §8, an unauthorized request must never receive `lesson.content` in
the response at all, not just have the UI hide it. Update `getLesson`'s signature to require the
viewer:

```ts
export async function getLesson(
  courseSlug: string,
  lessonSlug: string,
  viewer: { userId: string } | null,
): Promise<LessonWithNav | null> {
  const detail = await getCourseBySlug(courseSlug);
  if (!detail) return null;

  const flat = detail.modules.flatMap((m) => m.lessons);
  const index = flat.findIndex((l) => l.slug === lessonSlug);
  if (index === -1) return null;

  const target = flat[index];
  const canAccess =
    target.isPreview || (viewer !== null && (await isEnrolled(detail.id, viewer.userId)));

  if (!canAccess) return null;

  const { modules: _modules, ...summary } = detail;

  return {
    ...target,
    course: summary,
    modules: detail.modules,
    prev: index > 0 ? toRef(flat[index - 1]) : null,
    next: index < flat.length - 1 ? toRef(flat[index + 1]) : null,
  };
}
```

This is a breaking signature change from Phase 1 (`viewer` is a new required parameter) —
deliberate, since access control genuinely can't happen without knowing who's asking. Every call
site needs updating.

- [ ] **Step 2: Update every call site**

`src/app/(site)/learn/[courseSlug]/[lessonSlug]/page.tsx` already calls `requireUser()` first
(Phase 1 built it that way); pass `{ userId: session.userId }` as the new third argument.

Search for any other `getLesson(` call sites:

```bash
grep -rn "getLesson(" src/ --include="*.tsx" --include="*.ts"
```

Update each the same way. If none exist besides the lesson reader page, this step is done once
that one page is updated.

- [ ] **Step 3: Typecheck, lint, build**

```bash
pnpm typecheck && pnpm lint && pnpm build
```

- [ ] **Step 4: Update `queries.test.ts` for the new signature**

The `getLesson` test from Task 8 needs a `viewer` argument now. For a preview lesson, pass
`null` and confirm it still resolves (preview lessons are viewer-independent). Add a case for a
non-preview lesson: confirm `null` viewer or an unenrolled viewer both get `null` back, and an
enrolled viewer gets the real content — insert a real `enrollment` row in the test's `beforeAll`
for this case.

Run: `pnpm vitest run src/lib/content/queries.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/content/queries.ts src/lib/content/queries.test.ts src/app/\(site\)/learn
git commit -m "feat: enforce enrollment/preview access before returning lesson content"
```

---

### Task 16: Reclassify course/lesson routes away from `generateStaticParams`

**Files:**
- Modify: `src/app/(site)/courses/[slug]/page.tsx`, `src/app/(site)/learn/[courseSlug]/[lessonSlug]/page.tsx`

**Interfaces:**
- Consumes: nothing new
- Produces: routes that reflect admin edits without a redeploy

- [ ] **Step 1: Remove `generateStaticParams` from both routes**

Phase 1 used `generateStaticParams` because content only changed via a redeploy (editing a
Markdown file and pushing). Now that courses/lessons are admin-editable at runtime, prerendering
them at build time would show stale content until the next deploy — remove the
`generateStaticParams` export from both `src/app/(site)/courses/[slug]/page.tsx` and
`src/app/(site)/learn/[courseSlug]/[lessonSlug]/page.tsx`. Leave `generateMetadata` as-is; it
already runs per-request for dynamic params, which is what's wanted now.

- [ ] **Step 2: Typecheck, lint, build**

```bash
pnpm typecheck && pnpm lint && pnpm build
```

Confirm the build's route summary no longer lists these as prerendered — check the `Route (app)`
output for `ƒ` (dynamic) rather than `○`/pre-listed static params on these two routes.

- [ ] **Step 3: Commit**

```bash
git add src/app/\(site\)/courses/\[slug\]/page.tsx src/app/\(site\)/learn
git commit -m "chore: drop generateStaticParams now that course/lesson content is admin-editable at runtime"
```

---

### Task 17: Delete every Phase 1 stand-in

**Files:**
- Delete: `content/`, `src/lib/content/loader.ts`, `src/lib/content/loader.test.ts`, `src/lib/progress.ts`, `src/lib/progress.test.ts`, `src/content/session.ts`, `src/app/actions/set-role.ts`, `src/components/layout/role-switcher.tsx`
- Modify: `src/components/layout/site-header.tsx`, `.env.local`, `.env.example`

**Interfaces:**
- Consumes: `runSeed` (Task 9) — run for real, once, in this task's Step 1, not deferred
- Produces: nothing new

This plan uses a single Neon branch for both development and production (per the "stay on main,
no branch-per-PR previews" decision) — `DATABASE_URL` in `.env.local` already points at the only
database this app has. That means the real, non-test seed run this task needs doesn't wait for a
separate deploy step; it happens right here, against the same database every earlier task has
been developing against.

- [ ] **Step 1: Run the real seed against the working database**

Task 9's own test (`seed.test.ts`) exercises `runSeed()` but cleans up its inserted rows in
`afterAll` — nothing from it persists. Before deleting `content/`, actually run the seed for real
and leave its output in place:

```bash
pnpm db:seed
```

Expected output: `Seeded 5 courses, 20 lessons.` Confirm with a real query
(`psql "$DATABASE_URL" -c "select slug, status from course;"` or the Neon console's SQL editor)
that all 5 courses (4 published + `test-fixture-course` as a draft) are present and staying.

If `pnpm db:seed` fails because `ADMIN_EMAIL` (`nearbyjustine@gmail.com`) hasn't signed up yet
(Task 9's `resolveInstructorUserId` needs at least one `user_profile` row to exist), stop and sign
up for real through `/sign-up` first — insert a real invite code directly if none exists yet
(`INSERT INTO invite_code (code_hash) VALUES ('<sha256 hex of a code you choose>');`, same hashing
`verifyInviteCode` in Task 4 uses) — then re-run `pnpm db:seed`.

- [ ] **Step 2: Confirm nothing still imports the files being deleted**

```bash
grep -rln "src/lib/content/loader\|src/lib/progress\|src/content/session\|role-switcher\|ROLE_COOKIE\|NEXT_PUBLIC_DEMO_MODE" src/ --include="*.ts" --include="*.tsx"
```

The only expected hit left should be `src/db/seed.ts`'s `import { loadAllCourses } from
"@/lib/content/loader"` — Task 9 used the loader one last time for the migration, and Step 1 just
ran it for real. That import is now safe to remove: delete `runSeed`'s content-import half
entirely (the `for (const c of courses) { ... }` block and the `loadAllCourses` import), keeping
only `promoteAdmin` for any future admin-promotion needs. Don't leave working code around whose
only caller (`content/`) is about to stop existing.

If `grep` turns up anything else, resolve it before deleting — it means an earlier task's rewiring
was incomplete.

- [ ] **Step 3: Delete the files**

```bash
git rm -r content/
git rm src/lib/content/loader.ts src/lib/content/loader.test.ts
git rm src/lib/progress.ts src/lib/progress.test.ts
git rm src/content/session.ts
git rm src/app/actions/set-role.ts
git rm src/components/layout/role-switcher.tsx
```

- [ ] **Step 4: Remove the role switcher from the header for real**

`src/components/layout/site-header.tsx` currently has a commented-out/stubbed `<RoleSwitcher />`
from Task 6's temporary fix. Replace that stub with a real sign-out control — a small client
component `src/components/layout/sign-out-button.tsx`:

```tsx
"use client";

import { LogOutIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

export function SignOutButton() {
  async function handleClick() {
    const { authClient } = await import("@/lib/auth/client");
    await authClient.signOut();
    window.location.href = "/";
  }

  return (
    <Button variant="ghost" size="icon-sm" aria-label="Sign out" onClick={handleClick}>
      <LogOutIcon />
    </Button>
  );
}
```

Verify `authClient.signOut()`'s exact call shape against whatever Task 5's client setup turned up.
Render `<SignOutButton />` in `site-header.tsx` next to the initials square, only when
`session` is non-null.

- [ ] **Step 5: Clean up env vars**

Remove `NEXT_PUBLIC_DEMO_MODE=true` from `.env.local` and `.env.example`. Confirm nothing else
references it:

```bash
grep -rn "NEXT_PUBLIC_DEMO_MODE" src/ .env.example
```

Expected: no hits.

- [ ] **Step 6: Typecheck, lint, test, build**

```bash
pnpm typecheck && pnpm lint && pnpm test && pnpm build
```

Expected: all green, with a smaller test suite than before (the deleted `loader.test.ts` and
`progress.test.ts` are gone; everything else should still pass).

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "chore: delete Phase 1 filesystem/localStorage/demo-mode stand-ins

content/, the Markdown loader, localStorage progress tracking, the
hardcoded demo session, the role-switcher cookie, and NEXT_PUBLIC_DEMO_MODE
are all superseded by real Postgres persistence and Neon Auth sessions."
```

---

### Task 18: Tests — full authorization coverage

**Files:**
- Modify: `src/lib/content/mutations.test.ts`

**Interfaces:**
- Consumes: everything from Tasks 10-15
- Produces: end-to-end confidence that authorization holds across the whole write surface, not
  just `assertCanManageCourse` in isolation

- [ ] **Step 1: Write integration tests against a real test database**

Add to `src/lib/content/mutations.test.ts` (or split into a new
`src/lib/content/mutations.integration.test.ts` if the file has grown past the 200-line soft
ceiling from `docs/coding-guidelines.md`) — insert two real courses owned by two different
instructor user ids, then exercise every mutation against both:

```ts
describe("createCourse/updateCourse authorization (integration)", () => {
  it("an instructor cannot update a course owned by a different instructor", async () => {
    // Insert a real course row owned by "instructor-a" in a beforeAll.
    // Mock requireRole to return { userId: "instructor-b", role: "instructor" }.
    // Call updateCourse(thatCourseId, validInput) and assert it throws "Not authorized".
  });

  it("an instructor CAN update their own course", async () => {
    // Same setup, but mock requireRole to return instructor-a's id.
    // Assert the update succeeds and the row actually changed in the DB.
  });

  it("deleteCourse cascades to modules, lessons, enrollments, and progress", async () => {
    // Insert a course with a module, a lesson, an enrollment, and a lesson_progress row.
    // Call deleteCourse. Assert all four child rows are gone, not just the course row.
  });
});
```

Write these against the schema's real cascade behavior (Task 2's `onDelete: "cascade"`
references) rather than mocking — a mocked test can't catch a missing `onDelete` clause, which is
exactly the kind of bug this test exists to catch.

- [ ] **Step 2: Run the full test suite**

```bash
pnpm test
```

Expected: all green, including the new integration cases.

- [ ] **Step 3: Commit**

```bash
git add src/lib/content/mutations.test.ts
git commit -m "test: add end-to-end authorization and cascade-delete coverage"
```

---

### Task 19: Deploy and verify production

**Files:**
- Modify: whatever the sweep turns up

**Interfaces:**
- Consumes: everything
- Produces: a verified production deployment on real data

- [ ] **Step 1: Set production env vars on Vercel**

```bash
vercel env add DATABASE_URL production
vercel env add NEON_AUTH_BASE_URL production
vercel env add NEON_AUTH_COOKIE_SECRET production
vercel env add ADMIN_EMAIL production
vercel env add INVITE_CODE_SECRET production
```

(No `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET` — Google runs through Neon's shared OAuth app, see
the Prerequisites section. `NEON_AUTH_COOKIE_SECRET` IS needed — Task 3 found this is a separate,
required local SDK secret, distinct from Neon's own hosted signing keys; see that task's
"Verified real API" note.) The production domain (`https://sodales.vercel.app`) is already
registered as a trusted Neon Auth domain, so no domain-registration step is needed here.

Remove the now-unused `NEXT_PUBLIC_DEMO_MODE` production env var:

```bash
vercel env rm NEXT_PUBLIC_DEMO_MODE production
```

- [ ] **Step 2: Verify the migration, invite code, and seed are already real — don't redo them**

This plan uses a single Neon branch for both development and "production" (Prerequisites), so
`DATABASE_URL` has pointed at the same database since Task 1. By this point:
- The schema migration ran in Task 2.
- Task 17 Step 1 ran `pnpm db:seed` for real (not just via its test) and confirmed
  `Seeded 5 courses, 20 lessons.` — running it again here would be a no-op at best, since Task 17
  Step 2 also deleted `runSeed`'s content-import half; re-running `pnpm db:seed` now only touches
  `promoteAdmin`, not courses.
- An invite code and a real `ADMIN_EMAIL` sign-up should already exist from Task 17 Step 1's
  fallback path (or an earlier manual check in Tasks 5/7).

Confirm all three with a real query instead of redoing any of them:

```sql
select slug, status from course; -- expect 5 rows, test-fixture-course as draft
select user_id, role from user_profile where role = 'admin'; -- expect ADMIN_EMAIL's row
select count(*) from invite_code where revoked_at is null; -- expect at least 1
```

If any of these come back empty, that's a real gap an earlier task's manual-check step should have
caught — go back and complete it now (sign up as `ADMIN_EMAIL` with a real invite code, run
`pnpm db:seed`) rather than treating it as this task's normal work.

- [ ] **Step 3: Deploy**

```bash
vercel --prod
```

- [ ] **Step 4: Walk the acceptance criteria**

Open spec §12 and check each box against the live production URL:

- Sign-up requires the invite code before Google OAuth is reachable
- `ADMIN_EMAIL` reaches `/admin` after signing up + seeding
- An instructor account (create one by signing up a second Google account, then manually
  promoting its `user_profile.role` to `instructor` via SQL) can create/edit/publish/delete only
  their own courses — attempting another instructor's course fails server-side
- A learner can enroll in a published course, mark a lesson complete, reload the page, and see it
  reflected on `/dashboard`
- An unenrolled request for a non-preview lesson never receives its content
- `content/`, the loader, `progress.ts`, `src/content/session.ts`, the role switcher, and
  `NEXT_PUBLIC_DEMO_MODE` are all gone from the deployed build (check the Vercel build output/
  bundle, not just local `git status`)

- [ ] **Step 5: Final commit**

```bash
git add -A
git commit -m "chore: Phase 2 backend acceptance sweep"
git push
```

---

## Self-Review

**Spec coverage:**

- §3 repository structure → Tasks 1-3, 17 (new `src/db/`, `src/lib/auth/`, old stand-ins deleted)
- §5 data model → Task 2
- §6 auth (Neon Auth, Google, invite code) → Tasks 3-7
- §7 content migration → Task 9
- §8 authorization & mutations → Tasks 10, 12, 15, 18
- §9 error handling → covered inline across Tasks 10-13 (`MutationResult`, thrown errors on
  authorization failure, zod issue messages)
- §10 testing → Tasks 8, 9, 18, plus the `generateStaticParams` open item resolved directly in
  Task 16
- §11 deployment/env → Task 19
- §12 acceptance criteria → Task 19 Step 4 walks every item

**Placeholder scan:** No "TBD"/"add appropriate error handling"-style placeholders. Two spots
intentionally flag unfinished-until-verified work rather than pretending certainty: Task 3's
Neon Auth API shape (explicitly says "verify before writing," gives a best-effort snippet, not a
placeholder) and Task 9's `promoteAdmin`/`resolveInstructorUserId` (explicitly says what's
missing and why, with a concrete next step, not "TODO: finish this").

**Type consistency:** `getLesson`'s signature changes from Task 8 (`courseSlug, lessonSlug`) to
Task 15 (`courseSlug, lessonSlug, viewer`) — Task 15 explicitly calls this out as a deliberate
breaking change and updates the one real call site. `CompleteToggle`'s props gain
`initialComplete` in Task 13, consumed correctly in Task 14 Step 3. `Enrollment` type in
`session.ts` (Task 6) drops `seededCompletedLessonIds` from Phase 1's shape — checked against
`dashboard/page.tsx`'s actual usage (only ever read `courseSlug`) so this isn't a silent breakage.

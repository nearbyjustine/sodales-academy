# Sodales Academy Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a public, clickable, demo-quality Sodales Academy on Vercel — eleven routes, real Markdown course content, simulated login — with no backend.

**Architecture:** Every page reads data through async functions in `src/lib/` whose signatures already match their Phase 2 database equivalents. Phase 1 implements them over the filesystem and a hardcoded user; Phase 2 swaps in Neon + Google OAuth without touching a single page. No component ever reads `content/` or `localStorage` directly.

**Tech Stack:** Next.js 16.3 (App Router, Turbopack) · React 19.2 · TypeScript 5 strict · Tailwind v4.3 · shadcn/ui · zod 4 · gray-matter · react-markdown + remark-gfm · sonner · Vitest 5 · pnpm · Vercel

**Spec:** `docs/superpowers/specs/2026-09-03-academy-frontend-design.md`

## Global Constraints

- **Next.js 16.3.4.** `params`, `searchParams`, and `cookies()` are async — always `await` them. No `middleware.ts` (deprecated; use page guards). `next lint` does not exist — lint via `eslint`.
- **Node 20.9+, TypeScript 5.1+.** Machine has Node 26.8.1.
- **The seam is law.** Only `src/lib/content/loader.ts` may read from `content/`. Only `src/lib/progress.ts` may touch `localStorage`. Only `src/lib/session.ts` may read the role cookie. Pages call the exported query functions and nothing else.
- **All seam functions are `async`** even where no `await` is needed, so Phase 2 does not force a call-site rewrite.
- **Never fake success.** Admin form submits and auth buttons show `"Demo mode — changes aren't saved yet."` / `"Sign-in isn't wired up yet."` No success screens, no optimistic inserts, no redirects implying a write.
- **Palette, exact values:** Obsidian `#111111`, Soft Ivory `#F4F2ED`, Graphite `#35373B`, Electric Violet `#5E4FB3`, Deep Ink `#211C35`, Pale Lilac `#DED9EF`, Paper `#FBFAF7`. **Electric Violet is the only primary-action colour.** Never violet text on obsidian. Never violet as a large product background.
- **Inter only.** No serif anywhere. Weights 400 and 700 only. Body ≥16px, never below 14px for reading text. UI labels uppercase ~11–12px, letter-spacing `0.08em`–`0.12em`.
- **The wordmark is never live text.** Always rendered through `<BrandWordmark />`.
- **Fixed brand strings, never paraphrased:** tagline `Creative Intelligence. Collective Impact.`; descriptor `SODALES is a modern creative intelligence collective where strategy, design & technology converge.`
- **Accessibility on every page:** semantic landmarks, exactly one `h1`, labelled inputs, `role="alert"` on errors, `aria-current="page"` on active nav, focus-visible violet rings, decorative art `aria-hidden`, contrast ≥ 4.5:1, full keyboard operability.
- **All motion respects `prefers-reduced-motion`.**
- Commit after every task. Conventional commit messages.

---

## File Structure

| Path | Responsibility |
| --- | --- |
| `content/courses/<slug>/course.md` | Course frontmatter — title, description, category, level, instructor, modules |
| `content/courses/<slug>/<n>-<slug>.md` | One lesson: frontmatter + Markdown body |
| `src/lib/content/types.ts` | Types mirroring the Phase 2 DB schema field-for-field |
| `src/lib/content/loader.ts` | **The only file that reads `content/`.** Parses frontmatter, orders, validates uniqueness |
| `src/lib/content/queries.ts` | `getCourses` / `getCourseBySlug` / `getLesson` — the Phase 2 seam |
| `src/lib/session.ts` | `getSession` / `requireUser` / `requireRole`, role from cookie |
| `src/lib/progress.ts` | Client-only `localStorage` completion tracking |
| `src/lib/validation.ts` | zod schemas, shared verbatim with Phase 2 |
| `src/content/session.ts` | The hardcoded demo user and their enrollments |
| `src/components/brand/brand-wordmark.tsx` | The only place the wordmark is rendered |
| `src/components/layout/` | Header, footer, nav, role switcher |
| `src/components/course/` | Course card/row, outline, progress bar |
| `src/app/**` | Routes — see spec §5 |

---

### Task 1: Project scaffold and toolchain

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.ts`, `eslint.config.mjs`, `vitest.config.ts`, `src/app/layout.tsx`, `src/app/page.tsx`, `src/app/globals.css`
- Modify: `.gitignore`

**Interfaces:**
- Consumes: nothing (first task)
- Produces: a working `pnpm dev` / `pnpm build` / `pnpm test` / `pnpm lint` / `pnpm typecheck`, and a GitHub remote

- [ ] **Step 1: Install pnpm**

```bash
corepack enable
corepack prepare pnpm@latest --activate
pnpm --version
```

Expected: a version number ≥ 10. If `corepack enable` fails with a permissions error, use `npm install -g pnpm` instead.

- [ ] **Step 2: Scaffold Next.js into the existing directory**

The repo already contains `docs/`, `assets/`, `messages/`, and `.git`. `create-next-app` refuses to write into a non-empty directory, so scaffold into a temp dir and move the files in.

```bash
cd /Users/justine/Documents/sodales
pnpm dlx create-next-app@latest .tmp-scaffold \
  --typescript --tailwind --eslint --app --src-dir \
  --import-alias "@/*" --use-pnpm --turbopack --skip-install --yes
```

- [ ] **Step 3: Move the scaffold into place and clean up**

```bash
cd /Users/justine/Documents/sodales
mv .tmp-scaffold/src .
mv .tmp-scaffold/public .
mv .tmp-scaffold/package.json .tmp-scaffold/tsconfig.json .tmp-scaffold/next.config.ts .
mv .tmp-scaffold/eslint.config.mjs .tmp-scaffold/postcss.config.mjs .
mv .tmp-scaffold/next-env.d.ts . 2>/dev/null || true
rm -rf .tmp-scaffold
pnpm install
```

Verify `ls src/app` shows `layout.tsx`, `page.tsx`, `globals.css`.

- [ ] **Step 4: Set the package name and scripts**

Replace the `name` and `scripts` blocks in `package.json`:

```json
{
  "name": "sodales-academy",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "eslint .",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "test:watch": "vitest"
  }
}
```

Note: `next lint` was removed in Next 16 and `next build` no longer lints — `lint` must call `eslint` directly.

- [ ] **Step 5: Install runtime and test dependencies**

```bash
pnpm add zod gray-matter react-markdown remark-gfm sonner lucide-react clsx tailwind-merge
pnpm add -D vitest @vitejs/plugin-react vite-tsconfig-paths @testing-library/react @testing-library/jest-dom jsdom
```

- [ ] **Step 6: Configure Vitest**

Create `vitest.config.ts`:

```ts
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [react(), tsconfigPaths()],
  test: {
    environment: "jsdom",
    globals: true,
    include: ["src/**/*.test.{ts,tsx}"],
  },
});
```

- [ ] **Step 7: Add a smoke test**

Create `src/lib/smoke.test.ts`:

```ts
import { describe, it, expect } from "vitest";

describe("toolchain", () => {
  it("runs tests", () => {
    expect(1 + 1).toBe(2);
  });
});
```

- [ ] **Step 8: Verify the whole toolchain**

```bash
pnpm test && pnpm typecheck && pnpm lint && pnpm build
```

Expected: all four green. If `pnpm lint` errors that no ESLint config was found, confirm `eslint.config.mjs` exists at the repo root (Next 16 scaffolds flat config by default).

- [ ] **Step 9: Create the GitHub repo and push**

```bash
gh repo create sodales-academy --public --source=. --remote=origin \
  --description "Sodales Academy — learning platform for the Sodales collective"
git add -A
git commit -m "chore: scaffold Next.js 16 app with pnpm, Tailwind v4, Vitest"
git push -u origin main
```

Verify: `gh repo view --web` opens the repo, and it is owned by `nearbyjustine`.

---

### Task 2: Design tokens, fonts, and the brand wordmark

**Files:**
- Modify: `src/app/globals.css`, `src/app/layout.tsx`
- Create: `src/lib/utils.ts`, `src/components/brand/brand-wordmark.tsx`, `src/components/brand/brand-wordmark.test.tsx`, `public/brand/wordmark.png`, `components.json` (via CLI)

**Interfaces:**
- Consumes: Task 1's app shell
- Produces: `cn(...inputs: ClassValue[]): string`; `<BrandWordmark product?: string; className?: string; />`; CSS custom properties `--color-obsidian|ivory|graphite|violet|deep-ink|pale-lilac|paper`; the `Inter` font applied on `<body>`

- [ ] **Step 1: Copy the wordmark asset into public**

```bash
mkdir -p public/brand
cp assets/4.png public/brand/wordmark.png
cp assets/3.png public/brand/mark.png
```

`4.png` is the wordmark-only variant, `3.png` the solid icon mark (per `docs/brand/website-guidelines.md` §4).

- [ ] **Step 2: Define the brand tokens**

Replace the `@theme` block in `src/app/globals.css` (keep the `@import "tailwindcss";` line at the top):

```css
@import "tailwindcss";

@theme {
  --color-obsidian: #111111;
  --color-ivory: #f4f2ed;
  --color-graphite: #35373b;
  --color-violet: #5e4fb3;
  --color-deep-ink: #211c35;
  --color-pale-lilac: #ded9ef;
  --color-paper: #fbfaf7;

  --color-background: var(--color-ivory);
  --color-foreground: var(--color-obsidian);
  --color-muted-foreground: var(--color-graphite);
  --color-border: color-mix(in srgb, var(--color-graphite) 20%, transparent);
  --color-primary: var(--color-violet);
  --color-primary-foreground: var(--color-ivory);
  --color-ring: var(--color-violet);

  --font-sans: var(--font-inter), ui-sans-serif, system-ui, sans-serif;
}

body {
  background: var(--color-background);
  color: var(--color-foreground);
  font-family: var(--font-sans);
  font-size: 1rem;
}

.label-eyebrow {
  text-transform: uppercase;
  font-size: 0.6875rem;
  letter-spacing: 0.12em;
  font-weight: 700;
}

@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}
```

- [ ] **Step 3: Load Inter and set root metadata**

Replace `src/app/layout.tsx`:

```tsx
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { Toaster } from "sonner";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "700"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Sodales Academy",
    template: "%s | Sodales Academy",
  },
  description:
    "SODALES is a modern creative intelligence collective where strategy, design & technology converge.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="antialiased">
        {children}
        <Toaster richColors position="top-right" />
      </body>
    </html>
  );
}
```

- [ ] **Step 4: Create the `cn` helper**

Create `src/lib/utils.ts`:

```ts
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
```

- [ ] **Step 5: Write the failing wordmark test**

Create `src/components/brand/brand-wordmark.test.tsx`:

```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { BrandWordmark } from "./brand-wordmark";

describe("BrandWordmark", () => {
  it("renders the wordmark as an image, never as live text", () => {
    render(<BrandWordmark />);
    const img = screen.getByAltText("Sodales");
    expect(img).toBeDefined();
    expect(screen.queryByText("SODALES")).toBeNull();
  });

  it("renders the product half of the lockup as text", () => {
    render(<BrandWordmark product="Academy" />);
    expect(screen.getByText("Academy")).toBeDefined();
  });
});
```

- [ ] **Step 6: Run the test to verify it fails**

Run: `pnpm vitest run src/components/brand/brand-wordmark.test.tsx`
Expected: FAIL — cannot resolve `./brand-wordmark`.

- [ ] **Step 7: Implement the wordmark**

Create `src/components/brand/brand-wordmark.tsx`:

```tsx
import Image from "next/image";
import { cn } from "@/lib/utils";

type BrandWordmarkProps = {
  /** Product half of the lockup, e.g. "Academy". Omit for the parent wordmark alone. */
  product?: string;
  className?: string;
};

/**
 * The ONLY place the Sodales wordmark is rendered.
 *
 * Brand guidelines §4: the wordmark must ship as artwork and must never be set
 * as live text. Phase 1 uses the supplied PNG; when Rak delivers SVG this file
 * is the single point of change.
 */
export function BrandWordmark({ product, className }: BrandWordmarkProps) {
  return (
    <span className={cn("inline-flex items-center gap-3", className)}>
      <Image
        src="/brand/wordmark.png"
        alt="Sodales"
        width={120}
        height={53}
        priority
        className="h-4 w-auto"
      />
      {product ? (
        <>
          <span aria-hidden="true" className="h-4 w-px bg-graphite/40" />
          <span className="label-eyebrow text-graphite">{product}</span>
        </>
      ) : null}
    </span>
  );
}
```

- [ ] **Step 8: Run the test to verify it passes**

Run: `pnpm vitest run src/components/brand/brand-wordmark.test.tsx`
Expected: PASS, 2 tests.

If `toBeDefined` assertions fail on the jsdom render, add `import "@testing-library/jest-dom/vitest";` to the top of the test file.

- [ ] **Step 9: Initialise shadcn/ui and add base primitives**

```bash
pnpm dlx shadcn@latest init --src-dir --yes
pnpm dlx shadcn@latest add button input textarea label select badge card table dialog dropdown-menu progress skeleton separator sheet
```

When asked for a base colour, choose **Neutral** — our tokens override it. Verify `components.json` exists and `src/components/ui/button.tsx` was created.

- [ ] **Step 10: Verify and commit**

```bash
pnpm test && pnpm typecheck && pnpm lint && pnpm build
git add -A
git commit -m "feat: add brand tokens, Inter, BrandWordmark, and shadcn primitives"
```

---

### Task 3: Content types and the Markdown loader

This is the seam. Everything downstream depends on these shapes matching the Phase 2 database schema in `docs/02-academy.md` §9.

**Files:**
- Create: `src/lib/content/types.ts`, `src/lib/content/loader.ts`, `src/lib/content/loader.test.ts`
- Create (fixtures): `content/courses/test-fixture-course/course.md`, `content/courses/test-fixture-course/01-first-lesson.md`

**Interfaces:**
- Consumes: nothing
- Produces:
  - `type Level = "beginner" | "intermediate" | "advanced"`
  - `type CourseStatus = "draft" | "published"`
  - `type Lesson = { id, slug, title, moduleTitle, position, isPreview, content, courseSlug }`
  - `type CourseModule = { id, title, position, lessons: Lesson[] }`
  - `type CourseSummary = { id, slug, title, description, category, level, status, instructorName, lessonCount }`
  - `type CourseDetail = CourseSummary & { modules: CourseModule[] }`
  - `loadAllCourses(): Promise<CourseDetail[]>`

- [ ] **Step 1: Define the types**

Create `src/lib/content/types.ts`:

```ts
/**
 * These types mirror the Phase 2 database schema in docs/02-academy.md §9
 * field for field, including fields Phase 1 does not yet use (status, isPreview).
 * Do not "simplify" them — Phase 2 swaps the loader, not these shapes.
 */

export type Level = "beginner" | "intermediate" | "advanced";
export type CourseStatus = "draft" | "published";

export type Lesson = {
  id: string;
  courseSlug: string;
  slug: string;
  title: string;
  moduleTitle: string;
  position: number;
  isPreview: boolean;
  content: string;
};

export type CourseModule = {
  id: string;
  title: string;
  position: number;
  lessons: Lesson[];
};

export type CourseSummary = {
  id: string;
  slug: string;
  title: string;
  description: string;
  category: string;
  level: Level;
  status: CourseStatus;
  instructorName: string;
  lessonCount: number;
};

export type CourseDetail = CourseSummary & {
  modules: CourseModule[];
};

export const LEVELS: Level[] = ["beginner", "intermediate", "advanced"];
```

- [ ] **Step 2: Create the test fixture course**

Create `content/courses/test-fixture-course/course.md`:

```markdown
---
title: Test Fixture Course
description: A course used only by the loader unit tests. Not shown in the catalog.
category: Testing
level: beginner
status: draft
instructorName: Test Instructor
---

Body text is ignored for course.md.
```

Create `content/courses/test-fixture-course/01-first-lesson.md`:

```markdown
---
title: First Lesson
module: Getting Started
isPreview: true
---

This is the **first** lesson body.
```

- [ ] **Step 3: Write the failing loader test**

Create `src/lib/content/loader.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { loadAllCourses } from "./loader";

describe("loadAllCourses", () => {
  it("parses course frontmatter into a CourseDetail", async () => {
    const courses = await loadAllCourses();
    const fixture = courses.find((c) => c.slug === "test-fixture-course");

    expect(fixture).toBeDefined();
    expect(fixture!.title).toBe("Test Fixture Course");
    expect(fixture!.level).toBe("beginner");
    expect(fixture!.status).toBe("draft");
    expect(fixture!.instructorName).toBe("Test Instructor");
  });

  it("groups lessons under their module and keeps file order", async () => {
    const courses = await loadAllCourses();
    const fixture = courses.find((c) => c.slug === "test-fixture-course")!;

    expect(fixture.modules).toHaveLength(1);
    expect(fixture.modules[0].title).toBe("Getting Started");
    expect(fixture.modules[0].lessons[0].slug).toBe("first-lesson");
    expect(fixture.modules[0].lessons[0].position).toBe(1);
    expect(fixture.modules[0].lessons[0].isPreview).toBe(true);
  });

  it("strips the numeric prefix from the lesson slug", async () => {
    const courses = await loadAllCourses();
    const fixture = courses.find((c) => c.slug === "test-fixture-course")!;
    expect(fixture.modules[0].lessons[0].slug).not.toContain("01-");
  });

  it("keeps the Markdown body as raw content", async () => {
    const courses = await loadAllCourses();
    const fixture = courses.find((c) => c.slug === "test-fixture-course")!;
    expect(fixture.modules[0].lessons[0].content).toContain("**first**");
  });

  it("counts lessons across all modules", async () => {
    const courses = await loadAllCourses();
    const fixture = courses.find((c) => c.slug === "test-fixture-course")!;
    expect(fixture.lessonCount).toBe(1);
  });
});
```

- [ ] **Step 4: Run the test to verify it fails**

Run: `pnpm vitest run src/lib/content/loader.test.ts`
Expected: FAIL — cannot resolve `./loader`.

- [ ] **Step 5: Implement the loader**

Create `src/lib/content/loader.ts`:

```ts
import "server-only";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import matter from "gray-matter";
import type { CourseDetail, CourseModule, Lesson, Level, CourseStatus } from "./types";

const CONTENT_ROOT = path.join(process.cwd(), "content", "courses");

/**
 * The ONLY module permitted to read from content/.
 * Pages and components must go through src/lib/content/queries.ts instead.
 */
export async function loadAllCourses(): Promise<CourseDetail[]> {
  const slugs = await readCourseSlugs();
  const courses = await Promise.all(slugs.map(loadCourse));

  assertUniqueSlugs(courses);
  return courses.sort((a, b) => a.title.localeCompare(b.title));
}

async function readCourseSlugs(): Promise<string[]> {
  const entries = await readdir(CONTENT_ROOT, { withFileTypes: true });
  return entries.filter((e) => e.isDirectory()).map((e) => e.name);
}

async function loadCourse(slug: string): Promise<CourseDetail> {
  const dir = path.join(CONTENT_ROOT, slug);
  const raw = await readFile(path.join(dir, "course.md"), "utf8");
  const { data } = matter(raw);

  const lessons = await loadLessons(dir, slug);
  const modules = groupIntoModules(lessons);

  return {
    id: slug,
    slug,
    title: requireString(data.title, `${slug}/course.md: title`),
    description: requireString(data.description, `${slug}/course.md: description`),
    category: requireString(data.category, `${slug}/course.md: category`),
    level: data.level as Level,
    status: (data.status ?? "published") as CourseStatus,
    instructorName: requireString(data.instructorName, `${slug}/course.md: instructorName`),
    lessonCount: lessons.length,
    modules,
  };
}

async function loadLessons(dir: string, courseSlug: string): Promise<Lesson[]> {
  const files = (await readdir(dir))
    .filter((f) => f.endsWith(".md") && f !== "course.md")
    .sort();

  const lessons = await Promise.all(
    files.map(async (file, index) => {
      const raw = await readFile(path.join(dir, file), "utf8");
      const { data, content } = matter(raw);
      const slug = file.replace(/^\d+-/, "").replace(/\.md$/, "");

      return {
        id: `${courseSlug}/${slug}`,
        courseSlug,
        slug,
        title: requireString(data.title, `${courseSlug}/${file}: title`),
        moduleTitle: requireString(data.module, `${courseSlug}/${file}: module`),
        position: index + 1,
        isPreview: data.isPreview === true,
        content: content.trim(),
      } satisfies Lesson;
    }),
  );

  assertUniqueLessonSlugs(courseSlug, lessons);
  return lessons;
}

function groupIntoModules(lessons: Lesson[]): CourseModule[] {
  const order: string[] = [];
  const byTitle = new Map<string, Lesson[]>();

  for (const lesson of lessons) {
    if (!byTitle.has(lesson.moduleTitle)) {
      byTitle.set(lesson.moduleTitle, []);
      order.push(lesson.moduleTitle);
    }
    byTitle.get(lesson.moduleTitle)!.push(lesson);
  }

  return order.map((title, index) => ({
    id: `${title.toLowerCase().replace(/\s+/g, "-")}-${index}`,
    title,
    position: index + 1,
    lessons: byTitle.get(title)!,
  }));
}

function requireString(value: unknown, where: string): string {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`Missing required frontmatter — ${where}`);
  }
  return value;
}

function assertUniqueSlugs(courses: CourseDetail[]): void {
  const seen = new Set<string>();
  for (const course of courses) {
    if (seen.has(course.slug)) {
      throw new Error(`Duplicate course slug: ${course.slug}`);
    }
    seen.add(course.slug);
  }
}

function assertUniqueLessonSlugs(courseSlug: string, lessons: Lesson[]): void {
  const seen = new Set<string>();
  for (const lesson of lessons) {
    if (seen.has(lesson.slug)) {
      throw new Error(`Duplicate lesson slug in ${courseSlug}: ${lesson.slug}`);
    }
    seen.add(lesson.slug);
  }
}
```

- [ ] **Step 6: Install `server-only`**

```bash
pnpm add server-only
```

Then add to `vitest.config.ts` inside `defineConfig`, so tests can import the loader:

```ts
  resolve: {
    alias: {
      "server-only": new URL("./src/test/server-only-stub.ts", import.meta.url).pathname,
    },
  },
```

Create `src/test/server-only-stub.ts`:

```ts
export {};
```

- [ ] **Step 7: Run the test to verify it passes**

Run: `pnpm vitest run src/lib/content/loader.test.ts`
Expected: PASS, 5 tests.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat: add content types and Markdown course loader"
```

---

### Task 4: Author the four real courses

Realistic content drawn from what Sodales actually teaches. Placeholder in the sense that a subject-matter expert will replace the prose — but the titles, structure, and level of detail must be demo-credible.

**Files:**
- Create: `content/courses/landing-your-first-client/` (course.md + 5 lessons)
- Create: `content/courses/web-development-foundations/` (course.md + 6 lessons)
- Create: `content/courses/brand-identity-essentials/` (course.md + 4 lessons)
- Create: `content/courses/pricing-and-proposals/` (course.md + 4 lessons)
- Delete: `content/courses/test-fixture-course/` is **kept** — it is `status: draft` and filtered out of the public catalog by Task 5

**Interfaces:**
- Consumes: the frontmatter contract from Task 3
- Produces: 19 lessons across 4 published courses

- [ ] **Step 1: Create the course directories**

```bash
cd /Users/justine/Documents/sodales
mkdir -p content/courses/{landing-your-first-client,web-development-foundations,brand-identity-essentials,pricing-and-proposals}
```

- [ ] **Step 2: Write `landing-your-first-client/course.md`**

```markdown
---
title: Landing Your First Client
description: Go from no clients to a signed first project. Where to look, what to say, and how to handle the conversation when someone finally replies.
category: Freelancing
level: beginner
status: published
instructorName: Justine C.
---
```

- [ ] **Step 3: Write its five lessons**

Files, in order — each with frontmatter `title`, `module`, `isPreview`, then 250–600 words of genuine Markdown using headings, lists, and at least one blockquote or code block where it fits:

| File | Module | `isPreview` | Covers |
| --- | --- | --- | --- |
| `01-why-nobody-replies.md` | Finding Work | `true` | Why cold outreach fails; the difference between a pitch and a conversation |
| `02-where-clients-actually-are.md` | Finding Work | `false` | Referrals, local businesses, communities; why job boards are last |
| `03-the-first-message.md` | Making Contact | `false` | Message structure, specificity, what to leave out; two annotated examples |
| `04-the-discovery-call.md` | Making Contact | `false` | Questions to ask, listening, spotting bad-fit clients early |
| `05-closing-without-being-pushy.md` | Closing | `false` | Summarising scope, presenting a number, handling "let me think about it" |

Write real prose. Do not write `Lorem ipsum`, do not write `TODO`, and do not write one-line stubs — this content is what the demo is judged on.

- [ ] **Step 4: Write `web-development-foundations/course.md` and six lessons**

```markdown
---
title: Web Development Foundations
description: The HTML, CSS, and JavaScript you actually need to ship a client website — taught in the order you will use them, not the order textbooks teach them.
category: Development
level: beginner
status: published
instructorName: Justine C.
---
```

| File | Module | `isPreview` | Covers |
| --- | --- | --- | --- |
| `01-how-the-web-works.md` | Fundamentals | `true` | Browser, server, request/response, what a domain is |
| `02-html-structure.md` | Fundamentals | `false` | Semantic elements, document outline, accessibility from the start |
| `03-css-layout.md` | Styling | `false` | Box model, flexbox, grid, when to use which |
| `04-responsive-design.md` | Styling | `false` | Mobile-first, breakpoints, relative units |
| `05-javascript-basics.md` | Interactivity | `false` | Variables, functions, DOM events |
| `06-shipping-your-first-site.md` | Interactivity | `false` | Hosting, domains, deploying to Vercel |

- [ ] **Step 5: Write `brand-identity-essentials/course.md` and four lessons**

```markdown
---
title: Brand Identity Essentials
description: What a brand is beyond a logo, and how to build one that survives contact with a real business.
category: Branding
level: intermediate
status: published
instructorName: Rak A.
---
```

| File | Module | `isPreview` | Covers |
| --- | --- | --- | --- |
| `01-brand-is-not-a-logo.md` | Strategy | `true` | Positioning, audience, voice |
| `02-building-a-palette.md` | Systems | `false` | Colour roles, contrast, accessibility — reference the Sodales palette |
| `03-choosing-type.md` | Systems | `false` | Typeface pairing, hierarchy, restraint |
| `04-the-brand-guidelines-document.md` | Delivery | `false` | What to include, how clients actually use it |

- [ ] **Step 6: Write `pricing-and-proposals/course.md` and four lessons**

```markdown
---
title: Pricing and Proposals
description: Stop guessing your rate. How to price work, write a proposal that gets signed, and protect yourself from scope creep.
category: Freelancing
level: intermediate
status: published
instructorName: Justine C.
---
```

| File | Module | `isPreview` | Covers |
| --- | --- | --- | --- |
| `01-hourly-vs-fixed.md` | Pricing | `true` | Trade-offs, when each is right, why hourly punishes speed |
| `02-finding-your-number.md` | Pricing | `false` | Cost-based floor, market rate, raising prices |
| `03-writing-the-proposal.md` | Proposals | `false` | Structure, scope, deliverables, timeline, terms |
| `04-scope-creep.md` | Proposals | `false` | Spotting it, change orders, saying no gracefully |

- [ ] **Step 7: Verify the loader reads everything**

Add to `src/lib/content/loader.test.ts`:

```ts
it("loads all four published courses plus the draft fixture", async () => {
  const courses = await loadAllCourses();
  const published = courses.filter((c) => c.status === "published");
  expect(published).toHaveLength(4);
  expect(published.map((c) => c.slug).sort()).toEqual([
    "brand-identity-essentials",
    "landing-your-first-client",
    "pricing-and-proposals",
    "web-development-foundations",
  ]);
});

it("every lesson has a non-trivial body", async () => {
  const courses = await loadAllCourses();
  const lessons = courses
    .filter((c) => c.status === "published")
    .flatMap((c) => c.modules.flatMap((m) => m.lessons));

  expect(lessons).toHaveLength(19);
  for (const lesson of lessons) {
    expect(lesson.content.length).toBeGreaterThan(400);
  }
});
```

Run: `pnpm vitest run src/lib/content/loader.test.ts`
Expected: PASS, 7 tests.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "content: add four courses with 19 authored lessons"
```

---

### Task 5: Content queries — the Phase 2 seam

**Files:**
- Create: `src/lib/content/queries.ts`, `src/lib/content/queries.test.ts`

**Interfaces:**
- Consumes: `loadAllCourses()` from Task 3
- Produces:
  - `getCourses(filters?: { q?: string; level?: Level }): Promise<CourseSummary[]>`
  - `getCourseBySlug(slug: string): Promise<CourseDetail | null>`
  - `getLesson(courseSlug: string, lessonSlug: string): Promise<LessonWithNav | null>`
  - `getCatalogStats(): Promise<{ courses: number; lessons: number; categories: number }>`
  - `type LessonWithNav = Lesson & { course: CourseSummary; prev: LessonRef | null; next: LessonRef | null; modules: CourseModule[] }`
  - `type LessonRef = { courseSlug: string; slug: string; title: string }`

- [ ] **Step 1: Write the failing queries test**

Create `src/lib/content/queries.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { getCourses, getCourseBySlug, getLesson, getCatalogStats } from "./queries";

describe("getCourses", () => {
  it("returns only published courses", async () => {
    const courses = await getCourses();
    expect(courses).toHaveLength(4);
    expect(courses.some((c) => c.slug === "test-fixture-course")).toBe(false);
  });

  it("filters by level", async () => {
    const courses = await getCourses({ level: "intermediate" });
    expect(courses.map((c) => c.slug).sort()).toEqual([
      "brand-identity-essentials",
      "pricing-and-proposals",
    ]);
  });

  it("matches the search term against title and description, case-insensitively", async () => {
    const courses = await getCourses({ q: "PROPOSAL" });
    expect(courses.map((c) => c.slug)).toContain("pricing-and-proposals");
  });

  it("returns an empty array when nothing matches", async () => {
    expect(await getCourses({ q: "zzzznotacourse" })).toEqual([]);
  });

  it("combines search and level filters", async () => {
    const courses = await getCourses({ q: "client", level: "advanced" });
    expect(courses).toEqual([]);
  });
});

describe("getCourseBySlug", () => {
  it("returns a published course with its modules", async () => {
    const course = await getCourseBySlug("landing-your-first-client");
    expect(course).not.toBeNull();
    expect(course!.modules.length).toBeGreaterThan(0);
    expect(course!.lessonCount).toBe(5);
  });

  it("returns null for a draft course", async () => {
    expect(await getCourseBySlug("test-fixture-course")).toBeNull();
  });

  it("returns null for an unknown slug", async () => {
    expect(await getCourseBySlug("nope")).toBeNull();
  });
});

describe("getLesson", () => {
  it("returns the lesson with its course and navigation", async () => {
    const lesson = await getLesson("landing-your-first-client", "where-clients-actually-are");
    expect(lesson).not.toBeNull();
    expect(lesson!.course.slug).toBe("landing-your-first-client");
    expect(lesson!.prev!.slug).toBe("why-nobody-replies");
    expect(lesson!.next!.slug).toBe("the-first-message");
  });

  it("has no prev on the first lesson and no next on the last", async () => {
    const first = await getLesson("landing-your-first-client", "why-nobody-replies");
    expect(first!.prev).toBeNull();

    const last = await getLesson("landing-your-first-client", "closing-without-being-pushy");
    expect(last!.next).toBeNull();
  });

  it("returns null for a lesson in a draft course", async () => {
    expect(await getLesson("test-fixture-course", "first-lesson")).toBeNull();
  });

  it("returns null for an unknown lesson", async () => {
    expect(await getLesson("landing-your-first-client", "nope")).toBeNull();
  });
});

describe("getCatalogStats", () => {
  it("counts published courses, their lessons, and distinct categories", async () => {
    const stats = await getCatalogStats();
    expect(stats.courses).toBe(4);
    expect(stats.lessons).toBe(19);
    expect(stats.categories).toBe(3);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm vitest run src/lib/content/queries.test.ts`
Expected: FAIL — cannot resolve `./queries`.

- [ ] **Step 3: Implement the queries**

Create `src/lib/content/queries.ts`:

```ts
import "server-only";
import { loadAllCourses } from "./loader";
import type { CourseDetail, CourseModule, CourseSummary, Lesson, Level } from "./types";

export type LessonRef = { courseSlug: string; slug: string; title: string };

export type LessonWithNav = Lesson & {
  course: CourseSummary;
  modules: CourseModule[];
  prev: LessonRef | null;
  next: LessonRef | null;
};

/**
 * PHASE 2 SEAM.
 *
 * These four functions are the entire data interface of the app. In Phase 1 they
 * read Markdown from disk; in Phase 2 they run SQL against Neon. Their signatures
 * must not change. No page or component may bypass them.
 */

export async function getCourses(
  filters: { q?: string; level?: Level } = {},
): Promise<CourseSummary[]> {
  const published = (await loadAllCourses()).filter((c) => c.status === "published");
  const q = filters.q?.trim().toLowerCase();

  return published
    .filter((course) => (filters.level ? course.level === filters.level : true))
    .filter((course) => {
      if (!q) return true;
      return (
        course.title.toLowerCase().includes(q) ||
        course.description.toLowerCase().includes(q) ||
        course.category.toLowerCase().includes(q)
      );
    })
    .map(toSummary);
}

export async function getCourseBySlug(slug: string): Promise<CourseDetail | null> {
  const course = (await loadAllCourses()).find((c) => c.slug === slug);
  if (!course || course.status !== "published") return null;
  return course;
}

export async function getLesson(
  courseSlug: string,
  lessonSlug: string,
): Promise<LessonWithNav | null> {
  const course = await getCourseBySlug(courseSlug);
  if (!course) return null;

  const flat = course.modules.flatMap((m) => m.lessons);
  const index = flat.findIndex((l) => l.slug === lessonSlug);
  if (index === -1) return null;

  return {
    ...flat[index],
    course: toSummary(course),
    modules: course.modules,
    prev: index > 0 ? toRef(flat[index - 1]) : null,
    next: index < flat.length - 1 ? toRef(flat[index + 1]) : null,
  };
}

export async function getCatalogStats(): Promise<{
  courses: number;
  lessons: number;
  categories: number;
}> {
  const published = (await loadAllCourses()).filter((c) => c.status === "published");
  return {
    courses: published.length,
    lessons: published.reduce((sum, c) => sum + c.lessonCount, 0),
    categories: new Set(published.map((c) => c.category)).size,
  };
}

function toSummary(course: CourseDetail): CourseSummary {
  const { modules: _modules, ...summary } = course;
  return summary;
}

function toRef(lesson: Lesson): LessonRef {
  return { courseSlug: lesson.courseSlug, slug: lesson.slug, title: lesson.title };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm vitest run src/lib/content/queries.test.ts`
Expected: PASS, 13 tests.

If the `getCatalogStats` categories assertion fails, count distinct `category` values across the four course.md files — Freelancing, Development, Branding = 3.

- [ ] **Step 5: Commit**

```bash
pnpm test && pnpm typecheck && pnpm lint
git add -A
git commit -m "feat: add content query seam matching Phase 2 database signatures"
```

---

### Task 6: Simulated session and the role switcher

**Files:**
- Create: `src/content/session.ts`, `src/lib/session.ts`, `src/lib/session.test.ts`, `src/app/actions/set-role.ts`, `src/components/layout/role-switcher.tsx`
- Modify: `.env.local` (create), `next.config.ts`

**Interfaces:**
- Consumes: `CourseSummary` from Task 3
- Produces:
  - `type Role = "learner" | "instructor" | "admin"`
  - `type Session = { userId: string; name: string; email: string; initials: string; role: Role }`
  - `getSession(): Promise<Session | null>`
  - `requireUser(): Promise<Session>` — redirects to `/login`
  - `requireRole(...roles: Role[]): Promise<Session>` — redirects to `/`
  - `getEnrollments(): Promise<Enrollment[]>` where `Enrollment = { courseSlug: string; seededCompletedLessonIds: string[] }`
  - `setRole(role: Role): Promise<void>` server action
  - `<RoleSwitcher current={Role} />`

- [ ] **Step 1: Create the demo user**

Create `src/content/session.ts`:

```ts
import type { Role } from "@/lib/session";

/**
 * PHASE 1 ONLY. The hardcoded demo user.
 * Phase 2 deletes this file and reads a real Neon Auth session instead.
 */
export const DEMO_USER = {
  userId: "demo-user-0001",
  name: "Alex Rivera",
  email: "alex@sodales.app",
  initials: "AR",
  defaultRole: "learner" as Role,
};

export type Enrollment = {
  courseSlug: string;
  /** Lesson ids pre-marked complete on first load, so progress bars are populated. */
  seededCompletedLessonIds: string[];
};

/** One finished course, one in progress, one just started. */
export const DEMO_ENROLLMENTS: Enrollment[] = [
  {
    courseSlug: "landing-your-first-client",
    seededCompletedLessonIds: [
      "landing-your-first-client/why-nobody-replies",
      "landing-your-first-client/where-clients-actually-are",
      "landing-your-first-client/the-first-message",
      "landing-your-first-client/the-discovery-call",
      "landing-your-first-client/closing-without-being-pushy",
    ],
  },
  {
    courseSlug: "web-development-foundations",
    seededCompletedLessonIds: [
      "web-development-foundations/how-the-web-works",
      "web-development-foundations/html-structure",
    ],
  },
  {
    courseSlug: "pricing-and-proposals",
    seededCompletedLessonIds: [],
  },
];
```

- [ ] **Step 2: Write the failing session test**

Create `src/lib/session.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const cookieStore = { value: undefined as string | undefined };

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) =>
      name === "sodales-demo-role" && cookieStore.value
        ? { name, value: cookieStore.value }
        : undefined,
  }),
}));

const redirectMock = vi.fn(() => {
  throw new Error("NEXT_REDIRECT");
});
vi.mock("next/navigation", () => ({ redirect: redirectMock }));

const { getSession, requireRole } = await import("./session");

beforeEach(() => {
  cookieStore.value = undefined;
  redirectMock.mockClear();
});

describe("getSession", () => {
  it("defaults to the learner role when no cookie is set", async () => {
    const session = await getSession();
    expect(session!.role).toBe("learner");
    expect(session!.name).toBe("Alex Rivera");
  });

  it("reads the role from the cookie", async () => {
    cookieStore.value = "admin";
    expect((await getSession())!.role).toBe("admin");
  });

  it("falls back to learner for an unrecognised cookie value", async () => {
    cookieStore.value = "superuser";
    expect((await getSession())!.role).toBe("learner");
  });
});

describe("requireRole", () => {
  it("returns the session when the role is sufficient", async () => {
    cookieStore.value = "admin";
    const session = await requireRole("instructor", "admin");
    expect(session.role).toBe("admin");
  });

  it("redirects when the role is insufficient", async () => {
    cookieStore.value = "learner";
    await expect(requireRole("admin")).rejects.toThrow("NEXT_REDIRECT");
    expect(redirectMock).toHaveBeenCalledWith("/");
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `pnpm vitest run src/lib/session.test.ts`
Expected: FAIL — cannot resolve `./session`.

- [ ] **Step 4: Implement the session seam**

Create `src/lib/session.ts`:

```ts
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { DEMO_USER, DEMO_ENROLLMENTS, type Enrollment } from "@/content/session";

export type Role = "learner" | "instructor" | "admin";

export type Session = {
  userId: string;
  name: string;
  email: string;
  initials: string;
  role: Role;
};

export const ROLE_COOKIE = "sodales-demo-role";
const ROLES: Role[] = ["learner", "instructor", "admin"];

/**
 * PHASE 2 SEAM.
 *
 * Signatures match what Neon Auth will provide. Phase 1 returns a hardcoded user
 * whose role comes from a cookie set by the demo role switcher. Phase 2 replaces
 * the bodies; every call site stays as written.
 */

export async function getSession(): Promise<Session | null> {
  const store = await cookies();
  const raw = store.get(ROLE_COOKIE)?.value;
  const role: Role = ROLES.includes(raw as Role) ? (raw as Role) : DEMO_USER.defaultRole;

  return {
    userId: DEMO_USER.userId,
    name: DEMO_USER.name,
    email: DEMO_USER.email,
    initials: DEMO_USER.initials,
    role,
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
  return DEMO_ENROLLMENTS;
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `pnpm vitest run src/lib/session.test.ts`
Expected: PASS, 5 tests.

- [ ] **Step 6: Add the role-setting server action**

Create `src/app/actions/set-role.ts`:

```ts
"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { ROLE_COOKIE, type Role } from "@/lib/session";

export async function setRole(role: Role) {
  const store = await cookies();
  store.set(ROLE_COOKIE, role, { path: "/", httpOnly: false, sameSite: "lax" });
  revalidatePath("/", "layout");
}
```

- [ ] **Step 7: Build the role switcher**

Create `src/components/layout/role-switcher.tsx`. Requirements:

- `"use client"`; props `{ current: Role }`.
- Renders a `DropdownMenu` trigger labelled `DEMO · {current}` with a violet outline (`border-violet text-violet`) and the `label-eyebrow` class, so it reads as a development tool rather than product chrome.
- Menu items: Learner, Instructor, Admin — each calls `setRole` then `router.refresh()`.
- A separator, then a **Reset demo progress** item calling `resetProgress()` from Task 7 and reloading.
- `aria-label="Demo role switcher"` on the trigger.
- The whole component returns `null` when `process.env.NEXT_PUBLIC_DEMO_MODE !== "true"`, so Phase 2 disables it with one env var before deleting the file.

- [ ] **Step 8: Set the demo-mode env var**

Create `.env.local`:

```
NEXT_PUBLIC_DEMO_MODE=true
```

Also create `.env.example` with the same line, committed, so the variable is discoverable.

- [ ] **Step 9: Verify and commit**

```bash
pnpm test && pnpm typecheck && pnpm lint && pnpm build
git add -A
git commit -m "feat: add simulated session seam and demo role switcher"
```

---

### Task 7: Browser progress tracking

**Files:**
- Create: `src/lib/progress.ts`, `src/lib/progress.test.ts`

**Interfaces:**
- Consumes: `DEMO_ENROLLMENTS` from Task 6
- Produces:
  - `getCompletedLessonIds(): Set<string>`
  - `isLessonComplete(lessonId: string): boolean`
  - `toggleLessonComplete(lessonId: string): boolean` — returns the new state
  - `getCourseProgress(courseSlug: string, lessonIds: string[]): { completed: number; total: number; percent: number }`
  - `resetProgress(): void`
  - `PROGRESS_STORAGE_KEY = "sodales-academy-progress"`

- [ ] **Step 1: Write the failing progress test**

Create `src/lib/progress.test.ts`:

```ts
import { describe, it, expect, beforeEach } from "vitest";
import {
  PROGRESS_STORAGE_KEY,
  getCompletedLessonIds,
  isLessonComplete,
  toggleLessonComplete,
  getCourseProgress,
  resetProgress,
} from "./progress";

beforeEach(() => {
  window.localStorage.clear();
});

describe("seeding", () => {
  it("seeds from the demo enrollments on first read", () => {
    const ids = getCompletedLessonIds();
    expect(ids.has("landing-your-first-client/why-nobody-replies")).toBe(true);
    expect(ids.has("pricing-and-proposals/hourly-vs-fixed")).toBe(false);
  });

  it("does not re-seed once a value exists", () => {
    window.localStorage.setItem(PROGRESS_STORAGE_KEY, JSON.stringify([]));
    expect(getCompletedLessonIds().size).toBe(0);
  });
});

describe("toggleLessonComplete", () => {
  it("marks an incomplete lesson complete and persists it", () => {
    const id = "pricing-and-proposals/hourly-vs-fixed";
    expect(toggleLessonComplete(id)).toBe(true);
    expect(isLessonComplete(id)).toBe(true);

    const stored = JSON.parse(window.localStorage.getItem(PROGRESS_STORAGE_KEY)!);
    expect(stored).toContain(id);
  });

  it("unmarks a complete lesson", () => {
    const id = "landing-your-first-client/why-nobody-replies";
    expect(toggleLessonComplete(id)).toBe(false);
    expect(isLessonComplete(id)).toBe(false);
  });
});

describe("getCourseProgress", () => {
  it("computes completed, total, and percent", () => {
    const lessonIds = [
      "web-development-foundations/how-the-web-works",
      "web-development-foundations/html-structure",
      "web-development-foundations/css-layout",
      "web-development-foundations/responsive-design",
    ];
    expect(getCourseProgress("web-development-foundations", lessonIds)).toEqual({
      completed: 2,
      total: 4,
      percent: 50,
    });
  });

  it("returns 0 percent for a course with no lessons rather than dividing by zero", () => {
    expect(getCourseProgress("empty", [])).toEqual({ completed: 0, total: 0, percent: 0 });
  });

  it("rounds percent to a whole number", () => {
    const lessonIds = ["a", "b", "c"];
    toggleLessonComplete("a");
    expect(getCourseProgress("x", lessonIds).percent).toBe(33);
  });
});

describe("resetProgress", () => {
  it("clears storage and re-seeds on the next read", () => {
    toggleLessonComplete("pricing-and-proposals/hourly-vs-fixed");
    resetProgress();
    const ids = getCompletedLessonIds();
    expect(ids.has("pricing-and-proposals/hourly-vs-fixed")).toBe(false);
    expect(ids.has("landing-your-first-client/why-nobody-replies")).toBe(true);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm vitest run src/lib/progress.test.ts`
Expected: FAIL — cannot resolve `./progress`.

- [ ] **Step 3: Implement progress**

Create `src/lib/progress.ts`:

```ts
import { DEMO_ENROLLMENTS } from "@/content/session";

export const PROGRESS_STORAGE_KEY = "sodales-academy-progress";

/**
 * PHASE 1 ONLY — the ONLY module permitted to touch localStorage.
 * Phase 2 replaces this with lesson_progress rows; the exported signatures stay.
 */

function seed(): string[] {
  return DEMO_ENROLLMENTS.flatMap((e) => e.seededCompletedLessonIds);
}

function read(): string[] {
  if (typeof window === "undefined") return seed();

  const raw = window.localStorage.getItem(PROGRESS_STORAGE_KEY);
  if (raw === null) {
    const seeded = seed();
    window.localStorage.setItem(PROGRESS_STORAGE_KEY, JSON.stringify(seeded));
    return seeded;
  }

  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((v) => typeof v === "string") : [];
  } catch {
    return [];
  }
}

function write(ids: string[]): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(PROGRESS_STORAGE_KEY, JSON.stringify(ids));
}

export function getCompletedLessonIds(): Set<string> {
  return new Set(read());
}

export function isLessonComplete(lessonId: string): boolean {
  return getCompletedLessonIds().has(lessonId);
}

export function toggleLessonComplete(lessonId: string): boolean {
  const ids = getCompletedLessonIds();
  const nowComplete = !ids.has(lessonId);

  if (nowComplete) ids.add(lessonId);
  else ids.delete(lessonId);

  write([...ids]);
  return nowComplete;
}

export function getCourseProgress(
  _courseSlug: string,
  lessonIds: string[],
): { completed: number; total: number; percent: number } {
  const done = getCompletedLessonIds();
  const completed = lessonIds.filter((id) => done.has(id)).length;
  const total = lessonIds.length;

  return {
    completed,
    total,
    percent: total === 0 ? 0 : Math.round((completed / total) * 100),
  };
}

export function resetProgress(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(PROGRESS_STORAGE_KEY);
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm vitest run src/lib/progress.test.ts`
Expected: PASS, 8 tests.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: add browser-backed lesson progress tracking"
```

---

### Task 8: App shell — header, footer, and system states

**Files:**
- Create: `src/components/layout/site-header.tsx`, `src/components/layout/site-footer.tsx`, `src/app/loading.tsx`, `src/app/error.tsx`, `src/app/not-found.tsx`
- Modify: `src/app/layout.tsx`

**Interfaces:**
- Consumes: `BrandWordmark` (Task 2), `getSession` (Task 6), `RoleSwitcher` (Task 6)
- Produces: `<SiteHeader />`, `<SiteFooter />` — used by every route

- [ ] **Step 1: Build the site header**

Create `src/components/layout/site-header.tsx` — an async server component.

- Sticky, `bg-ivory/85 backdrop-blur`, bottom hairline `border-b border-border`.
- Left: `<BrandWordmark product="Academy" />` linking to `/`.
- Centre nav (`<nav aria-label="Main">`): Courses `/courses`, Dashboard `/dashboard`, and Admin `/admin` shown only when `session.role` is `instructor` or `admin`.
- Active link styling via `usePathname` in a small client child, with `aria-current="page"`.
- Right: `<RoleSwitcher current={session.role} />` and the user initials in a bordered square.
- Mobile: a `Sheet` triggered by a menu button with `aria-expanded` and `aria-label="Open menu"`.
- Nav labels use `label-eyebrow`; hover and focus states use `text-violet` and a violet focus ring.

- [ ] **Step 2: Build the site footer**

Create `src/components/layout/site-footer.tsx`.

- `bg-obsidian text-ivory`, generous vertical padding.
- `<BrandWordmark />` plus the descriptor verbatim: `SODALES is a modern creative intelligence collective where strategy, design & technology converge.`
- A sibling-products column linking to Main, Persona, Cinema, Talents, Store as `#` placeholders with a `title` explaining they are not yet live.
- `© 2026 Sodales` and the tagline `Creative Intelligence. Collective Impact.`
- Links use the accessible violet tint `#887BD8` on obsidian, never `#5E4FB3` — brand guidelines §2 forbids violet text on obsidian.

- [ ] **Step 3: Wire them into the root layout**

In `src/app/layout.tsx`, wrap `{children}` so the body renders `<SiteHeader />`, `<main className="min-h-[60vh]">{children}</main>`, `<SiteFooter />`.

- [ ] **Step 4: Add the three system states**

`src/app/loading.tsx` — `Skeleton` blocks approximating a hero and a three-card row, wrapped in a container with `aria-busy="true"` and a visually hidden "Loading" announcement.

`src/app/error.tsx` — `"use client"`, props `{ error, reset }`, renders "Something went wrong", a short explanation, a **Try again** button calling `reset()`, and a link home.

`src/app/not-found.tsx` — designed 404 with an `h1`, a sentence, and buttons to **Browse courses** and **Home**.

- [ ] **Step 5: Verify and commit**

```bash
pnpm typecheck && pnpm lint && pnpm build
git add -A
git commit -m "feat: add app shell with header, footer, and system states"
```

---

### Task 9: Home page

**Files:**
- Modify: `src/app/page.tsx`

**Interfaces:**
- Consumes: `getCourses`, `getCatalogStats` (Task 5), `BrandWordmark` (Task 2)
- Produces: the `/` route

- [ ] **Step 1: Build the page**

Replace `src/app/page.tsx` with an async server component containing, in order:

1. **Editorial split hero** — left column: `label-eyebrow` "Sodales Academy", an `h1` at `text-5xl md:text-7xl font-bold tracking-tight leading-[0.95]`, a lead paragraph, and two buttons (Browse courses → `/courses` filled violet; View dashboard → `/dashboard` outlined). Right column: a flat bordered panel on `--color-deep-ink` carrying the tagline `Creative Intelligence. Collective Impact.` set large. No image — there is no Academy art asset in this repo, and inventing one is out of scope.
2. **Live stats row** — three numbers from `getCatalogStats()`: courses, lessons, categories. Large numerals, `label-eyebrow` captions, separated by hairline rules.
3. **Learning tracks** — an indexed editorial list (`01`, `02`, `03`) of the distinct categories, each linking to `/courses?q=<category>`. Numbered rows with hairline dividers, not a card grid.
4. **Featured courses** — the first three from `getCourses()` as editorial rows: level badge, title, description, lesson count, and a "View course" affordance. Full-row link.
5. **CTA band** — `bg-obsidian text-ivory`, a heading, and a violet-filled button to `/courses`.

Exactly one `h1` on the page. Section headings are `h2`.

- [ ] **Step 2: Check it renders**

```bash
pnpm dev
```

Open `http://localhost:3000`. Confirm: stats show 4 / 19 / 3, three featured courses appear, the header and footer render, and the role switcher is visible with a violet outline.

- [ ] **Step 3: Verify and commit**

```bash
pnpm typecheck && pnpm lint && pnpm build
git add -A
git commit -m "feat: add home page"
```

---

### Task 10: First Vercel deploy

Deploying now — with only the home page done — proves the pipeline while it is still cheap to debug. Every later task redeploys on push.

**Files:**
- Create: `vercel.json`

**Interfaces:**
- Consumes: a green `pnpm build` from Task 9
- Produces: a public production URL

- [ ] **Step 1: Pin the region**

Create `vercel.json`:

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "regions": ["sin1"]
}
```

- [ ] **Step 2: Link and deploy**

```bash
vercel link --yes
vercel env add NEXT_PUBLIC_DEMO_MODE production
# paste: true
vercel --prod
```

- [ ] **Step 3: Verify the deployment**

Open the printed URL. Confirm the home page renders with fonts, tokens, and stats. **This URL is public** — anyone with the link can see it (owner-approved).

If the build fails on Vercel but passes locally, check that `content/` is committed — it is application data, not build output, and must not be gitignored.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "chore: pin Vercel region to sin1"
git push
```

---

### Task 11: Course catalog

**Files:**
- Create: `src/app/courses/page.tsx`, `src/app/courses/loading.tsx`, `src/components/course/course-row.tsx`, `src/components/course/catalog-filters.tsx`

**Interfaces:**
- Consumes: `getCourses` (Task 5)
- Produces: `<CourseRow course={CourseSummary} />`, the `/courses` route

- [ ] **Step 1: Build the course row**

Create `src/components/course/course-row.tsx` — a server component taking `{ course: CourseSummary }`.

Editorial bordered row, not a card: level `Badge`, category in `label-eyebrow`, `h3` title, description clamped to two lines, lesson count, instructor name. The whole row is a link to `/courses/${course.slug}` with a violet hover border and a visible focus ring.

- [ ] **Step 2: Build the filters**

Create `src/components/course/catalog-filters.tsx` — `"use client"`.

- A search `Input` with a visible `Label`, submitting on Enter and updating the `q` search param via `useRouter().push`.
- Level filter chips: All, Beginner, Intermediate, Advanced — updating the `level` param, current selection marked with `aria-pressed`.
- Sticky on desktop, horizontally scrollable on mobile.

- [ ] **Step 3: Build the page**

Create `src/app/courses/page.tsx`.

**Next 16: `searchParams` is a Promise and must be awaited.**

```tsx
type PageProps = {
  searchParams: Promise<{ q?: string; level?: string }>;
};

export default async function CoursesPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const level = LEVELS.includes(params.level as Level) ? (params.level as Level) : undefined;
  const courses = await getCourses({ q: params.q, level });
  // ...
}
```

Render: `h1` "Courses", the filters, a result count in a `<p aria-live="polite">` reading `{n} courses`, then the rows. When `courses.length === 0`, render a designed empty state — icon, "No courses match", a sentence, and a **Clear filters** button linking to `/courses`.

Add `export const metadata` with title "Courses" and a description.

- [ ] **Step 4: Add the loading skeleton**

Create `src/app/courses/loading.tsx` — a heading skeleton, a filter-bar skeleton, and four row skeletons, in a container with `aria-busy="true"`.

- [ ] **Step 5: Verify by hand**

With `pnpm dev` running, check: `/courses` lists 4; `/courses?level=intermediate` lists 2; `/courses?q=proposal` lists 1; `/courses?q=zzz` shows the empty state; `/courses?level=nonsense` falls back to showing all 4 rather than erroring.

- [ ] **Step 6: Verify and commit**

```bash
pnpm typecheck && pnpm lint && pnpm build
git add -A && git commit -m "feat: add course catalog with search and level filter" && git push
```

---

### Task 12: Course detail

**Files:**
- Create: `src/app/courses/[slug]/page.tsx`, `src/app/courses/[slug]/loading.tsx`, `src/components/course/course-outline.tsx`

**Interfaces:**
- Consumes: `getCourseBySlug` (Task 5)
- Produces: `<CourseOutline modules={CourseModule[]} courseSlug={string} />`, the `/courses/[slug]` route

- [ ] **Step 1: Build the outline**

Create `src/components/course/course-outline.tsx` taking `{ modules, courseSlug }`.

For each module: a `label-eyebrow` number and title, the lesson count, then its lessons as rows. Each lesson row shows its position, title, a **Preview** badge when `isPreview`, and links to `/learn/${courseSlug}/${lesson.slug}`.

**The whole row must be the link**, including on touch — `docs/02-academy.md` §4 calls out persistent full-row links specifically. Do not put the anchor on the title text alone.

- [ ] **Step 2: Build the page**

Create `src/app/courses/[slug]/page.tsx`.

**Next 16: `params` is a Promise.**

```tsx
type PageProps = { params: Promise<{ slug: string }> };

export async function generateStaticParams() {
  const courses = await getCourses();
  return courses.map((course) => ({ slug: course.slug }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const course = await getCourseBySlug(slug);
  if (!course) return { title: "Course not found" };
  return { title: course.title, description: course.description };
}

export default async function CoursePage({ params }: PageProps) {
  const { slug } = await params;
  const course = await getCourseBySlug(slug);
  if (!course) notFound();
  // ...
}
```

Render: a header with level badge, category, `h1` title, instructor, lesson and module counts; the description; a violet **Start learning** button linking to the first lesson; then `<CourseOutline />`.

- [ ] **Step 3: Add the loading skeleton**

Create `src/app/courses/[slug]/loading.tsx`.

- [ ] **Step 4: Verify by hand**

Check `/courses/landing-your-first-client` renders 5 lessons across 3 modules with the preview badge on lesson 1. Check `/courses/test-fixture-course` returns the 404 page — the draft course must not be reachable. Check `/courses/nope` returns 404.

- [ ] **Step 5: Verify and commit**

```bash
pnpm typecheck && pnpm lint && pnpm build
git add -A && git commit -m "feat: add course detail page with outline" && git push
```

---

### Task 13: Lesson reader

**Files:**
- Create: `src/app/learn/[courseSlug]/[lessonSlug]/page.tsx`, `src/app/learn/[courseSlug]/[lessonSlug]/loading.tsx`, `src/components/lesson/lesson-body.tsx`, `src/components/lesson/lesson-sidebar.tsx`, `src/components/lesson/complete-toggle.tsx`

**Interfaces:**
- Consumes: `getLesson` (Task 5), `requireUser` (Task 6), `toggleLessonComplete` / `isLessonComplete` / `getCourseProgress` (Task 7)
- Produces: the `/learn/[courseSlug]/[lessonSlug]` route

- [ ] **Step 1: Build the Markdown body**

Create `src/components/lesson/lesson-body.tsx` taking `{ content: string }`.

Uses `react-markdown` with `remark-gfm`. Styles are applied through explicit `components` overrides, not a prose plugin — headings in Inter bold with tight tracking, body at `text-base leading-relaxed` on `--color-paper`, `max-w-[68ch]`, blockquotes with a violet left rule, `code` on a pale-lilac tint, and links in violet with underline.

- [ ] **Step 2: Build the completion toggle**

Create `src/components/lesson/complete-toggle.tsx` — `"use client"`, props `{ lessonId: string }`.

Reads `isLessonComplete(lessonId)` in a `useEffect` (never during render — localStorage is unavailable during SSR and reading it in render causes hydration mismatch). Renders a button that toggles state, shows a check icon and "Completed" when done, "Mark complete" when not, and fires a `sonner` toast on change.

- [ ] **Step 3: Build the sidebar**

Create `src/components/lesson/lesson-sidebar.tsx` — `"use client"`, props `{ modules, courseSlug, currentLessonSlug }`.

Sticky on desktop (`lg:sticky lg:top-20`), collapsed into a `Sheet` on mobile. Lists every module and lesson; the current lesson is marked with `aria-current="page"` and a violet left rule; completed lessons show a check icon. A course progress bar sits at the top with `role="progressbar"` and `aria-valuenow`.

- [ ] **Step 4: Build the page**

Create `src/app/learn/[courseSlug]/[lessonSlug]/page.tsx`.

```tsx
type PageProps = { params: Promise<{ courseSlug: string; lessonSlug: string }> };

export default async function LessonPage({ params }: PageProps) {
  const { courseSlug, lessonSlug } = await params;
  await requireUser();

  const lesson = await getLesson(courseSlug, lessonSlug);
  if (!lesson) notFound();
  // ...
}
```

Layout: a sticky sub-header with the course title, back link, and progress; a two-column body (`lg:grid-cols-[280px_1fr]`) with the sidebar and a `max-w-3xl` reading column; `<LessonBody />`; the `<CompleteToggle />`; and prev/next navigation at the foot, disabled where `prev`/`next` is `null`.

Add `generateStaticParams` returning every course/lesson pair. Add `export const metadata = { robots: { index: false } }`.

- [ ] **Step 5: Add the loading skeleton**

Create the matching `loading.tsx`.

- [ ] **Step 6: Verify by hand**

Open `/learn/landing-your-first-client/why-nobody-replies`. Confirm: Markdown renders with real headings and lists; the sidebar shows all 5 lessons with the current one marked; **Mark complete** toggles, toasts, and survives a page refresh; prev is disabled on lesson 1; next is disabled on lesson 5.

- [ ] **Step 7: Verify and commit**

```bash
pnpm typecheck && pnpm lint && pnpm build
git add -A && git commit -m "feat: add lesson reader with Markdown, outline, and completion" && git push
```

---

### Task 14: Learner dashboard

**Files:**
- Create: `src/app/dashboard/page.tsx`, `src/app/dashboard/loading.tsx`, `src/components/course/enrolled-course-card.tsx`

**Interfaces:**
- Consumes: `requireUser`, `getEnrollments` (Task 6), `getCourseBySlug` (Task 5), `getCourseProgress` (Task 7)
- Produces: the `/dashboard` route

- [ ] **Step 1: Build the enrolled course card**

Create `src/components/course/enrolled-course-card.tsx` — `"use client"` (it reads progress from localStorage), props `{ course: CourseDetail }`.

Computes progress in a `useEffect` from the course's flattened lesson ids. Renders: title, category, a progress bar with `role="progressbar"` and `aria-valuenow`, `{completed} of {total} lessons`, and a **Continue** button linking to the first incomplete lesson — or **Review** linking to lesson 1 when the course is finished.

Render a neutral placeholder bar until the effect has run, so server and client markup match on first paint.

- [ ] **Step 2: Build the page**

Create `src/app/dashboard/page.tsx`.

```tsx
export default async function DashboardPage() {
  const session = await requireUser();
  const enrollments = await getEnrollments();
  const courses = (
    await Promise.all(enrollments.map((e) => getCourseBySlug(e.courseSlug)))
  ).filter((c) => c !== null);
  // ...
}
```

Render: `h1` "Your learning" with a greeting using `session.name`; a stats row (courses enrolled, lessons completed, courses finished); then the enrolled course cards. Empty state when `courses.length === 0` — icon, "You haven't enrolled in anything yet", **Browse courses** button.

Add `export const metadata = { title: "Dashboard", robots: { index: false } }`.

- [ ] **Step 3: Add the loading skeleton**

Create `src/app/dashboard/loading.tsx`.

- [ ] **Step 4: Verify by hand**

Open `/dashboard`. Confirm three courses appear: one at 100% showing **Review**, one at ~33% showing **Continue** pointing at lesson 3, one at 0% showing **Continue** pointing at lesson 1. Complete a lesson in the reader, return, and confirm the bar moved.

- [ ] **Step 5: Verify and commit**

```bash
pnpm typecheck && pnpm lint && pnpm build
git add -A && git commit -m "feat: add learner dashboard with live progress" && git push
```

---

### Task 15: Validation schemas

**Files:**
- Create: `src/lib/validation.ts`, `src/lib/validation.test.ts`

**Interfaces:**
- Consumes: nothing
- Produces: `signInSchema`, `signUpSchema`, `courseInputSchema`, `COURSE_CATEGORIES`, and the inferred type `CourseInput`

These are copied from `docs/02-academy.md` §12 and are reused verbatim server-side in Phase 2.

- [ ] **Step 1: Write the failing validation test**

Create `src/lib/validation.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { signUpSchema, courseInputSchema } from "./validation";

const validCourse = {
  title: "Test Course",
  slug: "test-course",
  description: "A description that is comfortably longer than twenty characters.",
  category: "Freelancing",
  level: "beginner",
  modules: [
    {
      title: "Module One",
      position: 1,
      lessons: [
        {
          title: "Lesson One",
          slug: "lesson-one",
          position: 1,
          isPreview: false,
          content: "x".repeat(60),
        },
      ],
    },
  ],
};

describe("signUpSchema", () => {
  it("accepts a valid sign-up", () => {
    expect(
      signUpSchema.safeParse({ name: "Alex", email: "a@b.co", password: "longenough" }).success,
    ).toBe(true);
  });

  it("rejects a password shorter than 8 characters", () => {
    expect(
      signUpSchema.safeParse({ name: "Alex", email: "a@b.co", password: "short" }).success,
    ).toBe(false);
  });
});

describe("courseInputSchema", () => {
  it("accepts a valid course", () => {
    expect(courseInputSchema.safeParse(validCourse).success).toBe(true);
  });

  it("rejects a slug with uppercase or spaces", () => {
    expect(courseInputSchema.safeParse({ ...validCourse, slug: "Test Course" }).success).toBe(false);
  });

  it("rejects a description under 20 characters", () => {
    expect(courseInputSchema.safeParse({ ...validCourse, description: "short" }).success).toBe(false);
  });

  it("rejects duplicate lesson slugs within a course", () => {
    const dup = structuredClone(validCourse);
    dup.modules[0].lessons.push({ ...dup.modules[0].lessons[0], position: 2 });
    expect(courseInputSchema.safeParse(dup).success).toBe(false);
  });

  it("rejects duplicate module positions", () => {
    const dup = structuredClone(validCourse);
    dup.modules.push({ ...dup.modules[0], title: "Module Two" });
    expect(courseInputSchema.safeParse(dup).success).toBe(false);
  });

  it("rejects lesson content under 50 characters", () => {
    const short = structuredClone(validCourse);
    short.modules[0].lessons[0].content = "too short";
    expect(courseInputSchema.safeParse(short).success).toBe(false);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm vitest run src/lib/validation.test.ts`
Expected: FAIL — cannot resolve `./validation`.

- [ ] **Step 3: Implement the schemas**

Create `src/lib/validation.ts`:

```ts
import { z } from "zod";

export const COURSE_CATEGORIES = [
  "Freelancing",
  "Development",
  "Branding",
  "Design",
  "Video",
  "Business",
] as const;

const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;

export const signInSchema = z.object({
  email: z.email("Enter a valid email address"),
  password: z.string().min(1, "Password is required"),
});

export const signUpSchema = z.object({
  name: z.string().trim().min(2, "Name is too short").max(80, "Name is too long"),
  email: z.email("Enter a valid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

const lessonSchema = z.object({
  title: z.string().trim().min(3).max(120),
  slug: z.string().regex(SLUG, "Use lowercase letters, numbers, and hyphens").min(3).max(100),
  position: z.number().int().min(1).max(999),
  isPreview: z.boolean(),
  content: z.string().min(50, "Lesson content must be at least 50 characters"),
});

const moduleSchema = z.object({
  title: z.string().trim().min(3).max(100),
  position: z.number().int().min(1).max(999),
  lessons: z.array(lessonSchema).min(1, "Add at least one lesson").max(30),
});

export const courseInputSchema = z
  .object({
    title: z.string().trim().min(3, "Title is too short").max(120),
    slug: z.string().regex(SLUG, "Use lowercase letters, numbers, and hyphens").min(3).max(100),
    description: z.string().trim().min(20, "Description must be at least 20 characters").max(2000),
    category: z.enum(COURSE_CATEGORIES),
    level: z.enum(["beginner", "intermediate", "advanced"]),
    modules: z.array(moduleSchema).min(1, "Add at least one module").max(12),
  })
  .superRefine((course, ctx) => {
    const positions = course.modules.map((m) => m.position);
    if (new Set(positions).size !== positions.length) {
      ctx.addIssue({ code: "custom", message: "Module positions must be unique", path: ["modules"] });
    }

    const lessonSlugs = course.modules.flatMap((m) => m.lessons.map((l) => l.slug));
    if (new Set(lessonSlugs).size !== lessonSlugs.length) {
      ctx.addIssue({
        code: "custom",
        message: "Lesson slugs must be unique within a course",
        path: ["modules"],
      });
    }

    course.modules.forEach((mod, i) => {
      const p = mod.lessons.map((l) => l.position);
      if (new Set(p).size !== p.length) {
        ctx.addIssue({
          code: "custom",
          message: "Lesson positions must be unique within a module",
          path: ["modules", i, "lessons"],
        });
      }
    });
  });

export type CourseInput = z.infer<typeof courseInputSchema>;
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm vitest run src/lib/validation.test.ts`
Expected: PASS, 8 tests.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: add zod validation schemas shared with Phase 2"
```

---

### Task 16: Auth screens (visual only)

**Files:**
- Create: `src/app/(auth)/layout.tsx`, `src/app/(auth)/login/page.tsx`, `src/app/(auth)/sign-up/page.tsx`, `src/components/auth/google-button.tsx`

**Interfaces:**
- Consumes: `BrandWordmark` (Task 2)
- Produces: the `/login` and `/sign-up` routes

- [ ] **Step 1: Build the auth layout**

Create `src/app/(auth)/layout.tsx` — a split screen. Left: the form column, centred, `max-w-sm`, with `<BrandWordmark product="Academy" />` at the top. Right (desktop only): a `--color-deep-ink` panel carrying the tagline `Creative Intelligence. Collective Impact.` and the descriptor. No site header or footer on these routes.

- [ ] **Step 2: Build the Google button**

Create `src/components/auth/google-button.tsx` — `"use client"`.

Full-width outlined button reading **Continue with Google** with a Google glyph. On click: `toast.info("Sign-in isn't wired up yet.")`. **It must not navigate, and it must not show a success state.**

- [ ] **Step 3: Build the login page**

Create `src/app/(auth)/login/page.tsx`: `h1` "Sign in", a sentence, `<GoogleButton />`, a "or" divider, and a disabled email/password form with a caption reading *"Email sign-in arrives with the next release."* Footer link to `/sign-up`. Metadata title "Sign in".

- [ ] **Step 4: Build the sign-up page**

Create `src/app/(auth)/sign-up/page.tsx`: `h1` "Join the Academy", `<GoogleButton />`, and an **invite code** `Input` with a `Label` and helper text *"Members receive this from their team lead."* The field is decorative in Phase 1 — it validates non-empty on the client and shows the demo toast on submit. Footer link to `/login`. Metadata title "Sign up".

- [ ] **Step 5: Verify by hand**

Confirm `/login` and `/sign-up` render without the site header, that the Google button only toasts, and that nothing on these pages navigates or claims success.

- [ ] **Step 6: Verify and commit**

```bash
pnpm typecheck && pnpm lint && pnpm build
git add -A && git commit -m "feat: add visual-only login and sign-up screens" && git push
```

---

### Task 17: Admin overview and course list

**Files:**
- Create: `src/app/admin/layout.tsx`, `src/app/admin/page.tsx`, `src/app/admin/courses/page.tsx`, `src/app/admin/loading.tsx`

**Interfaces:**
- Consumes: `requireRole` (Task 6), `getCourses` / `getCatalogStats` (Task 5)
- Produces: `/admin` and `/admin/courses`

- [ ] **Step 1: Build the admin layout**

Create `src/app/admin/layout.tsx` — an async server component calling `await requireRole("instructor", "admin")` first, so a learner is redirected to `/`.

Sidebar shell: a fixed left rail on desktop with `<BrandWordmark product="Academy" />`, nav links (Overview `/admin`, Courses `/admin/courses`), and the current role; a `Sheet` on mobile. Denser type than the public site, same tokens. `export const metadata = { robots: { index: false } }`.

- [ ] **Step 2: Build the overview**

Create `src/app/admin/page.tsx`: `h1` "Overview", four stat cards (published courses, drafts, total lessons, categories) sourced from the loader — note the fixture course is the one draft — and a quick-actions row linking to **New course** and **All courses**.

- [ ] **Step 3: Build the course list**

Create `src/app/admin/courses/page.tsx`: `h1` "Courses", a **New course** button, and a `Table` with columns Title, Status, Level, Category, Lessons, and a row `DropdownMenu`.

Status badges: `published` uses emerald, `draft` uses `secondary` — and both carry a text label, never colour alone. Menu items: **Edit** → `/admin/courses/[id]/edit`; **Publish** / **Unpublish**; **Delete** opening a confirm `Dialog`. All three actions show `toast.info("Demo mode — changes aren't saved yet.")` and change nothing.

Include a designed empty state even though it is unreachable with seeded content — Phase 2 will need it.

- [ ] **Step 4: Verify by hand**

Switch the role switcher to **Learner** and confirm `/admin` redirects to `/`. Switch to **Instructor** and confirm it renders. Confirm no menu action mutates anything.

- [ ] **Step 5: Verify and commit**

```bash
pnpm typecheck && pnpm lint && pnpm build
git add -A && git commit -m "feat: add admin shell, overview, and course list" && git push
```

---

### Task 18: Admin course forms

**Files:**
- Create: `src/app/admin/courses/new/page.tsx`, `src/app/admin/courses/[id]/edit/page.tsx`, `src/components/admin/course-form.tsx`, `src/components/admin/modules-editor.tsx`

**Interfaces:**
- Consumes: `courseInputSchema`, `COURSE_CATEGORIES` (Task 15), `getCourseBySlug` (Task 5), `requireRole` (Task 6)
- Produces: `<CourseForm initial?: CourseInput />`

- [ ] **Step 1: Build the modules editor**

Create `src/components/admin/modules-editor.tsx` — `"use client"`, props `{ value: CourseInput["modules"]; onChange: (next: CourseInput["modules"]) => void; errors?: Record<string, string> }`.

Per module: a title `Input`, move-up/move-down buttons, a remove button, and its lessons. Per lesson: title, slug, an `isPreview` checkbox, and a content `Textarea` (Markdown). **Add module** and **Add lesson** buttons. Positions are recomputed from array order on every change — never entered by hand.

- [ ] **Step 2: Build the course form**

Create `src/components/admin/course-form.tsx` — `"use client"`, props `{ initial?: CourseInput; heading: string }`.

Fields: title, slug (auto-derived from title until the user edits it directly), description `Textarea`, category `Select` from `COURSE_CATEGORIES`, level `Select`, then `<ModulesEditor />`.

On submit: `courseInputSchema.safeParse(state)`. On failure, map issues to field paths and render each inline with `role="alert"`, `aria-invalid`, and `aria-describedby`; focus the first invalid field. On success, show `toast.info("Demo mode — changes aren't saved yet.")` and **stop**. No redirect, no success panel, no optimistic row.

Include a visible banner at the top of the form: *"Demo mode — this form validates but does not save."* Honesty is a requirement, not a nicety.

- [ ] **Step 3: Build the two pages**

`src/app/admin/courses/new/page.tsx` — `await requireRole("instructor", "admin")`, then `<CourseForm heading="New course" />`.

`src/app/admin/courses/[id]/edit/page.tsx` — `params` is a Promise; await it, load the course via `getCourseBySlug(id)` (Phase 1 uses the slug as the id), `notFound()` when missing, and map `CourseDetail` → `CourseInput` for `initial`.

- [ ] **Step 4: Verify by hand**

Open `/admin/courses/new`. Submit empty — confirm inline errors on title, slug, description, and modules. Fill it in validly and submit — confirm the demo toast fires and nothing appears in the course list. Open `/admin/courses/pricing-and-proposals/edit` and confirm the form is prefilled with 4 lessons.

- [ ] **Step 5: Verify and commit**

```bash
pnpm typecheck && pnpm lint && pnpm build
git add -A && git commit -m "feat: add admin course forms with real validation and honest demo states" && git push
```

---

### Task 19: SEO, sitemap, and robots

**Files:**
- Create: `src/app/sitemap.ts`, `src/app/robots.ts`
- Modify: any page still missing `export const metadata`

**Interfaces:**
- Consumes: `getCourses` (Task 5)
- Produces: `/sitemap.xml`, `/robots.txt`

- [ ] **Step 1: Add the sitemap**

Create `src/app/sitemap.ts`:

```ts
import type { MetadataRoute } from "next";
import { getCourses } from "@/lib/content/queries";

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://sodales-academy.vercel.app";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const courses = await getCourses();

  return [
    { url: BASE_URL, changeFrequency: "monthly", priority: 1 },
    { url: `${BASE_URL}/courses`, changeFrequency: "weekly", priority: 0.8 },
    ...courses.map((course) => ({
      url: `${BASE_URL}/courses/${course.slug}`,
      changeFrequency: "monthly" as const,
      priority: 0.6,
    })),
  ];
}
```

- [ ] **Step 2: Add robots**

Create `src/app/robots.ts`:

```ts
import type { MetadataRoute } from "next";

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://sodales-academy.vercel.app";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/dashboard", "/admin", "/learn"],
    },
    sitemap: `${BASE_URL}/sitemap.xml`,
  };
}
```

- [ ] **Step 3: Audit metadata coverage**

Confirm every route file exports `metadata` or `generateMetadata`, and that `/dashboard`, `/admin/*`, and `/learn/*` all carry `robots: { index: false }`.

- [ ] **Step 4: Verify by hand**

Visit `/sitemap.xml` and `/robots.txt` in dev. Confirm the sitemap lists 6 URLs and robots disallows the three private prefixes.

- [ ] **Step 5: Verify and commit**

```bash
pnpm typecheck && pnpm lint && pnpm build
git add -A && git commit -m "feat: add sitemap, robots, and metadata coverage" && git push
```

---

### Task 20: CLAUDE.md and coding guidelines

**Files:**
- Create: `CLAUDE.md`, `docs/coding-guidelines.md`, `README.md`

**Interfaces:**
- Consumes: everything built so far
- Produces: repository conventions for humans and agents

Write these for agents: short declarative rules, no throat-clearing, concrete file paths, and an explicit statement of what breaks if a rule is ignored.

- [ ] **Step 1: Write `CLAUDE.md`**

Sections, in order:

1. **What this is** — Sodales Academy, Phase 1, frontend-only demo; link to the spec at `docs/superpowers/specs/2026-09-03-academy-frontend-design.md`.
2. **The seam, and why it matters** — the four content queries and three session functions are the entire data interface. Phase 2 swaps their bodies for SQL. Reading `content/`, `localStorage`, or the role cookie from anywhere else breaks that swap.
3. **Rules that get broken most** — as a list, each with its consequence:
   - Never import from `content/` outside `src/lib/content/loader.ts`
   - Never touch `localStorage` outside `src/lib/progress.ts`
   - Never read the role cookie outside `src/lib/session.ts`
   - Never report success for an action that did not happen
   - Inter only, no serif, weights 400/700
   - Electric Violet `#5E4FB3` is the only action colour; never violet text on obsidian
   - The wordmark renders only through `<BrandWordmark />`, never as live text
   - `params`, `searchParams`, and `cookies()` are async in Next 16 — await them
   - `next lint` does not exist; run `pnpm lint`
4. **Commands** — `pnpm dev`, `build`, `test`, `lint`, `typecheck`.
5. **Where things live** — the file-structure table from this plan.
6. **Phase 2 backlog** — Neon, Google OAuth, invite code, comments, Tiptap, real persistence; pointer to spec §11 for the seven recorded deviations from `docs/02-academy.md`.

- [ ] **Step 2: Write `docs/coding-guidelines.md`**

Cover: TypeScript strict, no `any`, no non-null assertion outside tests; server components by default and `"use client"` only where a browser API or event handler requires it; one responsibility per file and a soft 200-line ceiling; `kebab-case` filenames and `PascalCase` components; every list needs loading, empty, and error states; every form needs validation, pending, and error states; the honest-states rule; the accessibility checklist from `docs/02-academy.md` §14; and the Vitest convention of colocated `*.test.ts` files.

- [ ] **Step 3: Write `README.md`**

What the project is, the demo caveat stated plainly at the top, quickstart (`pnpm install && pnpm dev`), where course content lives and how to add a lesson, and links to the spec and this plan.

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "docs: add CLAUDE.md, coding guidelines, and README" && git push
```

---

### Task 21: Acceptance sweep and final deploy

**Files:**
- Modify: whatever the sweep turns up

**Interfaces:**
- Consumes: everything
- Produces: a verified public deployment

- [ ] **Step 1: Run the full gate**

```bash
pnpm test && pnpm typecheck && pnpm lint && pnpm build
```

All four must be green. Do not proceed past a failure.

- [ ] **Step 2: Walk the acceptance criteria**

Open spec §17 and check each box by actually exercising it in the browser. Specifically confirm:

- All eleven routes render at 375px, 768px, and 1280px
- Catalog search, level filter, and empty state all work
- Every role in the switcher reaches its screens; learner at `/admin` redirects to `/`
- Mark-complete survives a refresh and moves the dashboard bar
- No admin form or auth button ever reports success
- `/courses/test-fixture-course` 404s — the draft must not leak
- Only Inter is loaded; grep the codebase for `serif` and confirm no hits

- [ ] **Step 3: Keyboard and reduced-motion pass**

Tab through the header, mobile menu, catalog filters, lesson sidebar, and admin form. Every interactive element must be reachable with a visible violet focus ring. Then enable "Reduce motion" in macOS System Settings → Accessibility → Display and confirm transitions are suppressed.

- [ ] **Step 4: Deploy and verify production**

```bash
vercel --prod
```

Open the production URL and repeat the route walk. Confirm the fonts, tokens, and Markdown rendering all survive the production build.

- [ ] **Step 5: Final commit**

```bash
git add -A
git commit -m "chore: Phase 1 acceptance sweep"
git push
```

---

## Self-Review

**Spec coverage.** Walked every section of the spec against the tasks:

| Spec section | Covered by |
| --- | --- |
| §2 in-scope | Tasks 4, 6, 7, 11–18, 20 |
| §3 seam + directory layout | Tasks 3, 5, 6, 7 |
| §4 stack | Task 1 |
| §5 route map (11 routes) | Tasks 9, 11, 12, 13, 14, 16, 17, 18 |
| §6 simulated auth | Task 6 |
| §7 progress | Task 7 |
| §8 honest states | Tasks 8, 16, 17, 18 |
| §9 validation | Task 15 |
| §10 design system + logo | Task 2 |
| §12 repo conventions | Tasks 1, 20 |
| §13 accessibility | Global constraints + Task 21 step 3 |
| §14 SEO | Task 19 |
| §15 testing | Tasks 3, 5, 6, 7, 15, 21 |
| §16 deployment | Tasks 10, 21 |
| §17 acceptance | Task 21 |

**Gap found and closed:** the spec's `getCatalogStats` was implied by the home page's "live catalog stats" but never named in §3. Added it explicitly to Task 5's interface block and test.

**Placeholder scan:** no `TBD`, no "add appropriate error handling", no "similar to Task N". Course lesson bodies in Task 4 are specified by topic and length rather than written out in full — this is deliberate and flagged in-task as requiring real prose, since 19 lessons of finished copy belongs in the content files, not the plan.

**Type consistency:** `CourseSummary` / `CourseDetail` / `LessonWithNav` / `Role` / `Session` / `Enrollment` / `CourseInput` are each defined once and referenced identically downstream. `getCourseProgress` takes `(courseSlug, lessonIds)` in Tasks 7, 14, and 13 alike. `PROGRESS_STORAGE_KEY` and `ROLE_COOKIE` are exported from their defining modules and never re-declared.

## Known Risks

- **Task 4 is the long pole.** Nineteen lessons of genuine prose is the single biggest time cost in this plan and is easy to underestimate. If the night runs short, write the five lessons of `landing-your-first-client` properly and let the other three courses carry shorter bodies — but never stubs, and never `Lorem ipsum`.
- **Hydration mismatches** are the likeliest bug class, since progress lives in `localStorage` and is unavailable during SSR. Tasks 13 and 14 both specify reading it in `useEffect` with a neutral placeholder on first paint. Deviating from that will produce React hydration errors.
- **shadcn on Next 16** is not explicitly documented as supported. If `shadcn init` fails in Task 2 step 9, fall back to `pnpm dlx shadcn@canary init --src-dir`, and if that also fails, hand-write the six primitives actually used (Button, Input, Label, Badge, Table, Progress) — they are small, and the rest can be dropped.

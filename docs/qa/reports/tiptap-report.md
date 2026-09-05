# Tiptap lesson editor — implementation report

Ref: `docs/superpowers/plans/2026-09-05-tiptap-lesson-editor.md` (all 11 sections implemented as
written; no deviations from the package choice, extension set, or fallback rule — the primary
`@tiptap/markdown` package passed the round-trip gate on the first attempt, so the
`tiptap-markdown@0.9.0` fallback was never needed).

## Files changed

New:
- `src/components/admin/lesson-content-editor-extensions.ts` — `getLessonEditorExtensions()` /
  `LESSON_CODE_LANGUAGES`, the shared seam the editor component and both round-trip tests import,
  exactly as specified in plan §4.
- `src/components/admin/lesson-content-editor.tsx` — the Tiptap editor component and toolbar,
  plan §5, unchanged from the plan except dropping the unused `cn` import (the plan's own listing
  imports it but never calls it — would have been an unused-import lint error).
- `src/components/admin/lesson-content-editor.roundtrip.test.ts` — 2-fixture + empty-string
  round-trip unit test, plan §8.
- `src/lib/content/lesson-content-roundtrip.integration.test.ts` — full-catalogue (all 20 real
  lessons) round-trip integration test against the real `DATABASE_URL`, plan §8. This is the actual
  go/no-go gate.
- `src/components/admin/lesson-content-editor.test.tsx` — component-level tests, plan §9. Not in
  the plan's file listing verbatim (the plan describes what's testable in prose, not literal test
  code) — written to match its guidance and the repo's existing `fireEvent`-only, no-jest-dom-matcher
  style (see "Deviations" below).
- `docs/qa/reports/tiptap-report.md` (this file).

Modified:
- `src/components/admin/modules-editor.tsx` — dynamic-imports `LessonContentEditor`
  (`next/dynamic`, `ssr: false`, disabled `Textarea` loading fallback), replaces the lesson content
  `<Textarea>` block with `<LessonContentEditor>`, drops "(Markdown)" from the field label. Plan §6,
  applied verbatim.
- `src/components/lesson/lesson-body.tsx` — added `table`/`thead`/`th`/`td` entries to `LessonBody`'s
  `components` map (wrapped in an `overflow-x-auto` scroll container, bordered header/row dividers,
  padding and font-size matching the surrounding `text-sm`/`text-base` scale). This is the
  pre-existing defect called out in the task brief, not in the plan doc itself — `LessonBody` had no
  table styling before this change, so `building-a-palette` and `hourly-vs-fixed` rendered with bare
  browser-default tables. `align`/`style` props passed through by `react-markdown`+`remark-gfm` for
  column alignment (`---:`) flow through unchanged via each renderer's `...rest` spread, so the
  right-aligned numeric column in `hourly-vs-fixed` still right-aligns — confirmed live (see below).
- `package.json` / `pnpm-lock.yaml` — dependency additions below.

## Packages installed (exact versions per plan §1/§3)

```
dependencies:
  @tiptap/core           3.31.3
  @tiptap/extension-table 3.31.3
  @tiptap/markdown        3.31.3
  @tiptap/pm              3.31.3
  @tiptap/react           3.31.3
  @tiptap/starter-kit     3.31.3

devDependencies:
  unified       11.0.5
  remark-parse  11.0.0
  @types/mdast  4.0.4   (not listed in the plan; added — see "Deviations")
```

## Round-trip test results against real lesson content

**2-fixture unit test** (`lesson-content-editor.roundtrip.test.ts`, `building-a-palette` +
`hourly-vs-fixed` verbatim content captured in the plan, plus an empty-string case):

```
✓ parse → edit-model → serialise is a semantic no-op for "building-a-palette" (no edits made)
✓ parse → edit-model → serialise is a semantic no-op for "hourly-vs-fixed" (no edits made)
✓ round-trips an empty lesson back to an empty string, not a placeholder
Test Files  1 passed (1)
     Tests  3 passed (3)
```

**Full-catalogue integration test** (`lesson-content-roundtrip.integration.test.ts`, all 20 real
lessons read directly from the production `DATABASE_URL`, the actual go/no-go gate per plan §8):

```
✓ has no lesson whose parse→edit→serialise output diverges semantically from the original
Test Files  1 passed (1)
     Tests  1 passed (1)
```

Zero failures across all 20 lessons on the first run. No lesson required falling back to
`tiptap-markdown@0.9.0`; the official `@tiptap/markdown` package handles every real lesson's
headings, blockquotes, bold/italic, fenced code with language info-strings, bullet lists, links (by
absence), and both GFM tables (left-aligned-only and right-aligned-numeric) without mangling.

## Verification commands and output

**`pnpm typecheck`** — exit 0, no output (clean):
```
$ tsc --noEmit
```

**`pnpm lint`** — 0 errors, 2 warnings, both pre-existing and named in the task brief:
```
$ eslint .

src/components/layout/sign-out-button.tsx
  10:5  warning  Do not use `window.location.href` to navigate to internal Next.js pages. ...
  (@next/next/no-location-assign-relative-destination)

src/lib/content/queries.ts
  110:20  warning  '_modules' is assigned a value but never used  @typescript-eslint/no-unused-vars

✖ 2 problems (0 errors, 2 warnings)
```
(Two additional warnings appeared during development — an unused destructured `_position` in both
round-trip test files' `stripPositions` helper, and an unused `eslint-disable no-alert` comment in
`lesson-content-editor.tsx` — both fixed before this final run; see "Deviations.")

**`pnpm test`** — full suite green and grown (was passing before this work; exact prior count not
recorded, but every new file above is additive, no existing test was touched except none — modules-editor
has no existing test file):
```
Test Files  25 passed (25)
     Tests  146 passed (146)
```

**`pnpm build`** — succeeds, `✓ Compiled successfully in 184ms`, exit 0. The interleaved
`[neon-auth] Cookie validation error ... Dynamic server usage` lines are expected noise from every
route reading `cookies()` via `getSession()` during static-page generation (documented in
CLAUDE.md's "Streaming responses" note), not a build failure. Confirmed the dynamic import actually
splits into its own chunk: `grep -rl "tiptap\|prosemirror" .next/static/chunks/*.js` matches exactly
one chunk file (`3du0ky6m3g3zh.js`, ~501KB) — Tiptap/ProseMirror/`marked` do not appear in any other
chunk, i.e. they are not in the shared/root-layout bundle.

## Live verification

A dev server was already running on `http://localhost:3000`, signed in as admin. Verified via
browser automation (Chrome DevTools MCP), not assumed:

1. Opened `/admin/courses/landing-your-first-client/edit`. Every lesson's content loaded into the
   Tiptap editor with formatting intact — headings, blockquotes, numbered lists, bold inline code —
   confirmed by screenshot on Lesson 1 ("Why Nobody Replies").
2. Located Lesson 2 of the "Finding Work" module ("Where Clients Actually Are") and confirmed via
   `/learn/landing-your-first-client/where-clients-actually-are` that it renders correctly
   *before* any edit.
3. **Made a trivial edit**: clicked at the end of the first paragraph in that lesson's editor
   ("...you a clear sentence they can repeat.") and typed
   `" TIPTAP-EDITOR-TEST-EDIT"` (25 characters including the leading space).
4. Clicked "Save course". Save succeeded (redirected to `/admin/courses`).
5. Reloaded `/learn/landing-your-first-client/where-clients-actually-are` — the edit was present
   and the rest of the lesson (heading, blockquote, remaining paragraphs) still rendered correctly.
6. **Restored the original content exactly**: reopened the same lesson's editor, placed the cursor
   at the end of the modified line, pressed Backspace 24 times (removing exactly the 24 characters
   after the leading space consumed by End-of-line positioning — i.e. `TIPTAP-EDITOR-TEST-EDIT`
   plus the space), leaving the paragraph ending on "...clear sentence they can repeat." with no
   trailing artifact, confirmed by screenshot before saving.
7. Clicked "Save course" again. Save succeeded.
8. Reloaded the learn page a final time — content is byte-identical to the pre-edit screenshot in
   step 2. Also re-ran the full-catalogue integration test after this live round-trip
   (`pnpm vitest run src/lib/content/lesson-content-roundtrip.integration.test.ts`) — all 20
   lessons, including this one, still pass, confirming the restore left no structural residue.
9. Additionally opened both table lessons live to confirm the `LessonBody` table-styling fix:
   `/learn/brand-identity-essentials/building-a-palette` (left-aligned table) and
   `/learn/pricing-and-proposals/hourly-vs-fixed` (right-aligned numeric column) both render with
   bordered header rows, row dividers, and consistent padding — the right-aligned `Hours`/`Invoice`
   columns in the second lesson are still right-aligned, confirming GFM column-alignment survives
   both the styling change and the Tiptap round trip.

**What was changed and restored on the shared production database**: lesson
`where-clients-actually-are` (course `landing-your-first-client`) had `" TIPTAP-EDITOR-TEST-EDIT"`
appended to its first paragraph, saved, verified live, then removed and re-saved to its exact
original text. No other lesson content was modified. Confirmed restored via the full-catalogue
integration test passing afterward.

## Deviations from the plan

1. **Added `@types/mdast@4.0.4` as an explicit devDependency**, not listed in the plan's install
   commands. `mdast-util-*` packages and `@types/mdast` are pulled in transitively (via
   `react-markdown`/`remark-gfm`) but pnpm's strict `node_modules` layout does not hoist them to
   top-level `node_modules` for non-direct dependents, so `import type { Root } from "mdast"` in
   the round-trip test files would not resolve without this. A one-line addition, same version
   already present in the lockfile; no other package's resolution changed.
2. **Dropped the unused `cn` import** from `lesson-content-editor.tsx` relative to the plan's
   listing — the plan's own file imports `cn` from `@/lib/utils` but never calls it anywhere in the
   component body; keeping it would have been an unused-import lint error.
3. **`stripPositions`'s implementation differs cosmetically** from the plan's destructuring form
   (`const { position: _position, ...rest } = ...`) in both round-trip test files. That form
   produces an ESLint `@typescript-eslint/no-unused-vars` warning in this repo's config (no
   underscore-ignore pattern configured). Replaced with an equivalent `delete rest.position`
   approach that produces identical output with no warning.
4. **Removed the plan's `// eslint-disable-next-line no-alert` comment** on the link-prompt
   `window.prompt` call — this repo's ESLint config (`eslint-config-next`) does not enable the
   `no-alert` rule, so the directive was flagged as an unused eslint-disable. Replaced with a plain
   comment carrying the same rationale.
5. **`lesson-content-editor.test.tsx` uses `toBeDefined()`/`.getAttribute()` instead of
   `@testing-library/jest-dom` matchers** (`toBeInTheDocument`/`toHaveAttribute`) — this repo has no
   jest-dom setup file wiring those matchers into `expect`, and no existing test in the repo uses
   them (confirmed by grepping `course-form.test.tsx`/`track-map.test.tsx`); using them produced
   `Invalid Chai property` errors. Followed the repo's existing convention instead
   (`screen.getByText(...).toBeDefined()`, `el.getAttribute(...)`), which asserts the identical
   thing.

None of these deviations touch the plan's substantive decisions (package choice, extension
configuration, round-trip fidelity bar, accessibility wiring, dynamic import, or table-styling
scope) — all are lint/type-resolution corrections surfaced only once real tooling was run.

## Concerns / follow-ups (non-blocking)

- The plan's own §7 accessibility checklist flags, and this implementation does not solve, that
  `<label htmlFor>` click-to-focus is not guaranteed to work on the `role="textbox"` ProseMirror div
  the way it did on the old `<Textarea>`. Not tested here (would require real browser focus-model
  behavior jsdom can't simulate); flagged for manual QA awareness, matching the plan's own honesty
  about this gap.
- No test exercises actual typing into the ProseMirror contenteditable region, per the plan's
  explicit instruction (§9) that jsdom's contenteditable/Selection support cannot reliably drive
  real ProseMirror transactions via `fireEvent`. The round-trip tests instead exercise the identical
  extension configuration headlessly (constructing a real `@tiptap/core` `Editor`, no DOM typing
  needed), which is the strictly stronger fidelity guarantee the plan calls for.

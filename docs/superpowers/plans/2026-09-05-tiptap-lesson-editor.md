# Tiptap rich-text editor for lesson content

Status: plan only, not implemented. No packages installed, no files changed except this one.

## 0. Decisions this plan does not re-litigate

1. Storage stays markdown. `lesson.content` is still a `text` column holding markdown.
   `src/components/lesson/lesson-body.tsx` still renders it with `react-markdown` +
   `remark-gfm`. Tiptap edits, then serialises back to markdown on save. No HTML, no JSON is
   ever persisted.
2. Editor scope = what `LessonBody` renders, tempered by what real production content actually
   uses (audited below — see §2). Where those two disagree, the plan says so explicitly and
   picks a side with a reason.

## 1. Research: package versions, compatibility, and the markdown-serialisation choice

All verified live against the npm registry on 2026-09-05 (`npm view <pkg> version
peerDependencies dependencies --json`) — not from training-data memory.

| Package | Version | Peer deps | Notes |
|---|---|---|---|
| `@tiptap/react` | `3.31.3` | `react`/`react-dom` `^17\|\|^18\|\|^19`, `@tiptap/core` `3.31.3`, `@tiptap/pm` `3.31.3` | React 19.2.8 (installed) satisfies the peer range. |
| `@tiptap/core` | `3.31.3` | `@tiptap/pm` `3.31.3` | |
| `@tiptap/pm` | `3.31.3` | — | ProseMirror re-exports, pinned to the same version as everything else. |
| `@tiptap/starter-kit` | `3.31.3` | `@tiptap/core` `^3.0.1` | Bundles Blockquote, Bold, BulletList, Code, CodeBlock, Document, Dropcursor, Gapcursor, HardBreak, Heading, HorizontalRule, Italic, Link, ListItem, ListKeymap, OrderedList, Paragraph, Strike, Text, Underline, TrailingNode, UndoRedo — each individually disable-able via `StarterKit.configure({ <name>: false })`. |
| `@tiptap/extension-table` | `3.31.3` | `@tiptap/core` `3.31.3` | v3 ships **one** package containing `Table`, `TableRow`, `TableHeader`, `TableCell`, and a `TableKit` bundle extension, plus a built-in `renderTableToMarkdown` helper. No separate `@tiptap/extension-table-row`/`-cell`/`-header` installs needed (those packages still exist standalone but are redundant here). |
| `@tiptap/markdown` | `3.31.3` | `@tiptap/core` `3.31.3`, `@tiptap/pm` `3.31.3` | **Official** Tiptap markdown extension, released in the same `3.31.3` train as the rest — not a separate lagging release. Parses/serialises via `marked` (a direct dependency, `^17.0.1`), not `markdown-it`. |

### Why `@tiptap/markdown` (official) over `tiptap-markdown` (community), and the fallback rule

`tiptap-markdown` (by `aguingand`) is the package most tutorials reference. Checked it directly:
version `0.9.0`, last published 2025-09-08 (a year old), depends on `markdown-it` + `prosemirror-markdown`,
peer dep `@tiptap/core: ^3.0.1` (would still resolve against our `3.31.3` core). **Its own README
now says: "Tiptap released a markdown extension in 3.7.0, please prefer using the official
extension over this package."** Since the author of the community package is telling people to
move off it, and the official `@tiptap/markdown` has peer deps that match our exact installed
core/pm versions (not just a satisfied range), **this plan uses `@tiptap/markdown`.**

Caveat found in Tiptap's own release notes (`tiptap.dev/blog/release-notes/introducing-bidirectional-markdown-support-in-tiptap`):
tables are explicitly called out as "limited: only one child node per cell is allowed, as the
Markdown syntax can't represent multiple child nodes." Our two real lessons that use tables
(`building-a-palette`, `hourly-vs-fixed`, see §2) only ever put plain text in a cell — no nested
lists or paragraphs inside a `<td>` — so this restriction doesn't bite today, but it does mean:
**do not offer a "merge cells" or "add paragraph inside cell" control**, since there'd be nowhere
for it to go on serialisation.

**Fallback rule (do this, don't guess):** Step 8 below is a round-trip fidelity test that runs
against real production lesson content, including both table lessons. If it fails on the
`@tiptap/markdown`/table combination in a way that isn't a quick fix (e.g. table serialisation
truly mangles the two table lessons and there's no configuration knob to fix it), swap the
markdown package for `tiptap-markdown@0.9.0` and rerun the same test unchanged — the test is
written against a small seam (`getLessonEditorExtensions()`, §4) specifically so the only edit
needed is which package that function imports `Markdown`/table-serialisation glue from. Do not
proceed past Step 8 until the test passes with real content, on whichever package wins.

### Devtools compatibility already confirmed

- `unified@11.0.5` and `remark-parse@11.0.0` are already present transitively in
  `node_modules/.pnpm` (pulled in by `react-markdown@10`/`remark-gfm@4`), confirming they're
  mutually compatible with the `remark-gfm@^4.0.1` already a direct dependency. They are **not**
  hoisted to top-level `node_modules` (no `.npmrc`, pnpm strict mode) so they must be added as
  explicit `devDependencies` for the round-trip test to import them — see §3.
- `@testing-library/react@16.3.3` (installed) supports React 19. `@testing-library/user-event` is
  not installed and this plan does not add it (per constraints) — all interaction in tests uses
  `fireEvent`.

## 2. Real-content audit (why the toolbar looks the way it does)

Read `src/components/lesson/lesson-body.tsx` end to end. Its `components` map gives custom,
type-scale styling to exactly: `h1`→h2 style, `h2`, `h3`, `p`, `ul`, `ol`, `li`, `blockquote`,
`code` (inline vs fenced via `language-` class check), `pre`, `a`. Nothing else is styled —
`strong`/`em`/`table` fall through to bare browser defaults (still visible, just unstyled), and
anything requiring raw HTML (there's no `rehype-raw` plugin passed to `ReactMarkdown`) renders as
literal escaped text, i.e. **invisible as formatting**.

That's the theoretical scope. To find the actual scope, I queried the real database directly
(read-only, `DATABASE_URL` from `.env.local`, via `@neondatabase/serverless`) — 20 real lessons,
`length(content)` up to 2335 chars:

| Feature | Lessons using it | Verdict |
|---|---|---|
| `##` headings | 19 | **In scope** — every heading in production is `##`. |
| `###` headings | 1 | **In scope**. |
| `#` (h1) headings | 0 | **Out of scope** — never used, and `LessonBody` renders it identically to `##` anyway, so offering it would just be a confusing duplicate control. |
| Blockquotes (`>`) | 18 of 20 | **In scope, load-bearing.** Almost every lesson ends on a callout quote. |
| Bold (`**`) | 3 | **In scope**. |
| Italic (`*`) | 1 (single-asterisk style, not `_`) | **In scope**. |
| Bullet lists (`-`) | several | **In scope.** Only `-` is used as a marker anywhere in production — configure the bullet marker to `-` to match. |
| Ordered lists | 0 observed, but styled by `LessonBody` | **In scope** (styled, cheap to keep, matches the literal reading of the spec). |
| Fenced code blocks | several, with info-string languages: `text`, `css`, `http`, `html`, `js`, `bash` | **In scope.** Toolbar language picker limited to exactly these six + no-language, since that's 100% of what exists. |
| Inline code | present | **In scope**. |
| Links | 0 | **In scope anyway** — `LessonBody` styles `a`, and it's a zero-risk, standard Tiptap/StarterKit inclusion; excluding it would remove a documented capability with no upside. |
| **Tables** | **2** (`building-a-palette`, `hourly-vs-fixed`) | **In scope, by necessity** — not styled by `LessonBody` (renders as an unstyled but real `<table>`), but two live lessons already depend on it. Dropping table support would mean the moment anyone opens and re-saves either of those two lessons through the new editor, the table is silently destroyed. Round-trip fidelity (the thing this whole plan is graded on) outranks toolbar-scope purism here. Flagged as a deliberate exception, not an oversight. |
| Task lists (`- [ ]`) | 0 | **Out of scope.** |
| Strikethrough (`~~`) | 0 | **Out of scope** — not in `LessonBody`'s styled set, not used, GFM-only. |
| Images | 0 | **Out of scope** — no upload/hosting pipeline exists (video hosting is explicitly deferred per CLAUDE.md; images are the same class of problem). |
| Horizontal rules | 0 | **Out of scope** — not styled, not used. |
| Underline | n/a (not a markdown construct) | **Must be actively disabled.** `StarterKit` bundles `Underline` by default in v3. Markdown/CommonMark/GFM has no underline syntax; `LessonBody`'s `ReactMarkdown` has no `rehype-raw`, so any raw `<u>` HTML the serialiser might fall back to would render as invisible/escaped text. This is exactly the "control that produces invisible output" failure mode called out in the brief — disable it explicitly, don't rely on it never being clicked. |

Two real lesson bodies (used verbatim as round-trip fixtures in §8), captured via the read-only
audit query:

`building-a-palette` (has a table with only left-aligned columns):

````markdown
## Before: seven attractive swatches

The first palette file contains seven colours and no usage notes. A designer uses violet for a heading. A developer uses it for a button. Someone else puts pale lilac body text on paper because the combination looks quiet. Every choice comes from taste, so the same colours produce three different systems.

The Sodales source values themselves are clear:

```css
--color-obsidian: #111111;
--color-ivory: #f4f2ed;
--color-graphite: #35373b;
--color-violet: #5e4fb3;
--color-deep-ink: #211c35;
--color-pale-lilac: #ded9ef;
--color-paper: #fbfaf7;
```

## Audit notes

The problem appears when each swatch meets content. Colour contrast belongs to a foreground-background pair, at a particular text size and weight. A colour that works as a large decorative shape may fail as small text.

The audit records each real use instead of rating colours in isolation:

| Element | Foreground | Background | Check |
| --- | --- | --- | --- |
| Body copy | Obsidian | Ivory | Text contrast |
| Card copy | Obsidian | Paper | Text contrast |
| Secondary copy | Graphite | Pale lilac | Text contrast |
| Link | Violet | Ivory | Normal, hover, focus |
| Quiet panel | Deep ink | Pale lilac | Text and icons |

Each proposed pair still needs a contrast tool check at its intended size. Grayscale and colour-vision simulations help reveal controls that depend on hue alone.

> A selected tab needs more than a new colour. Add an underline, weight change, shape, or another visible indicator.

## After: roles people can reuse

The revised file maps the palette to jobs: ivory for the main background, paper for card and popover surfaces, obsidian for primary text, graphite for secondary text, violet for tested accents, deep ink for dark surfaces, and pale lilac for quiet panels.

It also includes a short handoff list:

- Approved text and background pairs
- Link and button states, including keyboard focus
- Error and success labels that do not rely on colour
- Examples of pale lilac used as a surface rather than small text

The seven hex values have not changed. The after version removes guesswork by showing where each one belongs and which check each pairing still needs before it ships.
````

`hourly-vs-fixed` (has a table with a right-aligned numeric column, `---:`):

````markdown
## The brief and the two estimates

A bakery asks Ivo for a landing page with supplied copy, one enquiry form, responsive implementation, and one feedback round. He estimates twenty hours and charges ₱1,500 per hour.

```text
Hourly estimate: 20 hours × ₱1,500 = ₱30,000
Fixed quote:                         ₱36,000
```

The fixed quote is higher because Ivo carries the estimation risk. If the agreed page takes twenty-four hours, the fee stays ₱36,000. If it takes sixteen, the fee also stays ₱36,000. The client is buying a defined page and review process; Ivo still tracks time to learn whether his estimate was sound.

Under hourly billing, the final invoice follows the recorded time:

| Delivery | Hours | Invoice |
| --- | ---: | ---: |
| Original estimate | 20 | ₱30,000 |
| Faster method | 12 | ₱18,000 |
| Form needs investigation | 27 | ₱40,500 |

The twelve-hour row exposes the speed problem. Ivo improved his process and delivered the same agreed work sooner, yet earned ₱12,000 less than his original estimate. Hourly pricing pays for elapsed effort. It still makes sense when the work itself cannot be predicted.

> A fixed fee covers a fixed boundary. New pages, extra feedback rounds, or changed copy need a change order rather than silent free work.

## The decision

For this brief, Ivo chooses the fixed quote because both sides can answer these questions:

- Which page and form will exist at handoff?
- Who supplies copy and approves feedback?
- How many review rounds are included?
- What event counts as delivery?

Now imagine the bakery asks for “site help for the next month” and expects priorities to change each week. An hourly arrangement with a spending cap fits that uncertainty better. Another workable split is paid hourly discovery followed by a fixed build once the pages and responsibilities are known.

Neither quote removes the need for time records. If the fixed project takes twenty-seven hours, Ivo’s notes show whether the form, feedback, or his estimate caused the gap before he prices the next one.
````

Both use literal curly quotes (`“…”`), an em dash, and the `₱` currency symbol as plain characters —
none of these are markdown-syntax-significant, but they're a good stress test for any serialiser
that "helpfully" runs a typographer/smart-quotes pass. §8's test will catch it if one does.

## 3. Exact install commands

Run from the repo root. All versions pinned to the exact numbers verified in §1 (no `^`/`~` — this
is a coordinated multi-package release train; pinning avoids six packages independently drifting
apart on the next `pnpm install`).

```bash
pnpm add @tiptap/react@3.31.3 @tiptap/core@3.31.3 @tiptap/pm@3.31.3 @tiptap/starter-kit@3.31.3 @tiptap/extension-table@3.31.3 @tiptap/markdown@3.31.3
pnpm add -D unified@11.0.5 remark-parse@11.0.0
```

(`remark-gfm` is already a direct dependency at `^4.0.1` and is reused as-is by the round-trip
test's comparison AST — no separate install.)

Expected `package.json` diff (illustrative — actual formatting comes from pnpm):

```diff
   "dependencies": {
+    "@tiptap/core": "3.31.3",
+    "@tiptap/extension-table": "3.31.3",
+    "@tiptap/markdown": "3.31.3",
+    "@tiptap/pm": "3.31.3",
+    "@tiptap/react": "3.31.3",
+    "@tiptap/starter-kit": "3.31.3",
     ...
   },
   "devDependencies": {
+    "remark-parse": "11.0.0",
+    "unified": "11.0.5",
     ...
   }
```

## 4. New file: shared extension config (the seam the round-trip test reuses)

`src/components/admin/lesson-content-editor-extensions.ts` — plain module, no `"use client"`
needed (it has no browser-only side effects at import time), imported by both the real editor
component and the round-trip test so they can never drift apart.

```ts
import StarterKit from "@tiptap/starter-kit";
import { TableKit } from "@tiptap/extension-table";
import { Markdown } from "@tiptap/markdown";
import type { AnyExtension } from "@tiptap/core";

// The six fenced-code-block languages that actually appear in production lesson content today
// (verified against the real database, see docs/superpowers/plans/2026-09-05-tiptap-lesson-editor.md
// §2). Extend this list when a real lesson needs a language that isn't here — don't pre-guess.
export const LESSON_CODE_LANGUAGES = ["text", "bash", "css", "html", "http", "js"] as const;

/**
 * The exact extension set used by the lesson content editor, factored out so the round-trip
 * fidelity test (lesson-content-editor.roundtrip.test.ts) exercises the identical configuration
 * that ships to authors — never a hand-simplified stand-in that could pass while the real editor
 * fails.
 *
 * Deliberately excludes, even though `@tiptap/starter-kit` bundles them by default:
 * - `underline`: markdown/GFM has no underline syntax and `LessonBody` renders with no
 *   `rehype-raw`, so a `<u>` fallback would be invisible on the lesson page — the exact "control
 *   that produces invisible output" failure mode this editor must not ship.
 * - `strike`, `horizontalRule`: not used in any of the 20 real lessons and not styled by
 *   `LessonBody` — kept out to keep the toolbar's vocabulary matching real content exactly.
 *
 * Heading is restricted to levels 2 and 3 because those are the only two `LessonBody` gives
 * distinct styling to (`h1` renders identically to `h2`, so offering `h1` would just be a
 * confusing duplicate button) and the only two that appear in any real lesson.
 *
 * Table support is kept even though `LessonBody` has no custom styling for `<table>` — see §2 of
 * the plan doc: two real lessons already contain GFM tables, and dropping table support would
 * destroy them the first time anyone re-saves through this editor.
 */
export function getLessonEditorExtensions(): AnyExtension[] {
  return [
    StarterKit.configure({
      heading: { levels: [2, 3] },
      bulletList: { HTMLAttributes: {} },
      underline: false,
      strike: false,
      horizontalRule: false,
    }),
    TableKit.configure({
      table: { resizable: false },
    }),
    Markdown.configure({
      // Matches production content: every list in every real lesson is 2-space indented.
      indentation: { style: "space", size: 2 },
    }),
  ];
}
```

Note on the bullet marker: production content only ever uses `-`. `@tiptap/markdown`'s serialiser
(unlike `tiptap-markdown`'s `bulletListMarker` option) does not expose a top-level "always use this
character" switch in its `MarkdownExtensionOptions` (confirmed by reading the published
`dist/index.d.ts` — see §1). If Step 8's round-trip test shows it already defaults to `-` (likely,
since that's the common default across markdown serialisers), no action needed. If it defaults to
`*`, that's still semantically equivalent under this plan's AST-based bar (§8) and not a fidelity
bug — just a cosmetic diff an author would see once, the first time they re-save an old lesson,
that never affects `LessonBody`'s rendered output. Do not spend implementation time forcing a
specific marker character unless the round-trip test's AST comparison actually fails.

## 5. New file: the editor component

`src/components/admin/lesson-content-editor.tsx`:

```tsx
"use client";

import { useEffect } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import {
  Bold,
  Code,
  Code2,
  Heading2,
  Heading3,
  Italic,
  Link2,
  List,
  ListOrdered,
  Quote,
  Redo2,
  Table2,
  Undo2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { getLessonEditorExtensions, LESSON_CODE_LANGUAGES } from "./lesson-content-editor-extensions";

type LessonContentEditorProps = {
  id: string;
  value: string;
  onChange: (markdown: string) => void;
  ariaLabel: string;
  ariaInvalid?: boolean;
  ariaDescribedBy?: string;
};

function ToolbarButton({
  label,
  active,
  disabled,
  onClick,
  children,
}: {
  label: string;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <Button
      type="button"
      variant={active ? "default" : "ghost"}
      size="icon-sm"
      aria-label={label}
      aria-pressed={active}
      disabled={disabled}
      onClick={onClick}
    >
      {children}
    </Button>
  );
}

export function LessonContentEditor({
  id,
  value,
  onChange,
  ariaLabel,
  ariaInvalid,
  ariaDescribedBy,
}: LessonContentEditorProps) {
  const editor = useEditor({
    extensions: getLessonEditorExtensions(),
    content: value,
    contentType: "markdown",
    immediatelyRender: false,
    editorProps: {
      attributes: {
        id,
        role: "textbox",
        "aria-multiline": "true",
        "aria-label": ariaLabel,
        ...(ariaInvalid ? { "aria-invalid": "true" } : {}),
        ...(ariaDescribedBy ? { "aria-describedby": ariaDescribedBy } : {}),
        class:
          "min-h-32 w-full rounded-md rounded-t-none border border-t-0 border-input bg-paper px-2.5 py-2 text-base shadow-xs outline-none focus-visible:ring-3 focus-visible:ring-ring/50 [&_p]:my-2 [&_h2]:mt-4 [&_h2]:text-lg [&_h2]:font-bold [&_h3]:mt-3 [&_h3]:font-bold [&_blockquote]:border-l-2 [&_blockquote]:border-violet [&_blockquote]:pl-3 [&_blockquote]:italic [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:list-decimal [&_ol]:pl-6 [&_code]:rounded [&_code]:bg-pale-lilac [&_code]:px-1 [&_pre]:rounded-md [&_pre]:bg-pale-lilac [&_pre]:p-3 [&_table]:w-full [&_table]:border-collapse [&_td]:border [&_td]:border-border [&_td]:p-1.5 [&_th]:border [&_th]:border-border [&_th]:p-1.5 [&_th]:text-left md:text-sm",
      },
    },
    onUpdate: ({ editor: current }) => {
      onChange(current.getMarkdown());
    },
  });

  // Semi-controlled: while the field is focused, the editor is the source of truth and
  // `onUpdate` above is already keeping the parent's state in sync — resyncing `value` back in
  // here would fight the user's live cursor position on every keystroke. When the field is NOT
  // focused, an external `value` change (e.g. `ModulesEditor` re-indexing lesson rows after a
  // sibling lesson is removed, which reuses this row's array index for different lesson data)
  // must still be picked up, or the editor would keep showing stale content until the user
  // clicked in and typed.
  useEffect(() => {
    if (!editor) return;
    if (editor.isFocused) return;
    if (editor.getMarkdown() === value) return;
    editor.commands.setContent(value, { contentType: "markdown" });
  }, [value, editor]);

  if (!editor) return null;

  const inCodeBlock = editor.isActive("codeBlock");
  const codeBlockLanguage = (editor.getAttributes("codeBlock").language as string | undefined) ?? "text";

  return (
    <div className="flex flex-col">
      <div className="flex flex-wrap items-center gap-1 rounded-t-md border border-input bg-pale-lilac/40 p-1">
        <ToolbarButton
          label="Heading"
          active={editor.isActive("heading", { level: 2 })}
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        >
          <Heading2 />
        </ToolbarButton>
        <ToolbarButton
          label="Subheading"
          active={editor.isActive("heading", { level: 3 })}
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
        >
          <Heading3 />
        </ToolbarButton>
        <ToolbarButton
          label="Bold"
          active={editor.isActive("bold")}
          onClick={() => editor.chain().focus().toggleBold().run()}
        >
          <Bold />
        </ToolbarButton>
        <ToolbarButton
          label="Italic"
          active={editor.isActive("italic")}
          onClick={() => editor.chain().focus().toggleItalic().run()}
        >
          <Italic />
        </ToolbarButton>
        <ToolbarButton
          label="Bulleted list"
          active={editor.isActive("bulletList")}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
        >
          <List />
        </ToolbarButton>
        <ToolbarButton
          label="Numbered list"
          active={editor.isActive("orderedList")}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
        >
          <ListOrdered />
        </ToolbarButton>
        <ToolbarButton
          label="Quote"
          active={editor.isActive("blockquote")}
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
        >
          <Quote />
        </ToolbarButton>
        <ToolbarButton
          label="Inline code"
          active={editor.isActive("code")}
          onClick={() => editor.chain().focus().toggleCode().run()}
        >
          <Code />
        </ToolbarButton>
        <ToolbarButton
          label="Code block"
          active={inCodeBlock}
          onClick={() => editor.chain().focus().toggleCodeBlock().run()}
        >
          <Code2 />
        </ToolbarButton>
        <ToolbarButton
          label="Link"
          active={editor.isActive("link")}
          onClick={() => {
            const previousUrl = editor.getAttributes("link").href as string | undefined;
            // eslint-disable-next-line no-alert -- admin-only authoring tool, matches the plain
            // window.confirm/prompt already used elsewhere in this admin (see course-row-actions.tsx)
            const url = window.prompt("Link URL", previousUrl ?? "https://");
            if (url === null) return;
            if (url === "") {
              editor.chain().focus().extendMarkRange("link").unsetLink().run();
              return;
            }
            editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
          }}
        >
          <Link2 />
        </ToolbarButton>
        <ToolbarButton
          label="Insert table"
          active={editor.isActive("table")}
          onClick={() =>
            editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()
          }
        >
          <Table2 />
        </ToolbarButton>
        {inCodeBlock ? (
          <label className="ml-1 flex items-center gap-1.5 text-xs text-graphite">
            <span className="label-eyebrow">Lang</span>
            <select
              className="rounded border border-input bg-paper px-1 py-0.5 text-xs"
              value={codeBlockLanguage}
              onChange={(e) =>
                editor.chain().focus().updateAttributes("codeBlock", { language: e.target.value }).run()
              }
            >
              {LESSON_CODE_LANGUAGES.map((lang) => (
                <option key={lang} value={lang}>
                  {lang}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        <div className="ml-auto flex items-center gap-1">
          <ToolbarButton label="Undo" onClick={() => editor.chain().focus().undo().run()}>
            <Undo2 />
          </ToolbarButton>
          <ToolbarButton label="Redo" onClick={() => editor.chain().focus().redo().run()}>
            <Redo2 />
          </ToolbarButton>
        </div>
      </div>
      <EditorContent editor={editor} />
    </div>
  );
}
```

Notes on choices made in that file:

- `variant={active ? "default" : "ghost"}` on toolbar buttons reuses `Button`'s existing `default`
  variant, which is already `bg-primary` = Electric Violet (`--color-primary: var(--color-violet)`
  in `globals.css`). This means "this formatting is active" is shown using the app's one action
  colour, with zero new CSS — not a demo-Tiptap grey toggle.
- `immediatelyRender: false` matches Tiptap's own Next.js/SSR guidance. It's technically redundant
  once this component is behind `dynamic(..., { ssr: false })` (§6), since it then never renders
  server-side at all — kept anyway as defence in depth against React 19 Strict Mode's double-invoke
  in dev, which is cheap and explicitly recommended by Tiptap.
- The link prompt uses `window.prompt`, matching the existing plain-`confirm`-based pattern already
  in this admin (check `src/components/admin/course-row-actions.tsx` for precedent before assuming
  this is a new pattern the codebase doesn't already have).

## 6. Modify: `src/components/admin/modules-editor.tsx`

Dynamic-import the editor so it doesn't land in the shared client chunk — this file is already
`"use client"`, so `next/dynamic` can be called directly in it.

Add near the top, alongside the other imports:

```tsx
import dynamic from "next/dynamic";
```

Add below the existing imports, before `EMPTY_LESSON`:

```tsx
const LessonContentEditor = dynamic(
  () => import("./lesson-content-editor").then((m) => m.LessonContentEditor),
  {
    ssr: false,
    loading: () => <Textarea disabled className="mt-1.5 min-h-32" aria-hidden="true" />,
  },
);
```

Replace the existing content field block (lines 242–265 in the current file):

```tsx
                  <div className="mt-3">
                    <Label htmlFor={`${prefix}.content`}>Content (Markdown)</Label>
                    <Textarea
                      id={`${prefix}.content`}
                      className="mt-1.5 min-h-32"
                      value={lesson.content}
                      onChange={(e) =>
                        updateLesson(moduleIndex, lessonIndex, { content: e.target.value })
                      }
                      aria-invalid={errors[`${prefix}.content`] ? true : undefined}
                      aria-describedby={
                        errors[`${prefix}.content`] ? `${prefix}.content-error` : undefined
                      }
                    />
                    {errors[`${prefix}.content`] ? (
                      <p
                        id={`${prefix}.content-error`}
                        role="alert"
                        className="mt-1 text-sm text-destructive"
                      >
                        {errors[`${prefix}.content`]}
                      </p>
                    ) : null}
                  </div>
```

with:

```tsx
                  <div className="mt-3">
                    <Label htmlFor={`${prefix}.content`}>Content</Label>
                    <div className="mt-1.5">
                      <LessonContentEditor
                        id={`${prefix}.content`}
                        value={lesson.content}
                        onChange={(content) => updateLesson(moduleIndex, lessonIndex, { content })}
                        ariaLabel={`Lesson ${lessonIndex + 1} content`}
                        ariaInvalid={Boolean(errors[`${prefix}.content`])}
                        ariaDescribedBy={
                          errors[`${prefix}.content`] ? `${prefix}.content-error` : undefined
                        }
                      />
                    </div>
                    {errors[`${prefix}.content`] ? (
                      <p
                        id={`${prefix}.content-error`}
                        role="alert"
                        className="mt-1 text-sm text-destructive"
                      >
                        {errors[`${prefix}.content`]}
                      </p>
                    ) : null}
                  </div>
```

(The label text drops "(Markdown)" since the field no longer visibly shows markdown syntax to the
author — the rendered rich text is now the primary surface. Storage format is an implementation
detail, not something to advertise in the UI copy anymore.)

`Textarea` stays imported in this file (still used for the `loading` fallback and, unchanged,
for `description` elsewhere — check the diff doesn't remove an import still in use).

## 7. Accessibility checklist (verify each line against the diff before calling this done)

- Accessible name: `aria-label` on the ProseMirror `role="textbox"` div (`editorProps.attributes["aria-label"]`), passed through as `ariaLabel={`Lesson ${lessonIndex + 1} content`}` — every lesson gets a distinct, position-based name, matching how `Label`/`Input` pairs work elsewhere in this same file.
- Error association: `aria-describedby` set to the same `${prefix}.content-error` id the visible error `<p>` already uses, only when an error exists — identical pattern to every other field in `modules-editor.tsx`.
- `aria-invalid="true"` set on the editable div when `errors[...]` is truthy — same condition the old `<Textarea aria-invalid>` used.
- Keyboard reachability: the toolbar is a row of real `<button>` elements (via `Button`/`ButtonPrimitive`), each with its own `aria-label` and native tab order — reachable and activatable with Tab/Space/Enter with no extra work. The editable area itself (`role="textbox"`, `contenteditable` under the hood) is natively focusable and is where Tab naturally lands after the last toolbar button.
- `aria-pressed` on each toggle button reflects `editor.isActive(...)`, so a screen reader announces "Bold, pressed" / "Bold, not pressed" — there was no equivalent state to preserve in the old plain `<Textarea>`, this is new coverage, not a regression.
- One thing this plan does **not** solve and flags honestly: a `<label htmlFor="...">` normally lets a mouse click on the label text focus the associated control natively; that behavior is spec'd for form controls, not arbitrary `role="textbox"` divs, and support varies by browser. The `id` on the editable div still matches the `<Label htmlFor>` value for consistency and CSS/testing hooks, but do not rely on label-click-to-focus working here — call this out in manual QA (§9) rather than assuming it "just works" the way it did for `<Textarea>`.

## 8. Round-trip fidelity test (the actual gate for this whole plan)

### What "equivalent" means here, and why

**Byte-identical is the wrong bar.** A markdown serialiser is free to normalize things that never
change what `LessonBody` renders: `-` vs `*` bullets, backslash-escaping a literal character that
would otherwise be misread as formatting on the next parse, blank-line count between blocks,
trailing whitespace. None of those reach the DOM differently.

**The bar this plan uses: parse the original markdown and the round-tripped markdown with the
exact same parser `LessonBody` uses in production (`remark-parse` + `remark-gfm`), strip position
metadata, and require the two resulting syntax trees to be deep-equal.** Two documents are
"equivalent" if and only if they'd produce the same mdast tree — which is precisely the input
`react-markdown` turns into DOM nodes. If the trees match, `LessonBody` renders identically,
full stop, regardless of what the underlying markdown text looks like byte-for-byte. This is
strictly stronger than "looks the same to a human skimming it" and strictly weaker (correctly) than
"identical bytes."

### New file: `src/components/admin/lesson-content-editor.roundtrip.test.ts`

This does **not** render any React component — it builds a headless `@tiptap/core` `Editor`
directly (no `element` option; Tiptap creates a detached DOM node, which works fine under Vitest's
`jsdom` environment already configured in `vitest.config.ts`). That's a deliberate, minimal test
surface: it exercises the exact same `getLessonEditorExtensions()` the real component uses,
without needing to simulate typing.

```ts
import { describe, expect, it } from "vitest";
import { Editor } from "@tiptap/core";
import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import type { Root } from "mdast";
import { getLessonEditorExtensions } from "./lesson-content-editor-extensions";

// Real production lesson content, captured verbatim from the database on 2026-09-05 (see
// docs/superpowers/plans/2026-09-05-tiptap-lesson-editor.md §2 for how and why these two were
// chosen: they're the only two of the 20 real lessons that use GFM tables, one with a
// left-aligned-only table and one with a right-aligned numeric column, plus the mix of
// blockquotes/bold/italic/fenced-code-with-language that's typical of the other 18).
const FIXTURES: Record<string, string> = {
  "building-a-palette": `## Before: seven attractive swatches

The first palette file contains seven colours and no usage notes. A designer uses violet for a heading. A developer uses it for a button. Someone else puts pale lilac body text on paper because the combination looks quiet. Every choice comes from taste, so the same colours produce three different systems.

The Sodales source values themselves are clear:

\`\`\`css
--color-obsidian: #111111;
--color-ivory: #f4f2ed;
--color-graphite: #35373b;
--color-violet: #5e4fb3;
--color-deep-ink: #211c35;
--color-pale-lilac: #ded9ef;
--color-paper: #fbfaf7;
\`\`\`

## Audit notes

The problem appears when each swatch meets content. Colour contrast belongs to a foreground-background pair, at a particular text size and weight. A colour that works as a large decorative shape may fail as small text.

The audit records each real use instead of rating colours in isolation:

| Element | Foreground | Background | Check |
| --- | --- | --- | --- |
| Body copy | Obsidian | Ivory | Text contrast |
| Card copy | Obsidian | Paper | Text contrast |
| Secondary copy | Graphite | Pale lilac | Text contrast |
| Link | Violet | Ivory | Normal, hover, focus |
| Quiet panel | Deep ink | Pale lilac | Text and icons |

Each proposed pair still needs a contrast tool check at its intended size. Grayscale and colour-vision simulations help reveal controls that depend on hue alone.

> A selected tab needs more than a new colour. Add an underline, weight change, shape, or another visible indicator.

## After: roles people can reuse

The revised file maps the palette to jobs: ivory for the main background, paper for card and popover surfaces, obsidian for primary text, graphite for secondary text, violet for tested accents, deep ink for dark surfaces, and pale lilac for quiet panels.

It also includes a short handoff list:

- Approved text and background pairs
- Link and button states, including keyboard focus
- Error and success labels that do not rely on colour
- Examples of pale lilac used as a surface rather than small text

The seven hex values have not changed. The after version removes guesswork by showing where each one belongs and which check each pairing still needs before it ships.
`,
  "hourly-vs-fixed": `## The brief and the two estimates

A bakery asks Ivo for a landing page with supplied copy, one enquiry form, responsive implementation, and one feedback round. He estimates twenty hours and charges ₱1,500 per hour.

\`\`\`text
Hourly estimate: 20 hours × ₱1,500 = ₱30,000
Fixed quote:                         ₱36,000
\`\`\`

The fixed quote is higher because Ivo carries the estimation risk. If the agreed page takes twenty-four hours, the fee stays ₱36,000. If it takes sixteen, the fee also stays ₱36,000. The client is buying a defined page and review process; Ivo still tracks time to learn whether his estimate was sound.

Under hourly billing, the final invoice follows the recorded time:

| Delivery | Hours | Invoice |
| --- | ---: | ---: |
| Original estimate | 20 | ₱30,000 |
| Faster method | 12 | ₱18,000 |
| Form needs investigation | 27 | ₱40,500 |

The twelve-hour row exposes the speed problem. Ivo improved his process and delivered the same agreed work sooner, yet earned ₱12,000 less than his original estimate. Hourly pricing pays for elapsed effort. It still makes sense when the work itself cannot be predicted.

> A fixed fee covers a fixed boundary. New pages, extra feedback rounds, or changed copy need a change order rather than silent free work.

## The decision

For this brief, Ivo chooses the fixed quote because both sides can answer these questions:

- Which page and form will exist at handoff?
- Who supplies copy and approves feedback?
- How many review rounds are included?
- What event counts as delivery?

Now imagine the bakery asks for “site help for the next month” and expects priorities to change each week. An hourly arrangement with a spending cap fits that uncertainty better. Another workable split is paid hourly discovery followed by a fixed build once the pages and responsibilities are known.

Neither quote removes the need for time records. If the fixed project takes twenty-seven hours, Ivo’s notes show whether the form, feedback, or his estimate caused the gap before he prices the next one.
`,
};

function stripPositions(node: unknown): unknown {
  if (Array.isArray(node)) return node.map(stripPositions);
  if (node && typeof node === "object") {
    const { position: _position, ...rest } = node as Record<string, unknown>;
    for (const key of Object.keys(rest)) {
      rest[key] = stripPositions(rest[key]);
    }
    return rest;
  }
  return node;
}

function toComparableAst(markdown: string): Root {
  const tree = unified().use(remarkParse).use(remarkGfm).parse(markdown);
  return stripPositions(tree) as Root;
}

function roundTrip(markdown: string): string {
  const editor = new Editor({
    extensions: getLessonEditorExtensions(),
    content: markdown,
    contentType: "markdown",
  });
  const out = editor.getMarkdown();
  editor.destroy();
  return out;
}

describe("lesson content editor: round-trip fidelity against real lesson content", () => {
  for (const [slug, markdown] of Object.entries(FIXTURES)) {
    it(`parse → edit-model → serialise is a semantic no-op for "${slug}" (no edits made)`, () => {
      const roundTripped = roundTrip(markdown);
      expect(toComparableAst(roundTripped)).toEqual(toComparableAst(markdown));
    });
  }
});
```

Run it in isolation first: `pnpm vitest run src/components/admin/lesson-content-editor.roundtrip.test.ts`.
Expected: `2 passed`. If either fails, Vitest's `toEqual` diff will point at the exact mdast node
that changed (e.g. a table cell's inline content, a code node's `lang` field) — use that diff to
decide whether it's a real bug or a case where the fixture markdown itself needs a second look
(e.g. if remark itself treats something in the fixture unexpectedly — verify by parsing the
original fixture alone first, before blaming Tiptap).

### Full-catalogue pre-flight audit (all 20 real lessons, not just 2)

Two fixtures cover the two lessons that need table coverage, but "20 real lessons in production"
deserves more than a 2-lesson sample before this ships. Add a read-only integration test,
following this repo's existing convention of tests that hit the real Postgres database directly
(see `mutations.integration.test.ts` for the pattern) — this one only reads, never writes, so it
needs no fixture cleanup:

`src/lib/content/lesson-content-roundtrip.integration.test.ts`:

```ts
// Hits the real database directly (read-only) — see CLAUDE.md's note on `*.integration.test.ts`
// files and `mutations.integration.test.ts` for why this is the established pattern here, and why
// @/db is an allowed import inside src/lib/content/.
import { describe, expect, it } from "vitest";
import { Editor } from "@tiptap/core";
import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import { db } from "@/db";
import { lesson } from "@/db/schema";
import { getLessonEditorExtensions } from "@/components/admin/lesson-content-editor-extensions";

function stripPositions(node: unknown): unknown {
  if (Array.isArray(node)) return node.map(stripPositions);
  if (node && typeof node === "object") {
    const { position: _position, ...rest } = node as Record<string, unknown>;
    for (const key of Object.keys(rest)) rest[key] = stripPositions(rest[key]);
    return rest;
  }
  return node;
}

function toComparableAst(markdown: string) {
  return stripPositions(unified().use(remarkParse).use(remarkGfm).parse(markdown));
}

function roundTrip(markdown: string): string {
  const editor = new Editor({ extensions: getLessonEditorExtensions(), content: markdown, contentType: "markdown" });
  const out = editor.getMarkdown();
  editor.destroy();
  return out;
}

describe("every real lesson survives a no-op round trip through the Tiptap editor model", () => {
  it("has no lesson whose parse→edit→serialise output diverges semantically from the original", async () => {
    const rows = await db.select({ id: lesson.id, slug: lesson.slug, content: lesson.content }).from(lesson);
    expect(rows.length).toBeGreaterThan(0);

    const failures: string[] = [];
    for (const row of rows) {
      const before = toComparableAst(row.content);
      const after = toComparableAst(roundTrip(row.content));
      const same = JSON.stringify(before) === JSON.stringify(after);
      if (!same) failures.push(row.slug);
    }

    expect(failures, `lessons that fail round-trip fidelity: ${failures.join(", ")}`).toEqual([]);
  });
});
```

Run with `pnpm test src/lib/content/lesson-content-roundtrip.integration.test.ts` against a real
`DATABASE_URL` (already how this repo's other `*.integration.test.ts` files work, per
`vitest.config.ts` loading `.env.local`). This is the actual go/no-go gate for shipping — not the
2-fixture unit test, which exists for fast local iteration and CI signal on every commit.

## 9. Component-level tests, and an honest line on what jsdom/ProseMirror can and can't do here

`@testing-library/user-event` is not installed; everything below uses `fireEvent`, matching
`course-form.test.tsx`'s existing style.

**Can test reliably in jsdom:**
- The component mounts without throwing when given a real markdown string as `value`.
- Every toolbar button renders with the expected `aria-label` (query via `screen.getByRole("button", { name: "Bold" })` etc.) — this is plain DOM assertion, nothing ProseMirror-specific.
- The editable region has `role="textbox"`, the right `aria-label`, and — when an `ariaInvalid`/`ariaDescribedBy` prop is passed — the right `aria-invalid`/`aria-describedby` values. Query with `container.querySelector('[role="textbox"]')` or `screen.getByRole("textbox", { name: ... })`.
- Loading state: mock `next/dynamic`'s target module (same technique `course-form.test.tsx` uses for `@/lib/content/mutations`) is unnecessary here since there's no server-only import chain in `lesson-content-editor.tsx` — but confirm this at implementation time by trying an unmocked render first, since `next/dynamic` inside `ModulesEditor`'s own test (if one is added) may need `{ ssr: false }` handling under Vitest; if it errors, wrap with `vi.mock("next/dynamic", () => ({ default: (loader) => { ... } }))` returning a lazily-resolved sync component, following whatever pattern `track-map.test.tsx` already uses for comparable Next-specific mocking.

**Cannot be reliably tested via `fireEvent` in jsdom, and this plan does not pretend otherwise:**
- Actually typing text into the ProseMirror contenteditable region. ProseMirror's `EditorView` listens for native `beforeinput`/`input`/composition events and reconciles the DOM itself; jsdom's `contenteditable` support is partial (no real caret/selection rendering, no `Range.getClientRects`), and `fireEvent.input`/`fireEvent.keyDown` on a contenteditable div does not reliably produce the same ProseMirror transactions a real browser keystroke does. Do not write a test that asserts "typing X produces markdown Y" — it will be flaky at best and give false confidence at worst.
- Toolbar "active" state changing in response to cursor movement/selection (`editor.isActive(...)` after clicking inside existing formatted text) — depends on real `Selection`/`Range` behavior jsdom doesn't fully implement.
- Table column resize (disabled anyway — `resizable: false` in §4 — so nothing to test).
- Keyboard shortcuts (Cmd/Ctrl+B, etc.) reaching ProseMirror's keymap correctly.

**Manual QA checklist (do this once, in a real browser, before merging):**
1. Open an existing lesson with a table (`building-a-palette` or `hourly-vs-fixed`) in the admin course form, make no edits, save, and confirm `/learn/.../<lesson>` renders identically to before (this is the real-world version of §8's automated check).
2. Type a paragraph, toggle bold/italic mid-word, confirm the lesson page shows the same emphasis.
3. Create a table, add/remove a row and column, save, confirm it renders as a real `<table>` on the lesson page (unstyled is expected and fine — see §2).
4. Tab through the toolbar with keyboard only, confirm every button is reachable and each one's focus ring is visible (should inherit `focus-visible:ring-3 focus-visible:ring-ring/50` from `Button`).
5. Trigger the field's validation error (e.g. clear a lesson's content below 50 characters and submit), confirm the error message appears and is announced (screen reader or axe devtools) via `aria-describedby`.
6. Paste a large block of existing markdown (e.g. copy `building-a-palette`'s raw text from the database) directly into the editor and confirm it's interpreted as formatted rich text, not literal `##`/`**` characters left visible.

## 10. Validation (`courseInputSchema`) — confirmed unaffected

`lessonSchema.content` in `src/lib/validation.ts` is `z.string().min(50, ...)` — it validates
the markdown string, and this plan never changes what type flows into `lesson.content` in
`CourseForm`'s state (`LessonContentEditor`'s `onChange` still hands back a plain `string`, same
as `Textarea`'s `onChange` did). No schema change needed. One thing to verify empirically once
implemented (can't fully confirm from reading `.d.ts` files alone): that a brand-new, empty lesson
(`EMPTY_LESSON.content = ""`) mounted into `LessonContentEditor` with `contentType: "markdown"`
round-trips back to `getMarkdown() === ""` rather than some non-empty placeholder (a stray
`&nbsp;` or empty-paragraph marker) — `@tiptap/markdown`'s shipped source has a documented
`isEmptyOutput` special case for exactly this, but confirm it holds by adding one more case to the
Step 8 unit test: `expect(roundTrip("")).toBe("")`. If that fails, the `min(50)` validation would
still correctly reject a technically-non-empty-but-still-blank lesson (an empty-looking value that
isn't literally `""` is still under 50 chars almost certainly), so this is a robustness check, not
a blocking risk — but confirm it rather than assume it.

## 11. Rollout order

1. Install packages (§3).
2. Add `lesson-content-editor-extensions.ts` (§4).
3. Add the two test files (§8) and get them green — this is the gate, do it before writing the
   component so there's no motivation to rationalize away a failure once the UI "looks done."
4. Add `lesson-content-editor.tsx` (§5).
5. Wire it into `modules-editor.tsx` (§6).
6. `pnpm typecheck && pnpm lint && pnpm build` — confirm no type errors (Tiptap's TS types are
   strict about extension generics) and that the dynamic import actually splits into its own
   chunk (`pnpm build`'s output lists a separate chunk for the admin route; eyeball that
   `@tiptap`/`marked`/`prosemirror-*` don't appear in the shared `_app`/root layout chunk).
7. Run the full test suite (`pnpm test`) plus the integration audit (§8) against a real
   `DATABASE_URL`.
8. Manual QA checklist (§9).
9. Ship. Keep the toolbar-scope table in §2 as the reference the next person checks before adding
   a new button — "does `LessonBody` render this, or does real content already depend on it" is
   the two-question test any future addition (task lists, images, etc.) has to pass.

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

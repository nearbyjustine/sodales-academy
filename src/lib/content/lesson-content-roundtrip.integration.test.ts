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
    const rest: Record<string, unknown> = { ...(node as Record<string, unknown>) };
    delete rest.position;
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

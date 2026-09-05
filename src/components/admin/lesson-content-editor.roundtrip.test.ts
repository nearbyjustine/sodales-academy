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
    const rest: Record<string, unknown> = { ...(node as Record<string, unknown>) };
    delete rest.position;
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

  it("round-trips an empty lesson back to an empty string, not a placeholder", () => {
    expect(roundTrip("")).toBe("");
  });
});

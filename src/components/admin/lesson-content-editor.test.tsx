import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { LessonContentEditor } from "./lesson-content-editor";

// `@testing-library/user-event` is not installed in this repo — every interaction below either
// asserts on rendered DOM only, or (where noted) is a behavior that cannot be reliably driven via
// `fireEvent` under jsdom's partial `contenteditable`/ProseMirror support. See §9 of
// docs/superpowers/plans/2026-09-05-tiptap-lesson-editor.md for the reasoning behind what is and
// isn't tested here.

const SAMPLE_MARKDOWN = "## A heading\n\nSome **bold** text and a paragraph.\n";

describe("LessonContentEditor", () => {
  it("mounts without throwing when given real markdown content", () => {
    render(
      <LessonContentEditor
        id="lesson-content"
        value={SAMPLE_MARKDOWN}
        onChange={() => {}}
        ariaLabel="Lesson 1 content"
      />,
    );
    expect(screen.getByRole("textbox", { name: "Lesson 1 content" })).toBeDefined();
  });

  it("renders every toolbar button with an accessible name", () => {
    render(
      <LessonContentEditor
        id="lesson-content"
        value={SAMPLE_MARKDOWN}
        onChange={() => {}}
        ariaLabel="Lesson 1 content"
      />,
    );
    const expectedLabels = [
      "Heading",
      "Subheading",
      "Bold",
      "Italic",
      "Bulleted list",
      "Numbered list",
      "Quote",
      "Inline code",
      "Code block",
      "Link",
      "Insert table",
      "Undo",
      "Redo",
    ];
    for (const label of expectedLabels) {
      expect(screen.getByRole("button", { name: label })).toBeDefined();
    }
  });

  it("associates the editable region with an error via aria-invalid/aria-describedby when invalid", () => {
    const { container } = render(
      <LessonContentEditor
        id="lesson-content"
        value={SAMPLE_MARKDOWN}
        onChange={() => {}}
        ariaLabel="Lesson 1 content"
        ariaInvalid
        ariaDescribedBy="lesson-content-error"
      />,
    );
    const textbox = container.querySelector('[role="textbox"]');
    expect(textbox).not.toBeNull();
    expect(textbox?.getAttribute("aria-invalid")).toBe("true");
    expect(textbox?.getAttribute("aria-describedby")).toBe("lesson-content-error");
  });

  it("does not set aria-invalid/aria-describedby when there is no error", () => {
    const { container } = render(
      <LessonContentEditor
        id="lesson-content"
        value={SAMPLE_MARKDOWN}
        onChange={() => {}}
        ariaLabel="Lesson 1 content"
      />,
    );
    const textbox = container.querySelector('[role="textbox"]');
    expect(textbox?.getAttribute("aria-invalid")).toBeNull();
    expect(textbox?.getAttribute("aria-describedby")).toBeNull();
  });

  // Cannot be reliably tested via `fireEvent` in jsdom: actually typing into the ProseMirror
  // contenteditable region relies on native `beforeinput`/composition events and ProseMirror's own
  // DOM reconciliation, which jsdom's partial contenteditable support does not faithfully emulate.
  // A test asserting "typing X produces markdown Y" would be flaky at best, so it is intentionally
  // not written — see plan §9 for the full list of untestable-under-jsdom behaviors (toolbar
  // active-state-on-selection, keyboard shortcuts reaching ProseMirror's keymap, table resize).
});

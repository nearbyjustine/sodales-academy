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
            // Admin-only authoring tool, matches the plain window.confirm/prompt pattern already
            // used elsewhere in this admin (see course-row-actions.tsx).
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

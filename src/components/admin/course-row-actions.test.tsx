import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, within, fireEvent, waitFor } from "@testing-library/react";

// Same `next/headers`-under-Vitest problem as the form tests; same mock shape as
// `track-map.test.tsx`. `publishCourse`/`unpublishCourse` are stubbed but unused by these tests —
// A3 only touches the delete flow.
const mockDeleteCourse = vi.fn();
vi.mock("@/lib/content/mutations", () => ({
  deleteCourse: (...args: unknown[]) => mockDeleteCourse(...args),
  publishCourse: vi.fn(),
  unpublishCourse: vi.fn(),
}));
const mockRefresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: mockRefresh }) }));

const { CourseRowActions } = await import("./course-row-actions");

// The plan (docs/qa/plans/ws2-form-safety.md, Step 7) predicted Base UI's Menu.Trigger opens on
// `mousedown` rather than `click`, based on reading MenuTrigger.js's `useClick` config. Empirically,
// against the installed @base-ui/react@1.7.0 in this jsdom environment, a plain `fireEvent.click`
// on the trigger does open the menu (`useClick` also treats a synthesized `click` as an activation,
// the same path keyboard activation takes) while `fireEvent.mouseDown` alone does not — confirmed
// by directly comparing both against `screen.queryAllByRole("menuitem")`. `click` is used here since
// it is what actually reaches the handler in this test environment.
function openDeleteConfirmation(courseTitle: string) {
  fireEvent.click(screen.getByRole("button", { name: `Actions for ${courseTitle}` }));
  fireEvent.click(screen.getByRole("menuitem", { name: "Delete" }));
}

describe("CourseRowActions — delete dialog", () => {
  afterEach(() => {
    mockDeleteCourse.mockReset();
    mockRefresh.mockReset();
  });

  it("stays open with the reason surfaced when the delete fails", async () => {
    mockDeleteCourse.mockResolvedValue({ ok: false, message: "Course has active enrollments." });

    render(
      <CourseRowActions id="course-1" courseId="course-slug" courseTitle="QA Course" status="draft" />,
    );

    openDeleteConfirmation("QA Course");
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByRole("button", { name: "Cancel" })).toBeDefined();

    fireEvent.click(within(dialog).getByRole("button", { name: "Delete" }));

    await waitFor(() => expect(mockDeleteCourse).toHaveBeenCalledWith("course-1"));

    // The defect this test targets: on failure, the dialog used to vanish (DialogClose fired
    // synchronously) while an error toast fired and the undeleted row stayed in the table. If
    // Step 5's fix regresses back to a `DialogClose`-wrapped Delete button, this dialog is gone
    // by now and `getByRole("dialog")` throws.
    const stillOpenDialog = screen.getByRole("dialog");
    expect(within(stillOpenDialog).getByRole("button", { name: "Cancel" })).toBeDefined();
    const confirmButton = within(stillOpenDialog).getByRole("button", {
      name: "Delete",
    }) as HTMLButtonElement;
    expect(confirmButton.disabled).toBe(false);
    expect(mockRefresh).not.toHaveBeenCalled();
  });

  it("closes and refreshes the list when the delete succeeds", async () => {
    mockDeleteCourse.mockResolvedValue({ ok: true });

    render(
      <CourseRowActions
        id="course-2"
        courseId="course-slug-2"
        courseTitle="QA Course Two"
        status="draft"
      />,
    );

    openDeleteConfirmation("QA Course Two");
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Delete" }));

    await waitFor(() => expect(mockRefresh).toHaveBeenCalledTimes(1));
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("ignores Escape and Cancel while a delete is in flight", async () => {
    mockDeleteCourse.mockImplementation(() => new Promise(() => {})); // never resolves

    render(
      <CourseRowActions
        id="course-3"
        courseId="course-slug-3"
        courseTitle="QA Course Three"
        status="draft"
      />,
    );

    openDeleteConfirmation("QA Course Three");
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Delete" }));

    await waitFor(() => {
      const pendingButton = within(screen.getByRole("dialog")).getByRole("button", {
        name: "Deleting…",
      }) as HTMLButtonElement;
      expect(pendingButton.disabled).toBe(true);
    });

    // Both dismissal attempts must be no-ops while `deletePending` is true — this is
    // `handleDeleteDialogOpenChange`'s guard under direct test.
    fireEvent.keyDown(document, { key: "Escape", code: "Escape" });
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Cancel" }));

    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByRole("button", { name: "Deleting…" })).toBeDefined();
  });
});

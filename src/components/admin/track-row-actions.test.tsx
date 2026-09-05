import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, within, fireEvent, waitFor } from "@testing-library/react";

const mockDeleteTrack = vi.fn();
vi.mock("@/lib/content/mutations", () => ({
  deleteTrack: (...args: unknown[]) => mockDeleteTrack(...args),
  publishTrack: vi.fn(),
  unpublishTrack: vi.fn(),
}));
const mockRefresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: mockRefresh }) }));

const { TrackRowActions } = await import("./track-row-actions");

// See course-row-actions.test.tsx for why `click` (not `mousedown`) is used to open the trigger —
// empirically confirmed against the installed @base-ui/react@1.7.0 in this jsdom environment.
function openDeleteConfirmation(trackTitle: string) {
  fireEvent.click(screen.getByRole("button", { name: `Actions for ${trackTitle}` }));
  fireEvent.click(screen.getByRole("menuitem", { name: "Delete" }));
}

describe("TrackRowActions — delete dialog", () => {
  afterEach(() => {
    mockDeleteTrack.mockReset();
    mockRefresh.mockReset();
  });

  it("stays open with the reason surfaced when the delete fails", async () => {
    mockDeleteTrack.mockResolvedValue({ ok: false, message: "Track has enrolled learners." });

    render(<TrackRowActions id="track-1" trackTitle="QA Track" status="draft" />);

    openDeleteConfirmation("QA Track");
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Delete" }));

    await waitFor(() => expect(mockDeleteTrack).toHaveBeenCalledWith("track-1"));

    const stillOpenDialog = screen.getByRole("dialog");
    const confirmButton = within(stillOpenDialog).getByRole("button", {
      name: "Delete",
    }) as HTMLButtonElement;
    expect(confirmButton.disabled).toBe(false);
    expect(mockRefresh).not.toHaveBeenCalled();
  });

  it("closes and refreshes the list when the delete succeeds", async () => {
    mockDeleteTrack.mockResolvedValue({ ok: true });

    render(<TrackRowActions id="track-2" trackTitle="QA Track Two" status="draft" />);

    openDeleteConfirmation("QA Track Two");
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Delete" }));

    await waitFor(() => expect(mockRefresh).toHaveBeenCalledTimes(1));
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("ignores Escape and Cancel while a delete is in flight", async () => {
    mockDeleteTrack.mockImplementation(() => new Promise(() => {}));

    render(<TrackRowActions id="track-3" trackTitle="QA Track Three" status="draft" />);

    openDeleteConfirmation("QA Track Three");
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Delete" }));

    await waitFor(() => {
      const pendingButton = within(screen.getByRole("dialog")).getByRole("button", {
        name: "Deleting…",
      }) as HTMLButtonElement;
      expect(pendingButton.disabled).toBe(true);
    });

    fireEvent.keyDown(document, { key: "Escape", code: "Escape" });
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Cancel" }));

    expect(
      within(screen.getByRole("dialog")).getByRole("button", { name: "Deleting…" }),
    ).toBeDefined();
  });
});

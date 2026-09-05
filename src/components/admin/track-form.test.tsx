import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import type { TrackDetail } from "@/lib/content/types";

// Same `next/headers`-under-Vitest problem as course-form.test.tsx; same mock shape.
const mockUpdateTrack = vi.fn<(...args: unknown[]) => Promise<never>>(() => new Promise(() => {}));
const mockCreateTrack = vi.fn();
vi.mock("@/lib/content/mutations", () => ({
  createTrack: (...args: unknown[]) => mockCreateTrack(...args),
  updateTrack: (...args: unknown[]) => mockUpdateTrack(...args),
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

const { TrackForm } = await import("./track-form");

// Already valid per `trackInputSchema` (see src/lib/validation.ts).
const validTrack: TrackDetail = {
  id: "track-1",
  slug: "qa-regression-track",
  title: "QA Regression Track",
  promise: "Ship one thing.",
  outcome: "You finish able to ship one thing end to end.",
  status: "draft",
  position: 0,
  courseCount: 0,
  lessonCount: 0,
  courses: [],
};

describe("TrackForm", () => {
  afterEach(() => {
    mockUpdateTrack.mockClear();
  });

  it("disables and relabels the submit button while updateTrack is in flight", async () => {
    render(<TrackForm track={validTrack} courses={[]} />);

    const submit = screen.getByRole("button", { name: "Save track" }) as HTMLButtonElement;
    expect(submit.disabled).toBe(false);

    fireEvent.submit(submit.closest("form")!);

    await waitFor(() => {
      const pendingButton = screen.getByRole("button", { name: "Saving…" }) as HTMLButtonElement;
      expect(pendingButton.disabled).toBe(true);
    });

    fireEvent.submit(submit.closest("form")!);
    expect(mockUpdateTrack).toHaveBeenCalledTimes(1);
  });
});

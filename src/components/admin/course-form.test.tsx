import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import type { CourseInput } from "@/lib/validation";

// `CourseForm` imports `createCourse`/`updateCourse` from `@/lib/content/mutations`, which
// transitively pulls in `@neondatabase/auth`'s bare `next/headers` import — Node's strict ESM
// loader can't resolve that outside Next's own bundler (see CLAUDE.md and
// `src/components/track/track-map.test.tsx`, which documents/works around the same problem).
// `mockUpdateCourse` never resolves, so `pending` has no way to flip back to `false` mid-test.
const mockUpdateCourse = vi.fn<(...args: unknown[]) => Promise<never>>(() => new Promise(() => {}));
const mockCreateCourse = vi.fn();
vi.mock("@/lib/content/mutations", () => ({
  createCourse: (...args: unknown[]) => mockCreateCourse(...args),
  updateCourse: (...args: unknown[]) => mockUpdateCourse(...args),
}));

// `CourseForm` also calls `useRouter()` for the post-save `router.push`, which throws outside a
// real Next.js app-router tree (same reason `track-map.test.tsx` stubs it). Nothing here reaches
// the push, since `updateCourse` never resolves, but the hook still has to exist.
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

const { CourseForm } = await import("./course-form");

// Already valid per `courseInputSchema` (see src/lib/validation.ts) — submitting this with no
// field edits exercises the pending state without simulating typing into every required input,
// including the nested `ModulesEditor` fields.
const validCourse: CourseInput = {
  title: "QA Regression Course",
  slug: "qa-regression-course",
  description: "A course fixture used only to exercise the pending-state regression test.",
  category: "Design",
  level: "beginner",
  modules: [
    {
      title: "Module One",
      position: 1,
      lessons: [
        {
          title: "Lesson One",
          slug: "lesson-one",
          position: 1,
          isPreview: false,
          content: "x".repeat(60),
        },
      ],
    },
  ],
  instructorUserId: "11111111-1111-4111-8111-111111111111",
};

describe("CourseForm", () => {
  afterEach(() => {
    mockUpdateCourse.mockClear();
  });

  it("disables and relabels the submit button while updateCourse is in flight", async () => {
    render(
      <CourseForm
        initial={validCourse}
        heading="Edit course"
        courseId="course-1"
        viewerRole="admin"
        instructors={[{ userId: validCourse.instructorUserId, name: "Instructor One" }]}
      />,
    );

    const submit = screen.getByRole("button", { name: "Save course" }) as HTMLButtonElement;
    expect(submit.disabled).toBe(false);

    fireEvent.submit(submit.closest("form")!);

    await waitFor(() => {
      const pendingButton = screen.getByRole("button", { name: "Saving…" }) as HTMLButtonElement;
      expect(pendingButton.disabled).toBe(true);
    });

    // A second submit while pending must not fire a second mutation call — this is the literal
    // "second click fires a second create" failure mode from A2.
    fireEvent.submit(submit.closest("form")!);
    expect(mockUpdateCourse).toHaveBeenCalledTimes(1);
  });
});

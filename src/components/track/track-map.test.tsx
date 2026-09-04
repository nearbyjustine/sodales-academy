import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import type { TrackDetail, TrackCourse } from "@/lib/content/types";

// `TrackMap` renders `EnrollTrackButton`, which imports `enrollInTrack` from
// `@/lib/content/mutations`. That module (transitively, via `@/lib/session` ->
// `@/lib/auth/server`) pulls in `@neondatabase/auth`'s bare `next/headers`
// import, which Node's strict ESM loader can't resolve outside Next's own
// bundler — the same problem `mutations.test.ts`/`session.test.ts`/
// `enrollment-mutations.test.ts` document and mock around (see CLAUDE.md).
// None of these tests exercise the enrol write itself (that's covered by
// `track-mutations.test.ts`), so the whole module is stubbed here.
vi.mock("@/lib/content/mutations", () => ({ enrollInTrack: vi.fn() }));

// `EnrollTrackButton` also calls `useRouter()` (for the post-enrol
// `router.refresh()`), which throws "invariant expected app router to be
// mounted" when rendered outside a real Next.js app-router tree. None of
// these tests click the button, so a minimal stub is enough.
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

const { TrackMap } = await import("./track-map");

function course(slug: string, position: number, lessonCount: number, done: number): TrackCourse {
  return {
    id: slug, slug, title: `Course ${slug}`, description: "d", category: "T",
    level: "beginner", status: "published", instructorName: "Ins",
    lessonCount, position, completedLessonCount: done,
  };
}

const track: TrackDetail = {
  id: "t", slug: "freelance", title: "Freelance Brand Designer",
  promise: "Cold DM to invoice.", outcome: "You finish able to ship a brand system.",
  status: "published", position: 0, courseCount: 2, lessonCount: 7,
  courses: [course("a", 0, 4, 4), course("b", 1, 3, 1)],
};

describe("TrackMap", () => {
  it("states the outcome for a visitor who has not enrolled", () => {
    render(<TrackMap track={track} enrolled={false} />);
    expect(screen.getByText(/You finish able to ship a brand system\./)).toBeDefined();
  });

  it("shows every course in the climb even when not enrolled", () => {
    render(<TrackMap track={track} enrolled={false} />);
    expect(screen.getByText("Course a")).toBeDefined();
    expect(screen.getByText("Course b")).toBeDefined();
  });

  it("shows real progress and one next action when enrolled", () => {
    render(<TrackMap track={track} enrolled />);
    expect(screen.getByText("5 of 7 lessons")).toBeDefined();
    const next = screen.getByRole("link", { name: /continue/i });
    expect(next.getAttribute("href")).toBe("/courses/b");
  });

  it("claims no progress for someone who has not enrolled", () => {
    // The unenrolled view must never imply the visitor has done anything.
    render(<TrackMap track={track} enrolled={false} />);
    expect(screen.queryByText(/of 7 lessons/)).toBeNull();
  });

  it("offers review rather than continue once the track is finished", () => {
    const finished: TrackDetail = { ...track, courses: [course("a", 0, 4, 4), course("b", 1, 3, 3)] };
    render(<TrackMap track={finished} enrolled />);
    expect(screen.getByText("7 of 7 lessons")).toBeDefined();
    expect(screen.queryByRole("link", { name: /continue/i })).toBeNull();
  });
});

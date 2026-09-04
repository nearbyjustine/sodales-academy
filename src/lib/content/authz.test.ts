import { describe, it, expect, vi, beforeEach } from "vitest";

const mockSelect = vi.fn();
vi.mock("@/db", () => ({
  db: { select: () => ({ from: () => ({ where: () => mockSelect() }) }) },
}));

// `assertCanManageCourse` now lives in `./authz` (moved out of `./mutations` because that file's
// top-of-file `"use server"` directive made the authorization function itself a POST-reachable
// Server Action — see `./authz`'s own doc comment). `./authz` only imports `@/db`, `@/db/schema`,
// and `type Session` from `@/lib/session` (type-only, erased at compile time), so — unlike
// `./mutations` — it never transitively pulls in `@neondatabase/auth`'s bare `next/headers` import
// that `src/lib/session.test.ts`/`enrollment-mutations.test.ts` document workarounds for. No auth
// mock needed here anymore.
const { assertCanManageCourse } = await import("./authz");

beforeEach(() => {
  mockSelect.mockReset();
});

describe("assertCanManageCourse", () => {
  it("allows admin to manage any course", async () => {
    mockSelect.mockResolvedValue([{ instructorUserId: "someone-else" }]);
    await expect(
      assertCanManageCourse("course-1", { userId: "admin-1", role: "admin" } as never),
    ).resolves.toBeUndefined();
  });

  it("allows an instructor to manage their own course", async () => {
    mockSelect.mockResolvedValue([{ instructorUserId: "instructor-1" }]);
    await expect(
      assertCanManageCourse("course-1", { userId: "instructor-1", role: "instructor" } as never),
    ).resolves.toBeUndefined();
  });

  it("rejects an instructor managing someone else's course", async () => {
    mockSelect.mockResolvedValue([{ instructorUserId: "instructor-1" }]);
    await expect(
      assertCanManageCourse("course-1", { userId: "instructor-2", role: "instructor" } as never),
    ).rejects.toThrow(/not authorized/i);
  });

  it("rejects a learner outright", async () => {
    mockSelect.mockResolvedValue([{ instructorUserId: "instructor-1" }]);
    await expect(
      assertCanManageCourse("course-1", { userId: "instructor-1", role: "learner" } as never),
    ).rejects.toThrow(/not authorized/i);
  });

  it("rejects an unknown course id", async () => {
    mockSelect.mockResolvedValue([]);
    await expect(
      assertCanManageCourse("nope", { userId: "admin-1", role: "admin" } as never),
    ).rejects.toThrow(/not found/i);
  });
});

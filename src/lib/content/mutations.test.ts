import { describe, it, expect, vi, beforeEach } from "vitest";

const mockSelect = vi.fn();
vi.mock("@/db", () => ({
  db: { select: () => ({ from: () => ({ where: () => mockSelect() }) }) },
}));

// `mutations.ts` imports `requireRole` from `@/lib/session`, which imports `auth` from
// `@/lib/auth/server`, which imports the real `@neondatabase/auth@0.5.0-beta` package. That
// package's compiled output does `import { cookies, headers } from "next/headers"` — a bare
// specifier the installed `next@16.3.4` (no `exports` map) can't resolve under Node's strict ESM
// loader outside Next's own bundler. Confirmed independent of Vitest: `node -e "import(...)"`
// against the compiled `dist/next/server/index.mjs` throws the identical
// `Cannot find module '.../next/headers'` error with no test framework involved at all. None of
// these 5 tests call `requireRole`/exercise auth — they only need the module graph to load — so
// this mirrors the exact mitigation `src/lib/session.test.ts` already uses for the same package.
vi.mock("@/lib/auth/server", () => ({
  auth: { getSession: vi.fn() },
}));

const { assertCanManageCourse } = await import("./mutations");

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

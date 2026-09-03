import { describe, it, expect, vi, beforeEach } from "vitest";

const cookieStore = { value: undefined as string | undefined };

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) =>
      name === "sodales-demo-role" && cookieStore.value
        ? { name, value: cookieStore.value }
        : undefined,
  }),
}));

const redirectMock = vi.fn(() => {
  throw new Error("NEXT_REDIRECT");
});
vi.mock("next/navigation", () => ({ redirect: redirectMock }));

const { getSession, requireRole } = await import("./session");

beforeEach(() => {
  cookieStore.value = undefined;
  redirectMock.mockClear();
});

describe("getSession", () => {
  it("defaults to the learner role when no cookie is set", async () => {
    const session = await getSession();
    expect(session!.role).toBe("learner");
    expect(session!.name).toBe("Alex Rivera");
  });

  it("reads the role from the cookie", async () => {
    cookieStore.value = "admin";
    expect((await getSession())!.role).toBe("admin");
  });

  it("falls back to learner for an unrecognised cookie value", async () => {
    cookieStore.value = "superuser";
    expect((await getSession())!.role).toBe("learner");
  });
});

describe("requireRole", () => {
  it("returns the session when the role is sufficient", async () => {
    cookieStore.value = "admin";
    const session = await requireRole("instructor", "admin");
    expect(session.role).toBe("admin");
  });

  it("redirects when the role is insufficient", async () => {
    cookieStore.value = "learner";
    await expect(requireRole("admin")).rejects.toThrow("NEXT_REDIRECT");
    expect(redirectMock).toHaveBeenCalledWith("/");
  });
});

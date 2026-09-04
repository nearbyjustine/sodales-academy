import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * `auth.getSession()` mock shape verified against the installed `@neondatabase/auth@0.5.0-beta`'s
 * actual runtime (`dist/server-b0OzGjXl.mjs`'s `createAuthServer`), not the plan's guessed
 * `auth.api.getSession({ headers })`:
 *
 * - The real method is `auth.getSession(...)` — no `api` namespace, no `headers` argument. The
 *   Next.js server wrapper (`createNextRequestContext` in `dist/next/server/index.mjs`) reads
 *   `cookies()`/`headers()` from `next/headers` itself, ambiently, so callers never pass them.
 * - It returns `{ data, error }`, mirroring every other Neon Auth server method
 *   (`fetchWithAuth`'s return shape). `data` is `{ session, user }` on success or
 *   `{ session: null, user: null }` when there is no session (see `SessionData` in
 *   `dist/types-CnMXQlnQ.d.mts`) — never `null` and never the bare session object.
 */
const mockGetSession = vi.fn();
vi.mock("@/lib/auth/server", () => ({
  auth: { getSession: mockGetSession },
}));

const mockSelect = vi.fn();
const mockInsert = vi.fn();
vi.mock("@/db", () => ({
  db: {
    select: () => ({ from: () => ({ where: () => mockSelect() }) }),
    insert: () => ({ values: () => ({ onConflictDoNothing: mockInsert }) }),
  },
}));

const redirectMock = vi.fn(() => {
  throw new Error("NEXT_REDIRECT");
});
vi.mock("next/navigation", () => ({ redirect: redirectMock }));

const mockCookieGet = vi.fn();
const mockCookieDelete = vi.fn();
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: mockCookieGet, delete: mockCookieDelete }),
}));

vi.mock("@/lib/auth/invite", () => ({
  verifyInviteToken: vi.fn((token: string) => (token === "valid-token" ? { inviteCodeId: "c1" } : null)),
  INVITE_TOKEN_COOKIE: "sodales-invite-token",
}));

const { getSession, requireUser, requireRole } = await import("./session");

beforeEach(() => {
  mockGetSession.mockReset();
  mockSelect.mockReset();
  mockInsert.mockReset();
  redirectMock.mockClear();
  mockCookieGet.mockReset();
  mockCookieDelete.mockReset();
});

describe("getSession", () => {
  it("returns null when there is no auth session", async () => {
    mockGetSession.mockResolvedValue({ data: { session: null, user: null }, error: null });
    expect(await getSession()).toBeNull();
  });

  it("joins the user_profile role onto the auth session", async () => {
    mockGetSession.mockResolvedValue({
      data: {
        user: { id: "user-1", name: "Alex Rivera", email: "alex@sodales.app" },
        session: { id: "session-1", userId: "user-1" },
      },
      error: null,
    });
    mockSelect.mockResolvedValue([{ role: "instructor" }]);

    const session = await getSession();
    expect(session).toEqual({
      userId: "user-1",
      name: "Alex Rivera",
      email: "alex@sodales.app",
      initials: "AR",
      role: "instructor",
    });
    // An established user's request never touches the invite-cookie block at all.
    expect(mockCookieDelete).not.toHaveBeenCalled();
  });

});

describe("getSession — first sign-in provisioning", () => {
  it("provisions a learner profile when a valid invite token cookie is present", async () => {
    mockGetSession.mockResolvedValue({
      data: { user: { id: "user-2", name: "New Person", email: "new@sodales.app" } },
    });
    mockSelect.mockResolvedValue([]); // no existing profile
    mockCookieGet.mockReturnValue({ value: "valid-token" });

    const session = await getSession();

    expect(session).toEqual({
      userId: "user-2",
      name: "New Person",
      email: "new@sodales.app",
      initials: "NP",
      role: "learner",
    });
    expect(mockInsert).toHaveBeenCalled();
    expect(mockCookieDelete).toHaveBeenCalledWith("sodales-invite-token");
  });

  it("still returns the provisioned session when cookie deletion throws (render-phase call)", async () => {
    // `cookies()` is a read-only sealed proxy during render (Server Components can't mutate
    // cookies outside a Server Action/Route Handler) — `.delete()` throws there. Provisioning
    // must not fail just because the best-effort cookie cleanup couldn't run.
    mockGetSession.mockResolvedValue({
      data: { user: { id: "user-5", name: "Render Phase", email: "render@sodales.app" } },
    });
    mockSelect.mockResolvedValue([]);
    mockCookieGet.mockReturnValue({ value: "valid-token" });
    mockCookieDelete.mockImplementation(() => {
      throw new Error("Cookies can only be modified in a Server Action or Route Handler.");
    });

    const session = await getSession();

    expect(session).toEqual({
      userId: "user-5",
      name: "Render Phase",
      email: "render@sodales.app",
      initials: "RP",
      role: "learner",
    });
    expect(mockInsert).toHaveBeenCalled();
  });

  it("returns null — no app access — when there's no valid invite token", async () => {
    mockGetSession.mockResolvedValue({
      data: { user: { id: "user-3", name: "Nobody", email: "nobody@sodales.app" } },
    });
    mockSelect.mockResolvedValue([]);
    mockCookieGet.mockReturnValue(undefined); // no invite cookie at all

    expect(await getSession()).toBeNull();
    expect(mockInsert).not.toHaveBeenCalled();
  });

  it("returns null — no app access — when the invite cookie holds a forged or expired token", async () => {
    mockGetSession.mockResolvedValue({
      data: { user: { id: "user-4", name: "Forger", email: "forger@sodales.app" } },
    });
    mockSelect.mockResolvedValue([]);
    mockCookieGet.mockReturnValue({ value: "forged-or-expired-token" });

    expect(await getSession()).toBeNull();
    expect(mockInsert).not.toHaveBeenCalled();
  });
});

describe("requireUser", () => {
  it("redirects to /login when there is no session", async () => {
    mockGetSession.mockResolvedValue({ data: { session: null, user: null }, error: null });
    await expect(requireUser()).rejects.toThrow("NEXT_REDIRECT");
    expect(redirectMock).toHaveBeenCalledWith("/login");
  });
});

describe("requireRole", () => {
  it("redirects when the role is insufficient", async () => {
    mockGetSession.mockResolvedValue({
      data: {
        user: { id: "user-1", name: "Alex", email: "alex@sodales.app" },
        session: { id: "session-1", userId: "user-1" },
      },
      error: null,
    });
    mockSelect.mockResolvedValue([{ role: "learner" }]);

    await expect(requireRole("admin")).rejects.toThrow("NEXT_REDIRECT");
    expect(redirectMock).toHaveBeenCalledWith("/");
  });
});

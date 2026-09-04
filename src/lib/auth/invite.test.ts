import { describe, it, expect, vi } from "vitest";

vi.stubEnv("INVITE_CODE_SECRET", "test-secret-at-least-32-characters-long");

const { signInviteToken, verifyInviteToken } = await import("./invite");

describe("invite token", () => {
  it("round-trips a valid token", () => {
    const token = signInviteToken("code-id-123");
    expect(verifyInviteToken(token)).toEqual({ inviteCodeId: "code-id-123" });
  });

  it("rejects a tampered token", () => {
    const token = signInviteToken("code-id-123");
    const tampered = token.slice(0, -1) + (token.at(-1) === "a" ? "b" : "a");
    expect(verifyInviteToken(tampered)).toBeNull();
  });

  it("rejects an expired token", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
    const token = signInviteToken("code-id-123");

    vi.setSystemTime(new Date("2026-01-01T00:31:00Z")); // 31 minutes later
    expect(verifyInviteToken(token)).toBeNull();
    vi.useRealTimers();
  });

  it("rejects garbage input", () => {
    expect(verifyInviteToken("not-a-real-token")).toBeNull();
  });
});

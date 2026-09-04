import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

export const INVITE_TOKEN_COOKIE = "sodales-invite-token";
const TOKEN_TTL_MS = 30 * 60 * 1000; // 30 minutes — long enough to complete the Google redirect

function getSecret(): string {
  const secret = process.env.INVITE_CODE_SECRET;
  if (!secret) throw new Error("INVITE_CODE_SECRET is not set.");
  return secret;
}

function sign(payload: string): string {
  return createHmac("sha256", getSecret()).update(payload).digest("base64url");
}

export function signInviteToken(inviteCodeId: string): string {
  const issuedAt = Date.now().toString();
  const payload = `${inviteCodeId}.${issuedAt}`;
  return `${payload}.${sign(payload)}`;
}

export function verifyInviteToken(token: string): { inviteCodeId: string } | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;

  const [inviteCodeId, issuedAt, signature] = parts;
  const payload = `${inviteCodeId}.${issuedAt}`;
  const expected = sign(payload);

  const expectedBuf = Buffer.from(expected);
  const actualBuf = Buffer.from(signature);
  if (expectedBuf.length !== actualBuf.length || !timingSafeEqual(expectedBuf, actualBuf)) {
    return null;
  }

  const age = Date.now() - Number(issuedAt);
  if (!Number.isFinite(age) || age < 0 || age > TOKEN_TTL_MS) return null;

  return { inviteCodeId };
}

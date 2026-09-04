"use server";

import { cookies } from "next/headers";
import { createHash } from "node:crypto";
import { eq, isNull, and } from "drizzle-orm";
import { db } from "@/db";
import { inviteCode } from "@/db/schema";
import { signInviteToken, INVITE_TOKEN_COOKIE } from "@/lib/auth/invite";

function hashCode(code: string): string {
  return createHash("sha256").update(code.trim().toLowerCase()).digest("hex");
}

export async function verifyInviteCode(
  code: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  if (code.trim() === "") {
    return { ok: false, message: "Enter your invite code." };
  }

  const [match] = await db
    .select({ id: inviteCode.id })
    .from(inviteCode)
    .where(and(eq(inviteCode.codeHash, hashCode(code)), isNull(inviteCode.revokedAt)))
    .limit(1);

  if (!match) {
    return { ok: false, message: "That invite code isn't valid." };
  }

  const store = await cookies();
  store.set(INVITE_TOKEN_COOKIE, signInviteToken(match.id), {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 30 * 60,
  });

  return { ok: true };
}

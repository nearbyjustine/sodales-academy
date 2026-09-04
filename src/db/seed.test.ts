import { describe, it, expect } from "vitest";
import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { userProfile } from "@/db/schema";
import { runSeed } from "./seed";

// `runSeed` used to also migrate Phase 1's Markdown course fixtures into Postgres — that
// migration ran for real once (Task 17, Step 1) and was deleted from `seed.ts` in the same task,
// since its only caller (`content/`) stopped existing. What's left to test here is just the
// admin-promotion half. `ADMIN_EMAIL`'s `user_profile` row is real, permanent seeded data (not
// test fixture data), so these tests don't clean it up in `afterAll` — they only assert on its
// steady state.

async function findAdminUserId(): Promise<string> {
  const adminEmail = process.env.ADMIN_EMAIL;
  if (!adminEmail) throw new Error("ADMIN_EMAIL must be set for this test.");

  const result = await db.execute<{ id: string }>(
    sql`select id from neon_auth."user" where email = ${adminEmail} limit 1`,
  );
  const authUser = result.rows[0];
  if (!authUser) throw new Error("ADMIN_EMAIL has no matching Neon Auth user — sign up first.");
  return authUser.id;
}

describe("runSeed", () => {
  it("promotes ADMIN_EMAIL's user_profile to admin", async () => {
    await runSeed();

    const adminUserId = await findAdminUserId();
    const [profile] = await db
      .select({ role: userProfile.role })
      .from(userProfile)
      .where(eq(userProfile.userId, adminUserId));

    expect(profile.role).toBe("admin");
  });

  it("is idempotent — re-running does not error and role stays admin", async () => {
    await runSeed();
    await runSeed();

    const adminUserId = await findAdminUserId();
    const [profile] = await db
      .select({ role: userProfile.role })
      .from(userProfile)
      .where(eq(userProfile.userId, adminUserId));

    expect(profile.role).toBe("admin");
  });
});

import { pgTable, uuid, text, timestamp } from "drizzle-orm/pg-core";

export const inviteCode = pgTable("invite_code", {
  id: uuid("id").primaryKey().defaultRandom(),
  codeHash: text("code_hash").notNull().unique(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  revokedAt: timestamp("revoked_at"),
});

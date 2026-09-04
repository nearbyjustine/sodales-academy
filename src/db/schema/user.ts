import { pgTable, pgEnum, uuid, text, timestamp } from "drizzle-orm/pg-core";

export const userRole = pgEnum("user_role", ["learner", "instructor", "admin"]);

export const userProfile = pgTable("user_profile", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id").notNull().unique(),
  name: text("name").notNull(),
  role: userRole("role").notNull().default("learner"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

import { pgTable, uuid, text, timestamp, unique } from "drizzle-orm/pg-core";
import { course, lesson } from "./course";

export const enrollment = pgTable(
  "enrollment",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    courseId: uuid("course_id")
      .notNull()
      .references(() => course.id, { onDelete: "cascade" }),
    userId: text("user_id").notNull(),
    enrolledAt: timestamp("enrolled_at").notNull().defaultNow(),
  },
  (table) => [unique().on(table.courseId, table.userId)],
);

export const lessonProgress = pgTable(
  "lesson_progress",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    lessonId: uuid("lesson_id")
      .notNull()
      .references(() => lesson.id, { onDelete: "cascade" }),
    userId: text("user_id").notNull(),
    completedAt: timestamp("completed_at").notNull().defaultNow(),
  },
  (table) => [unique().on(table.lessonId, table.userId)],
);

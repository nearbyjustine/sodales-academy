import { pgTable, uuid, text, timestamp, unique, index } from "drizzle-orm/pg-core";
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
  // `unique(course_id, user_id)` doesn't serve user_id-alone lookups (getEnrollments) since
  // user_id isn't its leading column — needs its own index.
  (table) => [unique().on(table.courseId, table.userId), index().on(table.userId)],
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
  // Same reasoning as enrollment above — getCompletedLessonIds filters by user_id.
  (table) => [unique().on(table.lessonId, table.userId), index().on(table.userId)],
);

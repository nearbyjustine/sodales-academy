import { pgTable, pgEnum, uuid, text, integer, timestamp, unique, index } from "drizzle-orm/pg-core";
import { course } from "./course";

export const trackStatus = pgEnum("track_status", ["draft", "published"]);

export const track = pgTable("track", {
  id: uuid("id").primaryKey().defaultRandom(),
  slug: text("slug").notNull().unique(),
  title: text("title").notNull(),
  /** One line, shown on cards and the hero. */
  promise: text("promise").notNull(),
  /** "You finish able to: ..." — the sell. Author-supplied copy. */
  outcome: text("outcome").notNull(),
  status: trackStatus("status").notNull().default("draft"),
  position: integer("position").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

/**
 * Join table only — it holds no learner data. That is why `track` cascades into
 * it safely: `enrollment` and `lesson_progress` are keyed to COURSES, not
 * tracks, so deleting a track can never destroy anyone's progress. This is the
 * load-bearing reason enrolment fans out to per-course rows instead of being
 * recorded against the track.
 */
export const trackCourse = pgTable(
  "track_course",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    trackId: uuid("track_id")
      .notNull()
      .references(() => track.id, { onDelete: "cascade" }),
    courseId: uuid("course_id")
      .notNull()
      .references(() => course.id, { onDelete: "cascade" }),
    position: integer("position").notNull(),
  },
  // `unique(track_id, course_id)` also serves track_id-alone lookups (track_id is
  // its leading column). The extra index is on (track_id, position) because every
  // read orders by position within a track. Neither composite index serves a
  // course_id-alone lookup, since course_id is not the LEADING column of either
  // one — Postgres can't use a (track_id, ...) index to satisfy a WHERE on
  // course_id alone. `getTracksForCourse` filters on course_id alone and runs on
  // every course/lesson page load, and `course` deletes cascade through this
  // table, so course_id gets its own single-column index (convention established
  // by cb3ed20 on main: index every FK column).
  (table) => [
    unique().on(table.trackId, table.courseId),
    index().on(table.trackId, table.position),
    index().on(table.courseId),
  ],
);

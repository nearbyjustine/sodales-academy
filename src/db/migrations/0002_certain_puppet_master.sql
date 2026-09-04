CREATE TYPE "public"."track_status" AS ENUM('draft', 'published');--> statement-breakpoint
CREATE TABLE "track" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"title" text NOT NULL,
	"promise" text NOT NULL,
	"outcome" text NOT NULL,
	"status" "track_status" DEFAULT 'draft' NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "track_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "track_course" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"track_id" uuid NOT NULL,
	"course_id" uuid NOT NULL,
	"position" integer NOT NULL,
	CONSTRAINT "track_course_track_id_course_id_unique" UNIQUE("track_id","course_id")
);
--> statement-breakpoint
ALTER TABLE "track_course" ADD CONSTRAINT "track_course_track_id_track_id_fk" FOREIGN KEY ("track_id") REFERENCES "public"."track"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "track_course" ADD CONSTRAINT "track_course_course_id_course_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."course"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "track_course_track_id_position_index" ON "track_course" USING btree ("track_id","position");
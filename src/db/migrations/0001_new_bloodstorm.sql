CREATE INDEX "course_module_course_id_index" ON "course_module" USING btree ("course_id");--> statement-breakpoint
CREATE INDEX "lesson_module_id_index" ON "lesson" USING btree ("module_id");--> statement-breakpoint
CREATE INDEX "enrollment_user_id_index" ON "enrollment" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "lesson_progress_user_id_index" ON "lesson_progress" USING btree ("user_id");
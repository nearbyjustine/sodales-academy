import { CourseForm } from "@/components/admin/course-form";
import { requireRole } from "@/lib/session";

export default async function NewCoursePage() {
  await requireRole("instructor", "admin");
  return <CourseForm heading="New course" />;
}

import type { Metadata } from "next";
import { CourseForm } from "@/components/admin/course-form";
import { requireRole } from "@/lib/session";
import { listInstructors } from "@/lib/content/mutations";

export const metadata: Metadata = { title: "New course" };

export default async function NewCoursePage() {
  const session = await requireRole("instructor", "admin");
  const instructors = session.role === "admin" ? await listInstructors() : [];

  return <CourseForm heading="New course" viewerRole={session.role} instructors={instructors} />;
}

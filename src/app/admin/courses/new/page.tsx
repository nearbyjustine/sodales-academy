import type { Metadata } from "next";
import { CourseForm } from "@/components/admin/course-form";
import { requireRole } from "@/lib/session";

export const metadata: Metadata = { title: "New course" };

export default async function NewCoursePage() {
  await requireRole("instructor", "admin");
  return <CourseForm heading="New course" />;
}

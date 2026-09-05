import type { Metadata } from "next";
import { CourseForm } from "@/components/admin/course-form";
import { requireRole } from "@/lib/session";
import { listInstructors } from "@/lib/content/mutations";

export const metadata: Metadata = { title: "New course" };

export default async function NewCoursePage() {
  const session = await requireRole("instructor", "admin");
  const instructors = session.role === "admin" ? await listInstructors() : [];

  return (
    <div className="p-6 lg:p-10">
      <h1 className="text-3xl font-bold tracking-tight">New course</h1>
      <div className="mt-8">
        <CourseForm viewerRole={session.role} instructors={instructors} />
      </div>
    </div>
  );
}

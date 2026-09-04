import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CourseForm } from "@/components/admin/course-form";
import { getCourseBySlugForAdmin } from "@/lib/content/queries";
import { listInstructors } from "@/lib/content/mutations";
import { assertCanManageCourse } from "@/lib/content/authz";
import { requireRole } from "@/lib/session";
import type { CourseInput } from "@/lib/validation";
import type { CourseDetail } from "@/lib/content/types";

type PageProps = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  // Status-agnostic lookup — a draft course (the status every newly created course has) still
  // needs a real `<title>`, not "Course not found". No ownership check here: `generateMetadata`
  // runs without a session the way the page body has one, and a title leaks far less than the
  // page's own content, which is guarded below.
  const course = await getCourseBySlugForAdmin(id);
  return { title: course ? `Edit ${course.title}` : "Course not found" };
}

function toCourseInput(course: CourseDetail): CourseInput {
  return {
    title: course.title,
    slug: course.slug,
    description: course.description,
    category: course.category as CourseInput["category"],
    level: course.level,
    modules: course.modules.map((mod) => ({
      title: mod.title,
      position: mod.position,
      lessons: mod.lessons.map((lesson) => ({
        title: lesson.title,
        slug: lesson.slug,
        position: lesson.position,
        isPreview: lesson.isPreview,
        content: lesson.content,
      })),
    })),
    // `CourseDetail` doesn't carry the instructor's user id (only `instructorName`), and
    // `updateCourse` never persists this field on edits anyway (Task 10) — so any syntactically
    // valid UUID satisfies client-side validation without implying a real instructor was chosen.
    instructorUserId: "00000000-0000-0000-0000-000000000000",
  };
}

export default async function EditCoursePage({ params }: PageProps) {
  const session = await requireRole("instructor", "admin");
  const { id } = await params;

  const course = await getCourseBySlugForAdmin(id);
  if (!course) notFound();

  try {
    await assertCanManageCourse(course.id, session);
  } catch {
    // Not authorized for this specific course — treat identically to not-found so an instructor
    // can't tell a draft they don't own exists.
    notFound();
  }

  const instructors = session.role === "admin" ? await listInstructors() : [];

  return (
    <CourseForm
      heading={`Edit ${course.title}`}
      initial={toCourseInput(course)}
      courseId={course.id}
      viewerRole={session.role}
      instructors={instructors}
    />
  );
}

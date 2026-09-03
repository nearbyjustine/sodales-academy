import { notFound } from "next/navigation";
import { CourseForm } from "@/components/admin/course-form";
import { getCourseBySlug } from "@/lib/content/queries";
import { requireRole } from "@/lib/session";
import type { CourseInput } from "@/lib/validation";
import type { CourseDetail } from "@/lib/content/types";

type PageProps = { params: Promise<{ id: string }> };

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
  };
}

export default async function EditCoursePage({ params }: PageProps) {
  await requireRole("instructor", "admin");
  const { id } = await params;

  const course = await getCourseBySlug(id);
  if (!course) notFound();

  return <CourseForm heading={`Edit ${course.title}`} initial={toCourseInput(course)} />;
}

import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CourseOutline } from "@/components/course/course-outline";
import { EnrollButton } from "@/components/course/enroll-button";
import { getCompletedLessonIds, getCourseBySlug, getCourses, isEnrolled } from "@/lib/content/queries";
import { firstIncompleteLesson } from "@/lib/lesson-progress";
import { getSession } from "@/lib/session";

type PageProps = { params: Promise<{ slug: string }> };

export async function generateStaticParams() {
  const courses = await getCourses();
  return courses.map((course) => ({ slug: course.slug }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const course = await getCourseBySlug(slug);
  if (!course) return { title: "Course not found" };
  return { title: course.title, description: course.description };
}

export default async function CoursePage({ params }: PageProps) {
  const { slug } = await params;
  const course = await getCourseBySlug(slug);
  if (!course) notFound();

  const firstLesson = course.modules[0]?.lessons[0];
  const session = await getSession();

  let cta: ReactNode = null;

  if (!session) {
    cta = (
      <Button className="mt-6" render={<Link href="/login" />}>
        Sign in to enroll
      </Button>
    );
  } else {
    const enrolled = await isEnrolled(course.id, session.userId);

    if (!enrolled) {
      cta = (
        <div className="mt-6">
          <EnrollButton courseSlug={course.slug} />
        </div>
      );
    } else if (firstLesson) {
      const lessonIds = course.modules.flatMap((m) => m.lessons.map((l) => l.id));
      const completed = await getCompletedLessonIds(session.userId, lessonIds);
      const target = firstIncompleteLesson(course.modules, completed) ?? firstLesson;
      const label = completed.size === 0 ? "Start learning" : "Continue learning";

      cta = (
        <Button className="mt-6" render={<Link href={`/learn/${course.slug}/${target.slug}`} />}>
          {label}
        </Button>
      );
    }
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-16">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="outline" className="capitalize">
          {course.level}
        </Badge>
        <span className="label-eyebrow text-graphite">{course.category}</span>
      </div>

      <h1 className="mt-3 text-4xl font-bold tracking-tight">{course.title}</h1>

      <div className="label-eyebrow mt-3 flex flex-wrap gap-4 text-graphite">
        <span>{course.instructorName}</span>
        <span>{course.modules.length} modules</span>
        <span>{course.lessonCount} lessons</span>
      </div>

      <p className="mt-6 max-w-2xl text-lg text-graphite">{course.description}</p>

      {cta}

      <div className="mt-16">
        <CourseOutline modules={course.modules} courseSlug={course.slug} />
      </div>
    </div>
  );
}

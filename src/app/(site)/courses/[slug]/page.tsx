import type { Metadata } from "next";
import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { CourseArtwork } from "@/components/brand/course-artwork";
import { ButtonLink } from "@/components/ui/button-link";
import { CourseOutline } from "@/components/course/course-outline";
import { EnrollButton } from "@/components/course/enroll-button";
import { TrackBreadcrumb } from "@/components/track/track-breadcrumb";
import { getCompletedLessonIds, getCourseBySlug, getTracksForCourse, isEnrolled } from "@/lib/content/queries";
import { firstIncompleteLesson } from "@/lib/lesson-progress";
import { getSession } from "@/lib/session";

type PageProps = { params: Promise<{ slug: string }> };

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
  const tracks = await getTracksForCourse(course.id);

  let cta: ReactNode = null;

  if (!session) {
    cta = (
      <ButtonLink className="mt-6" href="/login">
        Sign in to enroll
      </ButtonLink>
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
        <ButtonLink className="mt-6" href={`/learn/${course.slug}/${target.slug}`}>
          {label}
        </ButtonLink>
      );
    }
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-16">
      <div className="mb-10 h-40 overflow-hidden rounded-md md:h-56">
        <CourseArtwork
          seed={course.slug}
          lessonCount={course.modules.reduce((n, m) => n + m.lessons.length, 0)}
          ratio="wide"
        />
      </div>

      <p className="label-eyebrow flex flex-wrap gap-3 text-graphite">
        <span>{course.level}</span>
        <span>{course.category}</span>
      </p>

      <div className="mt-6">
        <TrackBreadcrumb tracks={tracks} />
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

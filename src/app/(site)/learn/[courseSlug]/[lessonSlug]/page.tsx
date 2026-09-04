import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeftIcon, ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LessonBody } from "@/components/lesson/lesson-body";
import { LessonSidebar } from "@/components/lesson/lesson-sidebar";
import { CompleteToggle } from "@/components/lesson/complete-toggle";
import { getCompletedLessonIds, getLesson } from "@/lib/content/queries";
import { requireUser } from "@/lib/session";

export const metadata: Metadata = { robots: { index: false } };

type PageProps = { params: Promise<{ courseSlug: string; lessonSlug: string }> };

export default async function LessonPage({ params }: PageProps) {
  const { courseSlug, lessonSlug } = await params;
  const session = await requireUser();

  const lesson = await getLesson(courseSlug, lessonSlug, session);
  if (!lesson) notFound();

  const lessonIds = lesson.modules.flatMap((m) => m.lessons.map((l) => l.id));
  const completed = await getCompletedLessonIds(session.userId, lessonIds);
  const totalLessons = lessonIds.length;

  return (
    <div>
      <div className="sticky top-16 z-10 border-b border-border bg-ivory/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4">
          <Link
            href={`/courses/${courseSlug}`}
            className="label-eyebrow flex items-center gap-2 text-graphite hover:text-violet"
          >
            <ArrowLeftIcon aria-hidden="true" className="size-4" />
            {lesson.course.title}
          </Link>
          <span className="label-eyebrow text-graphite">
            Lesson {lesson.position} of {totalLessons}
          </span>
        </div>
      </div>

      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-10 lg:grid-cols-[280px_1fr]">
        <LessonSidebar
          modules={lesson.modules}
          courseSlug={courseSlug}
          currentLessonSlug={lessonSlug}
          completedLessonIds={[...completed]}
        />

        <div className="max-w-3xl">
          <h1 className="text-3xl font-bold tracking-tight">{lesson.title}</h1>

          <div className="mt-6">
            <LessonBody content={lesson.content} />
          </div>

          <div className="mt-6">
            <CompleteToggle lessonId={lesson.id} initialComplete={completed.has(lesson.id)} />
          </div>

          <div className="mt-10 flex items-center justify-between gap-4 border-t border-border pt-6">
            {lesson.prev ? (
              <Button
                variant="outline"
                render={<Link href={`/learn/${lesson.prev.courseSlug}/${lesson.prev.slug}`} />}
              >
                <ChevronLeftIcon /> {lesson.prev.title}
              </Button>
            ) : (
              <Button variant="outline" disabled>
                <ChevronLeftIcon /> Previous
              </Button>
            )}

            {lesson.next ? (
              <Button render={<Link href={`/learn/${lesson.next.courseSlug}/${lesson.next.slug}`} />}>
                {lesson.next.title} <ChevronRightIcon />
              </Button>
            ) : (
              <Button disabled>
                Next <ChevronRightIcon />
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

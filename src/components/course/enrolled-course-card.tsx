import { CourseArtwork } from "@/components/brand/course-artwork";
import { ButtonLink } from "@/components/ui/button-link";
import { Progress } from "@/components/ui/progress";
import { courseProgress, firstIncompleteLesson } from "@/lib/lesson-progress";
import type { CourseDetail } from "@/lib/content/types";

export function EnrolledCourseCard({
  course,
  completedLessonIds,
}: {
  course: CourseDetail;
  completedLessonIds: string[];
}) {
  const completed = new Set(completedLessonIds);
  const lessons = course.modules.flatMap((m) => m.lessons);
  const doneCount = lessons.filter((l) => completed.has(l.id)).length;
  const progress = courseProgress(lessons.length, doneCount);
  const targetLesson = firstIncompleteLesson(course.modules, completed);

  return (
    <div className="flex flex-col overflow-hidden rounded-md border border-border">
      <div className="h-24">
        <CourseArtwork seed={course.slug} lessonCount={progress.totalLessons} ratio="wide" />
      </div>

      <div className="flex flex-1 flex-col gap-4 p-6">
        <div>
          <span className="label-eyebrow text-graphite">{course.category}</span>
          <h3 className="mt-1 text-xl font-bold">{course.title}</h3>
        </div>

        <Progress value={progress.percent} />

        <div className="mt-auto flex items-center justify-between gap-4">
          <span className="label-eyebrow text-graphite">
            {progress.completedLessons} of {progress.totalLessons} lessons
          </span>
          {targetLesson ? (
            <ButtonLink size="sm" href={`/learn/${course.slug}/${targetLesson.slug}`}>
              {progress.isComplete ? "Review" : "Continue"}
            </ButtonLink>
          ) : null}
        </div>
      </div>
    </div>
  );
}

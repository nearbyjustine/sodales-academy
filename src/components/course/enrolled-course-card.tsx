import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Progress, ProgressTrack, ProgressIndicator } from "@/components/ui/progress";
import { firstIncompleteLesson } from "@/lib/lesson-progress";
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
  const total = lessons.length;
  const percent = total === 0 ? 0 : Math.round((doneCount / total) * 100);

  const isFinished = total > 0 && doneCount === total;
  const targetLesson = firstIncompleteLesson(course.modules, completed);

  return (
    <div className="flex flex-col gap-4 rounded-md border border-border p-6">
      <div>
        <span className="label-eyebrow text-graphite">{course.category}</span>
        <h3 className="mt-1 text-xl font-bold">{course.title}</h3>
      </div>

      <Progress value={percent}>
        <ProgressTrack>
          <ProgressIndicator />
        </ProgressTrack>
      </Progress>

      <div className="flex items-center justify-between gap-4">
        <span className="label-eyebrow text-graphite">
          {doneCount} of {total} lessons
        </span>
        {targetLesson ? (
          <Button
            size="sm"
            render={<Link href={`/learn/${course.slug}/${targetLesson.slug}`} />}
          >
            {isFinished ? "Review" : "Continue"}
          </Button>
        ) : null}
      </div>
    </div>
  );
}

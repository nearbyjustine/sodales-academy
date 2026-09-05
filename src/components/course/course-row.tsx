import Link from "next/link";
import { CourseArtwork } from "@/components/brand/course-artwork";
import type { CourseSummary } from "@/lib/content/types";

export function CourseRow({ course }: { course: CourseSummary }) {
  return (
    <Link
      href={`/courses/${course.slug}`}
      className="group/row flex flex-col gap-4 overflow-hidden rounded-md border border-border outline-none transition-colors hover:border-violet focus-visible:ring-2 focus-visible:ring-violet sm:flex-row sm:items-stretch sm:gap-5"
    >
      <div className="h-28 w-full shrink-0 sm:h-auto sm:w-36">
        <CourseArtwork seed={course.slug} lessonCount={course.lessonCount} />
      </div>

      <div className="flex flex-col gap-2 p-5 sm:pl-0">
        <p className="label-eyebrow flex flex-wrap gap-3 text-graphite">
          <span>{course.level}</span>
          <span>{course.category}</span>
        </p>
        <h3 className="text-xl font-bold group-hover/row:text-violet">{course.title}</h3>
        <p className="line-clamp-2 max-w-2xl text-graphite">{course.description}</p>
        <div className="label-eyebrow flex gap-4 text-graphite">
          <span>{course.lessonCount} lessons</span>
          <span>{course.instructorName}</span>
        </div>
      </div>
    </Link>
  );
}

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import type { CourseSummary } from "@/lib/content/types";

export function CourseRow({ course }: { course: CourseSummary }) {
  return (
    <Link
      href={`/courses/${course.slug}`}
      className="group/row flex flex-col gap-2 rounded-md border border-border p-5 outline-none transition-colors hover:border-violet focus-visible:ring-2 focus-visible:ring-violet"
    >
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="outline" className="capitalize">
          {course.level}
        </Badge>
        <span className="label-eyebrow text-graphite">{course.category}</span>
      </div>
      <h3 className="text-xl font-bold group-hover/row:text-violet">{course.title}</h3>
      <p className="line-clamp-2 max-w-2xl text-graphite">{course.description}</p>
      <div className="label-eyebrow flex gap-4 text-graphite">
        <span>{course.lessonCount} lessons</span>
        <span>{course.instructorName}</span>
      </div>
    </Link>
  );
}

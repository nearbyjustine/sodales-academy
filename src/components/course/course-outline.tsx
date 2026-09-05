import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import type { CourseModule } from "@/lib/content/types";

export function CourseOutline({
  modules,
  courseSlug,
}: {
  modules: CourseModule[];
  courseSlug: string;
}) {
  if (modules.length === 0) {
    return <p className="text-graphite">No modules yet.</p>;
  }

  return (
    <div className="flex flex-col gap-10">
      {modules.map((module, index) => (
        <div key={module.id}>
          <div className="flex items-baseline gap-3">
            <span className="label-eyebrow text-violet">
              {String(index + 1).padStart(2, "0")}
            </span>
            <h2 className="text-xl font-bold">{module.title}</h2>
            <span className="label-eyebrow text-graphite">
              {module.lessons.length} lessons
            </span>
          </div>

          <ul className="mt-4 divide-y divide-border border-t border-border">
            {module.lessons.map((lesson) => (
              <li key={lesson.id}>
                <Link
                  href={`/learn/${courseSlug}/${lesson.slug}`}
                  className="flex items-center gap-4 py-4 outline-none focus-visible:ring-2 focus-visible:ring-violet"
                >
                  <span className="label-eyebrow text-graphite">
                    {String(lesson.position).padStart(2, "0")}
                  </span>
                  <span className="flex-1 font-bold">{lesson.title}</span>
                  {lesson.isPreview ? <Badge variant="outline">Preview</Badge> : null}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

"use client";

import Link from "next/link";
import { CheckIcon, ListIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { useCompletedLessonIds } from "@/lib/progress";
import type { CourseModule } from "@/lib/content/types";

type LessonSidebarProps = {
  modules: CourseModule[];
  courseSlug: string;
  currentLessonSlug: string;
};

export function LessonSidebar({ modules, courseSlug, currentLessonSlug }: LessonSidebarProps) {
  const completed = useCompletedLessonIds();
  const lessonIds = modules.flatMap((m) => m.lessons.map((l) => l.id));
  const progress = summarizeProgress(completed, lessonIds);

  return (
    <>
      <aside className="hidden lg:sticky lg:top-20 lg:block lg:self-start">
        <SidebarContent
          modules={modules}
          courseSlug={courseSlug}
          currentLessonSlug={currentLessonSlug}
          completed={completed}
          progress={progress}
        />
      </aside>

      <div className="lg:hidden">
        <Sheet>
          <SheetTrigger
            render={<Button variant="outline" size="sm" aria-label="Open course outline" />}
          >
            <ListIcon /> Course outline
          </SheetTrigger>
          <SheetContent side="left">
            <SheetHeader>
              <SheetTitle>Course outline</SheetTitle>
            </SheetHeader>
            <div className="px-4">
              <SidebarContent
                modules={modules}
                courseSlug={courseSlug}
                currentLessonSlug={currentLessonSlug}
                completed={completed}
                progress={progress}
                closeOnNavigate
              />
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </>
  );
}

function summarizeProgress(completed: Set<string>, lessonIds: string[]) {
  const done = lessonIds.filter((id) => completed.has(id)).length;
  const total = lessonIds.length;
  return { completed: done, total, percent: total === 0 ? 0 : Math.round((done / total) * 100) };
}

function SidebarContent({
  modules,
  courseSlug,
  currentLessonSlug,
  completed,
  progress,
  closeOnNavigate,
}: LessonSidebarProps & {
  completed: Set<string>;
  progress: { completed: number; total: number; percent: number };
  closeOnNavigate?: boolean;
}) {
  return (
    <div className="w-full lg:w-64">
      <Progress value={progress.percent} className="mb-6 flex-col items-start gap-1.5">
        <span className="label-eyebrow text-graphite">
          {progress.completed}/{progress.total} complete
        </span>
      </Progress>

      <nav aria-label="Course outline" className="flex flex-col gap-6">
        {modules.map((module) => (
          <div key={module.id}>
            <p className="label-eyebrow text-graphite">{module.title}</p>
            <ul className="mt-2 flex flex-col gap-1">
              {module.lessons.map((lesson) => {
                const isCurrent = lesson.slug === currentLessonSlug;
                const isComplete = completed.has(lesson.id);
                const linkClassName = cn(
                  "flex items-center gap-2 border-l-2 py-1.5 pl-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-violet",
                  isCurrent
                    ? "border-violet font-bold text-violet"
                    : "border-transparent text-graphite hover:text-violet",
                );
                const linkChildren = (
                  <>
                    {isComplete ? (
                      <CheckIcon aria-hidden="true" className="size-3.5 shrink-0 text-violet" />
                    ) : null}
                    <span>{lesson.title}</span>
                  </>
                );

                return (
                  <li key={lesson.id}>
                    {closeOnNavigate ? (
                      <SheetClose
                        render={
                          <Link
                            href={`/learn/${courseSlug}/${lesson.slug}`}
                            aria-current={isCurrent ? "page" : undefined}
                            className={linkClassName}
                          />
                        }
                      >
                        {linkChildren}
                      </SheetClose>
                    ) : (
                      <Link
                        href={`/learn/${courseSlug}/${lesson.slug}`}
                        aria-current={isCurrent ? "page" : undefined}
                        className={linkClassName}
                      >
                        {linkChildren}
                      </Link>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>
    </div>
  );
}

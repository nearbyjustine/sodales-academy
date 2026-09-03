"use client";

import { useCompletedLessonIds } from "@/lib/progress";
import type { CourseDetail } from "@/lib/content/types";

export function DashboardStats({ courses }: { courses: CourseDetail[] }) {
  const completed = useCompletedLessonIds();

  let lessonsCompleted = 0;
  let coursesFinished = 0;

  for (const course of courses) {
    const lessons = course.modules.flatMap((m) => m.lessons);
    const doneCount = lessons.filter((l) => completed.has(l.id)).length;
    lessonsCompleted += doneCount;
    if (lessons.length > 0 && doneCount === lessons.length) coursesFinished += 1;
  }

  const stats = [
    { label: "Courses enrolled", value: courses.length },
    { label: "Lessons completed", value: lessonsCompleted },
    { label: "Courses finished", value: coursesFinished },
  ];

  return (
    <div className="grid grid-cols-3 divide-x divide-border border-y border-border">
      {stats.map((stat) => (
        <div key={stat.label} className="flex flex-col gap-1 px-4 py-6 text-center">
          <span className="text-3xl font-bold tracking-tight">{stat.value}</span>
          <span className="label-eyebrow text-graphite">{stat.label}</span>
        </div>
      ))}
    </div>
  );
}

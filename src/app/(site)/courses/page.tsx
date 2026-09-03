import type { Metadata } from "next";
import Link from "next/link";
import { SearchXIcon } from "lucide-react";
import { CatalogFilters } from "@/components/course/catalog-filters";
import { CourseRow } from "@/components/course/course-row";
import { Button } from "@/components/ui/button";
import { getCourses } from "@/lib/content/queries";
import { LEVELS, type Level } from "@/lib/content/types";

export const metadata: Metadata = {
  title: "Courses",
  description: "Browse Sodales Academy's courses in freelancing, branding, and web development.",
};

type PageProps = {
  searchParams: Promise<{ q?: string; level?: string }>;
};

export default async function CoursesPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const level = LEVELS.includes(params.level as Level) ? (params.level as Level) : undefined;
  const courses = await getCourses({ q: params.q, level });

  return (
    <div className="mx-auto max-w-6xl px-4 py-16">
      <h1 className="text-4xl font-bold tracking-tight">Courses</h1>

      <div className="mt-8">
        <CatalogFilters />
      </div>

      <p aria-live="polite" className="label-eyebrow mt-6 text-graphite">
        {courses.length} {courses.length === 1 ? "course" : "courses"}
      </p>

      {courses.length === 0 ? (
        <div className="flex flex-col items-center gap-4 py-24 text-center">
          <SearchXIcon aria-hidden="true" className="size-10 text-graphite" />
          <h2 className="text-xl font-bold">No courses match</h2>
          <p className="max-w-sm text-graphite">
            Try a different search term or clear your filters to see the full catalog.
          </p>
          <Button variant="outline" render={<Link href="/courses" />}>
            Clear filters
          </Button>
        </div>
      ) : (
        <div className="mt-6 flex flex-col gap-4">
          {courses.map((course) => (
            <CourseRow key={course.slug} course={course} />
          ))}
        </div>
      )}
    </div>
  );
}

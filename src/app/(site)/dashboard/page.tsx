import type { Metadata } from "next";
import Link from "next/link";
import { BookOpenIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DashboardStats } from "@/components/course/dashboard-stats";
import { EnrolledCourseCard } from "@/components/course/enrolled-course-card";
import { getCourseBySlug } from "@/lib/content/queries";
import { getEnrollments, requireUser } from "@/lib/session";

export const metadata: Metadata = { title: "Dashboard", robots: { index: false } };

export default async function DashboardPage() {
  const session = await requireUser();
  const enrollments = await getEnrollments();
  const courses = (
    await Promise.all(enrollments.map((e) => getCourseBySlug(e.courseSlug)))
  ).filter((c) => c !== null);

  return (
    <div className="mx-auto max-w-6xl px-4 py-16">
      <h1 className="text-4xl font-bold tracking-tight">Your learning</h1>
      <p className="mt-2 text-lg text-graphite">Welcome back, {session.name}.</p>

      {courses.length === 0 ? (
        <div className="flex flex-col items-center gap-4 py-24 text-center">
          <BookOpenIcon aria-hidden="true" className="size-10 text-graphite" />
          <h2 className="text-xl font-bold">You haven&apos;t enrolled in anything yet</h2>
          <Button render={<Link href="/courses" />}>Browse courses</Button>
        </div>
      ) : (
        <>
          <div className="mt-10">
            <DashboardStats courses={courses} />
          </div>

          <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {courses.map((course) => (
              <EnrolledCourseCard key={course.slug} course={course} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

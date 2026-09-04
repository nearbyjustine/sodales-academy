import type { Metadata } from "next";
import { BookOpenIcon } from "lucide-react";
import { ButtonLink } from "@/components/ui/button-link";
import { DashboardStats } from "@/components/course/dashboard-stats";
import { EnrolledCourseCard } from "@/components/course/enrolled-course-card";
import { TrackProgressCard } from "@/components/track/track-progress-card";
import { getCompletedLessonIds, getCourseBySlug, getTrackBySlug, getTracks } from "@/lib/content/queries";
import { getEnrollments, requireUser } from "@/lib/session";

export const metadata: Metadata = { title: "Dashboard", robots: { index: false } };

export default async function DashboardPage() {
  const session = await requireUser();
  const enrollments = await getEnrollments();
  const courses = (
    await Promise.all(enrollments.map((e) => getCourseBySlug(e.courseSlug)))
  ).filter((c) => c !== null);

  // A track shows here only when the learner is enrolled in EVERY course in it —
  // which is exactly what enrollInTrack produces. Someone who bought one course
  // that happens to sit in a track has not bought the track, and the dashboard
  // must not imply they have.
  const enrolledSlugs = new Set(enrollments.map((e) => e.courseSlug));
  const trackDetails = (
    await Promise.all((await getTracks()).map((t) => getTrackBySlug(t.slug, session)))
  ).filter((t) => t !== null);
  const myTracks = trackDetails.filter(
    (t) => t.courses.length > 0 && t.courses.every((c) => enrolledSlugs.has(c.slug)),
  );

  const progressByCourse = await Promise.all(
    courses.map(async (c) => {
      const lessonIds = c.modules.flatMap((m) => m.lessons.map((l) => l.id));
      const completed = await getCompletedLessonIds(session.userId, lessonIds);
      return { course: c, completedLessonIds: [...completed] };
    }),
  );

  const lessonsCompleted = progressByCourse.reduce(
    (sum, p) => sum + p.completedLessonIds.length,
    0,
  );
  const coursesFinished = progressByCourse.filter(({ course, completedLessonIds }) => {
    const total = course.modules.flatMap((m) => m.lessons).length;
    return total > 0 && completedLessonIds.length === total;
  }).length;

  return (
    <div className="mx-auto max-w-6xl px-4 py-16">
      <h1 className="text-4xl font-bold tracking-tight">Your learning</h1>
      <p className="mt-2 text-lg text-graphite">Welcome back, {session.name}.</p>

      {courses.length === 0 ? (
        <div className="flex flex-col items-center gap-4 py-24 text-center">
          <BookOpenIcon aria-hidden="true" className="size-10 text-graphite" />
          <h2 className="text-xl font-bold">You haven&apos;t enrolled in anything yet</h2>
          <ButtonLink href="/courses">Browse courses</ButtonLink>
        </div>
      ) : (
        <>
          {myTracks.length > 0 ? (
            <div className="mt-10 grid gap-6 lg:grid-cols-2">
              {myTracks.map((t) => (
                <TrackProgressCard key={t.slug} track={t} />
              ))}
            </div>
          ) : null}

          <div className="mt-10">
            <DashboardStats
              coursesEnrolled={courses.length}
              lessonsCompleted={lessonsCompleted}
              coursesFinished={coursesFinished}
            />
          </div>

          <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {progressByCourse.map(({ course, completedLessonIds }) => (
              <EnrolledCourseCard
                key={course.slug}
                course={course}
                completedLessonIds={completedLessonIds}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

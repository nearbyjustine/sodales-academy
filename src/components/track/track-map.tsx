import Link from "next/link";
import { CourseArtwork } from "@/components/brand/course-artwork";
import { ButtonLink } from "@/components/ui/button-link";
import { Badge } from "@/components/ui/badge";
import { Progress, ProgressTrack, ProgressIndicator } from "@/components/ui/progress";
import { EnrollTrackButton } from "@/components/track/enroll-track-button";
import { trackProgress } from "@/lib/track-progress";
import type { TrackDetail } from "@/lib/content/types";

/**
 * The journey map, in two states.
 *
 * Unenrolled it is the pitch: the whole climb is visible, every course legible,
 * the outcome prominent. It deliberately shows NO progress — a visitor who has
 * done nothing must never see a progress figure implying otherwise.
 *
 * Enrolled it is the map: real completion from `lesson_progress`, and exactly
 * one unambiguous next action.
 */
export function TrackMap({ track, enrolled }: { track: TrackDetail; enrolled: boolean }) {
  const progress = trackProgress(track.courses);
  const ordered = [...track.courses].sort((a, b) => a.position - b.position);

  return (
    <div className="flex flex-col gap-10">
      <header className="flex flex-col gap-4">
        <p className="label-eyebrow text-violet">Track</p>
        <h1 className="text-4xl font-bold tracking-tight md:text-5xl">{track.title}</h1>
        <p className="max-w-xl text-lg text-graphite">{track.promise}</p>

        <div className="label-eyebrow flex flex-wrap gap-4 text-graphite">
          <span>{track.courseCount} courses</span>
          <span>{track.lessonCount} lessons</span>
        </div>

        {enrolled ? (
          <div className="max-w-md space-y-2">
            <Progress value={progress.percent}>
              <ProgressTrack>
                <ProgressIndicator />
              </ProgressTrack>
            </Progress>
            <p className="label-eyebrow text-graphite">
              {progress.completedLessons} of {progress.totalLessons} lessons
            </p>
          </div>
        ) : (
          <div className="pt-2">
            <EnrollTrackButton trackSlug={track.slug} />
          </div>
        )}
      </header>

      <ol className="flex flex-col gap-4">
        {ordered.map((c, index) => {
          const isNext = enrolled && progress.nextCourse?.slug === c.slug;
          const isDone = c.lessonCount > 0 && c.completedLessonCount >= c.lessonCount;

          return (
            <li key={c.slug}>
              <Link
                href={`/courses/${c.slug}`}
                className="group/stage flex flex-col gap-4 overflow-hidden rounded-md border border-border outline-none transition-colors hover:border-violet focus-visible:ring-2 focus-visible:ring-violet sm:flex-row sm:items-stretch sm:gap-5"
              >
                <div className="h-24 w-full shrink-0 sm:h-auto sm:w-32">
                  <CourseArtwork seed={c.slug} lessonCount={c.lessonCount} />
                </div>

                <div className="flex flex-1 flex-col gap-2 p-5 sm:pl-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="label-eyebrow text-graphite">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <Badge variant="outline" className="capitalize">
                      {c.level}
                    </Badge>
                    {enrolled && isDone ? <Badge variant="secondary">Done</Badge> : null}
                  </div>

                  <h2 className="text-xl font-bold group-hover/stage:text-violet">{c.title}</h2>
                  <p className="line-clamp-2 max-w-2xl text-graphite">{c.description}</p>

                  <p className="label-eyebrow text-graphite">
                    {enrolled
                      ? `${Math.min(c.completedLessonCount, c.lessonCount)} of ${c.lessonCount} lessons`
                      : `${c.lessonCount} lessons`}
                  </p>
                </div>

                {/* "Next", not "Continue here": the footer CTA below is the one
                    control named /continue/, so the accessible name of this row
                    link must not collide with it. */}
                {isNext ? (
                  <div className="flex items-center p-5 sm:pl-0">
                    <span className="label-eyebrow shrink-0 text-violet">Next</span>
                  </div>
                ) : null}
              </Link>
            </li>
          );
        })}
      </ol>

      <footer className="rounded-md border border-border bg-deep-ink p-8 text-ivory">
        <p className="label-eyebrow text-violet-accessible">What you walk away with</p>
        <p className="mt-3 max-w-2xl text-2xl leading-tight font-bold tracking-tight">
          {track.outcome}
        </p>
      </footer>

      {enrolled && progress.nextCourse ? (
        <div>
          <ButtonLink href={`/courses/${progress.nextCourse.slug}`}>
            Continue: {progress.nextCourse.title}
          </ButtonLink>
        </div>
      ) : null}
    </div>
  );
}

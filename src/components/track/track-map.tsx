import Link from "next/link";
import { CheckIcon } from "lucide-react";
import { CourseArtwork } from "@/components/brand/course-artwork";
import { ButtonLink } from "@/components/ui/button-link";
import { EnrollTrackButton } from "@/components/track/enroll-track-button";
import { isComplete, trackProgress } from "@/lib/track-progress";
import { cn } from "@/lib/utils";
import type { TrackCourse, TrackDetail } from "@/lib/content/types";

/**
 * The journey map, in two states.
 *
 * Unenrolled it is the pitch: the whole climb is visible, every course legible,
 * the outcome prominent. It deliberately shows NO progress — a visitor who has
 * done nothing must never see a progress figure implying otherwise.
 *
 * Enrolled it is the map: real completion from `lesson_progress`, and exactly
 * one unambiguous next action.
 *
 * The structure is a spine, not a card stack. A track's whole product claim is
 * that the ORDER matters, and three same-size cards say nothing about order —
 * the sequence was carried only by a 10px grey numeral. Here the rail is the
 * sequence: it connects the stages, it fills as far as the learner has climbed,
 * and it terminates in the outcome, so the destination is something you arrive
 * at rather than a band tacked on below the fold.
 */
export function TrackMap({ track, enrolled }: { track: TrackDetail; enrolled: boolean }) {
  const progress = trackProgress(track.courses);
  const ordered = [...track.courses].sort((a, b) => a.position - b.position);
  const finished = enrolled && progress.totalLessons > 0 && progress.percent === 100;

  return (
    <div className="flex flex-col">
      <TrackHeader
        track={track}
        enrolled={enrolled}
        completedLessons={progress.completedLessons}
        totalLessons={progress.totalLessons}
        completedCourses={progress.completedCourses}
        percent={progress.percent}
      />

      <ol className="mt-16">
        {ordered.map((course, index) => (
          <Stage
            key={course.slug}
            course={course}
            index={index}
            enrolled={enrolled}
            isNext={enrolled && progress.nextCourse?.slug === course.slug}
            // The rail segment above a stage is "climbed" only once the stage
            // before it is genuinely finished.
            climbed={enrolled && index > 0 && isComplete(ordered[index - 1])}
          />
        ))}

        <Arrival outcome={track.outcome} reached={finished} />
      </ol>

      {enrolled && progress.nextCourse ? (
        <div className="mt-12">
          <ButtonLink size="lg" href={`/courses/${progress.nextCourse.slug}`}>
            Continue: {progress.nextCourse.title}
          </ButtonLink>
        </div>
      ) : null}
    </div>
  );
}

function TrackHeader({
  track,
  enrolled,
  completedLessons,
  totalLessons,
  completedCourses,
  percent,
}: {
  track: TrackDetail;
  enrolled: boolean;
  completedLessons: number;
  totalLessons: number;
  completedCourses: number;
  percent: number;
}) {
  return (
    <header className="relative isolate overflow-hidden rounded-md border border-border">
      <div className="absolute inset-0 -z-10">
        <CourseArtwork seed={track.slug} lessonCount={track.lessonCount} ratio="wide" />
      </div>
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-10 bg-linear-to-t from-obsidian/95 via-obsidian/70 to-obsidian/40"
      />

      <div className="flex flex-col gap-6 p-8 text-ivory md:p-14">
        <h1 className="max-w-4xl text-5xl leading-[0.95] font-bold tracking-tight md:text-7xl">
          {track.title}
        </h1>
        <p className="max-w-xl text-lg text-ivory/80 md:text-xl">{track.promise}</p>

        {enrolled ? (
          <div className="max-w-md">
            {/* The rail is the primary progress signal; this is the number
                behind it. Both come from lesson_progress. */}
            <div className="flex items-baseline justify-between gap-4">
              <span className="text-4xl font-bold tracking-tight tabular-nums">{percent}%</span>
              <span className="label-eyebrow text-ivory/60">
                {completedCourses} of {track.courseCount} stages
              </span>
            </div>
            <div className="mt-3 h-1 w-full overflow-hidden rounded-full bg-ivory/20">
              <div
                className="h-full rounded-full bg-violet-accessible transition-[width] duration-500"
                style={{ width: `${percent}%` }}
              />
            </div>
            <p className="label-eyebrow mt-3 text-ivory/60">
              {completedLessons} of {totalLessons} lessons
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-5">
            <p className="label-eyebrow flex flex-wrap gap-4 text-ivory/60">
              <span>
                {track.courseCount} {track.courseCount === 1 ? "stage" : "stages"}
              </span>
              <span>{track.lessonCount} lessons</span>
            </p>
            <div>
              <EnrollTrackButton trackSlug={track.slug} />
            </div>
          </div>
        )}
      </div>
    </header>
  );
}

/** Fixed rail width so every marker sits on one continuous vertical line. */
const RAIL = "w-12 md:w-16";
/** Half the marker height — where the line meets it. */
const MARKER_CENTER = "1.375rem";

function Rail({
  children,
  isFirst,
  isLast,
  climbed,
}: {
  children: React.ReactNode;
  isFirst?: boolean;
  isLast?: boolean;
  climbed?: boolean;
}) {
  return (
    <div className={cn("relative shrink-0", RAIL)}>
      <span
        aria-hidden="true"
        className={cn(
          "absolute left-1/2 w-px -translate-x-1/2",
          climbed ? "bg-violet" : "bg-border",
        )}
        style={{
          top: isFirst ? MARKER_CENTER : 0,
          bottom: isLast ? `calc(100% - ${MARKER_CENTER})` : 0,
        }}
      />
      <div className="relative z-10 flex justify-center">{children}</div>
    </div>
  );
}

function Stage({
  course,
  index,
  enrolled,
  isNext,
  climbed,
}: {
  course: TrackCourse;
  index: number;
  enrolled: boolean;
  isNext: boolean;
  climbed: boolean;
}) {
  const done = enrolled && isComplete(course);
  const completed = Math.min(course.completedLessonCount, course.lessonCount);

  return (
    <li className="flex gap-4 md:gap-6">
      <Rail isFirst={index === 0} climbed={climbed}>
        <span
          className={cn(
            "flex size-11 items-center justify-center rounded-full border text-sm font-bold tabular-nums transition-colors",
            done
              ? "border-violet bg-violet text-primary-foreground"
              : isNext
                ? "border-violet bg-background text-violet ring-4 ring-violet/15"
                : "border-border bg-background text-graphite",
          )}
        >
          {done ? (
            <CheckIcon aria-hidden="true" className="size-5" />
          ) : (
            String(index + 1).padStart(2, "0")
          )}
        </span>
      </Rail>

      <Link
        href={`/courses/${course.slug}`}
        className="group/stage -mx-4 flex flex-1 flex-col gap-2 rounded-md px-4 pb-14 outline-none transition-colors hover:bg-secondary/40 focus-visible:ring-2 focus-visible:ring-violet md:flex-row md:items-start md:justify-between md:gap-10"
      >
        <div className="max-w-2xl">
          <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
            <h2 className="text-2xl font-bold tracking-tight group-hover/stage:text-violet md:text-3xl">
              {course.title}
            </h2>
            {isNext ? <span className="label-eyebrow text-violet">You are here</span> : null}
          </div>
          <p className="mt-2 text-graphite">{course.description}</p>
        </div>

        {/* Right-aligned on desktop so the counts form a scannable column down
            the page instead of leaving a third of the width empty. No
            `capitalize` here — it would fight `label-eyebrow`'s uppercase and
            render "Beginner" next to "5 LESSONS". */}
        <p className="label-eyebrow flex shrink-0 gap-4 text-graphite md:flex-col md:items-end md:gap-1 md:text-right">
          <span>
            {enrolled
              ? `${completed} of ${course.lessonCount} lessons`
              : `${course.lessonCount} lessons`}
          </span>
          <span className="text-graphite/60">{course.level}</span>
        </p>
      </Link>
    </li>
  );
}

/**
 * The end of the climb. The outcome lives here rather than in a band below the
 * page because arriving at it is the point — the rail leads the eye to it, and
 * it is the last thing on the spine whether or not the learner has enrolled.
 */
function Arrival({ outcome, reached }: { outcome: string; reached: boolean }) {
  return (
    <li className="flex gap-4 md:gap-6">
      <Rail isLast climbed={reached}>
        {/* Dashed until reached: a solid ring would read as another completed
            stage, and a barely-visible one reads as a rendering bug. */}
        <span
          className={cn(
            "flex size-11 items-center justify-center rounded-full border transition-colors",
            reached
              ? "border-violet bg-violet text-primary-foreground"
              : "border-graphite/40 border-dashed bg-background text-graphite",
          )}
        >
          <CheckIcon aria-hidden="true" className="size-5" />
        </span>
      </Rail>

      <div className="flex-1 rounded-md bg-deep-ink p-8 text-ivory md:p-10">
        <p className="max-w-2xl text-2xl leading-tight font-bold tracking-tight md:text-3xl">
          {outcome}
        </p>
      </div>
    </li>
  );
}

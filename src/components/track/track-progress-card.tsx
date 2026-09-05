import { ButtonLink } from "@/components/ui/button-link";
import { Progress } from "@/components/ui/progress";
import { trackProgress } from "@/lib/track-progress";
import type { TrackDetail } from "@/lib/content/types";

export function TrackProgressCard({ track }: { track: TrackDetail }) {
  const progress = trackProgress(track.courses);

  return (
    <div className="flex flex-col gap-4 rounded-md border border-border p-6">
      <div>
        <p className="label-eyebrow text-graphite">Track</p>
        <h3 className="mt-1 text-xl font-bold">{track.title}</h3>
      </div>

      <Progress value={progress.percent} />

      <div className="flex flex-wrap items-center justify-between gap-4">
        <span className="label-eyebrow text-graphite">
          {progress.completedCourses} of {progress.totalCourses} courses ·{" "}
          {progress.completedLessons} of {progress.totalLessons} lessons
        </span>
        <ButtonLink size="sm" variant="outline" href={`/tracks/${track.slug}`}>
          {progress.nextCourse ? "Continue track" : "Review track"}
        </ButtonLink>
      </div>
    </div>
  );
}

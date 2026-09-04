import Link from "next/link";
import { CourseArtwork } from "@/components/brand/course-artwork";
import type { TrackSummary } from "@/lib/content/types";

export function TrackRow({ track }: { track: TrackSummary }) {
  return (
    <Link
      href={`/tracks/${track.slug}`}
      className="group/track flex flex-col overflow-hidden rounded-md border border-border outline-none transition-colors hover:border-violet focus-visible:ring-2 focus-visible:ring-violet"
    >
      <div className="h-32">
        <CourseArtwork seed={track.slug} lessonCount={track.lessonCount} ratio="wide" />
      </div>

      <div className="flex flex-1 flex-col gap-3 p-6">
        <p className="label-eyebrow text-graphite">Track</p>
        <h2 className="text-2xl font-bold tracking-tight group-hover/track:text-violet">
          {track.title}
        </h2>
        <p className="text-graphite">{track.promise}</p>
        <p className="label-eyebrow mt-auto flex gap-4 text-graphite">
          <span>{track.courseCount} courses</span>
          <span>{track.lessonCount} lessons</span>
        </p>
      </div>
    </Link>
  );
}

import Link from "next/link";
import { ArrowRightIcon } from "lucide-react";
import { CourseArtwork } from "@/components/brand/course-artwork";
import type { TrackSummary } from "@/lib/content/types";

/**
 * A track in a list. Deliberately a full-width horizontal row rather than a
 * grid cell: the catalog starts with one track, and a two-column grid holding a
 * single card reads as a page that failed to load. A row is correct at one
 * track and still correct at ten.
 */
export function TrackRow({ track }: { track: TrackSummary }) {
  return (
    <Link
      href={`/tracks/${track.slug}`}
      className="group/track relative isolate flex min-h-56 flex-col justify-end overflow-hidden rounded-md border border-border p-8 outline-none transition-colors hover:border-violet focus-visible:ring-2 focus-visible:ring-violet md:p-10"
    >
      <div className="absolute inset-0 -z-10">
        <CourseArtwork seed={track.slug} lessonCount={track.lessonCount} ratio="wide" />
      </div>
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-10 bg-linear-to-t from-obsidian/95 via-obsidian/70 to-obsidian/30"
      />

      <div className="flex flex-col gap-3 text-ivory md:flex-row md:items-end md:justify-between md:gap-10">
        <div className="max-w-xl">
          <h2 className="text-3xl font-bold tracking-tight md:text-4xl">{track.title}</h2>
          <p className="mt-2 text-ivory/80">{track.promise}</p>
        </div>

        <p className="label-eyebrow flex shrink-0 items-center gap-4 text-ivory/60">
          <span>
            {track.courseCount} {track.courseCount === 1 ? "stage" : "stages"}
          </span>
          <span>{track.lessonCount} lessons</span>
          <ArrowRightIcon
            aria-hidden="true"
            className="size-4 text-violet-accessible transition-transform group-hover/track:translate-x-1"
          />
        </p>
      </div>
    </Link>
  );
}

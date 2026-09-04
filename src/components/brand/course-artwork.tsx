import { courseArtwork } from "@/lib/brand/course-artwork";
import { cn } from "@/lib/utils";

/**
 * Per-course cover art, generated from the course slug. Purely decorative —
 * `aria-hidden`, and every caller still carries the course title as real text.
 *
 * `ratio` crops the same 100x100 field: "square" for list thumbnails, "wide"
 * for banners. Cropping rather than scaling keeps the shear angle identical at
 * every size, which is the whole point of deriving it from the mark.
 */
export function CourseArtwork({
  seed,
  lessonCount,
  ratio = "square",
  className,
}: {
  seed: string;
  lessonCount: number;
  ratio?: "square" | "wide";
  className?: string;
}) {
  const { ground, bands } = courseArtwork(seed, lessonCount);
  const viewBox = ratio === "wide" ? "0 22 100 56" : "0 0 100 100";

  return (
    <svg
      viewBox={viewBox}
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
      focusable="false"
      className={cn("block h-full w-full", className)}
    >
      <rect x="-50" y="-50" width="200" height="200" fill={ground} />
      {bands.map((b, i) => (
        <polygon key={i} points={b.points} fill={b.fill} opacity={b.opacity} />
      ))}
    </svg>
  );
}

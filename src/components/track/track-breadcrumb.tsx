import Link from "next/link";

export function TrackBreadcrumb({
  tracks,
}: {
  tracks: { slug: string; title: string }[];
}) {
  if (tracks.length === 0) return null;

  return (
    <p className="label-eyebrow flex flex-wrap items-center gap-2 text-graphite">
      <span>Part of</span>
      {tracks.map((t) => (
        <Link
          key={t.slug}
          href={`/tracks/${t.slug}`}
          className="text-violet hover:underline focus-visible:ring-2 focus-visible:ring-violet"
        >
          {t.title}
        </Link>
      ))}
    </p>
  );
}

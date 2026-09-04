import type { Metadata } from "next";
import { TrackRow } from "@/components/track/track-row";
import { getTracks } from "@/lib/content/queries";

export const metadata: Metadata = {
  title: "Tracks",
  description: "Ordered paths through Sodales Academy, each ending in a stated capability.",
};

export default async function TracksPage() {
  const tracks = await getTracks();

  return (
    <div className="mx-auto max-w-6xl px-4 py-16">
      <h1 className="text-4xl font-bold tracking-tight">Tracks</h1>
      <p className="mt-4 max-w-xl text-lg text-graphite">
        Each track is an ordered path. Start at the beginning and you finish able to do the
        thing it names.
      </p>

      {tracks.length === 0 ? (
        <p className="mt-12 text-graphite">No tracks are published yet.</p>
      ) : (
        <div className="mt-10 grid gap-6 md:grid-cols-2">
          {tracks.map((track) => (
            <TrackRow key={track.slug} track={track} />
          ))}
        </div>
      )}
    </div>
  );
}

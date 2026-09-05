import type { Metadata } from "next";
import { RouteIcon } from "lucide-react";
import { TrackRow } from "@/components/track/track-row";
import { ButtonLink } from "@/components/ui/button-link";
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
        <div className="flex flex-col items-center gap-4 py-24 text-center">
          <RouteIcon aria-hidden="true" className="size-10 text-graphite" />
          <h2 className="text-xl font-bold">No tracks are published yet</h2>
          <p className="max-w-sm text-graphite">
            Individual courses are still open — browse the catalog to get started.
          </p>
          <ButtonLink href="/courses">Browse courses</ButtonLink>
        </div>
      ) : (
        <div className="mt-10 flex flex-col gap-6">
          {tracks.map((track) => (
            <TrackRow key={track.slug} track={track} />
          ))}
        </div>
      )}
    </div>
  );
}

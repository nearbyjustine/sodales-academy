import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { TrackMap } from "@/components/track/track-map";
import { getFullyEnrolledTrackSlugs, getTrackBySlug } from "@/lib/content/queries";
import { getSession } from "@/lib/session";

type PageProps = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const session = await getSession();
  const track = await getTrackBySlug(slug, session);
  if (!track) return { title: "Track not found" };
  return { title: track.title, description: track.promise };
}

export default async function TrackPage({ params }: PageProps) {
  const { slug } = await params;

  // Both getSession and getTrackBySlug are React-cached, so calling them here
  // and again in generateMetadata is one round-trip's worth of queries per
  // request, not two.
  const session = await getSession();
  const track = await getTrackBySlug(slug, session);
  if (!track) notFound();

  // "Fully enrolled" is defined once, in getFullyEnrolledTrackSlugs — see its
  // doc comment for why it counts every course the track links regardless of
  // status, rather than only the (possibly narrower, post-unpublish) status-
  // filtered list this page renders. Deriving "enrolled" from `track.courses`
  // instead would drift from what enrollInTrack actually wrote: an admin
  // unpublishing one course out of a two-course track a learner bought only
  // half of would then make `track.courses` a single, fully-owned course, and
  // this page would wrongly render the enrolled map/progress bar/Continue CTA.
  const enrolled = session
    ? (await getFullyEnrolledTrackSlugs(session.userId)).includes(track.slug)
    : false;

  return (
    <div className="mx-auto max-w-6xl px-4 py-16">
      <TrackMap track={track} enrolled={enrolled} />
    </div>
  );
}

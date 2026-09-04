import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { TrackMap } from "@/components/track/track-map";
import { getTrackBySlug } from "@/lib/content/queries";
import { getEnrollments, getSession } from "@/lib/session";

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

  // "Enrolled in the track" means enrolled in every course it contains — which
  // is exactly what enrollInTrack produces. A partial enrolment (someone who
  // bought one course earlier) reads as not-enrolled and is offered the track,
  // which is the honest answer: they do not have all of it.
  const enrolledSlugs = new Set(
    session ? (await getEnrollments()).map((e) => e.courseSlug) : [],
  );
  const enrolled =
    track.courses.length > 0 && track.courses.every((c) => enrolledSlugs.has(c.slug));

  return (
    <div className="mx-auto max-w-6xl px-4 py-16">
      <TrackMap track={track} enrolled={enrolled} />
    </div>
  );
}

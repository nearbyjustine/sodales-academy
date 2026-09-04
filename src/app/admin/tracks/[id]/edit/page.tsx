import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { TrackForm } from "@/components/admin/track-form";
import { getAllCourses, getTrackBySlug, getTracksForAdmin } from "@/lib/content/queries";
import { requireRole } from "@/lib/session";

export const metadata: Metadata = { title: "Edit track" };

type PageProps = { params: Promise<{ id: string }> };

export default async function EditTrackPage({ params }: PageProps) {
  const { id } = await params;
  const session = await requireRole("admin");

  // Resolve id -> slug through the seam rather than importing @/db here. Pages never touch the
  // database directly; that is the one rule every visibility and authorization guarantee in this
  // app depends on.
  const summary = (await getTracksForAdmin(session)).find((t) => t.id === id);
  if (!summary) notFound();

  const [track, courses] = await Promise.all([
    getTrackBySlug(summary.slug, session),
    getAllCourses(session),
  ]);
  if (!track) notFound();

  return (
    <div className="p-6 lg:p-10">
      <h1 className="text-3xl font-bold tracking-tight">{track.title}</h1>
      <div className="mt-8">
        <TrackForm track={track} courses={courses} />
      </div>
    </div>
  );
}

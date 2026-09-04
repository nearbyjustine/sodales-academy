import type { Metadata } from "next";
import { TrackForm } from "@/components/admin/track-form";
import { getAllCourses } from "@/lib/content/queries";
import { requireRole } from "@/lib/session";

export const metadata: Metadata = { title: "New track" };

export default async function NewTrackPage() {
  const session = await requireRole("admin");
  const courses = await getAllCourses(session);

  return (
    <div className="p-6 lg:p-10">
      <h1 className="text-3xl font-bold tracking-tight">New track</h1>
      <div className="mt-8">
        <TrackForm courses={courses} />
      </div>
    </div>
  );
}

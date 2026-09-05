import type { Metadata } from "next";
import { FolderOpenIcon } from "lucide-react";
import { ButtonLink } from "@/components/ui/button-link";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { TrackRowActions } from "@/components/admin/track-row-actions";
import { getTracksForAdmin } from "@/lib/content/queries";
import { requireRole } from "@/lib/session";

export const metadata: Metadata = { title: "Tracks" };

export default async function AdminTracksPage() {
  const session = await requireRole("admin");
  const tracks = await getTracksForAdmin(session);

  return (
    <div className="p-6 lg:p-10">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-3xl font-bold tracking-tight">Tracks</h1>
        <ButtonLink href="/admin/tracks/new">New track</ButtonLink>
      </div>

      {tracks.length === 0 ? (
        <div className="flex flex-col items-center gap-4 py-24 text-center">
          <FolderOpenIcon aria-hidden="true" className="size-10 text-graphite" />
          <h2 className="text-xl font-bold">No tracks yet</h2>
          <p className="max-w-sm text-graphite">A track is an ordered path through courses.</p>
          <ButtonLink href="/admin/tracks/new">New track</ButtonLink>
        </div>
      ) : (
        <div className="mt-8 rounded-md border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Courses</TableHead>
                <TableHead className="w-12">
                  <span className="sr-only">Actions</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tracks.map((track) => (
                <TableRow key={track.id}>
                  <TableCell className="font-bold">{track.title}</TableCell>
                  <TableCell>
                    {track.status === "published" ? (
                      <Badge>Published</Badge>
                    ) : (
                      <Badge variant="secondary">Draft</Badge>
                    )}
                  </TableCell>
                  <TableCell>{track.courseCount}</TableCell>
                  <TableCell>
                    <TrackRowActions
                      id={track.id}
                      trackTitle={track.title}
                      status={track.status}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

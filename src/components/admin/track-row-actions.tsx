"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { MoreHorizontalIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { deleteTrack, publishTrack, unpublishTrack } from "@/lib/content/mutations";
import type { TrackStatus } from "@/lib/content/types";

export function TrackRowActions({
  id,
  trackTitle,
  status,
}: {
  id: string;
  trackTitle: string;
  status: TrackStatus;
}) {
  const router = useRouter();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deletePending, startDeleteTransition] = useTransition();

  async function handleTogglePublish() {
    const result = status === "published" ? await unpublishTrack(id) : await publishTrack(id);

    if (!result.ok) {
      toast.error(result.message);
      return;
    }

    toast.success(status === "published" ? "Track unpublished." : "Track published.");
    router.refresh();
  }

  function handleDelete() {
    startDeleteTransition(async () => {
      const result = await deleteTrack(id);

      if (!result.ok) {
        toast.error(result.message);
        return;
      }

      toast.success("Track deleted.");
      setDeleteOpen(false);
      router.refresh();
    });
  }

  function handleDeleteDialogOpenChange(open: boolean) {
    if (deletePending && !open) return;
    setDeleteOpen(open);
  }

  return (
    <Dialog open={deleteOpen} onOpenChange={handleDeleteDialogOpenChange}>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={<Button variant="ghost" size="icon-sm" aria-label={`Actions for ${trackTitle}`} />}
        >
          <MoreHorizontalIcon />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem render={<Link href={`/admin/tracks/${id}/edit`} />}>
            Edit
          </DropdownMenuItem>
          <DropdownMenuItem onClick={handleTogglePublish}>
            {status === "published" ? "Unpublish" : "Publish"}
          </DropdownMenuItem>
          <DialogTrigger render={<DropdownMenuItem variant="destructive" />}>Delete</DialogTrigger>
        </DropdownMenuContent>
      </DropdownMenu>

      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete &ldquo;{trackTitle}&rdquo;?</DialogTitle>
          <DialogDescription>
            This action cannot be undone. Enrolled learners keep their course progress — deleting a
            track only removes the ordered path, not any course or enrollment it links to.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose render={<Button variant="outline" disabled={deletePending} />}>
            Cancel
          </DialogClose>
          <Button variant="destructive" disabled={deletePending} onClick={handleDelete}>
            {deletePending ? "Deleting…" : "Delete"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

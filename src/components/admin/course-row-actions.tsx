"use client";

import Link from "next/link";
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
import type { CourseStatus } from "@/lib/content/types";

const DEMO_TOAST = "Demo mode — changes aren't saved yet.";

export function CourseRowActions({
  courseId,
  courseTitle,
  status,
}: {
  courseId: string;
  courseTitle: string;
  status: CourseStatus;
}) {
  return (
    <Dialog>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={<Button variant="ghost" size="icon-sm" aria-label={`Actions for ${courseTitle}`} />}
        >
          <MoreHorizontalIcon />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem render={<Link href={`/admin/courses/${courseId}/edit`} />}>
            Edit
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => toast.info(DEMO_TOAST)}>
            {status === "published" ? "Unpublish" : "Publish"}
          </DropdownMenuItem>
          <DialogTrigger render={<DropdownMenuItem variant="destructive" />}>Delete</DialogTrigger>
        </DropdownMenuContent>
      </DropdownMenu>

      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete &ldquo;{courseTitle}&rdquo;?</DialogTitle>
          <DialogDescription>
            This action cannot be undone once real deletion is wired up in Phase 2.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>Cancel</DialogClose>
          <DialogClose
            render={<Button variant="destructive" onClick={() => toast.info(DEMO_TOAST)} />}
          >
            Delete
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

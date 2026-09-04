"use client";

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
import { deleteCourse, publishCourse, unpublishCourse } from "@/lib/content/mutations";
import type { CourseStatus } from "@/lib/content/types";

export function CourseRowActions({
  id,
  courseId,
  courseTitle,
  status,
}: {
  /** Real primary key — used for publish/unpublish/delete mutations. */
  id: string;
  /** Slug — used for the edit-page route. */
  courseId: string;
  courseTitle: string;
  status: CourseStatus;
}) {
  const router = useRouter();

  async function handleTogglePublish() {
    const result =
      status === "published" ? await unpublishCourse(id) : await publishCourse(id);

    if (!result.ok) {
      toast.error(result.message);
      return;
    }

    toast.success(status === "published" ? "Course unpublished." : "Course published.");
    router.refresh();
  }

  async function handleDelete() {
    const result = await deleteCourse(id);

    if (!result.ok) {
      toast.error(result.message);
      return;
    }

    toast.success("Course deleted.");
    router.refresh();
  }

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
          <DropdownMenuItem onClick={handleTogglePublish}>
            {status === "published" ? "Unpublish" : "Publish"}
          </DropdownMenuItem>
          <DialogTrigger render={<DropdownMenuItem variant="destructive" />}>Delete</DialogTrigger>
        </DropdownMenuContent>
      </DropdownMenu>

      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete &ldquo;{courseTitle}&rdquo;?</DialogTitle>
          <DialogDescription>This action cannot be undone.</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>Cancel</DialogClose>
          <DialogClose render={<Button variant="destructive" onClick={handleDelete} />}>
            Delete
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

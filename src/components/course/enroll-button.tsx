"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { enrollInCourse } from "@/lib/content/mutations";

export function EnrollButton({ courseSlug }: { courseSlug: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function handleClick() {
    startTransition(async () => {
      const result = await enrollInCourse(courseSlug);
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      toast.success("Enrolled — let's go.");
      router.refresh();
    });
  }

  return (
    <Button onClick={handleClick} disabled={pending}>
      {pending ? "Enrolling…" : "Enroll"}
    </Button>
  );
}

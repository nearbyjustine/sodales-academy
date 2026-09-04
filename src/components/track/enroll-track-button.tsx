"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { enrollInTrack } from "@/lib/content/mutations";

/**
 * Mirrors `EnrollButton` (`@/components/course/enroll-button.tsx`): the whole
 * async write lives inside `startTransition` so `pending` covers the entire
 * round-trip, not just the post-write refresh. Never assume the write
 * succeeded — branch on `result.ok` and surface `result.message` on failure,
 * because a track enrolment that silently failed would leave the learner
 * staring at a map they have no access to.
 */
export function EnrollTrackButton({ trackSlug }: { trackSlug: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function handleClick() {
    startTransition(async () => {
      const result = await enrollInTrack(trackSlug);
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      toast.success("You're in. Start whenever you're ready.");
      router.refresh();
    });
  }

  return (
    <Button onClick={handleClick} disabled={pending}>
      {pending ? "Enrolling…" : "Start this track"}
    </Button>
  );
}

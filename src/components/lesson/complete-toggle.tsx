"use client";

import { useState, useTransition } from "react";
import { CheckIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { toggleLessonComplete } from "@/lib/content/mutations";

export function CompleteToggle({
  lessonId,
  initialComplete,
}: {
  lessonId: string;
  initialComplete: boolean;
}) {
  const [complete, setComplete] = useState(initialComplete);
  const [pending, startTransition] = useTransition();

  function handleToggle() {
    startTransition(async () => {
      const result = await toggleLessonComplete(lessonId);
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      setComplete(result.complete);
      toast.success(result.complete ? "Lesson marked complete" : "Lesson marked incomplete");
    });
  }

  return (
    <Button variant={complete ? "secondary" : "default"} onClick={handleToggle} disabled={pending}>
      {complete ? (
        <>
          <CheckIcon /> Completed
        </>
      ) : (
        "Mark complete"
      )}
    </Button>
  );
}

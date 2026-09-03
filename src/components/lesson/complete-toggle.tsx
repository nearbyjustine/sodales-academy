"use client";

import { CheckIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { toggleLessonComplete, useLessonComplete } from "@/lib/progress";

export function CompleteToggle({ lessonId }: { lessonId: string }) {
  const complete = useLessonComplete(lessonId);

  function handleToggle() {
    const nowComplete = toggleLessonComplete(lessonId);
    toast.success(nowComplete ? "Lesson marked complete" : "Lesson marked incomplete");
  }

  return (
    <Button variant={complete ? "secondary" : "default"} onClick={handleToggle}>
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

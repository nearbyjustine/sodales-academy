"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowDownIcon, ArrowUpIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { createTrack, updateTrack } from "@/lib/content/mutations";
import { trackInputSchema, type TrackInput } from "@/lib/validation";
import type { CourseSummary, TrackDetail } from "@/lib/content/types";

function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function moveItem<T>(items: T[], index: number, direction: -1 | 1): T[] {
  const target = index + direction;
  if (target < 0 || target >= items.length) return items;
  const next = [...items];
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}

const EMPTY_TRACK: TrackInput = {
  slug: "",
  title: "",
  promise: "",
  outcome: "",
  position: 0,
  courseIds: [],
};

export function TrackForm({
  track,
  courses,
}: {
  /** Omitted when creating. */
  track?: TrackDetail;
  courses: CourseSummary[];
}) {
  const router = useRouter();
  const [state, setState] = useState<TrackInput>(
    track
      ? {
          slug: track.slug,
          title: track.title,
          promise: track.promise,
          outcome: track.outcome,
          position: track.position,
          // Order matters: createTrack/updateTrack derive each course's `position`
          // from this array's index, so this is where the round-trip either holds
          // or breaks. Sort by the persisted position, not array/insert order.
          courseIds: [...track.courses]
            .sort((a, b) => a.position - b.position)
            .map((c) => c.id),
        }
      : EMPTY_TRACK,
  );
  const [slugTouched, setSlugTouched] = useState(Boolean(track));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, startTransition] = useTransition();

  function handleTitleChange(title: string) {
    setState((prev) => ({
      ...prev,
      title,
      slug: slugTouched ? prev.slug : slugify(title),
    }));
  }

  function toggleCourse(courseId: string) {
    setState((prev) => ({
      ...prev,
      courseIds: prev.courseIds.includes(courseId)
        ? prev.courseIds.filter((id) => id !== courseId)
        : [...prev.courseIds, courseId],
    }));
  }

  function moveCourse(index: number, direction: -1 | 1) {
    setState((prev) => ({ ...prev, courseIds: moveItem(prev.courseIds, index, direction) }));
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;

    const result = trackInputSchema.safeParse(state);

    if (!result.success) {
      const nextErrors: Record<string, string> = {};
      for (const issue of result.error.issues) {
        const key = issue.path.join(".");
        if (!nextErrors[key]) nextErrors[key] = issue.message;
      }
      setErrors(nextErrors);

      const firstKey = Object.keys(nextErrors)[0];
      document.getElementById(firstKey)?.focus();
      return;
    }

    setErrors({});
    startTransition(async () => {
      const mutationResult = track
        ? await updateTrack(track.id, result.data)
        : await createTrack(result.data);

      if (!mutationResult.ok) {
        toast.error(mutationResult.message);
        return;
      }

      toast.success(track ? "Track updated." : "Track created.");
      router.push("/admin/tracks");
    });
  }

  const courseById = new Map(courses.map((c) => [c.id, c]));

  return (
    <form onSubmit={handleSubmit} className="flex max-w-2xl flex-col gap-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="title">Title</Label>
          <Input
            id="title"
            className="mt-1.5"
            value={state.title}
            onChange={(e) => handleTitleChange(e.target.value)}
            aria-invalid={errors.title ? true : undefined}
            aria-describedby={errors.title ? "title-error" : undefined}
          />
          {errors.title ? (
            <p id="title-error" role="alert" className="mt-1 text-sm text-destructive">
              {errors.title}
            </p>
          ) : null}
        </div>

        <div>
          <Label htmlFor="slug">Slug</Label>
          <Input
            id="slug"
            className="mt-1.5"
            value={state.slug}
            onChange={(e) => {
              setSlugTouched(true);
              setState((prev) => ({ ...prev, slug: e.target.value }));
            }}
            aria-invalid={errors.slug ? true : undefined}
            aria-describedby={errors.slug ? "slug-error" : undefined}
          />
          {errors.slug ? (
            <p id="slug-error" role="alert" className="mt-1 text-sm text-destructive">
              {errors.slug}
            </p>
          ) : null}
        </div>
      </div>

      <div>
        <Label htmlFor="promise">Promise</Label>
        <Input
          id="promise"
          className="mt-1.5"
          value={state.promise}
          onChange={(e) => setState((prev) => ({ ...prev, promise: e.target.value }))}
          aria-invalid={errors.promise ? true : undefined}
          aria-describedby={errors.promise ? "promise-error" : undefined}
        />
        <p className="mt-1 text-sm text-graphite">One line. Shown on cards and the hero.</p>
        {errors.promise ? (
          <p id="promise-error" role="alert" className="mt-1 text-sm text-destructive">
            {errors.promise}
          </p>
        ) : null}
      </div>

      <div>
        <Label htmlFor="outcome">Outcome</Label>
        <Textarea
          id="outcome"
          className="mt-1.5"
          value={state.outcome}
          onChange={(e) => setState((prev) => ({ ...prev, outcome: e.target.value }))}
          aria-invalid={errors.outcome ? true : undefined}
          aria-describedby={errors.outcome ? "outcome-error" : undefined}
        />
        <p className="mt-1 text-sm text-graphite">
          Completes &ldquo;You finish able to&hellip;&rdquo;. This is the sentence someone reads
          before paying — the app cannot verify it, so make it true.
        </p>
        {errors.outcome ? (
          <p id="outcome-error" role="alert" className="mt-1 text-sm text-destructive">
            {errors.outcome}
          </p>
        ) : null}
      </div>

      <div>
        <Label htmlFor="position">Position</Label>
        <Input
          id="position"
          className="mt-1.5"
          type="number"
          min={0}
          value={state.position}
          onChange={(e) => setState((prev) => ({ ...prev, position: Number(e.target.value) }))}
          aria-invalid={errors.position ? true : undefined}
          aria-describedby={errors.position ? "position-error" : undefined}
        />
        <p className="mt-1 text-sm text-graphite">Lower numbers list first among tracks.</p>
        {errors.position ? (
          <p id="position-error" role="alert" className="mt-1 text-sm text-destructive">
            {errors.position}
          </p>
        ) : null}
      </div>

      <fieldset className="flex flex-col gap-3">
        <legend className="label-eyebrow text-graphite">Courses, in order</legend>
        {errors.courseIds ? (
          <p role="alert" className="text-sm text-destructive">
            {errors.courseIds}
          </p>
        ) : null}

        {state.courseIds.length === 0 ? (
          <p className="text-sm text-graphite">No courses selected yet.</p>
        ) : (
          <ol className="flex flex-col gap-2">
            {state.courseIds.map((id, index) => {
              const courseTitle = courseById.get(id)?.title ?? id;
              return (
                <li
                  key={id}
                  className="flex items-center gap-3 rounded-md border border-border p-3"
                >
                  <span className="label-eyebrow text-graphite">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <span className="flex-1 font-bold">{courseTitle}</span>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon-sm"
                    aria-label={`Move ${courseTitle} up`}
                    disabled={index === 0}
                    onClick={() => moveCourse(index, -1)}
                  >
                    <ArrowUpIcon />
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon-sm"
                    aria-label={`Move ${courseTitle} down`}
                    disabled={index === state.courseIds.length - 1}
                    onClick={() => moveCourse(index, 1)}
                  >
                    <ArrowDownIcon />
                  </Button>
                  <Button type="button" variant="ghost" size="sm" onClick={() => toggleCourse(id)}>
                    Remove
                  </Button>
                </li>
              );
            })}
          </ol>
        )}

        <div className="flex flex-col gap-3 rounded-md border border-border p-3">
          {courses
            .filter((c) => !state.courseIds.includes(c.id))
            .map((c) => (
              <label key={c.id} className="flex items-center gap-3 text-sm">
                <Checkbox checked={false} onCheckedChange={() => toggleCourse(c.id)} />
                {c.title}
              </label>
            ))}
          {courses.length === 0 ? (
            <p className="text-sm text-graphite">No courses exist yet.</p>
          ) : null}
        </div>
      </fieldset>

      <Button type="submit" className="self-start" disabled={pending}>
        {pending ? "Saving…" : track ? "Save track" : "Create track"}
      </Button>
    </form>
  );
}

"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ModulesEditor } from "@/components/admin/modules-editor";
import { COURSE_CATEGORIES, courseInputSchema, type CourseInput } from "@/lib/validation";

const DEMO_TOAST = "Demo mode — changes aren't saved yet.";

const EMPTY_COURSE: CourseInput = {
  title: "",
  slug: "",
  description: "",
  category: COURSE_CATEGORIES[0],
  level: "beginner",
  modules: [{ title: "", position: 1, lessons: [{ title: "", slug: "", position: 1, isPreview: false, content: "" }] }],
};

function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function CourseForm({
  initial,
  heading,
}: {
  initial?: CourseInput;
  heading: string;
}) {
  const [state, setState] = useState<CourseInput>(initial ?? EMPTY_COURSE);
  const [slugTouched, setSlugTouched] = useState(Boolean(initial));
  const [errors, setErrors] = useState<Record<string, string>>({});

  function handleTitleChange(title: string) {
    setState((prev) => ({
      ...prev,
      title,
      slug: slugTouched ? prev.slug : slugify(title),
    }));
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const result = courseInputSchema.safeParse(state);

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
    toast.info(DEMO_TOAST);
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      <div className="rounded-md border border-violet bg-secondary p-4 text-sm text-secondary-foreground">
        Demo mode — this form validates but does not save.
      </div>

      <h1 className="text-3xl font-bold tracking-tight">{heading}</h1>

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
        <Label htmlFor="description">Description</Label>
        <Textarea
          id="description"
          className="mt-1.5"
          value={state.description}
          onChange={(e) => setState((prev) => ({ ...prev, description: e.target.value }))}
          aria-invalid={errors.description ? true : undefined}
          aria-describedby={errors.description ? "description-error" : undefined}
        />
        {errors.description ? (
          <p id="description-error" role="alert" className="mt-1 text-sm text-destructive">
            {errors.description}
          </p>
        ) : null}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="category">Category</Label>
          <Select
            value={state.category}
            onValueChange={(value) =>
              setState((prev) => ({ ...prev, category: value as CourseInput["category"] }))
            }
          >
            <SelectTrigger id="category" className="mt-1.5 w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {COURSE_CATEGORIES.map((category) => (
                <SelectItem key={category} value={category}>
                  {category}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label htmlFor="level">Level</Label>
          <Select
            value={state.level}
            onValueChange={(value) =>
              setState((prev) => ({ ...prev, level: value as CourseInput["level"] }))
            }
          >
            <SelectTrigger id="level" className="mt-1.5 w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="beginner">Beginner</SelectItem>
              <SelectItem value="intermediate">Intermediate</SelectItem>
              <SelectItem value="advanced">Advanced</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div>
        <p className="label-eyebrow text-graphite">Modules</p>
        {errors.modules ? (
          <p role="alert" className="mt-1 text-sm text-destructive">
            {errors.modules}
          </p>
        ) : null}
        <div className="mt-3">
          <ModulesEditor
            value={state.modules}
            onChange={(modules) => setState((prev) => ({ ...prev, modules }))}
            errors={errors}
          />
        </div>
      </div>

      <Button type="submit" className="self-start">
        Save course
      </Button>
    </form>
  );
}

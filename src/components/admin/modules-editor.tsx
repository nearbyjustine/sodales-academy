"use client";

import dynamic from "next/dynamic";
import { ArrowDownIcon, ArrowUpIcon, PlusIcon, TrashIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type { CourseInput } from "@/lib/validation";

const LessonContentEditor = dynamic(
  () => import("./lesson-content-editor").then((m) => m.LessonContentEditor),
  {
    ssr: false,
    loading: () => <Textarea disabled className="mt-1.5 min-h-32" aria-hidden="true" />,
  },
);

type Modules = CourseInput["modules"];
type ModuleValue = Modules[number];
type LessonValue = ModuleValue["lessons"][number];

const EMPTY_LESSON: LessonValue = {
  title: "",
  slug: "",
  position: 1,
  isPreview: false,
  content: "",
};

const EMPTY_MODULE: ModuleValue = {
  title: "",
  position: 1,
  lessons: [EMPTY_LESSON],
};

function recompute(modules: Modules): Modules {
  return modules.map((mod, i) => ({
    ...mod,
    position: i + 1,
    lessons: mod.lessons.map((lesson, j) => ({ ...lesson, position: j + 1 })),
  }));
}

function moveItem<T>(items: T[], index: number, direction: -1 | 1): T[] {
  const target = index + direction;
  if (target < 0 || target >= items.length) return items;
  const next = [...items];
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}

export function ModulesEditor({
  value,
  onChange,
  errors = {},
}: {
  value: Modules;
  onChange: (next: Modules) => void;
  errors?: Record<string, string>;
}) {
  function updateModule(index: number, patch: Partial<ModuleValue>) {
    onChange(recompute(value.map((mod, i) => (i === index ? { ...mod, ...patch } : mod))));
  }

  function updateLesson(moduleIndex: number, lessonIndex: number, patch: Partial<LessonValue>) {
    onChange(
      recompute(
        value.map((mod, i) =>
          i !== moduleIndex
            ? mod
            : {
                ...mod,
                lessons: mod.lessons.map((lesson, j) =>
                  j === lessonIndex ? { ...lesson, ...patch } : lesson,
                ),
              },
        ),
      ),
    );
  }

  function addModule() {
    onChange(recompute([...value, structuredClone(EMPTY_MODULE)]));
  }

  function removeModule(index: number) {
    onChange(recompute(value.filter((_, i) => i !== index)));
  }

  function moveModule(index: number, direction: -1 | 1) {
    onChange(recompute(moveItem(value, index, direction)));
  }

  function addLesson(moduleIndex: number) {
    updateModule(moduleIndex, {
      lessons: [...value[moduleIndex].lessons, structuredClone(EMPTY_LESSON)],
    });
  }

  function removeLesson(moduleIndex: number, lessonIndex: number) {
    updateModule(moduleIndex, {
      lessons: value[moduleIndex].lessons.filter((_, j) => j !== lessonIndex),
    });
  }

  return (
    <div className="flex flex-col gap-6">
      {value.map((mod, moduleIndex) => (
        <div key={moduleIndex} className="rounded-md border border-border p-4">
          <div className="flex items-end gap-2">
            <div className="flex-1">
              <Label htmlFor={`modules.${moduleIndex}.title`}>Module title</Label>
              <Input
                id={`modules.${moduleIndex}.title`}
                className="mt-1.5"
                value={mod.title}
                onChange={(e) => updateModule(moduleIndex, { title: e.target.value })}
                aria-invalid={errors[`modules.${moduleIndex}.title`] ? true : undefined}
                aria-describedby={
                  errors[`modules.${moduleIndex}.title`]
                    ? `modules.${moduleIndex}.title-error`
                    : undefined
                }
              />
            </div>
            <Button
              type="button"
              variant="outline"
              size="icon"
              aria-label="Move module up"
              disabled={moduleIndex === 0}
              onClick={() => moveModule(moduleIndex, -1)}
            >
              <ArrowUpIcon />
            </Button>
            <Button
              type="button"
              variant="outline"
              size="icon"
              aria-label="Move module down"
              disabled={moduleIndex === value.length - 1}
              onClick={() => moveModule(moduleIndex, 1)}
            >
              <ArrowDownIcon />
            </Button>
            <Button
              type="button"
              variant="destructive"
              size="icon"
              aria-label="Remove module"
              onClick={() => removeModule(moduleIndex)}
            >
              <TrashIcon />
            </Button>
          </div>
          {errors[`modules.${moduleIndex}.title`] ? (
            <p
              id={`modules.${moduleIndex}.title-error`}
              role="alert"
              className="mt-1 text-sm text-destructive"
            >
              {errors[`modules.${moduleIndex}.title`]}
            </p>
          ) : null}

          <div className="mt-6 flex flex-col gap-4">
            {mod.lessons.map((lesson, lessonIndex) => {
              const prefix = `modules.${moduleIndex}.lessons.${lessonIndex}`;
              return (
                <div
                  key={lessonIndex}
                  className={cn("rounded-md border p-4", "border-border")}
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="label-eyebrow text-graphite">Lesson {lessonIndex + 1}</p>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      aria-label="Remove lesson"
                      onClick={() => removeLesson(moduleIndex, lessonIndex)}
                    >
                      <TrashIcon />
                    </Button>
                  </div>

                  <div className="mt-2 grid gap-3 sm:grid-cols-2">
                    <div>
                      <Label htmlFor={`${prefix}.title`}>Title</Label>
                      <Input
                        id={`${prefix}.title`}
                        className="mt-1.5"
                        value={lesson.title}
                        onChange={(e) =>
                          updateLesson(moduleIndex, lessonIndex, { title: e.target.value })
                        }
                        aria-invalid={errors[`${prefix}.title`] ? true : undefined}
                        aria-describedby={
                          errors[`${prefix}.title`] ? `${prefix}.title-error` : undefined
                        }
                      />
                      {errors[`${prefix}.title`] ? (
                        <p
                          id={`${prefix}.title-error`}
                          role="alert"
                          className="mt-1 text-sm text-destructive"
                        >
                          {errors[`${prefix}.title`]}
                        </p>
                      ) : null}
                    </div>
                    <div>
                      <Label htmlFor={`${prefix}.slug`}>Slug</Label>
                      <Input
                        id={`${prefix}.slug`}
                        className="mt-1.5"
                        value={lesson.slug}
                        onChange={(e) =>
                          updateLesson(moduleIndex, lessonIndex, { slug: e.target.value })
                        }
                        aria-invalid={errors[`${prefix}.slug`] ? true : undefined}
                        aria-describedby={
                          errors[`${prefix}.slug`] ? `${prefix}.slug-error` : undefined
                        }
                      />
                      {errors[`${prefix}.slug`] ? (
                        <p
                          id={`${prefix}.slug-error`}
                          role="alert"
                          className="mt-1 text-sm text-destructive"
                        >
                          {errors[`${prefix}.slug`]}
                        </p>
                      ) : null}
                    </div>
                  </div>

                  <label className="mt-3 flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={lesson.isPreview}
                      onCheckedChange={(checked) =>
                        updateLesson(moduleIndex, lessonIndex, { isPreview: checked === true })
                      }
                    />
                    Preview lesson
                  </label>

                  <div className="mt-3">
                    <Label htmlFor={`${prefix}.content`}>Content</Label>
                    <div className="mt-1.5">
                      <LessonContentEditor
                        id={`${prefix}.content`}
                        value={lesson.content}
                        onChange={(content) => updateLesson(moduleIndex, lessonIndex, { content })}
                        ariaLabel={`Lesson ${lessonIndex + 1} content`}
                        ariaInvalid={Boolean(errors[`${prefix}.content`])}
                        ariaDescribedBy={
                          errors[`${prefix}.content`] ? `${prefix}.content-error` : undefined
                        }
                      />
                    </div>
                    {errors[`${prefix}.content`] ? (
                      <p
                        id={`${prefix}.content-error`}
                        role="alert"
                        className="mt-1 text-sm text-destructive"
                      >
                        {errors[`${prefix}.content`]}
                      </p>
                    ) : null}
                  </div>
                </div>
              );
            })}

            <Button
              type="button"
              variant="outline"
              size="sm"
              className="self-start"
              onClick={() => addLesson(moduleIndex)}
            >
              <PlusIcon /> Add lesson
            </Button>
          </div>
        </div>
      ))}

      <Button type="button" variant="outline" onClick={addModule} className="self-start">
        <PlusIcon /> Add module
      </Button>
    </div>
  );
}

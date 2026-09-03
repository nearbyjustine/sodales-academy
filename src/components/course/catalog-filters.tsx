"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { LEVELS, type Level } from "@/lib/content/types";

const LEVEL_OPTIONS: { value: Level | "all"; label: string }[] = [
  { value: "all", label: "All" },
  ...LEVELS.map((level) => ({ value: level, label: level[0].toUpperCase() + level.slice(1) })),
];

export function CatalogFilters() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [query, setQuery] = useState(searchParams.get("q") ?? "");
  const currentLevel = searchParams.get("level") ?? "all";

  function pushParams(next: { q?: string; level?: string }) {
    const params = new URLSearchParams(searchParams.toString());

    for (const [key, value] of Object.entries(next)) {
      if (value) params.set(key, value);
      else params.delete(key);
    }

    router.push(`/courses${params.toString() ? `?${params.toString()}` : ""}`);
  }

  return (
    <div className="sticky top-16 z-10 -mx-4 flex flex-col gap-4 overflow-x-auto border-b border-border bg-ivory/95 px-4 py-4 backdrop-blur">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="course-search">Search courses</Label>
        <Input
          id="course-search"
          type="search"
          placeholder="Search by title or description…"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") pushParams({ q: query });
          }}
          className="max-w-sm"
        />
      </div>

      <div className="flex gap-2">
        {LEVEL_OPTIONS.map((option) => {
          const isActive = currentLevel === option.value;
          return (
            <button
              key={option.value}
              type="button"
              aria-pressed={isActive}
              onClick={() => pushParams({ level: option.value === "all" ? undefined : option.value })}
              className={cn(
                "label-eyebrow shrink-0 rounded-full border px-3 py-1.5 transition-colors",
                isActive
                  ? "border-violet bg-violet text-primary-foreground"
                  : "border-border text-graphite hover:border-violet hover:text-violet",
              )}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

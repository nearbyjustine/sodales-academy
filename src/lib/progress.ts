import { useSyncExternalStore } from "react";
import { DEMO_ENROLLMENTS } from "@/content/session";

export const PROGRESS_STORAGE_KEY = "sodales-academy-progress";
const PROGRESS_CHANGE_EVENT = "sodales-academy-progress-change";

/**
 * PHASE 1 ONLY — the ONLY module permitted to touch localStorage.
 * Phase 2 replaces this with lesson_progress rows; the exported signatures stay.
 */

function seed(): string[] {
  return DEMO_ENROLLMENTS.flatMap((e) => e.seededCompletedLessonIds);
}

function read(): string[] {
  if (typeof window === "undefined") return seed();

  const raw = window.localStorage.getItem(PROGRESS_STORAGE_KEY);
  if (raw === null) {
    const seeded = seed();
    window.localStorage.setItem(PROGRESS_STORAGE_KEY, JSON.stringify(seeded));
    return seeded;
  }

  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((v) => typeof v === "string") : [];
  } catch {
    return [];
  }
}

function write(ids: string[]): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(PROGRESS_STORAGE_KEY, JSON.stringify(ids));
  window.dispatchEvent(new Event(PROGRESS_CHANGE_EVENT));
}

export function getCompletedLessonIds(): Set<string> {
  return new Set(read());
}

export function isLessonComplete(lessonId: string): boolean {
  return getCompletedLessonIds().has(lessonId);
}

export function toggleLessonComplete(lessonId: string): boolean {
  const ids = getCompletedLessonIds();
  const nowComplete = !ids.has(lessonId);

  if (nowComplete) ids.add(lessonId);
  else ids.delete(lessonId);

  write([...ids]);
  return nowComplete;
}

export function getCourseProgress(
  _courseSlug: string,
  lessonIds: string[],
): { completed: number; total: number; percent: number } {
  const done = getCompletedLessonIds();
  const completed = lessonIds.filter((id) => done.has(id)).length;
  const total = lessonIds.length;

  return {
    completed,
    total,
    percent: total === 0 ? 0 : Math.round((completed / total) * 100),
  };
}

export function resetProgress(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(PROGRESS_STORAGE_KEY);
  window.dispatchEvent(new Event(PROGRESS_CHANGE_EVENT));
}

/**
 * Reactive view of completed lesson ids, for components that render checkmarks
 * or progress bars. Built on useSyncExternalStore instead of a mount effect so
 * hydration uses the same seeded snapshot the server rendered, then flips to
 * the real localStorage value in one clean pass — no setState-in-effect, no
 * flash of stale state when a sibling component (e.g. the complete toggle)
 * writes a change.
 */
function subscribe(onChange: () => void): () => void {
  window.addEventListener(PROGRESS_CHANGE_EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(PROGRESS_CHANGE_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

let cachedRaw: string | null | undefined;
let cachedSnapshot = new Set<string>();

function getClientSnapshot(): Set<string> {
  const raw = window.localStorage.getItem(PROGRESS_STORAGE_KEY);
  if (raw !== cachedRaw) {
    cachedRaw = raw;
    cachedSnapshot = getCompletedLessonIds();
  }
  return cachedSnapshot;
}

let serverSnapshot: Set<string> | null = null;

function getServerSnapshot(): Set<string> {
  if (!serverSnapshot) serverSnapshot = new Set(seed());
  return serverSnapshot;
}

export function useCompletedLessonIds(): Set<string> {
  return useSyncExternalStore(subscribe, getClientSnapshot, getServerSnapshot);
}

export function useLessonComplete(lessonId: string): boolean {
  return useCompletedLessonIds().has(lessonId);
}

import { DEMO_ENROLLMENTS } from "@/content/session";

export const PROGRESS_STORAGE_KEY = "sodales-academy-progress";

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
}

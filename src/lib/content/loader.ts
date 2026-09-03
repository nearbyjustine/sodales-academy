import "server-only";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import matter from "gray-matter";
import { LEVELS, type CourseDetail, type CourseModule, type Lesson, type Level, type CourseStatus } from "./types";

const CONTENT_ROOT = path.join(process.cwd(), "content", "courses");

/**
 * The ONLY module permitted to read from content/.
 * Pages and components must go through src/lib/content/queries.ts instead.
 *
 * `root` defaults to the real content directory; tests may override it to load
 * an isolated fixture tree without touching the directory the app itself reads.
 */
export async function loadAllCourses(root: string = CONTENT_ROOT): Promise<CourseDetail[]> {
  const slugs = await readCourseSlugs(root);
  const courses = await Promise.all(slugs.map((slug) => loadCourse(slug, root)));

  assertUniqueSlugs(courses);
  return courses.sort((a, b) => a.title.localeCompare(b.title));
}

async function readCourseSlugs(root: string): Promise<string[]> {
  const entries = await readdir(root, { withFileTypes: true });
  return entries.filter((e) => e.isDirectory()).map((e) => e.name);
}

async function loadCourse(slug: string, root: string): Promise<CourseDetail> {
  const dir = path.join(root, slug);
  const raw = await readFile(path.join(dir, "course.md"), "utf8");
  const { data } = matter(raw);

  const lessons = await loadLessons(dir, slug);
  const modules = groupIntoModules(lessons);

  return {
    id: slug,
    slug,
    title: requireString(data.title, `${slug}/course.md: title`),
    description: requireString(data.description, `${slug}/course.md: description`),
    category: requireString(data.category, `${slug}/course.md: category`),
    level: requireLevel(data.level, `${slug}/course.md: level`),
    status: requireCourseStatus(data.status ?? "published", `${slug}/course.md: status`),
    instructorName: requireString(data.instructorName, `${slug}/course.md: instructorName`),
    lessonCount: lessons.length,
    modules,
  };
}

async function loadLessons(dir: string, courseSlug: string): Promise<Lesson[]> {
  const files = (await readdir(dir))
    .filter((f) => f.endsWith(".md") && f !== "course.md")
    .sort();

  const lessons = await Promise.all(
    files.map(async (file, index) => {
      const raw = await readFile(path.join(dir, file), "utf8");
      const { data, content } = matter(raw);
      const slug = file.replace(/^\d+-/, "").replace(/\.md$/, "");

      return {
        id: `${courseSlug}/${slug}`,
        courseSlug,
        slug,
        title: requireString(data.title, `${courseSlug}/${file}: title`),
        moduleTitle: requireString(data.module, `${courseSlug}/${file}: module`),
        position: index + 1,
        isPreview: data.isPreview === true,
        content: content.trim(),
      } satisfies Lesson;
    }),
  );

  assertUniqueLessonSlugs(courseSlug, lessons);
  return lessons;
}

function groupIntoModules(lessons: Lesson[]): CourseModule[] {
  const order: string[] = [];
  const byTitle = new Map<string, Lesson[]>();

  for (const lesson of lessons) {
    if (!byTitle.has(lesson.moduleTitle)) {
      byTitle.set(lesson.moduleTitle, []);
      order.push(lesson.moduleTitle);
    }
    byTitle.get(lesson.moduleTitle)!.push(lesson);
  }

  return order.map((title, index) => ({
    id: `${title.toLowerCase().replace(/\s+/g, "-")}-${index}`,
    title,
    position: index + 1,
    lessons: byTitle.get(title)!,
  }));
}

function requireString(value: unknown, where: string): string {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`Missing required frontmatter — ${where}`);
  }
  return value;
}

function requireLevel(value: unknown, where: string): Level {
  if (!isLevel(value)) {
    throw new Error(`Invalid level — ${where}`);
  }
  return value;
}

function isLevel(value: unknown): value is Level {
  return typeof value === "string" && LEVELS.some((level) => level === value);
}

function requireCourseStatus(value: unknown, where: string): CourseStatus {
  if (value !== "draft" && value !== "published") {
    throw new Error(`Invalid status — ${where}`);
  }
  return value;
}

function assertUniqueSlugs(courses: CourseDetail[]): void {
  const seen = new Set<string>();
  for (const course of courses) {
    if (seen.has(course.slug)) {
      throw new Error(`Duplicate course slug: ${course.slug}`);
    }
    seen.add(course.slug);
  }
}

function assertUniqueLessonSlugs(courseSlug: string, lessons: Lesson[]): void {
  const seen = new Set<string>();
  for (const lesson of lessons) {
    if (seen.has(lesson.slug)) {
      throw new Error(`Duplicate lesson slug in ${courseSlug}: ${lesson.slug}`);
    }
    seen.add(lesson.slug);
  }
}

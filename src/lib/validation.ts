import { z } from "zod";

export const COURSE_CATEGORIES = [
  "Freelancing",
  "Development",
  "Branding",
  "Design",
  "Video",
  "Business",
] as const;

const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;

export const signInSchema = z.object({
  email: z.email("Enter a valid email address"),
  password: z.string().min(1, "Password is required"),
});

export const signUpSchema = z.object({
  name: z.string().trim().min(2, "Name is too short").max(80, "Name is too long"),
  email: z.email("Enter a valid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

const lessonSchema = z.object({
  title: z.string().trim().min(3).max(120),
  slug: z.string().regex(SLUG, "Use lowercase letters, numbers, and hyphens").min(3).max(100),
  position: z.number().int().min(1).max(999),
  isPreview: z.boolean(),
  content: z.string().min(50, "Lesson content must be at least 50 characters"),
});

const moduleSchema = z.object({
  title: z.string().trim().min(3).max(100),
  position: z.number().int().min(1).max(999),
  lessons: z.array(lessonSchema).min(1, "Add at least one lesson").max(30),
});

export const courseInputSchema = z
  .object({
    title: z.string().trim().min(3, "Title is too short").max(120),
    slug: z.string().regex(SLUG, "Use lowercase letters, numbers, and hyphens").min(3).max(100),
    description: z.string().trim().min(20, "Description must be at least 20 characters").max(2000),
    category: z.enum(COURSE_CATEGORIES),
    level: z.enum(["beginner", "intermediate", "advanced"]),
    modules: z.array(moduleSchema).min(1, "Add at least one module").max(12),
  })
  .superRefine((course, ctx) => {
    const positions = course.modules.map((m) => m.position);
    if (new Set(positions).size !== positions.length) {
      ctx.addIssue({ code: "custom", message: "Module positions must be unique", path: ["modules"] });
    }

    const lessonSlugs = course.modules.flatMap((m) => m.lessons.map((l) => l.slug));
    if (new Set(lessonSlugs).size !== lessonSlugs.length) {
      ctx.addIssue({
        code: "custom",
        message: "Lesson slugs must be unique within a course",
        path: ["modules"],
      });
    }

    course.modules.forEach((mod, i) => {
      const p = mod.lessons.map((l) => l.position);
      if (new Set(p).size !== p.length) {
        ctx.addIssue({
          code: "custom",
          message: "Lesson positions must be unique within a module",
          path: ["modules", i, "lessons"],
        });
      }
    });
  });

export type CourseInput = z.infer<typeof courseInputSchema>;

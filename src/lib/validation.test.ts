import { describe, it, expect } from "vitest";
import { signUpSchema, courseInputSchema } from "./validation";

const validCourse = {
  title: "Test Course",
  slug: "test-course",
  description: "A description that is comfortably longer than twenty characters.",
  category: "Freelancing",
  level: "beginner",
  modules: [
    {
      title: "Module One",
      position: 1,
      lessons: [
        {
          title: "Lesson One",
          slug: "lesson-one",
          position: 1,
          isPreview: false,
          content: "x".repeat(60),
        },
      ],
    },
  ],
};

describe("signUpSchema", () => {
  it("accepts a valid sign-up", () => {
    expect(
      signUpSchema.safeParse({ name: "Alex", email: "a@b.co", password: "longenough" }).success,
    ).toBe(true);
  });

  it("rejects a password shorter than 8 characters", () => {
    expect(
      signUpSchema.safeParse({ name: "Alex", email: "a@b.co", password: "short" }).success,
    ).toBe(false);
  });
});

describe("courseInputSchema", () => {
  it("accepts a valid course", () => {
    expect(courseInputSchema.safeParse(validCourse).success).toBe(true);
  });

  it("rejects a slug with uppercase or spaces", () => {
    expect(courseInputSchema.safeParse({ ...validCourse, slug: "Test Course" }).success).toBe(false);
  });

  it("rejects a description under 20 characters", () => {
    expect(courseInputSchema.safeParse({ ...validCourse, description: "short" }).success).toBe(false);
  });

  it("rejects duplicate lesson slugs within a course", () => {
    const dup = structuredClone(validCourse);
    dup.modules[0].lessons.push({ ...dup.modules[0].lessons[0], position: 2 });
    expect(courseInputSchema.safeParse(dup).success).toBe(false);
  });

  it("rejects duplicate module positions", () => {
    const dup = structuredClone(validCourse);
    dup.modules.push({ ...dup.modules[0], title: "Module Two" });
    expect(courseInputSchema.safeParse(dup).success).toBe(false);
  });

  it("rejects lesson content under 50 characters", () => {
    const short = structuredClone(validCourse);
    short.modules[0].lessons[0].content = "too short";
    expect(courseInputSchema.safeParse(short).success).toBe(false);
  });
});

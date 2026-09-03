import type { Role } from "@/lib/session";

/**
 * PHASE 1 ONLY. The hardcoded demo user.
 * Phase 2 deletes this file and reads a real Neon Auth session instead.
 */
export const DEMO_USER = {
  userId: "demo-user-0001",
  name: "Alex Rivera",
  email: "alex@sodales.app",
  initials: "AR",
  defaultRole: "learner" as Role,
};

export type Enrollment = {
  courseSlug: string;
  /** Lesson ids pre-marked complete on first load, so progress bars are populated. */
  seededCompletedLessonIds: string[];
};

/** One finished course, one in progress, one just started. */
export const DEMO_ENROLLMENTS: Enrollment[] = [
  {
    courseSlug: "landing-your-first-client",
    seededCompletedLessonIds: [
      "landing-your-first-client/why-nobody-replies",
      "landing-your-first-client/where-clients-actually-are",
      "landing-your-first-client/the-first-message",
      "landing-your-first-client/the-discovery-call",
      "landing-your-first-client/closing-without-being-pushy",
    ],
  },
  {
    courseSlug: "web-development-foundations",
    seededCompletedLessonIds: [
      "web-development-foundations/how-the-web-works",
      "web-development-foundations/html-structure",
    ],
  },
  {
    courseSlug: "pricing-and-proposals",
    seededCompletedLessonIds: [],
  },
];

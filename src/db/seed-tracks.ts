import "server-only";
import { asc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { course, track, trackCourse } from "@/db/schema";

// A note on the `import "server-only"` above, for whoever next runs this file directly (not
// through Next.js): see `seed.ts` for the full explanation — this file has the same guard for the
// same reason, so `seed-tracks-cli.ts`'s bare Node/tsx invocation must pass
// `--conditions=react-server` (see `package.json`'s `db:seed:tracks` script) or every import below
// throws immediately, before `seedTracks` ever runs.

/**
 * Idempotent, like `seed.ts`. Safe to re-run: an existing track is left alone
 * rather than rebuilt, so re-seeding can never reorder a track an admin has
 * since edited by hand.
 */
const TRACKS = [
  {
    slug: "freelance-brand-designer",
    title: "Freelance Brand Designer",
    promise: "Take a brand project from cold DM to invoice, solo.",
    outcome:
      "You finish able to find a client, scope and price the work, build a brand system, present it, and get paid for it.",
    position: 0,
    // Ordered by the sequence a learner should actually work through them.
    courseSlugs: [
      "landing-your-first-client",
      "pricing-and-proposals",
      "brand-identity-essentials",
    ],
  },
];

/**
 * Seeds the first (and, for this release, only) track from existing courses. Created as a DRAFT —
 * spec's open decision #2 says the first release may honestly support only one track, and a draft
 * status means it stays invisible to learners until an admin deliberately publishes it.
 */
export async function seedTracks(): Promise<{ created: number; skipped: number }> {
  let created = 0;
  let skipped = 0;

  for (const def of TRACKS) {
    const [existing] = await db.select({ id: track.id }).from(track).where(eq(track.slug, def.slug));
    if (existing) {
      skipped += 1;
      continue;
    }

    const courses = await db
      .select({ id: course.id, slug: course.slug })
      .from(course)
      .where(inArray(course.slug, def.courseSlugs))
      .orderBy(asc(course.slug));

    const idBySlug = new Map(courses.map((c) => [c.slug, c.id]));
    const missing = def.courseSlugs.filter((s) => !idBySlug.has(s));
    if (missing.length > 0) {
      throw new Error(
        `Cannot seed track "${def.slug}": missing courses ${missing.join(", ")}. ` +
          `Create them first — a track that silently drops courses is worse than one that fails loudly.`,
      );
    }

    const [row] = await db
      .insert(track)
      .values({
        slug: def.slug,
        title: def.title,
        promise: def.promise,
        outcome: def.outcome,
        position: def.position,
        status: "draft",
      })
      .returning({ id: track.id });

    await db.insert(trackCourse).values(
      def.courseSlugs.map((slug, i) => ({ trackId: row.id, courseId: idBySlug.get(slug)!, position: i })),
    );

    created += 1;
  }

  return { created, skipped };
}

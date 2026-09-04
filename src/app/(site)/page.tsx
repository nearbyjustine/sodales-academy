import type { Metadata } from "next";
import { CourseArtwork } from "@/components/brand/course-artwork";
import { TrackRow } from "@/components/track/track-row";
import { ButtonLink } from "@/components/ui/button-link";
import { getCatalogStats, getTracks } from "@/lib/content/queries";

export const metadata: Metadata = {
  title: "Sodales Academy",
  description:
    "Ordered tracks in freelancing, branding, and web development. Each one ends in a stated capability.",
};

/**
 * The rhythm section is fixed copy, not derived data. It describes how the
 * Academy is actually run — if that changes, this changes. It deliberately
 * makes no claim about outcomes, graduates, or how long anything takes for a
 * given person.
 */
const RHYTHM = [
  {
    label: "Read",
    body: "Each lesson is written to be finished in one sitting, not skimmed across a week.",
  },
  {
    label: "Build",
    body: "Every course produces something real. You are not collecting notes, you are collecting work.",
  },
  {
    label: "Mark it done",
    body: "Progress is yours and it persists. Pick up exactly where you stopped, on any device.",
  },
];

export default async function Home() {
  const [stats, tracks] = await Promise.all([getCatalogStats(), getTracks()]);
  const lead = tracks[0] ?? null;

  return (
    <>
      {/* 1. The promise, with one real track previewed rather than described */}
      <section className="mx-auto grid max-w-6xl gap-10 px-4 py-20 md:grid-cols-2 md:py-28">
        <div className="flex flex-col gap-6">
          <p className="label-eyebrow text-violet">Sodales Academy</p>
          <h1 className="text-5xl leading-[0.95] font-bold tracking-tight md:text-7xl">
            Learn the craft. Ship the work.
          </h1>
          <p className="max-w-md text-lg text-graphite">
            {lead
              ? "Ordered tracks, not a pile of videos. Start at lesson one and finish able to do the thing the track names."
              : "Practical courses in freelancing, branding, and web development, built by the Sodales collective."}
          </p>
          <div className="flex flex-wrap gap-3 pt-2">
            {lead ? (
              <ButtonLink href={`/tracks/${lead.slug}`}>See the {lead.title} track</ButtonLink>
            ) : (
              <ButtonLink href="/courses">Browse courses</ButtonLink>
            )}
            <ButtonLink variant="outline" href="/courses">
              Browse all courses
            </ButtonLink>
          </div>
        </div>

        <div className="relative isolate min-h-64 overflow-hidden rounded-md border border-border">
          <div className="absolute inset-0 -z-10">
            <CourseArtwork
              seed={lead?.slug ?? "sodales-academy"}
              lessonCount={lead?.lessonCount ?? 9}
            />
          </div>
          <div
            aria-hidden="true"
            className="absolute inset-0 -z-10 bg-linear-to-t from-obsidian/95 via-obsidian/40 to-transparent"
          />
          <div className="flex h-full flex-col justify-end gap-3 p-10 text-ivory">
            {lead ? (
              <>
                <p className="label-eyebrow text-violet-accessible">Track</p>
                <p className="text-3xl leading-tight font-bold tracking-tight">{lead.title}</p>
                <p className="text-ivory/70">
                  {lead.courseCount} courses · {lead.lessonCount} lessons
                </p>
              </>
            ) : (
              <p className="text-3xl leading-tight font-bold tracking-tight">
                Creative Intelligence. Collective Impact.
              </p>
            )}
          </div>
        </div>
      </section>

      {/* Live catalog counts — the only numbers on this page, and all real */}
      <section className="border-y border-border">
        <div className="mx-auto grid max-w-6xl divide-y divide-border sm:grid-cols-3 sm:divide-x sm:divide-y-0">
          {[
            { label: "Tracks", value: tracks.length },
            { label: "Courses", value: stats.courses },
            { label: "Lessons", value: stats.lessons },
          ].map((stat) => (
            <div key={stat.label} className="flex flex-col gap-1 px-4 py-10 text-center">
              <span className="text-5xl font-bold tracking-tight">{stat.value}</span>
              <span className="label-eyebrow text-graphite">{stat.label}</span>
            </div>
          ))}
        </div>
      </section>

      {/* 2. Pick your climb. Rendered only when there is something to pick — an
          empty grid of slots reads as broken and costs more trust than omitting
          the section entirely. */}
      {tracks.length > 0 ? (
        <section className="mx-auto max-w-6xl px-4 py-20">
          <h2 className="text-3xl font-bold tracking-tight">Pick your climb</h2>
          <p className="mt-3 max-w-xl text-graphite">
            Each track is an ordered path through several courses. The order is the point.
          </p>
          <div className="mt-10 grid gap-6 md:grid-cols-2">
            {tracks.map((track) => (
              <TrackRow key={track.slug} track={track} />
            ))}
          </div>
        </section>
      ) : null}

      {/* 3. What the week-to-week rhythm actually is */}
      <section className="mx-auto max-w-6xl px-4 py-20">
        <h2 className="text-3xl font-bold tracking-tight">What it&apos;s actually like</h2>
        <ul className="mt-8 divide-y divide-border border-t border-border">
          {RHYTHM.map((item, index) => (
            <li key={item.label} className="flex flex-col gap-2 py-6 md:flex-row md:gap-8">
              <span className="label-eyebrow shrink-0 text-graphite md:w-12">
                {String(index + 1).padStart(2, "0")}
              </span>
              <span className="shrink-0 text-xl font-bold md:w-48">{item.label}</span>
              <p className="max-w-xl text-graphite">{item.body}</p>
            </li>
          ))}
        </ul>
      </section>

      {/* 4. What you walk away with — the lead track's real outcome copy */}
      {lead ? (
        <section className="bg-deep-ink text-ivory">
          <div className="mx-auto max-w-6xl px-4 py-20">
            <p className="label-eyebrow text-violet-accessible">What you walk away with</p>
            <p className="mt-4 max-w-3xl text-3xl leading-tight font-bold tracking-tight md:text-4xl">
              {lead.outcome}
            </p>
          </div>
        </section>
      ) : null}

      {/* 5. Request a seat */}
      <section className="bg-obsidian text-ivory">
        <div className="mx-auto flex max-w-6xl flex-col items-start gap-6 px-4 py-20">
          <h2 className="text-3xl font-bold tracking-tight">Ready to start?</h2>
          <p className="max-w-xl text-ivory/70">
            Seats are issued by invite code. If you have one, sign up and it&apos;ll let you
            through.
          </p>
          <ButtonLink href="/sign-up">I have an invite code</ButtonLink>
        </div>
      </section>
    </>
  );
}

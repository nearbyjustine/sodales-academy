import type { Metadata } from "next";
import Link from "next/link";
import { ButtonLink } from "@/components/ui/button-link";
import { Badge } from "@/components/ui/badge";
import { getAllCourses, getTracksForAdmin } from "@/lib/content/queries";
import { requireRole } from "@/lib/session";

export const metadata: Metadata = { title: "Overview" };

export default async function AdminOverviewPage() {
  const session = await requireRole("instructor", "admin");
  const courses = await getAllCourses(session);
  // Tracks are admin-managed; an instructor gets an empty list from this query
  // by design, so the whole section is simply absent for them.
  const tracks = session.role === "admin" ? await getTracksForAdmin(session) : [];

  const drafts = courses.filter((c) => c.status === "draft");
  const emptyCourses = courses.filter((c) => c.lessonCount === 0);
  const draftTracks = tracks.filter((t) => t.status === "draft");
  const emptyTracks = tracks.filter((t) => t.courseCount === 0);

  const counts = [
    { label: "Courses", value: courses.length },
    { label: "Lessons", value: courses.reduce((sum, c) => sum + c.lessonCount, 0) },
    ...(session.role === "admin" ? [{ label: "Tracks", value: tracks.length }] : []),
  ];

  // Everything an admin would otherwise have to go hunting for. A course with
  // no lessons or a track with no courses is publishable but broken for the
  // learner, so those surface here rather than staying invisible until someone
  // clicks into them.
  const attention = [
    ...draftTracks.map((t) => ({
      key: `track-${t.slug}`,
      kind: "Track",
      title: t.title,
      note: "Draft — not visible to anyone",
      href: `/admin/tracks/${t.id}/edit`,
    })),
    ...emptyTracks
      .filter((t) => t.status === "published")
      .map((t) => ({
        key: `empty-track-${t.slug}`,
        kind: "Track",
        title: t.title,
        note: "Published with no courses — enrolment will fail",
        href: `/admin/tracks/${t.id}/edit`,
      })),
    ...drafts.map((c) => ({
      key: `course-${c.slug}`,
      kind: "Course",
      title: c.title,
      note: "Draft — not in the catalog",
      href: `/admin/courses/${c.slug}/edit`,
    })),
    ...emptyCourses
      .filter((c) => c.status === "published")
      .map((c) => ({
        key: `empty-course-${c.slug}`,
        kind: "Course",
        title: c.title,
        note: "Published with no lessons",
        href: `/admin/courses/${c.slug}/edit`,
      })),
  ];

  return (
    <div className="p-6 lg:p-10">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-3xl font-bold tracking-tight">Overview</h1>
        <div className="flex gap-3">
          <ButtonLink href="/admin/courses/new">New course</ButtonLink>
          {session.role === "admin" ? (
            <ButtonLink variant="outline" href="/admin/tracks/new">
              New track
            </ButtonLink>
          ) : null}
        </div>
      </div>

      {/* One dense strip, not a row of same-size cards. These are reference
          figures, not the point of the page. */}
      <dl className="mt-8 flex flex-wrap divide-x divide-border rounded-md border border-border">
        {counts.map((c) => (
          <div key={c.label} className="flex-1 px-6 py-4">
            <dt className="label-eyebrow text-graphite">{c.label}</dt>
            <dd className="mt-1 text-2xl font-bold tracking-tight tabular-nums">{c.value}</dd>
          </div>
        ))}
      </dl>

      <section className="mt-10">
        <h2 className="text-xl font-bold tracking-tight">Needs attention</h2>

        {attention.length === 0 ? (
          <div className="mt-4 rounded-md border border-dashed border-border p-8">
            <p className="font-bold">Everything is published and complete.</p>
            <p className="mt-1 max-w-prose text-graphite">
              Drafts, courses without lessons, and tracks without courses show up here so you
              don&apos;t have to go looking for them.
            </p>
          </div>
        ) : (
          <ul className="mt-4 divide-y divide-border rounded-md border border-border">
            {attention.map((item) => (
              <li key={item.key}>
                <Link
                  href={item.href}
                  className="group/item flex flex-wrap items-center gap-x-4 gap-y-1 px-6 py-4 outline-none transition-colors hover:bg-secondary/40 focus-visible:ring-2 focus-visible:ring-violet"
                >
                  <Badge variant="outline" className="shrink-0">
                    {item.kind}
                  </Badge>
                  <span className="font-bold group-hover/item:text-violet">{item.title}</span>
                  <span className="text-graphite">{item.note}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

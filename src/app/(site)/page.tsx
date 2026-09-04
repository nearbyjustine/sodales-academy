import Link from "next/link";
import { CourseArtwork } from "@/components/brand/course-artwork";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button-link";
import { getCatalogStats, getCourses } from "@/lib/content/queries";

export default async function Home() {
  const [stats, courses] = await Promise.all([getCatalogStats(), getCourses()]);
  const categories = Array.from(new Set(courses.map((c) => c.category)));
  const featured = courses.slice(0, 3);

  return (
    <>
      {/* Hero */}
      <section className="mx-auto grid max-w-6xl gap-10 px-4 py-20 md:grid-cols-2 md:py-28">
        <div className="flex flex-col gap-6">
          <p className="label-eyebrow text-violet">Sodales Academy</p>
          <h1 className="text-5xl leading-[0.95] font-bold tracking-tight md:text-7xl">
            Learn the craft. Ship the work.
          </h1>
          <p className="max-w-md text-lg text-graphite">
            Practical courses in freelancing, branding, and web development, built by the
            Sodales collective for the team members shipping it.
          </p>
          <div className="flex flex-wrap gap-3 pt-2">
            <ButtonLink href="/courses">Browse courses</ButtonLink>
            <ButtonLink variant="outline" href="/dashboard">
              View dashboard
            </ButtonLink>
          </div>
        </div>

        <div className="relative isolate min-h-64 overflow-hidden rounded-md border border-border">
          <div className="absolute inset-0 -z-10">
            <CourseArtwork seed="sodales-academy" lessonCount={9} />
          </div>
          {/* Scrim: the tagline has to stay readable wherever a light band
              happens to fall behind it. */}
          <div
            aria-hidden="true"
            className="absolute inset-0 -z-10 bg-linear-to-t from-obsidian/95 via-obsidian/40 to-transparent"
          />
          <div className="flex h-full items-end p-10 text-ivory">
            <p className="text-3xl leading-tight font-bold tracking-tight">
              Creative Intelligence. Collective Impact.
            </p>
          </div>
        </div>
      </section>

      {/* Live stats */}
      <section className="border-y border-border">
        <div className="mx-auto grid max-w-6xl divide-y divide-border sm:grid-cols-3 sm:divide-x sm:divide-y-0">
          {[
            { label: "Courses", value: stats.courses },
            { label: "Lessons", value: stats.lessons },
            { label: "Categories", value: stats.categories },
          ].map((stat) => (
            <div key={stat.label} className="flex flex-col gap-1 px-4 py-10 text-center">
              <span className="text-5xl font-bold tracking-tight">{stat.value}</span>
              <span className="label-eyebrow text-graphite">{stat.label}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Learning tracks */}
      <section className="mx-auto max-w-6xl px-4 py-20">
        <h2 className="text-3xl font-bold tracking-tight">Learning tracks</h2>
        <ul className="mt-8 divide-y divide-border border-t border-border">
          {categories.map((category, index) => (
            <li key={category}>
              <Link
                href={`/courses?q=${encodeURIComponent(category)}`}
                className="group/track flex items-center gap-6 py-6 outline-none focus-visible:ring-2 focus-visible:ring-violet"
              >
                <span className="label-eyebrow text-graphite">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <span className="text-xl font-bold group-hover/track:text-violet">
                  {category}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      {/* Featured courses */}
      <section className="mx-auto max-w-6xl px-4 py-20">
        <h2 className="text-3xl font-bold tracking-tight">Featured courses</h2>
        <ul className="mt-8 divide-y divide-border border-t border-border">
          {featured.map((course) => (
            <li key={course.slug}>
              <Link
                href={`/courses/${course.slug}`}
                className="flex flex-col gap-4 py-6 outline-none focus-visible:ring-2 focus-visible:ring-violet md:flex-row md:items-center md:justify-between md:gap-6"
              >
                <div className="h-20 w-28 shrink-0 overflow-hidden rounded-md">
                  <CourseArtwork seed={course.slug} lessonCount={course.lessonCount} />
                </div>

                <div className="flex flex-1 flex-col gap-2">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="capitalize">
                      {course.level}
                    </Badge>
                    <span className="label-eyebrow text-graphite">
                      {course.lessonCount} lessons
                    </span>
                  </div>
                  <span className="text-xl font-bold">{course.title}</span>
                  <p className="max-w-xl text-graphite">{course.description}</p>
                </div>
                <span className="label-eyebrow shrink-0 text-violet">View course</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      {/* CTA band */}
      <section className="bg-obsidian text-ivory">
        <div className="mx-auto flex max-w-6xl flex-col items-start gap-6 px-4 py-20">
          <h2 className="text-3xl font-bold tracking-tight">Ready to get started?</h2>
          <ButtonLink href="/courses">Browse courses</ButtonLink>
        </div>
      </section>
    </>
  );
}

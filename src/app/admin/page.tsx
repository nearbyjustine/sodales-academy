import Link from "next/link";
import { Button } from "@/components/ui/button";
import { getAllCourses } from "@/lib/content/queries";

export default async function AdminOverviewPage() {
  const courses = await getAllCourses();
  const published = courses.filter((c) => c.status === "published");
  const drafts = courses.filter((c) => c.status === "draft");

  const stats = [
    { label: "Published courses", value: published.length },
    { label: "Drafts", value: drafts.length },
    { label: "Total lessons", value: courses.reduce((sum, c) => sum + c.lessonCount, 0) },
    { label: "Categories", value: new Set(courses.map((c) => c.category)).size },
  ];

  return (
    <div className="p-6 lg:p-10">
      <h1 className="text-3xl font-bold tracking-tight">Overview</h1>

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <div key={stat.label} className="rounded-md border border-border p-6">
            <span className="text-3xl font-bold tracking-tight">{stat.value}</span>
            <p className="label-eyebrow mt-1 text-graphite">{stat.label}</p>
          </div>
        ))}
      </div>

      <div className="mt-8 flex gap-3">
        <Button render={<Link href="/admin/courses/new" />}>New course</Button>
        <Button variant="outline" render={<Link href="/admin/courses" />}>
          All courses
        </Button>
      </div>
    </div>
  );
}

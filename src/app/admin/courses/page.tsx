import type { Metadata } from "next";
import Link from "next/link";
import { FolderOpenIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { CourseRowActions } from "@/components/admin/course-row-actions";
import { getAllCourses } from "@/lib/content/queries";

export const metadata: Metadata = { title: "Courses" };

export default async function AdminCoursesPage() {
  const courses = await getAllCourses();

  return (
    <div className="p-6 lg:p-10">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-3xl font-bold tracking-tight">Courses</h1>
        <Button render={<Link href="/admin/courses/new" />}>New course</Button>
      </div>

      {courses.length === 0 ? (
        <div className="flex flex-col items-center gap-4 py-24 text-center">
          <FolderOpenIcon aria-hidden="true" className="size-10 text-graphite" />
          <h2 className="text-xl font-bold">No courses yet</h2>
          <p className="max-w-sm text-graphite">
            Courses you create will show up here.
          </p>
          <Button render={<Link href="/admin/courses/new" />}>New course</Button>
        </div>
      ) : (
        <div className="mt-8 rounded-md border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Level</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Lessons</TableHead>
                <TableHead className="w-12">
                  <span className="sr-only">Actions</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {courses.map((course) => (
                <TableRow key={course.slug}>
                  <TableCell className="font-bold">{course.title}</TableCell>
                  <TableCell>
                    {course.status === "published" ? (
                      <Badge className="bg-emerald-100 text-emerald-800">Published</Badge>
                    ) : (
                      <Badge variant="secondary">Draft</Badge>
                    )}
                  </TableCell>
                  <TableCell className="capitalize">{course.level}</TableCell>
                  <TableCell>{course.category}</TableCell>
                  <TableCell>{course.lessonCount}</TableCell>
                  <TableCell>
                    <CourseRowActions
                      id={course.id}
                      courseId={course.slug}
                      courseTitle={course.title}
                      status={course.status}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

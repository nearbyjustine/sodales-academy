import type { MetadataRoute } from "next";
import { getCourses } from "@/lib/content/queries";

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://sodales.vercel.app";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const courses = await getCourses();

  return [
    { url: BASE_URL, changeFrequency: "monthly", priority: 1 },
    { url: `${BASE_URL}/courses`, changeFrequency: "weekly", priority: 0.8 },
    ...courses.map((course) => ({
      url: `${BASE_URL}/courses/${course.slug}`,
      changeFrequency: "monthly" as const,
      priority: 0.6,
    })),
  ];
}

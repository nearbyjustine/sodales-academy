import type { Metadata } from "next";
import Link from "next/link";
import { BrandWordmark } from "@/components/brand/brand-wordmark";
import { AdminNav } from "@/components/admin/admin-nav";
import { AdminMobileNav } from "@/components/admin/admin-mobile-nav";
import { requireRole } from "@/lib/session";

export const metadata: Metadata = { robots: { index: false } };

export default async function AdminLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const session = await requireRole("instructor", "admin");

  return (
    <div className="lg:grid lg:grid-cols-[240px_1fr]">
      {/* The sidebar is chrome, not content: a second neutral layer and a
          sticky full-height column, so it reads as the frame around the task
          rather than a strip of the same page. Without the height it also had
          no bottom to pin its footer to, leaving "Signed in as" floating in
          the middle of the viewport. */}
      <aside className="hidden border-r border-border bg-graphite/5 p-6 lg:sticky lg:top-0 lg:flex lg:h-screen lg:flex-col lg:gap-8">
        <Link href="/admin" className="outline-none focus-visible:ring-2 focus-visible:ring-violet">
          <BrandWordmark product="Academy" />
        </Link>
        <AdminNav />
        <div className="mt-auto flex flex-col gap-2">
          <Link
            href="/"
            className="label-eyebrow text-graphite outline-none hover:text-violet focus-visible:ring-2 focus-visible:ring-violet"
          >
            View site
          </Link>
          <p className="label-eyebrow text-graphite/60">Signed in as {session.role}</p>
        </div>
      </aside>

      <div className="flex items-center justify-between gap-4 border-b border-border p-4 lg:hidden">
        <Link
          href="/admin"
          className="outline-none focus-visible:ring-2 focus-visible:ring-violet"
        >
          <BrandWordmark product="Academy" />
        </Link>
        <AdminMobileNav role={session.role} />
      </div>

      <div className="text-sm">{children}</div>
    </div>
  );
}

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
      <aside className="hidden border-r border-border p-6 lg:flex lg:flex-col lg:gap-8">
        <Link href="/admin">
          <BrandWordmark product="Academy" />
        </Link>
        <AdminNav />
        <p className="label-eyebrow mt-auto text-graphite">Signed in as {session.role}</p>
      </aside>

      <div className="flex items-center justify-between gap-4 border-b border-border p-4 lg:hidden">
        <Link href="/admin">
          <BrandWordmark product="Academy" />
        </Link>
        <AdminMobileNav role={session.role} />
      </div>

      <div className="text-sm">{children}</div>
    </div>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { MenuIcon } from "lucide-react";
import { BrandWordmark } from "@/components/brand/brand-wordmark";
import { AdminNav } from "@/components/admin/admin-nav";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
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
        <Sheet>
          <SheetTrigger render={<Button variant="ghost" size="icon" aria-label="Open menu" />}>
            <MenuIcon />
          </SheetTrigger>
          <SheetContent side="left">
            <SheetHeader>
              <SheetTitle>Admin</SheetTitle>
            </SheetHeader>
            <div className="flex flex-col gap-6 px-4">
              <AdminNav closeOnNavigate />
              <p className="label-eyebrow text-graphite">Signed in as {session.role}</p>
            </div>
          </SheetContent>
        </Sheet>
      </div>

      <div className="text-sm">{children}</div>
    </div>
  );
}

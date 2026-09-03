"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { SheetClose } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

const LINKS = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/courses", label: "Courses" },
];

export function AdminNav({ closeOnNavigate }: { closeOnNavigate?: boolean }) {
  const pathname = usePathname();

  return (
    <nav aria-label="Admin" className="flex flex-col gap-1">
      {LINKS.map((link) => {
        const isActive = pathname === link.href;
        const className = cn(
          "rounded-md px-3 py-2 text-sm font-bold outline-none transition-colors focus-visible:ring-2 focus-visible:ring-violet",
          isActive ? "bg-secondary text-violet" : "text-graphite hover:bg-muted",
        );

        return closeOnNavigate ? (
          <SheetClose
            key={link.href}
            render={<Link href={link.href} aria-current={isActive ? "page" : undefined} className={className} />}
          >
            {link.label}
          </SheetClose>
        ) : (
          <Link
            key={link.href}
            href={link.href}
            aria-current={isActive ? "page" : undefined}
            className={className}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}

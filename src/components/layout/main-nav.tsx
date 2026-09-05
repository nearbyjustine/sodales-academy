"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { getSiteNavLinks } from "@/components/layout/site-nav-links";
import { cn } from "@/lib/utils";

export function MainNav({ showAdmin }: { showAdmin: boolean }) {
  const pathname = usePathname();

  const links = getSiteNavLinks(showAdmin);

  return (
    <nav aria-label="Main" className="hidden items-center gap-6 md:flex">
      {links.map((link) => {
        const isActive = pathname === link.href || pathname.startsWith(`${link.href}/`);
        return (
          <Link
            key={link.href}
            href={link.href}
            aria-current={isActive ? "page" : undefined}
            className={cn(
              "label-eyebrow rounded-sm text-graphite outline-none transition-colors hover:text-violet focus-visible:ring-2 focus-visible:ring-violet",
              isActive && "text-violet",
            )}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
